import type { SystemPaths } from '../types'

export interface PathPresets {
  homeDir: string
  sidekickRoot: string
  docsRoot: string
  analyticsRoot: string
  pennyRoot: string
}

function joinPosix(base: string, ...parts: string[]): string {
  const normalized = [base, ...parts]
    .filter(Boolean)
    .map((part, idx) => {
      if (idx === 0) return part.replace(/\/+$/, '')
      return part.replace(/^\/+|\/+$/g, '')
    })
    .filter(Boolean)
  return normalized.join('/').replace(/\/{2,}/g, '/')
}

export function getPathPresets(paths?: SystemPaths | null): PathPresets {
  const homeDir = paths?.homeDir || '~'
  const sidekickRoot = paths?.sidekickRoot || joinPosix(homeDir, 'sidekick')
  const docsRoot = paths?.docsRoot || joinPosix(sidekickRoot, 'Docs')

  return {
    homeDir,
    sidekickRoot,
    docsRoot,
    pennyRoot: joinPosix(sidekickRoot, 'Penpal'),
    analyticsRoot: joinPosix(sidekickRoot, 'Penpal', 'analytics'),
  }
}
