import { useState, useEffect } from 'react'
import type { Task, AgentHealthStatus, OrchestratorStats } from '../types'

// ── OrchestratorModal ───────────────────────────────────────────────────────

export function OrchestratorModal({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<AgentHealthStatus[]>([])
  const [stats, setStats] = useState<OrchestratorStats | null>(null)
  const [tab, setTab] = useState<'queue' | 'health'>('queue')
  const [showEnqueue, setShowEnqueue] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [q, h, s] = await Promise.all([
        window.api.orchestratorQueue(),
        window.api.orchestratorAgentHealth(),
        window.api.orchestratorStats(),
      ])
      setTasks(q)
      setHealth(h)
      setStats(s)
    } catch { /* */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-100">Orchestrator</span>
            {stats && (
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{stats.queueDepth} queued</span>
                <span>{stats.activeTasks} active</span>
                <span className="text-emerald-400">{stats.completedToday} done today</span>
                {stats.failedToday > 0 && (
                  <span className="text-red-400">{stats.failedToday} failed</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          >
            x
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>Task Queue</TabButton>
          <TabButton active={tab === 'health'} onClick={() => setTab('health')}>Agent Health</TabButton>
          <div className="flex-1" />
          {tab === 'queue' && (
            <button
              onClick={() => setShowEnqueue(true)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md"
            >
              + New Task
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {tab === 'queue' ? (
            <TaskQueueView tasks={tasks} onRefresh={loadData} />
          ) : (
            <AgentHealthView health={health} onRefresh={loadData} />
          )}
        </div>

        {/* Enqueue Modal */}
        {showEnqueue && (
          <EnqueueModal
            onSubmit={async (title, description, project, priority) => {
              await window.api.orchestratorEnqueue(title, description, project, priority)
              setShowEnqueue(false)
              loadData()
            }}
            onClose={() => setShowEnqueue(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Task Queue View ─────────────────────────────────────────────────────────

function TaskQueueView({ tasks, onRefresh }: { tasks: Task[]; onRefresh: () => void }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">
        No tasks in queue. Create one with the + button or use <code>!task</code> in Slack.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <TaskRow key={task.id} task={task} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

function TaskRow({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
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

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${priorityColors[task.priority]}`}>
            {task.priority.toUpperCase()}
          </span>
          <span className="text-sm text-slate-200 truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          <span>{age}</span>
          <span>via {task.source}</span>
          {task.assignedAgent && <span>{'-> '}{task.assignedAgent}</span>}
          {task.error && <span className="text-red-400 truncate">{task.error}</span>}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[task.status]}`}>
        {task.status}
      </span>
      <div className="flex items-center gap-1">
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
        <AgentHealthRow key={agent.agentId} agent={agent} onRefresh={onRefresh} />
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
          placeholder="Project path (e.g. /Users/fuzeelogik/sidekick)"
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

// ── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
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

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
