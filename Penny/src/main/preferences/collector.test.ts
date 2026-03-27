import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { PreferenceCollector } from './collector'
import type { PreferenceEvent } from './types'

describe('PreferenceCollector', () => {
  let collector: PreferenceCollector
  let events: PreferenceEvent[]
  let ipcEvents: EventEmitter
  let orchestratorEvents: EventEmitter
  let podEvents: EventEmitter

  beforeEach(() => {
    ipcEvents = new EventEmitter()
    orchestratorEvents = new EventEmitter()
    podEvents = new EventEmitter()
    collector = new PreferenceCollector({ ipcEvents, orchestratorEvents, podEvents })
    events = []
    collector.on('preference', (evt: PreferenceEvent) => events.push(evt))
  })

  it('approve event produces { signal: "approve", strength: "strong" }', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
    expect(events[0].agentId).toBe('/dev/ttys001')
  })

  it('approve with "yes" also produces approve signal', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'yes' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
    expect(events[0].strength).toBe('strong')
  })

  it('approve with "1" also produces approve signal', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: '1' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('approve')
  })

  it('reject event produces { signal: "reject", strength: "strong" }', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'n' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('reject')
    expect(events[0].strength).toBe('strong')
  })

  it('choice "2" (escape) produces reject signal', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: '2' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('reject')
  })

  it('send event produces { signal: "edit", strength: "weak" }', () => {
    ipcEvents.emit('send', { tty: '/dev/ttys001', message: 'fix the bug instead' })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('edit')
    expect(events[0].strength).toBe('weak')
    expect(events[0].userAction).toBe('fix the bug instead')
  })

  it('task completion produces { signal: "complete", strength: "strong" }', () => {
    orchestratorEvents.emit('task-completed', {
      taskId: 'task-1',
      agentId: 'fullstack-dev',
      priority: 'normal',
      durationMs: 5000,
    })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('complete')
    expect(events[0].strength).toBe('strong')
    expect(events[0].agentId).toBe('fullstack-dev')
  })

  it('task failure produces { signal: "fail", strength: "strong" }', () => {
    orchestratorEvents.emit('task-failed', {
      taskId: 'task-2',
      agentId: 'backend-arch',
    })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('fail')
    expect(events[0].strength).toBe('strong')
    expect(events[0].agentId).toBe('backend-arch')
  })

  it('pod complete produces { signal: "complete", strength: "strong" }', () => {
    podEvents.emit('status-change', {
      id: 'pod-1',
      status: 'complete',
      solver: { agentId: 'fullstack-dev' },
      executor: { output: '' },
    })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('complete')
    expect(events[0].strength).toBe('strong')
    expect(events[0].agentId).toBe('fullstack-dev')
  })

  it('pod failed produces { signal: "fail", strength: "strong" }', () => {
    podEvents.emit('status-change', {
      id: 'pod-2',
      status: 'failed',
      solver: { agentId: 'nextjs-frontend' },
      executor: { output: '' },
    })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('fail')
    expect(events[0].strength).toBe('strong')
    expect(events[0].agentId).toBe('nextjs-frontend')
  })

  it('pod feedback produces { signal: "reject", strength: "strong" }', () => {
    podEvents.emit('status-change', {
      id: 'pod-3',
      status: 'feedback',
      solver: { agentId: 'fullstack-dev' },
      executor: { output: 'FAIL: tests broken' },
    })

    expect(events).toHaveLength(1)
    expect(events[0].signal).toBe('reject')
    expect(events[0].strength).toBe('strong')
    expect(events[0].context.toolResult).toBe('FAIL: tests broken')
  })

  it('events have valid UUID id and ISO timestamp', () => {
    ipcEvents.emit('approve', { tty: '/dev/ttys001', choice: 'y' })

    const evt = events[0]
    expect(evt.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(() => new Date(evt.timestamp).toISOString()).not.toThrow()
  })

  it('handles malformed data gracefully without throwing', () => {
    expect(() => {
      ipcEvents.emit('approve', null)
      ipcEvents.emit('approve', {})
      ipcEvents.emit('send', undefined)
      orchestratorEvents.emit('task-completed', null)
      podEvents.emit('status-change', null)
    }).not.toThrow()

    expect(events).toHaveLength(0)
  })
})
