import { isTauriEnv } from './tauri-env'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

function parseSseLines(lines: string[]): string[] {
  const tokens: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) continue
    const data = trimmed.slice(6)
    if (data === '[DONE]') break
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) tokens.push(content)
    } catch {
      // skip malformed SSE chunks
    }
  }
  return tokens
}

async function* streamViaTauri(
  messages: ChatMessage[],
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const { invoke, Channel } = await import('@tauri-apps/api/core')

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  }
  const body = JSON.stringify({
    model: config.model,
    messages,
    stream: true,
  })

  // Collect chunks via Tauri Channel
  let resolve: ((value: IteratorResult<string>) => void) | null = null
  const queue: string[] = []
  let done = false
  let error: string | null = null

  const onChunk = new Channel<{ kind: string; data: string }>()
  onChunk.onmessage = (chunk) => {
    if (chunk.kind === 'done') {
      done = true
      if (resolve) { resolve({ value: undefined as unknown as string, done: true }); resolve = null }
    } else if (chunk.kind === 'error') {
      error = chunk.data
      done = true
      if (resolve) { resolve({ value: undefined as unknown as string, done: true }); resolve = null }
    } else {
      // Parse SSE data from the raw chunk
      const lines = chunk.data.split('\n')
      const tokens = parseSseLines(lines)
      for (const t of tokens) {
        if (resolve) {
          const r = resolve
          resolve = null
          r({ value: t, done: false })
        } else {
          queue.push(t)
        }
      }
    }
  }

  // Fire the streaming request (don't await — it resolves when stream ends)
  const invokePromise = invoke('http_proxy_stream', {
    req: { method: 'POST', url, headers, body },
    onChunk,
  })

  try {
    while (true) {
      if (signal?.aborted) return
      if (queue.length > 0) {
        yield queue.shift()!
        continue
      }
      if (done) break
      // Wait for next chunk
      const result = await new Promise<IteratorResult<string>>((r) => { resolve = r })
      if (result.done) break
      yield result.value
    }
    if (error) throw new Error(error)
  } finally {
    await invokePromise.catch(() => {})
  }
}

async function* streamViaProxy(
  messages: ChatMessage[],
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const res = await fetch('/api-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'x-target-url': url,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text()
    let msg = `${res.status}`
    try {
      const json = JSON.parse(body)
      msg = json.error?.message || json.message || msg
    } catch { /* use status code */ }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Key无效: ${msg}`)
    }
    if (res.status === 429) {
      throw new Error(`请求限流，请稍后重试: ${msg}`)
    }
    throw new Error(`AI服务异常 (${res.status}): ${msg}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip malformed SSE chunks
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return
    throw err
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (isTauriEnv()) {
    yield* streamViaTauri(messages, config, signal)
  } else {
    yield* streamViaProxy(messages, config, signal)
  }
}
