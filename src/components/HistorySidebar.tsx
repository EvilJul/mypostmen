import { useHistoryStore } from '@/stores/history-store'
import { useRequestStore } from '@/stores/request-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Clock } from 'lucide-react'

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-500/15 text-green-700 border-green-500/30'
  if (status >= 300 && status < 400) return 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30'
  if (status >= 400 && status < 500) return 'bg-orange-500/15 text-orange-700 border-orange-500/30'
  return 'bg-red-500/15 text-red-700 border-red-500/30'
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-600',
  POST: 'text-yellow-600',
  PUT: 'text-blue-600',
  PATCH: 'text-purple-600',
  DELETE: 'text-red-600',
}

export function HistorySidebar() {
  const { entries, removeEntry, clearAll } = useHistoryStore()
  const { setMethod, setUrl, setHeaders, setBody, setBodyType, setFormDataEntries, setResponse } = useRequestStore()

  const loadEntry = (entry: (typeof entries)[0]) => {
    setMethod(entry.request.method)
    setUrl(entry.request.url)
    setHeaders(entry.request.headers)
    setBody(entry.request.body)
    setBodyType(entry.request.bodyType || 'none')
    setFormDataEntries(entry.request.formDataEntries || [{ key: '', value: '', type: 'text', enabled: true }])
    setResponse(entry.response)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium">历史记录</span>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
            清空
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            暂无记录
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 p-2.5 hover:bg-muted/50 cursor-pointer group"
                onClick={() => loadEntry(entry)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold ${METHOD_COLORS[entry.request.method] || 'text-gray-600'}`}>
                      {entry.request.method}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusColor(entry.response.status)}`}>
                      {entry.response.status}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                    {entry.request.url}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {entry.response.duration}ms
                    <span className="mx-1">·</span>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeEntry(entry.id)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
