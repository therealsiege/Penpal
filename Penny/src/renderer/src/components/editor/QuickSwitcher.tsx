import { useState, useEffect, useRef, useMemo } from 'react'
import MiniSearch from 'minisearch'
import { useVaultIndex } from '../../stores/vault-index'
import { useEditorStore } from '../../stores/editor-store'
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
  const recentFiles = useEditorStore(s => s.recentFiles)

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
      const recentEntries = recentFiles
        .map(p => entries.find(e => e.path === p))
        .filter(Boolean) as VaultIndexEntry[]
      return recentEntries.length > 0 ? recentEntries : entries.slice(0, 20)
    }
    const hits = miniSearch.search(query)
    return hits.slice(0, 20).map(h => entries.find(e => e.path === h.id)!).filter(Boolean)
  }, [query, miniSearch, entries, recentFiles])

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-[#0c1018] to-[#080b10] border border-[#2a3440] rounded-xl shadow-2xl w-[500px] max-h-[400px] overflow-hidden ring-1 ring-[#00ff88]/10"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Open file..."
          className="w-full bg-transparent text-[#dce4ec] text-sm px-4 py-3 outline-none border-b border-[#2a3440] placeholder-[#4a5c6e] focus:ring-2 focus:ring-inset focus:ring-[#00ff88]/25"
        />
        <div className="overflow-y-auto max-h-[320px] scrollbar-penpal">
          {results.map((entry, i) => {
            const folder = entry.path.split('/').slice(0, -1).join('/')
            return (
              <div
                key={entry.path}
                onClick={() => { onSelect(entry.path); onClose() }}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer text-xs ${
                  i === selectedIdx ? 'bg-[#00ff88]/12 text-[#00e5ff]' : 'text-[#8a96a4] hover:bg-[#141a22]/60'
                }`}
              >
                <span className="truncate font-medium">{entry.title || entry.name}</span>
                {folder && <span className="text-[#4a5c6e] text-[10px] truncate ml-2 shrink-0">{folder}</span>}
              </div>
            )
          })}
          {results.length === 0 && query && (
            <div className="px-4 py-6 text-center text-[#4a5c6e] text-xs">No files found</div>
          )}
        </div>
      </div>
    </div>
  )
}
