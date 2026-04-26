import { useState, useEffect, useCallback } from 'react'
import { useAppearanceStore } from '../stores/appearance-store'
import type {
  PodWorkflow,
  GitHubIssueCard,
  GithubPollerStatus,
} from '../types'
import { GithubPollStatusBadge, SourcesModal } from './SourcesModal'
import { usePolling } from '../hooks/usePolling'
import { useToast } from './Toast'

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

// ── Lane definitions — pod phase columns ─────────────────────────────────────

type LaneId = 'planning' | 'executing' | 'validating' | 'done' | 'failed'

const LANES: { key: LaneId; label: string; dot: string; border: string }[] = [
  { key: 'planning', label: 'Planning', dot: 'bg-amber-400', border: 'border-amber-500/35' },
  { key: 'executing', label: 'Executing', dot: 'bg-blue-400', border: 'border-blue-500/35' },
  { key: 'validating', label: 'Validating', dot: 'bg-violet-400', border: 'border-violet-500/35' },
]

function cardLane(card: GitHubIssueCard): LaneId {
  const status = card.taskStatus
  const stage = (card.taskStage || '').toLowerCase()

  if (status === 'failed' || status === 'cancelled' || stage === 'failed') return 'failed'
  if (status === 'completed' || stage === 'done' || stage === 'complete') return 'done'
  if (stage === 'solving' || stage === 'feedback' || stage === 'planning') return 'planning'
  if (stage === 'reviewing') return 'validating'
  if (stage === 'executing' || stage === 'self-fixing') return 'executing'
  if (stage === 'validating') return 'validating'
  if (stage === 'awaiting-answer' || stage === 'queued') return 'planning'
  if (status === 'queued' || status === 'assigned') return 'planning'
  if (status === 'active') return 'executing'
  return 'planning'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatElapsedMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

type Phase = 'plan' | 'execute' | 'validate'
const MODEL_OPTIONS = ['opus', 'sonnet', 'haiku', 'ollama:qwen3-coder:30b']
const TIMEOUT_MULTIPLIERS = [1, 2, 5]

// ── DispatchContent — unified issue + pod board ─────────────────────────────

function DispatchContent({ onClose }: { onClose?: () => void }) {
  const { toast } = useToast()

  // ── Pod workflows ──
  const { data: podWorkflows } = usePolling<PodWorkflow[]>(
    () => window.api.listPods().catch(() => []),
    5000,
  )

  // ── GitHub issues ──
  const [cards, setCards] = useState<GitHubIssueCard[]>([])
  const [pollerStatus, setPollerStatus] = useState<GithubPollerStatus | null>(null)
  const [showSources, setShowSources] = useState(false)

  const loadGithub = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
      ])
      if (Array.isArray(c)) setCards(c)
      if (s && typeof s.running === 'boolean' && typeof s.polling === 'boolean') setPollerStatus(s)
    } catch { /* keep last known */ }
  }, [])

  useEffect(() => { void loadGithub() }, [loadGithub])
  useEffect(() => {
    const id = setInterval(() => { void loadGithub() }, 3000)
    return () => clearInterval(id)
  }, [loadGithub])

  // ── Pod controls ──
  const handlePodPause = useCallback(async (id: string) => {
    try { await window.api.pausePod(id); toast('Paused', 'success') }
    catch { toast('Failed to pause', 'error') }
  }, [toast])
  const handlePodResume = useCallback(async (id: string) => {
    try { await window.api.resumePod(id); toast('Resumed', 'success') }
    catch { toast('Failed to resume', 'error') }
  }, [toast])
  const handlePodCancel = useCallback(async (id: string) => {
    try { await window.api.cancelPod(id); toast('Cancelled', 'success') }
    catch { toast('Failed to cancel', 'error') }
  }, [toast])
  const handlePodOverride = useCallback(async (
    wfId: string, phase: string, override: { model?: string; timeoutMultiplier?: number },
  ) => {
    try { await window.api.overridePod(wfId, phase, override); toast(`Override set for ${phase}`, 'success') }
    catch { toast('Failed to set override', 'error') }
  }, [toast])

  // Build a map from taskId → PodWorkflow for enrichment
  // Primary: match on pod.issueNumber === card.issueNumber (explicit link)
  // Fallback: match on pod.name containing #issueNumber (legacy pods)
  const podByTask = new Map<string, PodWorkflow>()
  const matchedPodIds = new Set<string>()
  if (podWorkflows) {
    for (const card of cards) {
      const pod = podWorkflows.find(p =>
        // Explicit match (new pods)
        (p.issueNumber === card.issueNumber && p.issueRepo && card.repo.endsWith(p.issueRepo)) ||
        // Fallback: name/task contains issue number (legacy)
        p.name?.includes(`#${card.issueNumber}`) ||
        p.task?.includes(`#${card.issueNumber}`)
      )
      if (pod) {
        podByTask.set(card.taskId, pod)
        matchedPodIds.add(pod.id)
      }
    }
  }

  // Orphaned pods — active pods not linked to any GitHub issue
  const orphanedPods = (podWorkflows ?? []).filter(p =>
    !matchedPodIds.has(p.id) && !['complete', 'failed'].includes(p.status)
  )

  const activeCount = cards.filter(c => !['done', 'failed'].includes(cardLane(c))).length

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-semibold text-[var(--c-text-primary)]">Dispatch</span>
          <span className="text-[14px] text-[var(--c-text-muted)]">
            {cards.length} issues{activeCount > 0 && <span className="text-blue-400 ml-2">{activeCount} in progress</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GithubPollStatusBadge status={pollerStatus} className="text-[12px]" />
          <button
            type="button"
            onClick={() => setShowSources(true)}
            className="px-3 py-1.5 text-[13px] rounded-md bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors"
          >
            Sources
          </button>
          <button
            type="button"
            onClick={async () => { await window.api.githubPollNow(); await loadGithub() }}
            className="px-3 py-1.5 text-[13px] rounded-md bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors"
          >
            Poll Now
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] text-[20px] leading-none ml-2"
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4 min-h-0">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--c-border-hover)] gap-3">
            <p className="text-[16px]">No issues tracked yet</p>
            <p className="text-[14px] text-[var(--c-border)]">
              Label issues with <code className="px-1.5 py-0.5 bg-[var(--c-bg-elevated)] rounded text-emerald-400">agent-ready</code> to queue them
            </p>
          </div>
        ) : (
          <div className="flex gap-3 h-full min-w-0">
            {LANES.map(lane => {
              const laneCards = cards.filter(c => cardLane(c) === lane.key)
              return (
                <div
                  key={lane.key}
                  className={`flex-1 min-w-[300px] rounded-xl border ${lane.border} bg-[color-mix(in_srgb,var(--c-bg-elevated)_15%,transparent)] flex flex-col`}
                >
                  {/* Column header */}
                  <div className="px-4 py-3 border-b border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${lane.dot}`} />
                      <span className="text-[15px] font-semibold text-[var(--c-text-secondary)]">{lane.label}</span>
                    </span>
                    <span className="text-[13px] text-[var(--c-border-hover)] bg-[var(--c-bg-elevated)] px-2 py-0.5 rounded-full tabular-nums">
                      {laneCards.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                    {laneCards.map(card => (
                      <IssueCard
                        key={card.taskId}
                        card={card}
                        pod={podByTask.get(card.taskId)}
                        onRefresh={loadGithub}
                        onPodPause={handlePodPause}
                        onPodResume={handlePodResume}
                        onPodCancel={handlePodCancel}
                        onPodOverride={handlePodOverride}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Orphaned pods — active pods not linked to any GitHub issue */}
        {orphanedPods.length > 0 && (
          <div className="mt-4 border-t border-[var(--c-border)] pt-4">
            <div className="text-[14px] font-medium text-[var(--c-text-muted)] mb-3">
              Standalone Pods ({orphanedPods.length})
            </div>
            <div className="space-y-3">
              {orphanedPods.map(pod => (
                <IssueCard
                  key={pod.id}
                  card={{
                    issueNumber: pod.issueNumber ?? 0,
                    repo: pod.issueRepo ?? pod.cwd.split('/').pop() ?? '',
                    title: pod.name,
                    taskId: pod.id,
                    taskStatus: pod.status === 'complete' ? 'completed' : pod.status === 'failed' ? 'failed' : 'active',
                    taskStage: pod.status,
                    priority: pod.priority ?? 'normal',
                    assignedAgent: pod.solver.agentId,
                    podAgents: [
                      { role: 'solver', agentId: pod.solver.agentId, active: pod.status === 'solving' || pod.status === 'feedback' },
                      { role: 'reviewer', agentId: pod.reviewer.agentId, active: pod.status === 'reviewing' },
                      { role: 'executor', agentId: pod.executor.agentId, active: pod.status === 'executing' || pod.status === 'self-fixing' },
                    ],
                    ingestedAt: pod.createdAt,
                    url: '',
                  }}
                  pod={pod}
                  onRefresh={loadGithub}
                  onPodPause={handlePodPause}
                  onPodResume={handlePodResume}
                  onPodCancel={handlePodCancel}
                  onPodOverride={handlePodOverride}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <SourcesModal open={showSources} onClose={() => setShowSources(false)} onReposChanged={() => { void loadGithub() }} />
    </div>
  )
}

// ── IssueCard — GitHub issue enriched with pod workflow ──────────────────────

function IssueCard({
  card, pod, onRefresh, onPodPause, onPodResume, onPodCancel, onPodOverride,
}: {
  card: GitHubIssueCard
  pod?: PodWorkflow
  onRefresh: () => void
  onPodPause: (id: string) => void
  onPodResume: (id: string) => void
  onPodCancel: (id: string) => void
  onPodOverride: (wfId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [overrideModel, setOverrideModel] = useState(MODEL_OPTIONS[0])
  const [overrideTimeout, setOverrideTimeout] = useState(1)

  const repoShort = card.repo.split('/')[1] || card.repo
  const hasPod = !!pod
  const podActive = hasPod && !['complete', 'failed'].includes(pod!.status)

  // Determine active role from pod or card agents
  const activeAgent = card.podAgents?.find(a => a.active)
  const activeAvatar = activeAgent ? AGENT_AVATARS[activeAgent.agentId] : null
  const activeName = activeAgent ? (AGENT_NAMES[activeAgent.agentId] || activeAgent.agentId) : null

  return (
    <div className={[
      'rounded-xl border bg-[var(--c-bg-surface)] transition-all',
      card.taskStatus === 'failed' ? 'border-red-500/40 border-l-4 border-l-red-500' : 'border-[var(--c-border)]',
    ].join(' ')}>
      {/* Main card — always visible */}
      <button
        type="button"
        className="w-full text-left flex flex-col overflow-hidden hover:bg-[var(--c-bg-elevated)] rounded-2xl transition-colors"
        onClick={() => hasPod && setExpanded(e => !e)}
      >
        {/* Hero image — fills top half, no border, no rounding */}
        {activeAvatar ? (
          <div className="w-full flex justify-center py-4">
            <img src={activeAvatar} alt="" className="h-[250px] w-auto rounded-xl border border-[var(--c-border)] object-cover object-top" />
          </div>
        ) : (
          <div className="w-full h-[250px] bg-[var(--c-bg-elevated)] flex items-center justify-center">
            <span className="text-[56px] text-[var(--c-text-faint)]">#{card.issueNumber}</span>
          </div>
        )}

        {/* Title + issue link in bottom half */}
        <div className="w-full px-5 py-4">
          <span className="text-[20px] font-semibold text-[var(--c-text-heading)] line-clamp-2 leading-tight block">{card.title}</span>
          <div className="flex items-center gap-3 mt-2">
            {card.url ? (
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-indigo-400 hover:text-indigo-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {repoShort}#{card.issueNumber}
              </a>
            ) : (
              <span className="text-[14px] text-[var(--c-text-muted)]">{repoShort} #{card.issueNumber}</span>
            )}
            {activeName && (
              <span className="text-[13px] text-[var(--c-text-secondary)]">{activeName}</span>
            )}
            <span className="text-[12px] text-[var(--c-text-faint)] ml-auto">{formatAge(card.ingestedAt)}</span>
            {hasPod && <span className="text-[12px] text-[var(--c-text-faint)]">{expanded ? '\u25B2' : '\u25BC'}</span>}
          </div>
        </div>
      </button>

      {/* Pod agents strip — show team avatars when pod is assigned */}
      {card.podAgents && card.podAgents.length > 0 && !expanded && (
        <div className="px-4 pb-3 flex items-center gap-2">
          {card.podAgents.map(a => (
            <div key={a.role} className={`flex items-center gap-1.5 ${!a.active ? 'opacity-40' : ''}`}>
              {AGENT_AVATARS[a.agentId] ? (
                <img src={AGENT_AVATARS[a.agentId]} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--c-bg-elevated)]" />
              )}
              <span className="text-[12px] text-[var(--c-text-muted)]">
                {AGENT_NAMES[a.agentId]?.split(' ')[0] || a.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded pod detail — phase config + overrides */}
      {expanded && pod && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-[var(--c-border)]">
          {/* Team */}
          <div className="mt-3">
            <div className="text-[13px] uppercase tracking-wider text-[var(--c-text-faint)] mb-2 font-medium">Team</div>
            <div className="grid grid-cols-3 gap-3">
              {(['solver', 'reviewer', 'executor'] as const).map(role => {
                const agentId = pod[role].agentId
                const avatar = AGENT_AVATARS[agentId]
                const name = AGENT_NAMES[agentId] || agentId
                const isActive = activeAgent?.role === role
                const colors = role === 'solver' ? 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                  : role === 'reviewer' ? 'border-violet-500/30 bg-violet-500/15 text-violet-400'
                  : 'border-blue-500/30 bg-blue-500/15 text-blue-400'
                const roleLabel = role === 'solver' ? 'Solver' : role === 'reviewer' ? 'Reviewer' : 'Executor'
                return (
                  <div key={role} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${colors} ${!isActive ? 'opacity-40' : ''}`}>
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-[72px] h-[72px] rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-[72px] h-[72px] rounded-full bg-[var(--c-bg-elevated)] flex items-center justify-center text-xl text-[var(--c-text-muted)] shrink-0">{name[0]}</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[16px] font-semibold text-[var(--c-text-heading)] truncate">{name}</div>
                      <div className="text-[14px] mt-0.5">{roleLabel}</div>
                    </div>
                    {isActive && <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0 ml-auto" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Phase config */}
          <div>
            <div className="text-[13px] uppercase tracking-wider text-[var(--c-text-faint)] mb-2 font-medium">Phases</div>
            <div className="flex flex-col gap-1.5">
              {(['plan', 'execute', 'validate'] as Phase[]).map(phase => {
                const model = pod.phaseOverrides?.[phase]?.model
                  ?? pod.resolvedProfile?.phases?.[phase]?.model
                  ?? '\u2014'
                const phaseLabel = phase === 'plan' ? 'Plan' : phase === 'execute' ? 'Execute' : 'Validate'
                return (
                  <div key={phase} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--c-bg-elevated)] text-[15px]">
                    <span className="w-20 text-[var(--c-text-secondary)] shrink-0 font-medium">{phaseLabel}</span>
                    <span className="flex-1 font-mono text-[var(--c-text-dim)]">{model}</span>
                    {pod.phaseOverrides?.[phase] && (
                      <span className="text-[12px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">override</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Override next phase */}
          {podActive && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-[var(--c-bg-elevated)] border border-[var(--c-border)]">
              <div className="text-[13px] uppercase tracking-wider text-[var(--c-text-faint)] font-medium">Override Next Phase</div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={overrideModel}
                  onChange={e => setOverrideModel(e.target.value)}
                  className="text-[14px] bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-[var(--c-text-secondary)] focus:outline-none"
                >
                  {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
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
                    >{m}x</button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Determine next phase from pod status
                    const nextPhase: Phase | null =
                      pod.status === 'solving' || pod.status === 'feedback' ? 'execute' :
                      pod.status === 'reviewing' ? 'validate' : null
                    if (nextPhase) onPodOverride(pod.id, nextPhase, { model: overrideModel, timeoutMultiplier: overrideTimeout })
                  }}
                  className="text-[14px] px-4 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-500/40 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {pod.error && (
            <div className="text-[14px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono break-all">
              {pod.error.slice(0, 120)}{pod.error.length > 120 ? '\u2026' : ''}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            {podActive && (
              <>
                <button type="button" onClick={() => onPodPause(pod.id)}
                  className="text-[14px] px-4 py-2 rounded-lg bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors"
                >Pause</button>
                <button type="button" onClick={() => onPodCancel(pod.id)}
                  className="text-[14px] px-4 py-2 rounded-lg bg-red-600/70 hover:bg-red-500 border border-red-500/40 text-white transition-colors"
                >Cancel</button>
              </>
            )}
            {pod.status === 'paused' && (
              <button type="button" onClick={() => onPodResume(pod.id)}
                className="text-[14px] px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-500 border border-green-500/40 text-white transition-colors"
              >Resume</button>
            )}
            {(card.taskStatus === 'failed') && (
              <button
                onClick={async () => { await window.api.orchestratorRetryTask(card.taskId); onRefresh() }}
                className="text-[14px] px-4 py-2 rounded-lg bg-blue-600/70 hover:bg-blue-500 border border-blue-500/40 text-white transition-colors"
              >Retry</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TasksPanel — standalone Dispatch panel ─────────────────────────────────

export function TasksPanel() {
  const uiTheme = useAppearanceStore((s) => s.theme)
  return (
    <div className="relative h-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: uiTheme === 'light' ? 'url(light-1.jpg)' : 'url(tasks-bg.jpeg)' }}
      />
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-bg-app)_94%,transparent)]" />
      <div className="relative h-full flex flex-col text-[var(--c-text-primary)]">
        <DispatchContent />
      </div>
    </div>
  )
}

/** Modal version — still available for command palette / hotkey use. */
export function OrchestratorModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in"
      data-disable-office-hotkeys="true"
    >
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl w-[min(96vw,calc(900px+120px*var(--penny-ui-nav-scale)))] max-h-[84vh] flex flex-col shadow-2xl animate-modal-scale-in">
        <DispatchContent onClose={onClose} />
      </div>
    </div>
  )
}
