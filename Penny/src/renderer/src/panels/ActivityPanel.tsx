import { useState, useEffect, useRef } from 'react'
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

// ── Loading skeleton ─────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <div className="rounded-lg p-3 border border-slate-800 overflow-hidden relative">
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.06) 50%, transparent 100%)',
          backgroundSize: '800px 100%',
        }}
      />
      <div className="h-3.5 w-32 bg-slate-800 rounded mb-2" />
      <div className="h-2.5 w-20 bg-slate-800/60 rounded" />
    </div>
  )
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerRow key={i} />
      ))}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="animate-card-enter flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
      {/* inbox icon */}
      <svg
        className="w-8 h-8 text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9m-9-6l6 6m-6-6v6h6"
        />
      </svg>
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="animate-fade-slide-down text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
      {children}
    </h3>
  )
}

// ── Job run row ──────────────────────────────────────────────────────────────

interface JobRunRowProps {
  run: JobRun
  index: number
  isNew: boolean
}

function JobRunRow({ run, index, isNew }: JobRunRowProps) {
  return (
    <div
      className={[
        'rounded-lg p-3 border transition-all duration-100',
        'bg-slate-900 border-slate-800',
        'hover:bg-slate-800/50',
        isNew ? 'animate-new-item-flash border-l-2' : '',
      ].join(' ')}
      style={{
        animationDelay: `${index * 40}ms`,
        animationFillMode: 'both',
        animation: `fade-slide-up 240ms ease-out ${index * 40}ms both${isNew ? ', new-item-flash 1400ms ease-out forwards' : ''}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={run.success ? 'ok' : 'fail'} />
          <span className="text-sm font-medium text-slate-200">{run.job}</span>
        </div>
        <span className="text-[11px] text-slate-600 transition-all duration-200">
          {timeAgo(run.started_at)}
        </span>
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
  )
}

// ── Lead row ─────────────────────────────────────────────────────────────────

interface LeadRowProps {
  lead: NewLead
  index: number
  isNew: boolean
}

function LeadRow({ lead, index, isNew }: LeadRowProps) {
  return (
    <div
      className={[
        'rounded-lg p-3 border transition-all duration-100',
        'bg-slate-900 border-slate-800',
        'hover:bg-slate-800/50',
        isNew ? 'border-l-2' : '',
      ].join(' ')}
      style={{
        animation: `fade-slide-up 240ms ease-out ${index * 40}ms both${isNew ? ', new-item-flash 1400ms ease-out forwards' : ''}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-200">{lead.name}</span>
        <span
          className={`text-xs font-mono transition-all duration-200 ${
            lead.score >= 50
              ? 'text-emerald-400'
              : lead.score >= 30
              ? 'text-amber-400'
              : 'text-slate-500'
          }`}
        >
          {lead.score}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>{lead.businessArm}</span>
        {lead.source && <span>via {lead.source}</span>}
      </div>
    </div>
  )
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
    return <LoadingSkeleton rows={3} />
  }

  if (dates.length === 0) {
    return (
      <EmptyState message="No daily briefings yet. Run the daily-briefing job to generate one." />
    )
  }

  return (
    <div>
      {/* Date selector */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto animate-fade-slide-down">
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
          <div className="p-4">
            <LoadingSkeleton rows={5} />
          </div>
        ) : (
          <div className="p-4 max-h-[60vh] overflow-y-auto animate-fade-slide-up">
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

  // Track which item keys were present on the previous render so we can flag truly new ones
  const prevRunKeysRef = useRef<Set<string>>(new Set())
  const prevLeadKeysRef = useRef<Set<string>>(new Set())
  const [newRunKeys, setNewRunKeys] = useState<Set<string>>(new Set())
  const [newLeadKeys, setNewLeadKeys] = useState<Set<string>>(new Set())

  const { data: history, loading: loadingHistory } = usePolling<JobRun[]>(
    () => window.api.getSchedulerHistory(),
    15000,
  )
  const { data: newLeads, loading: loadingLeads } = usePolling<NewLead[]>(
    () => window.api.getNewLeads(),
    30000,
  )

  // Detect genuinely new run items across polls
  useEffect(() => {
    if (!history) return
    const incoming = new Set(history.map(r => `${r.job}-${r.started_at}`))
    const fresh = new Set([...incoming].filter(k => !prevRunKeysRef.current.has(k)))
    if (prevRunKeysRef.current.size > 0 && fresh.size > 0) {
      setNewRunKeys(fresh)
      const t = setTimeout(() => setNewRunKeys(new Set()), 2000)
      return () => clearTimeout(t)
    }
    prevRunKeysRef.current = incoming
  }, [history])

  // Detect genuinely new lead items across polls
  useEffect(() => {
    if (!newLeads) return
    const incoming = new Set(newLeads.map(l => l.name))
    const fresh = new Set([...incoming].filter(k => !prevLeadKeysRef.current.has(k)))
    if (prevLeadKeysRef.current.size > 0 && fresh.size > 0) {
      setNewLeadKeys(fresh)
      const t = setTimeout(() => setNewLeadKeys(new Set()), 2000)
      return () => clearTimeout(t)
    }
    prevLeadKeysRef.current = incoming
  }, [newLeads])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Recent system activity, leads, and daily briefings
          </p>
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
            <SectionHeader>Job Runs</SectionHeader>
            <div className="space-y-2">
              {loadingHistory ? (
                <LoadingSkeleton rows={4} />
              ) : !history || history.length === 0 ? (
                <EmptyState message="No runs recorded yet." />
              ) : (
                history
                  .slice(-15)
                  .reverse()
                  .map((run, i) => {
                    const key = `${run.job}-${run.started_at}`
                    return (
                      <JobRunRow
                        key={key}
                        run={run}
                        index={i}
                        isNew={newRunKeys.has(key)}
                      />
                    )
                  })
              )}
            </div>
          </div>

          {/* New leads */}
          <div>
            <SectionHeader>New Leads (24h)</SectionHeader>
            <div className="space-y-2">
              {loadingLeads ? (
                <LoadingSkeleton rows={4} />
              ) : !newLeads || newLeads.length === 0 ? (
                <EmptyState message="No new leads in the last 24 hours." />
              ) : (
                newLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.name}
                    lead={lead}
                    index={i}
                    isNew={newLeadKeys.has(lead.name)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
