import { create } from 'zustand'

export type ThemeName = 'dark' | 'light'

interface ThemeState {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.classList.toggle('light-theme', theme === 'light')
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))
