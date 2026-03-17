import { create } from 'zustand'

export type ViewMode = 'source' | 'preview' | 'live'

export interface EditorTab {
  id: string
  path: string
  dirty: boolean
  scrollPos: number
  content: string | null
  mtime: number
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  viewMode: ViewMode

  openFile: (path: string, content: string, mtime: number) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setDirty: (id: string, dirty: boolean, content?: string) => void
  setScrollPos: (id: string, pos: number) => void
  setViewMode: (mode: ViewMode) => void
  updateTabContent: (id: string, content: string, mtime: number) => void
  getActiveTab: () => EditorTab | null
}

function tabId(path: string): string {
  return path
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  viewMode: 'source',

  openFile: (path, content, mtime) => {
    const id = tabId(path)
    const existing = get().tabs.find(t => t.id === id)
    if (existing) {
      set({ activeTabId: id })
      return
    }
    set(state => ({
      tabs: [...state.tabs, { id, path, dirty: false, scrollPos: 0, content, mtime }],
      activeTabId: id,
    }))
  },

  closeTab: (id) => {
    set(state => {
      const idx = state.tabs.findIndex(t => t.id === id)
      const next = state.tabs.filter(t => t.id !== id)
      let newActive = state.activeTabId
      if (state.activeTabId === id) {
        if (next.length === 0) {
          newActive = null
        } else {
          newActive = next[Math.min(idx, next.length - 1)].id
        }
      }
      return { tabs: next, activeTabId: newActive }
    })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  setDirty: (id, dirty, content) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === id ? { ...t, dirty, ...(content !== undefined ? { content } : {}) } : t
      ),
    }))
  },

  setScrollPos: (id, pos) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === id ? { ...t, scrollPos: pos } : t),
    }))
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  updateTabContent: (id, content, mtime) => {
    set(state => ({
      tabs: state.tabs.map(t =>
        t.id === id ? { ...t, content, mtime, dirty: false } : t
      ),
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find(t => t.id === activeTabId) ?? null
  },
}))
