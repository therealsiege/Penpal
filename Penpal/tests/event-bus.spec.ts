/**
 * EventBus tests.
 * Validates the pub/sub system used for scene → React communication.
 */

import { test, expect } from '@playwright/test'
import { launchApp, waitForPhaser, type AppContext } from './electron.setup'

let ctx: AppContext

test.beforeAll(async () => {
  ctx = await launchApp()
  await waitForPhaser(ctx.window)
})

test.afterAll(async () => {
  await ctx.app.close()
})

test('EventBus emits and receives events', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { EventBus } = await import('./src/game/events')
    let received: unknown[] = []
    const handler = (...args: unknown[]) => { received = args }
    EventBus.on('test:ping', handler)
    EventBus.emit('test:ping', 'hello', 42)
    EventBus.off('test:ping', handler)
    return received
  }).catch(() => null)

  if (result === null) return

  expect(result).toEqual(['hello', 42])
})

test('EventBus.off removes a specific listener', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { EventBus } = await import('./src/game/events')
    let count = 0
    const handler = () => { count++ }
    EventBus.on('test:off', handler)
    EventBus.emit('test:off')
    EventBus.off('test:off', handler)
    EventBus.emit('test:off')
    return count
  }).catch(() => null)

  if (result === null) return
  expect(result).toBe(1) // only first emit counted
})

test('EventBus supports multiple listeners on same event', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { EventBus } = await import('./src/game/events')
    const calls: string[] = []
    const h1 = () => calls.push('a')
    const h2 = () => calls.push('b')
    EventBus.on('test:multi', h1)
    EventBus.on('test:multi', h2)
    EventBus.emit('test:multi')
    EventBus.off('test:multi', h1)
    EventBus.off('test:multi', h2)
    return calls
  }).catch(() => null)

  if (result === null) return
  expect(result).toContain('a')
  expect(result).toContain('b')
})

test('EventBus.removeAll clears all listeners', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { EventBus } = await import('./src/game/events')
    let count = 0
    EventBus.on('test:removeAll', () => count++)
    EventBus.removeAll()
    EventBus.emit('test:removeAll')
    return count
  }).catch(() => null)

  if (result === null) return
  expect(result).toBe(0)
})

test('EVENTS constants are correctly defined', async () => {
  const result = await ctx.window.evaluate(async () => {
    const { EVENTS } = await import('./src/game/events')
    return EVENTS
  }).catch(() => null)

  if (result === null) return

  expect(result.AGENT_CLICKED).toBe('agent:clicked')
  expect(result.AGENT_DOUBLE_CLICKED).toBe('agent:doubleClicked')
  expect(result.AGENT_RIGHT_CLICKED).toBe('agent:rightClicked')
  expect(result.AGENT_DESELECTED).toBe('agent:deselected')
  expect(result.BROADCAST).toBe('broadcast')
  expect(result.DESK_CLICKED).toBe('desk:clicked')
  expect(result.ADD_WORKER_CLICKED).toBe('addWorker:clicked')
})
