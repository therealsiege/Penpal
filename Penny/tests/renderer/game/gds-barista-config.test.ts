// gds-barista-config.test.ts
// Verifies that barista configuration has been moved from hardcoded constants
// in gds-scene-renderer.ts to lab-map.json (#157).

import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../../..')

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8')
}

function readJson(relPath: string): unknown {
  return JSON.parse(readSrc(relPath))
}

// ---------------------------------------------------------------------------
// lab-map.json structure
// ---------------------------------------------------------------------------

describe('lab-map.json', () => {
  const labMap = readJson('public/sprites/lab-map.json') as {
    baristas?: unknown[]
  }

  it('has a baristas array', () => {
    expect(Array.isArray(labMap.baristas)).toBe(true)
  })

  it('has at least one barista entry', () => {
    expect((labMap.baristas ?? []).length).toBeGreaterThan(0)
  })

  it('every barista has required fields', () => {
    const requiredFields = [
      'id', 'name', 'charIdx', 'gdsX', 'gdsY',
      'startFacing', 'walkRange', 'walkDurationMs',
      'bobAmplitude', 'bobDurationMs', 'workPulses', 'startDelayMs',
    ] as const

    for (const barista of labMap.baristas as Record<string, unknown>[]) {
      for (const field of requiredFields) {
        expect(barista, `barista "${barista.id ?? '?'}" is missing field "${field}"`).toHaveProperty(field)
      }
    }
  })

  it('startFacing is "left" or "right" for every barista', () => {
    for (const barista of labMap.baristas as Record<string, unknown>[]) {
      expect(['left', 'right']).toContain(barista.startFacing)
    }
  })

  it('contains Latte Larry entry', () => {
    const larry = (labMap.baristas as Record<string, unknown>[]).find(b => b.id === 'latte-larry')
    expect(larry).toBeDefined()
    expect(larry!.charIdx).toBe(1)
    expect(larry!.gdsX).toBe(2580)
    expect(larry!.gdsY).toBe(800)
  })

  it('contains Mocha Maya entry', () => {
    const maya = (labMap.baristas as Record<string, unknown>[]).find(b => b.id === 'mocha-maya')
    expect(maya).toBeDefined()
    expect(maya!.charIdx).toBe(0)
    expect(maya!.gdsX).toBe(2580)
    expect(maya!.gdsY).toBe(1050)
  })
})

// ---------------------------------------------------------------------------
// gds-scene-renderer.ts — no hardcoded barista list
// ---------------------------------------------------------------------------

describe('gds-scene-renderer.ts', () => {
  const src = readSrc('src/renderer/src/game/gds-scene-renderer.ts')

  it('exports LabMapBarista interface', () => {
    expect(src).toContain('LabMapBarista')
  })

  it('exports LabMapJson interface with optional baristas field', () => {
    expect(src).toContain('LabMapJson')
    expect(src).toContain('baristas?')
  })

  it('reads labMap from Phaser JSON cache', () => {
    expect(src).toContain('cache.json.get')
    expect(src).toContain('GDS_SCENE_KEYS.LAB_MAP')
  })

  it('uses labMap.baristas (not hardcoded list) in placeBaristas', () => {
    expect(src).toContain('this.labMap')
    expect(src).toContain('labMap?.baristas')
  })

  it('does not contain hardcoded Latte Larry or Mocha Maya strings in BARISTAS const', () => {
    // The names should only appear in comments or via the JSON data, not as
    // inline object literals in the BARISTAS const.
    const hardcodedPattern = /const BARISTAS\s*=\s*\[[\s\S]*?Latte Larry[\s\S]*?\]/
    expect(src).not.toMatch(hardcodedPattern)
  })
})

// ---------------------------------------------------------------------------
// office-asset-keys.ts — GDS_SCENE_KEYS.LAB_MAP defined
// ---------------------------------------------------------------------------

describe('office-asset-keys.ts', () => {
  const src = readSrc('src/renderer/src/game/office-asset-keys.ts')

  it('defines GDS_SCENE_KEYS.LAB_MAP', () => {
    expect(src).toContain('LAB_MAP')
    expect(src).toContain("'lab-map'")
  })
})

// ---------------------------------------------------------------------------
// boot-scene.ts — loads lab-map.json via Phaser JSON loader
// ---------------------------------------------------------------------------

describe('boot-scene.ts', () => {
  const src = readSrc('src/renderer/src/game/boot-scene.ts')

  it('imports GDS_SCENE_KEYS', () => {
    expect(src).toContain('GDS_SCENE_KEYS')
  })

  it('loads lab-map.json via this.load.json', () => {
    expect(src).toContain('load.json')
    expect(src).toContain('lab-map.json')
  })
})

// Mock to satisfy vitest — not needed for pure fs tests but prevents warnings
vi.mock('phaser', () => ({ default: {} }))
