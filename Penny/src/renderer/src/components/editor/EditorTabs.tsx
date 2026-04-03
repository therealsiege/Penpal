/**
 * EditorTabs — Enhanced tab bar for the Penny editor.
 *
 * Features:
 *  1. Tab enter animation  — new tabs slide in from right via animate-tab-enter
 *  2. Active tab indicator — 3px blue bottom border that transitions with the active tab
 *  3. Tab close animation  — closing tabs shrink width + fade over 150ms before DOM removal
 *  4. Dirty indicator pulse — unsaved-changes dot pulses with animate-breathe-glow-blue
 *  5. Tab hover preview    — tooltip shows full file path (Layout.tsx pattern)
 *  6. Reorder cursor hint  — cursor-grab on hover, cursor-grabbing on mousedown
 */

import { useCallback, useRef, useState } from 'react'
import { useEditorStore, type EditorTab } from '../../stores/editor-store'

// Track which tab IDs have already been animated so we only animate on first mount.
const seenTabIds = new Set<string>()

interface TabItemProps {
  tab: EditorTab
  isActive: boolean
  isNew: boolean
  onActivate: (id: string) => void
  onClose: (e: React.MouseEvent, tab: EditorTab) => void
}

function TabItem({ tab, isActive, isNew, onActivate, onClose }: TabItemProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [isGrabbing, setIsGrabbing] = useState(false)
  const closeStore = useEditorStore(s => s.closeTab)
  const fileName = tab.path.split('/').pop() || tab.path

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsClosing(true)
      // Wait for CSS animation (150ms) then remove from store
      setTimeout(() => closeStore(tab.id), 150)
    },
    [tab.id, closeStore],
  )

  return (
    // Outer wrapper carries the enter/close animation and maintains relative positioning
    // for the bottom active indicator.
    <div
      className={[
        'relative shrink-0 border-r border-[color-mix(in_srgb,var(--c-border)_40%,transparent)]',
        isNew ? 'animate-tab-enter' : '',
        isClosing ? 'animate-tab-close' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ overflow: 'hidden' }}
    >
      {/* ── group wrapper for tooltip + cursor ── */}
      <div className="relative group">
        <button
          onClick={() => onActivate(tab.id)}
          onMouseDown={() => setIsGrabbing(true)}
          onMouseUp={() => setIsGrabbing(false)}
          onMouseLeave={() => setIsGrabbing(false)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 text-sm shrink-0 transition-colors',
            isGrabbing ? 'cursor-grabbing' : 'cursor-grab',
            isActive
              ? 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] text-[var(--c-text-heading)]'
              : 'text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)]',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* Dirty indicator dot — pulses blue when tab has unsaved changes */}
          {tab.dirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 animate-breathe-glow-blue"
            />
          )}

          <span className="truncate max-w-[140px]">{fileName}</span>

          {/* Close button — always in DOM so layout is stable; visible on hover */}
          <span
            role="button"
            aria-label={`Close ${fileName}`}
            onClick={handleCloseClick}
            className="ml-1 text-[var(--c-text-faint)] hover:text-[var(--c-text-primary)] transition-colors opacity-0 group-hover:opacity-100 leading-none select-none"
          >
            ×
          </span>
        </button>

        {/* ── Hover tooltip — full file path, slides up from below ── */}
        <span
          className="
            pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50
            px-2 py-1 rounded-md bg-[var(--c-bg-elevated)] text-[var(--c-text-heading)] text-xs font-medium whitespace-nowrap
            shadow-lg border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]
            opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
            transition-all duration-200
          "
        >
          {tab.path}
        </span>
      </div>

      {/* ── Active tab bottom indicator — 3px blue bar ── */}
      <span
        className={[
          'absolute bottom-0 left-0 right-0 h-[3px] rounded-t-sm bg-blue-500',
          'transition-all duration-200 origin-bottom',
          isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
        ].join(' ')}
      />
    </div>
  )
}

export function EditorTabs() {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const setActiveTab = useEditorStore(s => s.setActiveTab)
  const closeTab = useEditorStore(s => s.closeTab)

  // Track which tabs are genuinely new this render cycle
  const newIdsThisRender = useRef<Set<string>>(new Set())
  tabs.forEach(t => {
    if (!seenTabIds.has(t.id)) {
      newIdsThisRender.current.add(t.id)
      seenTabIds.add(t.id)
    }
  })

  // handleClose is only used for the legacy path; TabItem now owns its own close logic.
  const handleClose = useCallback(
    (e: React.MouseEvent, tab: EditorTab) => {
      e.stopPropagation()
      closeTab(tab.id)
    },
    [closeTab],
  )

  if (tabs.length === 0) return null

  return (
    <div
      className="flex items-stretch overflow-x-auto shrink-0 border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-surface)_60%,transparent)] no-drag"
      role="tablist"
      aria-label="Open editor tabs"
    >
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          isNew={newIdsThisRender.current.has(tab.id)}
          onActivate={setActiveTab}
          onClose={handleClose}
        />
      ))}
    </div>
  )
}
