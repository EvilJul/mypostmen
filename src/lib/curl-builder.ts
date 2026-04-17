import type { KeyValue, BodyType, FormDataEntry } from './types'

/**
 * Parse a curl command into request components
 * Supports: -X/--request, -H/--header, -d/--data, --data-raw, URL
 */
export function parseCurlCommand(curl: string): {
  method: string
  url: string
  headers: KeyValue[]
  body: string
  bodyType: BodyType
} | null {
  if (!curl.trim().toLowerCase().startsWith('curl')) {
    return null
  }

  // Normalize: remove line continuations (\ at end of line)
  let normalized = curl
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const result = {
    method: 'GET',
    url: '',
    headers: [] as KeyValue[],
    body: '',
    bodyType: 'none' as BodyType,
  }

  // Tokenize: handle both single and double quotes
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }
  if (current) tokens.push(current)

  // Parse tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Skip 'curl' itself
    if (token.toLowerCase() === 'curl') continue

    // Method: -X or --request
    if (token === '-X' || token === '--request') {
      const next = tokens[++i]
      if (next) result.method = next.toUpperCase()
      continue
    }

    // Header: -H or --header
    if (token === '-H' || token === '--header') {
      const next = tokens[++i]
      if (next) {
        const colonIndex = next.indexOf(':')
        if (colonIndex > 0) {
          const key = next.slice(0, colonIndex).trim()
          const value = next.slice(colonIndex + 1).trim()
          result.headers.push({ key, value, enabled: true })
        }
      }
      continue
    }

    // Body: -d, --data, --data-raw, --data-binary
    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      const next = tokens[++i]
      if (next) {
        result.body = next
        result.bodyType = 'raw'
        // Auto-set POST if method is still GET
        if (result.method === 'GET') {
          result.method = 'POST'
        }
      }
      continue
    }

    // URL: first token that looks like a URL (starts with http or is not a flag)
    if (!token.startsWith('-') && !result.url) {
      // Check if it looks like a URL
      if (token.startsWith('http://') || token.startsWith('https://') || token.includes('.')) {
        result.url = token
      }
    }
  }

  // Ensure at least one header entry for UI
  if (result.headers.length === 0) {
    result.headers.push({ key: '', value: '', enabled: true })
  }

  return result.url ? result : null
}

export function buildCurlCommand(
  method: string,
  url: string,
  headers: KeyValue[],
  body: string,
  bodyType: BodyType,
  formDataEntries: FormDataEntry[],
): string {
  const parts: string[] = ['curl']

  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  parts.push(`'${url.replace(/'/g, "'\\''")}'`)

  for (const h of headers) {
    if (h.enabled && h.key.trim()) {
      parts.push(`-H '${h.key.trim()}: ${h.value.replace(/'/g, "'\\''")}'`)
    }
  }

  if (bodyType === 'raw' && body) {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`)
  } else if (bodyType === 'form-data') {
    for (const entry of formDataEntries) {
      if (!entry.enabled || !entry.key.trim()) continue
      if (entry.type === 'file' && entry.file) {
        parts.push(`-F '${entry.key.trim()}=@${entry.file.name.replace(/'/g, "'\\''")}'`)
      } else if (entry.type === 'text') {
        parts.push(`-F '${entry.key.trim()}=${entry.value.replace(/'/g, "'\\''")}'`)
      }
    }
  }

  return parts.join(' \\\n  ')
}
