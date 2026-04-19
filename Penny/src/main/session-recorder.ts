/**
 * Session Replay Recorder
 * Records agent state transitions + task events with timestamps to JSON.
 * Max recording duration: 24h. Recordings stored in data/session-replays/.
 */
import fs from 'fs'
import path from 'path'
import { getClaudeSessions } from './sessions'

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const REPLAYS_DIR = path.join(DATA_DIR, 'session-replays')
const MAX_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const POLL_INTERVAL_MS = 2000               // poll every 2s
const SNAPSHOT_INTERVAL_MS = 10000          // full snapshot every 10s

export type ReplayEventType =
  | 'snapshot'
  | 'mode-change'
  | 'interaction-change'
  | 'sub-agent-start'
  | 'sub-agent-done'

export interface ReplayEventData {
  mode?: string
  interactionType?: string
  cpu?: string
  memoryMB?: number
  contextUtilization?: number
  subAgentDescription?: string
  sessionId?: string
  pid?: number
}

export interface ReplayEvent {
  t: number           // ms from recording start
  type: ReplayEventType
  agentId: string
  agentName: string
  cwd?: string
  data: ReplayEventData
}

export interface ReplayRecording {
  id: string
  label: string
  startedAt: number
  endedAt: number | null
  durationMs: number
  agentIds: string[]
  eventCount: number
}

export interface ReplayRecordingWithEvents extends ReplayRecording {
  events: ReplayEvent[]
}

export interface RecorderStatus {
  recording: boolean
  id?: string
  label?: string
  startedAt?: number
  eventCount?: number
}

interface AgentLastState {
  mode: string
  interactionType: string
  subAgentCount: number
  lastSnapshotAt: number
}

interface ActiveRecording {
  id: string
  label: string
  startedAt: number
  events: ReplayEvent[]
  lastStates: Map<string, AgentLastState>
  intervalHandle: ReturnType<typeof setInterval>
}

let activeRecording: ActiveRecording | null = null

function ensureReplaysDir(): void {
  if (!fs.existsSync(REPLAYS_DIR)) {
    fs.mkdirSync(REPLAYS_DIR, { recursive: true })
  }
}

function getRecordingPath(id: string): string {
  return path.join(REPLAYS_DIR, `${id}.json`)
}

export function isRecording(): boolean {
  return activeRecording !== null
}

export function startRecording(label?: string): { id: string } {
  if (activeRecording) {
    stopRecording()
  }

  const id = `replay-${Date.now()}`
  const startedAt = Date.now()

  activeRecording = {
    id,
    label: label || `Recording ${new Date(startedAt).toLocaleString()}`,
    startedAt,
    events: [],
    lastStates: new Map(),
    intervalHandle: setInterval(() => { void pollAndRecord() }, POLL_INTERVAL_MS),
  }

  // Kick off initial snapshot immediately
  void pollAndRecord()

  return { id }
}

export function stopRecording(): ReplayRecording | null {
  if (!activeRecording) return null

  clearInterval(activeRecording.intervalHandle)

  const endedAt = Date.now()
  const durationMs = endedAt - activeRecording.startedAt
  const agentIds = [...new Set(activeRecording.events.map(e => e.agentId))]

  const recording: ReplayRecordingWithEvents = {
    id: activeRecording.id,
    label: activeRecording.label,
    startedAt: activeRecording.startedAt,
    endedAt,
    durationMs,
    agentIds,
    eventCount: activeRecording.events.length,
    events: activeRecording.events,
  }

  ensureReplaysDir()
  fs.writeFileSync(getRecordingPath(activeRecording.id), JSON.stringify(recording, null, 2))

  const { events: _events, ...meta } = recording
  void _events  // consumed

  activeRecording = null
  return meta
}

async function pollAndRecord(): Promise<void> {
  if (!activeRecording) return

  const now = Date.now()
  const elapsed = now - activeRecording.startedAt

  if (elapsed > MAX_DURATION_MS) {
    stopRecording()
    return
  }

  let sessions: Awaited<ReturnType<typeof getClaudeSessions>>
  try {
    sessions = await getClaudeSessions()
  } catch {
    return
  }

  const t = Date.now() - activeRecording.startedAt

  for (const session of sessions) {
    const agentId = session.sessionId || `pid-${session.pid}`
    const agentName = session.project || session.cwd.split('/').pop() || 'unknown'
    const currentMode = session.sessionMode || 'idle'
    const currentInteraction = session.interactionType || 'none'
    const activeSubCount = session.subAgentInvocations?.filter(s => s.status === 'active').length ?? 0

    const prev = activeRecording.lastStates.get(agentId)
    const timeSinceSnapshot = prev ? (t - prev.lastSnapshotAt) : Infinity

    // Full snapshot on first occurrence or every SNAPSHOT_INTERVAL_MS
    if (!prev || timeSinceSnapshot >= SNAPSHOT_INTERVAL_MS) {
      activeRecording.events.push({
        t,
        type: 'snapshot',
        agentId,
        agentName,
        cwd: session.cwd,
        data: {
          mode: currentMode,
          interactionType: currentInteraction,
          cpu: session.cpu,
          memoryMB: session.memoryMB,
          contextUtilization: session.contextUtilization,
          sessionId: session.sessionId,
          pid: session.pid,
        },
      })
    }

    if (prev) {
      if (prev.mode !== currentMode) {
        activeRecording.events.push({
          t,
          type: 'mode-change',
          agentId,
          agentName,
          cwd: session.cwd,
          data: {
            mode: currentMode,
            interactionType: currentInteraction,
          },
        })
      }

      if (prev.interactionType !== currentInteraction) {
        activeRecording.events.push({
          t,
          type: 'interaction-change',
          agentId,
          agentName,
          cwd: session.cwd,
          data: {
            mode: currentMode,
            interactionType: currentInteraction,
          },
        })
      }

      if (activeSubCount > prev.subAgentCount) {
        const activeInvocations = session.subAgentInvocations?.filter(s => s.status === 'active') ?? []
        const newest = activeInvocations[activeInvocations.length - 1]
        activeRecording.events.push({
          t,
          type: 'sub-agent-start',
          agentId,
          agentName,
          cwd: session.cwd,
          data: {
            mode: currentMode,
            subAgentDescription: newest?.description,
          },
        })
      } else if (activeSubCount < prev.subAgentCount) {
        activeRecording.events.push({
          t,
          type: 'sub-agent-done',
          agentId,
          agentName,
          cwd: session.cwd,
          data: { mode: currentMode },
        })
      }
    }

    activeRecording.lastStates.set(agentId, {
      mode: currentMode,
      interactionType: currentInteraction,
      subAgentCount: activeSubCount,
      lastSnapshotAt: (prev && timeSinceSnapshot < SNAPSHOT_INTERVAL_MS) ? prev.lastSnapshotAt : t,
    })
  }
}

export function listRecordings(): ReplayRecording[] {
  ensureReplaysDir()

  let files: string[]
  try {
    files = fs.readdirSync(REPLAYS_DIR).filter(f => f.endsWith('.json'))
  } catch {
    return []
  }

  const recordings: ReplayRecording[] = []
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, file), 'utf-8')) as ReplayRecordingWithEvents
      const { events: _e, ...meta } = raw
      void _e
      recordings.push(meta)
    } catch {
      // skip corrupt files
    }
  }

  return recordings.sort((a, b) => b.startedAt - a.startedAt)
}

export function loadRecording(id: string): ReplayRecordingWithEvents | null {
  const filePath = getRecordingPath(id)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ReplayRecordingWithEvents
  } catch {
    return null
  }
}

export function deleteRecording(id: string): boolean {
  const filePath = getRecordingPath(id)
  if (!fs.existsSync(filePath)) return false
  try {
    fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

export function getRecorderStatus(): RecorderStatus {
  if (!activeRecording) return { recording: false }
  return {
    recording: true,
    id: activeRecording.id,
    label: activeRecording.label,
    startedAt: activeRecording.startedAt,
    eventCount: activeRecording.events.length,
  }
}
