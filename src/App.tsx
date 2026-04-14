import { RequestEditor } from '@/components/RequestEditor'
import { ResponseViewer } from '@/components/ResponseViewer'
import { AIChatPanel } from '@/components/AIChatPanel'
import { HistorySidebar } from '@/components/HistorySidebar'
import { AIConfigModal } from '@/components/AIConfigModal'
import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}

export default function App() {
  const [historyOpen, setHistoryOpen] = useState(true)
  const theme = useTheme()

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-12 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setHistoryOpen(!historyOpen)}
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
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* History sidebar */}
        {historyOpen && (
          <aside className="w-[260px] shrink-0 border-r">
            <HistorySidebar />
          </aside>
        )}

        {/* Request editor */}
        <div className="flex-1 min-w-0 border-r">
          <RequestEditor />
        </div>

        {/* Response viewer */}
        <div className="flex-1 min-w-0 border-r">
          <ResponseViewer />
        </div>

        {/* AI chat panel */}
        <div className="w-[320px] shrink-0">
          <AIChatPanel />
        </div>
      </div>
    </div>
  )
}
