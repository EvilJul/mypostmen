import type { KeyValue, ResponseData } from './types'
import type { ChatMessage } from './ai-service'

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-api-key',
  'proxy-authorization', 'x-target-url',
])

const MAX_BODY_LENGTH = 4000
const HEAD_LENGTH = 2000
const TAIL_LENGTH = 500

function truncateBody(body: string): string {
  if (body.length <= MAX_BODY_LENGTH) return body
  const omitted = body.length - HEAD_LENGTH - TAIL_LENGTH
  return `${body.slice(0, HEAD_LENGTH)}\n\n[...truncated ${omitted} chars...]\n\n${body.slice(-TAIL_LENGTH)}`
}

function filterHeaders(headers: KeyValue[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const h of headers) {
    if (h.enabled && h.key.trim() && !SENSITIVE_HEADERS.has(h.key.trim().toLowerCase())) {
      result[h.key.trim()] = h.value
    }
  }
  return result
}

function filterResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      result[key] = value
    }
  }
  return result
}

function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers)
  if (entries.length === 0) return '(none)'
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n')
}

function isBinaryContentType(contentType: string): boolean {
  return /^(image|audio|video|application\/octet-stream|application\/zip|application\/pdf)/i.test(contentType)
}

export interface AnalysisContext {
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  responseBody: string
  duration: number
}

export function buildAnalysisContext(
  request: { method: string; url: string; headers: KeyValue[]; body: string },
  response: ResponseData,
): AnalysisContext {
  const contentType = response.headers['content-type'] || ''
  let responseBody: string

  if (isBinaryContentType(contentType)) {
    const size = response.size
    responseBody = `[Binary response: ${contentType}, ${size} bytes]`
  } else if (!response.body) {
    responseBody = '(empty)'
  } else {
    responseBody = truncateBody(response.body)
  }

  return {
    method: request.method,
    url: request.url,
    requestHeaders: filterHeaders(request.headers),
    requestBody: request.body || '(none)',
    status: response.status,
    statusText: response.statusText,
    responseHeaders: filterResponseHeaders(response.headers),
    responseBody,
    duration: response.duration,
  }
}

export function buildAnalyzePrompt(ctx: AnalysisContext): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个API调试助手。分析以下API请求和响应，指出：
1. 响应状态是否正常
2. 响应数据结构是否合理
3. 是否存在潜在问题（错误码、空数据、异常字段）
4. 性能建议（如果响应时间异常）
用简洁的中文回答。`,
    },
    {
      role: 'user',
      content: `## 请求
${ctx.method} ${ctx.url}
Headers:
${formatHeaders(ctx.requestHeaders)}
Body: ${ctx.requestBody}

## 响应
Status: ${ctx.status} ${ctx.statusText}
Time: ${ctx.duration}ms
Headers:
${formatHeaders(ctx.responseHeaders)}
Body:
${ctx.responseBody}`,
    },
  ]
}
