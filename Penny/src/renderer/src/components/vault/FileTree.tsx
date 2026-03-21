import { useState, useEffect, useRef, useCallback } from 'react'
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

  // --- Animation: new-file flash ---
  // Track the previous child count to detect newly added files.
  const prevChildCountRef = useRef<number | null>(null)
  const [flashingPaths, setFlashingPaths] = useState<Set<string>>(new Set())

  // --- Animation: active-file highlight ---
  // Re-trigger card-enter animation when this file becomes the previewed one.
  const [cardEnterKey, setCardEnterKey] = useState(0)
  const prevPreviewedRef = useRef(false)

  const loadChildren = useCallback(async () => {
    try {
      const entries = await window.api.vaultList(entry.path)

      // Detect newly added files (after initial load)
      if (prevChildCountRef.current !== null && entries.length > prevChildCountRef.current) {
        const incoming = entries.slice(prevChildCountRef.current)
        const newPaths = new Set(incoming.map((e) => e.path))
        setFlashingPaths(newPaths)
        // Remove flash classes after animation completes (1 s + small buffer)
        setTimeout(() => {
          setFlashingPaths(new Set())
        }, 1200)
      }
      prevChildCountRef.current = entries.length

      setChildren(entries)
      setLoaded(true)
    } catch { /* skip */ }
  }, [entry.path])

  useEffect(() => {
    if (expanded) {
      loadChildren()
    }
  }, [expanded, loadChildren, refreshKey])

  // Trigger card-enter animation each time this node transitions into previewed state
  const isPreviewed = previewPath === entry.path
  useEffect(() => {
    if (isPreviewed && !prevPreviewedRef.current) {
      setCardEnterKey((k) => k + 1)
    }
    prevPreviewedRef.current = isPreviewed
  }, [isPreviewed])

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

  if (filterPaths && !entry.isDirectory && !filterPaths.has(entry.path)) {
    return null
  }

  const filteredChildren = filterPaths
    ? children.filter((c) => c.isDirectory || filterPaths.has(c.path))
    : children

  if (filterPaths && entry.isDirectory && loaded && filteredChildren.length === 0) {
    return null
  }

  return (
    <div>
      {/*
        Row element.

        Animations applied here:
        - Feature 2: hover translate + bg (transition-all duration-100 hover:bg-slate-800/50 hover:translate-x-0.5)
        - Feature 3: active file highlight — border-l-2 border-blue-500 + animate-card-enter
                     The `key` on the wrapping span forces React to remount the element,
                     restarting the CSS animation on each selection change.
        - Feature 4: new-file flash — animate-new-file-flash inset box-shadow
      */}
      <div
        className={[
          'flex items-center gap-1 py-0.5 px-1 cursor-pointer rounded text-sm group',
          // Feature 2: hover translate + bg
          'transition-all duration-100 hover:bg-slate-800/50 hover:translate-x-0.5',
          // Feature 3: previewed state base colors (animation handles the flash on entry)
          isPreviewed
            ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
            : 'text-slate-400 border-l-2 border-transparent',
          // Feature 4: new-file flash
          !entry.isDirectory && flashingPaths.has(entry.path) ? 'animate-new-file-flash' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {/* Feature 3: remount span to restart card-enter animation on each selection */}
        {isPreviewed && (
          <span
            key={cardEnterKey}
            className="animate-card-enter absolute inset-0 rounded pointer-events-none"
            aria-hidden="true"
          />
        )}

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
          /*
            Feature 5: chevron rotation.
            ▶ (▶ U+25B6) is the collapsed state; we rotate it 90° when expanded.
            transition-transform duration-200 handles the smooth rotation.
          */
          <span
            className={[
              'w-4 text-center text-slate-500 shrink-0 text-xs inline-block',
              'transition-transform duration-200',
              expanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
          >
            {'\u25B6'}
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

      {/*
        Feature 1: folder expand/collapse animation.
        We always render the children wrapper div so the CSS transition has
        something to animate between. Visibility is controlled via max-height
        and opacity rather than conditional rendering.

        max-height is set high enough (2000px) to accommodate deep subtrees.
        The ease-out timing ensures snappy open and gentle close.
      */}
      {entry.isDirectory && (
        <div
          style={{
            overflow: 'hidden',
            maxHeight: expanded ? '2000px' : '0px',
            opacity: expanded ? 1 : 0,
            transition: expanded
              ? 'max-height 200ms ease-out, opacity 150ms ease-out'
              : 'max-height 180ms ease-in, opacity 120ms ease-in',
          }}
        >
          {filteredChildren.map((child) => (
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
            <div
              className="text-slate-600 text-xs"
              style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
            >
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  return (
    <div className="overflow-y-auto h-full py-1 text-xs relative">
      {rootEntries.map((entry) => (
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
