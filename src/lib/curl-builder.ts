import type { KeyValue, BodyType, FormDataEntry } from './types'

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
