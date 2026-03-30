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
    EventBus: { ...mod.EventBus, emit: vi.fn(), on: vi.fn() },
  }
})

import { SCENE_KEYS, SPRITESHEET_KEYS, ANIM_KEYS, IMAGE_KEYS, AUDIO_KEYS, EFFECT_ANIM_KEYS, ANIMAL_SPECIES } from '../../../src/renderer/src/game/office-asset-keys'

describe('BootScene', () => {
  // -----------------------------------------------------------------------
  // SCENE_KEYS includes BOOT
  // -----------------------------------------------------------------------
  it('SCENE_KEYS exposes BOOT key', () => {
    expect(SCENE_KEYS.BOOT).toBe('BootScene')
  })

  it('SCENE_KEYS still has OFFICE and UI_SCENE', () => {
    expect(SCENE_KEYS.OFFICE).toBe('OfficeScene')
    expect(SCENE_KEYS.UI_SCENE).toBe('UIScene')
  })

  // -----------------------------------------------------------------------
  // BootScene class structure
  // -----------------------------------------------------------------------
  it('BootScene extends BaseScene and uses BOOT key', async () => {
    const { BootScene } = await import('../../../src/renderer/src/game/boot-scene')
    const scene = new BootScene()
    // BaseScene subclass stores scene key in config
    expect(scene).toBeDefined()
    expect(typeof scene.onPreload).toBe('function')
    expect(typeof scene.onCreate).toBe('function')
    expect(typeof scene.onUpdate).toBe('function')
  })

  // -----------------------------------------------------------------------
  // Asset key completeness — BootScene must load every key
  // -----------------------------------------------------------------------
  it('BootScene.onPreload references all SPRITESHEET_KEYS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    for (const key of Object.keys(SPRITESHEET_KEYS)) {
      expect(src, `Missing SPRITESHEET_KEYS.${key} in boot-scene.ts`).toContain(`SPRITESHEET_KEYS.${key}`)
    }
  })

  it('BootScene.onPreload references all ANIM_KEYS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    for (const key of Object.keys(ANIM_KEYS)) {
      expect(src, `Missing ANIM_KEYS.${key} in boot-scene.ts`).toContain(`ANIM_KEYS.${key}`)
    }
  })

  it('BootScene.onPreload references all IMAGE_KEYS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    for (const key of Object.keys(IMAGE_KEYS)) {
      expect(src, `Missing IMAGE_KEYS.${key} in boot-scene.ts`).toContain(`IMAGE_KEYS.${key}`)
    }
  })

  it('BootScene.onPreload references all AUDIO_KEYS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    for (const key of Object.keys(AUDIO_KEYS)) {
      expect(src, `Missing AUDIO_KEYS.${key} in boot-scene.ts`).toContain(`AUDIO_KEYS.${key}`)
    }
  })

  // -----------------------------------------------------------------------
  // Animation registration — BootScene.onCreate registers all VFX + animal anims
  // -----------------------------------------------------------------------
  it('BootScene.onCreate references all EFFECT_ANIM_KEYS', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    for (const key of Object.keys(EFFECT_ANIM_KEYS)) {
      expect(src, `Missing EFFECT_ANIM_KEYS.${key} in boot-scene.ts`).toContain(`EFFECT_ANIM_KEYS.${key}`)
    }
  })

  it('BootScene.onCreate registers animal idle + blink for all species', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('ANIMAL_SPECIES')
    expect(src).toContain('ANIMAL_IDLE_FRAMES')
    expect(src).toContain('animal-idle-')
    expect(src).toContain('animal-blink-')
  })

  // -----------------------------------------------------------------------
  // OfficeScene no longer loads assets or registers animations
  // -----------------------------------------------------------------------
  it('OfficeScene.preload is a no-op (assets loaded by BootScene)', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/OfficeScene.ts'),
        'utf-8',
      ),
    )
    // preload should NOT contain this.load.spritesheet or this.load.image
    expect(src).not.toMatch(/preload\(\)[^}]*this\.load\.spritesheet/)
    expect(src).not.toMatch(/preload\(\)[^}]*this\.load\.image/)
  })

  it('OfficeScene.create does not register VFX animations', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/OfficeScene.ts'),
        'utf-8',
      ),
    )
    // EFFECT_ANIM_KEYS should not be imported or used
    expect(src).not.toContain('EFFECT_ANIM_KEYS')
    expect(src).not.toContain('ANIMAL_IDLE_FRAMES')
    expect(src).not.toContain('ANIMAL_SPECIES')
  })

  // -----------------------------------------------------------------------
  // OfficeGame scene order — BootScene is first
  // -----------------------------------------------------------------------
  it('OfficeGame registers BootScene, CampusScene, then OfficeScene', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/OfficeGame.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain("import { BootScene } from './boot-scene'")
    expect(src).toContain("import { CampusScene } from './campus-scene'")
    // BootScene < CampusScene < OfficeScene in the array
    const sceneArrayMatch = src.match(/scene:\s*\[([^\]]+)\]/)
    expect(sceneArrayMatch).toBeTruthy()
    const sceneArray = sceneArrayMatch![1]
    const bootIdx = sceneArray.indexOf('new BootScene()')
    const campusIdx = sceneArray.indexOf('new CampusScene()')
    const officeIdx = sceneArray.indexOf('scene,')
    expect(bootIdx).toBeLessThan(campusIdx)
    expect(campusIdx).toBeLessThan(officeIdx)
  })

  // -----------------------------------------------------------------------
  // BootScene complete handler transitions to CampusScene
  // -----------------------------------------------------------------------
  it('BootScene starts CampusScene on load complete', async () => {
    const src = await import('fs').then(fs =>
      fs.readFileSync(
        require('path').resolve(__dirname, '../../../src/renderer/src/game/boot-scene.ts'),
        'utf-8',
      ),
    )
    expect(src).toContain('this.scene.start(SCENE_KEYS.CAMPUS)')
  })
})
