import { EventEmitter } from 'events'
import crypto from 'crypto'
import type { PreferenceEvent, PreferenceSignal, SignalStrength } from './types'

// Re-export for backward compatibility (store.ts imports from here)
export type { PreferenceEvent } from './types'

const APPROVE_CHOICES = new Set(['y', 'yes', '1'])

export interface CollectorSources {
  ipcEvents: EventEmitter
  orchestratorEvents: EventEmitter
  podEvents: EventEmitter
}

type ListenerRef = {
  emitter: EventEmitter
  event: string
  listener: (...args: unknown[]) => void
}

export class PreferenceCollector extends EventEmitter {
  private readonly outputEmitter: EventEmitter
  private readonly listeners: ListenerRef[] = []
  private readonly sources?: CollectorSources
  private started = false

  constructor(outputEmitter: EventEmitter, sources?: CollectorSources) {
    super()
    this.outputEmitter = outputEmitter
    this.sources = sources
  }

  start(): void {
    if (this.started) return
    this.started = true
    if (this.sources) {
      this.hookAll(this.sources)
    } else {
      this.hookAllFromModules()
    }
  }

  dispose(): void {
    for (const { emitter, event, listener } of this.listeners) {
      emitter.off(event, listener)
    }
    this.listeners.length = 0
    this.started = false
  }

  private hookAllFromModules(): void {
    const { ipcEvents } = require('../ipc') as { ipcEvents: EventEmitter }
    const { orchestratorEvents } = require('../orchestrator') as { orchestratorEvents: EventEmitter }
    const { podEvents } = require('../pods') as { podEvents: EventEmitter }
    this.hookAll({ ipcEvents, orchestratorEvents, podEvents })
  }

  private hookAll(sources: CollectorSources): void {
    this.hookIpcApprove(sources.ipcEvents)
    this.hookIpcSend(sources.ipcEvents)
    this.hookOrchestrator(sources.orchestratorEvents)
    this.hookPods(sources.podEvents)
  }

  private emitPreference(
    event: PreferenceEvent,
  ): void {
    this.emit('preference', event)
    this.outputEmitter.emit('preferences:event', event)
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

  private hookIpcApprove(emitter: EventEmitter): void {
    const listener = (data: { tty: string; choice: string }) => {
      try {
        const isApprove = APPROVE_CHOICES.has(data.choice.toLowerCase())
        this.emitPreference(this.buildEvent(
          isApprove ? 'approve' : 'reject',
          'strong',
          data.tty,
          { context: { toolCall: 'sessions:approve', toolResult: data.choice } },
        ))
      } catch { /* graceful degradation */ }
    }
    this.attach(emitter, 'approve', listener)
  }

  private hookIpcSend(emitter: EventEmitter): void {
    const listener = (data: { tty: string; message: string; sessionId?: string }) => {
      try {
        this.emitPreference(this.buildEvent('edit', 'weak', data.tty, {
          sessionId: data.sessionId,
          context: { toolCall: 'sessions:send' },
          userAction: data.message,
        }))
      } catch { /* graceful degradation */ }
    }
    this.attach(emitter, 'send', listener)
  }

  private hookOrchestrator(emitter: EventEmitter): void {
    const completeListener = (data: { taskId: string; agentId: string; priority: string; durationMs: number }) => {
      try {
        this.emitPreference(this.buildEvent('complete', 'strong', data.agentId, {
          context: { toolCall: 'orchestrator:task-completed', toolResult: data.taskId },
        }))
      } catch { /* graceful degradation */ }
    }
    const failListener = (data: { taskId: string; agentId: string }) => {
      try {
        this.emitPreference(this.buildEvent('fail', 'strong', data.agentId, {
          context: { toolCall: 'orchestrator:task-failed', toolResult: data.taskId },
        }))
      } catch { /* graceful degradation */ }
    }
    this.attach(emitter, 'task-completed', completeListener)
    this.attach(emitter, 'task-failed', failListener)
  }

  private hookPods(emitter: EventEmitter): void {
    const listener = (data: { workflowId: string; agentId: string; verdict: string; reason?: string }) => {
      try {
        const verdict = data.verdict.toLowerCase()
        const signal: PreferenceSignal =
          verdict === 'approve' || verdict === 'approve-with-notes' ? 'approve' : 'reject'
        this.emitPreference(this.buildEvent(signal, 'strong', data.agentId, {
          context: {
            toolCall: 'pods:reviewer-decision',
            toolResult: `${data.workflowId}:${verdict}`,
          },
          userAction: data.reason,
        }))
      } catch { /* graceful degradation */ }
    }
    this.attach(emitter, 'reviewer-decision', listener)
  }

  private attach(emitter: EventEmitter, event: string, listener: (...args: unknown[]) => void): void {
    emitter.on(event, listener)
    this.listeners.push({ emitter, event, listener })
  }
}
