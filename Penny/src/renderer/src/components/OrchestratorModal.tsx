import { useState, useEffect, useCallback } from 'react'
import { useAppearanceStore } from '../stores/appearance-store'
import type {
  Task,
  AgentHealthStatus,
  OrchestratorStats,
  VeritasTaskSummary,
  VeritasTaskCounts,
  VeritasTaskStatus,
  VeritasTaskPriority,
  VeritasServiceStatus,
  ModelProvider,
  StageResult,
  TaskStage,
  GitHubIssueCard,
  GithubPollerStatus,
} from '../types'
import { GithubPollStatusBadge, SourcesModal } from './SourcesModal'

// ── Agent avatar lookup — maps agent IDs to Journey to the West portrait PNGs
// ---------------------------------------------------------------------------
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

// ── GitHub issue board — lanes by pod / pipeline stage (not a separate “Queued” column)
// ---------------------------------------------------------------------------

type PodLaneId = 'question' | 'planning' | 'executing' | 'validating' | 'done' | 'failed'

const POD_LANES: { key: PodLaneId; label: string; dot: string }[] = [
  { key: 'question', label: 'Question', dot: 'bg-sky-400' },
  { key: 'planning', label: 'Planning', dot: 'bg-amber-400' },
  { key: 'executing', label: 'Executing', dot: 'bg-blue-400' },
  { key: 'validating', label: 'Validating', dot: 'bg-violet-400' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-400' },
  { key: 'failed', label: 'Failed', dot: 'bg-red-400' },
]

function cardPodLane(card: GitHubIssueCard): PodLaneId {
  const status = card.taskStatus
  const stage = (card.taskStage || '').toLowerCase()

  if (status === 'failed' || status === 'cancelled' || stage === 'failed') return 'failed'
  if (status === 'completed' || stage === 'done') return 'done'
  if (stage === 'validating') return 'validating'
  if (stage === 'executing') return 'executing'
  if (stage === 'planning') return 'planning'
  if (stage === 'awaiting-answer' || stage === 'queued') return 'question'
  if (status === 'queued' || status === 'assigned' || status === 'active') return 'question'
  return 'question'
}

// ── OrchestratorModal ───────────────────────────────────────────────────────

/** Standalone Dispatch panel — GitHub issue board with repo management. */
export function TasksPanel() {
  const uiTheme = useAppearanceStore((s) => s.theme)
  const [cards, setCards] = useState<GitHubIssueCard[]>([])
  const [githubPollerStatus, setGithubPollerStatus] = useState<GithubPollerStatus | null>(null)
  const [showSources, setShowSources] = useState(false)

  async function refresh() {
    try {
      const [c, s] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
      ])
      if (Array.isArray(c)) setCards(c)
      if (s && typeof s.running === 'boolean' && typeof s.polling === 'boolean') setGithubPollerStatus(s)
    } catch { /* */ }
  }

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => { void refresh() }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-full overflow-hidden">
      {/* Dispatch panel background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: uiTheme === 'light' ? 'url(light-1.jpg)' : 'url(tasks-bg.jpeg)' }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-bg-app)_94%,transparent)]" />
    <div className="relative h-full flex flex-col text-[var(--c-text-primary)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[calc(22px*var(--penny-ui-nav-scale))] h-[calc(22px*var(--penny-ui-nav-scale))] shrink-0 text-[var(--c-accent-blue)]">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <h1 className="text-[length:var(--penny-task-fs-18)] font-semibold">Dispatch</h1>
            <span className="text-[length:var(--penny-task-fs-14)] text-[var(--c-border-hover)]">{cards.length} issues</span>
          </div>
          <div className="flex items-center gap-3">
            <GithubPollStatusBadge status={githubPollerStatus} />
            <button
              type="button"
              onClick={() => setShowSources(true)}
              className="px-3 py-1.5 text-[length:var(--penny-task-fs-12)] rounded-md bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors"
            >
              Sources
            </button>
            <button
              type="button"
              onClick={async () => {
                await window.api.githubPollNow()
                void refresh()
              }}
              className="px-3 py-1.5 text-[length:var(--penny-task-fs-12)] rounded-md bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors"
            >
              Poll Now
            </button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--c-border-hover)] gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[calc(48px*var(--penny-ui-nav-scale))] h-[calc(48px*var(--penny-ui-nav-scale))] text-[var(--c-border)]">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <p className="text-[length:var(--penny-task-fs-14)]">No issues tracked yet</p>
            <p className="text-[length:var(--penny-task-fs-12)] text-[var(--c-border)]">Label issues with <code className="px-1.5 py-0.5 bg-[var(--c-bg-elevated)] rounded text-[var(--c-accent-blue)]">agent-ready</code> to queue them</p>
          </div>
        ) : (
          <div className="flex gap-2 h-full min-w-0 overflow-x-auto pb-1">
            {POD_LANES.map(col => {
              const colCards = cards.filter(c => cardPodLane(c) === col.key)
              return (
                <div key={col.key} className="w-[min(13rem,calc(11rem*var(--penny-ui-nav-scale)))] shrink-0 flex flex-col">
                  <div className="flex items-center gap-2 px-2 py-2 mb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                    <span className="text-[length:var(--penny-task-fs-14)] font-medium text-[var(--c-text-secondary)] truncate">{col.label}</span>
                    <span className="text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)] ml-auto tabular-nums">{colCards.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 px-1">
                    {colCards.map(card => (
                      <div
                        key={card.taskId}
                        className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)] rounded-lg p-3 space-y-1.5 hover:border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={card.url}
                            onClick={e => { e.preventDefault(); window.open(card.url, '_blank') }}
                            className="text-[length:var(--penny-task-fs-12)] text-blue-400 hover:text-blue-300 font-mono"
                          >
                            #{card.issueNumber}
                          </a>
                          <span className={`text-[length:var(--penny-task-fs-10)] px-1.5 py-0.5 rounded border ${
                            card.priority === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                            card.priority === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                            'bg-[color-mix(in_srgb,var(--c-border-hover)_20%,transparent)] text-[var(--c-text-secondary)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]'
                          }`}>
                            {card.priority}
                          </span>
                        </div>
                        <p className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] leading-snug line-clamp-2">{card.title}</p>
                        <div className="flex items-center justify-between text-[length:var(--penny-task-fs-11)] text-[var(--c-border-hover)]">
                          <span className="truncate max-w-[calc(120px*var(--penny-ui-nav-scale))]">{card.repo}</span>
                          <span>{tasksTimeAgo(card.ingestedAt)}</span>
                        </div>
                        {card.assignedAgent && (
                          <div className="flex items-center gap-1.5 text-[length:var(--penny-task-fs-11)] text-[color-mix(in_srgb,var(--c-accent-blue)_70%,transparent)]">
                            {AGENT_AVATARS[card.assignedAgent] && (
                              <img src={AGENT_AVATARS[card.assignedAgent]} alt="" className="w-4 h-4 rounded-full object-cover" />
                            )}
                            <span className="truncate">{card.assignedAgent}</span>
                          </div>
                        )}
                        <div className="flex gap-1 pt-1">
                          {(card.taskStatus === 'queued' || card.taskStatus === 'assigned' || card.taskStatus === 'active') && (
                            <button
                              onClick={async () => { await window.api.orchestratorCancelTask(card.taskId); refresh() }}
                              className="text-[length:var(--penny-task-fs-10)] text-red-400/60 hover:text-red-400"
                            >
                              Cancel
                            </button>
                          )}
                          {card.taskStatus === 'failed' && (
                            <button
                              onClick={async () => { await window.api.orchestratorRetryTask(card.taskId); refresh() }}
                              className="text-[length:var(--penny-task-fs-10)] text-blue-400/60 hover:text-blue-400"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <SourcesModal open={showSources} onClose={() => setShowSources(false)} onReposChanged={() => { void refresh() }} />
    </div>
    </div>
  )
}

function tasksTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Shared content used by both panel and modal. */
function OrchestratorContent({ onClose }: { onClose?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<AgentHealthStatus[]>([])
  const [stats, setStats] = useState<OrchestratorStats | null>(null)
  const [veritasTasks, setVeritasTasks] = useState<VeritasTaskSummary[]>([])
  const [veritasCounts, setVeritasCounts] = useState<VeritasTaskCounts | null>(null)
  const [veritasStatus, setVeritasStatus] = useState<VeritasServiceStatus | null>(null)
  const [veritasError, setVeritasError] = useState<string | null>(null)
  const [veritasLoading, setVeritasLoading] = useState(false)
  const [updatingVeritasTaskId, setUpdatingVeritasTaskId] = useState<string | null>(null)
  const [githubCards, setGithubCards] = useState<GitHubIssueCard[]>([])
  const [githubPollerStatus, setGithubPollerStatus] = useState<GithubPollerStatus | null>(null)
  const [tab, setTab] = useState<'queue' | 'health' | 'veritas' | 'github'>('queue')
  const [showEnqueue, setShowEnqueue] = useState(false)
  const [showVeritasCreate, setShowVeritasCreate] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [provider, setProvider] = useState<ModelProvider>('claude')
  const [ollamaAvailable, setOllamaAvailable] = useState(false)

  useEffect(() => {
    void loadData()
    void loadProvider()
    const interval = setInterval(() => { void loadData() }, 7000)
    return () => clearInterval(interval)
  }, [])

  async function loadProvider() {
    try {
      const result = await window.api.orchestratorGetProvider()
      if (result && typeof result.provider === 'string') {
        setProvider(result.provider as ModelProvider)
        setOllamaAvailable(!!result.ollamaAvailable)
      }
    } catch { /* keep defaults */ }
  }

  async function toggleProvider() {
    const next: ModelProvider = provider === 'claude' ? 'ollama' : 'claude'
    try {
      await window.api.orchestratorSetProvider(next)
      setProvider(next)
    } catch { /* ignore */ }
  }

  async function loadOrchestratorData() {
    try {
      const [q, h, s] = await Promise.all([
        window.api.orchestratorQueue(),
        window.api.orchestratorAgentHealth(),
        window.api.orchestratorStats(),
      ])
      if (Array.isArray(q)) setTasks(q)
      if (Array.isArray(h)) setHealth(h)
      if (isOrchestratorStats(s)) setStats(s)
    } catch {
      // Keep last known values in UI
    }
  }

  async function loadVeritasData() {
    setVeritasLoading(true)
    try {
      const [taskResult, countResult, statusResult] = await Promise.all([
        window.api.veritasListTasks(),
        window.api.veritasTaskCounts(),
        window.api.veritasStatus(),
      ])

      const err = getIpcError(taskResult) || getIpcError(countResult) || getIpcError(statusResult)
      if (err) throw new Error(err)

      if (Array.isArray(taskResult)) setVeritasTasks(taskResult)
      if (isVeritasTaskCounts(countResult)) setVeritasCounts(countResult)
      if (isVeritasServiceStatus(statusResult)) setVeritasStatus(statusResult)
      setVeritasError(null)
    } catch (err) {
      setVeritasError((err as Error).message)
    } finally {
      setVeritasLoading(false)
    }
  }

  const loadGithubData = useCallback(async () => {
    try {
      const [cards, status] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
      ])
      if (Array.isArray(cards)) setGithubCards(cards)
      if (status && typeof status.running === 'boolean' && typeof status.polling === 'boolean') {
        setGithubPollerStatus(status)
      }
    } catch { /* keep last known */ }
  }, [])

  useEffect(() => {
    if (tab !== 'github') return
    const id = window.setInterval(() => { void loadGithubData() }, 2000)
    return () => clearInterval(id)
  }, [tab, loadGithubData])

  async function loadData() {
    await Promise.all([
      loadOrchestratorData(),
      loadVeritasData(),
      loadGithubData(),
    ])
  }

  async function handleCreateVeritasTask(
    title: string,
    description: string,
    project: string,
    priority: VeritasTaskPriority,
  ) {
    try {
      const created = await window.api.veritasCreateTask(
        title,
        description,
        project.trim() ? project.trim() : undefined,
        priority,
      )
      const err = getIpcError(created)
      if (err) throw new Error(err)
      setShowVeritasCreate(false)
      await loadVeritasData()
    } catch (err) {
      setVeritasError((err as Error).message)
    }
  }

  async function handleUpdateVeritasTaskStatus(taskId: string, status: VeritasTaskStatus) {
    setUpdatingVeritasTaskId(taskId)
    try {
      const updated = await window.api.veritasUpdateTaskStatus(taskId, status)
      const err = getIpcError(updated)
      if (err) throw new Error(err)
      await loadVeritasData()
    } catch (err) {
      setVeritasError((err as Error).message)
    } finally {
      setUpdatingVeritasTaskId(null)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[length:var(--penny-task-fs-18)] font-semibold text-[var(--c-text-primary)]">Dispatch</span>
          {tab !== 'veritas' && stats && (
            <div className="flex items-center gap-3 text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)]">
              <span>{stats.queueDepth} queued</span>
              <span>{stats.activeTasks} active</span>
              <span className="text-emerald-400">{stats.completedToday} done today</span>
              {stats.failedToday > 0 && (
                <span className="text-red-400">{stats.failedToday} failed</span>
              )}
            </div>
          )}
          {tab === 'github' && githubCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)]">
              <span>{githubCards.length} issues</span>
              <span className="text-sky-400/90">{githubCards.filter(c => cardPodLane(c) === 'question').length} question</span>
              <span className="text-amber-400/90">{githubCards.filter(c => cardPodLane(c) === 'planning').length} planning</span>
              <span className="text-blue-400/90">{githubCards.filter(c => cardPodLane(c) === 'executing').length} executing</span>
              <span className="text-violet-400/90">{githubCards.filter(c => cardPodLane(c) === 'validating').length} validating</span>
              <span className="text-emerald-400">{githubCards.filter(c => cardPodLane(c) === 'done').length} done</span>
              {githubCards.filter(c => cardPodLane(c) === 'failed').length > 0 && (
                <span className="text-red-400">{githubCards.filter(c => cardPodLane(c) === 'failed').length} failed</span>
              )}
            </div>
          )}
          {tab === 'veritas' && veritasCounts && (
            <div className="flex items-center gap-3 text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)]">
              <span>{veritasCounts.todo} todo</span>
              <span>{veritasCounts['in-progress']} in progress</span>
              <span>{veritasCounts.blocked} blocked</span>
              <span className="text-emerald-400">{veritasCounts.done} done</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleProvider}
            className={`px-2.5 py-1 rounded-md text-[length:var(--penny-task-fs-11)] font-medium transition-all duration-200 ${
              provider === 'claude'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                : 'bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30'
            }`}
            title={`Current provider: ${provider}. Click to toggle.`}
          >
            {provider === 'claude' ? 'Claude' : 'Ollama'}
            {provider === 'ollama' && !ollamaAvailable && (
              <span className="ml-1 text-red-400">(offline)</span>
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] text-[length:var(--penny-task-fs-20)] leading-none"
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
        <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>Task Queue</TabButton>
        <TabButton active={tab === 'health'} onClick={() => setTab('health')}>Agent Health</TabButton>
        <TabButton active={tab === 'veritas'} onClick={() => setTab('veritas')}>Veritas Board</TabButton>
        <TabButton active={tab === 'github'} onClick={() => setTab('github')}>
          GitHub Issues{githubCards.length > 0 && ` (${githubCards.length})`}
        </TabButton>
        <div className="flex-1" />
        {tab === 'queue' && (
          <button
            onClick={() => setShowEnqueue(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[length:var(--penny-task-fs-12)] rounded-md"
          >
            + New Task
          </button>
        )}
        {tab === 'veritas' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void window.api.veritasOpen() }}
              className="px-3 py-1 bg-[var(--c-border)] hover:bg-[var(--c-border)] text-[var(--c-text-primary)] text-[length:var(--penny-task-fs-12)] rounded-md"
            >
              Open Board
            </button>
            <button
              onClick={() => setShowVeritasCreate(true)}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[length:var(--penny-task-fs-12)] rounded-md"
            >
              + New Veritas Task
            </button>
          </div>
        )}
        {tab === 'github' && (
          <div className="flex items-center gap-2">
            <GithubPollStatusBadge status={githubPollerStatus} className="text-[length:var(--penny-task-fs-10)]" />
            <button
              type="button"
              onClick={() => setShowSources(true)}
              className="px-3 py-1 bg-[var(--c-border)] hover:bg-[var(--c-border)] text-[var(--c-text-primary)] text-[length:var(--penny-task-fs-12)] rounded-md"
            >
              Sources
            </button>
            <button
              type="button"
              onClick={async () => {
                await window.api.githubPollNow()
                await loadGithubData()
              }}
              className="px-3 py-1 bg-[var(--c-border)] hover:bg-[var(--c-border)] text-[var(--c-text-primary)] text-[length:var(--penny-task-fs-12)] rounded-md"
            >
              Poll Now
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {tab === 'queue' ? (
          <TaskQueueView tasks={tasks} onRefresh={loadData} />
        ) : tab === 'health' ? (
          <AgentHealthView health={health} onRefresh={loadData} />
        ) : tab === 'github' ? (
          <GitHubKanbanView cards={githubCards} onRefresh={loadGithubData} />
        ) : (
          <VeritasBoardView
            tasks={veritasTasks}
            counts={veritasCounts}
            status={veritasStatus}
            error={veritasError}
            loading={veritasLoading}
            updatingTaskId={updatingVeritasTaskId}
            onRefresh={loadVeritasData}
            onUpdateStatus={handleUpdateVeritasTaskStatus}
          />
        )}
      </div>

      {/* Enqueue Modal */}
      {showEnqueue && (
        <EnqueueModal
          onSubmit={async (title, description, project, priority) => {
            await window.api.orchestratorEnqueue(title, description, project, priority)
            setShowEnqueue(false)
            await loadOrchestratorData()
          }}
          onClose={() => setShowEnqueue(false)}
        />
      )}

      {/* Veritas Create Modal */}
      {showVeritasCreate && (
        <VeritasCreateTaskModal
          onSubmit={handleCreateVeritasTask}
          onClose={() => setShowVeritasCreate(false)}
        />
      )}

      <SourcesModal
        open={showSources}
        onClose={() => setShowSources(false)}
        onReposChanged={() => { void loadGithubData() }}
      />
    </>
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
        <OrchestratorContent onClose={onClose} />
      </div>
    </div>
  )
}

// ── Task Queue View ─────────────────────────────────────────────────────────

function TaskQueueView({ tasks, onRefresh }: { tasks: Task[]; onRefresh: () => void }) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(n => (
          <div key={n} className="animate-shimmer h-14 rounded-lg bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]" />
        ))}
        <div className="text-center text-[var(--c-border-hover)] py-4 text-[length:var(--penny-task-fs-12)]">
          No tasks in queue. Create one with the + button or use <code>!task</code> in Slack.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className="stagger-item">
          <TaskRow task={task} onRefresh={onRefresh} />
        </div>
      ))}
    </div>
  )
}

function TaskRow({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const statusColors: Record<string, string> = {
    queued: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-[color-mix(in_srgb,var(--c-border-hover)_20%,transparent)] text-[var(--c-text-muted)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]',
  }

  const priorityColors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    normal: 'text-[var(--c-text-secondary)]',
    low: 'text-[var(--c-border-hover)]',
  }

  const age = formatAge(task.createdAt)
  const isActive = task.status === 'active' || task.status === 'assigned'
  const hasStages = task.stageResults && task.stageResults.length > 0

  return (
    <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] rounded-lg">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[length:var(--penny-task-fs-11)] font-medium ${priorityColors[task.priority]}`}>
              {task.priority.toUpperCase()}
            </span>
            <span className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] truncate">{task.title}</span>
            {task.provider === 'ollama' && (
              <span className="text-[length:var(--penny-task-fs-9)] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
                ollama
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)]">
            <span>{age}</span>
            <span>via {task.source}</span>
            {task.assignedAgent && <span>{'-> '}{task.assignedAgent}</span>}
            {task.error && <span className="text-red-400 truncate">{task.error}</span>}
          </div>
        </div>

        {/* Stage progress dots for active tasks */}
        {(isActive || hasStages) && task.currentStage && (
          <StageDots currentStage={task.currentStage} stageResults={task.stageResults} />
        )}

        <span className={`px-2 py-0.5 rounded-full text-[length:var(--penny-task-fs-10)] font-medium border ${statusColors[task.status]}`}>
          {task.status}
        </span>
        <div className="flex items-center gap-1">
          {hasStages && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 py-1 text-[length:var(--penny-task-fs-10)] bg-[color-mix(in_srgb,var(--c-border)_50%,transparent)] text-[var(--c-text-muted)] hover:bg-[var(--c-border)] rounded"
            >
              {expanded ? 'Hide' : 'Detail'}
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={async () => { await window.api.orchestratorRetryTask(task.id); onRefresh() }}
              className="px-2 py-1 text-[length:var(--penny-task-fs-10)] bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded"
            >
              Retry
            </button>
          )}
          {(task.status === 'queued' || task.status === 'assigned' || task.status === 'active') && (
            <button
              onClick={async () => { await window.api.orchestratorCancelTask(task.id); onRefresh() }}
              className="px-2 py-1 text-[length:var(--penny-task-fs-10)] bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Expanded stage detail */}
      {expanded && hasStages && (
        <div className="px-3 pb-3 space-y-2 border-t border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] pt-2 animate-fade-slide-down">
          {task.stageResults!.map((sr, i) => (
            <StageResultRow key={i} result={sr} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stage Progress Dots ─────────────────────────────────────────────────────

const STAGE_ORDER: TaskStage[] = ['planning', 'executing', 'validating']
const STAGE_LABELS: Record<string, string> = { planning: 'Plan', executing: 'Exec', validating: 'Val' }

function StageDots({
  currentStage,
  stageResults,
}: {
  currentStage: TaskStage
  stageResults?: StageResult[]
}) {
  const resultMap = new Map<string, StageResult>()
  stageResults?.forEach(sr => resultMap.set(sr.stage, sr))

  return (
    <div className="flex items-center gap-0.5">
      {STAGE_ORDER.map((stage, idx) => {
        const result = resultMap.get(stage)
        const isActive = stage === currentStage
        const isDone = result?.success === true
        const isFailed = result?.success === false
        const providerHint =
          result?.provider === 'ollama'
            ? '(o)'
            : result?.provider === 'opencode'
              ? '(oc)'
              : result?.provider === 'cursor-agent'
                ? '(c)'
                : ''

        let dotClass = 'bg-[var(--c-border)] text-[var(--c-border-hover)]'
        if (isDone) dotClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
        else if (isFailed) dotClass = 'bg-red-500/20 text-red-400 border-red-500/40'
        else if (isActive) dotClass = 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-breathe-glow'

        return (
          <div key={stage} className="flex items-center">
            {idx > 0 && <div className="w-2 h-px bg-[var(--c-border)] mx-0.5" />}
            <span
              className={`px-1.5 py-0.5 rounded text-[length:var(--penny-task-fs-9)] font-medium border ${dotClass}`}
              title={result ? `${stage}: ${result.success ? 'PASS' : 'FAIL'} (${Math.round(result.durationMs / 1000)}s, ${result.provider})` : stage}
            >
              {STAGE_LABELS[stage]}
              {providerHint && <span className="ml-0.5 opacity-60">{providerHint}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StageResultRow({ result }: { result: StageResult }) {
  return (
    <div className="text-[length:var(--penny-task-fs-12)]">
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
          {STAGE_LABELS[result.stage] || result.stage}
        </span>
        <span className="text-[var(--c-border-hover)]">{Math.round(result.durationMs / 1000)}s</span>
        <span className={`px-1 rounded text-[length:var(--penny-task-fs-9)] ${
          result.provider === 'ollama'
            ? 'bg-purple-600/20 text-purple-400'
            : result.provider === 'opencode'
              ? 'bg-amber-600/20 text-amber-400'
              : result.provider === 'cursor-agent'
                ? 'bg-cyan-600/20 text-cyan-400'
                : 'bg-blue-600/20 text-blue-400'
        }`}>
          {result.provider}
        </span>
        <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>
          {result.success ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <pre className="text-[var(--c-text-muted)] whitespace-pre-wrap text-[length:var(--penny-task-fs-10)] max-h-24 overflow-y-auto bg-[color-mix(in_srgb,var(--c-bg-surface)_50%,transparent)] rounded px-2 py-1">
        {result.output.slice(0, 500) || '(no output)'}
      </pre>
    </div>
  )
}

// ── Agent Health View ───────────────────────────────────────────────────────

function AgentHealthView({ health, onRefresh }: { health: AgentHealthStatus[]; onRefresh: () => void }) {
  if (health.length === 0) {
    return <div className="text-center text-[length:var(--penny-task-fs-14)] text-[var(--c-border-hover)] py-12">No agents configured.</div>
  }

  return (
    <div className="space-y-2">
      {health.map(agent => (
        <div key={agent.agentId} className="stagger-item">
          <AgentHealthRow agent={agent} onRefresh={onRefresh} />
        </div>
      ))}
    </div>
  )
}

function AgentHealthRow({ agent, onRefresh }: { agent: AgentHealthStatus; onRefresh: () => void }) {
  const statusDot = {
    healthy: 'bg-emerald-400',
    warning: 'bg-yellow-400',
    dead: 'bg-[var(--c-border)]',
  }[agent.status]

  return (
    <div className="flex items-center gap-3 p-3 bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] rounded-lg">
      <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)]">{agent.name}</div>
        <div className="flex items-center gap-3 mt-0.5 text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)]">
          {agent.alive && (
            <>
              <span>PID {agent.pid}</span>
              <span>{agent.cpu}</span>
              <span>{agent.memoryMB}MB</span>
              <span>{agent.uptime}</span>
            </>
          )}
          {agent.activeTasks > 0 && (
            <span className="text-blue-400">{agent.activeTasks} active task(s)</span>
          )}
          {agent.warnings.map((w, i) => (
            <span key={i} className="text-yellow-400">{w}</span>
          ))}
        </div>
      </div>
      {agent.alive && (
        <button
          onClick={async () => { await window.api.orchestratorShutdownAgent(agent.agentId); onRefresh() }}
          className="px-2 py-1 text-[length:var(--penny-task-fs-10)] bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded"
        >
          Shutdown
        </button>
      )}
    </div>
  )
}

// ── Veritas Board View ───────────────────────────────────────────────────────

function VeritasBoardView({
  tasks,
  counts,
  status,
  error,
  loading,
  updatingTaskId,
  onRefresh,
  onUpdateStatus,
}: {
  tasks: VeritasTaskSummary[]
  counts: VeritasTaskCounts | null
  status: VeritasServiceStatus | null
  error: string | null
  loading: boolean
  updatingTaskId: string | null
  onRefresh: () => void
  onUpdateStatus: (taskId: string, status: VeritasTaskStatus) => Promise<void>
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-[color-mix(in_srgb,var(--c-bg-elevated)_40%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)] rounded-lg">
        <div>
          <p className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)]">Veritas API</p>
          <p className="text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)]">
            {status?.apiUrl || 'Unknown URL'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[length:var(--penny-task-fs-12)]">
          <span className={status?.running ? 'text-emerald-400' : 'text-[var(--c-border-hover)]'}>
            Service: {status?.running ? 'running' : 'stopped'}
          </span>
          <span className={status?.apiReachable ? 'text-emerald-400' : 'text-amber-400'}>
            API: {status?.apiReachable ? 'reachable' : 'not reachable'}
          </span>
          <button
            onClick={onRefresh}
            className="px-2 py-1 bg-[var(--c-border)] hover:bg-[var(--c-border)] text-[var(--c-text-primary)] rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-6 gap-2 text-[length:var(--penny-task-fs-12)]">
          <VeritasCountCard label="Backlog" value={counts.backlog} />
          <VeritasCountCard label="Todo" value={counts.todo} />
          <VeritasCountCard label="In Progress" value={counts['in-progress']} />
          <VeritasCountCard label="Blocked" value={counts.blocked} />
          <VeritasCountCard label="Done" value={counts.done} />
          <VeritasCountCard label="Archived" value={counts.archived} />
        </div>
      )}

      {error && (
        <div className="text-[length:var(--penny-task-fs-12)] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading && tasks.length === 0 ? (
        <div className="text-center text-[length:var(--penny-task-fs-14)] text-[var(--c-border-hover)] py-12">Loading Veritas tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-[length:var(--penny-task-fs-14)] text-[var(--c-border-hover)] py-12">
          No Veritas tasks found. Create one with the button above.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="stagger-item">
              <VeritasTaskRow
                task={task}
                updating={updatingTaskId === task.id}
                onUpdateStatus={onUpdateStatus}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VeritasCountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] px-2 py-1.5">
      <p className="text-[length:var(--penny-task-fs-10)] uppercase tracking-wide text-[var(--c-border-hover)]">{label}</p>
      <p className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] font-semibold">{value}</p>
    </div>
  )
}

function VeritasTaskRow({
  task,
  updating,
  onUpdateStatus,
}: {
  task: VeritasTaskSummary
  updating: boolean
  onUpdateStatus: (taskId: string, status: VeritasTaskStatus) => Promise<void>
}) {
  const statusColors: Record<VeritasTaskStatus, string> = {
    todo: 'bg-[color-mix(in_srgb,var(--c-border-hover)_20%,transparent)] text-[var(--c-text-secondary)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]',
    'in-progress': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    blocked: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  }

  const priorityColors: Record<VeritasTaskPriority, string> = {
    low: 'text-[var(--c-text-muted)]',
    medium: 'text-[var(--c-text-primary)]',
    high: 'text-orange-300',
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[length:var(--penny-task-fs-11)] font-medium ${priorityColors[task.priority]}`}>
            {task.priority.toUpperCase()}
          </span>
          <span className="text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)]">
          <span>{formatAge(task.updated || task.created || '')}</span>
          <span>{task.id}</span>
          {task.project && <span>{task.project}</span>}
          {task.type && <span>{task.type}</span>}
          {task.blockedBy && task.blockedBy.length > 0 && (
            <span className="text-amber-300">{task.blockedBy.length} blocker(s)</span>
          )}
        </div>
      </div>

      <span className={`px-2 py-0.5 rounded-full text-[length:var(--penny-task-fs-10)] font-medium border ${statusColors[task.status]}`}>
        {task.status}
      </span>

      <select
        value={task.status}
        onChange={e => { void onUpdateStatus(task.id, e.target.value as VeritasTaskStatus) }}
        disabled={updating}
        className="bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded px-2 py-1 text-[length:var(--penny-task-fs-12)] text-[var(--c-text-primary)] disabled:opacity-50"
        title="Update Veritas task status"
      >
        <option value="todo">todo</option>
        <option value="in-progress">in-progress</option>
        <option value="blocked">blocked</option>
        <option value="done">done</option>
      </select>
    </div>
  )
}

// ── Enqueue Modal ───────────────────────────────────────────────────────────

function EnqueueModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (title: string, description: string, project: string, priority: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [project, setProject] = useState('atlas')
  const [priority, setPriority] = useState('normal')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl w-[480px] p-5 space-y-4">
        <h3 className="text-[length:var(--penny-task-fs-18)] font-semibold text-[var(--c-text-primary)]">New Task</h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Full task description (sent to the agent)"
          rows={4}
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-blue-500 resize-none"
        />
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="atlas, sidekick, or absolute path (~/…)"
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-blue-500"
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] focus:outline-none focus:border-blue-500"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[length:var(--penny-task-fs-14)] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim() || !description.trim() || !project.trim()) return
              onSubmit(title, description, project, priority)
            }}
            disabled={!title.trim() || !description.trim() || !project.trim()}
            className="px-4 py-2 text-[length:var(--penny-task-fs-14)] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg"
          >
            Enqueue
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Veritas Create Task Modal ───────────────────────────────────────────────

function VeritasCreateTaskModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (title: string, description: string, project: string, priority: VeritasTaskPriority) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [project, setProject] = useState('')
  const [priority, setPriority] = useState<VeritasTaskPriority>('medium')
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl w-[520px] p-5 space-y-4">
        <h3 className="text-[length:var(--penny-task-fs-18)] font-semibold text-[var(--c-text-primary)]">New Veritas Task</h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-violet-500"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={4}
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-violet-500 resize-none"
        />
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Project (optional)"
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-violet-500"
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as VeritasTaskPriority)}
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] focus:outline-none focus:border-violet-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-[length:var(--penny-task-fs-14)] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!title.trim()) return
              setSubmitting(true)
              try {
                await onSubmit(title.trim(), description.trim(), project.trim(), priority)
              } finally {
                setSubmitting(false)
              }
            }}
            disabled={!title.trim() || submitting}
            className="px-4 py-2 text-[length:var(--penny-task-fs-14)] bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg"
          >
            {submitting ? 'Creating...' : 'Create in Veritas'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GitHub Kanban View ──────────────────────────────────────────────────

const LANE_BORDER: Record<PodLaneId, string> = {
  question: 'border-sky-500/35',
  planning: 'border-amber-500/35',
  executing: 'border-blue-500/35',
  validating: 'border-violet-500/35',
  done: 'border-emerald-500/35',
  failed: 'border-red-500/35',
}

function GitHubKanbanView({ cards, onRefresh }: { cards: GitHubIssueCard[]; onRefresh: () => void }) {
  if (cards.length === 0) {
    return (
      <div className="text-center text-[var(--c-border-hover)] py-12 space-y-2">
        <p className="text-[length:var(--penny-task-fs-14)]">No GitHub issues ingested yet.</p>
        <p className="text-[length:var(--penny-task-fs-12)]">Label issues with <code className="px-1.5 py-0.5 bg-[var(--c-bg-elevated)] rounded text-emerald-400">agent-ready</code> on GitHub to queue them.</p>
        <button
          onClick={async () => { await window.api.githubPollNow(); onRefresh() }}
          className="mt-3 px-3 py-1.5 bg-[var(--c-border)] hover:bg-[var(--c-border)] text-[var(--c-text-primary)] text-[length:var(--penny-task-fs-12)] rounded-md"
        >
          Poll Now
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 min-h-[300px]">
      {POD_LANES.map(col => {
        const laneCards = cards.filter(c => cardPodLane(c) === col.key)
        return (
          <div
            key={col.key}
            className={`w-[min(13rem,calc(11rem*var(--penny-ui-nav-scale)))] shrink-0 rounded-lg border ${LANE_BORDER[col.key]} bg-[color-mix(in_srgb,var(--c-bg-elevated)_20%,transparent)] flex flex-col`}
          >
            <div className="px-2 py-2 border-b border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                <span className="text-[length:var(--penny-task-fs-12)] font-medium text-[var(--c-text-secondary)] truncate">{col.label}</span>
              </span>
              <span className="text-[length:var(--penny-task-fs-10)] text-[var(--c-border-hover)] bg-[var(--c-bg-elevated)] px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                {laneCards.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
              {laneCards.map(card => (
                <GitHubIssueCardItem key={card.taskId} card={card} onRefresh={onRefresh} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GitHubIssueCardItem({ card, onRefresh }: { card: GitHubIssueCard; onRefresh: () => void }) {
  const priorityDot: Record<string, string> = {
    critical: 'bg-red-400',
    high: 'bg-orange-400',
    normal: 'bg-[var(--c-border-hover)]',
    low: 'bg-[var(--c-border)]',
  }

  const stageLabel = card.taskStage && card.taskStage !== 'queued' && card.taskStage !== 'done'
    ? card.taskStage
    : null

  return (
    <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)] rounded-md p-2.5 space-y-1.5 hover:border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] transition-colors">
      <div className="flex items-start gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[card.priority] || 'bg-[var(--c-border-hover)]'}`} />
        <span className="text-[length:var(--penny-task-fs-12)] text-[var(--c-text-primary)] leading-tight line-clamp-2">{card.title}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <a
          href={card.url}
          onClick={(e) => { e.preventDefault(); void window.api.openDownloads() }}
          className="text-[length:var(--penny-task-fs-10)] text-blue-400 hover:text-blue-300 font-mono"
          title={card.url}
        >
          #{card.issueNumber}
        </a>
        <span className="text-[length:var(--penny-task-fs-10)] text-[var(--c-border)]">{card.repo.split('/')[1]}</span>
        {stageLabel && (
          <span className="text-[length:var(--penny-task-fs-9)] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
            {stageLabel}
          </span>
        )}
        {card.assignedAgent && (
          <span className="inline-flex items-center gap-1 text-[length:var(--penny-task-fs-10)] text-[var(--c-border-hover)] truncate max-w-[calc(100px*var(--penny-ui-nav-scale))]" title={card.assignedAgent}>
            {AGENT_AVATARS[card.assignedAgent] && (
              <img src={AGENT_AVATARS[card.assignedAgent]} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
            )}
            {card.assignedAgent}
          </span>
        )}
      </div>
      <div className="text-[length:var(--penny-task-fs-10)] text-[var(--c-border)]">{formatAge(card.ingestedAt)}</div>
      {(card.taskStatus === 'queued' || card.taskStatus === 'assigned' || card.taskStatus === 'active') && (
        <button
          onClick={async () => { await window.api.orchestratorCancelTask(card.taskId); onRefresh() }}
          className="text-[length:var(--penny-task-fs-9)] text-red-400/60 hover:text-red-400 transition-colors"
        >
          Cancel
        </button>
      )}
      {card.taskStatus === 'failed' && (
        <button
          onClick={async () => { await window.api.orchestratorRetryTask(card.taskId); onRefresh() }}
          className="text-[length:var(--penny-task-fs-9)] text-blue-400/60 hover:text-blue-400 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[length:var(--penny-task-fs-12)] rounded-md transition-all duration-150 ${
        active
          ? 'bg-[var(--c-border)] text-[var(--c-text-primary)]'
          : 'text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] hover:bg-[var(--c-bg-elevated)]'
      }`}
    >
      {children}
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(timestamp: number | string): string {
  const ts = typeof timestamp === 'number' ? timestamp : Number(new Date(timestamp))
  if (!Number.isFinite(ts) || ts <= 0) return 'unknown'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function getIpcError(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error
  }
  return null
}

function isOrchestratorStats(value: unknown): value is OrchestratorStats {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'queueDepth' in value &&
    'activeTasks' in value &&
    'completedToday' in value &&
    'failedToday' in value &&
    'totalProcessed' in value,
  )
}

function isVeritasTaskCounts(value: unknown): value is VeritasTaskCounts {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'todo' in value &&
    'in-progress' in value &&
    'blocked' in value &&
    'done' in value,
  )
}

function isVeritasServiceStatus(value: unknown): value is VeritasServiceStatus {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'configured' in value &&
    'webUrl' in value &&
    'apiUrl' in value,
  )
}
