import { create } from 'zustand'

/** What the user picks — 'system' defers to the OS. */
export type ThemePreference = 'dark' | 'light' | 'system'
/** The resolved value that actually drives CSS / components. */
export type ResolvedTheme = 'dark' | 'light'

export interface AppearanceState {
  /** User's preference (persisted). */
  themePreference: ThemePreference
  /** Resolved theme after applying OS preference. Always 'dark' | 'light'. */
  theme: ResolvedTheme
  uiFontFamily: string
  uiFontSize: number
  editorFontFamily: string
  editorFontSize: number
  editorLineHeight: number
  zoom: number
  /** Subtle horizontal scanline overlay (body::after). */
  scanlinesOverlay: boolean
  /** CRT-style edge darkening + color wash (body::before). */
  crtVignette: boolean

  setTheme: (pref: ThemePreference) => void
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
  setScanlinesOverlay: (v: boolean) => void
  setCrtVignette: (v: boolean) => void
}

const STORAGE_KEY = 'sidekick-appearance'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref
}

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
      themePreference: state.themePreference,
      uiFontFamily: state.uiFontFamily,
      uiFontSize: state.uiFontSize,
      editorFontFamily: state.editorFontFamily,
      editorFontSize: state.editorFontSize,
      editorLineHeight: state.editorLineHeight,
      zoom: state.zoom,
      scanlinesOverlay: state.scanlinesOverlay,
      crtVignette: state.crtVignette,
    }))
  } catch { /* ignore */ }
}

function applyToDOM(state: AppearanceState) {
  const root = document.documentElement
  root.classList.toggle('light-theme', state.theme === 'light')
  root.classList.toggle('penpal-no-scanlines', !state.scanlinesOverlay)
  root.classList.toggle('penpal-no-vignette', !state.crtVignette)
  root.style.setProperty('--ui-font-family', state.uiFontFamily)
  root.style.setProperty('--ui-font-size', `${state.uiFontSize}px`)
  root.style.setProperty('--editor-font-family', state.editorFontFamily)
  root.style.setProperty('--editor-font-size', `${state.editorFontSize}px`)
  root.style.setProperty('--editor-line-height', `${state.editorLineHeight}`)
  root.style.setProperty('--zoom', `${state.zoom}`)
}

const saved = loadPersisted() as Record<string, unknown>

// Migrate legacy 'theme' key → 'themePreference'
const savedPref: ThemePreference = (() => {
  const p = saved.themePreference ?? saved.theme
  if (p === 'dark' || p === 'light' || p === 'system') return p as ThemePreference
  return 'dark'
})()

const defaults = {
  themePreference: savedPref,
  theme: resolveTheme(savedPref),
  uiFontFamily: (saved.uiFontFamily as string) || "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
  uiFontSize: typeof saved.uiFontSize === 'number' ? saved.uiFontSize : 17,
  editorFontFamily: (saved.editorFontFamily as string) || "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace",
  editorFontSize: typeof saved.editorFontSize === 'number' ? saved.editorFontSize : 17,
  editorLineHeight: (saved.editorLineHeight as number) || 1.6,
  zoom: (saved.zoom as number) || 1.0,
  scanlinesOverlay: typeof saved.scanlinesOverlay === 'boolean' ? saved.scanlinesOverlay : true,
  crtVignette: typeof saved.crtVignette === 'boolean' ? saved.crtVignette : true,
}

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.7
const ZOOM_MAX = 2.0

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  // Apply defaults on load
  setTimeout(() => applyToDOM(get()), 0)

  // Watch OS theme changes — only matters when preference is 'system'
  const mql = window.matchMedia('(prefers-color-scheme: light)')
  mql.addEventListener('change', () => {
    const s = get()
    if (s.themePreference === 'system') {
      const resolved = getSystemTheme()
      if (s.theme !== resolved) {
        set({ theme: resolved })
        applyToDOM({ ...s, theme: resolved })
      }
    }
  })

  const update = (partial: Partial<AppearanceState>) => {
    set(partial)
    const next = get()
    applyToDOM(next)
    persist(next)
  }

  return {
    ...defaults,
    setTheme: (pref) => update({ themePreference: pref, theme: resolveTheme(pref) }),
    toggleTheme: () => {
      const cur = get().themePreference
      const next: ThemePreference = cur === 'dark' ? 'light' : cur === 'light' ? 'system' : 'dark'
      update({ themePreference: next, theme: resolveTheme(next) })
    },
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
    setScanlinesOverlay: (scanlinesOverlay) => update({ scanlinesOverlay }),
    setCrtVignette: (crtVignette) => update({ crtVignette }),
  }
})
