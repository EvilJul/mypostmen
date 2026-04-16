import { create } from 'zustand'
import type { ChatMessage } from '@/lib/ai-service'

interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AIState {
  config: AIConfig
  // The system + context messages from the initial analysis (hidden from UI, sent with every request)
  contextMessages: ChatMessage[]
  // Visible conversation messages (user questions + assistant replies)
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  error: string | null
  abortController: AbortController | null
  drawerOpen: boolean

  setConfig: (config: Partial<AIConfig>) => void
  setContextMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  setStreamingContent: (content: string) => void
  setError: (error: string | null) => void
  setAbortController: (controller: AbortController | null) => void
  setDrawerOpen: (open: boolean) => void
  clearChat: () => void
}

export const useAIStore = create<AIState>((set) => ({
  config: {
    baseUrl: localStorage.getItem('ai-base-url') || '',
    apiKey: localStorage.getItem('ai-api-key') || '',
    model: localStorage.getItem('ai-model') || 'gpt-4o',
  },
  contextMessages: [],
  messages: [],
  streaming: false,
  streamingContent: '',
  error: null,
  abortController: null,
  drawerOpen: false,

  setConfig: (partial) =>
    set((state) => {
      const config = { ...state.config, ...partial }
      localStorage.setItem('ai-base-url', config.baseUrl)
      localStorage.setItem('ai-api-key', config.apiKey)
      localStorage.setItem('ai-model', config.model)
      return { config }
    }),
  setContextMessages: (contextMessages) => set({ contextMessages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setStreaming: (streaming) => set({ streaming }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  setError: (error) => set({ error }),
  setAbortController: (abortController) => set({ abortController }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  clearChat: () => set({ messages: [], contextMessages: [], streamingContent: '', error: null }),
}))
