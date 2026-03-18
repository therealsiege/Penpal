import { useState, useEffect, useCallback } from 'react'
import type { VaultEntry } from '../../types'
import { FileContextMenu } from './FileContextMenu'

interface FileTreeProps {
  selectedFiles: Set<string>
  onToggleSelect: (path: string) => void
  onPreview: (path: string) => void
  onOpenInEditor?: (path: string) => void
  previewPath: string | null
  filterPaths?: Set<string> | null
}

const EXT_ICONS: Record<string, string> = {
  '.md': '# ',
  '.ts': 'TS',
  '.tsx': 'TX',
  '.js': 'JS',
  '.json': '{}',
  '.yaml': 'YA',
  '.yml': 'YA',
  '.css': 'CS',
  '.html': '<>',
}

function getIcon(name: string): string {
  const ext = name.slice(name.lastIndexOf('.'))
  return EXT_ICONS[ext] || '  '
}

const AUTO_EXPAND = new Set(['Ventures'])

interface ContextMenuState {
  x: number
  y: number
  path: string
  isDirectory: boolean
}

interface TreeNodeProps {
  entry: VaultEntry
  depth: number
  selectedFiles: Set<string>
  onToggleSelect: (path: string) => void
  onPreview: (path: string) => void
  onOpenInEditor?: (path: string) => void
  previewPath: string | null
  filterPaths?: Set<string> | null
  onContextMenu: (e: React.MouseEvent, entry: VaultEntry) => void
  refreshKey: number
}

function TreeNode({ entry, depth, selectedFiles, onToggleSelect, onPreview, onOpenInEditor, previewPath, filterPaths, onContextMenu, refreshKey }: TreeNodeProps) {
  const shouldAutoExpand = depth === 0 && entry.isDirectory && AUTO_EXPAND.has(entry.name)
  const [expanded, setExpanded] = useState(shouldAutoExpand)
  const [children, setChildren] = useState<VaultEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadChildren = useCallback(async () => {
    try {
      const entries = await window.api.vaultList(entry.path)
      setChildren(entries)
      setLoaded(true)
    } catch { /* skip */ }
  }, [entry.path])

  useEffect(() => {
    if (expanded) {
      loadChildren()
    }
  }, [expanded, loadChildren, refreshKey])

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded)
    } else {
      onPreview(entry.path)
    }
  }

  const handleDoubleClick = () => {
    if (!entry.isDirectory && onOpenInEditor) {
      onOpenInEditor(entry.path)
    }
  }

  const isSelected = selectedFiles.has(entry.path)
  const isPreviewed = previewPath === entry.path

  if (filterPaths && !entry.isDirectory && !filterPaths.has(entry.path)) {
    return null
  }

  const filteredChildren = filterPaths
    ? children.filter(c => c.isDirectory || filterPaths.has(c.path))
    : children

  if (filterPaths && entry.isDirectory && loaded && filteredChildren.length === 0) {
    return null
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 cursor-pointer rounded text-sm group transition-colors ${
          isPreviewed ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-800/60 text-slate-400'
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {!entry.isDirectory && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect(entry.path)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-3 h-3 rounded border-slate-600 bg-slate-800 accent-blue-500 shrink-0 cursor-pointer"
          />
        )}

        {entry.isDirectory ? (
          <span className="w-4 text-center text-slate-500 shrink-0 text-xs">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        ) : (
          <span className="w-4 text-center text-slate-600 shrink-0 text-[9px] font-mono">
            {getIcon(entry.name)}
          </span>
        )}

        <span className={`truncate ${entry.isDirectory ? 'text-slate-300 font-medium' : ''}`}>
          {entry.name}
        </span>
      </div>

      {expanded && entry.isDirectory && (
        <div>
          {filteredChildren.map(child => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedFiles={selectedFiles}
              onToggleSelect={onToggleSelect}
              onPreview={onPreview}
              onOpenInEditor={onOpenInEditor}
              previewPath={previewPath}
              filterPaths={filterPaths}
              onContextMenu={onContextMenu}
              refreshKey={refreshKey}
            />
          ))}
          {!loaded && (
            <div className="text-slate-600 text-xs pl-6" style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}>
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FileTree({ selectedFiles, onToggleSelect, onPreview, onOpenInEditor, previewPath, filterPaths }: FileTreeProps) {
  const [rootEntries, setRootEntries] = useState<VaultEntry[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadRoot = useCallback(() => {
    window.api.vaultList('').then(setRootEntries).catch(() => {})
  }, [])

  useEffect(() => { loadRoot() }, [loadRoot, refreshKey])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: VaultEntry) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDirectory: entry.isDirectory })
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <div className="overflow-y-auto h-full py-1 text-xs relative">
      {rootEntries.map(entry => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          selectedFiles={selectedFiles}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onOpenInEditor={onOpenInEditor}
          previewPath={previewPath}
          filterPaths={filterPaths}
          onContextMenu={handleContextMenu}
          refreshKey={refreshKey}
        />
      ))}
      {rootEntries.length === 0 && (
        <div className="text-slate-600 text-xs px-3 py-4 text-center">No files found</div>
      )}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          isDirectory={contextMenu.isDirectory}
          onClose={() => setContextMenu(null)}
          onOpenInEditor={onOpenInEditor}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
