import { useState, useEffect, useCallback } from 'react'
import { PanelBackground } from '../components/PanelBackground'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScheduledTask {
  id: string
  title: string
  description: string
  project: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastResult?: string
}

interface AddTaskForm {
  title: string
  cronExpression: string
  description: string
  project: string
  enabled: boolean
}

const EMPTY_FORM: AddTaskForm = {
  title: '',
  cronExpression: '',
  description: '',
  project: '',
  enabled: true,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const past = diff >= 0
  const mins = Math.floor(abs / 60_000)
  const hours = Math.floor(abs / 3_600_000)
  const days = Math.floor(abs / 86_400_000)
  let label: string
  if (abs < 60_000) label = 'just now'
  else if (mins < 60) label = `${mins}m`
  else if (hours < 24) label = `${hours}h`
  else label = `${days}d`
  if (abs < 60_000) return label
  return past ? `${label} ago` : `in ${label}`
}

function truncate(s: string | undefined, max = 80): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        running
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 'bg-[var(--c-bg-elevated)] text-[var(--c-text-muted)] border-[var(--c-border)]'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : 'bg-[var(--c-text-faint)]'}`}
      />
      {running ? 'Running' : 'Stopped'}
    </span>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-app)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-[#00a868]' : 'bg-[var(--c-border)]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
  )
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: ScheduledTask
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] hover:border-[color-mix(in_srgb,var(--c-border)_150%,transparent)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.9rem] font-semibold text-[var(--c-text-primary)] truncate">{task.title}</span>
            <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)] border border-[color-mix(in_srgb,var(--c-border)_80%,transparent)]">
              {task.cronExpression}
            </code>
            {task.project && (
              <span className="text-[10px] text-[var(--c-text-faint)] font-mono">{task.project}</span>
            )}
          </div>
          {task.description && (
            <p className="text-[0.8rem] text-[var(--c-text-muted)] mt-0.5 leading-snug">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ToggleSwitch
            checked={task.enabled}
            onChange={(v) => onToggle(task.id, v)}
            label={`Toggle ${task.title}`}
          />
          <button
            type="button"
            onClick={() => onRemove(task.id)}
            title="Remove task"
            className="p-1.5 rounded-lg text-[var(--c-text-faint)] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-[var(--c-text-faint)] font-mono flex-wrap">
        <span>last: <span className="text-[var(--c-text-muted)]">{formatRelative(task.lastRunAt)}</span></span>
        <span>next: <span className="text-[var(--c-text-muted)]">{formatRelative(task.nextRunAt)}</span></span>
        {task.lastResult && (
          <span className="text-[var(--c-text-faint)] italic">{truncate(task.lastResult)}</span>
        )}
      </div>
    </div>
  )
}

function AddTaskForm({
  onAdd,
  onCancel,
}: {
  onAdd: (form: AddTaskForm) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<AddTaskForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[0.9rem] text-[var(--c-text-primary)] placeholder-[var(--c-text-faint)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] transition-colors'

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.cronExpression.trim()) { setError('Cron expression is required'); return }
    if (!form.project.trim()) { setError('Project is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(form)
    } catch (e) {
      setError((e as Error).message || 'Failed to add task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 p-4 rounded-xl border border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--c-accent)_4%,transparent)]">
      <p className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--c-text-muted)]">New Scheduled Task</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[0.8rem] text-[var(--c-text-muted)] mb-1 block">Name</label>
          <input
            className={inputCls}
            placeholder="e.g. Daily standup brief"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[0.8rem] text-[var(--c-text-muted)] mb-1 block">Cron expression</label>
          <input
            className={inputCls}
            placeholder="daily, hourly, 0 9 * * *"
            value={form.cronExpression}
            onChange={e => setForm(f => ({ ...f, cronExpression: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[0.8rem] text-[var(--c-text-muted)] mb-1 block">Project</label>
          <input
            className={inputCls}
            placeholder="e.g. medscrub"
            value={form.project}
            onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <label className="text-[0.8rem] text-[var(--c-text-muted)] mb-1 block">Description</label>
          <input
            className={inputCls}
            placeholder="What should the agent do?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <ToggleSwitch
            checked={form.enabled}
            onChange={v => setForm(f => ({ ...f, enabled: v }))}
            label="Enable on creation"
          />
          <span className="text-[0.85rem] text-[var(--c-text-muted)]">Enable immediately</span>
        </div>
      </div>

      {error && (
        <p className="text-[0.8rem] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-[0.875rem] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="px-4 py-1.5 text-[0.875rem] bg-[var(--c-accent)] hover:bg-[#00cc6e] disabled:opacity-40 text-[var(--c-bg-chrome)] font-semibold rounded-lg transition-colors"
        >
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function AutopilotPanel() {
  const [running, setRunning] = useState(false)
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [status, list] = await Promise.all([
        window.api.autopilotStatus(),
        window.api.autopilotList(),
      ])
      const s = status as { enabled?: boolean }
      const l = list as { enabled?: boolean; schedules?: ScheduledTask[] }
      setRunning(s.enabled ?? false)
      setTasks(l.schedules ?? [])
      setError(null)
    } catch (e) {
      setError((e as Error).message || 'Failed to load autopilot state')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const handleStartStop = async () => {
    setToggling(true)
    try {
      if (running) {
        await window.api.autopilotStop()
      } else {
        await window.api.autopilotStart()
      }
      await refresh()
    } catch (e) {
      setError((e as Error).message || 'Action failed')
    } finally {
      setToggling(false)
    }
  }

  const handleToggleTask = async (id: string, enabled: boolean) => {
    try {
      await window.api.autopilotToggle(id, enabled)
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, enabled } : t)))
    } catch (e) {
      setError((e as Error).message || 'Toggle failed')
    }
  }

  const handleRemoveTask = async (id: string) => {
    try {
      await window.api.autopilotRemove(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError((e as Error).message || 'Remove failed')
    }
  }

  const handleAddTask = async (form: AddTaskForm) => {
    const result = await window.api.autopilotAdd({
      title: form.title,
      description: form.description,
      project: form.project,
      cronExpression: form.cronExpression,
    }) as { error?: string } & ScheduledTask
    if (result?.error) throw new Error(result.error)
    setShowAddForm(false)
    await refresh()
  }

  return (
    <PanelBackground>
      <div className="h-full overflow-y-auto relative z-[1]">
        <div className="max-w-2xl mx-auto py-8 px-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[1.35rem] font-semibold text-[var(--c-text-heading)]">Autopilot</h1>
              <p className="text-[0.85rem] text-[var(--c-text-muted)] mt-0.5">Scheduled recurring tasks</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge running={running} />
              <button
                type="button"
                disabled={toggling || loading}
                onClick={handleStartStop}
                className={[
                  'px-4 py-1.5 text-[0.875rem] font-semibold rounded-lg border transition-colors disabled:opacity-40',
                  running
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                    : 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] border-[color-mix(in_srgb,var(--c-accent)_28%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_20%,transparent)]',
                ].join(' ')}
              >
                {toggling ? '…' : running ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[0.875rem] text-red-400">
              {error}
            </div>
          )}

          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--c-text-muted)]">
                Scheduled Tasks
                {tasks.length > 0 && (
                  <span className="ml-2 text-[var(--c-text-faint)] normal-case font-normal tracking-normal">
                    ({tasks.filter(t => t.enabled).length}/{tasks.length} enabled)
                  </span>
                )}
              </h2>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-3 py-1.5 text-[0.8rem] rounded-lg bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)] border border-[var(--c-border)] hover:bg-[var(--c-bg-hover)] transition-colors"
                >
                  + Add Task
                </button>
              )}
            </div>

            {showAddForm && (
              <div className="mb-3">
                <AddTaskForm
                  onAdd={handleAddTask}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="w-6 h-6 rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-accent)] animate-spin"
                  role="status"
                  aria-label="Loading"
                />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <svg className="w-10 h-10 text-[var(--c-text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-[0.9rem] text-[var(--c-text-secondary)]">No scheduled tasks</p>
                <p className="text-[0.8rem] text-[var(--c-text-faint)]">Add a task to start automating recurring work</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onRemove={handleRemoveTask}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--c-text-muted)] mb-3">Schedule Reference</h2>
            <div className="bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-xl border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] p-4">
              <table className="w-full text-[0.8rem]">
                <thead>
                  <tr className="text-[var(--c-text-muted)] text-left">
                    <th className="pb-2 font-semibold pr-6">Expression</th>
                    <th className="pb-2 font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--c-text-secondary)] space-y-1">
                  {[
                    ['hourly', 'Run once per hour'],
                    ['daily', 'Run at midnight UTC each day'],
                    ['weekly', 'Run on Monday at midnight UTC'],
                    ['0 9 * * *', 'Run daily at 09:00 UTC'],
                    ['30 14 * * *', 'Run daily at 14:30 UTC'],
                  ].map(([expr, desc]) => (
                    <tr key={expr} className="border-t border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
                      <td className="py-1.5 pr-6 font-mono text-[var(--c-accent-blue)]">{expr}</td>
                      <td className="py-1.5 text-[var(--c-text-muted)]">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </PanelBackground>
  )
}
