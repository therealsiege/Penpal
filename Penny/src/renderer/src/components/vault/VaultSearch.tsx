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
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
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
          className="w-full pl-8 pr-8 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600/50"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
          >
            x
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {(results.length > 0 || (searching && query.length >= 2)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700/50 rounded shadow-xl z-50 max-h-80 overflow-y-auto">
          {searching && (
            <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.path}-${i}`}
              onClick={() => {
                onSelectResult(r.path)
                handleClear()
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800/60 transition-colors block"
            >
              <div className="text-xs text-slate-300 truncate">{r.path}</div>
              {r.text && (
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{r.text}</div>
              )}
            </button>
          ))}
          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-xs text-slate-600">No results</div>
          )}
        </div>
      )}
    </div>
  )
}
