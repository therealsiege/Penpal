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
        x: room.x - room.width / 2 - 30,
        y: room.y - room.height / 2 - 30,
        w: room.width + 60,
        h: room.height + 60,
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
    const PLATE = 80
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
          g.fillStyle(0x242a38, 0.3)
          g.fillRect(gx + 1, gy + 1, PLATE - 2, PLATE - 2)
        } else if (r < 0.2) {
          g.fillStyle(0x141822, 0.25)
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
            .setScale(0.06).setAlpha(0.3).setTint(0x3a4050).setDepth(-10)
          this.terrainDecos.push(bolt)
        }
      }
    }

    // ── 2. Mako energy seams — glowing green/cyan lines in the floor ──
    const MAKO_GREEN = 0x00ff88
    const MAKO_CYAN = 0x00e5ff

    // Horizontal mako seam
    const seamY = WORLD_MARGIN - 40
    g.lineStyle(5, MAKO_GREEN, 0.25)
    g.lineBetween(x0, seamY, x0 + w, seamY)
    // Glow around seam
    g.fillStyle(MAKO_GREEN, 0.04)
    g.fillRect(x0, seamY - 16, w, 32)
    g.fillStyle(MAKO_GREEN, 0.02)
    g.fillRect(x0, seamY - 32, w, 64)

    // Vertical mako seams
    const vertSeamX1 = WORLD_MARGIN + 60
    const vertSeamX2 = worldW - WORLD_MARGIN - 60
    if (worldH > 300) {
      for (const sx of [vertSeamX1, vertSeamX2]) {
        g.lineStyle(4, MAKO_CYAN, 0.18)
        g.lineBetween(sx, seamY, sx, worldH + PAD)
        g.fillStyle(MAKO_CYAN, 0.03)
        g.fillRect(sx - 16, seamY, 32, worldH + PAD - seamY)
        // Seam junction indicator — glowing cyan dot sprite at intersection
        const junctionDot = this.scene.add.sprite(sx, seamY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
          .setScale(0.08).setAlpha(0.3).setTint(MAKO_CYAN)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(-10)
        this.terrainDecos.push(junctionDot)
      }
    }

    // Mako pool / reactor vent — lower-right area
    const poolCX = worldW - WORLD_MARGIN - 180
    const poolCY = worldH - WORLD_MARGIN - 130
    const poolRX = 110 + rand() * 30
    const poolRY = 70 + rand() * 18
    if (!isOverlapping(poolCX, poolCY, Math.max(poolRX, poolRY) + 30)) {
      // Outer rim — dark metal
      g.fillStyle(0x2a3040, 0.5)
      g.fillEllipse(poolCX, poolCY, poolRX + 22, poolRY + 16)
      // Grating ring
      g.lineStyle(3, 0x3a4a5a, 0.4)
      g.strokeEllipse(poolCX, poolCY, poolRX + 12, poolRY + 8)
      // Mako pool
      g.fillStyle(MAKO_GREEN, 0.2)
      g.fillEllipse(poolCX, poolCY, poolRX, poolRY)
      // Brighter center
      g.fillStyle(MAKO_GREEN, 0.15)
      g.fillEllipse(poolCX, poolCY, poolRX * 0.6, poolRY * 0.6)
      g.fillStyle(0xaaffcc, 0.08)
      g.fillEllipse(poolCX, poolCY, poolRX * 0.3, poolRY * 0.3)
      // Ripple rings
      g.lineStyle(1, MAKO_GREEN, 0.12)
      g.strokeEllipse(poolCX - 18, poolCY - 8, 50, 28)
      g.strokeEllipse(poolCX + 22, poolCY + 6, 36, 22)
      // Warning stripes around pool
      const stripeCount = 16
      for (let si = 0; si < stripeCount; si++) {
        const angle = (si / stripeCount) * Math.PI * 2
        const sx1 = poolCX + Math.cos(angle) * (poolRX + 24)
        const sy1 = poolCY + Math.sin(angle) * (poolRY + 18)
        const sx2 = poolCX + Math.cos(angle) * (poolRX + 38)
        const sy2 = poolCY + Math.sin(angle) * (poolRY + 28)
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
          .setScale(0.10).setAlpha(0.4).setDepth(-10)
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
    for (let attempt = 0; attempt < 12; attempt++) {
      const isVert = rand() > 0.5
      const pr = 8 + rand() * 6 // 16-28px diameter
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
      if (isOverlapping(midX, midY, 50)) continue
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
      g.fillStyle(0x4a5568, 0.5)
      if (isVert) {
        g.fillRect(pipe.x1 - pipe.r, pipe.y1, pipe.r * 2, pipe.y2 - pipe.y1)
      } else {
        g.fillRect(pipe.x1, pipe.y1 - pipe.r, pipe.x2 - pipe.x1, pipe.r * 2)
      }
      // Highlight stripe
      g.fillStyle(0x6b7a8a, 0.25)
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
        g.fillStyle(0x5a6a7a, 0.4)
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
      ).setScale(0.08).setAlpha(0.35).setDepth(-10)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(startLight)
      const endLight = this.scene.add.sprite(
        pipe.x2 + endOffset.dx, pipe.y2 + endOffset.dy,
        SPRITESHEET_KEYS.GAME_ICONS, indicatorColor,
      ).setScale(0.08).setAlpha(0.35).setDepth(-10)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.terrainDecos.push(endLight)
    }

    // ── 4. Floor detail — rust patches, oil stains, scorch marks ──
    // Rust stains — orange-brown splotches
    for (let i = 0; i < 12; i++) {
      const rx = x0 + rand() * w
      const ry = y0 + rand() * h
      if (isOverlapping(rx, ry, 20)) continue
      const rr = 15 + rand() * 25
      g.fillStyle(0x8a4a1a, 0.06 + rand() * 0.04)
      g.fillEllipse(rx, ry, rr, rr * (0.6 + rand() * 0.4))
      // Darker center
      g.fillStyle(0x6a3a0a, 0.04)
      g.fillEllipse(rx + 2, ry + 2, rr * 0.5, rr * 0.4)
    }

    // Oil stains — dark iridescent puddles
    for (let i = 0; i < 8; i++) {
      const ox = x0 + rand() * w
      const oy = y0 + rand() * h
      if (isOverlapping(ox, oy, 16)) continue
      const or_ = 12 + rand() * 20
      g.fillStyle(0x0a0a1a, 0.12 + rand() * 0.06)
      g.fillEllipse(ox, oy, or_, or_ * (0.5 + rand() * 0.3))
      // Iridescent shimmer highlight
      g.fillStyle(0x4a3a6a, 0.04)
      g.fillEllipse(ox - 3, oy - 2, or_ * 0.6, or_ * 0.3)
    }

    // Scorch marks — dark radial burns
    for (let i = 0; i < 5; i++) {
      const sx = x0 + rand() * w
      const sy = y0 + rand() * h
      if (isOverlapping(sx, sy, 20)) continue
      const sr = 10 + rand() * 18
      g.fillStyle(0x0a0a0a, 0.08 + rand() * 0.04)
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
    for (let i = 0; i < 5; i++) {
      const mx = WORLD_MARGIN + 60 + rand() * (worldW - WORLD_MARGIN * 2 - 120)
      const my = WORLD_MARGIN + 60 + rand() * (worldH - WORLD_MARGIN * 2 - 120)
      if (isOverlapping(mx, my, 24)) continue
      const mr = 18 + rand() * 8
      g.fillStyle(0x2a3040, 0.35)
      g.fillCircle(mx, my, mr + 4)
      g.fillStyle(0x222a38, 0.4)
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
      for (let stripe = 0; stripe < sw; stripe += 36) {
        g.fillStyle(0xd4a017, 0.1)
        g.fillRect(sx + stripe, sy + 3, 18, 10)
        g.fillStyle(0x1a1e2a, 0.12)
        g.fillRect(sx + stripe + 18, sy + 3, 18, 10)
      }
    }

    // ── 7. Mako glow pools — small floor glows scattered around ──
    for (let i = 0; i < 6; i++) {
      const gx = x0 + 100 + rand() * (w - 200)
      const gy = y0 + 100 + rand() * (h - 200)
      if (isOverlapping(gx, gy, 30)) continue
      const gr = 20 + rand() * 15
      // Outer glow halo (Graphics — large area fill)
      g.fillStyle(MAKO_GREEN, 0.035)
      g.fillCircle(gx, gy, gr)
      // Inner glow core — sprite with ADD blend for reactor glow effect
      const glowCore = this.scene.add.sprite(gx, gy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.12).setAlpha(0.18).setTint(MAKO_GREEN)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-10)
      this.terrainDecos.push(glowCore)
      // Tiny vent grating at center (structural — keep as Graphics)
      g.fillStyle(0x2a3040, 0.3)
      g.fillRoundedRect(gx - 8, gy - 5, 16, 10, 2)
      g.lineStyle(2, 0x1a2030, 0.3)
      g.lineBetween(gx - 4, gy - 4, gx - 4, gy + 4)
      g.lineBetween(gx, gy - 4, gx, gy + 4)
      g.lineBetween(gx + 4, gy - 4, gx + 4, gy + 4)
    }

    // ── 8. Terrain prop sprites — wrench/first-aid near pipe joints ──
    this.placeTerrainProps(pipePositions)
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
        .setScale(0.2)
        .setAlpha(0.25 + Math.random() * 0.1)
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
        .setScale(0.1 + Math.random() * 0.08)
        .setAlpha(0.15)
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
