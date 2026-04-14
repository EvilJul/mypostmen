import { useState } from 'react'
import { useRequestStore } from '@/stores/request-store'
import { useAIStore } from '@/stores/ai-store'
import { buildAnalysisContext, buildAnalyzePrompt } from '@/lib/context-engine'
import { streamToStore } from '@/lib/stream-to-store'
import { CodeEditor } from '@/components/CodeEditor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, FileText, AlertCircle, Sparkles, Loader2, Copy, Check, Download } from 'lucide-react'

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-500/15 text-green-700 border-green-500/30'
  if (status >= 300 && status < 400) return 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30'
  if (status >= 400 && status < 500) return 'bg-orange-500/15 text-orange-700 border-orange-500/30'
  return 'bg-red-500/15 text-red-700 border-red-500/30'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatBody(body: string, contentType?: string): string {
  if (contentType?.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }
  return body
}

function isBinaryContentType(ct: string): boolean {
  return /^(image|audio|video|application\/octet-stream|application\/zip|application\/pdf)/i.test(ct)
}

function extFromContentType(ct: string): string {
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('html')) return 'html'
  if (ct.includes('css')) return 'css'
  if (ct.includes('javascript')) return 'js'
  return 'txt'
}

export function ResponseViewer() {
  const { method, url, headers, body, response, error, loading } = useRequestStore()
  const config = useAIStore((s) => s.config)
  const streaming = useAIStore((s) => s.streaming)
  const hasAIConfig = config.baseUrl && config.apiKey
  const [copied, setCopied] = useState(false)

  const handleAnalyze = async () => {
    if (!response || !hasAIConfig) return

    const ctx = buildAnalysisContext({ method, url, headers, body }, response)
    const promptMessages = buildAnalyzePrompt(ctx)

    const store = useAIStore.getState()
    store.clearChat()
    // Save context messages so follow-up conversation carries the analysis context
    store.setContextMessages(promptMessages)
    store.addMessage({ role: 'user', content: `分析请求: ${method} ${url}` })

    // Stream with full context
    await streamToStore(promptMessages)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">请求中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-8 w-8 opacity-40" />
          <span className="text-sm">发送请求查看响应</span>
        </div>
      </div>
    )
  }

  const contentType = response.headers['content-type'] || ''
  const binary = isBinaryContentType(contentType)

  const handleCopyBody = async () => {
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = extFromContentType(contentType)
    const blob = new Blob([response.body], { type: contentType || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `response-${Date.now()}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-3 border-b">
        <Badge variant="outline" className={statusColor(response.status)}>
          {response.status} {response.statusText}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {response.duration}ms
        </div>
        <div className="text-xs text-muted-foreground">
          {formatSize(response.size)}
        </div>
        {hasAIConfig && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-xs"
            onClick={handleAnalyze}
            disabled={streaming}
          >
            {streaming
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />分析中...</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1" />AI分析</>
            }
          </Button>
        )}
      </div>

      {/* Tabs: Body / Headers */}
      <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 w-fit">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({Object.keys(response.headers).length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="flex-1 min-h-0 px-3 pb-3 flex flex-col gap-2">
          <div className="flex gap-1 justify-end">
            {!binary && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyBody}>
                {copied ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? '已复制' : '复制'}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDownload}>
              <Download className="h-3 w-3 mr-1" />
              下载
            </Button>
          </div>
          <CodeEditor
            value={formatBody(response.body, contentType)}
            readOnly
            className="w-full flex-1"
          />
        </TabsContent>

        <TabsContent value="headers" className="flex-1 overflow-auto px-3 pb-3">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-xs font-medium bg-muted/50 w-[200px] align-top">
                      {key}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs break-all">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
