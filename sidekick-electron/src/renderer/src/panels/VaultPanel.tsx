import { useState, useEffect, useCallback } from 'react'
import { FileTree } from '../components/vault/FileTree'
import { FilePreview } from '../components/vault/FilePreview'
import { VaultSearch } from '../components/vault/VaultSearch'
import { TagFilter } from '../components/vault/TagFilter'
import { SendToAgent } from '../components/vault/SendToAgent'

export function VaultPanel() {
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [filterPaths, setFilterPaths] = useState<Set<string> | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [resizing, setResizing] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

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

  const handlePreview = useCallback((path: string) => {
    setPreviewPath(path)
  }, [])

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
      const newWidth = Math.max(180, Math.min(500, e.clientX - 140)) // 140 = sidebar nav width
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

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <div className="drag-region flex-1 h-2" />
        <VaultSearch
          onSelectResult={(path) => {
            setPreviewPath(path)
            setSearchActive(false)
          }}
          onSearchActive={setSearchActive}
        />
        <TagFilter activeTag={activeTag} onSelectTag={setActiveTag} />
      </div>

      {/* Main content: tree + preview */}
      <div className="flex-1 flex overflow-hidden" style={{ cursor: resizing ? 'col-resize' : undefined }}>
        {/* File tree sidebar */}
        <div
          className="shrink-0 border-r border-slate-800/60 overflow-hidden flex flex-col bg-slate-950/50"
          style={{ width: sidebarWidth }}
        >
          <FileTree
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleSelect}
            onPreview={handlePreview}
            previewPath={previewPath}
            filterPaths={filterPaths}
          />
        </div>

        {/* Resize handle */}
        <div
          className="w-1 hover:bg-blue-600/30 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />

        {/* Preview */}
        <div className="flex-1 overflow-hidden">
          <FilePreview filePath={previewPath} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-slate-800/60 bg-slate-900/40">
        <div className="text-xs text-slate-500">
          {selectedFiles.size > 0
            ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
            : 'Check files in the tree to select them'}
          {selectedFiles.size > 0 && (
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="ml-2 text-slate-600 hover:text-slate-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <SendToAgent selectedFiles={selectedFiles} />
      </div>
    </div>
  )
}
