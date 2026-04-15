import { useRef, useEffect, useState, Component, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { MessageSquare, Trash2, StopCircle, Send } from 'lucide-react'
import { useAIStore } from '@/stores/ai-store'
import { streamToStore } from '@/lib/stream-to-store'
import { Button } from '@/components/ui/button'

export function AIChatPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const { config, messages, streaming, streamingContent, error, clearChat, abortController, contextMessages, addMessage } = useAIStore()
  const hasConfig = config.baseUrl && config.apiKey
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const hasMessages = messages.length > 0 || streaming

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streaming])

  // Lighter scroll for streaming content — just keep pinned to bottom
  useEffect(() => {
    if (streaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [streamingContent, streaming])

  const handleStop = () => {
    abortController?.abort()
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming || !hasConfig) return

    setInput('')
    addMessage({ role: 'user', content: text })

    // Build full message history: context (system + initial analysis) + visible turns in order + new user message
    // Skip the first user message (index 0) because contextMessages already contains the structured request context
    const fullMessages = [
      ...contextMessages,
      ...messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]

    await streamToStore(fullMessages)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden when parent provides its own */}
      {!hideHeader && (
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium truncate">AI 助手</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {hasMessages && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="清空对话">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Inline clear button when header is hidden */}
      {hideHeader && hasMessages && (
        <div className="flex justify-end px-3 pt-2">
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clearChat}>
            <Trash2 className="h-3 w-3 mr-1" />
            清空
          </Button>
        </div>
      )}

      {/* Chat body */}
      <div className="flex-1 overflow-auto">
        {!hasConfig ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <span className="text-sm">请先在右上角配置 AI 服务</span>
          </div>
        ) : !hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <span className="text-sm">发送请求后点击「AI分析」</span>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {messages.map((msg, i) => (
              <ChatBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {streaming && streamingContent && (
              <ChatBubble role="assistant" content={streamingContent} isStreaming />
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bottom area: stop button or chat input */}
      {streaming ? (
        <div className="p-2 border-t">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleStop}>
            <StopCircle className="h-3.5 w-3.5 mr-1.5" />
            停止生成
          </Button>
        </div>
      ) : hasConfig && hasMessages ? (
        <div className="p-2 border-t">
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[36px] max-h-[120px] text-xs font-mono p-2 rounded-md border bg-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="继续提问..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChatBubble({
  role,
  content,
  isStreaming,
}: {
  role: string
  content: string
  isStreaming?: boolean
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-sm px-3 py-2 text-xs max-w-[90%]">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-lg rounded-tl-sm px-3 py-2 text-xs max-w-[90%] min-w-0 break-words overflow-hidden prose prose-xs prose-neutral dark:prose-invert [&_pre]:bg-background/50 [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-[11px] [&_pre]:overflow-x-auto [&_code]:text-[11px] [&_code]:break-all [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
        <MarkdownErrorBoundary fallback={content} resetKey={content.length}>
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </MarkdownErrorBoundary>
        {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-foreground/60 ml-0.5 animate-pulse" />}
      </div>
    </div>
  )
}

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: string; resetKey: number },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return <span className="whitespace-pre-wrap">{this.props.fallback}</span>
    }
    return this.props.children
  }
}
