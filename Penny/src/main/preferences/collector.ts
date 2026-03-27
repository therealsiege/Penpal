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

export class PreferenceCollector extends EventEmitter {
  constructor(sources?: CollectorSources) {
    super()
    if (sources) {
      this.hookAll(sources)
    } else {
      // Lazy-import to avoid circular deps at module load time
      this.hookAllFromModules()
    }
  }

  private hookAllFromModules(): void {
    // Dynamic require may fail in bundled builds (electron-vite collapses to single file).
    // Degrade gracefully — preference collection is non-critical.
    try {
      const { ipcEvents } = require('../ipc') as { ipcEvents: EventEmitter }
      const { orchestratorEvents } = require('../orchestrator') as { orchestratorEvents: EventEmitter }
      const { podEvents } = require('../pods') as { podEvents: EventEmitter }
      this.hookAll({ ipcEvents, orchestratorEvents, podEvents })
    } catch (err) {
      console.warn('[PreferenceCollector] Dynamic require failed (bundled build?) — pass sources explicitly.', err)
    }
  }

  private hookAll(sources: CollectorSources): void {
    this.hookIpcApprove(sources.ipcEvents)
    this.hookIpcSend(sources.ipcEvents)
    this.hookOrchestrator(sources.orchestratorEvents)
    this.hookPods(sources.podEvents)
  }

  emitPreference(
    signal: PreferenceSignal,
    strength: SignalStrength,
    agentId: string,
    extra?: Partial<Pick<PreferenceEvent, 'sessionId' | 'context' | 'userAction'>>,
  ): void {
    const event: PreferenceEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      agentId,
      signal,
      strength,
      context: {},
      ...extra,
    }
    this.emit('preference', event)
  }

  // ── Signal 1 & 2: approve / reject from tool approval ──────────────
  private hookIpcApprove(emitter: EventEmitter): void {
    emitter.on('approve', (data: { tty: string; choice: string }) => {
      try {
        const isApprove = APPROVE_CHOICES.has(data.choice.toLowerCase())
        this.emitPreference(
          isApprove ? 'approve' : 'reject',
          'strong',
          data.tty,
          { context: { toolCall: data.choice } },
        )
      } catch { /* graceful degradation */ }
    })
  }

  // ── Signal 3: message edit before send (weak corrective) ───────────
  private hookIpcSend(emitter: EventEmitter): void {
    emitter.on('send', (data: { tty: string; message: string }) => {
      try {
        this.emitPreference('edit', 'weak', data.tty, {
          userAction: data.message,
        })
      } catch { /* graceful degradation */ }
    })
  }

  // ── Signal 4 & 5: task completion / failure from orchestrator ──────
  private hookOrchestrator(emitter: EventEmitter): void {
    emitter.on(
      'task-completed',
      (data: { taskId: string; agentId: string; priority: string; durationMs: number }) => {
        try {
          this.emitPreference('complete', 'strong', data.agentId, {
            context: { toolCall: data.taskId },
          })
        } catch { /* graceful degradation */ }
      },
    )

    emitter.on(
      'task-failed',
      (data: { taskId: string; agentId: string }) => {
        try {
          this.emitPreference('fail', 'strong', data.agentId, {
            context: { toolCall: data.taskId },
          })
        } catch { /* graceful degradation */ }
      },
    )
  }

  // ── Signal from pod workflow status changes ────────────────────────
  private hookPods(emitter: EventEmitter): void {
    emitter.on('status-change', (wf: { id: string; status: string; solver: { agentId: string }; executor: { output?: string } }) => {
      try {
        if (wf.status === 'complete') {
          this.emitPreference('complete', 'strong', wf.solver.agentId, {
            context: { toolCall: wf.id },
          })
        } else if (wf.status === 'failed') {
          this.emitPreference('fail', 'strong', wf.solver.agentId, {
            context: { toolCall: wf.id },
          })
        } else if (wf.status === 'feedback') {
          this.emitPreference('reject', 'strong', wf.solver.agentId, {
            context: { toolResult: wf.executor.output },
          })
        }
      } catch { /* graceful degradation */ }
    })
  }
}
