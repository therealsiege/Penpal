// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

// Mock Phaser before any imports that depend on it
vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {
      constructor(_config?: unknown) {}
    },
    Math: {},
    GameObjects: {},
  },
  Scene: class MockScene {
    constructor(_config?: unknown) {}
  },
}))

vi.mock('../../../src/renderer/src/game/events', async importOriginal => {
  const mod = await importOriginal<typeof import('../../../src/renderer/src/game/events')>()
  return {
    ...mod,
    EventBus: { ...mod.EventBus, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  }
})

import { SCENE_KEYS } from '../../../src/renderer/src/game/office-asset-keys'
import { EVENTS } from '../../../src/renderer/src/game/events'

describe('CampusScene', () => {
  // -----------------------------------------------------------------------
  // SCENE_KEYS includes CAMPUS
  // -----------------------------------------------------------------------
  it('SCENE_KEYS exposes CAMPUS key', () => {
    expect(SCENE_KEYS.CAMPUS).toBe('CampusScene')
  })

  it('SCENE_KEYS still has BOOT, OFFICE, and UI_SCENE', () => {
    expect(SCENE_KEYS.BOOT).toBe('BootScene')
    expect(SCENE_KEYS.OFFICE).toBe('OfficeScene')
    expect(SCENE_KEYS.UI_SCENE).toBe('UIScene')
  })

  // -----------------------------------------------------------------------
  // CampusScene class structure
  // -----------------------------------------------------------------------
  it('CampusScene extends BaseScene and uses CAMPUS key', async () => {
    const { CampusScene } = await import('../../../src/renderer/src/game/campus-scene')
    const scene = new CampusScene()
    expect(scene).toBeDefined()
    expect(typeof scene.onPreload).toBe('function')
    expect(typeof scene.onCreate).toBe('function')
    expect(typeof scene.onUpdate).toBe('function')
  })

  // -----------------------------------------------------------------------
  // Navigation events exist
  // -----------------------------------------------------------------------
  it('EVENTS includes NAVIGATE_CAMPUS, NAVIGATE_BUILDING, CAMPUS_COUNTS_UPDATED', () => {
    expect(EVENTS.NAVIGATE_CAMPUS).toBe('navigate-campus')
    expect(EVENTS.NAVIGATE_BUILDING).toBe('navigate-building')
    expect(EVENTS.CAMPUS_COUNTS_UPDATED).toBe('campus-counts-updated')
  })

  // -----------------------------------------------------------------------
  // BootScene now transitions to CampusScene
  // -----------------------------------------------------------------------
  it('BootScene starts CampusScene on load complete', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('this.scene.start(SCENE_KEYS.CAMPUS)')
    expect(src).not.toContain('this.scene.start(SCENE_KEYS.OFFICE)')
  })

  // -----------------------------------------------------------------------
  // OfficeGame registers CampusScene in the scene array
  // -----------------------------------------------------------------------
  it('OfficeGame registers CampusScene between BootScene and OfficeScene', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/OfficeGame.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain("import { CampusScene } from './campus-scene'")
    const sceneArrayMatch = src.match(/scene:\s*\[([^\]]+)\]/)
    expect(sceneArrayMatch).toBeTruthy()
    const sceneArray = sceneArrayMatch![1]
    const bootIdx = sceneArray.indexOf('new BootScene()')
    const campusIdx = sceneArray.indexOf('new CampusScene()')
    const officeIdx = sceneArray.indexOf('scene,')
    expect(bootIdx).toBeGreaterThanOrEqual(0)
    expect(campusIdx).toBeGreaterThan(bootIdx)
    expect(officeIdx).toBeGreaterThan(campusIdx)
  })

  // -----------------------------------------------------------------------
  // CampusScene source contains expected patterns
  // -----------------------------------------------------------------------
  it('campus-scene.ts listens for CAMPUS_COUNTS_UPDATED and NAVIGATE_CAMPUS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/campus-scene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('EVENTS.CAMPUS_COUNTS_UPDATED')
    expect(src).toContain('EVENTS.NAVIGATE_CAMPUS')
  })

  it('campus-scene.ts navigates to OFFICE scene', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/campus-scene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('SCENE_KEYS.OFFICE')
    expect(src).toContain('SCENE_KEYS.CAMPUS')
  })

  // -----------------------------------------------------------------------
  // OfficeScene emits CAMPUS_COUNTS_UPDATED
  // -----------------------------------------------------------------------
  it('OfficeScene emits CAMPUS_COUNTS_UPDATED in setAgents and setPodWorkflows', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/OfficeScene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('EVENTS.CAMPUS_COUNTS_UPDATED')
    expect(src).toContain('EVENTS.NAVIGATE_BUILDING')
    expect(src).toContain('EVENTS.NAVIGATE_CAMPUS')
  })
})
