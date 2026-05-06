import { useState, useEffect } from 'react'
import type { GithubPollerStatus } from '../types'

export function githubPollStatusPresentation(status: GithubPollerStatus | null): {
  label: string
  badgeClass: string
} {
  if (!status) {
    return {
      label: '…',
      badgeClass:
        'bg-[color-mix(in_srgb,var(--c-border)_50%,transparent)] text-[var(--c-border-hover)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]',
    }
  }
  if (status.polling) {
    return {
      label: 'Polling',
      badgeClass:
        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse',
    }
  }
  if (status.running) {
    return {
      label: 'Ready',
      badgeClass: 'bg-emerald-500/10 text-emerald-300/90 border-emerald-500/25',
    }
  }
  return {
    label: 'Stopped',
    badgeClass:
      'bg-[color-mix(in_srgb,var(--c-border)_50%,transparent)] text-[var(--c-border-hover)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]',
  }
}

export function GithubPollStatusBadge({
  status,
  className = 'text-[length:var(--penny-task-fs-11)]',
}: {
  status: GithubPollerStatus | null
  className?: string
}) {
  const { label, badgeClass } = githubPollStatusPresentation(status)
  return (
    <span className={`${className} px-2 py-0.5 rounded-full border ${badgeClass}`}>
      {label}
    </span>
  )
}

export type WatchedRepoRow = { owner: string; repo: string; localPath: string }

export function SourcesModal({
  open,
  onClose,
  onReposChanged,
}: {
  open: boolean
  onClose: () => void
  onReposChanged?: () => void
}) {
  const [repos, setRepos] = useState<WatchedRepoRow[]>([])
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [addRepoError, setAddRepoError] = useState<string | null>(null)

  async function refreshRepos() {
    try {
      const r = await window.api.githubListRepos()
      if (Array.isArray(r)) setRepos(r)
    } catch { /* */ }
  }

  useEffect(() => {
    if (!open) return
    void refreshRepos()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" data-disable-office-hotkeys="true">
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl w-[min(92vw,480px)] max-h-[min(85vh,560px)] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
          <h2 className="text-[length:var(--penny-task-fs-18)] font-semibold text-[var(--c-text-primary)]">Sources</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] text-[length:var(--penny-task-fs-20)] leading-none"
          >
            x
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[length:var(--penny-task-fs-14)] font-medium text-[var(--c-text-primary)]">GitHub Issues</h3>
              <button
                type="button"
                onClick={() => setShowAddRepo(true)}
                className="px-2.5 py-1 text-[length:var(--penny-task-fs-12)] rounded-md bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)] border border-[var(--c-border)] hover:bg-[var(--c-border-subtle)] transition-colors"
              >
                + Add repository
              </button>
            </div>
            <p className="text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)] mb-3">
              Watched repositories are polled for <code className="px-1 py-0.5 rounded bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)]">agent-ready</code> issues.
            </p>
            {repos.length === 0 ? (
              <p className="text-[length:var(--penny-task-fs-12)] text-[var(--c-border-hover)]">No repositories yet.</p>
            ) : (
              <ul className="space-y-2">
                {repos.map((r) => (
                  <li
                    key={`${r.owner}/${r.repo}`}
                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,var(--c-bg-elevated)_70%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[length:var(--penny-task-fs-13)] text-[var(--c-text-primary)] font-mono truncate">
                        {r.owner}/{r.repo}
                      </div>
                      {r.localPath && (
                        <div className="text-[length:var(--penny-task-fs-11)] text-[var(--c-text-muted)] truncate mt-0.5" title={r.localPath}>
                          {r.localPath}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await window.api.githubRemoveRepo(r.owner, r.repo)
                        await refreshRepos()
                        onReposChanged?.()
                      }}
                      className="shrink-0 text-[length:var(--penny-task-fs-11)] text-red-400/70 hover:text-red-400 px-2 py-1 rounded border border-transparent hover:border-red-500/30"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[length:var(--penny-task-fs-14)] font-medium text-[var(--c-text-primary)] mb-2">Linear</h3>
            <div className="px-3 py-3 rounded-lg border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-elevated)_40%,transparent)] text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)]">
              Coming soon — Linear will be available as a source type in a future release.
            </div>
          </section>
        </div>
      </div>

      {showAddRepo && (
        <AddRepoWatchModal
          error={addRepoError}
          onSubmit={async (owner, repo, localPath) => {
            const result = await window.api.githubAddRepo(owner, repo, localPath) as { ok?: boolean; error?: string }
            if (result?.error) {
              setAddRepoError(result.error)
              return
            }
            setAddRepoError(null)
            setShowAddRepo(false)
            await refreshRepos()
            onReposChanged?.()
          }}
          onClose={() => { setAddRepoError(null); setShowAddRepo(false) }}
        />
      )}
    </div>
  )
}

function AddRepoWatchModal({
  onSubmit,
  onClose,
  error,
}: {
  onSubmit: (owner: string, repo: string, localPath: string) => void
  onClose: () => void
  error?: string | null
}) {
  const [repoUrl, setRepoUrl] = useState('')
  const [localPath, setLocalPath] = useState('')

  const parsed = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/) || repoUrl.match(/^([^/\s]+)\/([^/\s]+)$/)
  const owner = parsed?.[1] || ''
  const repo = parsed?.[2]?.replace(/\.git$/, '') || ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55">
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl w-[440px] p-5 space-y-4 shadow-2xl">
        <h3 className="text-[length:var(--penny-task-fs-18)] font-semibold text-[var(--c-text-primary)]">Watch repository</h3>
        <div>
          <label className="text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)] mb-1 block">Repository (URL or owner/repo)</label>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g. org/repo or https://github.com/org/repo"
            className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-[var(--c-accent-blue)]"
          />
          {owner && repo && (
            <p className="text-[length:var(--penny-task-fs-12)] text-[var(--c-accent-blue)] mt-1">
              {owner}/{repo}
            </p>
          )}
        </div>
        <div>
          <label className="text-[length:var(--penny-task-fs-12)] text-[var(--c-text-muted)] mb-1 block">Local clone path (for agent cwd)</label>
          <input
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="e.g. ~/workspace/org/repo"
            className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[length:var(--penny-task-fs-14)] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-[var(--c-accent-blue)]"
          />
        </div>
        {error && (
          <p className="text-[length:var(--penny-task-fs-12)] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[length:var(--penny-task-fs-14)] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (owner && repo && localPath.trim()) onSubmit(owner, repo, localPath.trim())
            }}
            disabled={!owner || !repo || !localPath.trim()}
            className="px-4 py-2 text-[length:var(--penny-task-fs-14)] bg-[var(--c-accent)] hover:bg-[#00cc6e] disabled:opacity-30 text-[var(--c-bg-chrome)] font-medium rounded-lg"
          >
            Watch
          </button>
        </div>
      </div>
    </div>
  )
}
