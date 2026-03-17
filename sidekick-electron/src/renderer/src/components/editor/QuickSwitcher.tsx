import { useState, useEffect, useRef, useMemo } from 'react'
import MiniSearch from 'minisearch'
import { useVaultIndex } from '../../stores/vault-index'
import type { VaultIndexEntry } from '../../types'

interface QuickSwitcherProps {
  onSelect: (path: string) => void
  onClose: () => void
}

export function QuickSwitcher({ onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const entries = useVaultIndex(s => s.entries)

  const miniSearch = useMemo(() => {
    const ms = new MiniSearch<VaultIndexEntry>({
      fields: ['title', 'name', 'path'],
      storeFields: ['path', 'name', 'title'],
      idField: 'path',
      searchOptions: {
        boost: { title: 3, name: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    ms.addAll(entries)
    return ms
  }, [entries])

  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent / alphabetical when empty
      return entries.slice(0, 20)
    }
    const hits = miniSearch.search(query)
    return hits.slice(0, 20).map(h => entries.find(e => e.path === h.id)!).filter(Boolean)
  }, [query, miniSearch, entries])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      onSelect(results[selectedIdx].path)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[500px] max-h-[400px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Open file..."
          className="w-full bg-transparent text-slate-200 text-sm px-4 py-3 outline-none border-b border-slate-800"
        />
        <div className="overflow-y-auto max-h-[320px]">
          {results.map((entry, i) => {
            const folder = entry.path.split('/').slice(0, -1).join('/')
            return (
              <div
                key={entry.path}
                onClick={() => { onSelect(entry.path); onClose() }}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer text-xs ${
                  i === selectedIdx ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate font-medium">{entry.title || entry.name}</span>
                {folder && <span className="text-slate-600 text-[10px] truncate ml-2 shrink-0">{folder}</span>}
              </div>
            )
          })}
          {results.length === 0 && query && (
            <div className="px-4 py-6 text-center text-slate-600 text-xs">No files found</div>
          )}
        </div>
      </div>
    </div>
  )
}
