import { useEffect, useRef, useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import type { ClaudeUsage } from '../types'

// ── Color helpers ─────────────────────────────────────────────────────────────

function usageColor(fraction: number): { text: string; bg: string; bar: string } {
  if (fraction > 0.8) return { text: 'text-red-400', bg: 'bg-red-400/15', bar: 'bg-red-400' }
  if (fraction > 0.5) return { text: 'text-yellow-400', bg: 'bg-yellow-400/15', bar: 'bg-yellow-400' }
  return { text: 'text-green-400', bg: 'bg-green-400/15', bar: 'bg-green-400' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface UsageBarProps {
  fraction: number
  label: string
  sublabel: string
}

function UsageBar({ fraction, label, sublabel }: UsageBarProps) {
  const { bar } = usageColor(fraction)
  const pct = Math.round(fraction * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--c-text-secondary)]">{label}</span>
        <span className="text-[var(--c-text-muted)]">{sublabel}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--c-bg-elevated)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Collapsed button label / icon ─────────────────────────────────────────────

function CollapsedLabel({ usage, loading }: { usage: ClaudeUsage | null; loading: boolean }) {
  if (loading && !usage) {
    return <span className="opacity-50">Usage</span>
  }
  if (!usage) {
    return <span className="opacity-50">Usage</span>
  }
  if (usage.status === 'not-logged-in') {
    return (
      <>
        <span>🔑</span>
        <span>Login</span>
      </>
    )
  }
  if (usage.status === 'parse-error') {
    return <span className="text-orange-400">⚠</span>
  }
  if (usage.status === 'network-error') {
    return <span className="text-red-400">✕</span>
  }
  // ok
  const { text } = usageColor(usage.sessionUsedFraction)
  const pct = Math.round(usage.sessionUsedFraction * 100)
  return <span className={text}>{pct}%</span>
}

// ── Time ago ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClaudeUsageIndicator() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: usage, loading, refresh } = usePolling<ClaudeUsage>(
    () => window.api.claudeUsage(),
    30_000,
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Collapsed button color
  const btnColor = (() => {
    if (!usage || usage.status !== 'ok') return ''
    const { bg } = usageColor(usage.sessionUsedFraction)
    return bg
  })()

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 border border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)] ${btnColor || 'bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)]'}`}
      >
        <CollapsedLabel usage={usage} loading={loading} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-[var(--c-border)] bg-[var(--c-bg-surface)] shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--c-border)]">
            <span className="text-[12px] font-semibold text-[var(--c-text-primary)]">Claude.ai Usage</span>
            <button
              type="button"
              onClick={() => { void refresh() }}
              className="text-[11px] text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="p-3.5 flex flex-col gap-3">
            {/* Not logged in */}
            {usage?.status === 'not-logged-in' && (
              <div className="text-center py-2">
                <p className="text-[12px] text-[var(--c-text-secondary)] mb-2">Not logged in to Claude.ai</p>
                <a
                  href="https://claude.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-[var(--c-accent)] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Log in to Claude.ai →
                </a>
              </div>
            )}

            {/* Error states */}
            {(usage?.status === 'parse-error' || usage?.status === 'network-error') && (
              <div className="text-center py-2">
                <p className="text-[12px] text-[var(--c-text-muted)]">
                  {usage.status === 'network-error' ? 'Could not reach Claude.ai' : 'Unexpected response format'}
                </p>
              </div>
            )}

            {/* OK state */}
            {usage?.status === 'ok' && (
              <>
                {/* Session */}
                <div>
                  <p className="text-[11px] font-medium text-[var(--c-text-muted)] uppercase tracking-wide mb-1.5">Session</p>
                  <UsageBar
                    fraction={usage.sessionUsedFraction}
                    label="Rate limit"
                    sublabel={`Resets in ${usage.sessionResetsIn}`}
                  />
                </div>

                {/* Weekly limits */}
                <div>
                  <p className="text-[11px] font-medium text-[var(--c-text-muted)] uppercase tracking-wide mb-1.5">Weekly limits</p>
                  <div className="flex flex-col gap-2">
                    <UsageBar
                      fraction={usage.allModels.used}
                      label="All models"
                      sublabel={`${usage.allModels.label} · resets ${usage.allModels.resetsAt}`}
                    />
                    <UsageBar
                      fraction={usage.sonnetOnly.used}
                      label="Sonnet only"
                      sublabel={`${usage.sonnetOnly.label} · resets ${usage.sonnetOnly.resetsAt}`}
                    />
                  </div>
                </div>

                {/* Extra usage */}
                {usage.extraLimit > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-[var(--c-text-muted)] uppercase tracking-wide mb-1.5">Extra usage</p>
                    <p className="text-[12px] text-[var(--c-text-secondary)]">
                      ${usage.extraSpent.toFixed(2)} / ${usage.extraLimit.toFixed(2)}
                      {' '}
                      <span className="text-[var(--c-text-muted)]">(${usage.extraBalance.toFixed(2)} balance)</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Loading placeholder */}
            {loading && !usage && (
              <div className="py-4 text-center">
                <span className="text-[12px] text-[var(--c-text-muted)] animate-pulse">Loading…</span>
              </div>
            )}
          </div>

          {/* Footer */}
          {usage && (
            <div className="px-3.5 py-2 border-t border-[var(--c-border)]">
              <p className="text-[10px] text-[var(--c-text-muted)]">Last updated {timeAgo(usage.fetchedAt)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
