import type { RequestData, ResponseData } from './types'
import { isTauriEnv } from './tauri-env'

function buildHeaders(data: RequestData): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const h of data.headers) {
    if (h.enabled && h.key.trim()) {
      headers[h.key.trim()] = h.value
    }
  }
  return headers
}

function buildBody(data: RequestData): string | undefined {
  if (['GET', 'HEAD'].includes(data.method)) return undefined
  if (data.bodyType === 'form-data') {
    // Tauri proxy doesn't support FormData binary — fall back to text entries as URL-encoded
    const params = new URLSearchParams()
    for (const entry of data.formDataEntries) {
      if (entry.enabled && entry.key.trim() && entry.type === 'text') {
        params.append(entry.key.trim(), entry.value)
      }
    }
    return params.toString() || undefined
  }
  if (data.bodyType === 'raw' && data.body) return data.body
  return undefined
}

async function sendViaTauri(data: RequestData): Promise<ResponseData> {
  const { invoke } = await import('@tauri-apps/api/core')
  const headers = buildHeaders(data)
  const body = buildBody(data)

  const start = performance.now()
  const res = await invoke<{
    status: number
    status_text: string
    headers: Record<string, string>
    body: string
  }>('http_proxy', {
    req: { method: data.method, url: data.url, headers, body },
  })
  const duration = Math.round(performance.now() - start)

  return {
    status: res.status,
    statusText: res.status_text,
    headers: res.headers,
    body: res.body,
    duration,
    size: new Blob([res.body]).size,
  }
}

async function sendViaProxy(data: RequestData, signal?: AbortSignal): Promise<ResponseData> {
  const enabledHeaders = buildHeaders(data)

  let requestBody: BodyInit | undefined = undefined
  if (!['GET', 'HEAD'].includes(data.method)) {
    if (data.bodyType === 'form-data') {
      const fd = new FormData()
      for (const entry of data.formDataEntries) {
        if (!entry.enabled || !entry.key.trim()) continue
        if (entry.type === 'file' && entry.file) {
          fd.append(entry.key.trim(), entry.file, entry.file.name)
        } else if (entry.type === 'text') {
          fd.append(entry.key.trim(), entry.value)
        }
      }
      requestBody = fd
    } else if (data.bodyType === 'raw' && data.body) {
      requestBody = data.body
    }
  }

  const start = performance.now()
  let res: Response
  try {
    res = await fetch('/api-proxy', {
      method: data.method || 'GET',
      headers: { ...enabledHeaders, 'x-target-url': data.url },
      body: requestBody,
      signal,
    })
  } catch (err) {
    // Network-level errors (CORS, offline, etc.)
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw err
      }
      throw new Error(`网络错误：${err.message}`)
    }
    throw new Error('网络错误：无法连接到代理服务器')
  }

  const duration = Math.round(performance.now() - start)
  const body = await res.text()

  // Detect proxy-generated errors (not from the target server)
  if (res.headers.get('x-proxy-error')) {
    let message = `请求失败 (${res.status})`
    try {
      const parsed = JSON.parse(body)
      if (parsed.error) {
        if (/timeout|timed?\s*out/i.test(parsed.error)) {
          message = '请求超时：目标服务器在 30 秒内未响应'
        } else if (/ECONNREFUSED/i.test(parsed.error)) {
          message = '连接被拒绝：目标服务器未启动或端口不正确'
        } else if (/ENOTFOUND/i.test(parsed.error)) {
          message = '域名解析失败：请检查 URL 是否正确'
        } else if (/ECONNRESET/i.test(parsed.error)) {
          message = '连接被重置：目标服务器意外断开了连接'
        } else if (/certificate|ssl|tls/i.test(parsed.error)) {
          message = 'SSL/TLS 证书错误：目标服务器证书无效'
        } else {
          message = `请求失败：${parsed.error}`
        }
      }
    } catch { /* use default message */ }
    throw new Error(message)
  }

  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => { headers[key] = value })

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    body,
    duration,
    size: new Blob([body]).size,
  }
}

export async function sendRequest(data: RequestData, signal?: AbortSignal): Promise<ResponseData> {
  if (isTauriEnv()) {
    return sendViaTauri(data)
  }
  return sendViaProxy(data, signal)
}
