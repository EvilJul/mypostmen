import { RequestEditor } from '@/components/RequestEditor'
import { ResponseViewer } from '@/components/ResponseViewer'
import { AIChatPanel } from '@/components/AIChatPanel'
import { HistorySidebar } from '@/components/HistorySidebar'
import { AIConfigModal } from '@/components/AIConfigModal'
import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen, Sun, Moon, BotMessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Group, Panel, Separator } from 'react-resizable-panels'

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}

function ResizeHandle() {
  return (
    <Separator className="resize-handle group">
      <div className="resize-handle-pill" />
    </Separator>
  )
}

export default function App() {
  const [historyOpen, setHistoryOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const theme = useTheme()

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-12 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setHistoryOpen(!historyOpen)}
          title={historyOpen ? '收起历史' : '展开历史'}
        >
          {historyOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">MyPostmen</span>
          <span className="text-xs text-muted-foreground">AI-Native API 调试工具</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={theme.toggle}>
            {theme.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <AIConfigModal />
          <Button
            variant={aiOpen ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setAiOpen(!aiOpen)}
            title={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
          >
            <BotMessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content — relative so AI drawer overlays on top */}
      <div className="relative flex flex-1 min-h-0">
        {/* History sidebar */}
        {historyOpen && (
          <aside className="w-[260px] shrink-0 border-r">
            <HistorySidebar />
          </aside>
        )}

        {/* Resizable request + response */}
        <Group orientation="horizontal" className="flex-1 min-w-0">
          <Panel defaultSize={50} minSize={10}>
            <div className="h-full overflow-hidden">
              <RequestEditor />
            </div>
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={50} minSize={10}>
            <div className="h-full overflow-hidden">
              <ResponseViewer />
            </div>
          </Panel>
        </Group>

        {/* AI drawer overlay */}
        <div
          className={`ai-drawer-backdrop ${aiOpen ? 'ai-drawer-backdrop-visible' : ''}`}
          onClick={() => setAiOpen(false)}
        />
        <aside className={`ai-drawer ${aiOpen ? 'ai-drawer-open' : ''}`}>
          <div className="ai-drawer-header">
            <div className="flex items-center gap-2">
              <BotMessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">AI 助手</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setAiOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="ai-drawer-body">
            <AIChatPanel hideHeader />
          </div>
        </aside>
      </div>
    </div>
  )
}
