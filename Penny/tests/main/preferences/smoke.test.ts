import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { PreferenceCollector } from '../../../src/main/preferences/collector'
import type { PreferenceEvent } from '../../../src/main/preferences/types'

describe('PreferenceCollector', () => {
  let collector: PreferenceCollector
  let events: PreferenceEvent[]
  let outputBus: EventEmitter
  let outputBusEvents: PreferenceEvent[]
  let ipcEvents: EventEmitter
  let orchestratorEvents: EventEmitter
  let podEvents: EventEmitter

  beforeEach(() => {
    outputBus = new EventEmitter()
    ipcEvents = new EventEmitter()
    orchestratorEvents = new EventEmitter()
    podEvents = new EventEmitter()
    collector = new PreferenceCollector(outputBus, { ipcEvents, orchestratorEvents, podEvents })
    collector.start()
    events = []
    outputBusEvents = []
    collector.on('preference', (evt: PreferenceEvent) => events.push(evt))
    outputBus.on('preferences:event', (evt: PreferenceEvent) => outputBusEvents.push(evt))
  })

  it('approve event produces { signal: "approve", strength: "strong" }', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
    expect(outputBusEvents[0].signal).toBe('approve')
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

  it('pod reviewer approve produces strong approve with reason', () => {
    podEvents.emit('reviewer-decision', {
      workflowId: 'pod-1',
      agentId: 'solver-1',
      verdict: 'approve',
      reason: 'Looks correct.',
    })
    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
    expect(events[0].userAction).toBe('Looks correct.')
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

  it('dispose unsubscribes listeners', () => {
    collector.dispose()
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })
    orchestratorEvents.emit('task-failed', { taskId: 'task-2', agentId: 'solver-1' })
    podEvents.emit('reviewer-decision', { workflowId: 'pod-2', agentId: 'solver-1', verdict: 'reject' })
    expect(events).toHaveLength(0)
  })
})
