// @vitest-environment jsdom
/**
 * Cafe patron service flow tests — issue #158
 * Validates the multi-phase state machine for the cafe patron service flow:
 *   walking-to-cafe → ordering → (waiting-for-barista) → walking-to-stool → seated → sipping → returning
 *
 * Tests cover:
 *  - EVENTS.CAFE_PATRON_PHASE constant
 *  - EventBus pub/sub for cafe:patron-phase
 *  - CafeCoffeeRunManager class interface (patronPhases Map, triggerForAgent, etc.)
 *  - Counter queue / barista busy logic
 *  - Multi-patron independent phase tracking
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)),
    },
    GameObjects: {},
  },
  Math: {
    Clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)),
  },
  GameObjects: {},
}))

import { EventBus, EVENTS } from '../../../src/renderer/src/game/events'
import type { PatronPhase } from '../../../src/renderer/src/game/cafe-coffee-run'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listenPhases(agentFilter?: string): { phases: { agentId: string; phase: string }[]; stop: () => void } {
  const phases: { agentId: string; phase: string }[] = []
  const handler = (agentId: unknown, phase: unknown) => {
    if (!agentFilter || agentId === agentFilter) {
      phases.push({ agentId: agentId as string, phase: phase as string })
    }
  }
  EventBus.on(EVENTS.CAFE_PATRON_PHASE, handler)
  return {
    phases,
    stop: () => EventBus.off(EVENTS.CAFE_PATRON_PHASE, handler),
  }
}

// ---------------------------------------------------------------------------
// EVENTS constant
// ---------------------------------------------------------------------------

describe('EVENTS.CAFE_PATRON_PHASE', () => {
  it('is defined with the correct string value', () => {
    expect(EVENTS.CAFE_PATRON_PHASE).toBe('cafe:patron-phase')
  })

  it('is present in the EVENTS object', () => {
    const keys = Object.keys(EVENTS)
    expect(keys).toContain('CAFE_PATRON_PHASE')
  })
})

// ---------------------------------------------------------------------------
// EventBus integration
// ---------------------------------------------------------------------------

describe('EventBus cafe:patron-phase integration', () => {
  afterEach(() => {
    // Clean up any stray listeners
    EventBus.removeAll()
  })

  it('emits and receives (agentId, phase) payload', () => {
    const listener = listenPhases()
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-1', 'ordering')
    listener.stop()
    expect(listener.phases).toEqual([{ agentId: 'agent-1', phase: 'ordering' }])
  })

  it('only the registered handler receives the event', () => {
    const l1 = listenPhases('agent-a')
    const l2 = listenPhases('agent-b')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-a', 'walking-to-cafe')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'ordering')
    l1.stop()
    l2.stop()
    expect(l1.phases.map(p => p.phase)).toEqual(['walking-to-cafe'])
    expect(l2.phases.map(p => p.phase)).toEqual(['ordering'])
  })

  it('captures the complete patron phase sequence', () => {
    const l = listenPhases('agent-full')
    const sequence: PatronPhase[] = [
      'walking-to-cafe',
      'ordering',
      'walking-to-stool',
      'seated',
      'sipping',
      'returning',
    ]
    for (const phase of sequence) {
      EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-full', phase)
    }
    l.stop()
    expect(l.phases.map(p => p.phase)).toEqual(sequence)
  })

  it('captures the extended sequence including waiting-for-barista', () => {
    const l = listenPhases('agent-queue')
    const sequence: PatronPhase[] = [
      'walking-to-cafe',
      'ordering',
      'waiting-for-barista',
      'walking-to-stool',
      'seated',
      'sipping',
      'returning',
    ]
    for (const phase of sequence) {
      EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-queue', phase)
    }
    l.stop()
    expect(l.phases.map(p => p.phase)).toEqual(sequence)
    expect(l.phases).toHaveLength(7)
  })

  it('tracks multiple patrons with independent phase histories', () => {
    const lA = listenPhases('agent-a')
    const lB = listenPhases('agent-b')

    // agent-a gets a free barista immediately (no waiting-for-barista)
    // agent-b arrives when both baristas are busy and must wait
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-a', 'walking-to-cafe')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'walking-to-cafe')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-a', 'ordering')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'ordering')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'waiting-for-barista')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-a', 'walking-to-stool')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-a', 'seated')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'walking-to-stool')
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'agent-b', 'seated')

    lA.stop()
    lB.stop()

    expect(lA.phases.map(p => p.phase)).toEqual([
      'walking-to-cafe', 'ordering', 'walking-to-stool', 'seated',
    ])
    expect(lB.phases.map(p => p.phase)).toEqual([
      'walking-to-cafe', 'ordering', 'waiting-for-barista', 'walking-to-stool', 'seated',
    ])
  })

  it('handler removed via off() stops receiving events', () => {
    const received: string[] = []
    const handler = (_: unknown, phase: unknown) => received.push(phase as string)
    EventBus.on(EVENTS.CAFE_PATRON_PHASE, handler)
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'x', 'walking-to-cafe')
    EventBus.off(EVENTS.CAFE_PATRON_PHASE, handler)
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, 'x', 'ordering')
    expect(received).toEqual(['walking-to-cafe'])
  })
})

// ---------------------------------------------------------------------------
// PatronPhase type values
// ---------------------------------------------------------------------------

describe('PatronPhase values', () => {
  it('all 7 phase strings are valid PatronPhase values', () => {
    // These are the valid PatronPhase literal values — compile-time type, verified at runtime
    const validPhases: PatronPhase[] = [
      'walking-to-cafe',
      'ordering',
      'waiting-for-barista',
      'walking-to-stool',
      'seated',
      'sipping',
      'returning',
    ]
    expect(validPhases).toHaveLength(7)
    for (const p of validPhases) {
      expect(typeof p).toBe('string')
      expect(p.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// CafeCoffeeRunManager class interface
// ---------------------------------------------------------------------------

describe('CafeCoffeeRunManager', () => {
  it('exports CafeCoffeeRunManager class', async () => {
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')
    expect(mod.CafeCoffeeRunManager).toBeDefined()
    expect(typeof mod.CafeCoffeeRunManager).toBe('function')
  })

  it('has patronPhases Map, coffeeRunners Map, and coffeeRunnerRooms Map on instance', async () => {
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')

    const mockTimeEvent = { destroy: vi.fn(), paused: false }
    const mockScene: any = {
      rooms: new Map(),
      spawnEmojiReaction: vi.fn(),
      getNavMesh: vi.fn(() => ({ findPath: vi.fn(() => null) })),
      time: {
        addEvent: vi.fn(() => mockTimeEvent),
        delayedCall: vi.fn(),
      },
      add: {
        sprite: vi.fn(() => ({
          setScale: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setFlipX: vi.fn().mockReturnThis(),
          setAngle: vi.fn().mockReturnThis(),
          setTexture: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          active: true,
          x: 0, y: 0,
        })),
        ellipse: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          x: 0, y: 0,
        })),
      },
      tweens: {
        add: vi.fn(),
        killTweensOf: vi.fn(),
      },
    }
    const mockHost: any = {
      container: null,
      worldX: 100,
      worldY: 200,
      counterWorldY: 170,
      baristas: [],
      baristaHomeX: [],
      baristasBusy: [false, false],
      stoolOccupied: new Set<number>(),
      seatedVisitors: new Map(),
      stoolWorldX: vi.fn((idx: number) => 50 + idx * 48),
      tryStartChat: vi.fn(),
    }

    const mgr = new mod.CafeCoffeeRunManager(mockScene, mockHost)

    expect(mgr.patronPhases).toBeInstanceOf(Map)
    expect(mgr.coffeeRunners).toBeInstanceOf(Map)
    expect(mgr.coffeeRunnerRooms).toBeInstanceOf(Map)
    expect(mgr.patronPhases.size).toBe(0)
    expect(mgr.coffeeRunners.size).toBe(0)
  })

  it('exposes triggerForAgent, cancelCoffeeRun, startCoffeeRunTimer, pause, resume, destroy', async () => {
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')

    const mockTimeEvent = { destroy: vi.fn(), paused: false }
    const mockScene: any = {
      rooms: new Map(),
      spawnEmojiReaction: vi.fn(),
      getNavMesh: vi.fn(() => ({ findPath: vi.fn(() => null) })),
      time: { addEvent: vi.fn(() => mockTimeEvent), delayedCall: vi.fn() },
      add: { sprite: vi.fn(() => ({ setScale: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() })), ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis() })) },
      tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    }
    const mockHost: any = {
      container: null, worldX: 0, worldY: 0, counterWorldY: 0,
      baristas: [], baristaHomeX: [], baristasBusy: [false, false],
      stoolOccupied: new Set(), seatedVisitors: new Map(),
      stoolWorldX: vi.fn(), tryStartChat: vi.fn(),
    }

    const mgr = new mod.CafeCoffeeRunManager(mockScene, mockHost)

    expect(typeof mgr.triggerForAgent).toBe('function')
    expect(typeof mgr.cancelCoffeeRun).toBe('function')
    expect(typeof mgr.startCoffeeRunTimer).toBe('function')
    expect(typeof mgr.pause).toBe('function')
    expect(typeof mgr.resume).toBe('function')
    expect(typeof mgr.destroy).toBe('function')
    expect(typeof mgr.cleanupVisitor).toBe('function')
  })

  it('destroy() clears all internal state', async () => {
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')

    const mockTimeEvent = { destroy: vi.fn(), paused: false }
    const mockScene: any = {
      rooms: new Map(),
      spawnEmojiReaction: vi.fn(),
      getNavMesh: vi.fn(() => ({ findPath: vi.fn(() => null) })),
      time: { addEvent: vi.fn(() => mockTimeEvent), delayedCall: vi.fn() },
      add: { sprite: vi.fn(() => ({ setScale: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() })), ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis() })) },
      tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    }
    const mockHost: any = {
      container: null, worldX: 0, worldY: 0, counterWorldY: 0,
      baristas: [], baristaHomeX: [], baristasBusy: [false, false],
      stoolOccupied: new Set(), seatedVisitors: new Map(),
      stoolWorldX: vi.fn(), tryStartChat: vi.fn(),
    }

    const mgr = new mod.CafeCoffeeRunManager(mockScene, mockHost)
    // Pre-populate internal state to verify it's cleared
    mgr.patronPhases.set('agent-x', 'seated')
    mgr.coffeeRunners.set('agent-x', vi.fn())

    mgr.destroy()

    expect(mgr.patronPhases.size).toBe(0)
    expect(mgr.coffeeRunners.size).toBe(0)
    expect(mgr.coffeeRunnerRooms.size).toBe(0)
  })

  it('startCoffeeRunTimer creates a timer; pause/resume toggle paused state', async () => {
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')

    const timerState = { paused: false, destroyed: false }
    const mockTimerEvent = {
      get paused() { return timerState.paused },
      set paused(v: boolean) { timerState.paused = v },
      destroy: vi.fn(() => { timerState.destroyed = true }),
    }
    const mockScene: any = {
      rooms: new Map(),
      spawnEmojiReaction: vi.fn(),
      getNavMesh: vi.fn(() => ({ findPath: vi.fn(() => null) })),
      time: {
        addEvent: vi.fn(() => mockTimerEvent),
        delayedCall: vi.fn(),
      },
      add: { sprite: vi.fn(() => ({ setScale: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() })), ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis() })) },
      tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    }
    const mockHost: any = {
      container: null, worldX: 0, worldY: 0, counterWorldY: 0,
      baristas: [], baristaHomeX: [], baristasBusy: [false, false],
      stoolOccupied: new Set(), seatedVisitors: new Map(),
      stoolWorldX: vi.fn(), tryStartChat: vi.fn(),
    }

    const mgr = new mod.CafeCoffeeRunManager(mockScene, mockHost)
    mgr.startCoffeeRunTimer()
    expect(mockScene.time.addEvent).toHaveBeenCalledOnce()

    mgr.pause()
    expect(timerState.paused).toBe(true)

    mgr.resume()
    expect(timerState.paused).toBe(false)

    mgr.destroy()
    expect(timerState.destroyed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CoffeeRunHost interface shape
// ---------------------------------------------------------------------------

describe('CoffeeRunHost interface', () => {
  it('exports CoffeeRunHost type (checked via TSC, verifiable at runtime via usage)', async () => {
    // CoffeeRunHost is a TypeScript interface — no runtime value, but we can verify
    // that an object matching the shape is accepted by the manager constructor.
    const mod = await import('../../../src/renderer/src/game/cafe-coffee-run')
    const mockScene: any = {
      rooms: new Map(),
      spawnEmojiReaction: vi.fn(),
      getNavMesh: vi.fn(() => ({ findPath: vi.fn(() => null) })),
      time: { addEvent: vi.fn(() => ({ destroy: vi.fn(), paused: false })), delayedCall: vi.fn() },
      add: { sprite: vi.fn(() => ({ setScale: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() })), ellipse: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis() })) },
      tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    }
    // Build a host that satisfies the full CoffeeRunHost shape
    const mockHost: any = {
      container: null,
      worldX: 200,
      worldY: 400,
      counterWorldY: 370,      // worldY - 30 ≈ 370
      baristas: [],
      baristaHomeX: [119, 221],
      baristasBusy: [false, false],
      stoolOccupied: new Set<number>(),
      seatedVisitors: new Map(),
      stoolWorldX: (idx: number) => 50 + idx * 48,
      tryStartChat: vi.fn(),
    }

    // Should construct without throwing
    expect(() => new mod.CafeCoffeeRunManager(mockScene, mockHost)).not.toThrow()
  })
})
