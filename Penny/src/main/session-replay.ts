/**
 * Session Replay — record and playback agent activity
 *
 * Records agent state transitions + task events with timestamps to JSON.
 * Max 24h recording window. Supports multiple saved recordings.
 */

import fs from 'fs'
import path from 'path'
import { orchestratorEvents } from './orchestrator'
import { atomicWrite } from './atomic-store'
import type { AgentState, AgentStatus, SessionMode } from './agents'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RECORDING_DURATION_MS = 24 * 60 * 60 * 1000 // 24h
const POLL_INTERVAL_MS = 5_000 // poll agent states every 5 seconds
const PERSIST_EVERY_N_EVENTS = 50

// ── Types ────────────────────────────────────────────────────────────────────

export type ReplayEventType =
  | 'state-transition'
  | 'task-dispatched'
  | 'task-completed'
  | 'task-failed'
  | 'snapshot'

export interface AgentSnapshot {
  agentId: string
  agentName: string
  status: AgentStatus
  sessionMode?: SessionMode
  cwd?: string
  cpu?: string
  memoryMB?: number
  contextUtilization?: number
  needsInteraction?: boolean
}

export interface ReplayEvent {
  id: string
  timestamp: number
  type: ReplayEventType
  agentId: string
  agentName: string
  data: {
    fromStatus?: AgentStatus
    toStatus?: AgentStatus
    fromMode?: SessionMode
    toMode?: SessionMode
    taskTitle?: string
    taskId?: string
    taskPriority?: string
    message?: string
    sessionId?: string
    cwd?: string
    contextUtilization?: number
    cpu?: string
    memoryMB?: number
    agents?: AgentSnapshot[]
  }
}

export interface RecordingMeta {
  id: string
  label: string
  startedAt: number
  endedAt?: number
  eventCount: number
  durationMs: number
  isActive: boolean
}

export interface Recording extends RecordingMeta {
  events: ReplayEvent[]
}

// ── Recorder ─────────────────────────────────────────────────────────────────

class SessionReplayRecorder {
  private recordings = new Map<string, Recording>()
  private activeRecordingId: string | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private prevAgentStates = new Map<string, { status: AgentStatus; sessionMode?: SessionMode }>()
  private replaysDir: string
  private getAgentStatesFn: (() => Promise<AgentState[]>) | null = null
  private eventCounter = 0

  constructor(dataDir: string) {
    this.replaysDir = path.join(dataDir, 'replays')
    this.ensureDir()
    this.loadExistingRecordings()
  }

  /** Inject the agent-states fetcher after initialization (avoids circular deps). */
  setAgentStatesFn(fn: () => Promise<AgentState[]>): void {
    this.getAgentStatesFn = fn
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  startRecording(label?: string): string {
    // Stop any active recording first
    if (this.activeRecordingId) {
      this.stopRecording()
    }

    const id = `replay-${Date.now()}`
    const ts = Date.now()
    const recording: Recording = {
      id,
      label: label?.trim() || new Date(ts).toLocaleString(),
      startedAt: ts,
      eventCount: 0,
      durationMs: 0,
      isActive: true,
      events: [],
    }
    this.recordings.set(id, recording)
    this.activeRecordingId = id

    this.hookOrchestratorEvents()
    this.startPolling()

    console.log(`[replay] Recording started: ${id}`)
    return id
  }

  stopRecording(): RecordingMeta | null {
    if (!this.activeRecordingId) return null
    const recording = this.recordings.get(this.activeRecordingId)
    if (!recording) return null

    const now = Date.now()
    recording.endedAt = now
    recording.durationMs = now - recording.startedAt
    recording.isActive = false

    this.stopPolling()
    this.unhookOrchestratorEvents()
    const stoppedId = this.activeRecordingId
    this.activeRecordingId = null
    this.prevAgentStates.clear()

    this.persistRecording(recording)
    console.log(`[replay] Recording stopped: ${stoppedId} (${recording.events.length} events)`)

    return this.toMeta(recording)
  }

  getStatus(): { active: boolean; recordingId: string | null; startedAt: number | null; durationMs: number } {
    const active = this.activeRecordingId !== null
    const recording = active ? this.recordings.get(this.activeRecordingId!) : null
    return {
      active,
      recordingId: this.activeRecordingId,
      startedAt: recording?.startedAt ?? null,
      durationMs: recording ? Date.now() - recording.startedAt : 0,
    }
  }

  listRecordings(): RecordingMeta[] {
    const now = Date.now()
    return Array.from(this.recordings.values())
      .filter(r => now - r.startedAt < MAX_RECORDING_DURATION_MS)
      .map(r => this.toMeta(r))
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  getRecording(id: string): Recording | null {
    return this.recordings.get(id) ?? null
  }

  deleteRecording(id: string): boolean {
    if (this.activeRecordingId === id) {
      this.stopRecording()
    }
    if (!this.recordings.has(id)) return false
    this.recordings.delete(id)
    const filePath = path.join(this.replaysDir, `${id}.json`)
    try { fs.unlinkSync(filePath) } catch { /* already gone */ }
    return true
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private toMeta(r: Recording): RecordingMeta {
    const now = Date.now()
    return {
      id: r.id,
      label: r.label,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      eventCount: r.events.length,
      durationMs: r.isActive ? now - r.startedAt : (r.durationMs ?? 0),
      isActive: r.isActive,
    }
  }

  private nextEventId(): string {
    return `evt-${Date.now()}-${this.eventCounter++}`
  }

  private addEvent(event: Omit<ReplayEvent, 'id'>): void {
    if (!this.activeRecordingId) return
    const recording = this.recordings.get(this.activeRecordingId)
    if (!recording) return

    // Prune events older than 24h
    const cutoff = Date.now() - MAX_RECORDING_DURATION_MS
    if (recording.events.length > 0 && recording.events[0].timestamp < cutoff) {
      const cutIdx = recording.events.findIndex(e => e.timestamp >= cutoff)
      if (cutIdx > 0) recording.events.splice(0, cutIdx)
    }

    recording.events.push({ id: this.nextEventId(), ...event })
    recording.eventCount = recording.events.length
    recording.durationMs = Date.now() - recording.startedAt

    // Persist periodically
    if (recording.events.length % PERSIST_EVERY_N_EVENTS === 0) {
      this.persistRecording(recording)
    }
  }

  private persistRecording(recording: Recording): void {
    const filePath = path.join(this.replaysDir, `${recording.id}.json`)
    try {
      atomicWrite(filePath, recording)
    } catch (err) {
      console.error('[replay] persist error:', err)
    }
  }

  private ensureDir(): void {
    try {
      fs.mkdirSync(this.replaysDir, { recursive: true })
    } catch { /* already exists */ }
  }

  private loadExistingRecordings(): void {
    try {
      const files = fs.readdirSync(this.replaysDir).filter(f => f.endsWith('.json'))
      const now = Date.now()
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.replaysDir, file), 'utf-8')) as Recording
          if (data?.id && data.startedAt && now - data.startedAt < MAX_RECORDING_DURATION_MS) {
            // Mark any interrupted active recordings as stopped
            if (data.isActive) {
              data.isActive = false
              data.endedAt = data.endedAt ?? data.startedAt
            }
            this.recordings.set(data.id, data)
          }
        } catch { /* skip corrupt */ }
      }
    } catch { /* replays dir doesn't exist yet */ }
  }

  // ── Orchestrator event handlers ───────────────────────────────────────────

  private onTaskDispatched = (data: { taskId: string; agentId: string; title: string; priority: string }): void => {
    this.addEvent({
      timestamp: Date.now(),
      type: 'task-dispatched',
      agentId: data.agentId,
      agentName: data.agentId,
      data: {
        taskId: data.taskId,
        taskTitle: data.title,
        taskPriority: data.priority,
      },
    })
  }

  private onTaskCompleted = (data: { taskId: string; agentId: string; title: string }): void => {
    this.addEvent({
      timestamp: Date.now(),
      type: 'task-completed',
      agentId: data.agentId,
      agentName: data.agentId,
      data: {
        taskId: data.taskId,
        taskTitle: data.title,
      },
    })
  }

  private onTaskFailed = (data: { taskId: string; agentId: string; title: string; error?: string }): void => {
    this.addEvent({
      timestamp: Date.now(),
      type: 'task-failed',
      agentId: data.agentId,
      agentName: data.agentId,
      data: {
        taskId: data.taskId,
        taskTitle: data.title,
        message: data.error,
      },
    })
  }

  private hookOrchestratorEvents(): void {
    orchestratorEvents.on('task-dispatched', this.onTaskDispatched)
    orchestratorEvents.on('task-completed', this.onTaskCompleted)
    orchestratorEvents.on('task-failed', this.onTaskFailed)
  }

  private unhookOrchestratorEvents(): void {
    orchestratorEvents.off('task-dispatched', this.onTaskDispatched)
    orchestratorEvents.off('task-completed', this.onTaskCompleted)
    orchestratorEvents.off('task-failed', this.onTaskFailed)
  }

  // ── Agent state polling ───────────────────────────────────────────────────

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.pollAgentStates().catch(err => console.error('[replay] poll error:', err))
    }, POLL_INTERVAL_MS)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async pollAgentStates(): Promise<void> {
    if (!this.getAgentStatesFn || !this.activeRecordingId) return

    let states: AgentState[]
    try {
      states = await this.getAgentStatesFn()
    } catch {
      return
    }

    const now = Date.now()
    const snapshot: AgentSnapshot[] = []

    for (const agent of states) {
      const agentId = agent.config.id
      const agentName = agent.config.name
      const prev = this.prevAgentStates.get(agentId)

      // Detect state transitions
      if (prev) {
        const statusChanged = prev.status !== agent.status
        const modeChanged = prev.sessionMode !== agent.sessionMode
        if (statusChanged || modeChanged) {
          this.addEvent({
            timestamp: now,
            type: 'state-transition',
            agentId,
            agentName,
            data: {
              fromStatus: prev.status,
              toStatus: agent.status,
              fromMode: prev.sessionMode,
              toMode: agent.sessionMode,
              sessionId: agent.sessionId,
              cwd: agent.cwd,
              contextUtilization: agent.contextUtilization,
              cpu: agent.cpu,
              memoryMB: agent.memoryMB,
            },
          })
        }
      }

      this.prevAgentStates.set(agentId, {
        status: agent.status,
        sessionMode: agent.sessionMode,
      })

      snapshot.push({
        agentId,
        agentName,
        status: agent.status,
        sessionMode: agent.sessionMode,
        cwd: agent.cwd,
        cpu: agent.cpu,
        memoryMB: agent.memoryMB,
        contextUtilization: agent.contextUtilization,
        needsInteraction: agent.needsInteraction,
      })
    }

    // Periodic full snapshot for accurate scrubbing
    this.addEvent({
      timestamp: now,
      type: 'snapshot',
      agentId: '__system__',
      agentName: 'System',
      data: { agents: snapshot },
    })
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance: SessionReplayRecorder | null = null

export function getSessionReplayRecorder(dataDir?: string): SessionReplayRecorder {
  if (!_instance) {
    if (!dataDir) throw new Error('[replay] dataDir required for first initialization')
    _instance = new SessionReplayRecorder(dataDir)
  }
  return _instance
}
