import { useRef, useCallback, useState } from 'react'
import { useRequestStore } from '@/stores/request-store'
import { useHistoryStore } from '@/stores/history-store'
import { sendRequest } from '@/lib/http-client'
import { buildCurlCommand, parseCurlCommand } from '@/lib/curl-builder'
import { CodeEditor } from '@/components/CodeEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Send, Upload, FileText, Copy, Check, StopCircle, ClipboardPaste } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { BodyType, FormDataEntry, KeyValue } from '@/lib/types'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-600',
  POST: 'text-yellow-600',
  PUT: 'text-blue-600',
  PATCH: 'text-purple-600',
  DELETE: 'text-red-600',
  HEAD: 'text-gray-600',
  OPTIONS: 'text-gray-500',
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'raw', label: 'Raw' },
  { value: 'form-data', label: 'Form Data' },
]

/** Parse pasted JSON and fill request fields.
 *  Supports two formats:
 *  1. Full request spec: { method, url, headers, body }
 *  2. Plain body JSON (e.g. OpenAI chat payload) — auto-sets POST + raw body
 */
function parseAndApply(
  raw: string,
  setters: {
    setMethod: (v: string) => void
    setUrl: (v: string) => void
    setHeaders: (v: KeyValue[]) => void
    setBody: (v: string) => void
    setBodyType: (v: BodyType) => void
  },
): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return '无法解析 JSON，请检查格式'
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'JSON 必须是一个对象'
  }

  const obj = parsed as Record<string, unknown>

  // Detect full request spec: must have "url" field
  if (typeof obj.url === 'string') {
    const method = (typeof obj.method === 'string' ? obj.method : 'POST').toUpperCase()
    setters.setMethod(method)
    setters.setUrl(obj.url)

    // Headers
    if (obj.headers && typeof obj.headers === 'object' && !Array.isArray(obj.headers)) {
      const entries = Object.entries(obj.headers as Record<string, string>)
      const kvs: KeyValue[] = entries.map(([key, value]) => ({
        key,
        value: String(value),
        enabled: true,
      }))
      if (kvs.length === 0) kvs.push({ key: '', value: '', enabled: true })
      setters.setHeaders(kvs)
    }

    // Body
    if (obj.body !== undefined) {
      const bodyStr = typeof obj.body === 'string' ? obj.body : JSON.stringify(obj.body, null, 2)
      setters.setBody(bodyStr)
      setters.setBodyType('raw')
    }
    return null
  }

  // Plain body JSON — treat as POST raw body
  setters.setMethod('POST')
  setters.setBody(JSON.stringify(obj, null, 2))
  setters.setBodyType('raw')

  // Auto-add Content-Type header if not already present
  const store = useRequestStore.getState()
  const hasContentType = store.headers.some(
    (h) => h.key.toLowerCase() === 'content-type' && h.enabled,
  )
  if (!hasContentType) {
    setters.setHeaders([
      { key: 'Content-Type', value: 'application/json', enabled: true },
      ...store.headers,
    ])
  }

  return null
}

export function RequestEditor() {
  const {
    method, url, headers, body, bodyType, formDataEntries,
    setMethod, setUrl, setHeaders, setBody, setBodyType, setFormDataEntries,
    setResponse, setError, setLoading, loading, abortController, setAbortController,
  } = useRequestStore()
  const addEntry = useHistoryStore((s) => s.addEntry)

  // Paste JSON dialog state
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [pasteMode, setPasteMode] = useState<'json' | 'curl'>('curl')

  const handlePasteApply = () => {
    if (pasteMode === 'curl') {
      // Parse curl command
      const parsed = parseCurlCommand(pasteText)
      if (!parsed) {
        setPasteError('无法解析 Curl 命令，请检查格式')
        return
      }
      console.log('[Curl 解析结果]', parsed)
      setMethod(parsed.method)
      setUrl(parsed.url)
      setHeaders(parsed.headers)
      setBody(parsed.body)
      setBodyType(parsed.bodyType)
      // 应用解析出的 formDataEntries，如果没有则重置
      setFormDataEntries(
        parsed.formDataEntries.length > 0
          ? parsed.formDataEntries
          : [{ key: '', value: '', type: 'text', enabled: true }]
      )
    } else {
      // Parse JSON (existing logic)
      const err = parseAndApply(pasteText, { setMethod, setUrl, setHeaders, setBody, setBodyType })
      if (err) {
        setPasteError(err)
        return
      }
    }
    setPasteOpen(false)
    setPasteText('')
    setPasteError(null)
  }

  // --- Query Params bidirectional sync ---
  const isUpdatingFromParams = useRef(false)
  const isUpdatingFromUrl = useRef(false)

  const parseParamsFromUrl = useCallback((rawUrl: string): KeyValue[] => {
    try {
      const u = new URL(rawUrl)
      const params: KeyValue[] = []
      u.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true })
      })
      if (params.length === 0) params.push({ key: '', value: '', enabled: true })
      return params
    } catch {
      return [{ key: '', value: '', enabled: true }]
    }
  }, [])

  const queryParams = parseParamsFromUrl(url)

  const updateUrlFromParams = (params: KeyValue[]) => {
    if (isUpdatingFromUrl.current) return
    isUpdatingFromParams.current = true
    try {
      const base = url.split('?')[0]
      const sp = new URLSearchParams()
      for (const p of params) {
        if (p.enabled && p.key.trim()) sp.append(p.key.trim(), p.value)
      }
      const qs = sp.toString()
      setUrl(qs ? `${base}?${qs}` : base)
    } finally {
      isUpdatingFromParams.current = false
    }
  }

  const handleUrlChange = (newUrl: string) => {
    if (isUpdatingFromParams.current) return
    isUpdatingFromUrl.current = true
    setUrl(newUrl)
    isUpdatingFromUrl.current = false
  }

  const updateParam = (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    const next = queryParams.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    updateUrlFromParams(next)
  }

  const addParam = () => {
    updateUrlFromParams([...queryParams, { key: '', value: '', enabled: true }])
  }

  const removeParam = (index: number) => {
    const next = queryParams.filter((_, i) => i !== index)
    updateUrlFromParams(next.length ? next : [{ key: '', value: '', enabled: true }])
  }

  const [curlCopied, setCurlCopied] = useState(false)

  const handleCopyCurl = async () => {
    const cmd = buildCurlCommand(method, url, headers, body, bodyType, formDataEntries)
    await navigator.clipboard.writeText(cmd)
    setCurlCopied(true)
    setTimeout(() => setCurlCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!url.trim()) return
    console.log('[发送请求]', { method, url, headers, body, bodyType, formDataEntries })
    const controller = new AbortController()
    setAbortController(controller)
    setLoading(true)
    setError(null)
    try {
      const response = await sendRequest({ method, url, headers, body, bodyType, formDataEntries }, controller.signal)
      if (controller.signal.aborted) return
      console.log('[请求成功]', response)
      setResponse(response)
      addEntry({ method, url, headers, body, bodyType, formDataEntries }, response)
    } catch (err) {
      console.error('[请求失败]', err)
      if (controller.signal.aborted) {
        setError('请求已取消')
      } else {
        setError(err instanceof Error ? err.message : 'Request failed')
      }
    } finally {
      setLoading(false)
      setAbortController(null)
    }
  }

  const handleCancel = () => {
    abortController?.abort()
  }

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    const next = headers.map((h, i) =>
      i === index ? { ...h, [field]: val } : h
    )
    setHeaders(next)
  }

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }])
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  // Form data helpers
  const updateFormEntry = (index: number, updates: Partial<FormDataEntry>) => {
    const next = formDataEntries.map((e, i) =>
      i === index ? { ...e, ...updates } : e
    )
    setFormDataEntries(next)
  }

  const addFormEntry = () => {
    setFormDataEntries([...formDataEntries, { key: '', value: '', type: 'text', enabled: true }])
  }

  const removeFormEntry = (index: number) => {
    setFormDataEntries(formDataEntries.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="flex gap-2 p-3 border-b">
        <Select value={method} onValueChange={(v) => v && setMethod(v)}>
          <SelectTrigger className={`w-[120px] font-mono font-semibold ${METHOD_COLORS[method] || ''}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m} className={`font-mono font-semibold ${METHOD_COLORS[m]}`}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1 font-mono text-sm"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        {loading ? (
          <Button variant="destructive" onClick={handleCancel}>
            <StopCircle className="h-4 w-4" />
            <span className="ml-1.5">取消</span>
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!url.trim()}>
            <Send className="h-4 w-4" />
            <span className="ml-1.5">发送</span>
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={handleCopyCurl} disabled={!url.trim()} title="Copy as cURL">
          {curlCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Dialog open={pasteOpen} onOpenChange={(open) => { setPasteOpen(open); if (!open) { setPasteText(''); setPasteError(null) } }}>
          <DialogTrigger render={<Button variant="outline" size="icon" title="导入请求 (Curl/JSON)" />}>
              <ClipboardPaste className="h-4 w-4" />
          </DialogTrigger>
          <DialogContent className="!max-w-[520px]">
            <DialogHeader>
              <DialogTitle>导入请求</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 overflow-hidden">
              {/* Mode toggle */}
              <div className="flex gap-1">
                <Button
                  variant={pasteMode === 'curl' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => { setPasteMode('curl'); setPasteError(null) }}
                >
                  Curl 命令
                </Button>
                <Button
                  variant={pasteMode === 'json' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => { setPasteMode('json'); setPasteError(null) }}
                >
                  JSON
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {pasteMode === 'curl'
                  ? '粘贴 Curl 命令，自动解析 URL、Method、Headers、Body'
                  : '支持两种格式：直接粘贴请求体（自动设为 POST），或完整描述 {method, url, headers, body}'}
              </p>
              <textarea
                className="w-full h-[200px] text-xs font-mono p-3 rounded-md border bg-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={pasteMode === 'curl'
                  ? `curl 'http://api.example.com/v1/chat' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"model": "gpt-4", "messages": [...]}'`
                  : `// 格式一：请求体 JSON（自动 POST + Raw Body）\n{"model": "gpt-4", "messages": [...]}\n\n// 格式二：完整请求\n{"method": "POST", "url": "https://...", "headers": {...}, "body": {...}}`}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPasteError(null) }}
                autoFocus
              />
              {pasteError && (
                <p className="text-xs text-destructive">{pasteError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasteOpen(false)}>取消</Button>
              <Button onClick={handlePasteApply} disabled={!pasteText.trim()}>解析并应用</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Params / Headers / Body */}
      <Tabs defaultValue="params" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 w-fit">
          <TabsTrigger value="params">
            Params
            {queryParams.filter((p) => p.key.trim()).length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({queryParams.filter((p) => p.key.trim()).length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            {headers.filter((h) => h.key.trim()).length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({headers.filter((h) => h.key.trim()).length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="flex-1 overflow-auto px-3 pb-3">
          <div className="space-y-2">
            {queryParams.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => updateParam(i, 'enabled', e.target.checked)}
                  className="shrink-0"
                />
                <Input
                  className="flex-1 font-mono text-sm"
                  placeholder="参数名"
                  value={p.key}
                  onChange={(e) => updateParam(i, 'key', e.target.value)}
                />
                <Input
                  className="flex-1 font-mono text-sm"
                  placeholder="值"
                  value={p.value}
                  onChange={(e) => updateParam(i, 'value', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => removeParam(i)} className="shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addParam}>
              <Plus className="h-3.5 w-3.5 mr-1" /> 添加参数
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 overflow-auto px-3 pb-3">
          <div className="space-y-2">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                  className="shrink-0"
                />
                <Input
                  className="flex-1 font-mono text-sm"
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) => updateHeader(i, 'key', e.target.value)}
                />
                <Input
                  className="flex-1 font-mono text-sm"
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => updateHeader(i, 'value', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHeader}>
              <Plus className="h-3.5 w-3.5 mr-1" /> 添加 Header
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="body" className="flex-1 min-h-0 px-3 pb-3 flex flex-col gap-3">
          {/* Body type selector */}
          <div className="flex gap-1">
            {BODY_TYPES.map((bt) => (
              <Button
                key={bt.value}
                variant={bodyType === bt.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setBodyType(bt.value)}
              >
                {bt.label}
              </Button>
            ))}
          </div>

          {/* Body content */}
          {bodyType === 'none' && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              该请求没有 Body
            </div>
          )}

          {bodyType === 'raw' && (
            <CodeEditor
              value={body}
              onChange={(v) => setBody(v)}
              placeholder='{"key": "value"}'
              className="flex-1 min-h-[200px]"
            />
          )}

          {bodyType === 'form-data' && (
            <div className="flex-1 overflow-auto space-y-2">
              {formDataEntries.map((entry, i) => (
                <FormDataRow
                  key={i}
                  entry={entry}
                  onUpdate={(updates) => updateFormEntry(i, updates)}
                  onRemove={() => removeFormEntry(i)}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addFormEntry}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 添加字段
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FormDataRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: FormDataEntry
  onUpdate: (updates: Partial<FormDataEntry>) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpdate({ file, value: file.name })
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        type="checkbox"
        checked={entry.enabled}
        onChange={(e) => onUpdate({ enabled: e.target.checked })}
        className="shrink-0"
      />
      <Input
        className="flex-1 min-w-[120px] font-mono text-sm"
        placeholder="字段名"
        value={entry.key}
        onChange={(e) => onUpdate({ key: e.target.value })}
      />
      {/* Type toggle */}
      <Button
        variant="outline"
        size="sm"
        className="w-[70px] text-xs shrink-0"
        onClick={() => {
          onUpdate({
            type: entry.type === 'text' ? 'file' : 'text',
            file: undefined,
            value: '',
          })
        }}
      >
        {entry.type === 'text' ? (
          <><FileText className="h-3 w-3 mr-1" />文本</>
        ) : (
          <><Upload className="h-3 w-3 mr-1" />文件</>
        )}
      </Button>
      {/* Value input */}
      {entry.type === 'text' ? (
        <Input
          className="flex-1 min-w-[120px] font-mono text-sm"
          placeholder="值"
          value={entry.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
        />
      ) : (
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" /> 选择文件
          </Button>
          {entry.file && (
            <span className="text-xs text-muted-foreground truncate" title={`${entry.file.name} (${formatFileSize(entry.file.size)})`}>
              {entry.file.name} ({formatFileSize(entry.file.size)})
            </span>
          )}
        </div>
      )}
      <Button variant="ghost" size="icon" onClick={onRemove} className="shrink-0">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
