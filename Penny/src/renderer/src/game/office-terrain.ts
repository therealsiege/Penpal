import Phaser from 'phaser'
import type { Room } from './office-types'
import { WORLD_MARGIN } from './office-constants'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS, ITEM_FRAMES, ICON_FRAMES, IMAGE_KEYS } from './office-asset-keys'
import { activeTheme } from './office-theme'

// ---------------------------------------------------------------------------
// Host interface — what OfficeTerrain needs from OfficeScene
// ---------------------------------------------------------------------------

export interface TerrainHostScene {
  getRooms(): Map<string, Room>
}

// ---------------------------------------------------------------------------
// OfficeTerrain
// Owns: outdoor terrain graphics and decorations (the industrial Midgar floor
//       surrounding the building area).
// ---------------------------------------------------------------------------

export class OfficeTerrain {
  private scene: Phaser.Scene
  private host: TerrainHostScene

  private terrainGraphics: Phaser.GameObjects.Graphics | null = null
  private terrainDecos: Phaser.GameObjects.GameObject[] = []
  private lastTerrainW = 0
  private lastTerrainH = 0

  // Reactor center position is set during drawOutdoorTerrain and read by the caller
  reactorCenter: { x: number; y: number; rx: number; ry: number } | null = null

  // Reactor pulse VFX timing
  private lastReactorPulseAt = 0
  private reactorPulseInterval = 6000 + Math.random() * 8000 // 6-14s between pulses

  // Terrain prop sprites (wrench, first-aid near pipes)
  private propSprites: Phaser.GameObjects.Sprite[] = []

  constructor(scene: Phaser.Scene, host: TerrainHostScene) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Init — called after scene graphics layers are established
  // ---------------------------------------------------------------------------

  init(terrainGraphics: Phaser.GameObjects.Graphics): void {
    this.terrainGraphics = terrainGraphics
    // Subtle parallax — terrain scrolls 5% slower than foreground for depth
    terrainGraphics.setScrollFactor(0.95)
  }

  // ---------------------------------------------------------------------------
  // getSeasonalConfig
  // ---------------------------------------------------------------------------

  getSeasonalConfig(): {
    color: number
    accent: number
    extraDecorType: 'winter' | 'spring' | 'summer' | 'autumn'
  } {
    const month = new Date().getMonth()
    if (month === 11 || month <= 1) return { color: 0x93c5fd, accent: 0xef4444, extraDecorType: 'winter' }
    if (month >= 2 && month <= 4) return { color: 0x86efac, accent: 0xd4a017, extraDecorType: 'spring' }
    if (month >= 5 && month <= 7) return { color: 0x00e5ff, accent: 0x00ff88, extraDecorType: 'summer' }
    return { color: 0xd4a017, accent: 0xd4a017, extraDecorType: 'autumn' }
  }

  // ---------------------------------------------------------------------------
  // drawOutdoorTerrain — RPG-style grass, trees, paths around buildings
  // ---------------------------------------------------------------------------

  drawOutdoorTerrain(worldW: number, worldH: number): void {
    if (worldW === this.lastTerrainW && worldH === this.lastTerrainH) return
    this.lastTerrainW = worldW
    this.lastTerrainH = worldH

    const g = this.terrainGraphics
    if (!g) return
    g.clear()
    for (const d of this.terrainDecos) { try { (d as { destroy(): void }).destroy() } catch { /* */ } }
    this.terrainDecos = []

    // FF7 Midgar industrial theme — steel plates, mako glow, pipes, grating

    const PAD = 300
    const x0 = -PAD
    const y0 = -PAD
    const w = worldW + PAD * 2
    const h = worldH + PAD * 2

    let seed = 42
    const rand = (): number => { seed = (seed * 16807 + 11) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff }

    // Building rects for collision
    const rooms = this.host.getRooms()
    const buildingRects: { x: number; y: number; w: number; h: number }[] = []
    for (const room of rooms.values()) {
      buildingRects.push({
        x: room.x - room.width / 2 - 15,
        y: room.y - room.height / 2 - 15,
        w: room.width + 30,
        h: room.height + 30,
      })
    }
    const isOverlapping = (tx: number, ty: number, radius: number): boolean => {
      for (const r of buildingRects) {
        if (tx + radius > r.x && tx - radius < r.x + r.w && ty + radius > r.y && ty - radius < r.y + r.h) return true
      }
      return false
    }

    // ── 1. Base metal floor — dark steel plate ──
    g.fillStyle(0x1a1e2a, 1)
    g.fillRect(x0, y0, w, h)

    // Steel plate grid — irregular sizes for organic look
    // Build a mix of plate widths instead of uniform grid
    const plateWidths: number[] = []
    for (let gx = x0; gx < x0 + w;) {
      const pw = 100 + Math.floor(rand() * 120) // 100-220px wide
      plateWidths.push(pw)
      gx += pw
    }
    const plateHeights: number[] = []
    for (let gy = y0; gy < y0 + h;) {
      const ph = 100 + Math.floor(rand() * 120)
      plateHeights.push(ph)
      gy += ph
    }

    // Draw plate seam lines (vertical)
    let accX = x0
    for (const pw of plateWidths) {
      accX += pw
      if (accX >= x0 + w) break
      const lineAlpha = 0.2 + rand() * 0.2
      g.lineStyle(rand() > 0.7 ? 1.5 : 1, 0x2a3040, lineAlpha)
      g.lineBetween(accX, y0, accX, y0 + h)
    }
    // Draw plate seam lines (horizontal)
    let accY = y0
    for (const ph of plateHeights) {
      accY += ph
      if (accY >= y0 + h) break
      const lineAlpha = 0.2 + rand() * 0.2
      g.lineStyle(rand() > 0.7 ? 1.5 : 1, 0x2a3040, lineAlpha)
      g.lineBetween(x0, accY, x0 + w, accY)
    }

    // Plate variation — some panels slightly lighter/darker
    accY = y0
    for (const ph of plateHeights) {
      accX = x0
      for (const pw of plateWidths) {
        const r = rand()
        if (r < 0.15) {
          g.fillStyle(0x242a38, 0.35 + rand() * 0.2)
          g.fillRect(accX + 1, accY + 1, pw - 2, ph - 2)
        } else if (r < 0.25) {
          g.fillStyle(0x141822, 0.25 + rand() * 0.15)
          g.fillRect(accX + 1, accY + 1, pw - 2, ph - 2)
        }
        accX += pw
      }
      accY += ph
    }

    // Bolts — sparse, only at some plate corners
    accY = y0
    for (const ph of plateHeights) {
      accX = x0
      for (const pw of plateWidths) {
        if (rand() > 0.25) { accX += pw; continue }
        const corners = [[accX + 6, accY + 6], [accX + pw - 6, accY + 6]]
        if (rand() > 0.5) corners.push([accX + 6, accY + ph - 6])
        for (const [bx, by] of corners) {
          const bolt = this.scene.add.sprite(bx, by, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
            .setScale(0.14).setAlpha(0.3 + rand() * 0.15).setTint(0x3a4050).setDepth(-10)
          this.terrainDecos.push(bolt)
        }
        accX += pw
      }
      accY += ph
    }

    // ── 2. Mako energy seams — glowing green/cyan lines in the floor ──
    const MAKO_GREEN = 0x00ff88
    const MAKO_CYAN = 0x00e5ff

    // Horizontal mako seam — thin line, no glow halo
    const seamY = WORLD_MARGIN - 40
    g.lineStyle(3, MAKO_GREEN, 0.2)
    g.lineBetween(x0, seamY, x0 + w, seamY)

    // Vertical mako seams — thin lines, no glow halo
    const vertSeamX1 = WORLD_MARGIN + 60
    const vertSeamX2 = worldW - WORLD_MARGIN - 60
    if (worldH > 300) {
      for (const sx of [vertSeamX1, vertSeamX2]) {
        g.lineStyle(2, MAKO_CYAN, 0.15)
        g.lineBetween(sx, seamY, sx, worldH + PAD)
      }
    }

    // Mako reactor vent — compact, understated
    const poolCX = worldW - WORLD_MARGIN - 180
    const poolCY = worldH - WORLD_MARGIN - 130
    const poolRX = 60 + rand() * 20
    const poolRY = 40 + rand() * 15
    if (!isOverlapping(poolCX, poolCY, Math.max(poolRX, poolRY) + 20)) {
      // Outer rim — dark metal
      g.fillStyle(0x2a3040, 0.45)
      g.fillEllipse(poolCX, poolCY, poolRX + 12, poolRY + 8)
      // Grating ring
      g.lineStyle(2, 0x3a4a5a, 0.35)
      g.strokeEllipse(poolCX, poolCY, poolRX + 6, poolRY + 4)
      // Reactor pool — very subtle green
      g.fillStyle(MAKO_GREEN, 0.03)
      g.fillEllipse(poolCX, poolCY, poolRX, poolRY)
      // Subtle center
      g.fillStyle(MAKO_GREEN, 0.02)
      g.fillEllipse(poolCX, poolCY, poolRX * 0.5, poolRY * 0.5)
      // Warning stripes (fewer, smaller)
      const stripeCount = 10
      for (let si = 0; si < stripeCount; si++) {
        const angle = (si / stripeCount) * Math.PI * 2
        const sx1 = poolCX + Math.cos(angle) * (poolRX + 15)
        const sy1 = poolCY + Math.sin(angle) * (poolRY + 10)
        const sx2 = poolCX + Math.cos(angle) * (poolRX + 25)
        const sy2 = poolCY + Math.sin(angle) * (poolRY + 18)
        g.lineStyle(2, 0xd4a017, 0.15)
        g.lineBetween(sx1, sy1, sx2, sy2)
      }
      this.reactorCenter = { x: poolCX, y: poolCY, rx: poolRX, ry: poolRY }
    } else {
      this.reactorCenter = null
    }

    // ── 3. Pipes — horizontal and vertical runs (with overlap avoidance) ──
    const pipePositions: { x1: number; y1: number; x2: number; y2: number; r: number }[] = []
    const pipeTooClose = (mx: number, my: number, pr: number): boolean => {
      for (const p of pipePositions) {
        const pmx = (p.x1 + p.x2) / 2, pmy = (p.y1 + p.y2) / 2
        if (Math.hypot(mx - pmx, my - pmy) < pr + p.r + 60) return true
      }
      return false
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const isVert = rand() > 0.5
      const pr = 8 + rand() * 6
      let px1: number, py1: number, px2: number, py2: number
      if (isVert) {
        px1 = px2 = x0 + 80 + rand() * (w - 160)
        py1 = y0 + rand() * h * 0.3
        py2 = py1 + 150 + rand() * 300
      } else {
        py1 = py2 = y0 + 80 + rand() * (h - 160)
        px1 = x0 + rand() * w * 0.3
        px2 = px1 + 150 + rand() * 300
      }
      const midX = (px1 + px2) / 2, midY = (py1 + py2) / 2
      if (isOverlapping(midX, midY, 25)) continue
      if (pipeTooClose(midX, midY, pr)) continue
      pipePositions.push({ x1: px1, y1: py1, x2: px2, y2: py2, r: pr })
    }

    for (const pipe of pipePositions) {
      // Pipe shadow
      g.fillStyle(0x000000, 0.08)
      const isVert = pipe.x1 === pipe.x2
      if (isVert) {
        g.fillRect(pipe.x1 - pipe.r + 4, pipe.y1 + 4, pipe.r * 2, pipe.y2 - pipe.y1)
      } else {
        g.fillRect(pipe.x1 + 4, pipe.y1 - pipe.r + 4, pipe.x2 - pipe.x1, pipe.r * 2)
      }
      // Pipe body
      g.fillStyle(0x4a5568, 0.7)
      if (isVert) {
        g.fillRect(pipe.x1 - pipe.r, pipe.y1, pipe.r * 2, pipe.y2 - pipe.y1)
      } else {
        g.fillRect(pipe.x1, pipe.y1 - pipe.r, pipe.x2 - pipe.x1, pipe.r * 2)
      }
      // Highlight stripe
      g.fillStyle(0x6b7a8a, 0.4)
      if (isVert) {
        g.fillRect(pipe.x1 - pipe.r + 3, pipe.y1, 5, pipe.y2 - pipe.y1)
      } else {
        g.fillRect(pipe.x1, pipe.y1 - pipe.r + 3, pipe.x2 - pipe.x1, 5)
      }
      // Joint rings
      const len = isVert ? pipe.y2 - pipe.y1 : pipe.x2 - pipe.x1
      const joints = Math.floor(len / 100)
      for (let ji = 0; ji <= joints; ji++) {
        const t = ji / Math.max(1, joints)
        const jx = pipe.x1 + (pipe.x2 - pipe.x1) * t
        const jy = pipe.y1 + (pipe.y2 - pipe.y1) * t
        g.fillStyle(0x5a6a7a, 0.6)
        if (isVert) {
          g.fillRect(jx - pipe.r - 3, jy - 3, pipe.r * 2 + 6, 7)
        } else {
          g.fillRect(jx - 3, jy - pipe.r - 3, 7, pipe.r * 2 + 6)
        }
      }
      // Pipe endpoint indicator lights — small colored dot sprites (no glow)
      const indicatorColor = rand() > 0.5 ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_RED
      const endOffset = isVert ? { dx: pipe.r + 4, dy: 0 } : { dx: 0, dy: pipe.r + 4 }
      const startLight = this.scene.add.sprite(
        pipe.x1 + endOffset.dx, pipe.y1 + endOffset.dy,
        SPRITESHEET_KEYS.GAME_ICONS, indicatorColor,
      ).setScale(0.14).setAlpha(0.35).setDepth(-10)
      this.terrainDecos.push(startLight)
      const endLight = this.scene.add.sprite(
        pipe.x2 + endOffset.dx, pipe.y2 + endOffset.dy,
        SPRITESHEET_KEYS.GAME_ICONS, indicatorColor,
      ).setScale(0.14).setAlpha(0.35).setDepth(-10)
      this.terrainDecos.push(endLight)
    }

    // Short building pipe stubs — utility connections (1-2 per building)
    for (const rect of buildingRects) {
      for (let side = 0; side < 4; side++) {
        if (rand() > 0.2) continue
        const stubLen = 30 + rand() * 40
        const stubR = 6 + rand() * 4
        let sx1: number, sy1: number, sx2: number, sy2: number
        if (side === 0) { // top
          sx1 = sx2 = rect.x + rect.w * (0.2 + rand() * 0.6)
          sy1 = rect.y - stubLen; sy2 = rect.y
        } else if (side === 1) { // right
          sy1 = sy2 = rect.y + rect.h * (0.2 + rand() * 0.6)
          sx1 = rect.x + rect.w; sx2 = sx1 + stubLen
        } else if (side === 2) { // bottom
          sx1 = sx2 = rect.x + rect.w * (0.2 + rand() * 0.6)
          sy1 = rect.y + rect.h; sy2 = sy1 + stubLen
        } else { // left
          sy1 = sy2 = rect.y + rect.h * (0.2 + rand() * 0.6)
          sx2 = rect.x; sx1 = sx2 - stubLen
        }
        g.fillStyle(0x4a5568, 0.6)
        if (sx1 === sx2) {
          g.fillRect(sx1 - stubR, Math.min(sy1, sy2), stubR * 2, Math.abs(sy2 - sy1))
        } else {
          g.fillRect(Math.min(sx1, sx2), sy1 - stubR, Math.abs(sx2 - sx1), stubR * 2)
        }
        g.fillStyle(0x5a6a7a, 0.45)
        if (sx1 === sx2) {
          g.fillRect(sx1 - stubR - 2, Math.min(sy1, sy2) - 2, stubR * 2 + 4, 5)
        } else {
          g.fillRect(Math.min(sx1, sx2) - 2, sy1 - stubR - 2, 5, stubR * 2 + 4)
        }
      }
    }

    // ── 4. Floor wear — sparse, varied marks for organic texture ──
    // Rust patches — irregular shapes near plate edges
    for (let i = 0; i < 8; i++) {
      const rx = x0 + rand() * w
      const ry = y0 + rand() * h
      if (isOverlapping(rx, ry, 10)) continue
      const rw = 10 + rand() * 25, rh = 6 + rand() * 15
      const angle = rand() * 60 - 30
      g.save()
      g.fillStyle(0x8a4a1a, 0.04 + rand() * 0.03)
      // Irregular shape: overlapping offset ellipses
      g.fillEllipse(rx, ry, rw, rh)
      if (rand() > 0.5) g.fillEllipse(rx + rw * 0.3, ry - rh * 0.2, rw * 0.6, rh * 0.7)
      g.restore()
    }

    // Oil stains — fewer, elongated drip shapes
    for (let i = 0; i < 6; i++) {
      const ox = x0 + rand() * w
      const oy = y0 + rand() * h
      if (isOverlapping(ox, oy, 8)) continue
      const ow = 8 + rand() * 14, oh = ow * (0.3 + rand() * 0.4)
      g.fillStyle(0x0a0a1a, 0.06 + rand() * 0.04)
      g.fillEllipse(ox, oy, ow, oh)
      // Drip tail
      if (rand() > 0.4) {
        g.fillStyle(0x0a0a1a, 0.03)
        g.fillEllipse(ox + ow * 0.4, oy + oh * 0.8, ow * 0.3, oh * 1.5)
      }
    }

    // Scratch marks — varying thickness and direction
    for (let i = 0; i < 8; i++) {
      const sx = x0 + rand() * w
      const sy = y0 + rand() * h
      const sLen = 10 + rand() * 25
      const angle = rand() * Math.PI
      const thick = 0.5 + rand() * 1
      g.lineStyle(thick, 0x3a4a5a, 0.06 + rand() * 0.08)
      g.lineBetween(sx, sy, sx + Math.cos(angle) * sLen, sy + Math.sin(angle) * sLen)
    }

    // ── 5. Manhole covers — subtle circular floor hatches ──
    for (let i = 0; i < 8; i++) {
      const mx = WORLD_MARGIN + 60 + rand() * (worldW - WORLD_MARGIN * 2 - 120)
      const my = WORLD_MARGIN + 60 + rand() * (worldH - WORLD_MARGIN * 2 - 120)
      if (isOverlapping(mx, my, 12)) continue
      const mr = 16 + rand() * 6
      g.fillStyle(0x2a3040, 0.5)
      g.fillCircle(mx, my, mr + 4)
      g.fillStyle(0x222a38, 0.55)
      g.fillCircle(mx, my, mr)
      g.lineStyle(2, 0x3a4a5a, 0.2)
      g.lineBetween(mx - mr + 5, my, mx + mr - 5, my)
      g.lineBetween(mx, my - mr + 5, mx, my + mr - 5)
      g.lineStyle(1, 0x3a4a5a, 0.15)
      g.strokeCircle(mx, my, mr * 0.6)
    }

    // ── 6. Caution tape near buildings ──
    for (const rect of buildingRects) {
      if (rand() > 0.25) continue
      const sy = rect.y + rect.h
      const sx = rect.x + 14
      const sw = rect.w - 28
      for (let stripe = 0; stripe < sw; stripe += 56) {
        g.fillStyle(0xd4a017, 0.12)
        g.fillRect(sx + stripe, sy + 3, 30, 10)
        g.fillStyle(0x1a1e2a, 0.14)
        g.fillRect(sx + stripe + 30, sy + 3, 26, 10)
      }
    }

    // ── 7. Floor vent grates — small structural detail, no glow ──
    for (let i = 0; i < 4; i++) {
      const gx = x0 + 100 + rand() * (w - 200)
      const gy = y0 + 100 + rand() * (h - 200)
      if (isOverlapping(gx, gy, 15)) continue
      // Vent grating only — no glow
      g.fillStyle(0x2a3040, 0.3)
      g.fillRoundedRect(gx - 12, gy - 7, 24, 14, 2)
      g.lineStyle(2, 0x1a2030, 0.3)
      g.lineBetween(gx - 4, gy - 4, gx - 4, gy + 4)
      g.lineBetween(gx, gy - 4, gx, gy + 4)
      g.lineBetween(gx + 4, gy - 4, gx + 4, gy + 4)
    }

    // ── 8. Terrain prop sprites — wrench/first-aid near pipe joints ──
    this.placeTerrainProps(pipePositions)

    // ── 9. Campus streets — paved roads with lane markings ──
    // Horizontal main road below the building area
    const streetY = worldH + 40
    const STREET_W = 64
    if (streetY < y0 + h - 60) {
      // Road surface
      g.fillStyle(0x222a36, 0.85)
      g.fillRect(x0, streetY - STREET_W / 2, w, STREET_W)
      // Road edges — lighter curb lines
      g.fillStyle(0x3a4a5a, 0.7)
      g.fillRect(x0, streetY - STREET_W / 2, w, 2)
      g.fillRect(x0, streetY + STREET_W / 2 - 2, w, 2)
      // Center dashed lane markings
      g.lineStyle(1.5, 0xd4a017, 0.4)
      for (let dx = x0; dx < x0 + w; dx += 48) {
        g.lineBetween(dx, streetY, dx + 16, streetY)
      }
      // Crosswalk stripes at intervals
      const crosswalkPositions = [WORLD_MARGIN + 80, worldW - WORLD_MARGIN - 80]
      for (const cx of crosswalkPositions) {
        if (cx < x0 || cx > x0 + w) continue
        for (let stripe = -STREET_W / 2 + 4; stripe < STREET_W / 2 - 4; stripe += 10) {
          g.fillStyle(0x8a96a4, 0.2)
          g.fillRect(cx - 20, streetY + stripe, 40, 4)
        }
      }
    }

    // Vertical connector road on the right side
    const vStreetX = worldW + 60
    if (vStreetX < x0 + w - 60) {
      g.fillStyle(0x222a36, 0.85)
      g.fillRect(vStreetX - STREET_W / 2, y0, STREET_W, h)
      g.fillStyle(0x3a4a5a, 0.7)
      g.fillRect(vStreetX - STREET_W / 2, y0, 2, h)
      g.fillRect(vStreetX + STREET_W / 2 - 2, y0, 2, h)
      g.lineStyle(1.5, 0xd4a017, 0.4)
      for (let dy = y0; dy < y0 + h; dy += 48) {
        g.lineBetween(vStreetX, dy, vStreetX, dy + 16)
      }
    }

    // ── 10. Sidewalks — lighter walkway strips alongside streets ──
    const SIDEWALK_W = 24
    // Sidewalk above horizontal street
    if (streetY < y0 + h - 60) {
      g.fillStyle(0x2a3444, 0.65)
      g.fillRect(x0, streetY - STREET_W / 2 - SIDEWALK_W, w, SIDEWALK_W)
      // Sidewalk tile lines
      g.lineStyle(0.5, 0x3a4a5a, 0.2)
      for (let sx = x0; sx < x0 + w; sx += 44) {
        g.lineBetween(sx, streetY - STREET_W / 2 - SIDEWALK_W, sx, streetY - STREET_W / 2)
      }
      // Below street
      g.fillStyle(0x2a3444, 0.65)
      g.fillRect(x0, streetY + STREET_W / 2, w, SIDEWALK_W)
      g.lineStyle(0.5, 0x3a4a5a, 0.2)
      for (let sx = x0; sx < x0 + w; sx += 44) {
        g.lineBetween(sx, streetY + STREET_W / 2, sx, streetY + STREET_W / 2 + SIDEWALK_W)
      }
    }

    // ── 11. Street lamps — mako-powered lamp posts ──
    const lampSpacing = 200
    if (streetY < y0 + h - 60) {
      for (let lx = WORLD_MARGIN; lx < worldW; lx += lampSpacing) {
        if (isOverlapping(lx, streetY - STREET_W / 2 - 20, 10)) continue
        const lampY = streetY - STREET_W / 2 - SIDEWALK_W - 6
        // Lamp post
        g.fillStyle(0x4a5a6a, 0.7)
        g.fillRect(lx - 2.5, lampY - 36, 5, 36)
        // Lamp arm
        g.fillStyle(0x4a5a6a, 0.6)
        g.fillRect(lx - 1, lampY - 38, 16, 2)
        // Lamp housing
        g.fillStyle(activeTheme.wallInner, 0.6)
        g.fillRect(lx + 7, lampY - 41, 14, 6)
        // Lamp bulb sprite — no ground glow, no ADD blend
        const bulb = this.scene.add.sprite(lx + 14, lampY - 38, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.14).setAlpha(0.25).setTint(0xd4a017).setDepth(-9)
        this.terrainDecos.push(bulb)
      }
    }

    // ── 12. Campus structures — small background buildings ──

    // Power substation — lower-left area
    const subX = x0 + 80
    const subY = worldH + STREET_W + 80
    if (!isOverlapping(subX, subY, 40) && subY < y0 + h - 40) {
      const sbW = 120, sbH = 80
      // Building base
      g.fillStyle(0x1e2836, 0.85)
      g.fillRect(subX - sbW / 2, subY - sbH / 2, sbW, sbH)
      g.lineStyle(1, 0x3a4a5a, 0.65)
      g.strokeRect(subX - sbW / 2, subY - sbH / 2, sbW, sbH)
      // Roof stripe
      g.fillStyle(0x2a3848, 0.8)
      g.fillRect(subX - sbW / 2, subY - sbH / 2, sbW, 6)
      // Warning stripes on front
      for (let si = 0; si < 3; si++) {
        g.fillStyle(0xd4a017, 0.15)
        g.fillRect(subX - sbW / 2 + 4 + si * 20, subY + sbH / 2 - 8, 10, 6)
        g.fillStyle(activeTheme.bg, 0.15)
        g.fillRect(subX - sbW / 2 + 14 + si * 20, subY + sbH / 2 - 8, 6, 6)
      }
      // Power indicator lights
      const pwrLight = this.scene.add.sprite(subX + sbW / 2 - 8, subY - sbH / 2 + 10, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.18).setAlpha(0.75).setDepth(-9)
      this.terrainDecos.push(pwrLight)
      // Label
      const subLabel = this.scene.add.text(subX, subY - sbH / 2 + 3, 'PWR-SUB 7G', {
        fontSize: '4px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setDepth(-9).setAlpha(0.75)
      this.terrainDecos.push(subLabel)
    }

    // Guard booth — near entrance
    const guardX = WORLD_MARGIN - 30
    const guardY = worldH / 2
    if (!isOverlapping(guardX, guardY, 20) && guardX > x0 + 20) {
      const gbW = 48, gbH = 40
      g.fillStyle(0x1e2836, 0.85)
      g.fillRect(guardX - gbW / 2, guardY - gbH / 2, gbW, gbH)
      g.lineStyle(1, 0x3a4a5a, 0.65)
      g.strokeRect(guardX - gbW / 2, guardY - gbH / 2, gbW, gbH)
      // Window
      g.fillStyle(0x0ea5e9, 0.12)
      g.fillRect(guardX - 5, guardY - gbH / 2 + 4, 10, 6)
      // Barrier arm
      g.fillStyle(0xd4a017, 0.45)
      g.fillRect(guardX + gbW / 2, guardY - 1, 50, 2)
      g.fillStyle(0xd4a017, 0.25)
      g.fillRect(guardX + gbW / 2, guardY - 1, 50, 2)
      // Checkpoint light
      const checkLight = this.scene.add.sprite(guardX, guardY - gbH / 2 - 4, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
        .setScale(0.16).setAlpha(0.75).setDepth(-9)
      this.terrainDecos.push(checkLight)
    }

    // Storage shed cluster — upper-right
    const shedX = worldW + 30
    const shedY = WORLD_MARGIN + 40
    if (!isOverlapping(shedX, shedY, 30) && shedX < x0 + w - 30) {
      for (let si = 0; si < 2; si++) {
        const sx = shedX + si * 50
        const sy = shedY + (si % 2) * 20
        const shW = 72, shH = 48
        g.fillStyle(activeTheme.ventFill, 0.85)
        g.fillRect(sx - shW / 2, sy - shH / 2, shW, shH)
        g.lineStyle(1, 0x2a3a4a, 0.4)
        g.strokeRect(sx - shW / 2, sy - shH / 2, shW, shH)
        // Corrugated roof lines
        g.lineStyle(0.5, 0x3a4a5a, 0.2)
        for (let rl = 0; rl < shW; rl += 5) {
          g.lineBetween(sx - shW / 2 + rl, sy - shH / 2, sx - shW / 2 + rl, sy - shH / 2 + 4)
        }
      }
    }

    // ── 13. Mako trees — reactor-mutated foliage (reduced count, smaller canopy) ──
    const treePositions: { x: number; y: number }[] = []
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = x0 + 60 + rand() * (w - 120)
      const ty = y0 + 60 + rand() * (h - 120)
      if (isOverlapping(tx, ty, 12)) continue
      if (streetY < y0 + h - 60 && Math.abs(ty - streetY) < STREET_W + SIDEWALK_W + 10) continue
      if (vStreetX < x0 + w - 60 && Math.abs(tx - vStreetX) < STREET_W + SIDEWALK_W + 10) continue
      treePositions.push({ x: tx, y: ty })
      if (treePositions.length >= 10) break
    }
    for (const tree of treePositions) {
      g.fillStyle(0x3a2a1a, 0.4)
      g.fillRect(tree.x - 3, tree.y - 3, 6, 16)
      g.fillStyle(0x000000, 0.06)
      g.fillEllipse(tree.x, tree.y + 8, 12, 5)
      const canopyColor = rand() > 0.3 ? 0x2a6a4a : 0x2a5a5a
      g.fillStyle(canopyColor, 0.12)
      g.fillCircle(tree.x, tree.y - 6, 14 + rand() * 4)
      g.fillStyle(canopyColor, 0.08)
      g.fillCircle(tree.x - 3, tree.y - 5, 10 + rand() * 3)
    }

    // ── 14. Benches and rest areas — along sidewalks ──
    if (streetY < y0 + h - 60) {
      const benchCount = Math.min(10, Math.floor(worldW / 200))
      for (let bi = 0; bi < benchCount; bi++) {
        const bx_ = WORLD_MARGIN + 60 + bi * (worldW / benchCount)
        const by_ = streetY - STREET_W / 2 - SIDEWALK_W + 2
        if (isOverlapping(bx_, by_, 6)) continue
        // Bench seat
        g.fillStyle(0x4a3a2a, 0.45)
        g.fillRect(bx_ - 18, by_ - 2, 36, 5)
        // Bench legs
        g.fillStyle(0x3a4a5a, 0.4)
        g.fillRect(bx_ - 15, by_ + 3, 2, 4)
        g.fillRect(bx_ + 13, by_ + 3, 2, 4)
        // Bench backrest
        g.fillStyle(0x4a3a2a, 0.35)
        g.fillRect(bx_ - 18, by_ - 6, 36, 3)
      }
    }

    // ── 15. Sector signage — numbered sector signs ──
    const sectorNames = ['SECTOR 7-G', 'SECTOR 8-A', 'MAKO DIST.', 'TECH CORE']
    let sectorIdx = 0
    // Place signs near building rects
    for (const rect of buildingRects) {
      if (sectorIdx >= sectorNames.length) break
      if (rand() > 0.6) continue
      const signX = rect.x - 20
      const signY = rect.y + rect.h / 2
      if (signX < x0 + 10) continue
      // Sign post
      g.fillStyle(0x4a5a6a, 0.4)
      g.fillRect(signX - 1, signY - 26, 2, 26)
      // Sign board
      g.fillStyle(activeTheme.bg, 0.85)
      g.fillRoundedRect(signX - 30, signY - 42, 60, 16, 2)
      g.lineStyle(1, MAKO_CYAN, 0.2)
      g.strokeRoundedRect(signX - 30, signY - 42, 60, 16, 2)
      const signText = this.scene.add.text(signX, signY - 34, sectorNames[sectorIdx], {
        fontSize: '5px', fontFamily: 'monospace', color: activeTheme.accentText, resolution: 2,
      }).setOrigin(0.5).setAlpha(0.75).setDepth(-9)
      this.terrainDecos.push(signText)
      sectorIdx++
    }

    // ── 16. Landing pad — helipad/airship zone ──
    const padCX = worldW + 80
    const padCY = worldH + STREET_W + 60
    if (!isOverlapping(padCX, padCY, 50) && padCX < x0 + w - 50 && padCY < y0 + h - 50) {
      const padR = 70
      // Pad surface
      g.fillStyle(0x1a2030, 0.8)
      g.fillCircle(padCX, padCY, padR)
      g.lineStyle(2, 0x3a4a5a, 0.4)
      g.strokeCircle(padCX, padCY, padR)
      // Inner circle
      g.lineStyle(1.5, MAKO_CYAN, 0.2)
      g.strokeCircle(padCX, padCY, padR - 10)
      // H marking
      g.fillStyle(0x8a96a4, 0.25)
      g.fillRect(padCX - 17.5, padCY - 14, 7, 28) // left stroke
      g.fillRect(padCX + 10.5, padCY - 14, 7, 28)  // right stroke
      g.fillRect(padCX - 10.5, padCY - 2, 21, 5.25)  // cross bar
      // Corner lights
      const padAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
      for (const pa of padAngles) {
        const plx = padCX + Math.cos(pa) * (padR - 4)
        const ply = padCY + Math.sin(pa) * (padR - 4)
        const padLight = this.scene.add.sprite(plx, ply, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
          .setScale(0.12).setAlpha(0.3).setTint(0x5a8aaa).setDepth(-9)
        this.terrainDecos.push(padLight)
      }
      // Pad label
      const padLabel = this.scene.add.text(padCX, padCY + padR + 8, 'PAD-01', {
        fontSize: '5px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5).setAlpha(0.68).setDepth(-9)
      this.terrainDecos.push(padLabel)
    }

    // ── 17. Cable conduits — overhead utility runs between buildings ──
    for (const rect of buildingRects) {
      if (rand() > 0.5) continue
      // Cable from building right edge outward
      const cableStartX = rect.x + rect.w
      const cableEndX = cableStartX + 100 + rand() * 130
      const cableY = rect.y + rand() * rect.h * 0.5
      if (cableEndX > x0 + w - 20) continue
      // Cable line
      g.lineStyle(1, 0x4a5a6a, 0.2)
      g.lineBetween(cableStartX, cableY, cableEndX, cableY)
      // Sag curve — drawn as a few segment lines
      const sagDepth = 6 + rand() * 4.5
      const segments = 6
      const cableLen = cableEndX - cableStartX
      for (let si = 0; si < segments; si++) {
        const t1 = si / segments
        const t2 = (si + 1) / segments
        const sag1 = Math.sin(t1 * Math.PI) * sagDepth
        const sag2 = Math.sin(t2 * Math.PI) * sagDepth
        g.lineStyle(0.8, 0x3a4a5a, 0.15)
        g.lineBetween(
          cableStartX + t1 * cableLen, cableY + sag1,
          cableStartX + t2 * cableLen, cableY + sag2,
        )
      }
      // Support bracket at start
      g.fillStyle(0x4a5a6a, 0.3)
      g.fillRect(cableStartX - 2, cableY - 3, 4, 6)
    }

    // ── 18. Storm drains and grating strips along streets ──
    if (streetY < y0 + h - 60) {
      for (let dx = WORLD_MARGIN; dx < worldW; dx += 60 + rand() * 40) {
        const drainX = dx
        const drainY = streetY + STREET_W / 2 + 2
        g.fillStyle(activeTheme.bg, 0.4)
        g.fillRect(drainX - 14, drainY, 28, 6)
        // Grate lines
        g.lineStyle(0.5, activeTheme.wall, 0.3)
        for (let gl = -10; gl <= 10; gl += 5) {
          g.lineBetween(drainX + gl, drainY, drainX + gl, drainY + 6)
        }
      }
    }

    // Helper: place a terrain prop image if loaded
    const placeTerrainProp = (px: number, py: number, key: string, scale: number, alpha: number, tint?: number): void => {
      if (!this.scene.textures.exists(key)) return
      const prop = this.scene.add.image(px, py, key)
        .setScale(scale).setAlpha(alpha).setDepth(-9.5)
      if (tint !== undefined) prop.setTint(tint)
      this.terrainDecos.push(prop)
    }

    // ── 19. Zone-based city grid — structured industrial layout ──
    // Divide terrain into zones and render deterministic structures per zone type.
    const ZONE_SIZE = 200
    const zoneCols = Math.ceil(w / ZONE_SIZE)
    const zoneRows = Math.ceil(h / ZONE_SIZE)

    // Deterministic zone type assignment based on grid position
    const zoneTypes = ['industrial', 'storage', 'utility', 'green', 'parking', 'open'] as const
    type ZoneType = typeof zoneTypes[number]
    const getZoneType = (col: number, row: number): ZoneType => {
      const zx = x0 + col * ZONE_SIZE + ZONE_SIZE / 2
      const zy = y0 + row * ZONE_SIZE + ZONE_SIZE / 2
      // Zones overlapping buildings → empty (skip)
      if (isOverlapping(zx, zy, ZONE_SIZE / 2 - 50)) return 'open'
      // Deterministic hash → zone type
      const hash = ((col * 7 + row * 13 + 37) * 2654435761) >>> 0
      return zoneTypes[hash % zoneTypes.length]
    }

    for (let col = 0; col < zoneCols; col++) {
      for (let row = 0; row < zoneRows; row++) {
        const zType = getZoneType(col, row)
        if (zType === 'open') continue

        const zx = x0 + col * ZONE_SIZE
        const zy = y0 + row * ZONE_SIZE
        const cx = zx + ZONE_SIZE / 2
        const cy = zy + ZONE_SIZE / 2

        if (zType === 'industrial') {
          // Industrial building — steel structure with ventilation
          const bw = 120 + (col % 3) * 20, bh = 70 + (row % 2) * 15
          const bx_ = cx - bw / 2, by_ = cy - bh / 2
          g.fillStyle(0x000000, 0.12)
          g.fillRect(bx_ + 5, by_ + 5, bw, bh)
          g.fillStyle(0x242e3e, 0.92)
          g.fillRect(bx_, by_, bw, bh)
          g.lineStyle(1.5, 0x3a4a5a, 0.7)
          g.strokeRect(bx_, by_, bw, bh)
          g.fillStyle(0x354560, 0.8)
          g.fillRect(bx_, by_, bw, 6)
          // Ventilation units
          for (let vi = 0; vi < 3; vi++) {
            g.fillStyle(0x3a4a5a, 0.5)
            g.fillRect(bx_ + 15 + vi * 35, by_ + 10, 14, 8)
          }
          // AC unit boxes on roof
          for (const acOff of [bx_ + bw - 50, bx_ + bw - 25]) {
            g.fillStyle(0x1a2530, 0.6)
            g.fillRect(acOff, by_ + 8, 16, 10)
            g.lineStyle(0.5, 0x3a4a5a, 0.35)
            g.strokeRect(acOff, by_ + 8, 16, 10)
            // Fan circle inside
            g.lineStyle(0.5, 0x4a5a6a, 0.4)
            g.strokeCircle(acOff + 8, by_ + 13, 3)
          }
          // Antenna stubs on roof edge
          g.lineStyle(0.8, 0x4a5a6a, 0.35)
          g.lineBetween(bx_ + 8, by_, bx_ + 8, by_ - 10)
          g.lineBetween(bx_ + 18, by_, bx_ + 18, by_ - 8)
          g.lineBetween(bx_ + 26, by_, bx_ + 26, by_ - 12)
          // Loading bay door markings on front face
          for (let di = 0; di < 2; di++) {
            const dx = bx_ + 20 + di * 50
            const dy = by_ + bh - 18
            g.fillStyle(0x0e1620, 0.5)
            g.fillRect(dx, dy, 28, 16)
            g.lineStyle(0.6, 0x2a3a4a, 0.4)
            g.strokeRect(dx, dy, 28, 16)
          }
          // Exhaust pipe on right side
          g.fillStyle(0x2a3444, 0.5)
          g.fillRect(bx_ + bw - 8, by_ - 14, 5, 16)
          g.lineStyle(0.5, 0x3a4a5a, 0.3)
          g.strokeRect(bx_ + bw - 8, by_ - 14, 5, 16)
          // Status light
          const lightFrame = (col + row) % 2 === 0 ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_RED
          const light = this.scene.add.sprite(bx_ + bw - 12, by_ + bh - 10, SPRITESHEET_KEYS.GAME_ICONS, lightFrame)
            .setScale(0.14).setAlpha(0.55).setDepth(-9)
          this.terrainDecos.push(light)
          // Label
          const label = this.scene.add.text(cx, by_ + 2, `BLD-${col}${row}`, {
            fontSize: '4px', fontFamily: 'monospace', color: '#4a5a6a', resolution: 2,
          }).setOrigin(0.5, 0).setDepth(-9).setAlpha(0.6)
          this.terrainDecos.push(label)
          // Prop: stone blocks near building
          placeTerrainProp(bx_ - 14, by_ + bh * 0.4, IMAGE_KEYS.TERRAIN_STONE, 0.22, 0.35, 0x4a5a6a)
          if ((col + row) % 3 === 0) placeTerrainProp(bx_ + bw + 10, by_ + bh * 0.7, IMAGE_KEYS.TERRAIN_DIRT, 0.2, 0.3, 0x4a5a6a)

        } else if (zType === 'storage') {
          // Loading dock platform — wide dark slab behind containers
          g.fillStyle(0x2a3444, 0.65)
          g.fillRect(cx - 55, cy + 14, 110, 10)
          // Yellow dock edge marking
          g.lineStyle(1.5, 0xd4a017, 0.45)
          g.lineBetween(cx - 55, cy + 14, cx + 55, cy + 14)

          // Cargo containers — orderly row of 3
          const containerColors = [0x3a6a5a, 0x6a3a3a, 0x3a3a6a]
          const cw = 40, ch = 16
          for (let ci = 0; ci < 3; ci++) {
            const ccx = cx - 65 + ci * 45
            const ccy = cy - ch / 2
            const cColor = containerColors[ci % containerColors.length]
            g.fillStyle(cColor, 0.7)
            g.fillRect(ccx, ccy, cw, ch)
            g.lineStyle(1, 0x5a6a7a, 0.5)
            g.strokeRect(ccx, ccy, cw, ch)
            // Corrugation
            g.lineStyle(0.5, 0x5a6a7a, 0.2)
            for (let ri = 4; ri < cw; ri += 6) {
              g.lineBetween(ccx + ri, ccy + 1, ccx + ri, ccy + ch - 1)
            }
          }

          // Pallet markings on the ground near containers
          g.lineStyle(0.5, 0x3a4a5a, 0.25)
          g.strokeRect(cx - 60, cy + 10, 16, 10)
          g.strokeRect(cx - 10, cy + 12, 16, 10)
          g.strokeRect(cx + 35, cy + 9, 16, 10)

          // Forklift silhouette — simple geometric shape
          const fkx = cx + 58, fky = cy - 2
          // Body
          g.fillStyle(0x3a4a5a, 0.3)
          g.fillRect(fkx, fky, 12, 8)
          // Wheels
          g.fillStyle(activeTheme.wall, 0.35)
          g.fillCircle(fkx + 2, fky + 10, 2)
          g.fillCircle(fkx + 10, fky + 10, 2)
          // Fork prongs extending forward
          g.fillStyle(0x4a5a6a, 0.25)
          g.fillRect(fkx - 8, fky + 5, 8, 1.5)
          g.fillRect(fkx - 8, fky + 7, 8, 1.5)

          // Zone label
          const sLabel = this.scene.add.text(cx, cy + 26, 'STORAGE', {
            fontSize: '4px', fontFamily: 'monospace', color: '#3a4a5a', resolution: 2,
          }).setOrigin(0.5).setDepth(-9).setAlpha(0.5)
          this.terrainDecos.push(sLabel)
          // Prop: crate sprites stacked near containers
          placeTerrainProp(cx - 75, cy + 4, IMAGE_KEYS.TERRAIN_CRATE, 0.28, 0.45)
          placeTerrainProp(cx + 72, cy - 6, IMAGE_KEYS.TERRAIN_CRATE, 0.24, 0.4)
          if ((col + row) % 2 === 0) placeTerrainProp(cx + 68, cy + 10, IMAGE_KEYS.TERRAIN_CRATE_HAZARD, 0.22, 0.38)

        } else if (zType === 'utility') {
          // Transformer box + generator unit
          const tw = 28, th = 28
          g.fillStyle(0x354560, 0.8)
          g.fillRect(cx - tw / 2, cy - th / 2, tw, th)
          g.lineStyle(1.5, 0x5a6a7a, 0.55)
          g.strokeRect(cx - tw / 2, cy - th / 2, tw, th)
          // Warning diamond
          g.fillStyle(0xd4a017, 0.25)
          g.beginPath()
          g.moveTo(cx, cy - 5)
          g.lineTo(cx + 5, cy)
          g.lineTo(cx, cy + 5)
          g.lineTo(cx - 5, cy)
          g.closePath()
          g.fillPath()
          // Generator nearby
          const gx_ = cx + 30, gy_ = cy - 10
          g.fillStyle(0x283848, 0.85)
          g.fillRect(gx_, gy_, 44, 30)
          g.lineStyle(1.5, 0x4a5a6a, 0.6)
          g.strokeRect(gx_, gy_, 44, 30)
          // Vent slats
          for (let sl = 0; sl < 2; sl++) {
            g.fillStyle(activeTheme.bg, 0.35)
            g.fillRect(gx_ + 5, gy_ + 5 + sl * 10, 30, 3)
          }

          // ── Power line poles ──
          const pole1X = cx + 14, pole1Y = cy - 4
          const pole2X = gx_ + 10, pole2Y = gy_ - 2
          const poleW = 3, poleH = 20, crossW = 12
          // Pole 1 (near transformer)
          g.fillStyle(0x3a4a5a, 0.45)
          g.fillRect(pole1X - poleW / 2, pole1Y - poleH, poleW, poleH)
          g.fillRect(pole1X - crossW / 2, pole1Y - poleH + 3, crossW, 2)
          // Pole 2 (near generator)
          g.fillStyle(0x3a4a5a, 0.45)
          g.fillRect(pole2X - poleW / 2, pole2Y - poleH, poleW, poleH)
          g.fillRect(pole2X - crossW / 2, pole2Y - poleH + 3, crossW, 2)

          // ── Wire connecting poles (slight sag) ──
          const wireY1 = pole1Y - poleH + 4
          const wireY2 = pole2Y - poleH + 4
          const wireMidX = (pole1X + pole2X) / 2
          const wireMidY = (wireY1 + wireY2) / 2 + 4 // sag
          g.lineStyle(0.6, 0x5a6a7a, 0.3)
          g.lineBetween(pole1X, wireY1, wireMidX, wireMidY)
          g.lineBetween(wireMidX, wireMidY, pole2X, wireY2)

          // ── Insulator dots on crossarms ──
          for (const ix of [pole1X - 4, pole1X + 4, pole2X - 4, pole2X + 4]) {
            const iy = ix <= pole1X + 4 ? pole1Y - poleH + 3 : pole2Y - poleH + 3
            const ins = this.scene.add.sprite(ix, iy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
              .setScale(0.08).setAlpha(0.5).setDepth(-9)
            this.terrainDecos.push(ins)
          }

          // ── Ground cable tray ──
          const trayY = cy + th / 2 + 2
          const trayX1 = cx
          const trayX2 = gx_ + 20
          const trayLen = trayX2 - trayX1
          g.fillStyle(0x2a3444, 0.35)
          g.fillRect(trayX1, trayY, trayLen, 4)
          // Tick marks along tray
          g.lineStyle(0.5, 0x4a5a6a, 0.3)
          for (let ti = 0; ti < 3; ti++) {
            const tx = trayX1 + 10 + ti * (trayLen - 20) / 2
            g.lineBetween(tx, trayY - 1, tx, trayY + 5)
          }

          // ── DANGER HIGH VOLTAGE sign ──
          g.fillStyle(0xd4a017, 0.3)
          g.fillRect(cx - tw / 2 - 2, cy + th / 2 + 8, 30, 8)
          g.lineStyle(0.5, 0x8a7a2a, 0.35)
          g.strokeRect(cx - tw / 2 - 2, cy + th / 2 + 8, 30, 8)
          const dangerLabel = this.scene.add.text(cx - tw / 2 + 13, cy + th / 2 + 12, 'DANGER HIGH VOLTAGE', {
            fontSize: '2.5px', fontFamily: 'monospace', color: '#8a6a1a', resolution: 2,
          }).setOrigin(0.5).setDepth(-9).setAlpha(0.4)
          this.terrainDecos.push(dangerLabel)
          // Prop: coin box (equipment locker) near transformer
          placeTerrainProp(cx - tw / 2 - 18, cy - 8, IMAGE_KEYS.TERRAIN_BOX_COIN, 0.22, 0.35, 0x5a6a7a)

        } else if (zType === 'green') {
          // Small park area — organic green space with trees, bushes, benches, path, flowers
          // Irregular ground: two overlapping ellipses
          g.fillStyle(0x1a3a1a, 0.18)
          g.fillEllipse(cx - 6, cy + 4, 108, 88)
          g.fillStyle(0x1a3a1a, 0.14)
          g.fillEllipse(cx + 8, cy - 5, 96, 100)
          // Walkway path cutting through
          g.fillStyle(0x3a4a4a, 0.2)
          g.fillRect(cx - 2, cy - 20, 4, 40)
          // Tree 1 (small, left)
          g.fillStyle(0x4a3a2a, 0.45)
          g.fillRect(cx - 28, cy + 2, 2, 10)
          g.fillStyle(0x3a8a5a, 0.22)
          g.fillCircle(cx - 27, cy - 4, 8)
          // Tree 2 (large, center-right)
          g.fillStyle(0x4a3a2a, 0.5)
          g.fillRect(cx + 16, cy - 6, 4, 18)
          g.fillStyle(0x3a7a4a, 0.24)
          g.fillCircle(cx + 18, cy - 16, 16)
          // Tree 3 (medium, far right)
          g.fillStyle(0x4a3a2a, 0.45)
          g.fillRect(cx + 36, cy + 4, 3, 14)
          g.fillStyle(0x2a6a4a, 0.2)
          g.fillCircle(cx + 37, cy - 4, 11)
          // Bushes/shrubs near trees
          g.fillStyle(0x1a3a2a, 0.18)
          g.fillCircle(cx - 20, cy + 8, 5)
          g.fillStyle(0x1a3a2a, 0.15)
          g.fillCircle(cx + 26, cy + 6, 6)
          g.fillStyle(0x1a3a2a, 0.16)
          g.fillCircle(cx + 42, cy + 12, 4)
          // Bench 1 (left side)
          g.fillStyle(0x4a3a2a, 0.35)
          g.fillRect(cx - 18, cy + 22, 28, 4)
          g.fillStyle(0x3a4a5a, 0.30)
          g.fillRect(cx - 16, cy + 26, 2, 3)
          g.fillRect(cx + 6, cy + 26, 2, 3)
          // Bench 2 (right side)
          g.fillStyle(0x4a3a2a, 0.30)
          g.fillRect(cx + 20, cy + 24, 24, 4)
          g.fillStyle(0x3a4a5a, 0.25)
          g.fillRect(cx + 22, cy + 28, 2, 3)
          g.fillRect(cx + 40, cy + 28, 2, 3)
          // Flower dots scattered on the ground
          g.fillStyle(0xd4a017, 0.20)
          g.fillCircle(cx - 10, cy + 14, 1.5)
          g.fillStyle(0xfda4af, 0.18)
          g.fillCircle(cx + 8, cy + 10, 1.5)
          g.fillStyle(0xd4a017, 0.16)
          g.fillCircle(cx + 30, cy + 18, 2)
          // Prop: decorative dirt/stone blocks at park edges
          placeTerrainProp(cx - 45, cy + 30, IMAGE_KEYS.TERRAIN_DIRT, 0.18, 0.25, 0x4a6a4a)
          placeTerrainProp(cx + 42, cy + 28, IMAGE_KEYS.TERRAIN_STONE, 0.16, 0.22, 0x5a6a5a)

        } else if (zType === 'parking') {
          // Parking lot with spot markings
          const pw = 150, ph = 90
          g.fillStyle(0x222a38, 0.85)
          g.fillRect(cx - pw / 2, cy - ph / 2, pw, ph)
          g.lineStyle(2, 0x4a5a6a, 0.6)
          g.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph)
          // Spot markings
          const spotW = 16, spotH = 7
          const spotsPerRow = Math.floor((pw - 30) / 20)
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < spotsPerRow; c++) {
              g.lineStyle(0.8, 0x5a6a7a, 0.45)
              g.strokeRect(cx - pw / 2 + 15 + c * 20, cy - ph / 2 + 18 + r * 28, spotW, spotH)
            }
          }
          // Vehicle silhouettes parked in spots
          const vehicleColors = [0x303a4a, 0x3a4050, 0x2a3542]
          const vehicleSpots = [
            { r: 0, c: 1 },
            { r: 0, c: 4 },
            { r: 1, c: 2 },
          ]
          for (let vi = 0; vi < vehicleSpots.length; vi++) {
            const vs = vehicleSpots[vi]
            const vx = cx - pw / 2 + 15 + vs.c * 20 + (spotW - 14) / 2
            const vy = cy - ph / 2 + 18 + vs.r * 28 + (spotH - 6) / 2
            g.fillStyle(vehicleColors[vi], 0.6)
            g.fillRoundedRect(vx, vy, 14, 6, 1)
          }
          // Dashed yellow center lane divider between the two rows
          const laneY = cy - ph / 2 + 18 + spotH + (28 - spotH) / 2
          const laneX1 = cx - pw / 2 + 10
          const laneX2 = cx + pw / 2 - 10
          for (let dx = laneX1; dx < laneX2; dx += 8) {
            const endX = Math.min(dx + 4, laneX2)
            g.lineStyle(0.6, 0xaaaa44, 0.25)
            g.lineBetween(dx, laneY, endX, laneY)
          }
          // Directional arrow in center aisle pointing right toward entrance
          const arrowCx = cx
          const arrowCy = laneY
          g.lineStyle(1, 0x4a5a6a, 0.35)
          g.lineBetween(arrowCx - 10, arrowCy, arrowCx + 6, arrowCy)
          g.lineBetween(arrowCx + 2, arrowCy - 3, arrowCx + 6, arrowCy)
          g.lineBetween(arrowCx + 2, arrowCy + 3, arrowCx + 6, arrowCy)
          // "P" label
          const pLabel = this.scene.add.text(cx, cy - ph / 2 + 6, 'P', {
            fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3a5a7a', resolution: 2,
          }).setOrigin(0.5).setAlpha(0.45).setDepth(-9)
          this.terrainDecos.push(pLabel)
          // "LOT" number label
          const lotLabel = this.scene.add.text(cx, cy - ph / 2 + 14, `LOT-${col}${row}`, {
            fontSize: '5px', fontFamily: 'monospace', color: '#3a4a5a', resolution: 2,
          }).setOrigin(0.5).setAlpha(0.3).setDepth(-9)
          this.terrainDecos.push(lotLabel)
        }
      }
    }

    // ── Zone connecting roads — sparse road segments between occupied zones ──
    // Only draw road segments between adjacent non-open zones
    for (let col = 0; col < zoneCols; col++) {
      for (let row = 0; row < zoneRows; row++) {
        const t1 = getZoneType(col, row)
        if (t1 === 'open') continue
        const cx1 = x0 + col * ZONE_SIZE + ZONE_SIZE / 2
        const cy1 = y0 + row * ZONE_SIZE + ZONE_SIZE / 2
        // Connect right
        if (col + 1 < zoneCols && getZoneType(col + 1, row) !== 'open') {
          const cx2 = cx1 + ZONE_SIZE
          g.lineStyle(1, 0x3a4a5a, 0.15 + rand() * 0.1)
          g.lineBetween(cx1, cy1, cx2, cy1)
        }
        // Connect down
        if (row + 1 < zoneRows && getZoneType(col, row + 1) !== 'open') {
          const cy2 = cy1 + ZONE_SIZE
          g.lineStyle(1, 0x3a4a5a, 0.15 + rand() * 0.1)
          g.lineBetween(cx1, cy1, cx1, cy2)
        }
      }
    }

    // ── 20. Perimeter wall — dashed border around campus ──
    const perimX1 = x0 + 20
    const perimY1 = y0 + 20
    const perimX2 = x0 + w - 20
    const perimY2 = y0 + h - 20
    const perimColor = 0x2a3a4a
    const perimDash = 12
    const perimGap = 8
    // Top edge
    for (let dx = perimX1; dx < perimX2; dx += perimDash + perimGap) {
      const endX = Math.min(dx + perimDash, perimX2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(dx, perimY1, endX, perimY1)
    }
    // Bottom edge
    for (let dx = perimX1; dx < perimX2; dx += perimDash + perimGap) {
      const endX = Math.min(dx + perimDash, perimX2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(dx, perimY2, endX, perimY2)
    }
    // Left edge
    for (let dy = perimY1; dy < perimY2; dy += perimDash + perimGap) {
      const endY = Math.min(dy + perimDash, perimY2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(perimX1, dy, perimX1, endY)
    }
    // Right edge
    for (let dy = perimY1; dy < perimY2; dy += perimDash + perimGap) {
      const endY = Math.min(dy + perimDash, perimY2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(perimX2, dy, perimX2, endY)
    }
    // Corner watchtower markers
    const cornerPositions = [
      { x: perimX1, y: perimY1 },
      { x: perimX2, y: perimY1 },
      { x: perimX1, y: perimY2 },
      { x: perimX2, y: perimY2 },
    ]
    for (const corner of cornerPositions) {
      g.fillStyle(0x2a3444, 0.7)
      g.fillRect(corner.x - 6, corner.y - 6, 12, 12)
      g.lineStyle(1, 0x3a4a5a, 0.6)
      g.strokeRect(corner.x - 6, corner.y - 6, 12, 12)
      const cornerLight = this.scene.add.sprite(corner.x, corner.y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
        .setScale(0.12).setAlpha(0.4).setDepth(-9)
      this.terrainDecos.push(cornerLight)
    }

    // ── Seasonal decorations ──
    this.placeSeasonalDecorations(worldW, worldH, buildingRects, isOverlapping, rand)
  }

  // ---------------------------------------------------------------------------
  // placeSeasonalDecorations — themed environmental props per season
  // ---------------------------------------------------------------------------

  private placeSeasonalDecorations(
    worldW: number,
    worldH: number,
    buildingRects: { x: number; y: number; w: number; h: number }[],
    isOverlapping: (x: number, y: number, r: number) => boolean,
    rand: () => number,
  ): void {
    const g = this.terrainGraphics
    if (!g) return
    const seasonal = this.getSeasonalConfig()
    const type = seasonal.extraDecorType

    if (type === 'winter') {
      // Snow drifts — white ellipses near buildings
      for (const rect of buildingRects) {
        if (rand() > 0.6) continue
        const sx = rect.x + rect.w * rand()
        const sy = rect.y + rect.h + 8 + rand() * 12
        g.fillStyle(0xdbeafe, 0.08)
        g.fillEllipse(sx, sy, 30 + rand() * 40, 8 + rand() * 6)
      }
      // Icicle accents on building edges
      for (const rect of buildingRects) {
        const icicleCount = 2 + Math.floor(rand() * 3)
        for (let ic = 0; ic < icicleCount; ic++) {
          const ix = rect.x + 10 + rand() * (rect.w - 20)
          const iy = rect.y - 2
          g.fillStyle(0x93c5fd, 0.12)
          g.fillTriangle(ix - 2, iy, ix + 2, iy, ix, iy - 6 - rand() * 4)
        }
      }
    } else if (type === 'spring') {
      // Cherry blossom petals scattered on the ground
      for (let i = 0; i < 20; i++) {
        const px = WORLD_MARGIN + rand() * (worldW - WORLD_MARGIN * 2)
        const py = WORLD_MARGIN + rand() * (worldH - WORLD_MARGIN * 2)
        if (isOverlapping(px, py, 4)) continue
        g.fillStyle(0xfda4af, 0.10 + rand() * 0.06)
        g.fillEllipse(px, py, 3 + rand() * 2, 2 + rand())
      }
      // Tiny flower patches
      for (let i = 0; i < 8; i++) {
        const fx = WORLD_MARGIN + rand() * (worldW - WORLD_MARGIN * 2)
        const fy = WORLD_MARGIN + rand() * (worldH - WORLD_MARGIN * 2)
        if (isOverlapping(fx, fy, 10)) continue
        const flowerColors = [0xfda4af, 0xfbbf24, 0xa78bfa, 0x86efac]
        for (let fi = 0; fi < 3 + Math.floor(rand() * 3); fi++) {
          const fo = (rand() - 0.5) * 12
          g.fillStyle(flowerColors[Math.floor(rand() * flowerColors.length)], 0.15)
          g.fillCircle(fx + fo, fy + (rand() - 0.5) * 8, 1.5 + rand())
        }
      }
    } else if (type === 'summer') {
      // Heat shimmer lines — wavy translucent streaks
      for (let i = 0; i < 6; i++) {
        const sx = WORLD_MARGIN + rand() * (worldW - WORLD_MARGIN * 2)
        const sy = WORLD_MARGIN + rand() * (worldH - WORLD_MARGIN * 2)
        if (isOverlapping(sx, sy, 20)) continue
        g.lineStyle(1, 0xfbbf24, 0.04)
        g.beginPath()
        g.moveTo(sx, sy)
        for (let s = 0; s < 6; s++) {
          g.lineTo(sx + s * 12, sy + Math.sin(s * 1.2) * 4)
        }
        g.strokePath()
      }
    } else {
      // Autumn — fallen leaf patches (amber/brown splotches)
      for (let i = 0; i < 15; i++) {
        const lx = WORLD_MARGIN + rand() * (worldW - WORLD_MARGIN * 2)
        const ly = WORLD_MARGIN + rand() * (worldH - WORLD_MARGIN * 2)
        if (isOverlapping(lx, ly, 6)) continue
        const leafColors = [0xd4a017, 0xb45309, 0xdc2626, 0xea580c]
        g.fillStyle(leafColors[Math.floor(rand() * leafColors.length)], 0.08 + rand() * 0.04)
        g.fillEllipse(lx, ly, 3 + rand() * 3, 2 + rand() * 2)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // placeTerrainProps — sprite-based props near pipe joints
  // ---------------------------------------------------------------------------

  private placeTerrainProps(
    pipes: { x1: number; y1: number; x2: number; y2: number; r: number }[],
  ): void {
    // Clean up old prop sprites
    for (const s of this.propSprites) s.destroy()
    this.propSprites = []

    if (!this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)) return

    const propFrames = [ITEM_FRAMES.WRENCH, ITEM_FRAMES.FIRST_AID]
    let placed = 0

    for (const pipe of pipes) {
      if (placed >= 4) break // max 4 prop sprites for performance
      if (Math.random() > 0.4) continue // 40% chance per pipe

      const midX = (pipe.x1 + pipe.x2) / 2
      const midY = (pipe.y1 + pipe.y2) / 2
      const isVert = pipe.x1 === pipe.x2
      // Offset the prop to the side of the pipe
      const offsetX = isVert ? (pipe.r + 8) * (Math.random() > 0.5 ? 1 : -1) : 0
      const offsetY = isVert ? 0 : (pipe.r + 8) * (Math.random() > 0.5 ? 1 : -1)

      const frame = propFrames[placed % propFrames.length]
      const prop = this.scene.add.sprite(midX + offsetX, midY + offsetY, SPRITESHEET_KEYS.GAME_ITEMS, frame)
        .setDepth(-3)
        .setScale(0.55)
        .setAlpha(0.4 + Math.random() * 0.15)
        .setAngle(Math.random() * 30 - 15)
        .setTint(0x8a96a4) // muted industrial tint

      this.propSprites.push(prop)
      this.terrainDecos.push(prop)
      placed++
    }
  }

  // ---------------------------------------------------------------------------
  // tickReactorPulse — ambient reactor flash VFX, call from update loop
  // ---------------------------------------------------------------------------

  tickReactorPulse(time: number): void {
    if (!this.reactorCenter) return
    if (time - this.lastReactorPulseAt < this.reactorPulseInterval) return
    this.lastReactorPulseAt = time
    this.reactorPulseInterval = 6000 + Math.random() * 8000

    const { x, y } = this.reactorCenter

    // Subtle flash VFX at reactor center
    if (this.scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      const flash = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.EFFECTS_FLASH)
        .setDepth(-9)
        .setScale(0.15 + Math.random() * 0.08)
        .setAlpha(0.05)
        .setTint(0x00ff88)
      flash.play(EFFECT_ANIM_KEYS.FLASH)
      flash.once('animationcomplete', () => flash.destroy())
    }
  }

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.terrainGraphics?.destroy()
    this.terrainGraphics = null
    for (const d of this.terrainDecos) { try { (d as { destroy(): void }).destroy() } catch { /* */ } }
    this.terrainDecos = []
    for (const s of this.propSprites) { try { s.destroy() } catch { /* */ } }
    this.propSprites = []
    this.reactorCenter = null
  }
}
