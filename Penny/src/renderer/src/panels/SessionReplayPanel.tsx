import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { ReplayEvent, ReplayRecording, ReplayRecordingWithEvents, RecorderStatus } from '../types'

interface AgentSnapshot {
  agentId: string
  agentName: string
  cwd?: string
  mode: string
  interactionType: string
  cpu?: string
  memoryMB?: number
  contextUtilization?: number
}

function computeStateAt(events: ReplayEvent[], playheadMs: number): Map<string, AgentSnapshot> {
  const states = new Map<string, AgentSnapshot>()
  for (const ev of events) {
    if (ev.t > playheadMs) break
    const current = states.get(ev.agentId)
    const base: AgentSnapshot = current ?? {
      agentId: ev.agentId,
      agentName: ev.agentName,
      cwd: ev.cwd,
      mode: 'idle',
      interactionType: 'none',
    }
    states.set(ev.agentId, {
      ...base,
      agentName: ev.agentName,
      cwd: ev.cwd ?? base.cwd,
      mode: ev.data.mode ?? base.mode,
      interactionType: ev.data.interactionType ?? base.interactionType,
      cpu: ev.data.cpu ?? base.cpu,
      memoryMB: ev.data.memoryMB ?? base.memoryMB,
      contextUtilization: ev.data.contextUtilization ?? base.contextUtilization,
    })
  }
  return states
}

function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString()
}

const MODE_COLORS: Record<string, string> = {
  working: '#3b82f6',
  plan: '#8b5cf6',
  'accept-edits': '#f59e0b',
  waiting: '#f97316',
  idle: '#6b7280',
  compressing: '#a3a3a3',
  error: '#ef4444',
  disconnected: '#374151',
  crashed: '#dc2626',
}

function getModeColor(mode: string): string {
  return MODE_COLORS[mode] ?? '#6b7280'
}

const SPEEDS = [1, 2, 4, 8] as const
type Speed = typeof SPEEDS[number]

export function SessionReplayPanel(): React.JSX.Element {
  const [recordings, setRecordings] = useState<ReplayRecording[]>([])
  const [selected, setSelected] = useState<ReplayRecordingWithEvents | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({ recording: false })

  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)

  const loadRecordings = useCallback(async () => {
    try {
      const result = await window.api.replayList()
      setRecordings(result)
    } catch {
      // ignore
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const status = await window.api.replayStatus()
      setRecorderStatus(status)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadRecordings()
    void refreshStatus()
    const interval = setInterval(() => { void refreshStatus() }, 2000)
    return () => clearInterval(interval)
  }, [loadRecordings, refreshStatus])

  // Playback RAF loop
  useEffect(() => {
    if (!isPlaying || !selected) return

    const tick = (now: number): void => {
      if (lastFrameRef.current !== null) {
        const delta = now - lastFrameRef.current
        setPlayheadMs(prev => {
          const next = prev + delta * speed
          if (next >= selected.durationMs) {
            setIsPlaying(false)
            return selected.durationMs
          }
          return next
        })
      }
      lastFrameRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }

    lastFrameRef.current = null
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, selected, speed])

  const handleSelectRecording = async (rec: ReplayRecording): Promise<void> => {
    try {
      const full = await window.api.replayLoad(rec.id)
      if (full) {
        setSelected(full)
        setPlayheadMs(0)
        setIsPlaying(false)
      }
    } catch {
      // ignore
    }
  }

  const handleStartRecording = async (): Promise<void> => {
    await window.api.replayStart()
    await refreshStatus()
  }

  const handleStopRecording = async (): Promise<void> => {
    await window.api.replayStop()
    await refreshStatus()
    await loadRecordings()
  }

  const handleDelete = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.api.replayDelete(id)
    if (selected?.id === id) setSelected(null)
    await loadRecordings()
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setIsPlaying(false)
    setPlayheadMs(Number(e.target.value))
  }

  const handlePlayPause = (): void => {
    if (selected && playheadMs >= selected.durationMs) {
      setPlayheadMs(0)
    }
    setIsPlaying(v => !v)
  }

  const currentStates = selected?.events
    ? computeStateAt(selected.events, playheadMs)
    : new Map<string, AgentSnapshot>()

  return (
    <div className="flex h-full bg-gray-950 text-gray-200 text-sm overflow-hidden">
      {/* Sidebar: recording list */}
      <div className="w-64 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <span className="font-semibold text-gray-100 text-sm">Session Replay</span>
          {recorderStatus.recording ? (
            <button
              onClick={() => { void handleStopRecording() }}
              className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium"
            >
              <span className="w-2 h-2 bg-white rounded-sm inline-block" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => { void handleStartRecording() }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
            >
              <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
              Record
            </button>
          )}
        </div>

        {recorderStatus.recording && (
          <div className="px-3 py-2 bg-red-950/40 border-b border-red-900/40">
            <div className="flex items-center gap-1.5 text-xs text-red-300">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              Recording...
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {recorderStatus.eventCount ?? 0} events captured
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {recordings.length === 0 ? (
            <div className="p-4 text-gray-500 text-xs text-center leading-relaxed">
              No recordings yet.
              <br />Press Record to start.
            </div>
          ) : (
            recordings.map(rec => (
              <div
                key={rec.id}
                onClick={() => { void handleSelectRecording(rec) }}
                className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                  selected?.id === rec.id ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-gray-100 font-medium truncate text-xs">{rec.label}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{formatDate(rec.startedAt)}</div>
                    <div className="text-gray-500 text-xs flex gap-2 mt-0.5">
                      <span>{formatMs(rec.durationMs)}</span>
                      <span>·</span>
                      <span>{rec.eventCount} events</span>
                      <span>·</span>
                      <span>{rec.agentIds.length} agents</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { void handleDelete(rec.id, e) }}
                    className="text-gray-600 hover:text-red-400 text-base flex-shrink-0 leading-none mt-0.5"
                    title="Delete recording"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area: playback */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
            <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
            </svg>
            <span className="text-sm">Select a recording to replay</span>
          </div>
        ) : (
          <>
            {/* Controls bar */}
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
              <div className="text-gray-100 font-medium truncate text-sm flex-1">{selected.label}</div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Speed controls */}
                <div className="flex items-center gap-1">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
                        speed === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                {/* Play/Pause */}
                <button
                  onClick={handlePlayPause}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium transition-colors"
                >
                  {isPlaying
                    ? 'Pause'
                    : playheadMs >= selected.durationMs
                      ? 'Replay'
                      : 'Play'}
                </button>

                {/* Reset */}
                <button
                  onClick={() => { setIsPlaying(false); setPlayheadMs(0) }}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Timeline scrubber */}
            <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
              <span className="text-gray-500 text-xs font-mono w-12 text-right tabular-nums">
                {formatMs(playheadMs)}
              </span>
              <input
                type="range"
                min={0}
                max={selected.durationMs}
                value={playheadMs}
                onChange={handleScrub}
                className="flex-1 accent-blue-500 cursor-pointer"
                style={{ height: '6px' }}
              />
              <span className="text-gray-500 text-xs font-mono w-12 tabular-nums">
                {formatMs(selected.durationMs)}
              </span>
            </div>

            {/* Agent timeline lanes */}
            {selected.agentIds.length > 0 && (
              <div className="border-b border-gray-800 flex-shrink-0 bg-gray-900/50">
                {selected.agentIds.slice(0, 8).map(agentId => {
                  const agentEvents = selected.events.filter(e => e.agentId === agentId)
                  const firstEv = agentEvents[0]
                  const agentName = firstEv?.agentName ?? agentId
                  const modeEvents = agentEvents.filter(
                    e => e.type === 'mode-change' || e.type === 'snapshot',
                  )

                  return (
                    <div
                      key={agentId}
                      className="flex items-center px-4 py-1 gap-2 border-b border-gray-800/40 last:border-0"
                    >
                      <div
                        className="text-gray-500 text-xs w-24 truncate flex-shrink-0"
                        title={agentName}
                      >
                        {agentName}
                      </div>
                      <div className="flex-1 relative h-4 bg-gray-900 rounded overflow-hidden">
                        {modeEvents.map((ev, i) => {
                          const segStart = (ev.t / selected.durationMs) * 100
                          const nextT = modeEvents[i + 1]?.t ?? selected.durationMs
                          const segWidth = ((nextT - ev.t) / selected.durationMs) * 100
                          if (segWidth <= 0) return null
                          return (
                            <div
                              key={`${ev.t}-${i}`}
                              className="absolute top-0 h-full opacity-75"
                              style={{
                                left: `${segStart}%`,
                                width: `${segWidth}%`,
                                backgroundColor: getModeColor(ev.data.mode ?? 'idle'),
                              }}
                            />
                          )
                        })}
                        {/* Sub-agent start markers */}
                        {agentEvents
                          .filter(e => e.type === 'sub-agent-start')
                          .map((ev, i) => (
                            <div
                              key={`sa-${i}`}
                              className="absolute top-0 h-full w-0.5 bg-yellow-400/80 z-10"
                              style={{ left: `${(ev.t / selected.durationMs) * 100}%` }}
                              title={`Sub-agent: ${ev.data.subAgentDescription ?? ''}`}
                            />
                          ))}
                        {/* Playhead */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-white/90 z-20"
                          style={{ left: `${(playheadMs / selected.durationMs) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Current agent state cards */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">
                Agent State — {formatMs(playheadMs)}
              </div>
              {currentStates.size === 0 ? (
                <div className="text-gray-600 text-xs">No agent data at this point in the recording</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {[...currentStates.values()].map(state => (
                    <div
                      key={state.agentId}
                      className="bg-gray-900 rounded-lg border border-gray-800 p-3 flex items-start gap-3"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: getModeColor(state.mode) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-gray-100 font-medium text-xs">{state.agentName}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{
                              backgroundColor: `${getModeColor(state.mode)}22`,
                              color: getModeColor(state.mode),
                            }}
                          >
                            {state.mode}
                          </span>
                          {state.interactionType !== 'none' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400">
                              {state.interactionType}
                            </span>
                          )}
                        </div>
                        {state.cwd && (
                          <div className="text-gray-600 text-xs mt-0.5 truncate" title={state.cwd}>
                            {state.cwd}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          {state.cpu !== undefined && <span>CPU {state.cpu}</span>}
                          {state.memoryMB !== undefined && <span>{state.memoryMB}MB</span>}
                          {state.contextUtilization !== undefined && (
                            <span>ctx {(state.contextUtilization * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
