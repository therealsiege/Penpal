import React, { useState, useCallback } from 'react'
import type { PodWorkflow } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_BASE_MS = 600_000
const EXECUTE_BASE_MS = 1_800_000
const MODEL_OPTIONS = ['opus', 'sonnet', 'haiku', 'coder:30b']
const TIMEOUT_MULTIPLIERS = [1, 2, 5]

const TERMINAL_STATUSES: PodWorkflow['status'][] = ['complete', 'failed']
const ACTIVE_STATUSES: PodWorkflow['status'][] = ['solving', 'reviewing', 'executing', 'self-fixing', 'feedback']

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'plan' | 'execute' | 'validate'

interface PodCardProps {
  workflow: PodWorkflow
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onOverride: (workflowId: string, phase: Phase, override: { model?: string; timeoutMultiplier?: number }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsedMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

function getStatusBadgeClass(status: PodWorkflow['status']): string {
  switch (status) {
    case 'solving': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    case 'reviewing': return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    case 'executing': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'self-fixing': return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    case 'feedback': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    case 'complete': return 'bg-green-500/20 text-green-300 border-green-500/30'
    case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/30'
    case 'paused': return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

function getPhaseStatusIndicator(wf: PodWorkflow, phase: Phase): { icon: string; label: string } {
  const currentStatus = wf.status
  const statusToPhase: Record<string, Phase> = {
    solving: 'execute',
    feedback: 'execute',
    reviewing: 'plan',
    executing: 'validate',
    'self-fixing': 'validate',
  }
  const runningPhase = statusToPhase[currentStatus]

  if (TERMINAL_STATUSES.includes(currentStatus)) {
    // All complete or failed
    return { icon: currentStatus === 'complete' ? '✓' : '✗', label: currentStatus }
  }

  if (runningPhase === phase) return { icon: '◉', label: 'running' }

  // Check if phase is done based on stage history
  const phaseHappened: Record<Phase, PodWorkflow['status'][]> = {
    execute: ['reviewing', 'executing', 'self-fixing', 'complete', 'failed'],
    plan: ['executing', 'self-fixing', 'complete', 'failed'],
    validate: ['complete', 'failed'],
  }

  const isDone = phaseHappened[phase]?.some(s => wf.stageHistory.some(h => h.stage === s))
  if (isDone) return { icon: '✓', label: 'complete' }

  return { icon: '○', label: 'pending' }
}

function getNextPhase(wf: PodWorkflow): Phase | null {
  switch (wf.status) {
    case 'solving':
    case 'feedback': return 'execute'
    case 'reviewing': return 'validate'
    default: return null
  }
}

function getBaseTimeout(phase: Phase): number {
  return phase === 'plan' ? PLAN_BASE_MS : EXECUTE_BASE_MS
}

function getElapsedInCurrentPhase(wf: PodWorkflow): number {
  if (wf.stageHistory.length === 0) return 0
  const last = wf.stageHistory[wf.stageHistory.length - 1]
  return Date.now() - last.enteredAt
}

// ── PodCard ───────────────────────────────────────────────────────────────────

export function PodCard({ workflow: wf, onPause, onResume, onCancel, onOverride }: PodCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [overrideModel, setOverrideModel] = useState(MODEL_OPTIONS[0])
  const [overrideTimeout, setOverrideTimeout] = useState(1)

  const isTerminal = TERMINAL_STATUSES.includes(wf.status)
  const isActive = ACTIVE_STATUSES.includes(wf.status)
  const isPaused = wf.status === 'paused'
  const nextPhase = getNextPhase(wf)
  const elapsedMs = getElapsedInCurrentPhase(wf)

  const handleApplyOverride = useCallback(() => {
    if (!nextPhase) return
    onOverride(wf.id, nextPhase, { model: overrideModel, timeoutMultiplier: overrideTimeout })
  }, [wf.id, nextPhase, overrideModel, overrideTimeout, onOverride])

  const phases: Phase[] = ['plan', 'execute', 'validate']
  const phaseLabels: Record<Phase, string> = { plan: 'Plan', execute: 'Execute', validate: 'Validate' }

  return (
    <div
      className={[
        'rounded-lg border transition-all duration-150 bg-[var(--c-bg-surface)]',
        wf.status === 'failed' ? 'border-red-500/40 border-l-[3px] border-l-red-500' : 'border-[var(--c-border)]',
        isTerminal ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* ── Collapsed header ── */}
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-[var(--c-bg-elevated)] rounded-lg transition-colors"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-[var(--c-text-heading)] truncate block">{wf.name}</span>
          <span className="text-[11px] text-[var(--c-text-faint)] truncate block">{wf.task.slice(0, 60)}{wf.task.length > 60 ? '…' : ''}</span>
        </span>
        <div className="flex items-center gap-2 flex-none">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getStatusBadgeClass(wf.status)}`}>
            {wf.status}
          </span>
          <span className="text-[10px] text-[var(--c-text-faint)] font-mono">
            {wf.iteration}/{wf.maxIterations}
          </span>
          {isActive && (
            <span className="text-[10px] text-[var(--c-text-dim)] font-mono">
              {formatElapsedMs(elapsedMs)}
            </span>
          )}
          {wf.lastExecutorPassed === true && <span className="text-green-400 text-[11px]">✓</span>}
          {wf.lastExecutorPassed === false && <span className="text-red-400 text-[11px]">✗</span>}
          <span className="text-[10px] text-[var(--c-text-faint)]">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-[var(--c-border)]">

          {/* Phase config grid */}
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--c-text-faint)] mb-1.5">Phase Config</div>
            <div className="flex flex-col gap-1">
              {phases.map(phase => {
                const model = wf.phaseOverrides?.[phase]?.model
                  ?? wf.resolvedProfile?.phases?.[phase]?.model
                  ?? '—'
                const { icon, label } = getPhaseStatusIndicator(wf, phase)
                const isRunning = label === 'running'
                return (
                  <div
                    key={phase}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] ${isRunning ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-[var(--c-bg-elevated)]'}`}
                  >
                    <span className={`font-mono text-[10px] ${isRunning ? 'text-blue-300' : 'text-[var(--c-text-faint)]'}`}>{icon}</span>
                    <span className="w-14 text-[var(--c-text-secondary)] shrink-0">{phaseLabels[phase]}</span>
                    <span className="flex-1 font-mono text-[var(--c-text-dim)]">{model}</span>
                    {wf.phaseOverrides?.[phase] && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">⚡ override</span>
                    )}
                    {isRunning && (
                      <span className="text-[10px] text-blue-300 font-mono">{formatElapsedMs(elapsedMs)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Timeout info */}
          {wf.resolvedProfile && (
            <div className="text-[10px] text-[var(--c-text-faint)]">
              Timeout multiplier: {wf.resolvedProfile.timeoutMultiplier}x
              &nbsp;·&nbsp;Plan {formatElapsedMs(getBaseTimeout('plan') * wf.resolvedProfile.timeoutMultiplier)}
              &nbsp;·&nbsp;Execute {formatElapsedMs(getBaseTimeout('execute') * wf.resolvedProfile.timeoutMultiplier)}
            </div>
          )}

          {/* Override next phase */}
          {isActive && nextPhase && (
            <div className="flex flex-col gap-2 p-2 rounded bg-[var(--c-bg-elevated)] border border-[var(--c-border)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--c-text-faint)]">
                Override Next Phase ({nextPhase})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={overrideModel}
                  onChange={e => setOverrideModel(e.target.value)}
                  className="text-[11px] bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded px-1.5 py-0.5 text-[var(--c-text-secondary)] focus:outline-none"
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {TIMEOUT_MULTIPLIERS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOverrideTimeout(m)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        overrideTimeout === m
                          ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/40'
                          : 'bg-[var(--c-bg-surface)] text-[var(--c-text-faint)] border-[var(--c-border)] hover:bg-[var(--c-bg-hover)]'
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleApplyOverride}
                  className="text-[11px] px-2 py-0.5 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-500/40 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Error preview */}
          {wf.error && (
            <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 font-mono break-all">
              {wf.error.slice(0, 100)}{wf.error.length > 100 ? '…' : ''}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-1.5 flex-wrap">
            {(isActive || isPaused) && (
              <>
                {isActive && (
                  <button
                    type="button"
                    onClick={() => onPause(wf.id)}
                    className="text-[11px] px-2 py-0.5 rounded bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors"
                  >
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    onClick={() => onResume(wf.id)}
                    className="text-[11px] px-2 py-0.5 rounded bg-green-600/80 hover:bg-green-500 border border-green-500/40 text-white transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onCancel(wf.id)}
                  className="text-[11px] px-2 py-0.5 rounded bg-red-600/70 hover:bg-red-500 border border-red-500/40 text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
