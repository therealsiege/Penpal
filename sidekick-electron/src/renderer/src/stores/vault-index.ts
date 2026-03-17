import { create } from 'zustand'
import type { VaultIndexEntry } from '../types'

interface VaultIndexState {
  entries: VaultIndexEntry[]
  byFilename: Map<string, VaultIndexEntry[]>
  byPath: Map<string, VaultIndexEntry>
  loaded: boolean
  loading: boolean

  loadIndex: () => Promise<void>
  resolveWikilink: (link: string) => VaultIndexEntry | null
  search: (query: string, limit?: number) => VaultIndexEntry[]
}

export const useVaultIndex = create<VaultIndexState>((set, get) => ({
  entries: [],
  byFilename: new Map(),
  byPath: new Map(),
  loaded: false,
  loading: false,

  loadIndex: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const entries = await window.api.vaultIndex()
      const byFilename = new Map<string, VaultIndexEntry[]>()
      const byPath = new Map<string, VaultIndexEntry>()

      for (const entry of entries) {
        byPath.set(entry.path, entry)
        const baseName = entry.name.replace(/\.md$/, '').toLowerCase()
        const existing = byFilename.get(baseName) || []
        existing.push(entry)
        byFilename.set(baseName, existing)
      }

      set({ entries, byFilename, byPath, loaded: true, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  resolveWikilink: (link: string) => {
    const { byFilename, byPath } = get()
    // Try exact path match first
    const exactPath = link.endsWith('.md') ? link : link + '.md'
    const byExactPath = byPath.get(exactPath)
    if (byExactPath) return byExactPath

    // Try filename match (case-insensitive)
    const baseName = link.replace(/\.md$/, '').toLowerCase()
    const matches = byFilename.get(baseName)
    if (matches && matches.length > 0) return matches[0]

    return null
  },

  search: (query: string, limit = 20) => {
    const { entries } = get()
    if (!query) return entries.slice(0, limit)

    const q = query.toLowerCase()
    const scored = entries
      .map(entry => {
        const name = entry.name.toLowerCase()
        const title = entry.title.toLowerCase()
        const path = entry.path.toLowerCase()

        let score = 0
        if (name.startsWith(q)) score += 100
        else if (title.startsWith(q)) score += 80
        else if (name.includes(q)) score += 60
        else if (title.includes(q)) score += 40
        else if (path.includes(q)) score += 20
        else return null

        return { entry, score }
      })
      .filter(Boolean) as { entry: VaultIndexEntry; score: number }[]

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map(s => s.entry)
  },
}))
