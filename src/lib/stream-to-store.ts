import { streamChat } from './ai-service'
import type { ChatMessage } from './ai-service'
import { useAIStore } from '@/stores/ai-store'

/**
 * Streams AI response to the store with RAF-throttled UI updates.
 * Instead of calling Zustand set() per SSE chunk (causes stutter),
 * we accumulate in a local buffer and flush at 60fps via requestAnimationFrame.
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
  let rafId = 0
  let dirty = false

  const flush = () => {
    if (dirty) {
      useAIStore.getState().setStreamingContent(buffer)
      dirty = false
    }
    if (useAIStore.getState().streaming) {
      rafId = requestAnimationFrame(flush)
    }
  }
  rafId = requestAnimationFrame(flush)

  try {
    for await (const chunk of streamChat(messages, config, controller.signal)) {
      buffer += chunk
      dirty = true
    }
    // Final flush
    cancelAnimationFrame(rafId)
    useAIStore.getState().setStreamingContent(buffer)
    // Move to finalized message
    store.addMessage({ role: 'assistant', content: buffer })
    store.setStreamingContent('')
  } catch (err) {
    cancelAnimationFrame(rafId)
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
    cancelAnimationFrame(rafId)
    store.setStreaming(false)
    store.setAbortController(null)
  }
}
