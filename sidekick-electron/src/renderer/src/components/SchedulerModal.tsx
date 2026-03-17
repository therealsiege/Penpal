import { useState, useEffect } from 'react'
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
  const { toast } = useToast()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRun = async (jobName: string) => {
    setRunning(jobName)
    try {
      const result = await window.api.runJob(jobName)
      toast(
        result.success ? `${jobName} completed in ${formatDuration(result.duration_ms)}` : `${jobName} failed`,
        result.success ? 'success' : 'error',
      )
      refresh()
      refreshHistory()
    } catch {
      toast(`Failed to start ${jobName}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const activeCount = jobs?.filter(j => j.enabled).length || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Scheduler</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400">
              {activeCount} ACTIVE
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {loading && <p className="text-slate-500 text-xs">Loading scheduler...</p>}

          {/* Jobs */}
          {jobs && jobs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Jobs</h3>
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 text-xs">
                      <th className="text-left px-3 py-2 font-medium">Job</th>
                      <th className="text-left px-3 py-2 font-medium">Schedule</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Last Run</th>
                      <th className="text-left px-3 py-2 font-medium">Next Run</th>
                      <th className="text-right px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => {
                      const status = !job.enabled ? 'none' as const
                        : job.last_success === null ? 'none' as const
                        : job.last_success ? 'ok' as const
                        : 'fail' as const
                      const statusLabel = !job.enabled ? 'Disabled'
                        : job.last_success === null ? 'Pending'
                        : job.last_success ? 'OK'
                        : 'Failed'

                      return (
                        <tr key={job.name} className="border-b border-slate-200/70 dark:border-slate-700/30 hover:bg-slate-200/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2.5">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{job.name}</div>
                            {job.description && (
                              <div className="text-xs text-slate-500">{job.description}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <code className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {job.cron}
                            </code>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={status} label={statusLabel} />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatTime(job.last_run)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatTime(job.next_run)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => handleRun(job.name)}
                              disabled={running !== null}
                              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                running === job.name
                                  ? 'bg-blue-600/20 border-blue-500/30 text-blue-500 dark:text-blue-400'
                                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                              }`}
                            >
                              {running === job.name ? 'Running...' : 'Run'}
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
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Recent Runs</h3>
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg overflow-hidden">
              {!history || history.length === 0 ? (
                <p className="text-xs text-slate-500 p-3">No runs recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700/30">
                  {history.slice(-10).reverse().map((run, i) => (
                    <div key={i}>
                      <div
                        className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800/30"
                        onClick={() => setExpandedRun(expandedRun === i ? null : i)}
                      >
                        <StatusBadge status={run.success ? 'ok' : 'fail'} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 w-28">{run.job}</span>
                        <span className="text-slate-500 text-xs">{formatTime(run.started_at)}</span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs">{formatDuration(run.duration_ms)}</span>
                        {!run.success && run.stderr_tail && expandedRun !== i && (
                          <span className="text-red-500 dark:text-red-400 text-xs truncate flex-1">{run.stderr_tail.split('\n')[0]}</span>
                        )}
                        <span className="text-slate-400 dark:text-slate-600 ml-auto text-xs">{expandedRun === i ? '\u25B2' : '\u25BC'}</span>
                      </div>
                      {expandedRun === i && (
                        <div className="px-3 pb-2.5">
                          {run.stdout_tail && (
                            <div className="mb-2">
                              <p className="text-xs text-slate-400 dark:text-slate-600 mb-1">stdout</p>
                              <pre className="text-xs text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-950 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
                                {run.stdout_tail}
                              </pre>
                            </div>
                          )}
                          {run.stderr_tail && (
                            <div>
                              <p className="text-xs text-slate-400 dark:text-slate-600 mb-1">stderr</p>
                              <pre className="text-xs text-red-500 dark:text-red-400/80 bg-slate-200 dark:bg-slate-950 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto font-mono leading-relaxed">
                                {run.stderr_tail}
                              </pre>
                            </div>
                          )}
                          {!run.stdout_tail && !run.stderr_tail && (
                            <p className="text-xs text-slate-400 dark:text-slate-600 italic">No output captured.</p>
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            {jobs ? `${jobs.length} jobs configured` : ''}
          </p>
          <button
            onClick={() => { refresh(); refreshHistory() }}
            className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
