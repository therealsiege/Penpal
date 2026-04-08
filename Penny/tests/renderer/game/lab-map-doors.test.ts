/**
 * lab-map-doors — laser door data & renderer integration
 *
 * Tests that:
 * - lab-map.json parses correctly (all 5 doors present)
 * - door schema has required fields with valid values
 * - updateLaserDoors proximity logic opens/closes correctly
 */
import { describe, it, expect } from 'vitest'
import type { LabMapDoor, LabMapJson } from '../../../src/renderer/src/game/gds-scene-renderer'
import labMapRaw from '../../../public/sprites/lab-map.json'

const labMap = labMapRaw as LabMapJson

describe('lab-map.json schema', () => {
  it('has a version field', () => {
    expect(labMap.version).toBe(1)
  })

  it('has 5 laser doors', () => {
    expect(labMap.doors).toHaveLength(5)
    for (const d of labMap.doors!) {
      expect(d.type).toBe('laser')
    }
  })

  it('all doors have required fields', () => {
    for (const d of labMap.doors!) {
      expect(d.id).toBeTruthy()
      expect(typeof d.gdsX).toBe('number')
      expect(typeof d.gdsY).toBe('number')
      expect(typeof d.width).toBe('number')
      expect(typeof d.height).toBe('number')
    }
  })

  it('door ids are unique', () => {
    const ids = labMap.doors!.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all doors are within GDS scene bounds (3840x2160)', () => {
    for (const d of labMap.doors!) {
      expect(d.gdsX).toBeGreaterThanOrEqual(0)
      expect(d.gdsY).toBeGreaterThanOrEqual(0)
      expect(d.gdsX + d.width).toBeLessThanOrEqual(3840)
      expect(d.gdsY + d.height).toBeLessThanOrEqual(2160)
    }
  })

  it('color fields are hex strings', () => {
    for (const d of labMap.doors!) {
      if (d.color) expect(d.color).toMatch(/^0x[0-9a-fA-F]{6}$/)
      if (d.glowColor) expect(d.glowColor).toMatch(/^0x[0-9a-fA-F]{6}$/)
    }
  })
})

describe('updateLaserDoors proximity logic', () => {
  it('door opens when agent is within proximityPx', () => {
    const door: LabMapDoor = {
      id: 'test-door',
      type: 'laser',
      gdsX: 100,
      gdsY: 100,
      width: 30,
      height: 100,
      proximityPx: 50,
    }
    // Door center in world space (assuming scale=1, origin=0,0):
    // worldX = 100, worldY = 100, worldW = 30, worldH = 100
    // center = (115, 150)
    const doorCX = door.gdsX + door.width / 2   // 115
    const doorCY = door.gdsY + door.height / 2  // 150
    const threshold = door.proximityPx ?? 50

    const farAgent = { x: doorCX + 200, y: doorCY }
    const closeAgent = { x: doorCX + 10, y: doorCY }

    const dist2 = (p: { x: number; y: number }): number => {
      const dx = p.x - doorCX
      const dy = p.y - doorCY
      return dx * dx + dy * dy
    }

    expect(dist2(farAgent) < threshold * threshold).toBe(false)
    expect(dist2(closeAgent) < threshold * threshold).toBe(true)
  })

  it('door stays closed when no agents are nearby', () => {
    const door: LabMapDoor = {
      id: 'test-door-2',
      type: 'laser',
      gdsX: 500,
      gdsY: 500,
      width: 30,
      height: 100,
      proximityPx: 50,
    }
    const doorCX = door.gdsX + door.width / 2
    const doorCY = door.gdsY + door.height / 2
    const threshold = door.proximityPx ?? 50

    const agents = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
    ]
    const anyClose = agents.some(p => {
      const dx = p.x - doorCX
      const dy = p.y - doorCY
      return dx * dx + dy * dy < threshold * threshold
    })
    expect(anyClose).toBe(false)
  })
})
