/**
 * ReplayPanel — Session replay record and playback
 *
 * Records agent state transitions + task events with timestamps.
 * Supports 1×/2×/4×/8× playback, timeline scrubber, and up to 24h recordings.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RecordingMeta, Recording, ReplayEvent, AgentSnapshot } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SPEEDS = [1, 2, 4, 8] as const
type PlaybackSpeed = (typeof SPEEDS)[number]

// ── State reconstruction ──────────────────────────────────────────────────────

/**
 * Reconstruct agent snapshots at a given timestamp by replaying events up to `atTs`.
 * Uses the most recent snapshot before `atTs` as baseline, then applies state-transitions.
 */
function reconstructStateAt(events: ReplayEvent[], atTs: number): AgentSnapshot[] {
  // Find the last snapshot at or before atTs
  let baselineAgents: AgentSnapshot[] = []
  for (const ev of events) {
    if (ev.timestamp > atTs) break
    if (ev.type === 'snapshot' && ev.data.agents) {
      baselineAgents = ev.data.agents
    }
  }

  // Build a mutable map from baseline
  const agentMap = new Map<string, AgentSnapshot>()
  for (const a of baselineAgents) {
    agentMap.set(a.agentId, { ...a })
  }

  // Apply state-transitions after the baseline snapshot
  const baselineTs = baselineAgents.length > 0
    ? Math.max(...events.filter(e => e.type === 'snapshot' && e.data.agents && e.timestamp <= atTs).map(e => e.timestamp))
    : 0

  for (const ev of events) {
    if (ev.timestamp <= baselineTs || ev.timestamp > atTs) continue
    if (ev.type === 'state-transition') {
      const existing = agentMap.get(ev.agentId)
      if (existing) {
        if (ev.data.toStatus) existing.status = ev.data.toStatus
        if (ev.data.toMode !== undefined) existing.sessionMode = ev.data.toMode
        if (ev.data.cwd) existing.cwd = ev.data.cwd
        if (ev.data.contextUtilization !== undefined) existing.contextUtilization = ev.data.contextUtilization
        if (ev.data.cpu) existing.cpu = ev.data.cpu
        if (ev.data.memoryMB !== undefined) existing.memoryMB = ev.data.memoryMB
      }
    }
  }

  return Array.from(agentMap.values())
}

/** Get task events up to atTs (for display in timeline). */
function getVisibleEvents(events: ReplayEvent[], atTs: number, limit = 30): ReplayEvent[] {
  return events
    .filter(e => e.timestamp <= atTs && e.type !== 'snapshot')
    .slice(-limit)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    idle: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    sleeping: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    working: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    waiting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    crashed: 'bg-red-600/20 text-red-500 border-red-600/30',
  }
  const cls = colors[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${cls}`}>
      {status}
    </span>
  )
}

function EventIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: string; color: string }> = {
    'task-dispatched': { icon: '→', color: 'text-blue-400' },
    'task-completed': { icon: '✓', color: 'text-green-400' },
    'task-failed': { icon: '✗', color: 'text-red-400' },
    'state-transition': { icon: '⇄', color: 'text-purple-400' },
    snapshot: { icon: '◉', color: 'text-slate-500' },
  }
  const { icon, color } = icons[type] ?? { icon: '•', color: 'text-slate-400' }
  return <span className={`font-mono text-sm ${color}`}>{icon}</span>
}

function AgentCard({ agent }: { agent: AgentSnapshot }) {
  const utilPct = agent.contextUtilization != null ? Math.round(agent.contextUtilization * 100) : null
  return (
    <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--c-text-primary)] text-xs font-semibold truncate">{agent.agentName}</span>
        <StatusBadge status={agent.status} />
      </div>
      {agent.sessionMode && agent.sessionMode !== 'idle' && (
        <div className="flex items-center gap-1">
          <span className="text-[var(--c-text-muted)] text-[10px]">mode:</span>
          <StatusBadge status={agent.sessionMode} />
        </div>
      )}
      {agent.cwd && (
        <p className="text-[var(--c-text-faint)] text-[10px] font-mono truncate" title={agent.cwd}>
          {agent.cwd.split('/').slice(-2).join('/')}
        </p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-[var(--c-text-muted)]">
        {agent.cpu && <span>CPU {agent.cpu}</span>}
        {agent.memoryMB != null && <span>{agent.memoryMB}MB</span>}
        {utilPct != null && (
          <span className={utilPct >= 85 ? 'text-orange-400' : ''}>ctx {utilPct}%</span>
        )}
      </div>
      {utilPct != null && (
        <div className="h-1 rounded-full bg-[var(--c-bg-hover)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilPct >= 85 ? 'bg-orange-400' : 'bg-[var(--c-accent)]'}`}
            style={{ width: `${Math.min(100, utilPct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── RecordingListItem ─────────────────────────────────────────────────────────

function RecordingListItem({
  rec,
  isSelected,
  onSelect,
  onDelete,
}: {
  rec: RecordingMeta
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
        isSelected
          ? 'bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)]'
          : 'bg-[var(--c-bg-surface)] border-[var(--c-border)] hover:bg-[var(--c-bg-elevated)]'
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {rec.isActive && (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              REC
            </span>
          )}
          <p className="text-xs font-semibold text-[var(--c-text-primary)] truncate">{rec.label}</p>
        </div>
        <p className="text-[10px] text-[var(--c-text-muted)]">
          {formatDate(rec.startedAt)} · {formatDuration(rec.durationMs)} · {rec.eventCount} events
        </p>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/15 text-[var(--c-text-faint)] hover:text-red-400"
        title="Delete recording"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ReplayPanel() {
  // Recording state
  const [recordings, setRecordings] = useState<RecordingMeta[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordingLabel, setRecordingLabel] = useState('')
  const [loadingRec, setLoadingRec] = useState(false)

  // Loaded recording for playback
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadedRecording, setLoadedRecording] = useState<Recording | null>(null)
  const [loadingPlayback, setLoadingPlayback] = useState(false)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [scrubberPos, setScrubberPos] = useState(0) // 0–1
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTickRef = useRef<number>(0)

  const refreshList = useCallback(async () => {
    try {
      const list = await window.api.replayList()
      setRecordings(list)
    } catch { /* ignore */ }
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const status = await window.api.replayStatus()
      setIsRecording(status.active)
      setRecordingId(status.recordingId)
    } catch { /* ignore */ }
  }, [])

  // Poll status + list while mounted
  useEffect(() => {
    refreshList()
    refreshStatus()
    const id = setInterval(() => {
      refreshList()
      refreshStatus()
    }, 5_000)
    return () => clearInterval(id)
  }, [refreshList, refreshStatus])

  // Playback ticker
  useEffect(() => {
    if (!isPlaying || !loadedRecording) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
      return
    }

    const totalMs = Math.max(1, (loadedRecording.endedAt ?? loadedRecording.startedAt) - loadedRecording.startedAt)
    lastTickRef.current = Date.now()

    playIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - lastTickRef.current) * speed
      lastTickRef.current = now

      setScrubberPos(prev => {
        const next = prev + elapsed / totalMs
        if (next >= 1) {
          setIsPlaying(false)
          return 1
        }
        return next
      })
    }, 50)

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
    }
  }, [isPlaying, speed, loadedRecording])

  const handleStartRecording = async () => {
    setLoadingRec(true)
    try {
      const result = await window.api.replayStart(recordingLabel || undefined)
      setRecordingId(result.id)
      setIsRecording(true)
      setRecordingLabel('')
      await refreshList()
    } catch (err) {
      console.error('[replay] start failed:', err)
    } finally {
      setLoadingRec(false)
    }
  }

  const handleStopRecording = async () => {
    setLoadingRec(true)
    try {
      await window.api.replayStop()
      setIsRecording(false)
      setRecordingId(null)
      await refreshList()
    } catch (err) {
      console.error('[replay] stop failed:', err)
    } finally {
      setLoadingRec(false)
    }
  }

  const handleSelectRecording = async (id: string) => {
    if (selectedId === id) return
    setSelectedId(id)
    setLoadingPlayback(true)
    setIsPlaying(false)
    setScrubberPos(0)
    try {
      const rec = await window.api.replayGet(id)
      setLoadedRecording(rec)
    } catch (err) {
      console.error('[replay] load failed:', err)
    } finally {
      setLoadingPlayback(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.api.replayDelete(id)
      if (selectedId === id) {
        setSelectedId(null)
        setLoadedRecording(null)
        setIsPlaying(false)
      }
      await refreshList()
    } catch (err) {
      console.error('[replay] delete failed:', err)
    }
  }

  // Derived playback values
  const totalMs = loadedRecording
    ? Math.max(1, (loadedRecording.endedAt ?? loadedRecording.startedAt) - loadedRecording.startedAt)
    : 1
  const currentTs = loadedRecording
    ? loadedRecording.startedAt + Math.round(scrubberPos * totalMs)
    : 0
  const visibleAgents = loadedRecording
    ? reconstructStateAt(loadedRecording.events, currentTs)
    : []
  const visibleEvents = loadedRecording
    ? getVisibleEvents(loadedRecording.events, currentTs)
    : []

  return (
    <div className="flex h-full min-h-0 bg-[var(--c-bg-deep)]">
      {/* Left sidebar: recording controls + list */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-[var(--c-bg-hover)] bg-[var(--c-bg-chrome)]">
        {/* Recording controls */}
        <div className="p-4 border-b border-[var(--c-bg-hover)] space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : 'bg-[var(--c-text-faint)]'}`} />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--c-text-muted)]">
              Session Replay
            </h2>
          </div>

          {!isRecording && (
            <input
              type="text"
              placeholder="Recording label (optional)"
              value={recordingLabel}
              onChange={e => setRecordingLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStartRecording() }}
              className="w-full text-xs bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-[var(--c-text-primary)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
            />
          )}

          <button
            type="button"
            disabled={loadingRec}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-xl px-4 py-2 transition-colors ${
              isRecording
                ? 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25'
                : 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_20%,transparent)]'
            } disabled:opacity-50`}
          >
            {isRecording ? (
              <>
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                Stop Recording
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--c-accent)]" />
                Start Recording
              </>
            )}
          </button>

          {isRecording && recordingId && (
            <p className="text-[10px] text-[var(--c-text-faint)] font-mono truncate">
              ID: {recordingId}
            </p>
          )}
        </div>

        {/* Recordings list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-[var(--c-text-muted)] px-1 mb-2">
            Saved Recordings
          </p>
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <svg className="w-8 h-8 text-[var(--c-text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="10 15 10 9 14 9 14 15 10 15" />
                <line x1="12" y1="5" x2="12" y2="7" />
              </svg>
              <p className="text-xs text-[var(--c-text-faint)]">No recordings yet</p>
              <p className="text-[10px] text-[var(--c-text-muted)]">Start a recording to capture<br />agent activity</p>
            </div>
          ) : (
            recordings.map(rec => (
              <RecordingListItem
                key={rec.id}
                rec={rec}
                isSelected={selectedId === rec.id}
                onSelect={() => handleSelectRecording(rec.id)}
                onDelete={() => handleDelete(rec.id)}
              />
            ))
          )}
        </div>

        <div className="p-3 border-t border-[var(--c-bg-hover)]">
          <p className="text-[10px] text-[var(--c-text-faint)]">Max 24h per recording</p>
        </div>
      </aside>

      {/* Main content: playback */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!selectedId || !loadedRecording ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            {loadingPlayback ? (
              <div className="text-[var(--c-text-muted)] text-sm">Loading recording…</div>
            ) : (
              <>
                <svg className="w-12 h-12 text-[var(--c-text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[var(--c-text-secondary)]">Select a recording to play</p>
                  <p className="text-xs text-[var(--c-text-faint)] mt-1">Choose a recording from the list on the left</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Playback header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--c-bg-hover)] space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-sm font-bold text-[var(--c-text-primary)]">{loadedRecording.label}</h1>
                  <p className="text-[10px] text-[var(--c-text-muted)] mt-0.5">
                    {formatDate(loadedRecording.startedAt)}
                    {' · '}
                    {loadedRecording.eventCount} events
                    {' · '}
                    {formatDuration(totalMs)} total
                  </p>
                </div>
                {/* Speed controls */}
                <div className="flex items-center gap-1">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`text-[10px] font-mono px-2 py-1 rounded-lg transition-colors ${
                        speed === s
                          ? 'bg-[color-mix(in_srgb,var(--c-accent)_15%,transparent)] text-[var(--c-accent)] border border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)]'
                          : 'text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] border border-transparent hover:bg-[var(--c-bg-elevated)]'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline scrubber */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={10000}
                  value={Math.round(scrubberPos * 10000)}
                  onChange={e => {
                    setIsPlaying(false)
                    setScrubberPos(parseInt(e.target.value) / 10000)
                  }}
                  className="w-full h-1.5 accent-[var(--c-accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[var(--c-text-faint)] font-mono">
                  <span>{formatTime(loadedRecording.startedAt)}</span>
                  <span className="text-[var(--c-text-secondary)]">{formatTime(currentTs)}</span>
                  <span>{formatTime(loadedRecording.endedAt ?? loadedRecording.startedAt)}</span>
                </div>
              </div>

              {/* Play controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setIsPlaying(false); setScrubberPos(0) }}
                  title="Rewind to start"
                  className="p-1.5 rounded-lg text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] hover:bg-[var(--c-bg-elevated)] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlaying(p => !p)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--c-accent)] text-white hover:opacity-90 transition-opacity"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsPlaying(false); setScrubberPos(1) }}
                  title="Jump to end"
                  className="p-1.5 rounded-lg text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] hover:bg-[var(--c-bg-elevated)] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zm2.5-6L14 16V8z" />
                    <path d="M16 6h2v12h-2z" />
                  </svg>
                </button>

                <span className="text-[10px] font-mono text-[var(--c-text-muted)] ml-1">
                  {formatDuration(Math.round(scrubberPos * totalMs))} / {formatDuration(totalMs)}
                </span>
              </div>
            </div>

            {/* Content: agents + event log */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Agent state cards */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <p className="text-[10px] uppercase tracking-widest text-[var(--c-text-muted)] mb-3">
                  Agent States at {formatTime(currentTs)}
                </p>
                {visibleAgents.length === 0 ? (
                  <p className="text-xs text-[var(--c-text-faint)]">No agent data at this point in the recording</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {visibleAgents.map(agent => (
                      <AgentCard key={agent.agentId} agent={agent} />
                    ))}
                  </div>
                )}
              </div>

              {/* Event log */}
              <div className="w-72 shrink-0 border-l border-[var(--c-bg-hover)] flex flex-col">
                <div className="shrink-0 px-4 pt-4 pb-2">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--c-text-muted)]">Event Log</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1">
                  {visibleEvents.length === 0 ? (
                    <p className="text-[10px] text-[var(--c-text-faint)] px-1 pt-2">No events yet</p>
                  ) : (
                    [...visibleEvents].reverse().map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--c-bg-surface)] transition-colors"
                      >
                        <EventIcon type={ev.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-[var(--c-text-primary)] leading-tight">
                            {ev.agentId !== '__system__' && (
                              <span className="font-semibold text-[var(--c-accent)]">{ev.agentName} </span>
                            )}
                            {ev.type === 'task-dispatched' && `started: ${ev.data.taskTitle ?? '—'}`}
                            {ev.type === 'task-completed' && `completed: ${ev.data.taskTitle ?? '—'}`}
                            {ev.type === 'task-failed' && `failed: ${ev.data.taskTitle ?? '—'}`}
                            {ev.type === 'state-transition' && (
                              <>
                                {ev.data.fromStatus} → {ev.data.toStatus}
                                {ev.data.toMode && ` (${ev.data.toMode})`}
                              </>
                            )}
                          </p>
                          <p className="text-[9px] text-[var(--c-text-faint)] font-mono mt-0.5">
                            {formatTime(ev.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
