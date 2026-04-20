import { useState, useMemo, Component, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, Braces, Brackets } from 'lucide-react'

interface JsonTreeViewerProps {
  data: unknown
  expandDepth?: number
}

// Color scheme for different value types
const VALUE_COLORS = {
  string: 'text-green-600 dark:text-green-400',
  number: 'text-blue-600 dark:text-blue-400',
  boolean: 'text-purple-600 dark:text-purple-400',
  null: 'text-gray-500 dark:text-gray-400',
  key: 'text-foreground font-medium',
}

// Error boundary to catch rendering errors
class JsonTreeErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <pre className="text-xs p-2 whitespace-pre-wrap break-all">{this.props.fallback}</pre>
    }
    return this.props.children
  }
}

function JsonValue({ 
  value, 
  depth = 0, 
  expandDepth = 2,
}: { 
  value: unknown
  depth?: number
  expandDepth?: number
}) {
  const [expanded, setExpanded] = useState(depth < expandDepth)

  const type = Array.isArray(value) ? 'array' : typeof value

  // Primitive values
  if (value === null) {
    return <span className={VALUE_COLORS.null}>null</span>
  }

  if (type === 'string') {
    return <span className={VALUE_COLORS.string}>"{String(value)}"</span>
  }

  if (type === 'number') {
    return <span className={VALUE_COLORS.number}>{String(value)}</span>
  }

  if (type === 'boolean') {
    return <span className={VALUE_COLORS.boolean}>{value ? 'true' : 'false'}</span>
  }

  // Object or array
  if (type === 'object' || type === 'array') {
    const entries = Array.isArray(value) 
      ? value.map((v, i) => [i, v] as [number, unknown])
      : Object.entries(value as Record<string, unknown>)
    
    const isEmpty = entries.length === 0
    const length = entries.length

    if (isEmpty) {
      return (
        <span className="text-muted-foreground">
          {Array.isArray(value) ? '[]' : '{}'}
        </span>
      )
    }

    return (
      <span className="inline">
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-0.5 hover:bg-muted/50 rounded px-0.5 -ml-0.5"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {Array.isArray(value) ? (
            <Brackets className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Braces className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-muted-foreground text-xs">
            {Array.isArray(value) ? `[${length}]` : `{${length}}`}
          </span>
        </button>
        {expanded && (
          <div className="ml-3 border-l border-border/50 pl-2 my-0.5">
            {entries.map(([key, val]) => (
              <div key={String(key)} className="flex items-start gap-1.5 py-px">
                <span className={VALUE_COLORS.key}>
                  {Array.isArray(value) ? (
                    <span className="text-muted-foreground">{key}:</span>
                  ) : (
                    <span>"{key}":</span>
                  )}
                </span>
                <JsonValue value={val} depth={depth + 1} expandDepth={expandDepth} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  return <span className="text-muted-foreground">{String(value)}</span>
}

export function JsonTreeViewer({ data, expandDepth = 2 }: JsonTreeViewerProps) {
  // Parse if string
  const parsed = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }, [data])

  if (parsed === undefined || parsed === null) {
    return (
      <div className="text-muted-foreground text-sm p-2">
        无内容
      </div>
    )
  }

  // Fallback to raw string if parsing failed
  const fallbackText = typeof data === 'string' ? data : JSON.stringify(parsed, null, 2)

  return (
    <div className="font-mono text-xs leading-relaxed p-2 overflow-auto">
      <JsonTreeErrorBoundary fallback={fallbackText}>
        <JsonValue value={parsed} expandDepth={expandDepth} />
      </JsonTreeErrorBoundary>
    </div>
  )
}
