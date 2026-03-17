import { useState, useEffect, useCallback } from 'react'
import type { VaultEntry } from '../../types'

interface FileTreeProps {
  selectedFiles: Set<string>
  onToggleSelect: (path: string) => void
  onPreview: (path: string) => void
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

function getIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return ''
  const ext = name.slice(name.lastIndexOf('.'))
  return EXT_ICONS[ext] || '  '
}

// Directories to auto-expand on first render
const AUTO_EXPAND = new Set(['Ventures'])

interface TreeNodeProps {
  entry: VaultEntry
  depth: number
  selectedFiles: Set<string>
  onToggleSelect: (path: string) => void
  onPreview: (path: string) => void
  previewPath: string | null
  filterPaths?: Set<string> | null
}

function TreeNode({ entry, depth, selectedFiles, onToggleSelect, onPreview, previewPath, filterPaths }: TreeNodeProps) {
  const shouldAutoExpand = depth === 0 && entry.isDirectory && AUTO_EXPAND.has(entry.name)
  const [expanded, setExpanded] = useState(shouldAutoExpand)
  const [children, setChildren] = useState<VaultEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadChildren = useCallback(async () => {
    if (loaded) return
    try {
      const entries = await window.api.vaultList(entry.path)
      setChildren(entries)
      setLoaded(true)
    } catch { /* skip */ }
  }, [entry.path, loaded])

  useEffect(() => {
    if (expanded && !loaded) {
      loadChildren()
    }
  }, [expanded, loaded, loadChildren])

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded)
    } else {
      onPreview(entry.path)
    }
  }

  const isSelected = selectedFiles.has(entry.path)
  const isPreviewed = previewPath === entry.path

  // If filtering, hide non-matching files (but show directories that might contain matches)
  if (filterPaths && !entry.isDirectory && !filterPaths.has(entry.path)) {
    return null
  }

  const filteredChildren = filterPaths
    ? children.filter(c => c.isDirectory || filterPaths.has(c.path))
    : children

  // Hide empty directories when filtering
  if (filterPaths && entry.isDirectory && loaded && filteredChildren.length === 0) {
    return null
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 cursor-pointer rounded text-xs group transition-colors ${
          isPreviewed ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-800/60 text-slate-400'
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={handleClick}
      >
        {/* Checkbox */}
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

        {/* Expand arrow for dirs */}
        {entry.isDirectory ? (
          <span className="w-4 text-center text-slate-500 shrink-0 text-[10px]">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        ) : (
          <span className="w-4 text-center text-slate-600 shrink-0 text-[9px] font-mono">
            {getIcon(entry.name, false)}
          </span>
        )}

        {/* Name */}
        <span className={`truncate ${entry.isDirectory ? 'text-slate-300 font-medium' : ''}`}>
          {entry.name}
        </span>
      </div>

      {/* Children */}
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
              previewPath={previewPath}
              filterPaths={filterPaths}
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

export function FileTree({ selectedFiles, onToggleSelect, onPreview, previewPath, filterPaths }: FileTreeProps) {
  const [rootEntries, setRootEntries] = useState<VaultEntry[]>([])

  useEffect(() => {
    window.api.vaultList('').then(setRootEntries).catch(() => {})
  }, [])

  return (
    <div className="overflow-y-auto h-full py-1 text-xs">
      {rootEntries.map(entry => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          selectedFiles={selectedFiles}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          previewPath={previewPath}
          filterPaths={filterPaths}
        />
      ))}
      {rootEntries.length === 0 && (
        <div className="text-slate-600 text-xs px-3 py-4 text-center">No files found</div>
      )}
    </div>
  )
}
