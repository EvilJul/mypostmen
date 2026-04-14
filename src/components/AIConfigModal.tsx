import { useState } from 'react'
import { useAIStore } from '@/stores/ai-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export function AIConfigModal({ trigger }: { trigger?: React.ReactElement }) {
  const { config, setConfig } = useAIStore()
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [open, setOpen] = useState(false)

  const handleSave = () => {
    setConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() })
    setOpen(false)
  }

  const handleTest = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const url = `${baseUrl.trim().replace(/\/$/, '')}/chat/completions`
      const res = await fetch('/api-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'x-target-url': url,
        },
        body: JSON.stringify({
          model: model.trim() || 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      })
      if (res.ok) {
        setTestResult('success')
        setTestMsg('连接成功')
      } else {
        const body = await res.text()
        let msg = `${res.status}`
        try {
          const json = JSON.parse(body)
          msg = json.error?.message || json.message || msg
        } catch { /* use status */ }
        setTestResult('error')
        setTestMsg(msg)
      }
    } catch (err) {
      setTestResult('error')
      setTestMsg(err instanceof Error ? err.message : '连接失败')
    } finally {
      setTesting(false)
    }
  }

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setModel(config.model)
      setTestResult(null)
      setTestMsg('')
    }
    setOpen(nextOpen)
  }

  return (
    <>
      <span onClick={() => handleOpen(true)} className="cursor-pointer">
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>AI 服务配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="ai-base-url">Base URL</Label>
              <Input
                id="ai-base-url"
                className="font-mono text-sm"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                兼容 OpenAI 协议的 API 地址，如 OpenAI、Claude proxy、Ollama 等
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-api-key">API Key</Label>
              <div className="relative">
                <Input
                  id="ai-api-key"
                  className="font-mono text-sm pr-10"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                API Key 存储在浏览器本地，请勿在公共设备上使用
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                className="font-mono text-sm"
                placeholder="gpt-4o"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 text-sm rounded-md p-2 ${
                testResult === 'success'
                  ? 'bg-green-500/10 text-green-700'
                  : 'bg-red-500/10 text-red-700'
              }`}>
                {testResult === 'success'
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <XCircle className="h-4 w-4 shrink-0" />
                }
                <span className="truncate">{testMsg}</span>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !baseUrl.trim() || !apiKey.trim()}
              >
                {testing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                测试连接
              </Button>
              <Button size="sm" onClick={handleSave}>
                保存配置
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
