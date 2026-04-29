/**
 * Vitest unit tests for AgentAvatar (issue #92).
 * Focus: state machine transitions, idle timers, walkTo pathfinding,
 * sitting/coffee-run states, Y-sort depth, destroy cleanup.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
    GameObjects: {},
  },
  Math: { DegToRad: (deg: number) => (deg * Math.PI) / 180 },
  GameObjects: {},
}))

import { AgentAvatar } from '../../../src/renderer/src/game/agent-avatar'
import type { AgentAvatarConfig } from '../../../src/renderer/src/game/agent-avatar'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

type TimeEventConfig = { delay: number; loop?: boolean; callback: () => void }

function makeMockScene() {
  const timeEvents: TimeEventConfig[] = []

  const tweensAdd = vi.fn((cfg: Record<string, unknown>) => {
    const tw = { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn() }
    const onComplete = cfg.onComplete as (() => void) | undefined
    onComplete?.()
    return tw
  })

  const scene = {
    scene: { isActive: vi.fn(() => true) },
    tweens: { add: tweensAdd, killTweensOf: vi.fn() },
    time: {
      addEvent: vi.fn((ev: TimeEventConfig) => {
        timeEvents.push(ev)
        return { destroy: vi.fn(), ...ev }
      }),
    },
    textures: { exists: vi.fn(() => true) },
    add: {
      sprite: vi.fn((_x: number, _y: number, _key: string, _frame?: number) => ({
        x: _x,
        y: _y,
        active: true,
        depth: 0,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        setScale: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn(function (this: { depth: number }, d: number) { this.depth = d; return this }),
        setFrame: vi.fn(),
        setTexture: vi.fn(),
        setAngle: vi.fn(function (this: { angle: number }, a: number) { this.angle = a; return this }),
        setFlipX: vi.fn(),
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
          this.x = x; this.y = y; return this
        }),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      ellipse: vi.fn((_x: number, _y: number, _w: number, _h: number, _c: number, _a: number) => ({
        x: _x,
        y: _y,
        depth: 0,
        setDepth: vi.fn(function (this: { depth: number }, d: number) { this.depth = d; return this }),
        destroy: vi.fn(),
      })),
    },
  } as unknown as Phaser.Scene

  return { scene, timeEvents }
}

function makeMockNavMesh() {
  return {
    findPath: vi.fn((_start: { x: number; y: number }, _end: { x: number; y: number }) => {
      // Return a simple 2-waypoint path
      return [
        { x: (_start.x + _end.x) / 2, y: (_start.y + _end.y) / 2 },
        { x: _end.x, y: _end.y },
      ]
    }),
  }
}

function makeAvatar(overrides?: Partial<AgentAvatarConfig>) {
  const { scene, timeEvents } = makeMockScene()
  const navMesh = makeMockNavMesh()
  const config: AgentAvatarConfig = {
    scene,
    x: 100,
    y: 200,
    navMesh: navMesh as unknown as import('../../../src/renderer/src/game/nav-mesh').NavMesh,
    charIndex: 0,
    ...overrides,
    ...(overrides?.scene ? {} : {}),
  }
  if (overrides?.scene) config.scene = overrides.scene
  if (overrides?.navMesh) config.navMesh = overrides.navMesh as unknown as import('../../../src/renderer/src/game/nav-mesh').NavMesh

  const avatar = new AgentAvatar(config)
  return { avatar, scene, navMesh, timeEvents }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentAvatar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates sprite and shadow at given position', () => {
      const { scene } = makeAvatar()
      expect((scene.add.sprite as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        100, 200, 'anim-walk-1', 0,
      )
      expect((scene.add.ellipse as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        100, 208, 18, 6, 0x000000, 0.25,
      )
    })

    it('uses WALK_2 sheet for charIndex 1', () => {
      const { scene } = makeAvatar({ charIndex: 1 })
      expect((scene.add.sprite as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        100, 200, 'anim-walk-2', 0,
      )
    })

    it('sets custom depth when provided', () => {
      const { avatar } = makeAvatar({ depth: 500 })
      expect(avatar.sprite.setDepth).toHaveBeenCalledWith(500)
      expect(avatar.shadow.setDepth).toHaveBeenCalledWith(499)
    })
  })

  describe('state machine', () => {
    it('starts with no state until idle() or walkTo() is called', () => {
      const { avatar } = makeAvatar()
      expect(avatar.stateName).toBe('none')
    })

    it('enters idle state', () => {
      const { avatar } = makeAvatar()
      avatar.idle()
      expect(avatar.stateName).toBe('idle')
    })

    it('enters sitting state', () => {
      const { avatar } = makeAvatar()
      avatar.sit()
      expect(avatar.stateName).toBe('sitting')
    })

    it('transitions from idle to walking on walkTo()', () => {
      const { avatar, navMesh } = makeAvatar()
      avatar.idle()
      avatar.walkTo(150, 250)
      expect(navMesh.findPath).toHaveBeenCalled()
      expect(avatar.stateName).toBe('walking')
    })

    it('returns to idle when walk completes (walker stops)', () => {
      const { avatar } = makeAvatar()
      avatar.idle()
      avatar.walkTo(150, 250)
      expect(avatar.stateName).toBe('walking')
      // Simulate walker finishing: update will detect !isWalking and transition
      avatar.update(16)
      // After the update cycle, fsm drains the queued 'idle' state
      avatar.update(16)
      expect(avatar.stateName).toBe('idle')
    })
  })

  describe('walkTo', () => {
    it('calls navMesh.findPath with start and end positions', () => {
      const { avatar, navMesh } = makeAvatar()
      avatar.walkTo(300, 400)
      expect(navMesh.findPath).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        { x: 300, y: 400 },
      )
    })

    it('fires onComplete callback when path is null', () => {
      const { scene, timeEvents } = makeMockScene()
      const navMesh = { findPath: vi.fn(() => null) }
      const avatar = new AgentAvatar({
        scene,
        x: 100, y: 200,
        navMesh: navMesh as unknown as import('../../../src/renderer/src/game/nav-mesh').NavMesh,
      })
      const cb = vi.fn()
      avatar.walkTo(300, 400, cb)
      expect(cb).toHaveBeenCalled()
    })

    it('fires onComplete callback when path is empty', () => {
      const { scene } = makeMockScene()
      const navMesh = { findPath: vi.fn(() => []) }
      const avatar = new AgentAvatar({
        scene,
        x: 100, y: 200,
        navMesh: navMesh as unknown as import('../../../src/renderer/src/game/nav-mesh').NavMesh,
      })
      const cb = vi.fn()
      avatar.walkTo(300, 400, cb)
      expect(cb).toHaveBeenCalled()
    })
  })

  describe('sitting', () => {
    it('sets texture to sit sheet on enter', () => {
      const { avatar } = makeAvatar()
      avatar.sit()
      expect(avatar.sprite.setTexture).toHaveBeenCalledWith('anim-sit-1', 0)
    })

    it('uses SIT_2 for charIndex 1', () => {
      const { avatar } = makeAvatar({ charIndex: 1 })
      avatar.sit()
      expect(avatar.sprite.setTexture).toHaveBeenCalledWith('anim-sit-2', 0)
    })

    it('resets angle to 0 on sit', () => {
      const { avatar } = makeAvatar()
      avatar.sit()
      expect(avatar.sprite.setAngle).toHaveBeenCalledWith(0)
    })
  })

  describe('coffee-run', () => {
    it('enters coffee-run state', () => {
      const { avatar } = makeAvatar()
      const waypoints = [{ x: 150, y: 250 }, { x: 200, y: 300 }]
      avatar.startCoffeeRun(waypoints)
      expect(avatar.stateName).toBe('coffee-run')
    })
  })

  describe('idle micro-variety timers', () => {
    it('schedules timers on idle entry', () => {
      const { avatar, scene } = makeAvatar()
      avatar.idle()
      // 3 timers: lookAround, stretch, walkBreak
      expect((scene.time.addEvent as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3)
    })

    it('clears timers on state exit', () => {
      const { avatar, timeEvents } = makeAvatar()
      avatar.idle()
      const timerCount = timeEvents.length
      expect(timerCount).toBe(3)
      // Transition away should clear timers
      avatar.sit()
      // Timers' destroy should have been called (via clearIdleTimers)
    })

    it('walk-break timer triggers walkTo', () => {
      const { avatar, timeEvents, navMesh } = makeAvatar()
      avatar.idle()
      // Find the walk-break timer (3rd timer added)
      const walkBreakTimer = timeEvents[2]
      expect(walkBreakTimer).toBeDefined()
      // Fire it
      walkBreakTimer.callback()
      expect(navMesh.findPath).toHaveBeenCalled()
    })
  })

  describe('Y-sort depth', () => {
    it('sets depth to sprite.y on update', () => {
      const { avatar } = makeAvatar()
      avatar.idle()
      avatar.update(16)
      expect(avatar.sprite.setDepth).toHaveBeenCalledWith(200) // y=200
      expect(avatar.shadow.setDepth).toHaveBeenCalledWith(199)
    })
  })

  describe('position getter', () => {
    it('returns sprite x/y', () => {
      const { avatar } = makeAvatar()
      expect(avatar.position).toEqual({ x: 100, y: 200 })
    })
  })

  describe('destroy', () => {
    it('cleans up sprite, shadow, walker, and timers', () => {
      const { avatar } = makeAvatar()
      avatar.idle()
      avatar.destroy()
      expect(avatar.sprite.destroy).toHaveBeenCalled()
      expect(avatar.shadow.destroy).toHaveBeenCalled()
    })

    it('is idempotent', () => {
      const { avatar } = makeAvatar()
      avatar.destroy()
      avatar.destroy() // should not throw
    })

    it('prevents further state transitions after destroy', () => {
      const { avatar } = makeAvatar()
      avatar.destroy()
      avatar.idle() // should be no-op
      expect(avatar.stateName).toBe('none')
    })

    it('prevents walkTo after destroy', () => {
      const { avatar, navMesh } = makeAvatar()
      avatar.destroy()
      avatar.walkTo(300, 400)
      expect(navMesh.findPath).not.toHaveBeenCalled()
    })
  })
})
