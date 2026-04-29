import { useState, useEffect, useCallback, useRef } from 'react'
import { FileTree } from '../components/vault/FileTree'
import { EditorPane } from '../components/editor/EditorPane'
import { VaultSearch } from '../components/vault/VaultSearch'
import { TagFilter } from '../components/vault/TagFilter'
import { SendToAgent } from '../components/vault/SendToAgent'
import { QuickSwitcher } from '../components/editor/QuickSwitcher'
import { SidePanel } from '../components/editor/SidePanel'
import { SplitContainer } from '../components/editor/SplitContainer'
import { SearchPanel } from '../components/vault/SearchPanel'
import { DailyNote } from '../components/editor/DailyNote'
import { useEditorStore } from '../stores/editor-store'
import { useVaultIndex } from '../stores/vault-index'
import { useAppearanceStore } from '../stores/appearance-store'

/** Default vault tree width before × `--penny-ui-nav-scale` (wider so names don’t clip) */
const VAULT_SIDEBAR_BASE = 280
const VAULT_SIDEBAR_MIN_BASE = 180
const VAULT_SIDEBAR_MAX_BASE = 500
const SHELL_RAIL_BASE_PX = 168
/** Past scaled shell rail; keeps splitter drag aligned with `--penny-ui-nav-scale` */
const VAULT_SPLITTER_LEADING_CHROME_PX = 18

function readPennyUiNavScale(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--penny-ui-nav-scale').trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 2.125
}

export function VaultPanel() {
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [filterPaths, setFilterPaths] = useState<Set<string> | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Math.round(VAULT_SIDEBAR_BASE * readPennyUiNavScale()),
  )
  const [resizing, setResizing] = useState(false)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)
  const [showRightSidebar, setShowRightSidebar] = useState(false)
  const [leftSidebarMode, setLeftSidebarMode] = useState<'tree' | 'search'>('tree')
  const [splitMode, setSplitMode] = useState<'none' | 'horizontal'>('none')

  const openFile = useEditorStore(s => s.openFile)
  const closeTab = useEditorStore(s => s.closeTab)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const tabs = useEditorStore(s => s.tabs)
  const loadIndex = useVaultIndex(s => s.loadIndex)
  const indexLoaded = useVaultIndex(s => s.loaded)

  const updateTabContent = useEditorStore(s => s.updateTabContent)
  const cycleTab = useEditorStore(s => s.cycleTab)

  // Load vault index on mount for wikilinks + autocomplete + quick switcher
  useEffect(() => {
    if (!indexLoaded) loadIndex()
  }, [indexLoaded, loadIndex])

  // Listen for external file changes (Obsidian Sync, other editors)
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  useEffect(() => {
    const cleanup = window.api.onVaultFileChanged(async (event) => {
      // Reload tab content if the changed file is open and not dirty
      const tab = tabsRef.current.find(t => t.path === event.path)
      if (tab && !tab.dirty && event.eventType === 'change') {
        try {
          const result = await window.api.vaultRead(event.path)
          if (result?.content != null) {
            updateTabContent(tab.id, result.content, result.mtime)
          }
        } catch { /* skip */ }
      }
    })
    return cleanup
  }, [updateTabContent])

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const setViewMode = useEditorStore(s => s.setViewMode)

  // Single click: open file in preview mode
  const handlePreview = useCallback(async (path: string) => {
    setPreviewPath(path)
    try {
      const result = await window.api.vaultRead(path)
      if (result?.content != null) {
        openFile(path, result.content, result.mtime)
      }
    } catch { /* skip */ }
  }, [openFile])

  // Double click: switch to edit mode
  const handleOpenInEditor = useCallback(async (path: string) => {
    try {
      const result = await window.api.vaultRead(path)
      if (result?.content != null) {
        openFile(path, result.content, result.mtime)
        setViewMode('source')
      }
    } catch { /* skip */ }
  }, [openFile, setViewMode])

  // Load files for tag filter
  useEffect(() => {
    if (!activeTag) {
      setFilterPaths(null)
      return
    }
    window.api.vaultFilesByTag(activeTag).then(paths => {
      setFilterPaths(new Set(paths))
    }).catch(() => setFilterPaths(null))
  }, [activeTag])

  // Resize handling
  const handleMouseDown = useCallback(() => {
    setResizing(true)
  }, [])

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const s = readPennyUiNavScale()
      const railOffset = Math.round(SHELL_RAIL_BASE_PX * s + VAULT_SPLITTER_LEADING_CHROME_PX)
      const minW = Math.round(VAULT_SIDEBAR_MIN_BASE * s)
      const maxW = Math.round(VAULT_SIDEBAR_MAX_BASE * s)
      setSidebarWidth(Math.max(minW, Math.min(maxW, e.clientX - railOffset)))
    }
    const handleMouseUp = () => setResizing(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  const { zoom, zoomIn, zoomOut, zoomReset, theme } = useAppearanceStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
      }
      if (e.metaKey && e.key === 'p') {
        e.preventDefault()
        setShowQuickSwitcher(true)
      }
      if (e.metaKey && e.shiftKey && e.key === '\\') {
        e.preventDefault()
        setShowRightSidebar(s => !s)
      } else if (e.metaKey && e.key === '\\') {
        e.preventDefault()
        setSplitMode(s => s === 'none' ? 'horizontal' : 'none')
      }
      if (e.metaKey && e.key === 'Tab') {
        e.preventDefault()
        cycleTab(e.shiftKey ? -1 : 1)
      }
      // Zoom: Cmd+= / Cmd+- / Cmd+0
      if (e.metaKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn()
      }
      if (e.metaKey && e.key === '-') {
        e.preventDefault()
        zoomOut()
      }
      if (e.metaKey && e.key === '0') {
        e.preventDefault()
        zoomReset()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, closeTab, cycleTab, zoomIn, zoomOut, zoomReset])

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: theme === 'light' ? 'url(light-2.jpg)' : 'url(vault-bg.jpg)' }} />
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-bg-app)_94%,transparent)]" />
    <div className="relative flex flex-col h-full vault-zoom vault-panel z-[1]" style={{ zoom }}>
      {/* Quick Switcher overlay */}
      {showQuickSwitcher && (
        <QuickSwitcher
          onSelect={handleOpenInEditor}
          onClose={() => setShowQuickSwitcher(false)}
        />
      )}

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-surface)_40%,transparent)]">
        <div className="drag-region flex-1 h-2" />
        <button
          onClick={() => setShowQuickSwitcher(true)}
          className="text-[length:calc(15px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] px-2.5 py-1.5 rounded bg-[color-mix(in_srgb,var(--c-bg-elevated)_40%,transparent)] transition-colors"
          title="Quick Open (Cmd+P)"
        >
          Open...
        </button>
        <DailyNote onOpenFile={handleOpenInEditor} />
        <VaultSearch
          onSelectResult={(path) => {
            handleOpenInEditor(path)
          }}
          onSearchActive={() => {}}
        />
        <TagFilter activeTag={activeTag} onSelectTag={setActiveTag} />
        <button
          onClick={() => setShowRightSidebar(s => !s)}
          className={`text-[length:calc(15px*var(--penny-ui-nav-scale))] px-2.5 py-1.5 rounded transition-colors ${
            showRightSidebar ? 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent-blue)]' : 'text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] bg-[color-mix(in_srgb,var(--c-bg-elevated)_40%,transparent)]'
          }`}
          title="Toggle Outline (Cmd+\\)"
        >
          Outline
        </button>
      </div>

      {/* Main content: tree + editor + optional sidebar */}
      <div className="flex-1 flex overflow-hidden" style={{ cursor: resizing ? 'col-resize' : undefined }}>
        {/* Left sidebar: tree or search */}
        <div
          className="shrink-0 border-r border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] overflow-hidden flex flex-col bg-[color-mix(in_srgb,var(--c-bg-app)_50%,transparent)]"
          style={{ width: sidebarWidth }}
        >
          {/* Sidebar mode tabs */}
          <div className="shrink-0 flex border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]">
            {(['tree', 'search'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLeftSidebarMode(mode)}
                className={`flex-1 px-2 py-1.5 text-[length:calc(12.75px*var(--penny-ui-nav-scale))] capitalize transition-colors ${
                  leftSidebarMode === mode
                    ? 'text-[var(--c-accent-blue)] bg-[color-mix(in_srgb,var(--c-bg-elevated)_40%,transparent)]'
                    : 'text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)]'
                }`}
              >
                {mode === 'tree' ? 'Files' : 'Search'}
              </button>
            ))}
          </div>
          {leftSidebarMode === 'tree' ? (
            <FileTree
              selectedFiles={selectedFiles}
              onToggleSelect={handleToggleSelect}
              onPreview={handlePreview}
              onOpenInEditor={handleOpenInEditor}
              previewPath={previewPath}
              filterPaths={filterPaths}
            />
          ) : (
            <SearchPanel onSelectResult={handleOpenInEditor} />
          )}
        </div>

        {/* Resize handle */}
        <div
          className="w-1 hover:bg-[color-mix(in_srgb,var(--c-accent)_20%,transparent)] cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />

        {/* Editor pane */}
        <div className="flex-1 overflow-hidden">
          {splitMode === 'none' ? (
            <EditorPane />
          ) : (
            <SplitContainer direction="horizontal" left={<EditorPane />} right={<EditorPane />} />
          )}
        </div>

        {/* Right sidebar (outline/backlinks) */}
        {showRightSidebar && (
          <div className="shrink-0 w-[length:calc(200px*var(--penny-ui-nav-scale))]">
            <SidePanel />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-surface)_40%,transparent)]">
        <div className="text-[length:calc(15px*var(--penny-ui-nav-scale))] text-[var(--c-border-hover)]">
          {selectedFiles.size > 0
            ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
            : tabs.length > 0
              ? `${tabs.length} tab${tabs.length > 1 ? 's' : ''} open`
              : 'Click a file to preview, double-click to edit'}
          {selectedFiles.size > 0 && (
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="ml-2 text-[var(--c-border)] hover:text-[var(--c-text-muted)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <SendToAgent selectedFiles={selectedFiles} />
          <span className="mx-2 w-px h-4 bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)]" />
          <button onClick={zoomOut} className="w-7 h-7 rounded text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] flex items-center justify-center text-[length:calc(15px*var(--penny-ui-nav-scale))] transition-colors" title="Zoom Out (Cmd+-)">-</button>
          <button onClick={zoomReset} className="px-1.5 h-7 rounded text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] text-[length:calc(12px*var(--penny-ui-nav-scale))] tabular-nums transition-colors" title="Reset Zoom (Cmd+0)">{Math.round(zoom * 100)}%</button>
          <button onClick={zoomIn} className="w-7 h-7 rounded text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] flex items-center justify-center text-[length:calc(15px*var(--penny-ui-nav-scale))] transition-colors" title="Zoom In (Cmd+=)">+</button>
        </div>
      </div>
    </div>
    </div>
  )
}
