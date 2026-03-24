import { create } from 'zustand'

export type ThemeName = 'dark' | 'light' | 'neon'

export interface AppearanceState {
  theme: ThemeName
  uiFontFamily: string
  uiFontSize: number
  editorFontFamily: string
  editorFontSize: number
  editorLineHeight: number
  zoom: number

  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
  setUiFontFamily: (f: string) => void
  setUiFontSize: (s: number) => void
  setEditorFontFamily: (f: string) => void
  setEditorFontSize: (s: number) => void
  setEditorLineHeight: (h: number) => void
  setZoom: (z: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

const STORAGE_KEY = 'sidekick-appearance'

function loadPersisted(): Partial<AppearanceState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function persist(state: AppearanceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: state.theme,
      uiFontFamily: state.uiFontFamily,
      uiFontSize: state.uiFontSize,
      editorFontFamily: state.editorFontFamily,
      editorFontSize: state.editorFontSize,
      editorLineHeight: state.editorLineHeight,
      zoom: state.zoom,
    }))
  } catch { /* ignore */ }
}

function applyToDOM(state: AppearanceState) {
  const root = document.documentElement
  root.classList.toggle('light-theme', state.theme === 'light')
  root.classList.toggle('neon-theme', state.theme === 'neon')
  root.style.setProperty('--ui-font-family', state.uiFontFamily)
  root.style.setProperty('--ui-font-size', `${state.uiFontSize}px`)
  root.style.setProperty('--editor-font-family', state.editorFontFamily)
  root.style.setProperty('--editor-font-size', `${state.editorFontSize}px`)
  root.style.setProperty('--editor-line-height', `${state.editorLineHeight}`)
  root.style.setProperty('--zoom', `${state.zoom}`)
}

const saved = loadPersisted()

const defaults = {
  theme: (['dark', 'light', 'neon'].includes(saved.theme as string) ? saved.theme as ThemeName : 'dark'),
  uiFontFamily: saved.uiFontFamily || "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
  uiFontSize: saved.uiFontSize || 15,
  editorFontFamily: saved.editorFontFamily || "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace",
  editorFontSize: saved.editorFontSize || 15,
  editorLineHeight: saved.editorLineHeight || 1.6,
  zoom: saved.zoom || 1.0,
}

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.7
const ZOOM_MAX = 2.0

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  // Apply defaults on load
  setTimeout(() => applyToDOM(get()), 0)

  const update = (partial: Partial<AppearanceState>) => {
    set(partial)
    const next = get()
    applyToDOM(next)
    persist(next)
  }

  return {
    ...defaults,
    setTheme: (theme) => update({ theme }),
    toggleTheme: () => update({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    setUiFontFamily: (uiFontFamily) => update({ uiFontFamily }),
    setUiFontSize: (uiFontSize) => update({ uiFontSize: Math.max(10, Math.min(24, uiFontSize)) }),
    setEditorFontFamily: (editorFontFamily) => update({ editorFontFamily }),
    setEditorFontSize: (editorFontSize) => update({ editorFontSize: Math.max(10, Math.min(28, editorFontSize)) }),
    setEditorLineHeight: (editorLineHeight) => update({ editorLineHeight: Math.max(1.0, Math.min(2.5, editorLineHeight)) }),
    setZoom: (zoom) => update({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +zoom.toFixed(1))) }),
    zoomIn: () => {
      const next = Math.min(ZOOM_MAX, +(get().zoom + ZOOM_STEP).toFixed(1))
      update({ zoom: next })
    },
    zoomOut: () => {
      const next = Math.max(ZOOM_MIN, +(get().zoom - ZOOM_STEP).toFixed(1))
      update({ zoom: next })
    },
    zoomReset: () => update({ zoom: 1.0 }),
  }
})
