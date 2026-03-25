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

export function VaultPanel() {
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [filterPaths, setFilterPaths] = useState<Set<string> | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)
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
      const newWidth = Math.max(180, Math.min(500, e.clientX - 140))
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => setResizing(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  const { zoom, zoomIn, zoomOut, zoomReset } = useAppearanceStore()

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
    <div className="flex flex-col h-full vault-zoom vault-panel" style={{ zoom }}>
      {/* Quick Switcher overlay */}
      {showQuickSwitcher && (
        <QuickSwitcher
          onSelect={handleOpenInEditor}
          onClose={() => setShowQuickSwitcher(false)}
        />
      )}

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[#2a3440]/60 bg-[#0c1018]/40">
        <div className="drag-region flex-1 h-2" />
        <button
          onClick={() => setShowQuickSwitcher(true)}
          className="text-[15px] text-[#3a4858] hover:text-[#8a96a4] px-2.5 py-1.5 rounded bg-[#141a22]/40 transition-colors"
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
          className={`text-[15px] px-2.5 py-1.5 rounded transition-colors ${
            showRightSidebar ? 'bg-blue-600/30 text-blue-300' : 'text-[#3a4858] hover:text-[#8a96a4] bg-[#141a22]/40'
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
          className="shrink-0 border-r border-[#2a3440]/60 overflow-hidden flex flex-col bg-[#080a0e]/50"
          style={{ width: sidebarWidth }}
        >
          {/* Sidebar mode tabs */}
          <div className="shrink-0 flex border-b border-[#2a3440]/60">
            {(['tree', 'search'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLeftSidebarMode(mode)}
                className={`flex-1 px-2 py-1.5 text-[15px] capitalize transition-colors ${
                  leftSidebarMode === mode
                    ? 'text-blue-300 bg-[#141a22]/40'
                    : 'text-[#3a4858] hover:text-[#8a96a4]'
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
          className="w-1 hover:bg-blue-600/30 cursor-col-resize transition-colors shrink-0"
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
          <div className="shrink-0 w-[200px]">
            <SidePanel />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-[#2a3440]/60 bg-[#0c1018]/40">
        <div className="text-[15px] text-[#3a4858]">
          {selectedFiles.size > 0
            ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
            : tabs.length > 0
              ? `${tabs.length} tab${tabs.length > 1 ? 's' : ''} open`
              : 'Click a file to preview, double-click to edit'}
          {selectedFiles.size > 0 && (
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="ml-2 text-[#2a3440] hover:text-[#5a6a7a] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <SendToAgent selectedFiles={selectedFiles} />
          <span className="mx-2 w-px h-4 bg-[#141a22]/60" />
          <button onClick={zoomOut} className="w-7 h-7 rounded text-[#3a4858] hover:text-[#8a96a4] hover:bg-[#141a22]/60 flex items-center justify-center text-[15px] transition-colors" title="Zoom Out (Cmd+-)">-</button>
          <button onClick={zoomReset} className="px-1.5 h-7 rounded text-[#3a4858] hover:text-[#8a96a4] hover:bg-[#141a22]/60 text-xs tabular-nums transition-colors" title="Reset Zoom (Cmd+0)">{Math.round(zoom * 100)}%</button>
          <button onClick={zoomIn} className="w-7 h-7 rounded text-[#3a4858] hover:text-[#8a96a4] hover:bg-[#141a22]/60 flex items-center justify-center text-[15px] transition-colors" title="Zoom In (Cmd+=)">+</button>
        </div>
      </div>
    </div>
  )
}
