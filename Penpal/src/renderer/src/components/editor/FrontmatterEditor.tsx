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
    <div className="mb-3 rounded bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] px-3 py-2">
      <div className="text-[10px] text-[var(--c-text-muted)] mb-1.5 font-medium">Properties</div>
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2 text-xs py-0.5 group">
          <span className="text-[var(--c-text-muted)] shrink-0 w-20 truncate">{key}</span>
          {editingKey === key ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditingKey(null) }}
              onBlur={handleEditSave}
              className="flex-1 bg-[var(--c-bg-deep)] text-[var(--c-text-heading)] text-xs px-1.5 py-0.5 rounded border border-[var(--c-border-hover)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)]"
            />
          ) : (
            <span
              className="text-[var(--c-text-primary)] truncate flex-1 cursor-pointer hover:text-[var(--c-text-heading)]"
              onClick={() => handleEditStart(key, val)}
            >
              {Array.isArray(val) ? val.join(', ') : String(val ?? '')}
            </span>
          )}
          <button
            onClick={() => handleDelete(key)}
            className="text-[var(--c-border-hover)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-[10px]"
          >
            x
          </button>
        </div>
      ))}
      {/* Add new property */}
      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[color-mix(in_srgb,var(--c-border)_40%,transparent)]">
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="key"
          className="w-20 bg-[color-mix(in_srgb,var(--c-bg-deep)_50%,transparent)] text-[var(--c-text-secondary)] text-[10px] px-1.5 py-0.5 rounded border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)]"
        />
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddProperty() }}
          placeholder="value"
          className="flex-1 bg-[color-mix(in_srgb,var(--c-bg-deep)_50%,transparent)] text-[var(--c-text-secondary)] text-[10px] px-1.5 py-0.5 rounded border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)]"
        />
        <button
          onClick={handleAddProperty}
          className="text-[10px] text-[var(--c-text-faint)] hover:text-[var(--c-accent-blue)] transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
