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
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [open])

  const triggerClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
      setQuery('')
      setSelected(0)
    }, 160)
  }, [closing])

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? (document.activeElement as HTMLElement)
        : null
    }
    if (!open && wasOpenRef.current) {
      const el = restoreFocusRef.current
      if (el && typeof el.focus === 'function') {
        requestAnimationFrame(() => {
          try {
            el.focus()
          } catch {
            /* ignore */
          }
        })
      }
      restoreFocusRef.current = null
    }
    wasOpenRef.current = open
  }, [open])

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
        e.preventDefault()
        triggerClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, triggerClose])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open || !visible || closing) return
    const root = dialogRef.current
    if (!root) return

    const focusables = (): HTMLElement[] =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(n => !n.hasAttribute('data-cp-skip-focus'))

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [open, visible, closing])

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
    [triggerClose],
  )

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setSelected(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setSelected(Math.max(0, filtered.length - 1))
      } else if (e.key === 'Enter' && filtered[selected]) {
        e.preventDefault()
        execute(filtered[selected])
      }
    },
    [filtered, selected, execute],
  )

  if (!open) return null

  const groups = new Map<string, CommandAction[]>()
  for (const a of filtered) {
    if (!groups.has(a.category)) groups.set(a.category, [])
    groups.get(a.category)!.push(a)
  }

  const staggerDelay = (idx: number) => `${Math.min(idx, 9) * 30}ms`

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
  const activeId = filtered[selected] ? `cp-opt-${filtered[selected].id}` : undefined

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/55 backdrop-blur-[2px] z-[200] ${backdropClass}`}
        onClick={triggerClose}
        aria-hidden
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={`cp-shell fixed top-[15%] left-1/2 -translate-x-1/2 w-[min(520px,calc(100vw-2rem))] bg-gradient-to-b from-[#0d121a] via-[#0a0e14] to-[#080b10] border border-[#2a3440]/95 rounded-[14px] z-[201] overflow-hidden ring-1 ring-[#00ff88]/12 outline-none ${modalClass}`}
      >
        <div className="border-b border-[#1e2838] px-4 py-3 flex items-center gap-3 bg-[#0a0e14]/50">
          <span className="text-[#4a5c6e] text-sm select-none" aria-hidden>&#8984;</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={true}
            aria-controls="cp-command-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            placeholder="Search commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={[
              'flex-1 bg-transparent text-sm text-[#c4ccd6] placeholder-[#3a4858]',
              'focus:outline-none rounded-lg px-2 py-1 transition-all duration-150',
              inputFocused
                ? 'ring-2 ring-[#00ff88]/35'
                : 'ring-2 ring-transparent hover:ring-[#2a3440]/80',
            ].join(' ')}
          />
          <kbd className="text-[10px] text-[#5a6a7a] bg-[#141a22] px-1.5 py-1 rounded-md border border-[#2a3440] font-mono select-none" aria-hidden>
            ESC
          </kbd>
        </div>

        <div
          id="cp-command-listbox"
          role="listbox"
          aria-label="Commands"
          className="max-h-[400px] overflow-y-auto py-2 scrollbar-penpal"
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-[#3a4858] px-4 py-6 text-center" role="status">
              No matching commands
            </p>
          ) : (
            Array.from(groups.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-[#3a4858] uppercase tracking-[0.16em] px-4 py-1.5 select-none" aria-hidden>
                  {category}
                </p>
                {items.map(item => {
                  const idx = globalIndex++
                  const isSelected = idx === selected

                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`cp-opt-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => execute(item)}
                      onMouseEnter={() => setSelected(idx)}
                      className={[
                        'cp-item-enter w-full text-left',
                        'flex items-center justify-between px-4 py-2',
                        'transition-colors duration-100',
                        isSelected
                          ? 'cp-border-pulse bg-[#00ff88]/10 text-[#e8f4ef]'
                          : 'border-l-2 border-transparent text-[#8a96a4] hover:bg-[#141a22] hover:text-[#c4ccd6]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00ff88]/35',
                      ].join(' ')}
                      style={{ animationDelay: staggerDelay(idx) }}
                    >
                      <span className="flex items-center gap-0 min-w-0">
                        <span className="text-sm truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-[#3a4858] ml-2 truncate">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd className="ml-3 shrink-0 text-xs text-[#3a4858] bg-[#141a22] px-1.5 py-0.5 rounded border border-[#2a3440]">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
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
