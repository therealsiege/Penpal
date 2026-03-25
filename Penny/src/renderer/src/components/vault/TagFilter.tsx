import { useState, useEffect, useRef } from 'react'
import type { VaultTag } from '../../types'

interface TagFilterProps {
  activeTag: string | null
  onSelectTag: (tag: string | null) => void
}

export function TagFilter({ activeTag, onSelectTag }: TagFilterProps) {
  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<VaultTag[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !loaded) {
      window.api.vaultTags().then(t => {
        setTags(t)
        setLoaded(true)
      }).catch(() => setLoaded(true))
    }
  }, [open, loaded])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-1.5 rounded text-xs border transition-colors flex items-center gap-1 ${
          activeTag
            ? 'bg-blue-600/20 border-blue-600/40 text-blue-300'
            : 'bg-[#141a22]/60 border-[#2a3440]/50 text-[#5a6a7a] hover:text-[#8a96a4]'
        }`}
      >
        {activeTag ? (
          <>
            <span className="truncate max-w-[80px]">#{activeTag}</span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                onSelectTag(null)
              }}
              className="text-[#3a4858] hover:text-[#8a96a4] ml-1"
            >
              x
            </span>
          </>
        ) : (
          <>Tags</>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[#0c1018] border border-[#2a3440]/50 rounded shadow-xl z-50 max-h-64 overflow-y-auto">
          {!loaded && (
            <div className="px-3 py-2 text-xs text-[#3a4858]">Loading tags...</div>
          )}
          {loaded && tags.length === 0 && (
            <div className="px-3 py-2 text-xs text-[#2a3440]">No tags found</div>
          )}
          {tags.map(t => (
            <button
              key={t.name}
              onClick={() => {
                onSelectTag(t.name === activeTag ? null : t.name)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-[#141a22]/60 transition-colors flex items-center justify-between ${
                t.name === activeTag ? 'text-blue-300' : 'text-[#5a6a7a]'
              }`}
            >
              <span className="text-xs truncate">#{t.name}</span>
              <span className="text-[10px] text-[#2a3440] shrink-0 ml-2">{t.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
