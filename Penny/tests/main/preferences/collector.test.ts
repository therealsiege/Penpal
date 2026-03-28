import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { PreferenceCollector } from '../../../src/main/preferences/collector'
import type { PreferenceEvent } from '../../../src/main/preferences/types'

describe('PreferenceCollector', () => {
  let collector: PreferenceCollector
  let events: PreferenceEvent[]
  let ipcBusEvents: PreferenceEvent[]
  let ipcEvents: EventEmitter
  let orchestratorEvents: EventEmitter
  let podEvents: EventEmitter

  beforeEach(() => {
    ipcEvents = new EventEmitter()
    orchestratorEvents = new EventEmitter()
    podEvents = new EventEmitter()
    collector = new PreferenceCollector(ipcEvents, { orchestratorEvents, podEvents })
    events = []
    ipcBusEvents = []
    collector.on('preference', (evt: PreferenceEvent) => events.push(evt))
    ipcEvents.on('preferences:event', (evt: PreferenceEvent) => ipcBusEvents.push(evt))
  })

  it('approve event produces { signal: "approve", strength: "strong" }', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
    expect(ipcBusEvents).toHaveLength(1)
    expect(ipcBusEvents[0].signal).toBe('approve')
  })

  it('tool rejection emits strong reject', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'n' })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('reject')
    expect(events[0].strength).toBe('strong')
  })

  it('message send emits weak edit with userAction', () => {
    ipcEvents.emit('send', { tty: '/dev/ttys001', message: 'edited content' })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('edit')
    expect(events[0].strength).toBe('weak')
    expect(events[0].userAction).toBe('edited content')
  })

  it('pod reviewer-verdict approve produces strong approve with reason', () => {
    podEvents.emit('reviewer-verdict', {
      workflowId: 'pod-1',
      solverAgentId: 'solver-1',
      reviewerAgentId: 'reviewer-1',
      critique: {
        verdict: 'approve',
        confidence: 0.9,
        issues: [],
        strengths: [],
        summary: 'Looks correct.',
      },
    })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
    expect(events[0].userAction).toBe('Looks correct.')
    expect(events[0].context.toolResult).toBe('pod-1:approve')
  })

  it('pod reviewer-verdict request-changes maps to strong reject', () => {
    podEvents.emit('reviewer-verdict', {
      workflowId: 'pod-2',
      solverAgentId: 'solver-a',
      reviewerAgentId: 'reviewer-b',
      critique: {
        verdict: 'request-changes',
        confidence: 0.8,
        issues: [],
        strengths: [],
        summary: 'Fix edge cases.',
      },
    })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('reject')
    expect(events[0].strength).toBe('strong')
    expect(events[0].userAction).toBe('Fix edge cases.')
  })

  it('pod reviewer-verdict approve-with-notes maps to strong approve', () => {
    podEvents.emit('reviewer-verdict', {
      workflowId: 'pod-3',
      solverAgentId: 'solver-x',
      reviewerAgentId: 'reviewer-y',
      critique: {
        verdict: 'approve-with-notes',
        confidence: 0.7,
        issues: [],
        strengths: [],
        summary: 'Ship with nits.',
      },
    })
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
  })

  it('task failure produces { signal: "fail", strength: "strong" }', () => {
    orchestratorEvents.emit('task-failed', { taskId: 'task-1', agentId: 'solver-1' })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('fail')
    expect(events[0].strength).toBe('strong')
  })

  it('task completion emits strong complete', () => {
    orchestratorEvents.emit('task-completed', {
      taskId: 'task-1',
      agentId: 'solver-1',
      priority: 'high',
      durationMs: 1000,
    })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('complete')
    expect(events[0].strength).toBe('strong')
  })

  it('ignores malformed approve payloads', () => {
    ipcEvents.emit('approve', { tty: 123, choice: 'y' } as { tty: string; choice: string })
    ipcEvents.emit('approve', { tty: '/dev/tty', choice: 'maybe' })
    expect(events).toHaveLength(0)
  })

  it('ignores reviewer-verdict without known verdict', () => {
    podEvents.emit('reviewer-verdict', {
      workflowId: 'pod-x',
      solverAgentId: 'solver-x',
      reviewerAgentId: 'r',
      critique: { summary: 'no structured verdict' },
    })
    expect(events).toHaveLength(0)
  })

  it('dispose unsubscribes listeners', () => {
    collector.dispose()
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })
    orchestratorEvents.emit('task-failed', { taskId: 'task-2', agentId: 'solver-1' })
    podEvents.emit('reviewer-verdict', {
      workflowId: 'pod-2',
      solverAgentId: 'solver-1',
      reviewerAgentId: 'r',
      critique: {
        verdict: 'reject',
        confidence: 1,
        issues: [],
        strengths: [],
        summary: 'no',
      },
    })
    expect(events).toHaveLength(0)
  })
})
