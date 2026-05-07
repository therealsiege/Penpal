import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePolling } from '../hooks/usePolling'
import { PanelBackground } from '../components/PanelBackground'
import { useToast } from '../components/Toast'

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

interface PrDiffFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch: string
}

interface PrDiff {
  title: string
  state: string
  merged: boolean
  htmlUrl: string
  additions: number
  deletions: number
  changedFiles: number
  files: PrDiffFile[]
}

function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Parse `https://github.com/{owner}/{repo}/pull/{n}` → { owner, repo, num }. */
function parsePrUrl(url: string | undefined, fallbackRepo: string | undefined): { owner: string; repo: string; num: string } | null {
  if (!url) return null
  // Try full URL first
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (m) return { owner: m[1], repo: m[2], num: m[3] }
  // Fallback — just pull number, repo from issueRepo
  const num = url.match(/\/pull\/(\d+)/)?.[1]
  if (!num || !fallbackRepo) return null
  const [owner, repo] = fallbackRepo.split('/')
  if (!owner || !repo) return null
  return { owner, repo, num }
}

/** Render a single unified-diff line with color (green = add, red = remove, hunk = blue). */
function DiffLine({ line }: { line: string }) {
  let cls = 'text-[var(--c-text-muted)]'
  if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400 bg-emerald-500/10'
  else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400 bg-red-500/10'
  else if (line.startsWith('@@')) cls = 'text-indigo-400 bg-indigo-500/10'
  else if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-[var(--c-text-faint)]'
  return <div className={`px-3 ${cls} whitespace-pre`}>{line || ' '}</div>
}

interface PrStatusBadgeProps {
  state: string
}

function PrStatusBadge({ state }: PrStatusBadgeProps) {
  const palette =
    state === 'merged' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    : state === 'closed' ? 'bg-red-500/20 text-red-300 border-red-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${palette}`}>
      {state}
    </span>
  )
}

interface PodRowProps {
  pod: PodResult
  onMerge: (pod: PodResult) => Promise<void>
  onRetry: (pod: PodResult) => Promise<void>
  isMerging: boolean
}

function PodRow({ pod, onMerge, onRetry, isMerging }: PodRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [diff, setDiff] = useState<PrDiff | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  const prInfo = useMemo(() => parsePrUrl(pod.prUrl, pod.issueRepo), [pod.prUrl, pod.issueRepo])

  // Lazy-load diff when expanding
  useEffect(() => {
    if (!expanded || diff || loadingDiff || !prInfo) return
    let cancelled = false
    setLoadingDiff(true)
    setDiffError(null)
    window.api
      .getPrDiff(prInfo.owner, prInfo.repo, prInfo.num)
      .then(d => { if (!cancelled) setDiff(d) })
      .catch(err => { if (!cancelled) setDiffError((err as Error).message?.slice(0, 200) || 'Failed to load diff') })
      .finally(() => { if (!cancelled) setLoadingDiff(false) })
    return () => { cancelled = true }
  }, [expanded, diff, loadingDiff, prInfo])

  const refreshDiff = useCallback(() => {
    setDiff(null)
    setDiffError(null)
    setExpanded(true)
  }, [])

  return (
    <div className="px-4 py-3 hover:bg-[var(--c-bg-elevated)]/30 transition-colors">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold ${pod.status === 'complete' ? 'text-emerald-400' : 'text-red-400'}`}>
          {pod.status === 'complete' ? 'PASS' : 'FAIL'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[var(--c-text-primary)] truncate">{pod.name}</div>
          {pod.status === 'failed' && pod.error && (
            <div className="text-xs text-red-400/80 truncate">{pod.error.slice(0, 140)}</div>
          )}
          {prInfo && diff && (
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--c-text-muted)]">
              <PrStatusBadge state={diff.state} />
              <span>#{prInfo.num}</span>
              <span className="text-[var(--c-text-faint)]">·</span>
              <span>{diff.changedFiles} file{diff.changedFiles === 1 ? '' : 's'}</span>
              <span className="text-emerald-400">+{diff.additions}</span>
              <span className="text-red-400">-{diff.deletions}</span>
            </div>
          )}
        </div>

        <span className="text-xs text-[var(--c-text-muted)] tabular-nums whitespace-nowrap">
          {pod.iteration}/{pod.maxIterations} iter
        </span>
        <span className="text-xs text-[var(--c-text-muted)] whitespace-nowrap">
          {formatAge(Date.now() - pod.updatedAt)}
        </span>

        {pod.status === 'failed' && (
          <button
            type="button"
            onClick={() => onRetry(pod)}
            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            Retry
          </button>
        )}

        {prInfo && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="px-2 py-0.5 rounded border border-[var(--c-border-subtle)] hover:bg-[var(--c-bg-elevated)] text-xs font-medium text-[var(--c-text-primary)] transition-colors whitespace-nowrap"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide Diff' : 'View Diff'}
            </button>
            <a
              href={pod.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
              title={`Open PR #${prInfo.num} on GitHub`}
            >
              PR #{prInfo.num}
            </a>
            {(!diff || (!diff.merged && diff.state !== 'closed')) && (
              <button
                type="button"
                onClick={() => onMerge(pod)}
                disabled={isMerging || (diff?.state === 'merged') || (diff?.state === 'closed')}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                {isMerging ? 'Merging…' : 'Merge PR'}
              </button>
            )}
          </>
        )}
      </div>

      {expanded && prInfo && (
        <div className="mt-3 rounded-lg border border-[var(--c-border-subtle)] bg-[var(--c-bg-deep)]/60 overflow-hidden">
          {loadingDiff && (
            <div className="px-4 py-3 text-xs text-[var(--c-text-muted)]">Loading diff…</div>
          )}
          {diffError && (
            <div className="px-4 py-3 text-xs text-red-400 flex items-center justify-between gap-3">
              <span className="truncate">Failed to load diff: {diffError}</span>
              <button
                type="button"
                onClick={refreshDiff}
                className="px-2 py-0.5 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {diff && !loadingDiff && (
            <div className="divide-y divide-[var(--c-border-subtle)]/60">
              {diff.files.length === 0 && (
                <div className="px-4 py-3 text-xs text-[var(--c-text-muted)]">No files changed.</div>
              )}
              {diff.files.map(file => (
                <div key={file.filename}>
                  <div className="px-4 py-2 flex items-center gap-3 bg-[var(--c-bg-surface)]/50">
                    <span className="text-xs font-mono text-[var(--c-text-primary)] truncate flex-1">
                      {file.filename}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--c-text-muted)]">
                      {file.status}
                    </span>
                    <span className="text-xs text-emerald-400 tabular-nums">+{file.additions}</span>
                    <span className="text-xs text-red-400 tabular-nums">-{file.deletions}</span>
                  </div>
                  {file.patch ? (
                    <pre className="text-[11px] font-mono leading-relaxed py-2 max-h-96 overflow-auto scrollbar-penpal">
                      {file.patch.split('\n').map((line, i) => (
                        <DiffLine key={i} line={line} />
                      ))}
                    </pre>
                  ) : (
                    <div className="px-4 py-2 text-[11px] text-[var(--c-text-muted)] italic">
                      Patch not available (binary file or too large).
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface RepoGroupProps {
  repo: string
  pods: PodResult[]
  onMergeAll: (repo: string) => void
  onMerge: (pod: PodResult) => Promise<void>
  onRetry: (pod: PodResult) => Promise<void>
  mergingPodIds: Set<string>
}

function RepoGroup({ repo, pods, onMergeAll, onMerge, onRetry, mergingPodIds }: RepoGroupProps) {
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
          <PodRow
            key={p.id}
            pod={p}
            onMerge={onMerge}
            onRetry={onRetry}
            isMerging={mergingPodIds.has(p.id)}
          />
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
  const { toast } = useToast()
  const [mergingPodIds, setMergingPodIds] = useState<Set<string>>(new Set())

  const terminal = useMemo(
    () => (pods || [])
      .filter(p => p.status === 'complete' || p.status === 'failed')
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [pods],
  )

  const byRepo = useMemo(() => {
    const map = new Map<string, PodResult[]>()
    for (const p of terminal) {
      const repo = p.issueRepo || 'manual'
      if (!map.has(repo)) map.set(repo, [])
      map.get(repo)!.push(p)
    }
    return map
  }, [terminal])

  // Stats
  const total = terminal.length
  const completed = terminal.filter(p => p.status === 'complete').length
  const failed = terminal.filter(p => p.status === 'failed').length
  const withPR = terminal.filter(p => p.prUrl).length
  const rate = total > 0 ? completed / total : 0

  const handleRetry = useCallback(async (pod: PodResult) => {
    if (!pod.issueNumber || !pod.issueRepo) {
      toast(`Can't retry: no issue number for ${pod.name}`, 'error')
      return
    }
    try {
      await window.api.retryIssue(pod.issueRepo, pod.issueNumber)
      toast(`Queued retry: ${pod.issueRepo}#${pod.issueNumber}`, 'success')
    } catch (err) {
      toast(`Retry failed: ${(err as Error).message?.slice(0, 100)}`, 'error')
    }
  }, [toast])

  const handleMerge = useCallback(async (pod: PodResult) => {
    const prInfo = parsePrUrl(pod.prUrl, pod.issueRepo)
    if (!prInfo) {
      toast(`Can't merge: invalid PR URL for ${pod.name}`, 'error')
      return
    }
    setMergingPodIds(prev => new Set(prev).add(pod.id))
    try {
      await window.api.mergePr(prInfo.num, `${prInfo.owner}/${prInfo.repo}`)
      toast(`Merged PR #${prInfo.num}`, 'success')
    } catch (err) {
      toast(`Merge failed: ${(err as Error).message?.slice(0, 120)}`, 'error')
    } finally {
      setMergingPodIds(prev => {
        const next = new Set(prev)
        next.delete(pod.id)
        return next
      })
    }
  }, [toast])

  const handleMergeAll = useCallback(async (repo: string) => {
    const repoPods = byRepo.get(repo) || []
    const targets = repoPods.filter(p => p.prUrl)
    if (targets.length === 0) return

    setMergingPodIds(prev => {
      const next = new Set(prev)
      for (const p of targets) next.add(p.id)
      return next
    })

    let merged = 0
    let errors = 0
    for (const p of targets) {
      const prInfo = parsePrUrl(p.prUrl, p.issueRepo)
      if (!prInfo) { errors++; continue }
      try {
        await window.api.mergePr(prInfo.num, `${prInfo.owner}/${prInfo.repo}`)
        merged++
      } catch {
        errors++
      }
    }

    setMergingPodIds(prev => {
      const next = new Set(prev)
      for (const p of targets) next.delete(p.id)
      return next
    })

    toast(
      `Merged ${merged}/${targets.length}${errors > 0 ? ` (${errors} failed)` : ''}`,
      errors > 0 ? 'error' : 'success',
    )
  }, [byRepo, toast])

  return (
    <PanelBackground>
      <div className="h-full flex flex-col p-6 gap-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[var(--c-text-bright)] tracking-tight">Results</h1>
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
              <RepoGroup
                key={repo}
                repo={repo}
                pods={repoPods}
                onMergeAll={handleMergeAll}
                onMerge={handleMerge}
                onRetry={handleRetry}
                mergingPodIds={mergingPodIds}
              />
            ))}
          </div>
        )}
      </div>
    </PanelBackground>
  )
}
