import { useState, useEffect } from 'react'
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

// ── Briefing Viewer ─────────────────────────────────────────────────────────

function BriefingViewer() {
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.listBriefings().then(d => {
      setDates(d)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0])
    }
  }, [dates, selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    setContent(null)
    window.api.getBriefing(selectedDate).then(c => setContent(c))
  }, [selectedDate])

  if (loading) {
    return <p className="text-xs text-slate-500">Loading briefings...</p>
  }

  if (dates.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-xs text-slate-500">No daily briefings yet. Run the daily-briefing job to generate one.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Date selector */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto">
        {dates.slice(0, 10).map(date => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`px-2.5 py-1 text-xs rounded-md border whitespace-nowrap transition-colors ${
              selectedDate === date
                ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {date}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {content === null ? (
          <p className="text-xs text-slate-500 p-4">Loading...</p>
        ) : (
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export function ActivityPanel() {
  const [tab, setTab] = useState<'feed' | 'briefing'>('feed')

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="text-xs text-slate-500 mt-0.5">Recent system activity, leads, and daily briefings</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {(['feed', 'briefing'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                tab === t
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'feed' ? 'Activity Feed' : 'Daily Briefing'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'briefing' ? (
        <BriefingViewer />
      ) : (
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
      )}
    </div>
  )
}
