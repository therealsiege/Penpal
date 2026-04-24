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
  return <span className="text-[var(--c-text-muted)]">&mdash;</span>
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
          className={`w-1.5 h-1.5 rounded-full inline-block border border-[color-mix(in_srgb,var(--c-bg-surface)_80%,transparent)] ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
        />
      ))}
    </span>
  )
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return <span className="text-[var(--c-text-muted)]">0</span>
  if (streak > 0) {
    return <span className="text-emerald-400 font-medium">+{streak}</span>
  }
  return <span className="text-red-400 font-medium">{streak}</span>
}

function ShimmerRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-24 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-10 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-8 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-6 bg-[var(--c-bg-hover)]/50 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-[var(--c-bg-hover)]/50 rounded" /></td>
    </tr>
  )
}

function SummaryBar({ stats, loading }: { stats: EvalStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-3 animate-pulse">
        <div className="h-4 w-64 bg-[var(--c-bg-hover)]/50 rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-3 flex items-center gap-6 text-sm text-[var(--c-text-primary)]">
      <span>
        <span className="font-semibold text-[var(--c-text-bright)]">{stats.experimentVelocity}</span>{' '}
        tasks this week
      </span>
      <span className="text-[var(--c-text-faint)]">|</span>
      <span>
        <span className={`font-semibold ${rateBgColor(stats.overallSuccessRate)}`}>
          {(stats.overallSuccessRate * 100).toFixed(0)}%
        </span>{' '}
        success rate
      </span>
      <span className="text-[var(--c-text-faint)]">|</span>
      <span>
        <span className="font-semibold text-[var(--c-text-bright)]">{stats.totalTasks}</span>{' '}
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
    <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-bg-surface)]/60 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-[var(--c-text-secondary)]">
        <span className="font-medium text-[var(--c-text-primary)]">{check.agentId}</span>
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

      <p className="text-sm text-[var(--c-text-heading)] line-clamp-3">{check.taskDescription}</p>

      {check.agentOutput && (
        <pre className="text-xs text-[var(--c-text-secondary)] bg-[var(--c-bg-elevated)]/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
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
          className="ml-auto text-xs text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] transition-colors rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
          className="w-full rounded bg-[var(--c-bg-elevated)] border border-[var(--c-border)] text-sm text-[var(--c-text-heading)] p-2 resize-none h-16 focus:outline-none focus:border-slate-500 focus-visible:ring-2 focus-visible:ring-white/30"
        />
      )}
    </div>
  )
}

// ── Pod Combo Analytics ──────────────────────────────────────────────────────

interface ComboStats {
  comboKey: string
  solverId: string
  reviewerId: string
  executorId: string
  totalRuns: number
  completed: number
  successRate: number
  avgIterations: number
  avgCompletionTime_ms: number
  firstPassRate: number
  executorPassRate: number
}

interface AgentRoleStats {
  agentId: string
  asSolver: { runs: number; successRate: number; avgDuration_ms: number }
  asReviewer: { runs: number; successRate: number; firstPassRate: number; avgDuration_ms: number }
  asExecutor: { runs: number; successRate: number; passRate: number; selfFixRate: number; avgDuration_ms: number }
}

interface PodComboReport {
  period: { from: string; to: string }
  totalPods: number
  topCombos: ComboStats[]
  agentRoleStats: AgentRoleStats[]
  stageTimingOverall: { avgSolving_ms: number; avgReviewing_ms: number; avgExecuting_ms: number; avgSelfFixing_ms: number }
}

function StageTimingBar({ label, ms, maxMs }: { label: string; ms: number; maxMs: number }) {
  const pct = maxMs > 0 ? Math.min(100, (ms / maxMs) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right text-[var(--c-text-secondary)] font-mono">{label}</span>
      <div className="flex-1 h-2 bg-[var(--c-bg-elevated)]/50 rounded overflow-hidden">
        <div className="h-full bg-indigo-500/70 rounded" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right text-[var(--c-text-muted)] tabular-nums">{formatDuration(ms)}</span>
    </div>
  )
}

function PodCombosSection() {
  const { data: report } = usePolling<PodComboReport>(
    () => window.api.evalsPodCombos(),
    15_000,
  )

  if (!report || report.totalPods === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[var(--c-text-heading)] tracking-tight">Pod Combos</h2>
        <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-6 text-center text-[var(--c-text-muted)] text-sm">
          No pod combo data yet. Run pods to start collecting agent performance data.
        </div>
      </div>
    )
  }

  const maxStageMs = Math.max(
    report.stageTimingOverall.avgSolving_ms,
    report.stageTimingOverall.avgReviewing_ms,
    report.stageTimingOverall.avgExecuting_ms,
    report.stageTimingOverall.avgSelfFixing_ms,
    1,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--c-text-heading)] tracking-tight">Pod Combos</h2>
        <span className="text-xs text-[var(--c-text-muted)]">{report.totalPods} pods tracked</span>
      </div>

      {/* Combo Leaderboard */}
      {report.topCombos.length > 0 && (
        <div className="rounded-xl border border-[var(--c-border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--c-bg-surface)]/70 text-[var(--c-text-secondary)] text-xs uppercase tracking-wider">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Solver</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Reviewer</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Executor</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Runs</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Success</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-border-subtle)]/60">
              {report.topCombos.map((c) => (
                <tr key={c.comboKey} className="hover:bg-[var(--c-bg-elevated)]/30 transition-colors">
                  <td className="px-3 py-2 text-[var(--c-text-primary)] font-mono text-xs">{c.solverId}</td>
                  <td className="px-3 py-2 text-[var(--c-text-primary)] font-mono text-xs">{c.reviewerId}</td>
                  <td className="px-3 py-2 text-[var(--c-text-primary)] font-mono text-xs">{c.executorId}</td>
                  <td className="px-3 py-2 text-right text-[var(--c-text-secondary)] tabular-nums">{c.totalRuns}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${rateColor(c.successRate)}`}>
                    {(c.successRate * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--c-text-secondary)] tabular-nums">
                    {formatDuration(c.avgCompletionTime_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stage Timing */}
      <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] p-4 flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-1">Avg Stage Timing</h3>
        <StageTimingBar label="Solve" ms={report.stageTimingOverall.avgSolving_ms} maxMs={maxStageMs} />
        <StageTimingBar label="Review" ms={report.stageTimingOverall.avgReviewing_ms} maxMs={maxStageMs} />
        <StageTimingBar label="Execute" ms={report.stageTimingOverall.avgExecuting_ms} maxMs={maxStageMs} />
        <StageTimingBar label="Self-fix" ms={report.stageTimingOverall.avgSelfFixing_ms} maxMs={maxStageMs} />
      </div>

      {/* Agent Role Stats */}
      {report.agentRoleStats.length > 0 && (
        <div className="rounded-xl border border-[var(--c-border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--c-bg-surface)]/70 text-[var(--c-text-secondary)] text-xs uppercase tracking-wider">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Agent</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Solver</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Reviewer</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Executor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-border-subtle)]/60">
              {report.agentRoleStats
                .filter(a => a.asSolver.runs + a.asReviewer.runs + a.asExecutor.runs > 0)
                .map((a) => (
                <tr key={a.agentId} className="hover:bg-[var(--c-bg-elevated)]/30 transition-colors">
                  <td className="px-3 py-2 text-[var(--c-text-heading)] font-mono text-xs">{a.agentId}</td>
                  <td className="px-3 py-2 text-right">
                    {a.asSolver.runs > 0 ? (
                      <span className={`text-xs tabular-nums ${rateColor(a.asSolver.successRate)}`}>
                        {(a.asSolver.successRate * 100).toFixed(0)}% <span className="text-[var(--c-text-muted)]">({a.asSolver.runs})</span>
                      </span>
                    ) : <span className="text-[var(--c-text-muted)]">--</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.asReviewer.runs > 0 ? (
                      <span className={`text-xs tabular-nums ${rateColor(a.asReviewer.firstPassRate)}`}>
                        {(a.asReviewer.firstPassRate * 100).toFixed(0)}% <span className="text-[var(--c-text-muted)]">({a.asReviewer.runs})</span>
                      </span>
                    ) : <span className="text-[var(--c-text-muted)]">--</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.asExecutor.runs > 0 ? (
                      <span className={`text-xs tabular-nums ${rateColor(a.asExecutor.passRate)}`}>
                        {(a.asExecutor.passRate * 100).toFixed(0)}% <span className="text-[var(--c-text-muted)]">({a.asExecutor.runs})</span>
                      </span>
                    ) : <span className="text-[var(--c-text-muted)]">--</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DpoPairsSection() {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ count: number; path: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.api.evalsGenerateDpoPairs()
      if (
        typeof res?.count !== 'number' ||
        !Number.isFinite(res.count) ||
        res.count < 0 ||
        typeof res.path !== 'string' ||
        res.path.trim().length === 0
      ) {
        throw new Error('Main process returned an invalid DPO export result.')
      }
      setResult({ count: Math.trunc(res.count), path: res.path })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Failed to generate DPO pairs: ${message}`)
    } finally {
      setGenerating(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--c-text-heading)] tracking-tight">DPO Pairs</h2>
        <div className="flex items-center gap-3">
          {result && (
            <span className="text-xs text-[var(--c-text-secondary)]">
              <span className="font-semibold text-[var(--c-text-bright)]">{result.count}</span> pairs exported
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            aria-busy={generating}
            aria-label="Generate DPO training pairs from preference data"
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {generating ? 'Generating...' : 'Generate Pairs'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800/80 bg-red-950/40 px-4 py-3 text-sm text-red-100"
        >
          {error}
        </div>
      )}

      {generating && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-indigo-900/60 bg-indigo-950/40 px-4 py-3 text-sm text-indigo-100"
        >
          Generating DPO pairs from preferences...
        </div>
      )}

      {!result && !error && !generating && (
        <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-6 text-center text-[var(--c-text-muted)] text-sm">
          Generate DPO training pairs from preference signals. Output: data/dpo-pairs.jsonl
        </div>
      )}

      {result && (
        <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-3 text-sm text-[var(--c-text-secondary)]">
          Exported <span className="font-semibold text-[var(--c-text-bright)]">{result.count}</span> pairs to <span className="font-mono text-xs text-[var(--c-text-muted)]">{result.path}</span>
        </div>
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
        <h2 className="text-sm font-bold text-[var(--c-text-heading)] tracking-tight">Spot Check</h2>
        <div className="flex items-center gap-3">
          {agreement && agreement.total > 0 && (
            <span className="text-xs text-[var(--c-text-secondary)]">
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
        <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-6 text-center text-[var(--c-text-muted)] text-sm">
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
          <h1 className="text-lg font-bold text-[var(--c-text-bright)] tracking-tight">Eval Dashboard</h1>
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
            <div className="text-center text-[var(--c-text-muted)]">
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
          <div className="rounded-xl border border-[var(--c-border-subtle)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--c-bg-surface)]/70 text-[var(--c-text-secondary)] text-xs uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Agent Name</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Tasks</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Success Rate</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Avg Duration</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Streak</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Trend</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Last 20</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border-subtle)]/60">
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
                      className="hover:bg-[var(--c-bg-elevated)]/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-[var(--c-text-heading)] font-medium">{r.agentName}</td>
                      <td className="px-4 py-3 text-right text-[var(--c-text-primary)] tabular-nums">{r.totalTasks}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${rateColor(r.successRate)}`}>
                        {(r.successRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--c-text-secondary)] tabular-nums">
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

        <DpoPairsSection />
        <PodCombosSection />
        <SpotCheckSection />
      </div>
    </PanelBackground>
  )
}
