export interface KeyValue {
  key: string
  value: string
  enabled: boolean
}

export type BodyType = 'none' | 'raw' | 'form-data'

export interface FormDataEntry {
  key: string
  value: string
  type: 'text' | 'file'
  file?: File
  enabled: boolean
}

export interface RequestData {
  method: string
  url: string
  headers: KeyValue[]
  body: string
  bodyType: BodyType
  formDataEntries: FormDataEntry[]
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  size: number
}
