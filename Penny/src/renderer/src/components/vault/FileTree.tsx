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
        'flex items-center gap-1.5 py-1 px-1.5 cursor-pointer rounded text-[length:calc(16px*var(--penny-ui-nav-scale))]',
        'transition-colors duration-75 hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)]',
        isPreviewed
          ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
          : 'text-[var(--c-text-muted)] border-l-2 border-transparent',
      ].join(' ')}
      style={{ paddingLeft: `calc(${depth * 14 + 4}px * var(--penny-ui-nav-scale))` }}
      onClick={() => onPreview(entry.path)}
      onDoubleClick={() => onOpenInEditor?.(entry.path)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(entry.path) }}
        onClick={(e) => e.stopPropagation()}
        className="w-[length:calc(12px*var(--penny-ui-nav-scale))] h-[length:calc(12px*var(--penny-ui-nav-scale))] rounded border-[var(--c-border)] bg-[var(--c-bg-elevated)] accent-[var(--c-accent-blue)] shrink-0 cursor-pointer"
      />
      <span className="w-[length:calc(1rem*var(--penny-ui-nav-scale))] text-center text-[var(--c-border)] shrink-0 text-[length:calc(9px*var(--penny-ui-nav-scale))] font-mono">
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
          'flex items-center gap-1.5 py-1 px-1.5 cursor-pointer rounded text-[length:calc(16px*var(--penny-ui-nav-scale))] group',
          'transition-colors duration-75 hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)]',
          'text-[var(--c-text-muted)] border-l-2 border-transparent',
          !entry.isDirectory && flashingPaths.has(entry.path) ? 'animate-new-file-flash' : '',
        ].join(' ')}
        style={{ paddingLeft: `calc(${depth * 14 + 4}px * var(--penny-ui-nav-scale))` }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        <span
          className={[
            'w-[length:calc(1rem*var(--penny-ui-nav-scale))] text-center text-[var(--c-border-hover)] shrink-0 text-[length:calc(15px*var(--penny-ui-nav-scale))] inline-block',
            'transition-transform duration-200',
            expanded ? 'rotate-90' : 'rotate-0',
          ].join(' ')}
        >
          {'\u25B6'}
        </span>
        <span className="truncate text-[var(--c-text-secondary)] font-medium">
          {entry.name}
          {loaded && filteredChildren.length > 0 && (
            <span className="text-[var(--c-border)] text-[length:calc(11px*var(--penny-ui-nav-scale))] ml-1.5 font-normal">
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
              className="text-[var(--c-border)] text-[length:calc(15px*var(--penny-ui-nav-scale))]"
              style={{ paddingLeft: `calc(${(depth + 1) * 14 + 4}px * var(--penny-ui-nav-scale))` }}
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
    <div className="overflow-y-auto h-full py-1 text-[length:calc(16px*var(--penny-ui-nav-scale))] relative">
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
        <div className="text-[var(--c-border)] text-[length:calc(15px*var(--penny-ui-nav-scale))] px-3 py-4 text-center">No files found</div>
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
