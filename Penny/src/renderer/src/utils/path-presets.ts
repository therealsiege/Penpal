import type { SystemPaths } from '../types'

export interface PathPresets {
  homeDir: string
  sidekickRoot: string
  docsRoot: string
  analyticsRoot: string
  pennyRoot: string
  medscrubRoot: string
  medhookRoot: string
  onePuttWebRoot: string
  atlasRoot: string
  givingPrintsRoot: string
  eSpiralRoot: string
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
    analyticsRoot: joinPosix(sidekickRoot, 'analytics'),
    pennyRoot: joinPosix(sidekickRoot, 'Penny'),
    medscrubRoot: joinPosix(homeDir, 'ComSci', 'Workspace', '1putthealth', 'medscrub'),
    medhookRoot: joinPosix(homeDir, 'ComSci', 'Workspace', '1putthealth', 'medhook'),
    onePuttWebRoot: joinPosix(homeDir, 'ComSci', 'Workspace', '1putthealth', '1putthealth.com'),
    atlasRoot: joinPosix(homeDir, 'ComSci', 'Workspace', 'graphiteatlas', 'atlas'),
    givingPrintsRoot: joinPosix(homeDir, 'ComSci', 'Workspace', 'givingprints'),
    eSpiralRoot: joinPosix(homeDir, 'ComSci', 'Workspace', 'espiral.healthcare'),
  }
}
