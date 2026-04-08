import Phaser from 'phaser'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'
import type { Room } from './office-types'
import { activeTheme, lerpColor } from './office-theme'
import {
  OFFICE_FRAME_PLANT, OFFICE_FRAME_BOOKSHELF,
  OFFICE_FRAME_PLANT_TALL, OFFICE_FRAME_CACTUS, OFFICE_FRAME_HANGING_PLANT,
  OFFICE_FRAME_FERN, OFFICE_FRAME_MONSTERA, OFFICE_FRAME_CLOCK,
  OFFICE_FRAME_WATER_COOLER, OFFICE_FRAME_WHITEBOARD,
  OFFICE_FRAME_MONITOR, OFFICE_FRAME_PRINTER,
  OFFICE_FRAME_TRASH, OFFICE_FRAME_STORAGE, OFFICE_FRAME_FILE_CABINET,
  WORLD_MARGIN, ROOM_HEADER_H,
  scaledFontSize,
} from './office-constants'

/** Returns true when the lab prop spritesheet is loaded — signals lab skin mode */
function isLabSkin(scene: Phaser.Scene): boolean {
  return scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)
}

// ---------------------------------------------------------------------------
// Host interface — what OfficeInterior needs from OfficeScene
// ---------------------------------------------------------------------------

export interface InteriorHostScene {
  isOfficeTilesLoaded(): boolean
  getLastLodLevel(): number
  getAgents(): import('../types').AgentState[]
  getRooms(): Map<string, Room>
  getAtmosphere(): {
    windowPositions: { x: number; y: number; w: number; h: number }[]
    currentTimePhase: string
    wallClockContainer: Phaser.GameObjects.Container | null
    exteriorLights: Phaser.GameObjects.Container | null
    destroyCeilingLights(): void
  }
}

// SeasonalConfig type
interface SeasonalConfig {
  color: number
  accent: number
  extraDecorType: 'winter' | 'spring' | 'summer' | 'autumn'
}

// ---------------------------------------------------------------------------
// OfficeInterior
// Owns: office background graphics, decorations, whiteboard, reactor glow,
//       exterior lights, seasonal decorations, and room activity updates.
// ---------------------------------------------------------------------------

export class OfficeInterior {
  private scene: Phaser.Scene
  private host: InteriorHostScene

  private officeGraphics: Phaser.GameObjects.Graphics | null = null

  // Decorations
  private officeDecoSprites: Phaser.GameObjects.Sprite[] = []
  private seasonalDecos: Phaser.GameObjects.GameObject[] = []
  private decoTweens: Phaser.Tweens.Tween[] = []
  private waterCoolerBubbleTimer: Phaser.Time.TimerEvent | null = null

  // Whiteboard
  private whiteboardContainer: Phaser.GameObjects.Container | null = null
  private whiteboardTexts: Phaser.GameObjects.Text[] = []

  // Flag container
  private flagContainer: Phaser.GameObjects.Container | null = null

  // Reactor glow (mako energy source)
  private reactorCenter: { x: number; y: number; rx: number; ry: number } | null = null
  private reactorGlowGfx: Phaser.GameObjects.Graphics | null = null
  private reactorPulseTween: Phaser.Tweens.Tween | null = null
  private lastReactorTickAt = 0

  // Background cache dimensions
  private lastOfficeBgW = 0
  private lastOfficeBgH = 0

  constructor(scene: Phaser.Scene, host: InteriorHostScene) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Init — caller passes in the pre-created graphics layer
  // ---------------------------------------------------------------------------

  init(officeGraphics: Phaser.GameObjects.Graphics): void {
    this.officeGraphics = officeGraphics
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  getBgDimensions(): { w: number; h: number } {
    return { w: this.lastOfficeBgW, h: this.lastOfficeBgH }
  }

  invalidateBgCache(): void {
    this.lastOfficeBgW = 0
    this.lastOfficeBgH = 0
  }

  hasWhiteboardContainer(): boolean {
    return this.whiteboardContainer !== null
  }

  setReactorCenter(center: { x: number; y: number; rx: number; ry: number } | null): void {
    this.reactorCenter = center
  }

  // ---------------------------------------------------------------------------
  // drawOfficeBackground
  // ---------------------------------------------------------------------------

  drawOfficeBackground(
    contentW: number,
    contentH: number,
    getSeasonalConfig: () => SeasonalConfig,
  ): void {
    if (contentW === this.lastOfficeBgW && contentH === this.lastOfficeBgH) return
    this.lastOfficeBgW = contentW
    this.lastOfficeBgH = contentH

    const g = this.officeGraphics
    if (!g) return
    g.clear()

    for (const t of this.decoTweens) { try { t.destroy() } catch { /* already gone */ } }
    this.decoTweens = []
    if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    for (const d of this.seasonalDecos) { try { (d as { destroy(): void }).destroy() } catch { /* already gone */ } }
    this.seasonalDecos = []

    const WALL_T = 5
    const PAD = 30

    // No single building rect — each team area draws its own building walls.
    // But we still compute the bounding box for positioning decorations (whiteboard, exterior lights).
    const bx = WORLD_MARGIN - PAD
    const by = WORLD_MARGIN - PAD
    const bw = contentW - WORLD_MARGIN + PAD * 2
    const bh = contentH - WORLD_MARGIN + PAD * 2
    const fx = bx + WALL_T
    const fy = by + WALL_T
    const fw = bw - WALL_T * 2
    const fh = bh - WALL_T * 2

    const atmosphere = this.host.getAtmosphere()
    atmosphere.windowPositions = []
    atmosphere.destroyCeilingLights()
    if (this.flagContainer) { this.scene.tweens.killTweensOf(this.flagContainer); this.flagContainer.destroy(true); this.flagContainer = null }

    if (atmosphere.wallClockContainer) { atmosphere.wallClockContainer.destroy(); (atmosphere as { wallClockContainer: Phaser.GameObjects.Container | null }).wallClockContainer = null }
    if (this.whiteboardContainer) { this.whiteboardContainer.destroy(); this.whiteboardContainer = null; this.whiteboardTexts = [] }
    if (atmosphere.exteriorLights) { atmosphere.exteriorLights.destroy(); (atmosphere as { exteriorLights: Phaser.GameObjects.Container | null }).exteriorLights = null }

    // ── Lab skin: skip office decorations, whiteboard, hazard markings, seasonal ──
    if (isLabSkin(this.scene)) {
      this.drawLabInterior(bx, by, bw, bh, fx, fy, fw, fh, atmosphere)
      return
    }

    // ── Midgar-themed exterior decorations ──
    // Industrial props placed around the perimeter of the office complex.
    // Tinted dark/mako-green to match the reactor/steel-plate aesthetic.
    {
      const DECO_SCALE = 0.65
      const decos: Phaser.GameObjects.Sprite[] = []
      const MAKO_TINT = 0x00cc88 // subtle mako-green tint for plants
      const STEEL_TINT = 0x5a6a7a // metallic tint for furniture

      // Industrial wall clock
      if (fw > 300) {
        const clockX = fx + fw / 2
        const clockY = by + 12
        const atm2 = this.host.getAtmosphere()
        if (atm2.wallClockContainer) {
          atm2.wallClockContainer.destroy()
          ;(atm2 as { wallClockContainer: Phaser.GameObjects.Container | null }).wallClockContainer = null
        }
        const clockFace = this.scene.add.graphics()
        clockFace.fillStyle(activeTheme.roomFloor, 0.8)
        clockFace.fillCircle(0, 0, 12)
        clockFace.lineStyle(1, activeTheme.wall, 1)
        clockFace.strokeCircle(0, 0, 12)
        clockFace.lineStyle(1, activeTheme.wallInner, 0.8)
        for (let t = 0; t < 12; t++) {
          const ang = Phaser.Math.DegToRad(t * 30 - 90)
          clockFace.lineBetween(Math.cos(ang) * 10, Math.sin(ang) * 10, Math.cos(ang) * 12, Math.sin(ang) * 12)
        }
        clockFace.fillStyle(0x00ff88, 1) // mako-green center dot
        clockFace.fillCircle(0, 0, 1)
        const hourHand = this.scene.add.graphics()
        const minuteHand = this.scene.add.graphics()
        const secondHand = this.scene.add.graphics()
        const wc = this.scene.add.container(clockX, clockY, [clockFace, hourHand, minuteHand, secondHand])
        wc.setDepth(-0.5)
        wc.setAlpha(0.88)
        ;(atm2 as { wallClockContainer: Phaser.GameObjects.Container | null }).wallClockContainer = wc
      }

      // Data archive shelves — industrial storage along walls
      if (fh > 140) {
        decos.push(this.scene.add.sprite(fx + 14, fy + 50, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_BOOKSHELF)
          .setScale(DECO_SCALE).setAlpha(0.55).setTint(STEEL_TINT).setDepth(-1))
      }
      // Filing cabinets — Shinra-style document storage
      if (fh > 160 && fw > 250) {
        decos.push(this.scene.add.sprite(fx + fw - 20, fy + fh - 50, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_FILE_CABINET)
          .setScale(DECO_SCALE * 0.9).setAlpha(0.6).setTint(STEEL_TINT).setDepth(-1))
      }
      // Mako coolant dispenser (water cooler re-themed)
      if (fw > 350) {
        decos.push(this.scene.add.sprite(fx + fw / 2 - 60, fy + fh - 30, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_WATER_COOLER)
          .setScale(DECO_SCALE * 0.85).setAlpha(0.55).setTint(0x00e5ff).setDepth(-1))
      }
      // Mako-infused plant specimens — reactor-mutated greenery
      if (fw > 200) {
        decos.push(this.scene.add.sprite(fx + 30, fy + 5, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_CACTUS)
          .setScale(DECO_SCALE * 0.8).setAlpha(0.45).setTint(MAKO_TINT).setDepth(-1))
      }
      if (fh > 180) {
        decos.push(this.scene.add.sprite(fx + 40, fy + fh - 25, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_FERN)
          .setScale(DECO_SCALE * 0.9).setAlpha(0.5).setTint(MAKO_TINT).setDepth(-1))
      }
      // Industrial terminal (printer re-themed as console)
      if (fw > 280 && fh > 140) {
        decos.push(this.scene.add.sprite(fx + fw - 22, fy + fh / 2, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_PRINTER)
          .setScale(DECO_SCALE * 0.9).setAlpha(0.55).setTint(STEEL_TINT).setDepth(-1))
      }
      // Waste bins — industrial refuse
      decos.push(this.scene.add.sprite(fx + 8, fy + 14, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_TRASH)
        .setScale(DECO_SCALE * 0.9).setAlpha(0.5).setTint(STEEL_TINT).setDepth(-1))
      if (fw > 200) {
        decos.push(this.scene.add.sprite(fx + fw - 10, fy + 14, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_TRASH)
          .setScale(DECO_SCALE * 0.9).setAlpha(0.5).setTint(STEEL_TINT).setDepth(-1))
      }
      // Secondary data archive
      if (fh > 180 && fw > 200) {
        decos.push(this.scene.add.sprite(fx + fw - 16, fy + 50, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_BOOKSHELF)
          .setScale(DECO_SCALE).setAlpha(0.52).setTint(STEEL_TINT).setDepth(-1))
      }
      // Supply crate (storage re-themed)
      if (fw > 320 && fh > 150) {
        decos.push(this.scene.add.sprite(fx + fw * 0.65, fy + fh - 28, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_STORAGE)
          .setScale(DECO_SCALE * 0.9).setAlpha(0.55).setTint(STEEL_TINT).setDepth(-1))
      }
      // Reactor-zone monitoring equipment
      if (fw > 350 && fh > 160) {
        decos.push(this.scene.add.sprite(fx + fw - 55, fy + 35, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_MONITOR)
          .setScale(DECO_SCALE * 0.85).setAlpha(0.58).setTint(0x00e5ff).setDepth(-1))
      }

      this.officeDecoSprites = decos
      this.animateDecorations()
    }

    // Live stats whiteboard
    // Re-read whiteboardContainer to reset TypeScript's narrowed type
    const wbExisting: Phaser.GameObjects.Container | null = this.whiteboardContainer as Phaser.GameObjects.Container | null
    if (wbExisting) {
      wbExisting.destroy()
      this.whiteboardContainer = null
      this.whiteboardTexts = []
    }
    if (fw > 400) {
      const wbX = fx + fw / 2
      const wbY = by + 24
      const wbBg = this.scene.add.graphics()
      wbBg.fillStyle(0xf8fafc, 0.12)
      wbBg.fillRoundedRect(-30, -18, 60, 36, 4)
      wbBg.setDepth(-0.5)
      const wbSprite = this.host.isOfficeTilesLoaded()
        ? this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.OFFICE, OFFICE_FRAME_WHITEBOARD).setScale(0.32).setAlpha(0.55).setDepth(-0.5)
        : null
      const titleText = this.scene.add.text(0, -11, 'TEAM STATUS', {
        fontSize: scaledFontSize(5), fontFamily: 'monospace', color: '#8a96a4', fontStyle: 'bold', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.9).setDepth(0)
      const agentLine = this.scene.add.text(0, -3, 'Agents: 0', {
        fontSize: scaledFontSize(4), fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const activeLine = this.scene.add.text(0, 4, 'Active: 0', {
        fontSize: scaledFontSize(4), fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const roomLine = this.scene.add.text(0, 11, 'Rooms: 0', {
        fontSize: scaledFontSize(4), fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const wbChildren: Phaser.GameObjects.GameObject[] = [wbBg, titleText, agentLine, activeLine, roomLine]
      if (wbSprite) wbChildren.unshift(wbSprite)
      this.whiteboardContainer = this.scene.add.container(wbX, wbY, wbChildren)
      this.whiteboardContainer.setDepth(-1)
      this.whiteboardTexts = [agentLine, activeLine, roomLine]
      if (this.host.getLastLodLevel() < 3) this.whiteboardContainer.setVisible(false)
    }

    // Exterior lights
    if (atmosphere.exteriorLights) {
      atmosphere.exteriorLights.destroy()
      ;(atmosphere as { exteriorLights: Phaser.GameObjects.Container | null }).exteriorLights = null
    }
    {
      const lightChildren: Phaser.GameObjects.GameObject[] = []

      const phaseAlphaMap: Record<string, number> = {
        morning: 0.02,
        day: 0.0,
        evening: 0.06,
        night: 0.12,
      }
      const initAlpha = phaseAlphaMap[atmosphere.currentTimePhase] ?? 0.0

      const floodCount = 4
      const floodSpacing = bw / (floodCount + 1)
      const floodY = by + bh

      for (let fi = 0; fi < floodCount; fi++) {
        const flx = bx + floodSpacing * (fi + 1)

        const pool = this.scene.add.graphics()
        pool.fillStyle(0xd4a017, 1)
        pool.fillTriangle(-14, 0, 14, 0, 22, 32)
        pool.fillTriangle(-14, 0, -22, 32, 22, 32)
        pool.setPosition(flx, floodY)
        pool.setAlpha(initAlpha * 0.35)
        lightChildren.push(pool)

        const halo = this.scene.add.sprite(flx, floodY - 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.55).setTint(0xd4a017).setAlpha(initAlpha * 0.25)
        lightChildren.push(halo)

        const bulb = this.scene.add.sprite(flx, floodY - 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.25).setTint(0xd4a017).setAlpha(initAlpha)
        lightChildren.push(bulb)
      }

      const sconceY = by + bh * 0.72

      for (const wallX of [bx, bx + bw]) {
        const side = wallX === bx ? 1 : -1

        const wallPool = this.scene.add.graphics()
        wallPool.fillStyle(0xd4a017, 1)
        wallPool.fillTriangle(0, -10, 0, 10, side * 24, 0)
        wallPool.setPosition(wallX, sconceY)
        wallPool.setAlpha(initAlpha * 0.3)
        lightChildren.push(wallPool)

        const sconce = this.scene.add.sprite(wallX, sconceY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.25).setTint(0xd4a017).setAlpha(initAlpha)
        lightChildren.push(sconce)
      }

      const extLights = this.scene.add.container(0, 0, lightChildren)
      extLights.setDepth(-3.8)
      ;(atmosphere as { exteriorLights: Phaser.GameObjects.Container | null }).exteriorLights = extLights
    }

    // ── Floor zone numbering — subtle sector labels ──
    {
      let zoneIdx = 1
      for (let zx = fx + 50; zx < fx + fw - 50; zx += 400) {
        for (let zy = fy + 45; zy < fy + fh - 45; zy += 400) {
          const label = `Z-${String(zoneIdx).padStart(2, '0')}`
          const zoneText = this.scene.add.text(zx, zy, label, {
            fontSize: scaledFontSize(6),
            fontFamily: 'monospace',
            color: '#2a3a4a',
            resolution: 2,
          }).setAlpha(0.3).setDepth(-8)
          this.seasonalDecos.push(zoneText)
          zoneIdx++
        }
      }
    }

    // ── Hazard markings — yellow/black chevron warning stripes at floor edges ──
    {
      const chevronW = 12
      const chevronH = 6
      const yellow = 0xd4a017
      const black = activeTheme.bg
      const hazardAlpha = 0.22

      // Top edge
      for (let hx = fx + 10; hx < fx + fw - 10; hx += chevronW * 2) {
        g.fillStyle(yellow, hazardAlpha)
        g.fillRect(hx, fy + 2, chevronW, chevronH)
        g.fillStyle(black, hazardAlpha)
        g.fillRect(hx + chevronW, fy + 2, chevronW, chevronH)
      }
      // Bottom edge
      for (let hx = fx + 10; hx < fx + fw - 10; hx += chevronW * 2) {
        g.fillStyle(yellow, hazardAlpha)
        g.fillRect(hx, fy + fh - chevronH - 2, chevronW, chevronH)
        g.fillStyle(black, hazardAlpha)
        g.fillRect(hx + chevronW, fy + fh - chevronH - 2, chevronW, chevronH)
      }
      // Left edge
      for (let hy = fy + 20; hy < fy + fh - 20; hy += chevronW * 2) {
        g.fillStyle(yellow, hazardAlpha)
        g.fillRect(fx + 2, hy, chevronH, chevronW)
        g.fillStyle(black, hazardAlpha)
        g.fillRect(fx + 2, hy + chevronW, chevronH, chevronW)
      }
      // Right edge
      for (let hy = fy + 20; hy < fy + fh - 20; hy += chevronW * 2) {
        g.fillStyle(yellow, hazardAlpha)
        g.fillRect(fx + fw - chevronH - 2, hy, chevronH, chevronW)
        g.fillStyle(black, hazardAlpha)
        g.fillRect(fx + fw - chevronH - 2, hy + chevronW, chevronH, chevronW)
      }
    }

    // Seasonal decorations
    {
      const seasonal = getSeasonalConfig()

      if (seasonal.extraDecorType === 'winter') {
        const lightColors = [0xef4444, 0x22c55e, 0x3b82f6]
        const lightY = by + 1.5
        g.lineStyle(1, activeTheme.wall, 0.1)
        g.lineBetween(bx + 4, lightY, bx + bw - 4, lightY)
        let colorIdx = 0
        for (let lx = bx + 4; lx < bx + bw - 4; lx += 8) {
          g.fillStyle(lightColors[colorIdx % lightColors.length], 0.55)
          g.fillCircle(lx, lightY, 1.5)
          colorIdx++
        }
        const wreathX = bx + bw / 2
        const wreathY = by + bh - 38
        g.lineStyle(3, 0x166534, 0.3)
        g.strokeCircle(wreathX, wreathY, 6)
        g.fillStyle(0xef4444, 0.45)
        g.fillCircle(wreathX, wreathY - 6, 1.5)
      } else if (seasonal.extraDecorType === 'spring') {
        const flowerClusters = [
          { cx: fx + 14, cy: fy + fh - 14 },
          { cx: fx + fw - 14, cy: fy + fh - 14 },
          { cx: fx + 40, cy: fy + fh - 25 },
        ]
        const flowerColors = [0xd4a017, 0xd4a017, 0xfafafa]
        let seed = 7
        const rand = (): number => {
          seed = (seed * 16807) % 2147483647
          return (seed % 1000) / 1000
        }
        for (const cluster of flowerClusters) {
          for (let fi = 0; fi < 6; fi++) {
            g.fillStyle(flowerColors[fi % flowerColors.length], 0.35)
            g.fillCircle(cluster.cx + rand() * 20 - 10, cluster.cy + rand() * 10 - 5, 1)
          }
        }
      } else if (seasonal.extraDecorType === 'summer') {
        const sunX = bx + bw - 55
        const sunY = by - 22
        g.fillStyle(0xfde68a, 0.06)
        g.fillCircle(sunX, sunY, 9)
        g.fillStyle(0xfde68a, 0.15)
        g.fillCircle(sunX, sunY, 5)
        g.lineStyle(1, 0xfde68a, 0.2)
        const rayLen = 5
        for (let ri = 0; ri < 4; ri++) {
          const ang = Phaser.Math.DegToRad(ri * 90)
          const cosA = Math.cos(ang)
          const sinA = Math.sin(ang)
          g.lineBetween(sunX + cosA * 6, sunY + sinA * 6, sunX + cosA * (6 + rayLen), sunY + sinA * (6 + rayLen))
        }
      } else if (seasonal.extraDecorType === 'autumn') {
        const leafColors = [0xea580c, 0xef4444, 0x78350f]
        const leafBaseY = by + bh + 2
        let lseed = 13
        const lrand = (): number => {
          lseed = (lseed * 16807) % 2147483647
          return (lseed % 1000) / 1000
        }
        const leafCount = Math.min(18, Math.floor(bw / 20))
        for (let li = 0; li < leafCount; li++) {
          g.fillStyle(leafColors[li % leafColors.length], 0.15)
          g.fillRect(bx + lrand() * bw, leafBaseY + lrand() * 6, 2, 1)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // drawLabInterior — minimal lab facility interior (no office decorations)
  // ---------------------------------------------------------------------------

  private drawLabInterior(
    bx: number, by: number, bw: number, bh: number,
    fx: number, fy: number, fw: number, fh: number,
    atmosphere: ReturnType<InteriorHostScene['getAtmosphere']>,
  ): void {
    // Exterior lights are still needed for atmosphere transitions
    {
      const lightChildren: Phaser.GameObjects.GameObject[] = []
      const phaseAlphaMap: Record<string, number> = {
        morning: 0.02, day: 0.0, evening: 0.06, night: 0.12,
      }
      const initAlpha = phaseAlphaMap[atmosphere.currentTimePhase] ?? 0.0

      // Flood lights at bottom
      const floodCount = 4
      const floodSpacing = bw / (floodCount + 1)
      const floodY = by + bh
      for (let fi = 0; fi < floodCount; fi++) {
        const flx = bx + floodSpacing * (fi + 1)
        const pool = this.scene.add.graphics()
        pool.fillStyle(0x4a8aaa, 1) // cool blue-white for lab
        pool.fillTriangle(-14, 0, 14, 0, 22, 32)
        pool.fillTriangle(-14, 0, -22, 32, 22, 32)
        pool.setPosition(flx, floodY)
        pool.setAlpha(initAlpha * 0.35)
        lightChildren.push(pool)
        const halo = this.scene.add.sprite(flx, floodY - 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.55).setTint(0x4a8aaa).setAlpha(initAlpha * 0.25)
        lightChildren.push(halo)
        const bulb = this.scene.add.sprite(flx, floodY - 2, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.25).setTint(0x4a8aaa).setAlpha(initAlpha)
        lightChildren.push(bulb)
      }

      // Wall sconces
      const sconceY = by + bh * 0.72
      for (const wallX of [bx, bx + bw]) {
        const side = wallX === bx ? 1 : -1
        const wallPool = this.scene.add.graphics()
        wallPool.fillStyle(0x4a8aaa, 1)
        wallPool.fillTriangle(0, -10, 0, 10, side * 24, 0)
        wallPool.setPosition(wallX, sconceY)
        wallPool.setAlpha(initAlpha * 0.3)
        lightChildren.push(wallPool)
        const sconce = this.scene.add.sprite(wallX, sconceY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
          .setScale(0.25).setTint(0x4a8aaa).setAlpha(initAlpha)
        lightChildren.push(sconce)
      }

      const extLights = this.scene.add.container(0, 0, lightChildren)
      extLights.setDepth(-3.8)
      ;(atmosphere as { exteriorLights: Phaser.GameObjects.Container | null }).exteriorLights = extLights
    }
  }

  // ---------------------------------------------------------------------------
  // animateDecorations (private)
  // ---------------------------------------------------------------------------

  private animateDecorations(): void {
    const PLANT_FRAMES = new Set([
      OFFICE_FRAME_PLANT,
      OFFICE_FRAME_PLANT_TALL,
      OFFICE_FRAME_CACTUS,
      OFFICE_FRAME_HANGING_PLANT,
      OFFICE_FRAME_FERN,
      OFFICE_FRAME_MONSTERA,
    ])

    let waterCoolerSprite: Phaser.GameObjects.Sprite | null = null
    let bookcaseSprite: Phaser.GameObjects.Sprite | null = null

    for (const sprite of this.officeDecoSprites) {
      const frameNum: number = parseInt(String(sprite.frame.name), 10)

      if (PLANT_FRAMES.has(frameNum)) {
        const duration = 2500 + Math.random() * 1000
        const delay = Math.random() * 2000
        const tween = this.scene.tweens.add({
          targets: sprite,
          angle: { from: -2, to: 2 },
          duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay,
        })
        this.decoTweens.push(tween)
      } else if (frameNum === OFFICE_FRAME_BOOKSHELF) {
        bookcaseSprite = sprite
      } else if (frameNum === OFFICE_FRAME_WATER_COOLER) {
        waterCoolerSprite = sprite
      } else if (frameNum === OFFICE_FRAME_CLOCK) {
        const tween = this.scene.tweens.add({
          targets: sprite,
          angle: { from: -1, to: 1 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        this.decoTweens.push(tween)
      }
    }

    if (bookcaseSprite) {
      const shelf = bookcaseSprite
      const baseAlpha = shelf.alpha
      const tween = this.scene.tweens.add({
        targets: shelf,
        alpha: { from: baseAlpha, to: baseAlpha + 0.08 },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 1500 + Math.random() * 2000,
      })
      this.decoTweens.push(tween)
    }

    if (waterCoolerSprite) {
      const cooler = waterCoolerSprite
      const spawnBubbles = (): void => {
        if (!cooler.active) return
        const count = Math.random() < 0.5 ? 1 : 2
        for (let i = 0; i < count; i++) {
          const bubbleX = cooler.x + (Math.random() * 6 - 3)
          const bubbleY = cooler.y - (cooler.displayHeight * 0.35) - Math.random() * 2
          const bubble = this.scene.add.sprite(bubbleX, bubbleY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
            .setScale(0.14).setTint(0x7dd3fc).setAlpha(0.3).setDepth(-0.8)
          this.scene.tweens.add({
            targets: bubble,
            y: bubbleY - 8,
            alpha: 0,
            duration: 800,
            ease: 'Sine.easeOut',
            onComplete: () => { try { bubble.destroy() } catch { /* gone */ } },
          })
        }
        const nextDelay = 4000 + Math.random() * 2000
        this.waterCoolerBubbleTimer = this.scene.time.delayedCall(nextDelay, spawnBubbles)
      }
      this.waterCoolerBubbleTimer = this.scene.time.delayedCall(2000 + Math.random() * 3000, spawnBubbles)
    }
  }

  // ---------------------------------------------------------------------------
  // updateWhiteboardStats
  // ---------------------------------------------------------------------------

  updateWhiteboardStats(): void {
    if (!this.whiteboardContainer || this.whiteboardTexts.length < 3) return
    const [agentLine, activeLine, roomLine] = this.whiteboardTexts
    const agents = this.host.getAgents()
    const rooms = this.host.getRooms()
    const totalAgents = agents.length
    const activeAgents = agents.filter(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    ).length
    const totalRooms = rooms.size

    const flashChanged = (text: Phaser.GameObjects.Text, newVal: string) => {
      if (text.text === newVal) return
      text.setText(newVal)
      this.scene.tweens.killTweensOf(text)
      this.scene.tweens.add({
        targets: text, alpha: 1, duration: 150, ease: 'Sine.easeOut',
        onComplete: () => {
          if (text.active) this.scene.tweens.add({ targets: text, alpha: 0.7, duration: 400, ease: 'Sine.easeIn' })
        },
      })
    }

    flashChanged(agentLine, `Agents: ${totalAgents}`)
    flashChanged(roomLine, `Rooms: ${totalRooms}`)

    const newActiveText = `Active: ${activeAgents}`
    if (activeLine.text !== newActiveText) {
      activeLine.setText(newActiveText)
      activeLine.setColor(activeAgents > 0 ? '#34d399' : '#5a6a7a')
      this.scene.tweens.killTweensOf(activeLine)
      this.scene.tweens.add({
        targets: activeLine, alpha: 1, duration: 150, ease: 'Sine.easeOut',
        onComplete: () => {
          if (activeLine.active) this.scene.tweens.add({ targets: activeLine, alpha: 0.7, duration: 400, ease: 'Sine.easeIn' })
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // updateRoomActivity — updates room status LEDs, bars, heat overlay
  // ---------------------------------------------------------------------------

  updateRoomActivity(room: Room): void {
    // GDS mode — room chrome is hidden; skip activity bar/LED updates
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GDS_MEDIUM)) return
    const agents = room.agents
    if (agents.length === 0) return
    const waitingCount = agents.filter(a => a.needsInteraction).length
    const hasWaiting = agents.some(a => a.needsInteraction)
    const activeCount = agents.filter(a => a.needsInteraction || a.sessionMode === 'working' || a.sessionMode === 'plan').length

    const activeWidth = (activeCount / agents.length) * room.width
    const waitingWidth = (waitingCount / agents.length) * room.width
    room.activityBar.setFillStyle(0x34d399, hasWaiting ? 0.65 : 0.95)
    room.activityBar.setPosition(-room.width / 2, room.height / 2 + 1)
    room.waitingBar.setFillStyle(0xfbbf24, 0.95)
    room.waitingBar.setPosition(-room.width / 2, room.height / 2 - 1)
    if (room.activityBarTween) room.activityBarTween.destroy()
    if (room.waitingBarTween) room.waitingBarTween.destroy()
    room.activityBarTween = this.scene.tweens.add({ targets: room.activityBar, width: activeWidth, duration: 400, ease: 'Power2' })
    room.waitingBarTween = this.scene.tweens.add({ targets: room.waitingBar, width: waitingWidth, duration: 400, ease: 'Power2' })
    room.waitingBar.setAlpha(waitingCount > 0 ? 0.95 : 0.15)

    const ledMode: Room['ledMode'] = hasWaiting ? 'waiting' : activeCount > 0 ? 'active' : 'idle'
    if (room.ledMode !== ledMode) {
      room.ledMode = ledMode
      if (room.statusLedTween) {
        room.statusLedTween.destroy()
        room.statusLedTween = null
      }

      const ledFrame = ledMode === 'waiting' ? ICON_FRAMES.CIRCLE_YELLOW : ledMode === 'active' ? ICON_FRAMES.CIRCLE_GREEN : ICON_FRAMES.CIRCLE_GREY
      room.statusLed.setFrame(ledFrame)
      room.statusLedGlow.setFrame(ledFrame)

      if (ledMode === 'waiting') {
        room.statusLedGlow.setAlpha(0.18)
        room.statusLedTween = this.scene.tweens.add({
          targets: [room.statusLed, room.statusLedGlow],
          alpha: { from: 0.45, to: 1 },
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else if (ledMode === 'active') {
        room.statusLed.setAlpha(1)
        room.statusLedGlow.setAlpha(0.22)
      } else {
        room.statusLed.setAlpha(0.8)
        room.statusLedGlow.setAlpha(0.12)
      }
    }

    // Status strip
    if (room.statusStrip && room.statusStrip.active) {
      const WALL_T = 3
      const WALL_I = 1
      const floorW = room.width - (WALL_T + WALL_I) * 2
      const stripColor = hasWaiting ? 0xfbbf24 : activeCount > 0 ? 0x34d399 : activeTheme.wall
      const stripAlpha = hasWaiting ? 0.75 : activeCount > 0 ? 0.7 : 0.35
      const targetW = agents.length > 0
        ? Math.max(2, (activeCount / agents.length) * floorW)
        : 2
      const hBarX = -room.width / 2 + WALL_T + WALL_I
      const hBarY = room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H
      const stripY = hBarY - 3
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
      if (room.statusStripPulseTween) { room.statusStripPulseTween.destroy(); room.statusStripPulseTween = undefined }
      const stripProxy = { w: 0 }
      const sg = room.statusStrip
      room.statusStripTween = this.scene.tweens.add({
        targets: stripProxy,
        w: targetW,
        duration: 400,
        ease: 'Power2',
        onUpdate: () => {
          if (!sg || !sg.active) return
          sg.clear()
          sg.fillStyle(stripColor, stripAlpha)
          sg.fillRect(hBarX, stripY, stripProxy.w, 2)
        },
        onComplete: () => {
          // Subtle alpha pulse on the status strip when agents are active
          if (sg && sg.active && activeCount > 0) {
            room.statusStripPulseTween = this.scene.tweens.add({
              targets: sg,
              alpha: { from: 0.85, to: 1 },
              duration: 2500,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        },
      })
    }

    // Heat overlay
    if (room.heatOverlay) {
      const heat = agents.length > 0 ? activeCount / agents.length : 0
      const baseAlpha = heat * 0.06

      const heatColor = heat > 0.5
        ? lerpColor(0xfbbf24, 0xef4444, (heat - 0.5) * 2)
        : 0xfbbf24
      room.heatOverlay.setFillStyle(heatColor, room.heatOverlay.fillAlpha)

      if (room.heatTween) {
        room.heatTween.destroy()
        room.heatTween = undefined
      }
      // Kill any previous breathing tween so we can restart with the new base alpha
      if (room.heatBreathTween) {
        room.heatBreathTween.destroy()
        room.heatBreathTween = undefined
      }
      room.heatTween = this.scene.tweens.add({
        targets: room.heatOverlay,
        fillAlpha: baseAlpha,
        duration: 500,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Start a gentle breathing pulse once we've reached the base alpha
          if (room.heatOverlay && baseAlpha > 0.005 && !room.heatBreathTween) {
            room.heatBreathTween = this.scene.tweens.add({
              targets: room.heatOverlay,
              fillAlpha: { from: baseAlpha - 0.015, to: baseAlpha + 0.015 },
              duration: 3000,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // LOD visibility for whiteboard
  // ---------------------------------------------------------------------------

  applyLodToWhiteboard(lodLevel: number): void {
    if (this.whiteboardContainer) {
      this.whiteboardContainer.setVisible(lodLevel >= 3)
    }
  }

  // ---------------------------------------------------------------------------
  // initReactorGlow
  // ---------------------------------------------------------------------------

  initReactorGlow(
    reactorCenter: { x: number; y: number; rx: number; ry: number } | null,
  ): void {
    // Sync the reactor center from terrain
    this.reactorCenter = reactorCenter

    // Clean up previous
    if (this.reactorPulseTween) { this.reactorPulseTween.destroy(); this.reactorPulseTween = null }
    if (this.reactorGlowGfx) { this.reactorGlowGfx.destroy(); this.reactorGlowGfx = null }

    if (!this.reactorCenter) return

    const { x, y, rx, ry } = this.reactorCenter
    const gfx = this.scene.add.graphics().setDepth(-9.5)

    // Compact reactor glow — 2 rings, subtle
    gfx.fillStyle(0x00ff88, 0.04)
    gfx.fillEllipse(x, y, rx * 2, ry * 2)       // 1x — inner
    gfx.fillStyle(0x00ff88, 0.02)
    gfx.fillEllipse(x, y, rx * 3, ry * 3)       // 1.5x — outer

    this.reactorGlowGfx = gfx

    // Pulsing tween — subtle alpha oscillation
    this.reactorPulseTween = this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.5, to: 0.8 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  // ---------------------------------------------------------------------------
  // tickReactorGlow — call from OfficeScene update loop. Throttled to every 800ms.
  // ---------------------------------------------------------------------------

  tickReactorGlow(time: number): void {
    if (!this.reactorGlowGfx || !this.reactorCenter) return
    if (time - this.lastReactorTickAt < 800) return
    this.lastReactorTickAt = time

    const { x, y, rx, ry } = this.reactorCenter
    const gfx = this.reactorGlowGfx

    // Subtle churning modulation
    const churn = Math.sin(time * 0.001)
    const innerAlpha = 0.04 + churn * 0.015
    const outerAlpha = 0.02 + churn * 0.008

    gfx.clear()
    gfx.fillStyle(0x00ff88, innerAlpha)
    gfx.fillEllipse(x, y, rx * 2, ry * 2)
    gfx.fillStyle(0x00ff88, outerAlpha)
    gfx.fillEllipse(x, y, rx * 3, ry * 3)
  }

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const t of this.decoTweens) { try { t.destroy() } catch { /* gone */ } }
    this.decoTweens = []
    if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    if (this.whiteboardContainer) { this.whiteboardContainer.destroy(); this.whiteboardContainer = null; this.whiteboardTexts = [] }
    this.officeGraphics?.destroy()
    this.officeGraphics = null
    if (this.flagContainer) {
      this.scene.tweens.killTweensOf(this.flagContainer)
      this.flagContainer.destroy(true)
      this.flagContainer = null
    }
    if (this.reactorPulseTween) { this.reactorPulseTween.destroy(); this.reactorPulseTween = null }
    if (this.reactorGlowGfx) { this.reactorGlowGfx.destroy(); this.reactorGlowGfx = null }
    this.reactorCenter = null
  }
}
