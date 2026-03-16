import { useState, useEffect, useCallback, useRef } from 'react'

export interface CommandAction {
  id: string
  label: string
  description?: string
  shortcut?: string
  category: string
  action: () => void | Promise<void>
}

interface Props {
  actions: CommandAction[]
}

export function CommandPalette({ actions }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = query.trim()
    ? actions.filter(a => {
        const q = query.toLowerCase()
        return a.label.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q)
      })
    : actions

  useEffect(() => {
    setSelected(0)
  }, [query])

  const execute = useCallback((action: CommandAction) => {
    setOpen(false)
    setQuery('')
    action.action()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      execute(filtered[selected])
    }
  }, [filtered, selected, execute])

  if (!open) return null

  // Group by category
  const groups = new Map<string, CommandAction[]>()
  for (const a of filtered) {
    if (!groups.has(a.category)) groups.set(a.category, [])
    groups.get(a.category)!.push(a)
  }

  let globalIndex = 0

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200]" onClick={() => setOpen(false)} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[520px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[201] overflow-hidden">
        {/* Input */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <span className="text-slate-500 text-sm">&#8984;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
          />
          <kbd className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 px-4 py-6 text-center">No matching commands</p>
          ) : (
            Array.from(groups.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider px-4 py-1.5">{category}</p>
                {items.map(item => {
                  const idx = globalIndex++
                  return (
                    <div
                      key={item.id}
                      onClick={() => execute(item)}
                      className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
                        idx === selected ? 'bg-blue-600/20 text-blue-100' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <span className="text-sm">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-slate-500 ml-2">{item.description}</span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
