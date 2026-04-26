import { useState, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { PanelBackground } from '../components/PanelBackground'

interface PodResult {
  id: string
  name: string
  status: 'complete' | 'failed'
  task: string
  prUrl?: string
  error?: string
  iteration: number
  maxIterations: number
  solver: { agentId: string }
  reviewer: { agentId: string }
  executor: { agentId: string }
  presetId?: string
  createdAt: number
  updatedAt: number
  issueNumber?: number
  issueRepo?: string
}

function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function RepoGroup({ repo, pods, onMergeAll, onRetry }: { repo: string; pods: PodResult[]; onMergeAll: (repo: string) => void; onRetry: (pod: PodResult) => void }) {
  const completed = pods.filter(p => p.status === 'complete')
  const failed = pods.filter(p => p.status === 'failed')
  const withPR = completed.filter(p => p.prUrl)

  return (
    <div className="rounded-xl border border-[var(--c-border-subtle)] overflow-hidden">
      <div className="bg-[var(--c-bg-surface)]/70 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--c-text-heading)]">{repo}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--c-text-muted)]">
            {completed.length} done, {failed.length} failed
          </span>
          {failed.length > 0 && (
            <button
              type="button"
              onClick={() => failed.forEach(p => onRetry(p))}
              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors"
            >
              Retry Failed ({failed.length})
            </button>
          )}
          {withPR.length > 0 && (
            <button
              type="button"
              onClick={() => onMergeAll(repo)}
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
            >
              Merge All ({withPR.length})
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-[var(--c-border-subtle)]/60">
        {pods.map(p => (
          <div key={p.id} className="px-4 py-2 flex items-center gap-3 hover:bg-[var(--c-bg-elevated)]/30 transition-colors">
            <span className={`text-xs font-bold ${p.status === 'complete' ? 'text-emerald-400' : 'text-red-400'}`}>
              {p.status === 'complete' ? 'PASS' : 'FAIL'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--c-text-primary)] truncate">{p.name}</div>
              {p.status === 'failed' && p.error && (
                <div className="text-xs text-red-400/80 truncate">{p.error.slice(0, 100)}</div>
              )}
            </div>
            <span className="text-xs text-[var(--c-text-muted)] tabular-nums whitespace-nowrap">
              {p.iteration}/{p.maxIterations} iter
            </span>
            <span className="text-xs text-[var(--c-text-muted)] whitespace-nowrap">
              {formatAge(Date.now() - p.updatedAt)}
            </span>
            {p.status === 'failed' && (
              <button
                type="button"
                onClick={() => onRetry(p)}
                className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                Retry
              </button>
            )}
            {p.prUrl && (
              <a
                href={p.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
              >
                PR
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ResultsPanel() {
  const { data: pods } = usePolling<PodResult[]>(
    () => window.api.listPods(),
    5_000,
  )
  const [merging, setMerging] = useState<string | null>(null)
  const [mergeResult, setMergeResult] = useState<string | null>(null)

  const terminal = (pods || []).filter(p => p.status === 'complete' || p.status === 'failed')
    .sort((a, b) => b.updatedAt - a.updatedAt)

  // Group by repo
  const byRepo = new Map<string, PodResult[]>()
  for (const p of terminal) {
    const repo = p.issueRepo || 'manual'
    if (!byRepo.has(repo)) byRepo.set(repo, [])
    byRepo.get(repo)!.push(p)
  }

  // Stats
  const total = terminal.length
  const completed = terminal.filter(p => p.status === 'complete').length
  const failed = terminal.filter(p => p.status === 'failed').length
  const withPR = terminal.filter(p => p.prUrl).length
  const rate = total > 0 ? completed / total : 0

  const handleRetry = useCallback(async (pod: PodResult) => {
    try {
      await window.api.createPod(pod.task, {
        name: pod.name,
        presetId: pod.presetId,
        issueNumber: pod.issueNumber,
        issueRepo: pod.issueRepo,
      })
      setMergeResult(`Retried: ${pod.name}`)
    } catch (err) {
      setMergeResult(`Retry failed: ${(err as Error).message?.slice(0, 100)}`)
    }
  }, [])

  const handleMergeAll = useCallback(async (repo: string) => {
    setMerging(repo)
    setMergeResult(null)
    const repoPods = byRepo.get(repo) || []
    const prsToMerge = repoPods.filter(p => p.prUrl).map(p => {
      const match = p.prUrl!.match(/\/pull\/(\d+)$/)
      const repoPath = p.issueRepo || repo
      return match ? { num: match[1], repo: repoPath } : null
    }).filter(Boolean) as Array<{ num: string; repo: string }>

    let merged = 0
    let errors = 0
    for (const pr of prsToMerge) {
      try {
        await window.api.mergePr(pr.num, pr.repo)
        merged++
      } catch {
        errors++
      }
    }
    setMergeResult(`Merged ${merged}/${prsToMerge.length}${errors > 0 ? ` (${errors} failed)` : ''}`)
    setMerging(null)
  }, [byRepo])

  return (
    <PanelBackground>
      <div className="h-full flex flex-col p-6 gap-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[var(--c-text-bright)] tracking-tight">Results</h1>
          {mergeResult && (
            <span className="text-xs text-emerald-400">{mergeResult}</span>
          )}
        </div>

        {/* Stats bar */}
        <div className="rounded-xl bg-[var(--c-bg-surface)]/50 border border-[var(--c-border-subtle)] px-5 py-3 flex items-center gap-6 text-sm text-[var(--c-text-primary)]">
          <span>
            <span className="font-semibold text-[var(--c-text-bright)]">{total}</span> pods
          </span>
          <span className="text-[var(--c-text-faint)]">|</span>
          <span>
            <span className={`font-semibold ${rate > 0.8 ? 'text-emerald-400' : rate >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
              {(rate * 100).toFixed(0)}%
            </span> success
          </span>
          <span className="text-[var(--c-text-faint)]">|</span>
          <span>
            <span className="font-semibold text-emerald-400">{completed}</span> done
          </span>
          <span className="text-[var(--c-text-faint)]">|</span>
          <span>
            <span className="font-semibold text-red-400">{failed}</span> failed
          </span>
          <span className="text-[var(--c-text-faint)]">|</span>
          <span>
            <span className="font-semibold text-indigo-400">{withPR}</span> PRs
          </span>
        </div>

        {terminal.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[var(--c-text-muted)]">
              <p className="text-lg font-medium">No results yet</p>
              <p className="text-sm mt-1">Pod results will appear here as they complete.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[...byRepo.entries()].map(([repo, repoPods]) => (
              <RepoGroup key={repo} repo={repo} pods={repoPods} onMergeAll={handleMergeAll} onRetry={handleRetry} />
            ))}
          </div>
        )}
      </div>
    </PanelBackground>
  )
}
