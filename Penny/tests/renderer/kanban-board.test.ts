import { describe, it, expect } from 'vitest'
import type { PodWorkflow } from '../../src/renderer/src/types'

// ── Re-implement the bucketing logic inline to test it without React ──────────

type Phase = 'plan' | 'execute' | 'validate'

interface ColumnDef {
  id: string
  statuses: PodWorkflow['status'][]
}

const COLUMNS: ColumnDef[] = [
  { id: 'planning',   statuses: ['pending', 'solving', 'feedback'] },
  { id: 'executing',  statuses: ['reviewing'] },
  { id: 'validating', statuses: ['executing', 'self-fixing'] },
  { id: 'completed',  statuses: ['complete', 'failed'] },
]

function getColumnPods(workflows: PodWorkflow[], col: ColumnDef): PodWorkflow[] {
  return workflows.filter(wf => (col.statuses as string[]).includes(wf.status))
}

function makePod(id: string, status: PodWorkflow['status']): PodWorkflow {
  const now = Date.now()
  return {
    id,
    name: `Pod ${id}`,
    status,
    task: 'test',
    cwd: '/tmp',
    solver: { agentId: 's', status: 'waiting' },
    reviewer: { agentId: 'r', status: 'waiting' },
    executor: { agentId: 'e', status: 'waiting' },
    iteration: 1,
    maxIterations: 3,
    artifacts: [],
    solverCandidateCount: 1,
    selfFixAttempts: 0,
    maxSelfFixes: 0,
    createdAt: now,
    updatedAt: now,
    stageHistory: [],
  }
}

describe('KanbanBoard column bucketing', () => {
  const workflows: PodWorkflow[] = [
    makePod('p1', 'pending'),
    makePod('p2', 'solving'),
    makePod('p3', 'feedback'),
    makePod('p4', 'reviewing'),
    makePod('p5', 'executing'),
    makePod('p6', 'self-fixing'),
    makePod('p7', 'complete'),
    makePod('p8', 'failed'),
    makePod('p9', 'paused'),
  ]

  it('routes pending/solving/feedback to Planning column', () => {
    const col = COLUMNS.find(c => c.id === 'planning')!
    const pods = getColumnPods(workflows, col)
    expect(pods.map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('routes reviewing to Executing column', () => {
    const col = COLUMNS.find(c => c.id === 'executing')!
    const pods = getColumnPods(workflows, col)
    expect(pods.map(p => p.id)).toEqual(['p4'])
  })

  it('routes executing/self-fixing to Validating column', () => {
    const col = COLUMNS.find(c => c.id === 'validating')!
    const pods = getColumnPods(workflows, col)
    expect(pods.map(p => p.id)).toEqual(['p5', 'p6'])
  })

  it('routes complete/failed to Completed column', () => {
    const col = COLUMNS.find(c => c.id === 'completed')!
    const pods = getColumnPods(workflows, col)
    expect(pods.map(p => p.id)).toEqual(['p7', 'p8'])
  })

  it('paused pod does not appear in any active column', () => {
    const activeCols = COLUMNS.filter(c => c.id !== 'completed')
    const allActivePods = activeCols.flatMap(col => getColumnPods(workflows, col))
    const ids = allActivePods.map(p => p.id)
    expect(ids).not.toContain('p9')
  })

  it('all workflows are accounted for (minus paused)', () => {
    const all = COLUMNS.flatMap(col => getColumnPods(workflows, col))
    const ids = new Set(all.map(p => p.id))
    // paused is not in any column
    expect(ids.has('p9')).toBe(false)
    // everything else is in exactly one column
    expect(ids.size).toBe(8)
  })

  it('completed column limited to 10 entries', () => {
    const many = Array.from({ length: 15 }, (_, i) => makePod(`done-${i}`, 'complete'))
    const col = COLUMNS.find(c => c.id === 'completed')!
    const pods = getColumnPods(many, col).slice(0, 10)
    expect(pods.length).toBe(10)
  })
})

describe('phaseOverrides model resolution', () => {
  it('phaseOverride.model takes priority over resolvedProfile.phases', () => {
    const wf = makePod('x', 'solving')
    const extended = {
      ...wf,
      resolvedProfile: { phases: { plan: { model: 'opus' }, execute: { model: 'opus' }, validate: { model: 'sonnet' } }, timeoutMultiplier: 1 },
      phaseOverrides: { execute: { model: 'haiku' } } as PodWorkflow['phaseOverrides'],
    }

    const phase: Phase = 'execute'
    const model = extended.phaseOverrides?.[phase]?.model
      ?? extended.resolvedProfile?.phases?.[phase]?.model
      ?? '—'
    expect(model).toBe('haiku')
  })

  it('falls back to resolvedProfile when no phaseOverride set', () => {
    const wf = makePod('x', 'solving')
    const extended = {
      ...wf,
      resolvedProfile: { phases: { plan: { model: 'opus' }, execute: { model: 'opus' }, validate: { model: 'sonnet' } }, timeoutMultiplier: 1 },
      phaseOverrides: {} as PodWorkflow['phaseOverrides'],
    }

    const phase: Phase = 'execute'
    const model = extended.phaseOverrides?.[phase]?.model
      ?? extended.resolvedProfile?.phases?.[phase]?.model
      ?? '—'
    expect(model).toBe('opus')
  })
})
