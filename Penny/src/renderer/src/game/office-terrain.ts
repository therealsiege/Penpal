import Phaser from 'phaser'
import type { Room } from './office-types'
import { WORLD_MARGIN } from './office-constants'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS, ITEM_FRAMES, ICON_FRAMES } from './office-asset-keys'

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

    // Steel plate grid lines
    const PLATE = 160
    g.lineStyle(1, 0x2a3040, 0.35)
    for (let gx = x0; gx < x0 + w; gx += PLATE) {
      g.lineBetween(gx, y0, gx, y0 + h)
    }
    for (let gy = y0; gy < y0 + h; gy += PLATE) {
      g.lineBetween(x0, gy, x0 + w, gy)
    }

    // Plate variation — some panels slightly lighter/darker
    for (let gx = x0; gx < x0 + w; gx += PLATE) {
      for (let gy = y0; gy < y0 + h; gy += PLATE) {
        const r = rand()
        if (r < 0.12) {
          g.fillStyle(0x242a38, 0.5)
          g.fillRect(gx + 1, gy + 1, PLATE - 2, PLATE - 2)
        } else if (r < 0.2) {
          g.fillStyle(0x141822, 0.4)
          g.fillRect(gx + 1, gy + 1, PLATE - 2, PLATE - 2)
        }
      }
    }

    // Bolts at plate corners — sprite circles for crisp rendering
    for (let gx = x0; gx < x0 + w; gx += PLATE) {
      for (let gy = y0; gy < y0 + h; gy += PLATE) {
        if (rand() > 0.4) continue
        const boltPositions = [
          [gx + 8, gy + 8],
          [gx + PLATE - 8, gy + 8],
          [gx + 8, gy + PLATE - 8],
          [gx + PLATE - 8, gy + PLATE - 8],
        ]
        for (const [bx, by] of boltPositions) {
          const bolt = this.scene.add.sprite(bx, by, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
            .setScale(0.16).setAlpha(0.45).setTint(0x3a4050).setDepth(-10)
          this.terrainDecos.push(bolt)
        }
      }
    }

    // Extra floor grime — subtle noise layer for visual density
    for (let gx = x0; gx < x0 + w; gx += PLATE / 2) {
      for (let gy = y0; gy < y0 + h; gy += PLATE / 2) {
        const r = rand()
        if (r < 0.08) {
          g.fillStyle(0x0a0e14, 0.15)
          g.fillCircle(gx + rand() * 40, gy + rand() * 40, 6 + rand() * 10)
        } else if (r < 0.15) {
          g.fillStyle(0x2a3444, 0.08)
          g.fillRect(gx + rand() * 60, gy + rand() * 60, 20 + rand() * 30, 2)
        }
      }
    }

    // ── 2. Mako energy seams — glowing green/cyan lines in the floor ──
    const MAKO_GREEN = 0x00ff88
    const MAKO_CYAN = 0x00e5ff

    // Horizontal mako seam
    const seamY = WORLD_MARGIN - 40
    g.lineStyle(8, MAKO_GREEN, 0.4)
    g.lineBetween(x0, seamY, x0 + w, seamY)
    // Glow around seam
    g.fillStyle(MAKO_GREEN, 0.02)
    g.fillRect(x0, seamY - 32, w, 64)
    g.fillStyle(MAKO_GREEN, 0.015)
    g.fillRect(x0, seamY - 64, w, 128)

    // Vertical mako seams
    const vertSeamX1 = WORLD_MARGIN + 60
    const vertSeamX2 = worldW - WORLD_MARGIN - 60
    if (worldH > 300) {
      for (const sx of [vertSeamX1, vertSeamX2]) {
        g.lineStyle(6, MAKO_CYAN, 0.3)
        g.lineBetween(sx, seamY, sx, worldH + PAD)
        g.fillStyle(MAKO_CYAN, 0.02)
        g.fillRect(sx - 32, seamY, 64, worldH + PAD - seamY)
        // Seam junction indicator — glowing cyan dot sprite at intersection
        const junctionDot = this.scene.add.sprite(sx, seamY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
          .setScale(0.22).setAlpha(0.2).setTint(MAKO_CYAN)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(-10)
        this.terrainDecos.push(junctionDot)
      }
    }

    // Mako pool / reactor vent — lower-right area
    const poolCX = worldW - WORLD_MARGIN - 180
    const poolCY = worldH - WORLD_MARGIN - 130
    const poolRX = 160 + rand() * 50
    const poolRY = 100 + rand() * 30
    if (!isOverlapping(poolCX, poolCY, Math.max(poolRX, poolRY) + 30)) {
      // Outer rim — dark metal
      g.fillStyle(0x2a3040, 0.5)
      g.fillEllipse(poolCX, poolCY, poolRX + 22, poolRY + 16)
      // Grating ring
      g.lineStyle(3, 0x3a4a5a, 0.4)
      g.strokeEllipse(poolCX, poolCY, poolRX + 12, poolRY + 8)
      // Mako pool
      g.fillStyle(MAKO_GREEN, 0.06)
      g.fillEllipse(poolCX, poolCY, poolRX, poolRY)
      // Brighter center
      g.fillStyle(MAKO_GREEN, 0.03)
      g.fillEllipse(poolCX, poolCY, poolRX * 0.6, poolRY * 0.6)
      g.fillStyle(0xaaffcc, 0.04)
      g.fillEllipse(poolCX, poolCY, poolRX * 0.3, poolRY * 0.3)
      // Ripple rings
      g.lineStyle(1, MAKO_GREEN, 0.12)
      g.strokeEllipse(poolCX - 18, poolCY - 8, 50, 28)
      g.strokeEllipse(poolCX + 22, poolCY + 6, 36, 22)
      // Warning stripes around pool
      const stripeCount = 20
      for (let si = 0; si < stripeCount; si++) {
        const angle = (si / stripeCount) * Math.PI * 2
        const sx1 = poolCX + Math.cos(angle) * (poolRX + 35)
        const sy1 = poolCY + Math.sin(angle) * (poolRY + 26)
        const sx2 = poolCX + Math.cos(angle) * (poolRX + 55)
        const sy2 = poolCY + Math.sin(angle) * (poolRY + 42)
        g.lineStyle(4, 0x00e5ff, 0.2)
        g.lineBetween(sx1, sy1, sx2, sy2)
      }
      // Warning indicator lights at cardinal points around the reactor
      const warningAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
      for (const wa of warningAngles) {
        const wx = poolCX + Math.cos(wa) * (poolRX + 44)
        const wy = poolCY + Math.sin(wa) * (poolRY + 34)
        const warningFrame = wa < Math.PI ? ICON_FRAMES.CIRCLE_RED : ICON_FRAMES.CIRCLE_YELLOW
        const warningLight = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.GAME_ICONS, warningFrame)
          .setScale(0.28).setAlpha(0.3).setDepth(-10)
          .setBlendMode(Phaser.BlendModes.ADD)
        this.terrainDecos.push(warningLight)
      }
      // Save reactor center for animated glow layer
      this.reactorCenter = { x: poolCX, y: poolCY, rx: poolRX, ry: poolRY }
    } else {
      this.reactorCenter = null
    }

    // ── 3. Pipes — horizontal and vertical runs ──
    const pipePositions: { x1: number; y1: number; x2: number; y2: number; r: number }[] = []
    for (let attempt = 0; attempt < 30; attempt++) {
      const isVert = rand() > 0.5
      const pr = 14 + rand() * 10
      let px1: number, py1: number, px2: number, py2: number
      if (isVert) {
        px1 = px2 = x0 + 80 + rand() * (w - 160)
        py1 = y0 + rand() * h * 0.3
        py2 = py1 + 250 + rand() * 500
      } else {
        py1 = py2 = y0 + 80 + rand() * (h - 160)
        px1 = x0 + rand() * w * 0.3
        px2 = px1 + 250 + rand() * 500
      }
      const midX = (px1 + px2) / 2, midY = (py1 + py2) / 2
      if (isOverlapping(midX, midY, 25)) continue
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
      // Pipe endpoint indicator lights — small colored dot sprites
      const indicatorColor = rand() > 0.5 ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_RED
      const endOffset = isVert ? { dx: pipe.r + 4, dy: 0 } : { dx: 0, dy: pipe.r + 4 }
      const startLight = this.scene.add.sprite(
        pipe.x1 + endOffset.dx, pipe.y1 + endOffset.dy,
        SPRITESHEET_KEYS.GAME_ICONS, indicatorColor,
      ).setScale(0.22).setAlpha(0.5).setDepth(-10)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(startLight)
      const endLight = this.scene.add.sprite(
        pipe.x2 + endOffset.dx, pipe.y2 + endOffset.dy,
        SPRITESHEET_KEYS.GAME_ICONS, indicatorColor,
      ).setScale(0.22).setAlpha(0.5).setDepth(-10)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(endLight)
    }

    // Short building pipe stubs — utility connections
    for (const rect of buildingRects) {
      for (let side = 0; side < 4; side++) {
        if (rand() > 0.4) continue
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

    // ── 4. Floor detail — rust patches, oil stains, scorch marks ──
    // Rust stains — orange-brown splotches
    for (let i = 0; i < 30; i++) {
      const rx = x0 + rand() * w
      const ry = y0 + rand() * h
      if (isOverlapping(rx, ry, 10)) continue
      const rr = 27 + rand() * 45
      g.fillStyle(0x8a4a1a, 0.1 + rand() * 0.06)
      g.fillEllipse(rx, ry, rr, rr * (0.6 + rand() * 0.4))
      // Darker center
      g.fillStyle(0x6a3a0a, 0.07)
      g.fillEllipse(rx + 2, ry + 2, rr * 0.5, rr * 0.4)
    }

    // Oil stains — dark iridescent puddles
    for (let i = 0; i < 24; i++) {
      const ox = x0 + rand() * w
      const oy = y0 + rand() * h
      if (isOverlapping(ox, oy, 8)) continue
      const or_ = 21.6 + rand() * 36
      g.fillStyle(0x0a0a1a, 0.18 + rand() * 0.08)
      g.fillEllipse(ox, oy, or_, or_ * (0.5 + rand() * 0.3))
      // Iridescent shimmer highlight
      g.fillStyle(0x4a3a6a, 0.04)
      g.fillEllipse(ox - 3, oy - 2, or_ * 0.6, or_ * 0.3)
    }

    // Scorch marks — dark radial burns
    for (let i = 0; i < 14; i++) {
      const sx = x0 + rand() * w
      const sy = y0 + rand() * h
      if (isOverlapping(sx, sy, 10)) continue
      const sr = 18 + rand() * 32.4
      g.fillStyle(0x0a0a0a, 0.14 + rand() * 0.06)
      g.fillCircle(sx, sy, sr)
      g.fillStyle(0x1a1a1a, 0.05)
      g.fillCircle(sx, sy, sr * 0.5)
    }

    // Scratch marks — thin diagonal lines on plates
    g.lineStyle(1, 0x3a4a5a, 0.12)
    for (let i = 0; i < 20; i++) {
      const sx = x0 + rand() * w
      const sy = y0 + rand() * h
      const sLen = 15 + rand() * 30
      const angle = rand() * Math.PI
      g.lineBetween(sx, sy, sx + Math.cos(angle) * sLen, sy + Math.sin(angle) * sLen)
    }

    // ── 5. Manhole covers — subtle circular floor hatches ──
    for (let i = 0; i < 14; i++) {
      const mx = WORLD_MARGIN + 60 + rand() * (worldW - WORLD_MARGIN * 2 - 120)
      const my = WORLD_MARGIN + 60 + rand() * (worldH - WORLD_MARGIN * 2 - 120)
      if (isOverlapping(mx, my, 12)) continue
      const mr = 30 + rand() * 12
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
      if (rand() > 0.35) continue
      const sy = rect.y + rect.h
      const sx = rect.x + 14
      const sw = rect.w - 28
      for (let stripe = 0; stripe < sw; stripe += 56) {
        g.fillStyle(0xd4a017, 0.2)
        g.fillRect(sx + stripe, sy + 3, 30, 16)
        g.fillStyle(0x1a1e2a, 0.22)
        g.fillRect(sx + stripe + 30, sy + 3, 26, 16)
      }
    }

    // ── 7. Mako glow pools — subtle floor glows scattered around ──
    for (let i = 0; i < 8; i++) {
      const gx = x0 + 100 + rand() * (w - 200)
      const gy = y0 + 100 + rand() * (h - 200)
      if (isOverlapping(gx, gy, 15)) continue
      const gr = 16 + rand() * 10
      // Outer glow halo (Graphics — small area fill)
      g.fillStyle(MAKO_GREEN, 0.015)
      g.fillCircle(gx, gy, gr)
      // Inner glow core — sprite with ADD blend for reactor glow effect
      const glowCore = this.scene.add.sprite(gx, gy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.14).setAlpha(0.06).setTint(MAKO_GREEN)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-10)
      this.terrainDecos.push(glowCore)
      // Tiny vent grating at center (structural — keep as Graphics)
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
        g.fillStyle(0x3a4858, 0.6)
        g.fillRect(lx + 7, lampY - 41, 14, 6)
        // Mako glow pool on ground
        g.fillStyle(MAKO_GREEN, 0.03)
        g.fillEllipse(lx + 14, lampY + 2, 40, 22)
        // Lamp bulb sprite
        const bulb = this.scene.add.sprite(lx + 14, lampY - 38, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
          .setScale(0.18).setAlpha(0.3).setTint(MAKO_GREEN)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(-9)
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
        g.fillStyle(0x0a0e14, 0.15)
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
        g.fillStyle(0x1a2230, 0.85)
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

    // ── 13. Mako trees — glowing reactor-mutated foliage ──
    const treePositions: { x: number; y: number }[] = []
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = x0 + 60 + rand() * (w - 120)
      const ty = y0 + 60 + rand() * (h - 120)
      if (isOverlapping(tx, ty, 12)) continue
      // Keep trees away from streets
      if (streetY < y0 + h - 60 && Math.abs(ty - streetY) < STREET_W + SIDEWALK_W + 10) continue
      if (vStreetX < x0 + w - 60 && Math.abs(tx - vStreetX) < STREET_W + SIDEWALK_W + 10) continue
      treePositions.push({ x: tx, y: ty })
      if (treePositions.length >= 20) break
    }
    for (const tree of treePositions) {
      // Trunk
      g.fillStyle(0x3a2a1a, 0.4)
      g.fillRect(tree.x - 3.5, tree.y - 4, 7, 20)
      // Shadow
      g.fillStyle(0x000000, 0.08)
      g.fillEllipse(tree.x, tree.y + 10, 16, 6)
      // Canopy — layered circles with mako-green tint
      const canopyColor = rand() > 0.3 ? MAKO_GREEN : MAKO_CYAN
      g.fillStyle(canopyColor, 0.08)
      g.fillCircle(tree.x, tree.y - 8, 21.6 + rand() * 7.2)
      g.fillStyle(canopyColor, 0.05)
      g.fillCircle(tree.x - 4, tree.y - 6, 14.4 + rand() * 5.4)
      g.fillCircle(tree.x + 5, tree.y - 10, 12.6 + rand() * 5.4)
      // Glow core sprite in canopy
      const treeGlow = this.scene.add.sprite(tree.x, tree.y - 8, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.12).setAlpha(0.04).setTint(canopyColor)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-9)
      this.terrainDecos.push(treeGlow)
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
      g.fillStyle(0x0a0e14, 0.85)
      g.fillRoundedRect(signX - 30, signY - 42, 60, 16, 2)
      g.lineStyle(1, MAKO_CYAN, 0.2)
      g.strokeRoundedRect(signX - 30, signY - 42, 60, 16, 2)
      const signText = this.scene.add.text(signX, signY - 34, sectorNames[sectorIdx], {
        fontSize: '5px', fontFamily: 'monospace', color: '#00e5ff', resolution: 2,
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
          .setScale(0.16).setAlpha(0.5).setTint(MAKO_CYAN)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(-9)
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
        g.fillStyle(0x0a0e14, 0.4)
        g.fillRect(drainX - 14, drainY, 28, 6)
        // Grate lines
        g.lineStyle(0.5, 0x2a3440, 0.3)
        for (let gl = -10; gl <= 10; gl += 5) {
          g.lineBetween(drainX + gl, drainY, drainX + gl, drainY + 6)
        }
      }
    }

    // ── 19. Data Center buildings — large steel structures with antennae ──
    const dataCenterPositions: { x: number; y: number }[] = []
    const dcW = 180, dcH = 100
    for (let attempt = 0; attempt < 10; attempt++) {
      const dcx = x0 + 120 + rand() * (w - 240 - dcW)
      const dcy = y0 + 120 + rand() * (h - 240 - dcH)
      if (isOverlapping(dcx + dcW / 2, dcy + dcH / 2, Math.max(dcW, dcH) / 2 + 20)) continue
      // Keep away from streets
      if (streetY < y0 + h - 60 && Math.abs(dcy + dcH / 2 - streetY) < STREET_W + SIDEWALK_W + dcH / 2 + 10) continue
      if (vStreetX < x0 + w - 60 && Math.abs(dcx + dcW / 2 - vStreetX) < STREET_W + SIDEWALK_W + dcW / 2 + 10) continue
      dataCenterPositions.push({ x: dcx, y: dcy })
      if (dataCenterPositions.length >= 3) break
    }
    for (const dc of dataCenterPositions) {
      // Building shadow
      g.fillStyle(0x000000, 0.1)
      g.fillRect(dc.x + 6, dc.y + 6, dcW, dcH)
      // Building exterior — dark steel
      g.fillStyle(0x1a2030, 0.9)
      g.fillRect(dc.x, dc.y, dcW, dcH)
      // Outline
      g.lineStyle(1, 0x2a3a4a, 0.7)
      g.strokeRect(dc.x, dc.y, dcW, dcH)
      // Roof accent strip
      g.fillStyle(0x2a3848, 0.8)
      g.fillRect(dc.x, dc.y, dcW, 8)
      // Ventilation units on roof (small rectangles)
      for (let vi = 0; vi < 4; vi++) {
        const vx = dc.x + 20 + vi * 40
        g.fillStyle(0x3a4a5a, 0.6)
        g.fillRect(vx, dc.y + 10, 16, 10)
        g.lineStyle(0.5, 0x4a5a6a, 0.45)
        g.strokeRect(vx, dc.y + 10, 16, 10)
      }
      // Rooftop antenna arrays — vertical lines
      const antennaCount = 3 + Math.floor(rand() * 2)
      for (let ai = 0; ai < antennaCount; ai++) {
        const ax = dc.x + 30 + ai * 35 + rand() * 10
        g.lineStyle(1.5, 0x5a6a7a, 0.6)
        g.lineBetween(ax, dc.y, ax, dc.y - 20 - rand() * 15)
        // Cross arm on antenna
        g.lineStyle(1, 0x4a5a6a, 0.45)
        g.lineBetween(ax - 6, dc.y - 14, ax + 6, dc.y - 14)
      }
      // Blinking status lights — red and green indicators on facade
      for (let li = 0; li < 3; li++) {
        const lx = dc.x + 20 + li * 60
        const ly = dc.y + dcH - 14
        const lightFrame = rand() > 0.5 ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_RED
        const statusLight = this.scene.add.sprite(lx, ly, SPRITESHEET_KEYS.GAME_ICONS, lightFrame)
          .setScale(0.16).setAlpha(0.68).setDepth(-9)
          .setBlendMode(Phaser.BlendModes.ADD)
        this.terrainDecos.push(statusLight)
      }
      // Label text
      const dcLabel = this.scene.add.text(dc.x + dcW / 2, dc.y + 3, 'DATA-CTR', {
        fontSize: '5px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setDepth(-9).setAlpha(0.75)
      this.terrainDecos.push(dcLabel)
    }

    // ── 20. Cooling towers — cylindrical structures with steam vents ──
    const coolingTowerPositions: { x: number; y: number }[] = []
    for (let attempt = 0; attempt < 10; attempt++) {
      const ctx = x0 + 100 + rand() * (w - 200)
      const cty = y0 + 100 + rand() * (h - 200)
      if (isOverlapping(ctx, cty, 55)) continue
      // Keep away from streets
      if (streetY < y0 + h - 60 && Math.abs(cty - streetY) < STREET_W + SIDEWALK_W + 55) continue
      if (vStreetX < x0 + w - 60 && Math.abs(ctx - vStreetX) < STREET_W + SIDEWALK_W + 55) continue
      coolingTowerPositions.push({ x: ctx, y: cty })
      if (coolingTowerPositions.length >= 2) break
    }
    for (const ct of coolingTowerPositions) {
      const outerR = 42 + rand() * 6
      // Shadow
      g.fillStyle(0x000000, 0.08)
      g.fillCircle(ct.x + 4, ct.y + 4, outerR)
      // Outer ring — concrete base
      g.fillStyle(0x2a3040, 0.75)
      g.fillCircle(ct.x, ct.y, outerR)
      g.lineStyle(2, 0x3a4a5a, 0.6)
      g.strokeCircle(ct.x, ct.y, outerR)
      // Mid ring — metal structure
      g.fillStyle(0x1e2836, 0.8)
      g.fillCircle(ct.x, ct.y, outerR * 0.7)
      g.lineStyle(1, 0x3a4a5a, 0.45)
      g.strokeCircle(ct.x, ct.y, outerR * 0.7)
      // Inner opening — dark interior
      g.fillStyle(0x0a0e14, 0.75)
      g.fillCircle(ct.x, ct.y, outerR * 0.4)
      // Metal grating base — cross pattern
      g.lineStyle(1, 0x4a5a6a, 0.4)
      g.lineBetween(ct.x - outerR * 0.35, ct.y, ct.x + outerR * 0.35, ct.y)
      g.lineBetween(ct.x, ct.y - outerR * 0.35, ct.x, ct.y + outerR * 0.35)
      g.lineBetween(ct.x - outerR * 0.25, ct.y - outerR * 0.25, ct.x + outerR * 0.25, ct.y + outerR * 0.25)
      g.lineBetween(ct.x + outerR * 0.25, ct.y - outerR * 0.25, ct.x - outerR * 0.25, ct.y + outerR * 0.25)
      // Warning stripes around base
      const ctStripes = 12
      for (let si = 0; si < ctStripes; si++) {
        const angle = (si / ctStripes) * Math.PI * 2
        const sx1 = ct.x + Math.cos(angle) * (outerR + 2)
        const sy1 = ct.y + Math.sin(angle) * (outerR + 2)
        const sx2 = ct.x + Math.cos(angle) * (outerR + 10)
        const sy2 = ct.y + Math.sin(angle) * (outerR + 10)
        g.lineStyle(3, 0xd4a017, 0.2)
        g.lineBetween(sx1, sy1, sx2, sy2)
      }
      // Steam vent indicator — blue glow sprite on top
      const steamGlow = this.scene.add.sprite(ct.x, ct.y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.35).setAlpha(0.12).setTint(0x88ccff)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-9)
      this.terrainDecos.push(steamGlow)
    }

    // ── 21. Parking structure — large lot with spot markings ──
    const parkX = x0 + 60 + rand() * 80
    const parkY = y0 + 60 + rand() * 60
    const parkW = 200, parkH = 120
    if (!isOverlapping(parkX + parkW / 2, parkY + parkH / 2, Math.max(parkW, parkH) / 2 + 20)
      && parkX + parkW < x0 + w - 30 && parkY + parkH < y0 + h - 30) {
      // Asphalt surface
      g.fillStyle(0x1a1e28, 0.8)
      g.fillRect(parkX, parkY, parkW, parkH)
      // Perimeter curb lines
      g.lineStyle(2, 0x3a4a5a, 0.6)
      g.strokeRect(parkX, parkY, parkW, parkH)
      // Inner curb — double line
      g.lineStyle(1, 0x2a3440, 0.45)
      g.strokeRect(parkX + 4, parkY + 4, parkW - 8, parkH - 8)
      // Parking spot markings — rows of small rects
      const spotW = 18, spotH = 8, spotGap = 4
      const rows = 3
      const spotsPerRow = Math.floor((parkW - 40) / (spotW + spotGap))
      for (let row = 0; row < rows; row++) {
        const rowY = parkY + 24 + row * (spotH + 20)
        for (let col = 0; col < spotsPerRow; col++) {
          const spotX = parkX + 20 + col * (spotW + spotGap)
          g.lineStyle(0.8, 0x4a5a6a, 0.45)
          g.strokeRect(spotX, rowY, spotW, spotH)
        }
      }
      // Entrance ramp marking — arrow-like lines at bottom-center
      const rampX = parkX + parkW / 2
      const rampY = parkY + parkH
      g.fillStyle(0x2a3444, 0.7)
      g.fillRect(rampX - 14, rampY - 6, 28, 6)
      g.lineStyle(1, 0xd4a017, 0.25)
      g.lineBetween(rampX - 4, rampY - 5, rampX, rampY - 1)
      g.lineBetween(rampX + 4, rampY - 5, rampX, rampY - 1)
      // "P" label
      const parkLabel = this.scene.add.text(parkX + parkW / 2, parkY + 8, 'P', {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#4a6a8a', resolution: 2,
      }).setOrigin(0.5).setAlpha(0.53).setDepth(-9)
      this.terrainDecos.push(parkLabel)
    }

    // ── 22. Antenna/radio towers — tall lattice structures ──
    for (let ti = 0; ti < 2; ti++) {
      const towerBaseX = x0 + 200 + rand() * (w - 400)
      const towerBaseY = y0 + 200 + rand() * (h - 400)
      if (isOverlapping(towerBaseX, towerBaseY, 30)) continue
      // Keep away from streets
      if (streetY < y0 + h - 60 && Math.abs(towerBaseY - streetY) < STREET_W + SIDEWALK_W + 30) continue
      if (vStreetX < x0 + w - 60 && Math.abs(towerBaseX - vStreetX) < STREET_W + SIDEWALK_W + 30) continue
      const towerW = 36 + rand() * 8
      const towerH = 70 + rand() * 20
      const topX = towerBaseX
      const topY = towerBaseY - towerH
      // Triangular lattice outline
      g.lineStyle(1.5, 0x4a5a6a, 0.6)
      g.lineBetween(towerBaseX - towerW / 2, towerBaseY, topX, topY) // left edge
      g.lineBetween(towerBaseX + towerW / 2, towerBaseY, topX, topY) // right edge
      g.lineBetween(towerBaseX - towerW / 2, towerBaseY, towerBaseX + towerW / 2, towerBaseY) // base
      // Internal cross bracing
      const braceCount = 4
      for (let bi = 1; bi < braceCount; bi++) {
        const t = bi / braceCount
        const leftX = towerBaseX - towerW / 2 * (1 - t)
        const rightX = towerBaseX + towerW / 2 * (1 - t)
        const braceY = towerBaseY - towerH * t
        // Horizontal brace
        g.lineStyle(0.8, 0x3a4a5a, 0.45)
        g.lineBetween(leftX, braceY, rightX, braceY)
        // X-brace
        if (bi < braceCount - 1) {
          const nextT = (bi + 1) / braceCount
          const nextLeftX = towerBaseX - towerW / 2 * (1 - nextT)
          const nextRightX = towerBaseX + towerW / 2 * (1 - nextT)
          const nextY = towerBaseY - towerH * nextT
          g.lineStyle(0.5, 0x3a4a5a, 0.3)
          g.lineBetween(leftX, braceY, nextRightX, nextY)
          g.lineBetween(rightX, braceY, nextLeftX, nextY)
        }
      }
      // Guy wire lines extending outward
      g.lineStyle(0.5, 0x3a4a5a, 0.15)
      g.lineBetween(topX, topY + towerH * 0.3, towerBaseX - towerW * 1.5, towerBaseY + 10)
      g.lineBetween(topX, topY + towerH * 0.3, towerBaseX + towerW * 1.5, towerBaseY + 10)
      // Red warning light at top
      const towerLight = this.scene.add.sprite(topX, topY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_RED)
        .setScale(0.2).setAlpha(0.75).setDepth(-9)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(towerLight)
      // Base foundation
      g.fillStyle(0x2a3040, 0.6)
      g.fillRect(towerBaseX - towerW / 2 - 4, towerBaseY, towerW + 8, 6)
    }

    // ── 23. Perimeter wall — dashed border around campus ──
    const perimX1 = x0 + 20
    const perimY1 = y0 + 20
    const perimX2 = x0 + w - 20
    const perimY2 = y0 + h - 20
    const perimColor = 0x2a3a4a
    const dashLen = 12
    const gapLen = 8
    // Top edge
    for (let dx = perimX1; dx < perimX2; dx += dashLen + gapLen) {
      const endX = Math.min(dx + dashLen, perimX2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(dx, perimY1, endX, perimY1)
    }
    // Bottom edge
    for (let dx = perimX1; dx < perimX2; dx += dashLen + gapLen) {
      const endX = Math.min(dx + dashLen, perimX2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(dx, perimY2, endX, perimY2)
    }
    // Left edge
    for (let dy = perimY1; dy < perimY2; dy += dashLen + gapLen) {
      const endY = Math.min(dy + dashLen, perimY2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(perimX1, dy, perimX1, endY)
    }
    // Right edge
    for (let dy = perimY1; dy < perimY2; dy += dashLen + gapLen) {
      const endY = Math.min(dy + dashLen, perimY2)
      g.lineStyle(1.5, perimColor, 0.5)
      g.lineBetween(perimX2, dy, perimX2, endY)
    }
    // Corner watchtower markers — filled squares with yellow indicator lights
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
        .setScale(0.16).setAlpha(0.6).setDepth(-9)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(cornerLight)
    }

    // ── 24. Cargo containers — shipping containers near streets ──
    const containerColors = [0x2a4a3a, 0x4a2a2a, 0x2a2a4a, 0x3a3a2a, 0x2a3a3a]
    const contW = 40, contH = 16
    const containerCluster: { x: number; y: number; color: number; stacked: boolean }[] = []
    // Place containers near the horizontal street
    const containerBaseY = streetY < y0 + h - 60 ? streetY + STREET_W / 2 + SIDEWALK_W + 20 : y0 + h - 100
    const containerBaseX = WORLD_MARGIN + 200 + rand() * 100
    for (let ci = 0; ci < 5; ci++) {
      const cx = containerBaseX + ci * (contW + 6 + rand() * 8)
      if (cx + contW > x0 + w - 40) break
      const cy = containerBaseY + (rand() > 0.5 ? 0 : contH + 4)
      if (isOverlapping(cx + contW / 2, cy + contH / 2, 24)) continue
      const stacked = ci > 0 && rand() > 0.6
      containerCluster.push({
        x: cx,
        y: stacked ? cy - 14 : cy,
        color: containerColors[ci % containerColors.length],
        stacked,
      })
      // Also push the base container if stacking
      if (stacked) {
        containerCluster.push({
          x: cx,
          y: cy,
          color: containerColors[(ci + 2) % containerColors.length],
          stacked: false,
        })
      }
    }
    // Draw base (non-stacked) containers first, then stacked ones on top
    const sortedContainers = containerCluster.sort((a, b) => (a.stacked ? 1 : 0) - (b.stacked ? 1 : 0))
    for (const cont of sortedContainers) {
      // Container body
      g.fillStyle(cont.color, 0.6)
      g.fillRect(cont.x, cont.y, contW, contH)
      // Container outline
      g.lineStyle(0.8, 0x4a5a6a, 0.45)
      g.strokeRect(cont.x, cont.y, contW, contH)
      // Container ridges — vertical corrugation lines
      g.lineStyle(0.5, 0x5a6a7a, 0.25)
      for (let ri = 4; ri < contW; ri += 6) {
        g.lineBetween(cont.x + ri, cont.y + 1, cont.x + ri, cont.y + contH - 1)
      }
      // Door end marking — two small rects on right side
      g.fillStyle(0x3a4a5a, 0.4)
      g.fillRect(cont.x + contW - 6, cont.y + 2, 2, contH - 4)
      g.fillRect(cont.x + contW - 3, cont.y + 2, 2, contH - 4)
    }

    // ── 25. Infill structures — fill empty gaps between and around buildings ──

    // Generator units — small 50x35 industrial boxes scattered near buildings
    for (let i = 0; i < 8; i++) {
      const gx = x0 + 80 + rand() * (w - 160)
      const gy = y0 + 80 + rand() * (h - 160)
      if (isOverlapping(gx, gy, 30)) continue
      const gw = 45 + rand() * 15, gh = 30 + rand() * 10
      // Box body
      g.fillStyle(0x1e2836, 0.8)
      g.fillRect(gx - gw/2, gy - gh/2, gw, gh)
      g.lineStyle(1, 0x3a4a5a, 0.6)
      g.strokeRect(gx - gw/2, gy - gh/2, gw, gh)
      // Ventilation slats
      for (let sl = 0; sl < 3; sl++) {
        g.fillStyle(0x0a0e14, 0.45)
        g.fillRect(gx - gw/2 + 6, gy - gh/2 + 6 + sl * 8, gw - 12, 3)
      }
      // Status light
      const genFrame = rand() > 0.5 ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_RED
      const genLight = this.scene.add.sprite(gx + gw/2 - 8, gy - gh/2 + 6, SPRITESHEET_KEYS.GAME_ICONS, genFrame)
        .setScale(0.14).setAlpha(0.6).setDepth(-9)
      this.terrainDecos.push(genLight)
      // Label
      const genLabel = this.scene.add.text(gx, gy + gh/2 + 4, `GEN-${Math.floor(rand() * 90 + 10)}`, {
        fontSize: '4px', fontFamily: 'monospace', color: '#3a4a5a', resolution: 2,
      }).setOrigin(0.5).setAlpha(0.6).setDepth(-9)
      this.terrainDecos.push(genLabel)
    }

    // Transformer boxes — small electrical units
    for (let i = 0; i < 6; i++) {
      const tx = x0 + 60 + rand() * (w - 120)
      const ty = y0 + 60 + rand() * (h - 120)
      if (isOverlapping(tx, ty, 20)) continue
      const tw = 20 + rand() * 10, th = 20 + rand() * 10
      g.fillStyle(0x2a3444, 0.75)
      g.fillRect(tx - tw/2, ty - th/2, tw, th)
      g.lineStyle(1, 0x4a5a6a, 0.45)
      g.strokeRect(tx - tw/2, ty - th/2, tw, th)
      // Warning diamond
      g.fillStyle(0xd4a017, 0.3)
      const dSize = 5
      g.fillPoints([
        {x: tx, y: ty - dSize},
        {x: tx + dSize, y: ty},
        {x: tx, y: ty + dSize},
        {x: tx - dSize, y: ty},
      ], true)
    }

    // Dumpsters — near building edges
    for (const rect of buildingRects) {
      if (rand() > 0.5) continue
      const side = Math.floor(rand() * 4)
      let dx: number, dy: number
      if (side === 0) { dx = rect.x + rand() * rect.w; dy = rect.y - 25 }
      else if (side === 1) { dx = rect.x + rect.w + 15; dy = rect.y + rand() * rect.h }
      else if (side === 2) { dx = rect.x + rand() * rect.w; dy = rect.y + rect.h + 15 }
      else { dx = rect.x - 25; dy = rect.y + rand() * rect.h }
      if (dx < x0 + 10 || dx > x0 + w - 10 || dy < y0 + 10 || dy > y0 + h - 10) continue
      g.fillStyle(0x2a4a3a, 0.6)
      g.fillRect(dx - 12, dy - 8, 24, 16)
      g.lineStyle(1, 0x3a5a4a, 0.45)
      g.strokeRect(dx - 12, dy - 8, 24, 16)
      g.fillStyle(0x1a3a2a, 0.45)
      g.fillRect(dx - 12, dy - 8, 24, 4) // lid
    }

    // Utility poles with wires — vertical posts with horizontal wire runs
    for (let i = 0; i < 5; i++) {
      const px = x0 + 100 + rand() * (w - 200)
      const py = y0 + 100 + rand() * (h - 200)
      if (isOverlapping(px, py, 15)) continue
      // Pole
      g.fillStyle(0x4a5a6a, 0.6)
      g.fillRect(px - 2, py - 30, 4, 30)
      // Cross arm
      g.fillStyle(0x4a5a6a, 0.55)
      g.fillRect(px - 14, py - 28, 28, 3)
      // Insulators — small dots at wire attachment points
      const insL = this.scene.add.sprite(px - 12, py - 28, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.08).setAlpha(0.6).setDepth(-9)
      this.terrainDecos.push(insL)
      const insR = this.scene.add.sprite(px + 12, py - 28, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.08).setAlpha(0.6).setDepth(-9)
      this.terrainDecos.push(insR)
    }

    // Floor vents — rectangular grilles scattered on the ground
    for (let i = 0; i < 15; i++) {
      const vx = x0 + 40 + rand() * (w - 80)
      const vy = y0 + 40 + rand() * (h - 80)
      if (isOverlapping(vx, vy, 10)) continue
      const vw = 16 + rand() * 12, vh = 10 + rand() * 6
      g.fillStyle(0x1a2030, 0.6)
      g.fillRect(vx - vw/2, vy - vh/2, vw, vh)
      // Grate lines
      g.lineStyle(0.8, 0x2a3444, 0.4)
      for (let gl = -vw/2 + 3; gl < vw/2; gl += 4) {
        g.lineBetween(vx + gl, vy - vh/2 + 1, vx + gl, vy + vh/2 - 1)
      }
      // Subtle green glow from below
      if (rand() > 0.6) {
        g.fillStyle(0x00ff88, 0.02)
        g.fillEllipse(vx, vy, vw + 8, vh + 6)
      }
    }

    // Chain-link fence segments — near perimeter
    const fenceY = y0 + 30
    g.lineStyle(0.5, 0x4a5a6a, 0.35)
    for (let fx = x0 + 40; fx < x0 + w - 40; fx += 6) {
      g.lineBetween(fx, fenceY, fx + 3, fenceY + 6)
      g.lineBetween(fx + 3, fenceY, fx, fenceY + 6)
    }
    // Fence posts
    for (let fx = x0 + 40; fx < x0 + w - 40; fx += 60) {
      g.fillStyle(0x4a5a6a, 0.5)
      g.fillRect(fx - 1.5, fenceY - 2, 3, 10)
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
        .setScale(0.28 + Math.random() * 0.14)
        .setAlpha(0.1)
        .setTint(0x00ff88)
        .setBlendMode(Phaser.BlendModes.ADD)
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
