import { useRef, useEffect } from 'react'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

const LARGE_FILE_THRESHOLD = 500 * 1024 // 500KB

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
}

export function CodeEditor({ value, onChange, readOnly = false, placeholder, className }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Too large for syntax highlighting — fall back to plain text
  const isLargeFile = value.length > LARGE_FILE_THRESHOLD

  useEffect(() => {
    if (!containerRef.current) return

    const isDark = document.documentElement.classList.contains('dark')

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      ...(isLargeFile ? [] : [json()]),
      ...(isDark ? [oneDark] : []),
      ...(placeholder ? [cmPlaceholder(placeholder)] : []),
      ...(readOnly
        ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
        : []),
      ...(!readOnly
        ? [
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current?.(update.state.doc.toString())
              }
            }),
          ]
        : []),
    ]

    const state = EditorState.create({ doc: value, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Recreate editor when readOnly or dark mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, isLargeFile])

  // Sync external value changes (for readOnly response viewer)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded-md border bg-muted/50 text-sm [&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:outline-none [&_.cm-scroller]:font-mono [&_.cm-scroller]:text-xs ${className ?? ''}`}
    />
  )
}
