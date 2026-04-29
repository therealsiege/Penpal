import { useState, useEffect, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from './StatusBadge'
import { useToast } from './Toast'
import type { JobStatus, JobRun } from '../types'

function formatTime(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Human-readable cron description for tooltip display.
 * Covers the common patterns used in schedule.yaml — falls back to the raw
 * expression for anything more exotic.
 */
function describeCron(expr: string): string {
  const map: Record<string, string> = {
    '* * * * *':    'Every minute',
    '*/5 * * * *':  'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *':    'Every hour',
    '0 */2 * * *':  'Every 2 hours',
    '0 */6 * * *':  'Every 6 hours',
    '0 6 * * *':    'Daily at 6 AM',
    '0 8 * * *':    'Daily at 8 AM',
    '0 9 * * *':    'Daily at 9 AM',
    '0 12 * * *':   'Daily at noon',
    '0 18 * * *':   'Daily at 6 PM',
    '0 0 * * *':    'Midnight daily',
    '0 0 * * 0':    'Weekly on Sunday',
    '0 0 1 * *':    'First of every month',
  }
  return map[expr.trim()] ?? expr
}

interface SchedulerModalProps {
  onClose: () => void
}

export function SchedulerModal({ onClose }: SchedulerModalProps) {
  const { data: jobs, loading, refresh } = usePolling<JobStatus[]>(
    () => window.api.getSchedulerStatus(),
    15000,
  )
  const { data: history, refresh: refreshHistory } = usePolling<JobRun[]>(
    () => window.api.getSchedulerHistory(),
    15000,
  )

  const [running, setRunning] = useState<string | null>(null)
  const [expandedRun, setExpandedRun] = useState<number | null>(null)
  // Map of jobName -> 'success' | 'fail' — cleared after the flash CSS duration
  const [flashMap, setFlashMap] = useState<Record<string, 'success' | 'fail'>>({})
  // Tooltip state: jobName whose cron cell is being hovered
  const [hoveredCron, setHoveredCron] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const flashCard = useCallback((jobName: string, outcome: 'success' | 'fail') => {
    setFlashMap(prev => ({ ...prev, [jobName]: outcome }))
    setTimeout(() => {
      setFlashMap(prev => {
        const next = { ...prev }
        delete next[jobName]
        return next
      })
    }, 1200)
  }, [])

  const handleRun = async (jobName: string) => {
    setRunning(jobName)
    try {
      const result = await window.api.runJob(jobName)
      const outcome = result.success ? 'success' : 'fail'
      flashCard(jobName, outcome)
      toast(
        result.success
          ? `${jobName} completed in ${formatDuration(result.duration_ms)}`
          : `${jobName} failed`,
        result.success ? 'success' : 'error',
      )
      refresh()
      refreshHistory()
    } catch {
      flashCard(jobName, 'fail')
      toast(`Failed to start ${jobName}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const activeCount = jobs?.filter(j => j.enabled).length || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col animate-modal-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-white">Scheduler</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
              {activeCount} ACTIVE
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-border-hover)] hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {loading && <p className="text-[var(--c-border-hover)] text-xs">Loading scheduler...</p>}

          {/* Jobs */}
          {jobs && jobs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-[var(--c-border-hover)] uppercase tracking-wider mb-2">Jobs</h3>
              <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] text-[var(--c-border-hover)] text-xs">
                      <th className="text-left px-3 py-2 font-medium">Job</th>
                      <th className="text-left px-3 py-2 font-medium">Schedule</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Last Run</th>
                      <th className="text-left px-3 py-2 font-medium">Next Run</th>
                      <th className="text-right px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job, idx) => {
                      const isRunningNow = running === job.name
                      const flash = flashMap[job.name]

                      const status = !job.enabled ? 'none' as const
                        : job.last_success === null ? 'none' as const
                        : job.last_success ? 'ok' as const
                        : 'fail' as const
                      const statusLabel = !job.enabled ? 'Disabled'
                        : job.last_success === null ? 'Pending'
                        : job.last_success ? 'OK'
                        : 'Failed'

                      // Flash overlay: green for success, red for fail, fading out
                      const flashClass = flash === 'success'
                        ? 'ring-1 ring-emerald-400/60 bg-emerald-500/5 transition-all duration-[1200ms]'
                        : flash === 'fail'
                          ? 'ring-1 ring-red-400/60 bg-red-500/5 transition-all duration-[1200ms]'
                          : ''

                      return (
                        <tr
                          key={job.name}
                          className={`stagger-item border-b border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] transition-colors duration-150 ${flashClass}`}
                          style={{ animationDelay: `${idx * 0.04}s` }}
                        >
                          {/* Job name + description */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isRunningNow && (
                                <svg
                                  className="w-3 h-3 text-blue-400 animate-spin-smooth shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  aria-label="Running"
                                >
                                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                              )}
                              <div>
                                <div className="text-xs font-medium text-[var(--c-text-primary)]">{job.name}</div>
                                {job.description && (
                                  <div className="text-xs text-[var(--c-border-hover)]">{job.description}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Cron schedule with tooltip */}
                          <td className="px-3 py-2.5">
                            <div
                              className="relative inline-block"
                              onMouseEnter={() => setHoveredCron(job.name)}
                              onMouseLeave={() => setHoveredCron(null)}
                            >
                              <code className="text-xs text-[var(--c-text-muted)] bg-[var(--c-bg-elevated)] px-1.5 py-0.5 rounded cursor-default select-none">
                                {job.cron}
                              </code>
                              {hoveredCron === job.name && (
                                <div className="absolute bottom-full left-0 mb-1.5 z-10 animate-fade-slide-down">
                                  <div className="bg-[var(--c-bg-app)] border border-[var(--c-border)] text-[var(--c-text-primary)] text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                    {describeCron(job.cron)}
                                  </div>
                                  {/* Arrow */}
                                  <div className="w-2 h-2 bg-[var(--c-bg-app)] border-r border-b border-[var(--c-border)] rotate-45 ml-2 -mt-1" />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status dot — breathe glow when running */}
                          <td className="px-3 py-2.5">
                            <div className={isRunningNow ? 'animate-breathe-glow rounded-full inline-block' : ''}>
                              <StatusBadge status={status} label={statusLabel} />
                            </div>
                          </td>

                          {/* Timestamps with smooth transition */}
                          <td className="px-3 py-2.5 text-xs text-[var(--c-text-muted)] transition-all duration-200">
                            {formatTime(job.last_run)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-[var(--c-text-muted)] transition-all duration-200">
                            {formatTime(job.next_run)}
                          </td>

                          {/* Run button */}
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => handleRun(job.name)}
                              disabled={running !== null}
                              className={`px-2 py-0.5 text-xs rounded border transition-all duration-100 hover:scale-[1.02] active:scale-[0.98] ${
                                isRunningNow
                                  ? 'bg-blue-600/20 border-blue-500/30 text-blue-400 cursor-not-allowed'
                                  : running !== null
                                    ? 'bg-[var(--c-bg-elevated)] border-[var(--c-border)] text-[var(--c-border-hover)] cursor-not-allowed'
                                    : 'bg-[var(--c-bg-elevated)] border-[var(--c-border)] text-[var(--c-text-secondary)] hover:bg-[var(--c-border)]'
                              }`}
                            >
                              {isRunningNow ? 'Running...' : 'Run'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Runs */}
          <div>
            <h3 className="text-xs font-medium text-[var(--c-border-hover)] uppercase tracking-wider mb-2">Recent Runs</h3>
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg overflow-hidden">
              {!history || history.length === 0 ? (
                <p className="text-xs text-[var(--c-border-hover)] p-3">No runs recorded yet.</p>
              ) : (
                <div className="divide-y divide-[color-mix(in_srgb,var(--c-border)_30%,transparent)]">
                  {history.slice(-10).reverse().map((run, i) => (
                    <div key={i} className="stagger-item" style={{ animationDelay: `${i * 0.03}s` }}>
                      <div
                        className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)]"
                        onClick={() => setExpandedRun(expandedRun === i ? null : i)}
                      >
                        <StatusBadge status={run.success ? 'ok' : 'fail'} />
                        <span className="font-medium text-[var(--c-text-secondary)] w-28">{run.job}</span>
                        <span className="text-[var(--c-border-hover)] text-xs transition-all duration-200">{formatTime(run.started_at)}</span>
                        <span className="text-[var(--c-border)] text-xs">{formatDuration(run.duration_ms)}</span>
                        {!run.success && run.stderr_tail && expandedRun !== i && (
                          <span className="text-red-400 text-xs truncate flex-1">{run.stderr_tail.split('\n')[0]}</span>
                        )}
                        <span className="text-[var(--c-border)] ml-auto text-xs">{expandedRun === i ? '\u25B2' : '\u25BC'}</span>
                      </div>
                      {expandedRun === i && (
                        <div className="px-3 pb-2.5 animate-fade-slide-down">
                          {run.stdout_tail && (
                            <div className="mb-2">
                              <p className="text-xs text-[var(--c-border)] mb-1">stdout</p>
                              <pre className="text-xs text-[var(--c-text-muted)] bg-[var(--c-bg-app)] rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
                                {run.stdout_tail}
                              </pre>
                            </div>
                          )}
                          {run.stderr_tail && (
                            <div>
                              <p className="text-xs text-[var(--c-border)] mb-1">stderr</p>
                              <pre className="text-xs text-red-400/80 bg-[var(--c-bg-app)] rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto font-mono leading-relaxed">
                                {run.stderr_tail}
                              </pre>
                            </div>
                          )}
                          {!run.stdout_tail && !run.stderr_tail && (
                            <p className="text-xs text-[var(--c-border)] italic">No output captured.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--c-border)]">
          <p className="text-xs text-[var(--c-border)]">
            {jobs ? `${jobs.length} jobs configured` : ''}
          </p>
          <button
            onClick={() => { refresh(); refreshHistory() }}
            className="px-3 py-1 text-xs bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] rounded border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-all duration-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
