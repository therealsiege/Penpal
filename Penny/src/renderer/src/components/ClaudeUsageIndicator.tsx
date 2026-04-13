import { useState, useRef, useEffect } from 'react'
import { usePolling } from '../hooks/usePolling'

// ---------------------------------------------------------------------------
// Types — mirrors the scraper output shape from #162
// ---------------------------------------------------------------------------

interface UsageLimit {
  used: number
  limit: number
  resetAt: string | null // ISO date or human-readable
}

interface ClaudeUsageData {
  status: 'ok' | 'not-logged-in' | 'parse-error' | 'network-error'
  session?: UsageLimit & { percentUsed: number }
  weekly?: {
    allModels?: UsageLimit & { percentUsed: number }
    sonnet?: UsageLimit & { percentUsed: number }
  }
  extraUsage?: {
    spent: number
    limit: number
    balance: number
  }
  lastUpdated: string // ISO date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeUntil(isoOrHuman: string | null): string {
  if (!isoOrHuman) return ''
  const target = new Date(isoOrHuman)
  if (isNaN(target.getTime())) return isoOrHuman // already human-readable
  const now = Date.now()
  const diffMs = target.getTime() - now
  if (diffMs <= 0) return 'now'
  const hours = Math.floor(diffMs / 3_600_000)
  const mins = Math.floor((diffMs % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m ago`
}

function percentColor(pct: number): string {
  if (pct < 50) return 'bg-emerald-400'
  if (pct < 80) return 'bg-amber-400'
  return 'bg-red-400'
}

function percentTextColor(pct: number): string {
  if (pct < 50) return 'text-emerald-400'
  if (pct < 80) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-white/10 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${percentColor(percent)}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  )
}

function UsageRow({
  label,
  percent,
  resetAt,
}: {
  label: string
  percent: number
  resetAt: string | null
}) {
  const resetStr = formatTimeUntil(resetAt)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--c-text-secondary)]">{label}</span>
        <span className={`font-medium tabular-nums ${percentTextColor(percent)}`}>{Math.round(percent)}% used</span>
      </div>
      <ProgressBar percent={percent} />
      {resetStr && (
        <div className="text-[10px] text-[var(--c-text-faint)]">Resets in {resetStr}</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ClaudeUsageIndicator() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Poll cached usage data every 30s
  const { data: usage, loading, refresh } = usePolling<ClaudeUsageData>(
    () => (window as any).api.claudeUsage(),
    30_000,
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // -- Determine button content --
  const renderButton = () => {
    if (loading || !usage) {
      return (
        <button
          type="button"
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[var(--c-text-faint)] text-[13px] opacity-50 cursor-default"
          disabled
        >
          Usage
        </button>
      )
    }

    if (usage.status === 'not-logged-in') {
      return (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] text-[13px] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Login
        </button>
      )
    }

    if (usage.status === 'parse-error') {
      return (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/18 border border-amber-500/25 rounded-lg text-amber-400 text-[13px] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Usage
        </button>
      )
    }

    if (usage.status === 'network-error') {
      return (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/18 border border-red-500/25 rounded-lg text-red-400 text-[13px] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Usage
        </button>
      )
    }

    // OK state — show session usage %
    const pct = usage.session?.percentUsed ?? 0
    return (
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-lg text-[13px] transition-colors"
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${percentColor(pct)}`} />
        <span className={`font-medium tabular-nums ${percentTextColor(pct)}`}>{Math.round(pct)}%</span>
      </button>
    )
  }

  // -- Dropdown --
  const renderDropdown = () => {
    if (!open || !usage) return null

    return (
      <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[var(--c-text-primary)]">Claude.ai Usage</span>
          <button
            type="button"
            onClick={() => { refresh(); }}
            className="text-[11px] text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)] transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="p-4 space-y-4">
          {usage.status === 'not-logged-in' && (
            <div className="text-center py-4 space-y-3">
              <p className="text-[13px] text-[var(--c-text-secondary)]">Not logged in to Claude.ai</p>
              <button
                type="button"
                onClick={() => (window as any).api.openUrl('https://claude.ai')}
                className="px-4 py-1.5 rounded-lg bg-[var(--c-accent-blue)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
              >
                Log in to Claude.ai
              </button>
            </div>
          )}

          {usage.status === 'parse-error' && (
            <p className="text-[13px] text-amber-400">Could not parse usage data. The page format may have changed.</p>
          )}

          {usage.status === 'network-error' && (
            <p className="text-[13px] text-red-400">Network error fetching usage data.</p>
          )}

          {usage.status === 'ok' && (
            <>
              {/* Session usage */}
              {usage.session && (
                <UsageRow
                  label="Session"
                  percent={usage.session.percentUsed}
                  resetAt={usage.session.resetAt}
                />
              )}

              {/* Weekly limits */}
              {usage.weekly?.allModels && (
                <UsageRow
                  label="Weekly — All Models"
                  percent={usage.weekly.allModels.percentUsed}
                  resetAt={usage.weekly.allModels.resetAt}
                />
              )}
              {usage.weekly?.sonnet && (
                <UsageRow
                  label="Weekly — Sonnet"
                  percent={usage.weekly.sonnet.percentUsed}
                  resetAt={usage.weekly.sonnet.resetAt}
                />
              )}

              {/* Extra usage */}
              {usage.extraUsage && (
                <div className="pt-2 border-t border-[var(--c-border)]">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--c-text-secondary)]">Extra Usage</span>
                    <span className="text-[var(--c-text-primary)] tabular-nums">
                      ${usage.extraUsage.spent.toFixed(2)} / ${usage.extraUsage.limit.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--c-text-faint)] mt-0.5">
                    Balance: ${usage.extraUsage.balance.toFixed(2)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--c-border)]">
          <span className="text-[10px] text-[var(--c-text-faint)]">
            Last updated: {usage.lastUpdated ? formatRelativeTime(usage.lastUpdated) : 'never'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {renderButton()}
      {renderDropdown()}
    </div>
  )
}
