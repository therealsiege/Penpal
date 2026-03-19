import { useState, useEffect } from 'react'
import type { TripletWorkflow, TripletPreset, TripletStatus, AgentConfig } from '../types'
import { usePolling } from '../hooks/usePolling'

// ── Status helpers ──────────────────────────────────────────────────────────

function statusColor(status: TripletStatus): string {
  switch (status) {
    case 'pending': return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
    case 'solving': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    case 'reviewing': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    case 'executing': return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    case 'feedback': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    case 'complete': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20'
    case 'paused': return 'text-violet-400 bg-violet-500/10 border-violet-500/20'
  }
}

function roleStatusDot(status: string): string {
  switch (status) {
    case 'active': return 'bg-emerald-400 animate-pulse'
    case 'complete': return 'bg-emerald-400'
    case 'failed': return 'bg-red-400'
    default: return 'bg-slate-500'
  }
}

function roleIcon(role: 'solver' | 'reviewer' | 'executor'): string {
  switch (role) {
    case 'solver': return '\u{1F527}'    // wrench
    case 'reviewer': return '\u{1F50D}'  // magnifying glass
    case 'executor': return '\u{25B6}'   // play
  }
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

// ── Triplet Launcher ────────────────────────────────────────────────────────

export function TripletLauncherModal({
  presets,
  agents,
  onLaunch,
  onClose,
}: {
  presets: TripletPreset[]
  agents: AgentConfig[]
  onLaunch: (task: string, opts: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [task, setTask] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0]?.id || '')
  const [maxIterations, setMaxIterations] = useState(3)
  const [customSolver, setCustomSolver] = useState('')
  const [customReviewer, setCustomReviewer] = useState('')
  const [customExecutor, setCustomExecutor] = useState('')
  const [cwd, setCwd] = useState('')
  const [customCwd, setCustomCwd] = useState('')

  const preset = presets.find(p => p.id === selectedPreset)

  // Resolve available repos from the selected solver agent
  const solverAgent = agents.find(a => a.id === (customSolver || preset?.solver))
  const availableRepos = solverAgent?.defaultRepos ?? []

  // Auto-select first repo if cwd not set
  useEffect(() => {
    if (!cwd && availableRepos.length > 0) {
      setCwd(availableRepos[0])
    }
  }, [availableRepos, cwd])

  const effectiveCwd = customCwd || cwd

  const handleLaunch = () => {
    if (!task.trim() || !effectiveCwd) return
    onLaunch(task.trim(), {
      cwd: effectiveCwd,
      presetId: selectedPreset || undefined,
      maxIterations,
      solverAgent: customSolver || undefined,
      reviewerAgent: customReviewer || undefined,
      executorAgent: customExecutor || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[560px] shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-white">Launch Triplet Workflow</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">Solver + Reviewer + Executor</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">x</button>
        </div>

        {/* Preset selector */}
        <div className="mb-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Team Preset</p>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                className={`px-3 py-1.5 text-[12px] rounded-md border transition-colors ${
                  selectedPreset === p.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.id.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          {preset && (
            <p className="text-[11px] text-slate-500 mt-1.5">{preset.description}</p>
          )}
        </div>

        {/* Team visualization */}
        {preset && (
          <div className="mb-4 bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 text-center">
                <p className="text-[10px] text-slate-500 uppercase">{roleIcon('solver')} Solver</p>
                <select
                  value={customSolver || preset.solver}
                  onChange={e => setCustomSolver(e.target.value === preset.solver ? '' : e.target.value)}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <span className="text-slate-600 text-lg mt-3">&rarr;</span>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-slate-500 uppercase">{roleIcon('reviewer')} Reviewer</p>
                <select
                  value={customReviewer || preset.reviewer}
                  onChange={e => setCustomReviewer(e.target.value === preset.reviewer ? '' : e.target.value)}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <span className="text-slate-600 text-lg mt-3">&rarr;</span>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-slate-500 uppercase">{roleIcon('executor')} Executor</p>
                <select
                  value={customExecutor || preset.executor}
                  onChange={e => setCustomExecutor(e.target.value === preset.executor ? '' : e.target.value)}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Working directory */}
        <div className="mb-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Working Directory</p>
          {availableRepos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {availableRepos.map(r => (
                <button
                  key={r}
                  onClick={() => { setCwd(r); setCustomCwd('') }}
                  className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                    cwd === r && !customCwd
                      ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.split('/').pop()}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-[11px] font-mono min-h-[28px] flex items-center">
              {effectiveCwd ? (
                <span className="text-slate-200 truncate">{effectiveCwd}</span>
              ) : (
                <span className="text-slate-600">No directory selected</span>
              )}
            </div>
            <button
              onClick={async () => {
                const picked = await window.api.pickDirectory()
                if (picked) {
                  setCustomCwd(picked)
                  setCwd(picked)
                }
              }}
              className="flex-none px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-300 transition-colors font-medium"
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Task input */}
        <div className="mb-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Task Description</p>
          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Describe what to build..."
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 font-mono resize-none"
          />
        </div>

        {/* Max iterations */}
        <div className="mb-4 flex items-center gap-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider">Max Iterations</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setMaxIterations(n)}
                className={`w-8 h-8 text-[12px] rounded border transition-colors ${
                  maxIterations === n
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!task.trim() || !effectiveCwd}
            className="px-4 py-1.5 text-[12px] bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors disabled:opacity-40 font-semibold"
          >
            Launch Triplet
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Triplet Status Modal ────────────────────────────────────────────────────

export function TripletStatusModal({
  workflow: initialWorkflow,
  onPause,
  onResume,
  onCancel,
  onClose,
}: {
  workflow: TripletWorkflow
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onClose: () => void
}) {
  // Poll for live updates
  const { data: liveWorkflow } = usePolling<TripletWorkflow | null>(
    () => window.api.getTripletStatus(initialWorkflow.id),
    2000,
  )
  const wf = liveWorkflow ?? initialWorkflow

  const isActive = !['complete', 'failed'].includes(wf.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[680px] shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-white">{wf.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${statusColor(wf.status)}`}>
                {wf.status}
              </span>
              <span className="text-[11px] text-slate-500">
                Iteration {wf.iteration}/{wf.maxIterations}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">x</button>
        </div>

        {/* Task + cwd */}
        <div className="bg-slate-800/30 rounded-lg px-3 py-2 mb-4 border border-slate-700/30">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Task</p>
          <p className="text-[12px] text-slate-300">{wf.task}</p>
          <p className="text-[10px] text-slate-600 font-mono mt-1">{wf.cwd}</p>
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Solver */}
          <RoleColumn
            role="solver"
            label="Solver"
            agentId={wf.solver.agentId}
            status={wf.solver.status}
            output={wf.solver.output}
            isCurrentStage={wf.status === 'solving' || wf.status === 'feedback'}
          />
          {/* Reviewer */}
          <RoleColumn
            role="reviewer"
            label="Reviewer"
            agentId={wf.reviewer.agentId}
            status={wf.reviewer.status}
            output={wf.reviewer.output}
            isCurrentStage={wf.status === 'reviewing'}
          />
          {/* Executor */}
          <RoleColumn
            role="executor"
            label="Executor"
            agentId={wf.executor.agentId}
            status={wf.executor.status}
            output={wf.executor.output}
            isCurrentStage={wf.status === 'executing'}
          />
        </div>

        {/* Timeline */}
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Timeline</p>
          <div className="flex flex-col gap-1">
            {wf.stageHistory.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 font-mono w-16">{formatTime(entry.enteredAt)}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded border ${statusColor(entry.stage)}`}>
                  {entry.stage}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {wf.error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 mb-4">
            <p className="text-[11px] text-red-400">{wf.error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 justify-end">
          {isActive && wf.status !== 'paused' && (
            <button
              onClick={() => onPause(wf.id)}
              className="px-3 py-1.5 text-[12px] bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-md text-amber-400 transition-colors"
            >
              Pause
            </button>
          )}
          {wf.status === 'paused' && (
            <button
              onClick={() => onResume(wf.id)}
              className="px-3 py-1.5 text-[12px] bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-emerald-400 transition-colors"
            >
              Resume
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onCancel(wf.id)}
              className="px-3 py-1.5 text-[12px] bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-md text-red-400 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Role Column ─────────────────────────────────────────────────────────────

function RoleColumn({
  role,
  label,
  agentId,
  status,
  output,
  isCurrentStage,
}: {
  role: 'solver' | 'reviewer' | 'executor'
  label: string
  agentId: string
  status: string
  output?: string
  isCurrentStage: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-lg border p-3 transition-all ${
      isCurrentStage
        ? 'border-blue-500/40 bg-blue-900/10'
        : 'border-slate-700/30 bg-slate-800/20'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{roleIcon(role)}</span>
        <span className="text-[11px] font-semibold text-slate-300 uppercase">{label}</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${roleStatusDot(status)}`} />
      </div>

      {/* Agent name */}
      <p className="text-[11px] text-slate-500 mb-1">{agentId}</p>

      {/* Status */}
      <p className="text-[10px] text-slate-600 uppercase mb-2">{status}</p>

      {/* Output preview */}
      {output && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? 'Collapse' : 'View Output'}
          </button>
          {expanded && (
            <div className="mt-1 bg-slate-950 rounded px-2 py-1.5 max-h-32 overflow-y-auto">
              <pre className="text-[10px] text-slate-400 whitespace-pre-wrap break-words font-mono">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Triplet List Modal ──────────────────────────────────────────────────────

export function TripletListModal({
  onSelect,
  onClose,
}: {
  onSelect: (wf: TripletWorkflow) => void
  onClose: () => void
}) {
  const { data: workflows } = usePolling<TripletWorkflow[]>(
    () => window.api.listTriplets(),
    3000,
  )

  const list = workflows ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[520px] shadow-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-white">Triplet Workflows</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">x</button>
        </div>

        {list.length === 0 ? (
          <p className="text-[12px] text-slate-500 text-center py-8">No workflows yet. Launch one to get started.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map(wf => (
              <button
                key={wf.id}
                onClick={() => onSelect(wf)}
                className="text-left p-3 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-slate-600 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${statusColor(wf.status)}`}>
                    {wf.status}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-200 truncate flex-1">{wf.name}</span>
                  <span className="text-[10px] text-slate-600">
                    {wf.iteration}/{wf.maxIterations}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 truncate">{wf.task}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600">
                  <span>{roleIcon('solver')} {wf.solver.agentId}</span>
                  <span>{roleIcon('reviewer')} {wf.reviewer.agentId}</span>
                  <span>{roleIcon('executor')} {wf.executor.agentId}</span>
                </div>
                {wf.cwd && (
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
                    {wf.cwd.split('/').slice(-2).join('/')}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
