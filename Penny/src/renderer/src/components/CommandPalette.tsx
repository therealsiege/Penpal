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

// Usage:
//   <CommandPalette actions={myActions} />
//   Trigger with Cmd+K / Ctrl+K, dismiss with Escape or backdrop click.

export function CommandPalette({ actions }: Props) {
  // `open`    — whether the palette is logically open
  // `visible` — delayed by one tick to trigger CSS enter animation
  // `closing` — set true just before unmounting to play exit animations
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up any pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // Trigger the enter animation: mount first (open=true), then flip visible
  // on the next tick so the browser sees the initial state before animating.
  useEffect(() => {
    if (open) {
      // One-tick delay lets the DOM paint the initial opacity-0 state
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [open])

  // Close sequence: play exit animations, then actually unmount
  const triggerClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
      setQuery('')
      setSelected(0)
    }, 160) // slightly longer than the 150ms exit duration
  }, [closing])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          triggerClose()
        } else {
          setOpen(true)
        }
      }
      if (e.key === 'Escape' && open) {
        triggerClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, triggerClose])

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset selection when query changes
  useEffect(() => {
    setSelected(0)
  }, [query])

  const filtered = query.trim()
    ? actions.filter(a => {
        const q = query.toLowerCase()
        return (
          a.label.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        )
      })
    : actions

  const execute = useCallback(
    (action: CommandAction) => {
      triggerClose()
      action.action()
    },
    [triggerClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [filtered, selected, execute]
  )

  if (!open) return null

  // Group results by category, maintaining insertion order
  const groups = new Map<string, CommandAction[]>()
  for (const a of filtered) {
    if (!groups.has(a.category)) groups.set(a.category, [])
    groups.get(a.category)!.push(a)
  }

  // Stagger delay capped at 10 items (300ms total spread)
  const staggerDelay = (idx: number) => `${Math.min(idx, 9) * 30}ms`

  // Animation class helpers driven by visible/closing state
  const backdropClass = closing
    ? 'cp-backdrop-exit'
    : visible
      ? 'animate-backdrop-fade-in'
      : 'opacity-0'

  const modalClass = closing
    ? 'cp-modal-exit'
    : visible
      ? 'animate-modal-scale-in'
      : 'opacity-0 scale-[0.96] -translate-y-2'

  let globalIndex = 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-[200] ${backdropClass}`}
        onClick={triggerClose}
      />

      {/* Modal */}
      <div
        className={`fixed top-[15%] left-1/2 -translate-x-1/2 w-[520px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[201] overflow-hidden ${modalClass}`}
      >
        {/* Search input row */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <span className="text-slate-500 text-sm select-none">&#8984;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={[
              'flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600',
              'focus:outline-none rounded px-1 py-0.5 transition-all duration-150',
              inputFocused
                ? 'ring-2 ring-blue-500/50'
                : 'ring-2 ring-blue-500/0 hover:ring-blue-500/20',
            ].join(' ')}
          />
          <kbd className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 select-none">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 px-4 py-6 text-center">
              No matching commands
            </p>
          ) : (
            Array.from(groups.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs text-slate-600 uppercase tracking-wider px-4 py-1.5 select-none">
                  {category}
                </p>
                {items.map(item => {
                  const idx = globalIndex++
                  const isSelected = idx === selected

                  return (
                    <div
                      key={item.id}
                      onClick={() => execute(item)}
                      // Staggered fade-in: each item enters slightly after the previous
                      className={[
                        'cp-item-enter',
                        'flex items-center justify-between px-4 py-2 cursor-pointer',
                        'transition-colors duration-100',
                        // Active item gets border-pulse class; non-active gets transparent placeholder
                        isSelected
                          ? 'cp-border-pulse bg-blue-600/15 text-blue-100'
                          : 'border-l-2 border-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100',
                      ].join(' ')}
                      style={{ animationDelay: staggerDelay(idx) }}
                    >
                      <div className="flex items-center gap-0 min-w-0">
                        <span className="text-sm truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-slate-500 ml-2 truncate">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="ml-3 shrink-0 text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
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
