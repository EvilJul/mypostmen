import { create } from 'zustand'
import type { KeyValue, ResponseData, BodyType, FormDataEntry } from '@/lib/types'

interface RequestState {
  method: string
  url: string
  headers: KeyValue[]
  body: string
  bodyType: BodyType
  formDataEntries: FormDataEntry[]
  response: ResponseData | null
  error: string | null
  loading: boolean
  abortController: AbortController | null

  setMethod: (method: string) => void
  setUrl: (url: string) => void
  setHeaders: (headers: KeyValue[]) => void
  setBody: (body: string) => void
  setBodyType: (bodyType: BodyType) => void
  setFormDataEntries: (entries: FormDataEntry[]) => void
  setResponse: (response: ResponseData | null) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  reset: () => void
}

const initialState = {
  method: 'GET',
  url: '',
  headers: [{ key: '', value: '', enabled: true }],
  body: '',
  bodyType: 'none' as BodyType,
  formDataEntries: [{ key: '', value: '', type: 'text' as const, enabled: true }],
  response: null,
  error: null,
  loading: false,
  abortController: null,
}

export const useRequestStore = create<RequestState>((set) => ({
  ...initialState,
  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),
  setHeaders: (headers) => set({ headers }),
  setBody: (body) => set({ body }),
  setBodyType: (bodyType) => set({ bodyType }),
  setFormDataEntries: (formDataEntries) => set({ formDataEntries }),
  setResponse: (response) => set({ response, error: null }),
  setError: (error) => set({ error, response: null }),
  setLoading: (loading) => set({ loading }),
  setAbortController: (abortController) => set({ abortController }),
  reset: () => set(initialState),
}))
