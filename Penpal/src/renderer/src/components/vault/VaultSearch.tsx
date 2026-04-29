import { useState, useRef, useCallback } from 'react'
import type { VaultSearchResult } from '../../types'

interface VaultSearchProps {
  onSelectResult: (path: string) => void
  onSearchActive: (active: boolean) => void
}

export function VaultSearch({ onSelectResult, onSearchActive }: VaultSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VaultSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      onSearchActive(false)
      return
    }
    setSearching(true)
    onSearchActive(true)
    try {
      const r = await window.api.vaultSearch(q)
      setResults(r)
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [onSearchActive])

  const handleChange = (val: string) => {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 300)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    onSearchActive(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div className="relative flex-1">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[calc(14px*var(--penny-ui-nav-scale))] h-[calc(14px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)]"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search vault..."
          className="w-full pl-8 pr-8 py-1.5 bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] rounded text-[length:calc(12px*var(--penny-ui-nav-scale))] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-blue-600/50"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] text-[length:calc(12px*var(--penny-ui-nav-scale))]"
          >
            x
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {(results.length > 0 || (searching && query.length >= 2)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--c-bg-surface)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] rounded shadow-xl z-50 max-h-80 overflow-y-auto">
          {searching && (
            <div className="px-3 py-2 text-[length:calc(12px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)]">Searching...</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.path}-${i}`}
              onClick={() => {
                onSelectResult(r.path)
                handleClear()
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] transition-colors block"
            >
              <div className="text-[length:calc(12px*var(--penny-ui-nav-scale))] text-[var(--c-text-secondary)] truncate">{r.path}</div>
              {r.text && (
                <div className="text-[length:calc(10px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)] truncate mt-0.5">{r.text}</div>
              )}
            </button>
          ))}
          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-[length:calc(12px*var(--penny-ui-nav-scale))] text-[var(--c-border)]">No results</div>
          )}
        </div>
      )}
    </div>
  )
}
