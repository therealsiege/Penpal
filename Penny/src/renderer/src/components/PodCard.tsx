import React, { useState, useCallback } from 'react'
import type { PodWorkflow } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_BASE_MS = 600_000
const EXECUTE_BASE_MS = 1_800_000
const MODEL_OPTIONS = ['opus', 'sonnet', 'haiku', 'coder:30b']
const TIMEOUT_MULTIPLIERS = [1, 2, 5]

const TERMINAL_STATUSES: PodWorkflow['status'][] = ['complete', 'failed']
const ACTIVE_STATUSES: PodWorkflow['status'][] = ['solving', 'reviewing', 'executing', 'self-fixing', 'feedback']

// ── Persona lookups ──────────────────────────────────────────────────────────

const AGENT_AVATARS: Record<string, string> = {
  'fullstack-dev': './sprites/avatars/WuKong.png',
  'nextjs-frontend': './sprites/avatars/ErlangShen.png',
  'electron-dev': './sprites/avatars/ShaWujing.png',
  'backend-arch': './sprites/avatars/Guanyin.png',
  'expo-mobile': './sprites/avatars/Nezha.png',
  'embedded-dev': './sprites/avatars/BullDemonKing.png',
  'videogame-dev': './sprites/avatars/RedBoy.png',
  'ui-designer': './sprites/avatars/AoGuang.png',
  'product-mgr': './sprites/avatars/Tripitaka.png',
  'product-marketer': './sprites/avatars/AoRun.png',
  'exec-assistant': './sprites/avatars/ZhuBajie.png',
  'issue-planner': './sprites/avatars/Tripitaka.png',
}

const AGENT_NAMES: Record<string, string> = {
  'fullstack-dev': 'Sun Wukong',
  'nextjs-frontend': 'Erlang Shen',
  'electron-dev': 'Sha Wujing',
  'backend-arch': 'Guanyin',
  'expo-mobile': 'Nezha',
  'embedded-dev': 'Bull Demon King',
  'videogame-dev': 'Red Boy',
  'ui-designer': 'Ao Guang',
  'product-mgr': 'Tripitaka',
  'product-marketer': 'Ao Run',
  'exec-assistant': 'Zhu Bajie',
  'issue-planner': 'Tripitaka',
}

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
    return { icon: currentStatus === 'complete' ? '\u2713' : '\u2717', label: currentStatus }
  }
  if (runningPhase === phase) return { icon: '\u25C9', label: 'running' }

  const phaseHappened: Record<Phase, PodWorkflow['status'][]> = {
    execute: ['reviewing', 'executing', 'self-fixing', 'complete', 'failed'],
    plan: ['executing', 'self-fixing', 'complete', 'failed'],
    validate: ['complete', 'failed'],
  }
  const isDone = phaseHappened[phase]?.some(s => wf.stageHistory.some(h => h.stage === s))
  if (isDone) return { icon: '\u2713', label: 'complete' }
  return { icon: '\u25CB', label: 'pending' }
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

/** Extract short repo name from cwd path (last segment) */
function shortRepo(cwd: string): string {
  const parts = cwd.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || cwd
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  solver: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Solver' },
  reviewer: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', label: 'Reviewer' },
  executor: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Executor' },
}

// ── AgentChip ────────────────────────────────────────────────────────────────

function AgentChip({ agentId, role, active }: { agentId: string; role: string; active: boolean }) {
  const avatar = AGENT_AVATARS[agentId]
  const name = AGENT_NAMES[agentId] || agentId
  const colors = ROLE_COLORS[role] || ROLE_COLORS.solver

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${colors.border} ${colors.bg} ${!active ? 'opacity-40' : ''}`}>
      {avatar ? (
        <img src={avatar} alt={name} className="w-[88px] h-[88px] rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-[88px] h-[88px] rounded-full bg-[var(--c-bg-elevated)] flex items-center justify-center text-2xl text-[var(--c-text-muted)] shrink-0">
          {name[0]}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[18px] font-semibold text-[var(--c-text-heading)] truncate leading-snug">{name}</div>
        <div className={`text-[15px] ${colors.text} leading-snug mt-0.5`}>{colors.label}</div>
      </div>
      {active && (
        <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0 ml-auto" />
      )}
    </div>
  )
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

  const activeRole =
    wf.status === 'solving' || wf.status === 'feedback' ? 'solver' :
    wf.status === 'reviewing' ? 'reviewer' :
    wf.status === 'executing' || wf.status === 'self-fixing' ? 'executor' :
    null

  return (
    <div
      className={[
        'rounded-xl border transition-all duration-150 bg-[var(--c-bg-surface)]',
        wf.status === 'failed' ? 'border-red-500/40 border-l-4 border-l-red-500' : 'border-[var(--c-border)]',
        isTerminal ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Collapsed header — issue title + repo + status */}
      <button
        type="button"
        className="w-full text-left px-5 py-5 flex items-center gap-5 hover:bg-[var(--c-bg-elevated)] rounded-xl transition-colors"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        {/* Lead avatar */}
        {(() => {
          const leadId = activeRole === 'reviewer' ? wf.reviewer.agentId
            : activeRole === 'executor' ? wf.executor.agentId
            : wf.solver.agentId
          const avatar = AGENT_AVATARS[leadId]
          return avatar ? (
            <img src={avatar} alt="" className="w-[112px] h-[112px] rounded-full object-cover shrink-0 ring-2 ring-[var(--c-border)]" />
          ) : (
            <div className="w-[112px] h-[112px] rounded-full bg-[var(--c-bg-elevated)] shrink-0" />
          )
        })()}

        {/* Title + repo */}
        <div className="flex-1 min-w-0">
          <span className="text-[20px] font-semibold text-[var(--c-text-heading)] line-clamp-2 leading-snug block">{wf.name}</span>
          <span className="text-[15px] text-[var(--c-text-muted)] block mt-1">{shortRepo(wf.cwd)}</span>
        </div>

        {/* Status + elapsed */}
        <div className="flex flex-col items-end gap-1.5 flex-none">
          <span className={`text-[15px] px-3 py-1 rounded-lg border font-mono ${getStatusBadgeClass(wf.status)}`}>
            {wf.status}
          </span>
          {isActive && (
            <span className="text-[14px] text-[var(--c-text-dim)] font-mono">
              {formatElapsedMs(elapsedMs)}
            </span>
          )}
          {wf.lastExecutorPassed === true && <span className="text-green-400 text-[18px]">{'\u2713'}</span>}
          {wf.lastExecutorPassed === false && <span className="text-red-400 text-[18px]">{'\u2717'}</span>}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-[var(--c-border)]">

          {/* Team */}
          <div className="mt-3">
            <div className="text-[14px] uppercase tracking-wider text-[var(--c-text-faint)] mb-2 font-medium">Team</div>
            <div className="grid grid-cols-3 gap-3">
              <AgentChip agentId={wf.solver.agentId} role="solver" active={activeRole === 'solver'} />
              <AgentChip agentId={wf.reviewer.agentId} role="reviewer" active={activeRole === 'reviewer'} />
              <AgentChip agentId={wf.executor.agentId} role="executor" active={activeRole === 'executor'} />
            </div>
          </div>

          {/* Phase config */}
          <div>
            <div className="text-[14px] uppercase tracking-wider text-[var(--c-text-faint)] mb-2 font-medium">Phases</div>
            <div className="flex flex-col gap-1.5">
              {phases.map(phase => {
                const model = wf.phaseOverrides?.[phase]?.model
                  ?? wf.resolvedProfile?.phases?.[phase]?.model
                  ?? '\u2014'
                const { icon, label } = getPhaseStatusIndicator(wf, phase)
                const isRunning = label === 'running'
                return (
                  <div
                    key={phase}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] ${isRunning ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-[var(--c-bg-elevated)]'}`}
                  >
                    <span className={`font-mono text-[14px] ${isRunning ? 'text-blue-300' : 'text-[var(--c-text-faint)]'}`}>{icon}</span>
                    <span className="w-20 text-[var(--c-text-secondary)] shrink-0 font-medium">{phaseLabels[phase]}</span>
                    <span className="flex-1 font-mono text-[var(--c-text-dim)]">{model}</span>
                    {wf.phaseOverrides?.[phase] && (
                      <span className="text-[12px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">override</span>
                    )}
                    {isRunning && (
                      <span className="text-[14px] text-blue-300 font-mono">{formatElapsedMs(elapsedMs)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Override next phase */}
          {isActive && nextPhase && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-[var(--c-bg-elevated)] border border-[var(--c-border)]">
              <div className="text-[13px] uppercase tracking-wider text-[var(--c-text-faint)] font-medium">
                Override Next Phase ({nextPhase})
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={overrideModel}
                  onChange={e => setOverrideModel(e.target.value)}
                  className="text-[14px] bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-[var(--c-text-secondary)] focus:outline-none"
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  {TIMEOUT_MULTIPLIERS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOverrideTimeout(m)}
                      className={`text-[13px] px-2.5 py-1 rounded-lg border transition-colors ${
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
                  className="text-[14px] px-4 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-500/40 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {wf.error && (
            <div className="text-[14px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono break-all">
              {wf.error.slice(0, 120)}{wf.error.length > 120 ? '\u2026' : ''}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            {(isActive || isPaused) && (
              <>
                {isActive && (
                  <button
                    type="button"
                    onClick={() => onPause(wf.id)}
                    className="text-[14px] px-4 py-2 rounded-lg bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors"
                  >
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    onClick={() => onResume(wf.id)}
                    className="text-[14px] px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-500 border border-green-500/40 text-white transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onCancel(wf.id)}
                  className="text-[14px] px-4 py-2 rounded-lg bg-red-600/70 hover:bg-red-500 border border-red-500/40 text-white transition-colors"
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
