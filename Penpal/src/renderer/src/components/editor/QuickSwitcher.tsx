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
        className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl shadow-2xl w-[500px] max-h-[400px] overflow-hidden ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Open file..."
          className="w-full bg-transparent text-[var(--c-text-heading)] text-sm px-4 py-3 outline-none border-b border-[var(--c-border)] placeholder-[var(--c-text-faint)] focus:ring-2 focus:ring-inset focus:ring-[color-mix(in_srgb,var(--c-accent)_25%,transparent)]"
        />
        <div className="overflow-y-auto max-h-[320px] scrollbar-penpal">
          {results.map((entry, i) => {
            const folder = entry.path.split('/').slice(0, -1).join('/')
            return (
              <div
                key={entry.path}
                onClick={() => { onSelect(entry.path); onClose() }}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer text-xs ${
                  i === selectedIdx ? 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent-blue)]' : 'text-[var(--c-text-secondary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)]'
                }`}
              >
                <span className="truncate font-medium">{entry.title || entry.name}</span>
                {folder && <span className="text-[var(--c-text-faint)] text-[10px] truncate ml-2 shrink-0">{folder}</span>}
              </div>
            )
          })}
          {results.length === 0 && query && (
            <div className="px-4 py-6 text-center text-[var(--c-text-faint)] text-xs">No files found</div>
          )}
        </div>
      </div>
    </div>
  )
}
