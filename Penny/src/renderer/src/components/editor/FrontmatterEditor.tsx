import { useState, useMemo, useCallback } from 'react'
import matter from 'gray-matter'
import { useEditorStore } from '../../stores/editor-store'

export function FrontmatterEditor() {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const setDirty = useEditorStore(s => s.setDirty)
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const { data, content: bodyContent } = useMemo(() => {
    if (!activeTab?.content) return { data: {} as Record<string, unknown>, content: '' }
    try {
      const parsed = matter(activeTab.content)
      return { data: parsed.data as Record<string, unknown>, content: parsed.content }
    } catch {
      return { data: {} as Record<string, unknown>, content: activeTab.content }
    }
  }, [activeTab?.content])

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const updateFrontmatter = useCallback((newData: Record<string, unknown>) => {
    if (!activeTabId) return
    const newContent = matter.stringify(bodyContent, newData)
    setDirty(activeTabId, true, newContent)
  }, [activeTabId, bodyContent, setDirty])

  const handleEditStart = (key: string, value: unknown) => {
    setEditingKey(key)
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''))
  }

  const handleEditSave = () => {
    if (!editingKey) return
    const newData = { ...data }
    // Try to parse as JSON for arrays/objects
    try {
      newData[editingKey] = JSON.parse(editValue)
    } catch {
      newData[editingKey] = editValue
    }
    updateFrontmatter(newData)
    setEditingKey(null)
  }

  const handleDelete = (key: string) => {
    const newData = { ...data }
    delete newData[key]
    updateFrontmatter(newData)
  }

  const handleAddProperty = () => {
    if (!newKey.trim()) return
    const newData = { ...data }
    try {
      newData[newKey.trim()] = JSON.parse(newValue)
    } catch {
      newData[newKey.trim()] = newValue
    }
    updateFrontmatter(newData)
    setNewKey('')
    setNewValue('')
  }

  if (!activeTab || Object.keys(data).length === 0) return null

  return (
    <div className="mb-3 rounded bg-[#141a22]/60 border border-[#2a3440]/90 px-3 py-2">
      <div className="text-[10px] text-[#5a6a7a] mb-1.5 font-medium">Properties</div>
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2 text-xs py-0.5 group">
          <span className="text-[#5a6a7a] shrink-0 w-20 truncate">{key}</span>
          {editingKey === key ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditingKey(null) }}
              onBlur={handleEditSave}
              className="flex-1 bg-[#06080c] text-[#dce4ec] text-xs px-1.5 py-0.5 rounded border border-[#3a4858] outline-none focus:border-[#00ff88]/40"
            />
          ) : (
            <span
              className="text-[#c4ccd6] truncate flex-1 cursor-pointer hover:text-[#dce4ec]"
              onClick={() => handleEditStart(key, val)}
            >
              {Array.isArray(val) ? val.join(', ') : String(val ?? '')}
            </span>
          )}
          <button
            onClick={() => handleDelete(key)}
            className="text-[#3a4858] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-[10px]"
          >
            x
          </button>
        </div>
      ))}
      {/* Add new property */}
      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[#2a3440]/40">
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="key"
          className="w-20 bg-[#06080c]/50 text-[#8a96a4] text-[10px] px-1.5 py-0.5 rounded border border-[#2a3440]/90 outline-none focus:border-[#00ff88]/40"
        />
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddProperty() }}
          placeholder="value"
          className="flex-1 bg-[#06080c]/50 text-[#8a96a4] text-[10px] px-1.5 py-0.5 rounded border border-[#2a3440]/90 outline-none focus:border-[#00ff88]/40"
        />
        <button
          onClick={handleAddProperty}
          className="text-[10px] text-[#4a5c6e] hover:text-[#00e5ff] transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
