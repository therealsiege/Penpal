import { useState, useEffect } from 'react'
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
} from '../types'

// ── OrchestratorModal ───────────────────────────────────────────────────────

/** Standalone Tasks panel — GitHub Dispatch board with repo management. */
export function TasksPanel() {
  const [cards, setCards] = useState<GitHubIssueCard[]>([])
  const [repos, setRepos] = useState<{ owner: string; repo: string; localPath: string }[]>([])
  const [pollerRunning, setPollerRunning] = useState(false)
  const [showAddRepo, setShowAddRepo] = useState(false)

  async function refresh() {
    try {
      const [c, s, r] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
        window.api.githubListRepos(),
      ])
      if (Array.isArray(c)) setCards(c)
      if (s && typeof s.running === 'boolean') setPollerRunning(s.running)
      if (Array.isArray(r)) setRepos(r)
    } catch { /* */ }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  const columns = [
    { key: 'queued', label: 'Queued', statuses: ['queued'], dot: 'bg-slate-400' },
    { key: 'active', label: 'In Progress', statuses: ['assigned', 'active'], dot: 'bg-amber-400' },
    { key: 'done', label: 'Done', statuses: ['completed'], dot: 'bg-emerald-400' },
    { key: 'failed', label: 'Failed', statuses: ['failed', 'cancelled'], dot: 'bg-red-400' },
  ]

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00ff88]">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <h1 className="text-lg font-semibold">Tasks</h1>
            <span className="text-sm text-slate-500">{cards.length} issues</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              pollerRunning
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-500 border-slate-600/30'
            }`}>
              {pollerRunning ? 'Polling' : 'Stopped'}
            </span>
            <button
              onClick={async () => { await window.api.githubPollNow(); setTimeout(refresh, 1500) }}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition-colors"
            >
              Poll Now
            </button>
          </div>
        </div>

        {/* Watched repos */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">Watching:</span>
          {repos.map(r => (
            <span key={`${r.owner}/${r.repo}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300">
              {r.owner}/{r.repo}
              <button
                onClick={async () => { await window.api.githubRemoveRepo(r.owner, r.repo); refresh() }}
                className="text-slate-600 hover:text-red-400 text-[10px] leading-none ml-0.5"
                title="Stop watching"
              >
                x
              </button>
            </span>
          ))}
          <button
            onClick={() => setShowAddRepo(true)}
            className="px-2 py-0.5 text-xs rounded-md bg-[#0a2018] text-[#00ff88] border border-[#1a3a2a] hover:bg-[#0d2a20] transition-colors"
          >
            + Add Repo
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <p className="text-sm">No issues tracked yet</p>
            <p className="text-xs text-slate-600">Label issues with <code className="px-1.5 py-0.5 bg-slate-800 rounded text-[#00ff88]">agent-ready</code> to queue them</p>
          </div>
        ) : (
          <div className="flex gap-3 h-full min-w-max">
            {columns.map(col => {
              const colCards = cards.filter(c => col.statuses.includes(c.taskStatus))
              return (
                <div key={col.key} className="w-64 flex flex-col shrink-0">
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-medium text-slate-300">{col.label}</span>
                    <span className="text-xs text-slate-500 ml-auto">{colCards.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 px-1">
                    {colCards.map(card => (
                      <div
                        key={card.taskId}
                        className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 space-y-1.5 hover:border-slate-600/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={card.url}
                            onClick={e => { e.preventDefault(); window.open(card.url, '_blank') }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                          >
                            #{card.issueNumber}
                          </a>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            card.priority === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                            card.priority === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                            'bg-slate-500/20 text-slate-300 border-slate-500/30'
                          }`}>
                            {card.priority}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 leading-snug line-clamp-2">{card.title}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[120px]">{card.repo}</span>
                          <span>{tasksTimeAgo(card.ingestedAt)}</span>
                        </div>
                        {card.assignedAgent && (
                          <div className="text-[11px] text-[#00ff88]/70 truncate">{card.assignedAgent}</div>
                        )}
                        <div className="flex gap-1 pt-1">
                          {(card.taskStatus === 'queued' || card.taskStatus === 'assigned' || card.taskStatus === 'active') && (
                            <button
                              onClick={async () => { await window.api.orchestratorCancelTask(card.taskId); refresh() }}
                              className="text-[10px] text-red-400/60 hover:text-red-400"
                            >
                              Cancel
                            </button>
                          )}
                          {card.taskStatus === 'failed' && (
                            <button
                              onClick={async () => { await window.api.orchestratorRetryTask(card.taskId); refresh() }}
                              className="text-[10px] text-blue-400/60 hover:text-blue-400"
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

      {/* Add Repo Modal */}
      {showAddRepo && (
        <AddRepoModal
          onSubmit={async (owner, repo, localPath) => {
            await window.api.githubAddRepo(owner, repo, localPath)
            setShowAddRepo(false)
            refresh()
          }}
          onClose={() => setShowAddRepo(false)}
        />
      )}
    </div>
  )
}

function AddRepoModal({ onSubmit, onClose }: {
  onSubmit: (owner: string, repo: string, localPath: string) => void
  onClose: () => void
}) {
  const [repoUrl, setRepoUrl] = useState('')
  const [localPath, setLocalPath] = useState('')

  const parsed = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/) || repoUrl.match(/^([^/\s]+)\/([^/\s]+)$/)
  const owner = parsed?.[1] || ''
  const repo = parsed?.[2]?.replace(/\.git$/, '') || ''

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[440px] p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Watch Repository</h3>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Repository (URL or owner/repo)</label>
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="e.g. graphiteatlas/atlas or https://github.com/org/repo"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
          {owner && repo && (
            <p className="text-xs text-[#00ff88] mt-1">{owner}/{repo}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Local clone path (for agent cwd)</label>
          <input
            value={localPath}
            onChange={e => setLocalPath(e.target.value)}
            placeholder="e.g. ~/ComSci/Workspace/org/repo"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            onClick={() => { if (owner && repo && localPath.trim()) onSubmit(owner, repo, localPath.trim()) }}
            disabled={!owner || !repo || !localPath.trim()}
            className="px-4 py-2 text-sm bg-[#00ff88] hover:bg-[#00dd77] disabled:opacity-30 text-slate-900 font-medium rounded-lg"
          >
            Watch
          </button>
        </div>
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
  const [githubPollerRunning, setGithubPollerRunning] = useState(false)
  const [tab, setTab] = useState<'queue' | 'health' | 'veritas' | 'github'>('queue')
  const [showEnqueue, setShowEnqueue] = useState(false)
  const [showVeritasCreate, setShowVeritasCreate] = useState(false)
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

  async function loadGithubData() {
    try {
      const [cards, status] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
      ])
      if (Array.isArray(cards)) setGithubCards(cards)
      if (status && typeof status.running === 'boolean') setGithubPollerRunning(status.running)
    } catch { /* keep last known */ }
  }

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
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-100">Tasks</span>
          {tab !== 'veritas' && stats && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{stats.queueDepth} queued</span>
              <span>{stats.activeTasks} active</span>
              <span className="text-emerald-400">{stats.completedToday} done today</span>
              {stats.failedToday > 0 && (
                <span className="text-red-400">{stats.failedToday} failed</span>
              )}
            </div>
          )}
          {tab === 'github' && githubCards.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{githubCards.filter(c => c.taskStatus === 'queued').length} queued</span>
              <span>{githubCards.filter(c => c.taskStatus === 'active' || c.taskStatus === 'assigned').length} active</span>
              <span className="text-emerald-400">{githubCards.filter(c => c.taskStatus === 'completed').length} done</span>
              {githubCards.filter(c => c.taskStatus === 'failed').length > 0 && (
                <span className="text-red-400">{githubCards.filter(c => c.taskStatus === 'failed').length} failed</span>
              )}
            </div>
          )}
          {tab === 'veritas' && veritasCounts && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
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
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
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
              className="text-slate-500 hover:text-slate-300 text-xl leading-none"
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
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md"
          >
            + New Task
          </button>
        )}
        {tab === 'veritas' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void window.api.veritasOpen() }}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-md"
            >
              Open Board
            </button>
            <button
              onClick={() => setShowVeritasCreate(true)}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-md"
            >
              + New Veritas Task
            </button>
          </div>
        )}
        {tab === 'github' && (
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              githubPollerRunning
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-500 border-slate-600/30'
            }`}>
              {githubPollerRunning ? 'Polling' : 'Stopped'}
            </span>
            <button
              onClick={async () => {
                await window.api.githubPollNow()
                await loadGithubData()
              }}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-md"
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
    </>
  )
}

/** Modal version — still available for command palette / hotkey use. */
export function OrchestratorModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-fade-in"
      data-disable-office-hotkeys="true"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[900px] max-h-[84vh] flex flex-col shadow-2xl animate-modal-scale-in">
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
          <div key={n} className="animate-shimmer h-14 rounded-lg bg-slate-800/50 border border-slate-700/50" />
        ))}
        <div className="text-center text-slate-500 py-4 text-xs">
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
    cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }

  const priorityColors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    normal: 'text-slate-300',
    low: 'text-slate-500',
  }

  const age = formatAge(task.createdAt)
  const isActive = task.status === 'active' || task.status === 'assigned'
  const hasStages = task.stageResults && task.stageResults.length > 0

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-medium ${priorityColors[task.priority]}`}>
              {task.priority.toUpperCase()}
            </span>
            <span className="text-sm text-slate-200 truncate">{task.title}</span>
            {task.provider === 'ollama' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
                ollama
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
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

        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[task.status]}`}>
          {task.status}
        </span>
        <div className="flex items-center gap-1">
          {hasStages && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 py-1 text-[10px] bg-slate-700/50 text-slate-400 hover:bg-slate-700 rounded"
            >
              {expanded ? 'Hide' : 'Detail'}
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={async () => { await window.api.orchestratorRetryTask(task.id); onRefresh() }}
              className="px-2 py-1 text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded"
            >
              Retry
            </button>
          )}
          {(task.status === 'queued' || task.status === 'assigned' || task.status === 'active') && (
            <button
              onClick={async () => { await window.api.orchestratorCancelTask(task.id); onRefresh() }}
              className="px-2 py-1 text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Expanded stage detail */}
      {expanded && hasStages && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/30 pt-2 animate-fade-slide-down">
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
        const isOllama = result?.provider === 'ollama'

        let dotClass = 'bg-slate-600 text-slate-500'
        if (isDone) dotClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
        else if (isFailed) dotClass = 'bg-red-500/20 text-red-400 border-red-500/40'
        else if (isActive) dotClass = 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-breathe-glow'

        return (
          <div key={stage} className="flex items-center">
            {idx > 0 && <div className="w-2 h-px bg-slate-600 mx-0.5" />}
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${dotClass}`}
              title={result ? `${stage}: ${result.success ? 'PASS' : 'FAIL'} (${Math.round(result.durationMs / 1000)}s, ${result.provider})` : stage}
            >
              {STAGE_LABELS[stage]}
              {isOllama && <span className="ml-0.5 opacity-60">(o)</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StageResultRow({ result }: { result: StageResult }) {
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
          {STAGE_LABELS[result.stage] || result.stage}
        </span>
        <span className="text-slate-500">{Math.round(result.durationMs / 1000)}s</span>
        <span className={`px-1 rounded text-[9px] ${
          result.provider === 'ollama'
            ? 'bg-purple-600/20 text-purple-400'
            : 'bg-blue-600/20 text-blue-400'
        }`}>
          {result.provider}
        </span>
        <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>
          {result.success ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <pre className="text-slate-400 whitespace-pre-wrap text-[10px] max-h-24 overflow-y-auto bg-slate-900/50 rounded px-2 py-1">
        {result.output.slice(0, 500) || '(no output)'}
      </pre>
    </div>
  )
}

// ── Agent Health View ───────────────────────────────────────────────────────

function AgentHealthView({ health, onRefresh }: { health: AgentHealthStatus[]; onRefresh: () => void }) {
  if (health.length === 0) {
    return <div className="text-center text-slate-500 py-12">No agents configured.</div>
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
    dead: 'bg-slate-600',
  }[agent.status]

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
      <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200">{agent.name}</div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
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
          className="px-2 py-1 text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded"
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
      <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
        <div>
          <p className="text-sm text-slate-200">Veritas API</p>
          <p className="text-xs text-slate-500">
            {status?.apiUrl || 'Unknown URL'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={status?.running ? 'text-emerald-400' : 'text-slate-500'}>
            Service: {status?.running ? 'running' : 'stopped'}
          </span>
          <span className={status?.apiReachable ? 'text-emerald-400' : 'text-amber-400'}>
            API: {status?.apiReachable ? 'reachable' : 'not reachable'}
          </span>
          <button
            onClick={onRefresh}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-6 gap-2 text-xs">
          <VeritasCountCard label="Backlog" value={counts.backlog} />
          <VeritasCountCard label="Todo" value={counts.todo} />
          <VeritasCountCard label="In Progress" value={counts['in-progress']} />
          <VeritasCountCard label="Blocked" value={counts.blocked} />
          <VeritasCountCard label="Done" value={counts.done} />
          <VeritasCountCard label="Archived" value={counts.archived} />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading && tasks.length === 0 ? (
        <div className="text-center text-slate-500 py-12">Loading Veritas tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
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
    <div className="rounded border border-slate-700/40 bg-slate-800/30 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 font-semibold">{value}</p>
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
    todo: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    'in-progress': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    blocked: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  }

  const priorityColors: Record<VeritasTaskPriority, string> = {
    low: 'text-slate-400',
    medium: 'text-slate-200',
    high: 'text-orange-300',
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${priorityColors[task.priority]}`}>
            {task.priority.toUpperCase()}
          </span>
          <span className="text-sm text-slate-100 truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          <span>{formatAge(task.updated || task.created || '')}</span>
          <span>{task.id}</span>
          {task.project && <span>{task.project}</span>}
          {task.type && <span>{task.type}</span>}
          {task.blockedBy && task.blockedBy.length > 0 && (
            <span className="text-amber-300">{task.blockedBy.length} blocker(s)</span>
          )}
        </div>
      </div>

      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[task.status]}`}>
        {task.status}
      </span>

      <select
        value={task.status}
        onChange={e => { void onUpdateStatus(task.id, e.target.value as VeritasTaskStatus) }}
        disabled={updating}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
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
  const [project, setProject] = useState('')
  const [priority, setPriority] = useState('normal')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[480px] p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">New Task</h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Full task description (sent to the agent)"
          rows={4}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Project path (e.g. ~/sidekick)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim() || !description.trim() || !project.trim()) return
              onSubmit(title, description, project, priority)
            }}
            disabled={!title.trim() || !description.trim() || !project.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg"
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
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[520px] p-5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">New Veritas Task</h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={4}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
        />
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Project (optional)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as VeritasTaskPriority)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
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
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg"
          >
            {submitting ? 'Creating...' : 'Create in Veritas'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GitHub Kanban View ──────────────────────────────────────────────────

const KANBAN_COLUMNS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: 'queued', label: 'Queued', statuses: ['queued'], color: 'border-yellow-500/40' },
  { key: 'active', label: 'In Progress', statuses: ['assigned', 'active'], color: 'border-blue-500/40' },
  { key: 'done', label: 'Done', statuses: ['completed'], color: 'border-emerald-500/40' },
  { key: 'failed', label: 'Failed', statuses: ['failed', 'cancelled'], color: 'border-red-500/40' },
]

function GitHubKanbanView({ cards, onRefresh }: { cards: GitHubIssueCard[]; onRefresh: () => void }) {
  if (cards.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12 space-y-2">
        <p className="text-sm">No GitHub issues ingested yet.</p>
        <p className="text-xs">Label issues with <code className="px-1.5 py-0.5 bg-slate-800 rounded text-emerald-400">agent-ready</code> on GitHub to queue them.</p>
        <button
          onClick={async () => { await window.api.githubPollNow(); onRefresh() }}
          className="mt-3 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-md"
        >
          Poll Now
        </button>
      </div>
    )
  }

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    cards: cards.filter(c => col.statuses.includes(c.taskStatus)),
  }))

  return (
    <div className="grid grid-cols-4 gap-3 min-h-[300px]">
      {columns.map(col => (
        <div key={col.key} className={`rounded-lg border ${col.color} bg-slate-800/20 flex flex-col`}>
          <div className="px-3 py-2 border-b border-slate-700/30 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">{col.label}</span>
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
              {col.cards.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {col.cards.map(card => (
              <GitHubIssueCardItem key={card.taskId} card={card} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function GitHubIssueCardItem({ card, onRefresh }: { card: GitHubIssueCard; onRefresh: () => void }) {
  const priorityDot: Record<string, string> = {
    critical: 'bg-red-400',
    high: 'bg-orange-400',
    normal: 'bg-slate-400',
    low: 'bg-slate-600',
  }

  const stageLabel = card.taskStage && card.taskStage !== 'queued' && card.taskStage !== 'done'
    ? card.taskStage
    : null

  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-md p-2.5 space-y-1.5 hover:border-slate-600/60 transition-colors">
      <div className="flex items-start gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[card.priority] || 'bg-slate-400'}`} />
        <span className="text-xs text-slate-200 leading-tight line-clamp-2">{card.title}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <a
          href={card.url}
          onClick={(e) => { e.preventDefault(); void window.api.openDownloads() }}
          className="text-[10px] text-blue-400 hover:text-blue-300 font-mono"
          title={card.url}
        >
          #{card.issueNumber}
        </a>
        <span className="text-[10px] text-slate-600">{card.repo.split('/')[1]}</span>
        {stageLabel && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
            {stageLabel}
          </span>
        )}
        {card.assignedAgent && (
          <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={card.assignedAgent}>
            {card.assignedAgent}
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-600">{formatAge(card.ingestedAt)}</div>
      {(card.taskStatus === 'queued' || card.taskStatus === 'assigned' || card.taskStatus === 'active') && (
        <button
          onClick={async () => { await window.api.orchestratorCancelTask(card.taskId); onRefresh() }}
          className="text-[9px] text-red-400/60 hover:text-red-400 transition-colors"
        >
          Cancel
        </button>
      )}
      {card.taskStatus === 'failed' && (
        <button
          onClick={async () => { await window.api.orchestratorRetryTask(card.taskId); onRefresh() }}
          className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors"
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
      className={`px-3 py-1.5 text-xs rounded-md transition-all duration-150 ${
        active
          ? 'bg-slate-700 text-slate-100'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
