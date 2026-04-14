import { create } from 'zustand'
import type { RequestData, ResponseData } from '@/lib/types'

export interface HistoryEntry {
  id: string
  timestamp: number
  request: RequestData
  response: ResponseData
}

interface HistoryState {
  entries: HistoryEntry[]
  addEntry: (request: RequestData, response: ResponseData) => void
  removeEntry: (id: string) => void
  clearAll: () => void
}

const STORAGE_KEY = 'mypostmen-history'
const QUOTA_THRESHOLD = 0.8

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    const json = JSON.stringify(entries)
    localStorage.setItem(STORAGE_KEY, json)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Auto-evict oldest 20% of entries
      const evictCount = Math.max(1, Math.floor(entries.length * 0.2))
      const trimmed = entries.slice(evictCount)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    }
  }
}

function checkQuota(entries: HistoryEntry[]) {
  if (typeof navigator?.storage?.estimate !== 'function') return entries
  // Synchronous check: if entries are getting large, preemptively trim
  const json = JSON.stringify(entries)
  const sizeBytes = new Blob([json]).size
  const limitBytes = 5 * 1024 * 1024 // 5MB localStorage limit
  if (sizeBytes / limitBytes > QUOTA_THRESHOLD) {
    const evictCount = Math.max(1, Math.floor(entries.length * 0.2))
    return entries.slice(evictCount)
  }
  return entries
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: loadHistory(),
  addEntry: (request, response) =>
    set((state) => {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        request,
        response,
      }
      let entries = [entry, ...state.entries]
      entries = checkQuota(entries)
      saveHistory(entries)
      return { entries }
    }),
  removeEntry: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id)
      saveHistory(entries)
      return { entries }
    }),
  clearAll: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ entries: [] })
  },
}))
