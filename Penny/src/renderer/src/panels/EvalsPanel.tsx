import { useState, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { PanelBackground } from '../components/PanelBackground'
import type { EvalAgentReport, EvalStats, SpotCheck, SpotCheckAgreement } from '../types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}

/** Issue #4: green >80%, amber 60–80% inclusive, red <60% */
function rateColor(rate: number): string {
  if (rate > 0.8) return 'text-emerald-400'
  if (rate >= 0.6) return 'text-amber-400'
  return 'text-red-400'
}

function rateBgColor(rate: number): string {
  if (rate > 0.8) return 'text-emerald-400/80'
  if (rate >= 0.6) return 'text-amber-400/80'
  return 'text-red-400/80'
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span className="text-emerald-400">&#9650;</span>
  if (trend === 'down') return <span className="text-red-400">&#9660;</span>
  return <span className="text-slate-500">&mdash;</span>
}

function Sparkline({ outcomes }: { outcomes: boolean[] }) {
  const last20 = outcomes.slice(0, 20)
  const pass = last20.filter(Boolean).length
  const fail = last20.length - pass
  const label =
    last20.length === 0
      ? 'No recent outcomes'
      : `Last ${last20.length} tasks: ${pass} pass, ${fail} fail (left = newer)`
  return (
    <span
      className="inline-flex items-center gap-px"
      role="img"
      aria-label={label}
    >
      {last20.map((ok, i) => (
        <span
          key={i}
          data-testid="sparkline-dot"
          title={ok ? 'Pass' : 'Fail'}
          className={`w-1.5 h-1.5 rounded-full inline-block border border-slate-900/80 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
        />
      ))}
    </span>
  )
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return <span className="text-slate-500">0</span>
  if (streak > 0) {
    return <span className="text-emerald-400 font-medium">+{streak}</span>
  }
  return <span className="text-red-400 font-medium">{streak}</span>
}

function ShimmerRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-10 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-8 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-6 bg-slate-700/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-700/50 rounded" /></td>
    </tr>
  )
}

function SummaryBar({ stats, loading }: { stats: EvalStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 px-5 py-3 animate-pulse">
        <div className="h-4 w-64 bg-slate-700/50 rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800 px-5 py-3 flex items-center gap-6 text-sm text-slate-300">
      <span>
        <span className="font-semibold text-slate-100">{stats.experimentVelocity}</span>{' '}
        tasks this week
      </span>
      <span className="text-slate-600">|</span>
      <span>
        <span className={`font-semibold ${rateBgColor(stats.overallSuccessRate)}`}>
          {(stats.overallSuccessRate * 100).toFixed(0)}%
        </span>{' '}
        success rate
      </span>
      <span className="text-slate-600">|</span>
      <span>
        <span className="font-semibold text-slate-100">{stats.totalTasks}</span>{' '}
        experiments
      </span>
    </div>
  )
}

function VerdictButton({
  label,
  color,
  onClick,
  ariaLabel,
}: {
  label: string
  color: 'emerald' | 'amber' | 'red'
  onClick: () => void
  ariaLabel: string
}) {
  const colorMap = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
    red: 'bg-red-600 hover:bg-red-500',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`px-3 py-1 rounded text-xs font-semibold text-white ${colorMap[color]} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:ring-white/40`}
    >
      {label}
    </button>
  )
}

function SpotCheckCard({
  check,
  onReview,
}: {
  check: SpotCheck
  onReview: (id: string, verdict: 'pass' | 'fail' | 'partial', notes?: string) => void
}) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')

  const submit = useCallback(
    (verdict: 'pass' | 'fail' | 'partial') => {
      onReview(check.id, verdict, notes || undefined)
    },
    [check.id, notes, onReview],
  )

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-300">{check.agentId}</span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            (check.automatedScore ?? 0) >= 0.5
              ? 'bg-emerald-900/50 text-emerald-400'
              : 'bg-red-900/50 text-red-400'
          }`}
        >
          Auto: {(check.automatedScore ?? 0) >= 0.5 ? 'Pass' : 'Fail'}
        </span>
      </div>

      <p className="text-sm text-slate-200 line-clamp-3">{check.taskDescription}</p>

      {check.agentOutput && (
        <pre className="text-xs text-slate-400 bg-slate-800/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
          {check.agentOutput}
        </pre>
      )}

      <div className="flex items-center gap-2">
        <VerdictButton
          label="Pass"
          color="emerald"
          ariaLabel={`Mark spot check as pass for task ${check.taskId}`}
          onClick={() => submit('pass')}
        />
        <VerdictButton
          label="Partial"
          color="amber"
          ariaLabel={`Mark spot check as partial for task ${check.taskId}`}
          onClick={() => submit('partial')}
        />
        <VerdictButton
          label="Fail"
          color="red"
          ariaLabel={`Mark spot check as fail for task ${check.taskId}`}
          onClick={() => submit('fail')}
        />
        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          aria-expanded={showNotes}
          aria-controls={`spot-check-notes-${check.id}`}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {showNotes ? 'Hide notes' : 'Add notes'}
        </button>
      </div>

      {showNotes && (
        <textarea
          id={`spot-check-notes-${check.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          aria-label="Optional review notes"
          className="w-full rounded bg-slate-800 border border-slate-700 text-sm text-slate-200 p-2 resize-none h-16 focus:outline-none focus:border-slate-500 focus-visible:ring-2 focus-visible:ring-white/30"
        />
      )}
    </div>
  )
}

function SpotCheckSection() {
  const { data: pending, refresh: refreshPending } = usePolling<SpotCheck[]>(
    () => window.api.evalsSpotCheckQueue(),
    10_000,
  )
  const { data: agreement, refresh: refreshAgreement } = usePolling<SpotCheckAgreement>(
    () => window.api.evalsSpotCheckAgreement(),
    10_000,
  )
  const [sampling, setSampling] = useState(false)

  const handleSample = useCallback(async () => {
    setSampling(true)
    try {
      await window.api.evalsSpotCheckSample(10)
      refreshPending()
      refreshAgreement()
    } finally {
      setSampling(false)
    }
  }, [refreshPending, refreshAgreement])

  const handleReview = useCallback(
    async (id: string, verdict: 'pass' | 'fail' | 'partial', notes?: string) => {
      await window.api.evalsSpotCheckReview(id, verdict, notes)
      refreshPending()
      refreshAgreement()
    },
    [refreshPending, refreshAgreement],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200 tracking-tight">Spot Check</h2>
        <div className="flex items-center gap-3">
          {agreement && agreement.total > 0 && (
            <span className="text-xs text-slate-400">
              Agreement:{' '}
              <span className={`font-semibold ${rateColor(agreement.rate)}`}>
                {agreement.agreed}/{agreement.total} ({(agreement.rate * 100).toFixed(0)}%)
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSample}
            disabled={sampling}
            aria-busy={sampling}
            aria-label="Sample up to 10 recent completed or failed tasks for manual review"
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {sampling ? 'Sampling...' : 'Sample 10'}
          </button>
        </div>
      </div>

      {!pending || pending.length === 0 ? (
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 px-5 py-6 text-center text-slate-500 text-sm">
          No spot checks pending. Click Sample to queue tasks for review.
        </div>
      ) : (
        <div className="grid gap-3">
          {pending.map((check) => (
            <SpotCheckCard key={check.id} check={check} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  )
}

export function EvalsPanel() {
  const { data: reports, loading: reportsLoading, error: reportsError } = usePolling<EvalAgentReport[]>(
    () => window.api.evalsReportAll(),
    10_000,
  )
  const { data: stats, loading: statsLoading, error: statsError } = usePolling<EvalStats>(
    () => window.api.evalsStats(),
    10_000,
  )

  const fetchError = reportsError || statsError
  const isEmpty = !reportsLoading && (!reports || reports.length === 0)

  return (
    <PanelBackground>
      <div className="h-full flex flex-col p-6 gap-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">Eval Dashboard</h1>
        </div>

        {fetchError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-800/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          >
            Could not load eval data: {fetchError}
          </div>
        )}

        <SummaryBar stats={stats} loading={statsLoading} />

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-500">
              {reportsError ? (
                <>
                  <p className="text-lg font-medium">Eval table unavailable</p>
                  <p className="text-sm mt-1">Fix the connection issue above, or check Penny/data/eval-results.json.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No eval data yet</p>
                  <p className="text-sm mt-1">Task results will appear here once the eval harness runs.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/70 text-slate-400 text-xs uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Agent Name</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Tasks</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Success Rate</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Avg Duration</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Streak</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Trend</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Last 20</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportsLoading ? (
                  <>
                    <ShimmerRow />
                    <ShimmerRow />
                    <ShimmerRow />
                  </>
                ) : (
                  reports?.map((r) => (
                    <tr
                      key={r.agentId}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-200 font-medium">{r.agentName}</td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{r.totalTasks}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${rateColor(r.successRate)}`}>
                        {(r.successRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                        {formatDuration(r.avgDurationMs)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StreakBadge streak={r.streak} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TrendIndicator trend={r.trend} />
                      </td>
                      <td className="px-4 py-3">
                        <Sparkline outcomes={r.recentOutcomes} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <SpotCheckSection />
      </div>
    </PanelBackground>
  )
}
