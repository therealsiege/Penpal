// ---------------------------------------------------------------------------
// Bundled JSON fixtures for PennyHarness.loadFixture (import.meta.glob).
// Files live under ./fixtures/*.json so Vite/Rollup includes them in the build.
// ---------------------------------------------------------------------------

import type {
  AgentStatus,
  InteractionType,
  SessionMode,
} from '../types'

export interface HarnessFixtureAgentRow {
  id?: string
  name?: string
  title?: string
  podRole?: 'solver' | 'reviewer' | 'executor'
  desk?: { row: number; col: number }
  cwd?: string
  status?: AgentStatus
  sessionMode?: SessionMode
  needsInteraction?: boolean
  interactionType?: InteractionType
  xpLevel?: number
  avatar?: string
}

export interface HarnessFixtureFile {
  agents: HarnessFixtureAgentRow[]
}

const rawModules = import.meta.glob('./fixtures/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, HarnessFixtureFile>

function filePathToName(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.json$/i, '')
}

let _map: Map<string, HarnessFixtureFile> | null = null

export function getFixtureMap(): Map<string, HarnessFixtureFile> {
  if (_map) return _map
  const m = new Map<string, HarnessFixtureFile>()
  for (const [path, data] of Object.entries(rawModules)) {
    const name = filePathToName(path)
    if (data?.agents && Array.isArray(data.agents) && data.agents.length > 0) {
      m.set(name, data)
    }
  }
  _map = m
  return m
}

export function listFixtureNames(): string[] {
  return [...getFixtureMap().keys()].sort()
}
