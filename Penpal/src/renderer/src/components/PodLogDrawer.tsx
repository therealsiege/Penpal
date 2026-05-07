import { useEffect, useRef, useState, useCallback } from 'react'

// Local mirror of the main-process `PodLogLine` shape — kept in sync with
// `src/main/pods.ts:PodLogLine`. Keeping the union narrow lets us style by
// stream/role without importing main-process modules into the renderer.
export interface PodLogEntry {
  podId: string
  agentRole: 'solver' | 'reviewer' | 'executor' | 'system'
  stream: 'stdout' | 'stderr' | 'system'
  line: string
  timestamp: number
  seq: number
}

interface PodLogDrawerProps {
  podId: string
  podName?: string
  /** Whether the pod is still running — controls the Live/Ended badge. */
  isLive: boolean
  onClose: () => void
}

const ROLE_BADGE: Record<PodLogEntry['agentRole'], { label: string; cls: string }> = {
  solver:   { label: 'S', cls: 'bg-amber-500/25 text-amber-300 border-amber-500/40' },
  reviewer: { label: 'R', cls: 'bg-violet-500/25 text-violet-300 border-violet-500/40' },
  executor: { label: 'E', cls: 'bg-blue-500/25 text-blue-300 border-blue-500/40' },
  system:   { label: '·', cls: 'bg-slate-500/25 text-slate-300 border-slate-500/40' },
}

function streamLineColor(stream: PodLogEntry['stream'], role: PodLogEntry['agentRole']): string {
  if (stream === 'stderr') return 'text-amber-300'
  if (stream === 'system' || role === 'system') return 'text-slate-400 italic'
  if (role === 'solver') return 'text-amber-100'
  if (role === 'reviewer') return 'text-violet-100'
  if (role === 'executor') return 'text-blue-100'
  return 'text-[var(--c-text-secondary)]'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/**
 * Slide-in drawer that subscribes to a single pod's live stdout/stderr stream.
 * Backlog (last ~500 lines) replays first, then live `pod:log` events append.
 */
export function PodLogDrawer({ podId, podName, isLive, onClose }: PodLogDrawerProps) {
  const [entries, setEntries] = useState<PodLogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterStderr, setFilterStderr] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const seqSeen = useRef<Set<number>>(new Set())

  const handleEntry = useCallback((entry: PodLogEntry) => {
    if (seqSeen.current.has(entry.seq)) return
    seqSeen.current.add(entry.seq)
    setEntries(prev => {
      // Hard cap to keep the DOM responsive — buffer 500 lines max in the UI.
      const next = prev.length >= 500 ? prev.slice(prev.length - 499) : prev.slice()
      next.push(entry)
      return next
    })
  }, [])

  // Subscribe on mount, unsubscribe on unmount or when podId changes.
  useEffect(() => {
    seqSeen.current = new Set()
    setEntries([])
    const unsubscribe = window.api.subscribePodLogs(podId, handleEntry)
    return () => { unsubscribe() }
  }, [podId, handleEntry])

  // Auto-scroll to bottom unless the user has scrolled up.
  useEffect(() => {
    if (!autoScroll) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries, autoScroll])

  // Detect manual scroll-away to disable auto-scroll.
  const onScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setAutoScroll(distanceFromBottom < 32)
  }, [])

  const visible = filterStderr ? entries.filter(e => e.stream === 'stderr') : entries

  const handleCopy = useCallback(async () => {
    const text = visible.map(e => `[${formatTime(e.timestamp)}] ${e.agentRole.toUpperCase()} ${e.stream}: ${e.line}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch { /* clipboard unavailable */ }
  }, [visible])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-label={`Live logs for ${podName ?? podId}`}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[720px] z-50 bg-[var(--c-bg-app)] border-l border-[var(--c-border)] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--c-border)] flex items-center gap-3 shrink-0">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[var(--c-text-heading)] truncate">
              {podName ?? podId}
            </div>
            <div className="text-[12px] text-[var(--c-text-faint)] font-mono truncate">{podId}</div>
          </div>
          <span
            className={[
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border',
              isLive
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-500/15 text-slate-300 border-slate-500/30',
            ].join(' ')}
            aria-live="polite"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
            {isLive ? 'Live' : 'Ended'}
          </span>
          <button
            type="button"
            onClick={() => setFilterStderr(v => !v)}
            className={[
              'text-[12px] px-2 py-1 rounded-md border transition-colors',
              filterStderr
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[var(--c-bg-elevated)] text-[var(--c-text-muted)] border-[var(--c-border)] hover:bg-[var(--c-bg-hover)]',
            ].join(' ')}
            title="Show only stderr lines"
          >
            stderr
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[12px] px-2 py-1 rounded-md bg-[var(--c-bg-elevated)] text-[var(--c-text-muted)] border border-[var(--c-border)] hover:bg-[var(--c-bg-hover)] transition-colors"
            title="Copy visible logs"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] text-[20px] leading-none px-1"
            aria-label="Close logs"
          >
            x
          </button>
        </div>

        {/* Stream */}
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto px-3 py-3 font-mono text-[12px] leading-[1.55] bg-[var(--c-bg-surface)]"
        >
          {visible.length === 0 ? (
            <div className="text-[var(--c-text-faint)] italic">
              {isLive ? 'Waiting for output…' : 'No logs captured for this pod.'}
            </div>
          ) : (
            visible.map(entry => {
              const badge = ROLE_BADGE[entry.agentRole]
              const colorCls = streamLineColor(entry.stream, entry.agentRole)
              return (
                <div key={entry.seq} className="flex items-start gap-2 py-[1px]">
                  <span className="text-[var(--c-text-faint)] tabular-nums shrink-0 select-none">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold border shrink-0 ${badge.cls}`}
                    title={entry.agentRole}
                  >
                    {badge.label}
                  </span>
                  <span className={`whitespace-pre-wrap break-all ${colorCls}`}>{entry.line}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--c-border)] flex items-center justify-between text-[11px] text-[var(--c-text-faint)] shrink-0">
          <span>{visible.length} line{visible.length === 1 ? '' : 's'}</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              className="accent-emerald-500"
            />
            Auto-scroll
          </label>
        </div>
      </div>
    </>
  )
}
