import { useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
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

export function SchedulerPanel() {
  const { data: jobs, loading, refresh } = usePolling<JobStatus[]>(
    () => window.api.getSchedulerStatus(),
    15000,
  )
  const { data: history, refresh: refreshHistory } = usePolling<JobRun[]>(
    () => window.api.getSchedulerHistory(),
    15000,
  )

  const [running, setRunning] = useState<string | null>(null)

  const handleRun = async (jobName: string) => {
    setRunning(jobName)
    try {
      await window.api.runJob(jobName)
      refresh()
      refreshHistory()
    } finally {
      setRunning(null)
    }
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading scheduler...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Scheduler</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {jobs?.filter(j => j.enabled).length || 0} active jobs
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Jobs table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-xs">
              <th className="text-left px-4 py-2.5 font-medium">Job</th>
              <th className="text-left px-4 py-2.5 font-medium">Schedule</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Last Run</th>
              <th className="text-left px-4 py-2.5 font-medium">Next Run</th>
              <th className="text-right px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs?.map(job => {
              const status = !job.enabled ? 'none' as const
                : job.last_success === null ? 'none' as const
                : job.last_success ? 'ok' as const
                : 'fail' as const
              const statusLabel = !job.enabled ? 'Disabled'
                : job.last_success === null ? 'Pending'
                : job.last_success ? 'OK'
                : 'Failed'

              return (
                <tr key={job.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{job.name}</div>
                    <div className="text-[11px] text-slate-500">{job.description}</div>
                    {job.depends_on.length > 0 && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        depends on: {job.depends_on.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {job.cron}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} label={statusLabel} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatTime(job.last_run)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatTime(job.next_run)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRun(job.name)}
                      disabled={running !== null}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        running === job.name
                          ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
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

      {/* Recent runs */}
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Recent Runs</h3>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {!history || history.length === 0 ? (
          <p className="text-xs text-slate-500 p-4">No runs recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {history.slice(-10).reverse().map((run, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <StatusBadge status={run.success ? 'ok' : 'fail'} />
                <span className="font-medium text-slate-300 w-28">{run.job}</span>
                <span className="text-slate-500">{formatTime(run.started_at)}</span>
                <span className="text-slate-600">{formatDuration(run.duration_ms)}</span>
                {!run.success && run.stderr_tail && (
                  <span className="text-red-400 truncate flex-1">{run.stderr_tail.split('\n')[0]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
