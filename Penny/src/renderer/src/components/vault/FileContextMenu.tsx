import { useState, useEffect, useRef } from 'react'
import { useToast } from '../Toast'

interface FileContextMenuProps {
  x: number
  y: number
  path: string
  isDirectory: boolean
  onClose: () => void
  onOpenInEditor?: (path: string) => void
  onRefresh: () => void
}

export function FileContextMenu({ x, y, path, isDirectory, onClose, onOpenInEditor, onRefresh }: FileContextMenuProps) {
  const { toast } = useToast()
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null)
  const [createName, setCreateName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const dirPath = isDirectory ? path : path.split('/').slice(0, -1).join('/')
  const fileName = path.split('/').pop() || ''

  const handleNewFile = () => {
    setCreating('file')
    setCreateName('')
  }

  const handleNewFolder = () => {
    setCreating('folder')
    setCreateName('')
  }

  const handleRename = () => {
    setRenaming(true)
    setNewName(fileName)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${fileName}"?`)) return
    try {
      await window.api.vaultDelete(path)
      toast(`Deleted ${fileName}`, 'success')
      onRefresh()
      onClose()
    } catch (err) {
      toast('Delete failed: ' + (err as Error).message, 'error')
    }
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(path)
    toast('Path copied', 'info')
    onClose()
  }

  const submitRename = async () => {
    if (!newName || newName === fileName) { onClose(); return }
    const parentDir = path.split('/').slice(0, -1).join('/')
    const newPath = parentDir ? `${parentDir}/${newName}` : newName
    try {
      await window.api.vaultRename(path, newPath)
      toast(`Renamed to ${newName}`, 'success')
      onRefresh()
      onClose()
    } catch (err) {
      toast('Rename failed: ' + (err as Error).message, 'error')
    }
  }

  const submitCreate = async () => {
    if (!createName) { onClose(); return }
    const newPath = dirPath ? `${dirPath}/${createName}` : createName
    try {
      if (creating === 'folder') {
        await window.api.vaultCreateFolder(newPath)
        toast(`Created folder ${createName}`, 'success')
      } else {
        const finalPath = createName.endsWith('.md') ? newPath : newPath + '.md'
        await window.api.vaultCreate(finalPath)
        toast(`Created ${createName}`, 'success')
        if (onOpenInEditor) onOpenInEditor(finalPath)
      }
      onRefresh()
      onClose()
    } catch (err) {
      toast('Create failed: ' + (err as Error).message, 'error')
    }
  }

  if (renaming) {
    return (
      <div ref={menuRef} className="fixed z-50 bg-[#141a22] border border-[#2a3440] rounded shadow-xl p-2" style={{ left: x, top: y }}>
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') onClose() }}
          className="bg-[#0c1018] text-[#c4ccd6] text-xs px-2 py-1 rounded border border-[#2a3440] w-48 outline-none focus:border-blue-500"
          placeholder="New name"
        />
      </div>
    )
  }

  if (creating) {
    return (
      <div ref={menuRef} className="fixed z-50 bg-[#141a22] border border-[#2a3440] rounded shadow-xl p-2" style={{ left: x, top: y }}>
        <div className="text-[10px] text-[#3a4858] mb-1">New {creating}</div>
        <input
          autoFocus
          value={createName}
          onChange={e => setCreateName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') onClose() }}
          className="bg-[#0c1018] text-[#c4ccd6] text-xs px-2 py-1 rounded border border-[#2a3440] w-48 outline-none focus:border-blue-500"
          placeholder={creating === 'folder' ? 'Folder name' : 'File name (.md)'}
        />
      </div>
    )
  }

  const items = [
    ...(onOpenInEditor && !isDirectory ? [{ label: 'Open in Editor', action: () => { onOpenInEditor(path); onClose() } }] : []),
    { label: 'New File', action: handleNewFile },
    { label: 'New Folder', action: handleNewFolder },
    { label: '---', action: () => {} },
    { label: 'Rename', action: handleRename },
    { label: 'Delete', action: handleDelete },
    { label: '---', action: () => {} },
    { label: 'Copy Path', action: handleCopyPath },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#141a22] border border-[#2a3440] rounded shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} className="border-t border-[#2a3440] my-1" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className="w-full text-left px-3 py-1 text-xs text-[#8a96a4] hover:bg-[#2a3440] transition-colors"
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
