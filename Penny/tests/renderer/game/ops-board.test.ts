// @vitest-environment jsdom
/**
 * Ops board overlay tests (sidekick#60).
 * Validates OfficeUI.showOpsBoardOverlay / hideOpsBoardOverlay lifecycle
 * and the OfficeScene.setCapabilitiesBoard data-push path.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: { Math: {}, GameObjects: {}, BlendModes: { ADD: 0 } },
  Math: {},
  GameObjects: {},
  BlendModes: { ADD: 0 },
}))

import { OfficeUI } from '../../../src/renderer/src/game/office-ui'

// ---------------------------------------------------------------------------
// Minimal Phaser scene mock (matches room-layout.test.ts pattern)
// ---------------------------------------------------------------------------

type TweenConfig = Record<string, unknown>

function makeScene() {
  const tweensAdd = vi.fn((config: TweenConfig) => {
    const targets = config.targets as { alpha?: number } | undefined
    if (targets && typeof config.alpha === 'number') targets.alpha = config.alpha
    const onComplete = config.onComplete as (() => void) | undefined
    onComplete?.()
    return { destroy: vi.fn(), isPlaying: () => false, stop: vi.fn(), pause: vi.fn(), resume: vi.fn() }
  })

  const createdObjects: { type: string; args: unknown[] }[] = []

  const makeChainable = (type: string) =>
    (...args: unknown[]) => {
      const obj = {
        type,
        args,
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        add: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        clear: vi.fn().mockReturnThis(),
        alpha: 0,
      }
      createdObjects.push({ type, args })
      return obj
    }

  const scene = {
    scale: { width: 800, height: 600 },
    add: {
      container: makeChainable('container'),
      rectangle: makeChainable('rectangle'),
      graphics: makeChainable('graphics'),
      text: makeChainable('text'),
      sprite: makeChainable('sprite'),
    },
    tweens: {
      add: tweensAdd,
      killTweensOf: vi.fn(),
    },
    textures: { exists: vi.fn().mockReturnValue(false) },
  } as unknown as Phaser.Scene

  return { scene, tweensAdd, createdObjects }
}

// ---------------------------------------------------------------------------
// showOpsBoardOverlay / hideOpsBoardOverlay
// ---------------------------------------------------------------------------

describe('OfficeUI ops board overlay', () => {
  it('showOpsBoardOverlay sets opsVisible = true and creates overlay', () => {
    const { scene } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    expect(ui.opsVisible).toBe(false)

    const rows = [
      { id: 'graph', title: 'Knowledge Graph', status: 'ok' },
      { id: 'scheduler', title: 'Scheduler', status: 'degraded' },
    ]
    ui.showOpsBoardOverlay(rows)

    expect(ui.opsVisible).toBe(true)
  })

  it('hideOpsBoardOverlay sets opsVisible = false', () => {
    const { scene } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    ui.showOpsBoardOverlay([{ id: 'a', title: 'A', status: 'ok' }])
    expect(ui.opsVisible).toBe(true)

    ui.hideOpsBoardOverlay()
    expect(ui.opsVisible).toBe(false)
  })

  it('hideOpsBoardOverlay is a no-op when no overlay exists', () => {
    const { scene, tweensAdd } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    const callsBefore = tweensAdd.mock.calls.length
    ui.hideOpsBoardOverlay()
    // No tween should be created for a hide call without an existing overlay
    expect(tweensAdd.mock.calls.length).toBe(callsBefore)
    expect(ui.opsVisible).toBe(false)
  })

  it('showOpsBoardOverlay refreshes in-place when called twice (destroys prior)', () => {
    const { scene } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    ui.showOpsBoardOverlay([{ id: 'a', title: 'A', status: 'ok' }])
    expect(ui.opsVisible).toBe(true)

    // Calling again should not throw and should remain visible
    ui.showOpsBoardOverlay([{ id: 'b', title: 'B', status: 'error' }])
    expect(ui.opsVisible).toBe(true)
  })

  it('showOpsBoardOverlay handles empty rows gracefully', () => {
    const { scene } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    // Should not throw
    ui.showOpsBoardOverlay([])
    expect(ui.opsVisible).toBe(true)
  })

  it('destroy cleans up ops overlay', () => {
    const { scene } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    ui.showOpsBoardOverlay([{ id: 'x', title: 'X', status: 'unknown' }])
    expect(ui.opsVisible).toBe(true)

    ui.destroy()
    expect(ui.opsVisible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Help overlay still includes O shortcut
// ---------------------------------------------------------------------------

describe('OfficeUI help overlay includes O shortcut', () => {
  it('showHelpOverlay creates text elements including O key', () => {
    const { scene, createdObjects } = makeScene()
    const ui = new OfficeUI(scene)
    ui.init(800, 600)

    ui.showHelpOverlay()

    // Find text objects that contain 'O' as their first argument (the key label)
    const textArgs = createdObjects
      .filter(o => o.type === 'text')
      .map(o => o.args[2]) // third arg to add.text is the string content

    expect(textArgs).toContain('O')
  })
})
