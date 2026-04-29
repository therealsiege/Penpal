import { useState, useEffect, useCallback, useRef } from 'react'

interface SearchResult {
  path: string
  title: string
  snippet: string
  score: number
}

interface SearchPanelProps {
  onSelectResult: (path: string) => void
}

export function SearchPanel({ onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [indexReady, setIndexReady] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Build search index on mount
  useEffect(() => {
    window.api.vaultBuildSearchIndex().then(() => setIndexReady(true)).catch(() => {})
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !indexReady) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const hits = await window.api.vaultSearchIndexed(q, 30)
      setResults(hits)
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [indexReady])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(debounceRef.current)
  }, [query, doSearch])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-2 py-2 border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={indexReady ? 'Search vault...' : 'Building index...'}
          disabled={!indexReady}
          className="w-full bg-[var(--c-bg-surface)] text-[var(--c-text-primary)] text-[length:calc(11.9px*var(--penny-ui-nav-scale))] px-2 py-1.5 rounded border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] outline-none focus:border-blue-500 placeholder-[var(--c-border)]"
        />
        {query && results.length > 0 && (
          <div className="text-[length:calc(8.5px*var(--penny-ui-nav-scale))] text-[var(--c-border)] mt-1">{results.length} results</div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.map((r, i) => {
          const folder = r.path.split('/').slice(0, -1).join('/')
          return (
            <div
              key={r.path}
              onClick={() => onSelectResult(r.path)}
              className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border-b border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] transition-colors"
            >
              <div className="text-[length:calc(11.9px*var(--penny-ui-nav-scale))] text-[var(--c-text-secondary)] truncate font-medium">{r.title}</div>
              <div className="text-[length:calc(8.5px*var(--penny-ui-nav-scale))] text-[var(--c-border)] truncate">{folder}</div>
              {r.snippet && (
                <div className="text-[length:calc(8.5px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)] truncate mt-0.5">{r.snippet}</div>
              )}
            </div>
          )
        })}
        {query && !searching && results.length === 0 && indexReady && (
          <div className="px-3 py-6 text-center text-[var(--c-border)] text-[length:calc(10.2px*var(--penny-ui-nav-scale))]">No results</div>
        )}
        {searching && (
          <div className="px-3 py-6 text-center text-[var(--c-border)] text-[length:calc(10.2px*var(--penny-ui-nav-scale))] animate-pulse">Searching...</div>
        )}
      </div>
    </div>
  )
}
