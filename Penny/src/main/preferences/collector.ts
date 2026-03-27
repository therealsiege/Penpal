import { EventEmitter } from 'events'
import crypto from 'crypto'
import type { PreferenceEvent, PreferenceSignal, SignalStrength } from './types'

// Re-export for backward compatibility (store.ts imports from here)
export type { PreferenceEvent } from './types'

const APPROVE_CHOICES = new Set(['y', 'yes', '1'])
const REJECT_CHOICES = new Set(['n', 'no', '2', '3', 'skip', 'deny', 'reject'])

export interface CollectorSources {
  orchestratorEvents?: EventEmitter
  podEvents?: EventEmitter
}

type DisposableListener = {
  emitter: EventEmitter
  event: string
  listener: (...args: unknown[]) => void
}

export class PreferenceCollector extends EventEmitter {
  private readonly ipcEvents: EventEmitter
  private readonly listeners: DisposableListener[] = []
  private readonly sources: CollectorSources
  private started = false

  constructor(ipcEvents: EventEmitter, sources: CollectorSources = {}) {
    super()
    this.ipcEvents = ipcEvents
    this.sources = sources
    this.start()
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.hookIpcApprove(this.ipcEvents)
    this.hookIpcSend(this.ipcEvents)
    if (this.sources.orchestratorEvents) this.hookOrchestrator(this.sources.orchestratorEvents)
    if (this.sources.podEvents) this.hookPods(this.sources.podEvents)
  }

  dispose(): void {
    for (const { emitter, event, listener } of this.listeners) {
      emitter.off(event, listener)
    }
    this.listeners.length = 0
    this.started = false
  }

  emitPreference(event: PreferenceEvent): void {
    this.emit('preference', event)
    this.ipcEvents.emit('preferences:event', event)
  }

  private buildEvent(
    signal: PreferenceSignal,
    strength: SignalStrength,
    agentId: string,
    extra?: Partial<Pick<PreferenceEvent, 'sessionId' | 'context' | 'userAction'>>,
  ): PreferenceEvent {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      agentId,
      signal,
      strength,
      context: {},
      ...extra,
    }
  }

  // ── Signal 1 & 2: approve / reject from tool approval ──────────────
  private hookIpcApprove(emitter: EventEmitter): void {
    const listener = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return
        const payload = data as { tty?: string; choice?: string; sessionId?: string }
        if (typeof payload.tty !== 'string' || typeof payload.choice !== 'string') return
        const normalizedChoice = payload.choice.toLowerCase()
        const isApprove = APPROVE_CHOICES.has(normalizedChoice)
        const isReject = REJECT_CHOICES.has(normalizedChoice)
        if (!isApprove && !isReject) return
        this.emitPreference(this.buildEvent(
          isApprove ? 'approve' : 'reject',
          'strong',
          payload.tty,
          {
            sessionId: payload.sessionId,
            context: { toolCall: 'sessions:approve', toolResult: normalizedChoice },
          },
        ))
      } catch { /* graceful degradation */ }
    }
    this.addListenerRef(emitter, 'approve', listener)
  }

  // ── Signal 3: message edit before send (weak corrective) ───────────
  private hookIpcSend(emitter: EventEmitter): void {
    const listener = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return
        const payload = data as { tty?: string; message?: string; sessionId?: string; recentMessages?: string[] }
        if (typeof payload.tty !== 'string' || typeof payload.message !== 'string') return
        this.emitPreference(this.buildEvent('edit', 'weak', payload.tty, {
          sessionId: payload.sessionId,
          context: {
            toolCall: 'sessions:send',
            recentMessages: Array.isArray(payload.recentMessages)
              ? payload.recentMessages.filter((msg): msg is string => typeof msg === 'string')
              : undefined,
          },
          userAction: payload.message,
        }))
      } catch { /* graceful degradation */ }
    }
    this.addListenerRef(emitter, 'send', listener)
  }

  // ── Signal 4 & 5: task completion / failure from orchestrator ──────
  private hookOrchestrator(emitter: EventEmitter): void {
    const completeListener = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return
        const payload = data as { taskId?: string; agentId?: string }
        if (typeof payload.taskId !== 'string' || typeof payload.agentId !== 'string') return
        this.emitPreference(this.buildEvent('complete', 'strong', payload.agentId, {
          context: { toolCall: 'orchestrator:task-completed', toolResult: payload.taskId },
        }))
      } catch { /* graceful degradation */ }
    }
    const failListener = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return
        const payload = data as { taskId?: string; agentId?: string }
        if (typeof payload.taskId !== 'string' || typeof payload.agentId !== 'string') return
        this.emitPreference(this.buildEvent('fail', 'strong', payload.agentId, {
          context: { toolCall: 'orchestrator:task-failed', toolResult: payload.taskId },
        }))
      } catch { /* graceful degradation */ }
    }
    this.addListenerRef(emitter, 'task-completed', completeListener)
    this.addListenerRef(emitter, 'task-failed', failListener)
  }

  // ── Signal from pod reviewer outcomes in workflow status changes ───
  private hookPods(emitter: EventEmitter): void {
    const listener = (data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return
        const wf = data as {
          id?: string
          status?: string
          solver?: { agentId?: string }
          reviewer?: { output?: string }
          critique?: { verdict?: string; summary?: string }
          executor?: { output?: string }
        }
        if (typeof wf.id !== 'string' || typeof wf.status !== 'string') return
        const agentId = wf.solver?.agentId
        if (typeof agentId !== 'string') return
        if (wf.status === 'executing') {
          this.emitPreference(this.buildEvent('approve', 'strong', agentId, {
            context: { toolCall: 'pods:status-change', toolResult: `${wf.id}:review-accepted` },
          }))
          return
        }
        if (wf.status === 'feedback') {
          const verdict = wf.critique?.verdict ?? 'request-changes'
          const reason = wf.critique?.summary ?? wf.executor?.output ?? wf.reviewer?.output
          this.emitPreference(this.buildEvent('reject', 'strong', agentId, {
            context: { toolCall: 'pods:status-change', toolResult: `${wf.id}:${verdict}` },
            userAction: reason,
          }))
        }
      } catch { /* graceful degradation */ }
    }
    this.addListenerRef(emitter, 'status-change', listener)
  }

  private addListenerRef(emitter: EventEmitter, event: string, listener: (...args: unknown[]) => void): void {
    emitter.on(event, listener)
    this.listeners.push({ emitter, event, listener })
  }
}
