import { streamChat } from './ai-service'
import type { ChatMessage } from './ai-service'
import { useAIStore } from '@/stores/ai-store'

/**
 * Streams AI response to the store with throttled UI updates.
 * Uses batched updates with time-based throttling to reduce re-renders
 * while maintaining smooth streaming appearance.
 */
export async function streamToStore(messages: ChatMessage[]) {
  const store = useAIStore.getState()
  const { config } = store

  const controller = new AbortController()
  store.setAbortController(controller)
  store.setStreaming(true)
  store.setStreamingContent('')
  store.setError(null)

  let buffer = ''
  let lastUpdateTime = 0
  const UPDATE_INTERVAL = 80 // Update UI every 80ms max (roughly 12fps for streaming text)

  const updateUI = (content: string) => {
    useAIStore.getState().setStreamingContent(content)
  }

  try {
    for await (const chunk of streamChat(messages, config, controller.signal)) {
      buffer += chunk
      
      // Throttle updates by time
      const now = performance.now()
      if (now - lastUpdateTime >= UPDATE_INTERVAL) {
        updateUI(buffer)
        lastUpdateTime = now
      }
    }
    
    // Final update
    updateUI(buffer)
    
    // Move to finalized message
    store.addMessage({ role: 'assistant', content: buffer })
    store.setStreamingContent('')
  } catch (err) {
    if (!controller.signal.aborted) {
      const msg = err instanceof Error ? err.message : 'AI请求失败'
      store.setError(msg)
      // Preserve partial content on connection drop
      if (buffer) {
        store.addMessage({ role: 'assistant', content: buffer + '\n\n[连接中断]' })
        store.setStreamingContent('')
      }
    }
  } finally {
    store.setStreaming(false)
    store.setAbortController(null)
  }
}
