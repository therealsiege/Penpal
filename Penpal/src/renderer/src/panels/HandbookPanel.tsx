import { useMemo, useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { PanelBackground } from '../components/PanelBackground'
import { mergeCapabilityRows, type CapabilityRow } from '../capabilities/merge'

function statusTone(status: string): string {
  if (status.startsWith('ok')) return 'text-emerald-400/95'
  if (status.startsWith('unavailable') || status === 'unknown') return 'text-amber-400/95'
  if (status.startsWith('degraded')) return 'text-red-400/90'
  return 'text-[var(--c-text-primary)]'
}

function CapabilityAccordionRow({ row }: { row: CapabilityRow }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[var(--c-border)]/80 rounded-xl overflow-hidden bg-[color-mix(in_srgb,var(--c-bg-surface)_90%,transparent)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--c-bg-elevated)]/40 transition-colors"
      >
        <span className="font-semibold text-[var(--c-text-bright)]">{row.title}</span>
        <span className={`text-xs font-mono shrink-0 ${statusTone(row.status)}`}>{row.status}</span>
        <span className="text-[var(--c-text-muted)] text-xs w-6 text-right">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-[var(--c-border-subtle)]/80 text-sm text-[var(--c-text-secondary)] space-y-3">
          <p>{row.blurb}</p>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--c-text-muted)] mb-1">Validation</p>
            <ul className="list-disc pl-4 space-y-1 text-[var(--c-text-secondary)]">
              {row.validationSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export function HandbookPanel() {
  const { data: cap, error } = usePolling(
    () => window.api.capabilitiesStatus().catch(() => null),
    10_000,
  )

  const rows = useMemo(() => {
    if (!cap?.items) return []
    return mergeCapabilityRows(cap.items)
  }, [cap])

  const updated = cap?.updatedAt
    ? new Date(cap.updatedAt).toLocaleString()
    : '—'

  return (
    <div className="h-full flex flex-col min-h-0">
      <PanelBackground />
      <div className="relative z-10 flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
        <header className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-[var(--c-text-bright)] tracking-tight">Handbook</h1>
          <p className="text-[var(--c-text-muted)] text-sm mt-1">
            Live capability status merged with the validation catalog. Overall:{' '}
            <span className="text-emerald-400/90 font-mono">{cap?.overall ?? '—'}</span>
            {' · '}
            <span className="text-[var(--c-text-faint)]">Updated {updated}</span>
          </p>
          {error != null && (
            <p className="text-amber-400/90 text-sm mt-2">Could not refresh status (showing last snapshot).</p>
          )}
        </header>

        <div className="space-y-3 max-w-3xl">
          {rows.length === 0 && (
            <p className="text-[var(--c-text-muted)] text-sm">Loading capabilities…</p>
          )}
          {rows.map(row => (
            <CapabilityAccordionRow key={row.id} row={row} />
          ))}
        </div>

        {cap?.facets && (
          <section className="mt-10 max-w-3xl text-xs text-[var(--c-text-faint)] font-mono space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--c-text-muted)]">Facets (#54 / #55)</p>
            <pre className="bg-[var(--c-bg-chrome)] rounded-lg p-3 overflow-x-auto border border-[color-mix(in_srgb,var(--c-border)_80%,transparent)]">
              {JSON.stringify(cap.facets, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  )
}
