import { useState, useEffect, useRef, useCallback, memo } from 'react'
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

const AUTO_EXPAND = new Set(['Docs'])

interface ContextMenuState {
  x: number
  y: number
  path: string
  isDirectory: boolean
}

// ---------------------------------------------------------------------------
// FileRow — lightweight pure-render row for leaf files (no hooks)
// ---------------------------------------------------------------------------

interface FileRowProps {
  entry: VaultEntry
  depth: number
  isSelected: boolean
  isPreviewed: boolean
  onToggleSelect: (path: string) => void
  onPreview: (path: string) => void
  onOpenInEditor?: (path: string) => void
  onContextMenu: (e: React.MouseEvent, entry: VaultEntry) => void
}

const FileRow = memo(function FileRow({
  entry,
  depth,
  isSelected,
  isPreviewed,
  onToggleSelect,
  onPreview,
  onOpenInEditor,
  onContextMenu,
}: FileRowProps) {
  return (
    <div
      className={[
        'flex items-center gap-1.5 py-1 px-1.5 cursor-pointer rounded text-[16px]',
        'transition-colors duration-75 hover:bg-[#141a22]/50',
        isPreviewed
          ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
          : 'text-[#5a6a7a] border-l-2 border-transparent',
      ].join(' ')}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
      onClick={() => onPreview(entry.path)}
      onDoubleClick={() => onOpenInEditor?.(entry.path)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(entry.path) }}
        onClick={(e) => e.stopPropagation()}
        className="w-3 h-3 rounded border-[#2a3440] bg-[#141a22] accent-[#00e5ff] shrink-0 cursor-pointer"
      />
      <span className="w-4 text-center text-[#2a3440] shrink-0 text-[9px] font-mono">
        {getIcon(entry.name)}
      </span>
      <span className="truncate">{entry.name}</span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// TreeNode — only used for directories (has expand/collapse state + hooks)
// ---------------------------------------------------------------------------

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

function TreeNode({
  entry,
  depth,
  selectedFiles,
  onToggleSelect,
  onPreview,
  onOpenInEditor,
  previewPath,
  filterPaths,
  onContextMenu,
  refreshKey,
}: TreeNodeProps) {
  const shouldAutoExpand = depth === 0 && entry.isDirectory && AUTO_EXPAND.has(entry.name)
  const [expanded, setExpanded] = useState(shouldAutoExpand)
  const [children, setChildren] = useState<VaultEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const prevChildCountRef = useRef<number | null>(null)
  const [flashingPaths, setFlashingPaths] = useState<Set<string>>(new Set())

  const loadChildren = useCallback(async () => {
    try {
      const entries = await window.api.vaultList(entry.path)

      if (prevChildCountRef.current !== null && entries.length > prevChildCountRef.current) {
        const incoming = entries.slice(prevChildCountRef.current)
        const newPaths = new Set(incoming.map((e) => e.path))
        setFlashingPaths(newPaths)
        setTimeout(() => setFlashingPaths(new Set()), 1200)
      }
      prevChildCountRef.current = entries.length

      setChildren(entries)
      setLoaded(true)
    } catch { /* skip */ }
  }, [entry.path])

  useEffect(() => {
    if (expanded) loadChildren()
  }, [expanded, loadChildren, refreshKey])

  const filteredChildren = filterPaths
    ? children.filter((c) => c.isDirectory || filterPaths.has(c.path))
    : children

  if (filterPaths && entry.isDirectory && loaded && filteredChildren.length === 0) {
    return null
  }

  // Separate directories (need TreeNode) from files (use lightweight FileRow)
  const dirs = filteredChildren.filter((c) => c.isDirectory)
  const files = filteredChildren.filter((c) => !c.isDirectory)

  return (
    <div>
      <div
        className={[
          'flex items-center gap-1.5 py-1 px-1.5 cursor-pointer rounded text-[16px] group',
          'transition-colors duration-75 hover:bg-[#141a22]/50',
          'text-[#5a6a7a] border-l-2 border-transparent',
          !entry.isDirectory && flashingPaths.has(entry.path) ? 'animate-new-file-flash' : '',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        <span
          className={[
            'w-4 text-center text-[#3a4858] shrink-0 text-[15px] inline-block',
            'transition-transform duration-200',
            expanded ? 'rotate-90' : 'rotate-0',
          ].join(' ')}
        >
          {'\u25B6'}
        </span>
        <span className="truncate text-[#8a96a4] font-medium">
          {entry.name}
          {loaded && filteredChildren.length > 0 && (
            <span className="text-[#2a3440] text-[11px] ml-1.5 font-normal">
              {filteredChildren.length}
            </span>
          )}
        </span>
      </div>

      {entry.isDirectory && expanded && (
        <div>
          {/* Directories first — full TreeNode with expand/collapse */}
          {dirs.map((child) => (
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
          {/* Files — lightweight rows, no per-item hooks */}
          {files.map((child) => (
            <FileRow
              key={child.path}
              entry={child}
              depth={depth + 1}
              isSelected={selectedFiles.has(child.path)}
              isPreviewed={previewPath === child.path}
              onToggleSelect={onToggleSelect}
              onPreview={onPreview}
              onOpenInEditor={onOpenInEditor}
              onContextMenu={onContextMenu}
            />
          ))}
          {!loaded && (
            <div
              className="text-[#2a3440] text-[15px]"
              style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
            >
              Loading...
            </div>
          )}
        </div>
      )}

      {/* Collapsed placeholder — keeps layout stable */}
      {entry.isDirectory && !expanded && loaded && filteredChildren.length > 0 && (
        <div style={{ height: 0, overflow: 'hidden' }} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FileTree — root component
// ---------------------------------------------------------------------------

export function FileTree({
  selectedFiles,
  onToggleSelect,
  onPreview,
  onOpenInEditor,
  previewPath,
  filterPaths,
}: FileTreeProps) {
  const [rootEntries, setRootEntries] = useState<VaultEntry[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadRoot = useCallback(() => {
    window.api.vaultList('').then(setRootEntries).catch(() => {})
  }, [])

  useEffect(() => {
    loadRoot()
  }, [loadRoot, refreshKey])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: VaultEntry) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDirectory: entry.isDirectory })
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // Separate root dirs from root files
  const rootDirs = rootEntries.filter((e) => e.isDirectory)
  const rootFiles = rootEntries.filter((e) => !e.isDirectory)

  return (
    <div className="overflow-y-auto h-full py-1 text-[16px] relative">
      {rootDirs.map((entry) => (
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
      {rootFiles.map((entry) => (
        <FileRow
          key={entry.path}
          entry={entry}
          depth={0}
          isSelected={selectedFiles.has(entry.path)}
          isPreviewed={previewPath === entry.path}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onOpenInEditor={onOpenInEditor}
          onContextMenu={handleContextMenu}
        />
      ))}
      {rootEntries.length === 0 && (
        <div className="text-[#2a3440] text-[15px] px-3 py-4 text-center">No files found</div>
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
