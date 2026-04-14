const isTauri = '__TAURI_INTERNALS__' in window

export function isTauriEnv(): boolean {
  return isTauri
}
