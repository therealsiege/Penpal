import React, { useRef, useEffect, useState } from 'react'
import type { PodWorkflow } from '../types'
import { PodCard } from './PodCard'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'plan' | 'execute' | 'validate'

interface ColumnDef {
  id: string
  label: string
  statuses: PodWorkflow['status'][]
  accentClass: string
}

interface KanbanBoardProps {
  workflows: PodWorkflow[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onOverride: (workflowId: string, phase: Phase, override: { model?: string; timeoutMultiplier?: number }) => void
}

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  {
    id: 'planning',
    label: 'Planning',
    statuses: ['pending', 'solving', 'feedback'],
    accentClass: 'border-blue-500/30 text-blue-300',
  },
  {
    id: 'executing',
    label: 'Executing',
    statuses: ['reviewing'],
    accentClass: 'border-violet-500/30 text-violet-300',
  },
  {
    id: 'validating',
    label: 'Validating',
    statuses: ['executing', 'self-fixing'],
    accentClass: 'border-amber-500/30 text-amber-300',
  },
]

const COMPLETED_COLUMN: ColumnDef = {
  id: 'completed',
  label: 'Completed',
  statuses: ['complete', 'failed'],
  accentClass: 'border-gray-500/30 text-gray-400',
}

const MAX_COMPLETED = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function getColumnPods(workflows: PodWorkflow[], col: ColumnDef): PodWorkflow[] {
  return workflows.filter(wf => (col.statuses as string[]).includes(wf.status))
}

function computeColumnStats(pods: PodWorkflow[], phaseKey: Phase): {
  count: number
  modelBreakdown: Record<string, number>
  avgPhaseMs: number
} {
  const count = pods.length
  const modelBreakdown: Record<string, number> = {}
  let totalMs = 0
  let activePodCount = 0

  for (const pod of pods) {
    const model = pod.resolvedProfile?.phases?.[phaseKey]?.model
    if (model) {
      modelBreakdown[model] = (modelBreakdown[model] ?? 0) + 1
    }
    if (pod.stageHistory.length > 0) {
      const last = pod.stageHistory[pod.stageHistory.length - 1]
      totalMs += Date.now() - last.enteredAt
      activePodCount++
    }
  }

  return {
    count,
    modelBreakdown,
    avgPhaseMs: activePodCount > 0 ? Math.round(totalMs / activePodCount) : 0,
  }
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  return `${Math.floor(ms / 60_000)}m`
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  col: ColumnDef
  pods: PodWorkflow[]
  phaseKey: Phase
  isCompleted?: boolean
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onOverride: KanbanBoardProps['onOverride']
}

function KanbanColumn({
  col,
  pods,
  phaseKey,
  isCompleted = false,
  onPause,
  onResume,
  onCancel,
  onOverride,
}: KanbanColumnProps) {
  const prevPodIdsRef = useRef<Set<string>>(new Set())
  const [flashClass, setFlashClass] = useState('')

  const currentIds = new Set(pods.map(p => p.id))

  useEffect(() => {
    const hasNew = [...currentIds].some(id => !prevPodIdsRef.current.has(id))
    if (hasNew && prevPodIdsRef.current.size > 0) {
      setFlashClass('animate-column-flash')
      const timer = setTimeout(() => setFlashClass(''), 900)
      return () => clearTimeout(timer)
    }
    prevPodIdsRef.current = currentIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pods.map(p => p.id).join(',')])

  const stats = computeColumnStats(pods, phaseKey)

  return (
    <div
      className={[
        'flex flex-col flex-1 min-w-[400px] rounded-lg border bg-[var(--c-bg-deep)] transition-all',
        isCompleted ? 'opacity-60 border-gray-700/40' : `border-[var(--c-border)] ${flashClass}`,
      ].join(' ')}
    >
      {/* Column header */}
      <div className="flex-none px-3 py-2.5 border-b border-[var(--c-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-bold uppercase tracking-wider ${col.accentClass.split(' ')[1]}`}>
            {col.label}
          </span>
          <span className="text-[12px] bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-full px-2 py-0.5 text-[var(--c-text-faint)] font-mono">
            {stats.count}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[var(--c-text-faint)] font-mono">
          {!isCompleted && stats.avgPhaseMs > 0 && (
            <span title="Avg time in current phase">{formatMs(stats.avgPhaseMs)}</span>
          )}
          {!isCompleted && Object.entries(stats.modelBreakdown).map(([model, count]) => (
            <span key={model} title={`${count} pod(s) using ${model}`} className="opacity-70">
              {model.split(':')[0].slice(0, 6)}&times;{count}
            </span>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
        {pods.length === 0 && (
          <div className="text-[14px] text-[var(--c-text-faint)] text-center py-8 opacity-40">
            No pods
          </div>
        )}
        {pods.map(wf => (
          <PodCard
            key={wf.id}
            workflow={wf}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            onOverride={onOverride}
          />
        ))}
      </div>
    </div>
  )
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

export function KanbanBoard({ workflows, onPause, onResume, onCancel, onOverride }: KanbanBoardProps) {
  const completedPods = getColumnPods(workflows, COMPLETED_COLUMN)
    .slice(0, MAX_COMPLETED)

  const phaseKeyForColumn: Record<string, Phase> = {
    planning: 'execute',
    executing: 'plan',
    validating: 'validate',
    completed: 'validate',
  }

  if (workflows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[14px] text-[var(--c-text-faint)]">
        No active pods &mdash; launch one to see it here
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full min-h-0">
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.id}
          col={col}
          pods={getColumnPods(workflows, col)}
          phaseKey={phaseKeyForColumn[col.id]}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onOverride={onOverride}
        />
      ))}
      <KanbanColumn
        col={COMPLETED_COLUMN}
        pods={completedPods}
        phaseKey="validate"
        isCompleted
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
        onOverride={onOverride}
      />
    </div>
  )
}
