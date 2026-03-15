import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import type { JobRun, NewLead } from '../types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function ActivityPanel() {
  const { data: history, loading: loadingHistory } = usePolling<JobRun[]>(
    () => window.api.getSchedulerHistory(),
    15000,
  )
  const { data: newLeads, loading: loadingLeads } = usePolling<NewLead[]>(
    () => window.api.getNewLeads(),
    30000,
  )

  if (loadingHistory && loadingLeads) {
    return <div className="text-slate-500 text-sm">Loading activity...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Activity</h2>
        <p className="text-xs text-slate-500 mt-0.5">Recent system activity and new leads</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Job runs */}
        <div>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            Job Runs
          </h3>
          <div className="space-y-2">
            {!history || history.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg p-4">
                No runs recorded yet.
              </p>
            ) : (
              history.slice(-15).reverse().map((run, i) => (
                <div
                  key={i}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.success ? 'ok' : 'fail'} />
                      <span className="text-sm font-medium text-slate-200">{run.job}</span>
                    </div>
                    <span className="text-[11px] text-slate-600">{timeAgo(run.started_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{formatDuration(run.duration_ms)}</span>
                    <span>exit {run.exit_code}</span>
                  </div>
                  {!run.success && run.stderr_tail && (
                    <p className="text-[11px] text-red-400/80 mt-1.5 truncate">
                      {run.stderr_tail.split('\n')[0]}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* New leads */}
        <div>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            New Leads (24h)
          </h3>
          <div className="space-y-2">
            {!newLeads || newLeads.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg p-4">
                No new leads in the last 24 hours.
              </p>
            ) : (
              newLeads.map((lead, i) => (
                <div
                  key={i}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200">{lead.name}</span>
                    <span className={`text-xs font-mono ${
                      lead.score >= 50 ? 'text-emerald-400'
                        : lead.score >= 30 ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}>
                      {lead.score}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{lead.businessArm}</span>
                    {lead.source && <span>via {lead.source}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
