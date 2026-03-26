import Phaser from 'phaser'
import type { Room } from './office-types'
import { activeTheme } from './office-theme'
import { ROOM_GAP } from './office-constants'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Host interface — what OfficeCorridors needs from OfficeScene
// ---------------------------------------------------------------------------

export interface CorridorHostScene {
  getTeamColor(teamKey: string): number
  getRoomDoorY(room: Room): number
  setCorridorData(
    segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }>,
    hasActive: boolean,
  ): void
  getCafe(): {
    getBounds(): { x: number; y: number; w: number; h: number } | null
  }
}

// ---------------------------------------------------------------------------
// OfficeCorridors
// Owns: corridor graphics, hallway indicators, floor arrows, corridor sign texts.
// ---------------------------------------------------------------------------

export class OfficeCorridors {
  private scene: Phaser.Scene
  private host: CorridorHostScene

  private corridorGraphics: Phaser.GameObjects.Graphics | null = null
  private hallwayIndicatorGraphics: Phaser.GameObjects.Graphics | null = null
  private floorArrowGfx: Phaser.GameObjects.Graphics | null = null

  corridorSegments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> = []
  private corridorSignTexts: Phaser.GameObjects.Text[] = []
  /** Sprite-based junction dots, rivets, and arrow indicators placed during drawCorridors */
  private junctionSprites: Phaser.GameObjects.Sprite[] = []
  /** Sprite pool for animated hallway indicator dots (data-flow traffic) */
  private hallwayDotPool: Phaser.GameObjects.Sprite[] = []
  private hallwayDotGlowPool: Phaser.GameObjects.Sprite[] = []

  lastFloorArrowAt = 0

  constructor(scene: Phaser.Scene, host: CorridorHostScene) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Init — caller passes in the pre-created graphics layers
  // ---------------------------------------------------------------------------

  init(
    corridorGraphics: Phaser.GameObjects.Graphics,
    hallwayIndicatorGraphics: Phaser.GameObjects.Graphics,
    floorArrowGfx: Phaser.GameObjects.Graphics,
  ): void {
    this.corridorGraphics = corridorGraphics
    this.hallwayIndicatorGraphics = hallwayIndicatorGraphics
    this.floorArrowGfx = floorArrowGfx
  }

  // ---------------------------------------------------------------------------
  // drawCorridors
  // ---------------------------------------------------------------------------

  drawCorridors(roomList: Room[]): void {
    const g = this.corridorGraphics
    if (!g) return
    g.clear()
    this.corridorSegments = []

    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    for (const s of this.junctionSprites) s.destroy()
    this.junctionSprites = []

    if (roomList.length < 2) {
      this.hallwayIndicatorGraphics?.clear()
      return
    }

    const rows = new Map<string, { teamKey: string; rowTop: number; rooms: Room[] }>()
    for (const room of roomList) {
      const rowTop = Math.round(room.y - room.height / 2)
      const rowKey = `${room.teamKey}|${rowTop}`
      if (!rows.has(rowKey)) rows.set(rowKey, { teamKey: room.teamKey, rowTop, rooms: [] })
      rows.get(rowKey)!.rooms.push(room)
    }

    const sortedRows = Array.from(rows.values()).sort((a, b) => {
      if (a.rowTop !== b.rowTop) return a.rowTop - b.rowTop
      return a.teamKey.localeCompare(b.teamKey)
    })
    for (const row of sortedRows) {
      const rowRooms = row.rooms
      if (rowRooms.length < 2) continue
      rowRooms.sort((a, b) => a.x - b.x)

      const doorSide = rowRooms[0].doorSide
      const maxBottom = Math.max(...rowRooms.map(r => r.y + r.height / 2))
      const minTop = Math.min(...rowRooms.map(r => r.y - r.height / 2))
      const hallY = doorSide === 'top'
        ? minTop - ROOM_GAP * 0.45
        : maxBottom + ROOM_GAP * 0.45

      const minX = rowRooms[0].x
      const maxX = rowRooms[rowRooms.length - 1].x
      const lineColor = this.host.getTeamColor(row.teamKey)
      const hallWidth = maxX - minX

      this.corridorSegments.push({ x1: minX, y1: hallY, x2: maxX, y2: hallY, color: lineColor })

      const HALL_H = 12
      const HALL_FLOOR = 0x0f1520
      const HALL_STRIPE = 0x1a2535
      const HALL_EDGE = 0x1e2830
      const LEG_W = 6
      const JUNC_W = 8
      const CHEVRON_GAP = 40

      g.fillStyle(HALL_FLOOR, 0.72)
      g.fillRect(minX - LEG_W / 2, hallY - HALL_H / 2, hallWidth + LEG_W, HALL_H)

      g.fillStyle(HALL_STRIPE, 0.85)
      g.fillRect(minX - LEG_W / 2, hallY - 1, hallWidth + LEG_W, 2)

      g.fillStyle(HALL_EDGE, 0.9)
      g.fillRect(minX - LEG_W / 2, hallY - HALL_H / 2, hallWidth + LEG_W, 1)
      g.fillRect(minX - LEG_W / 2, hallY + HALL_H / 2 - 1, hallWidth + LEG_W, 1)

      // ── Industrial pipe shading — 3D cylindrical effect ──
      // Highlight stripe along top edge
      g.fillStyle(0x5a6a7a, 0.25)
      g.fillRect(minX - LEG_W / 2, hallY - HALL_H / 2 + 1, hallWidth + LEG_W, 3)
      // Darker bottom edge
      g.fillStyle(0x0a0e14, 0.3)
      g.fillRect(minX - LEG_W / 2, hallY + HALL_H / 2 - 4, hallWidth + LEG_W, 3)

      // ── Rivets/bolts along main corridor runs (sprite-based) ──
      for (let rx = minX; rx <= maxX; rx += 50) {
        const rivetTop = this.scene.add.sprite(rx, hallY - HALL_H / 2 + 3, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
          .setScale(0.10).setAlpha(0.3).setDepth(-0.5).setTint(0x4a5a6a)
        this.junctionSprites.push(rivetTop)
        const rivetBot = this.scene.add.sprite(rx, hallY + HALL_H / 2 - 3, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
          .setScale(0.10).setAlpha(0.3).setDepth(-0.5).setTint(0x4a5a6a)
        this.junctionSprites.push(rivetBot)
      }

      const chevronSize = 3
      g.lineStyle(1, lineColor, 0.12)
      const numChevrons = Math.floor(hallWidth / CHEVRON_GAP)
      for (let ci = 0; ci <= numChevrons; ci++) {
        const cx = minX + ci * CHEVRON_GAP

        const uyMid = hallY - 3.5
        g.beginPath()
        g.moveTo(cx - chevronSize, uyMid - chevronSize)
        g.lineTo(cx, uyMid)
        g.lineTo(cx - chevronSize, uyMid + chevronSize)
        g.strokePath()

        const lyMid = hallY + 3.5
        g.beginPath()
        g.moveTo(cx + chevronSize, lyMid - chevronSize)
        g.lineTo(cx, lyMid)
        g.lineTo(cx + chevronSize, lyMid + chevronSize)
        g.strokePath()
      }

      for (const room of rowRooms) {
        const doorY = this.host.getRoomDoorY(room) - 4
        const legTop = Math.min(doorY, hallY - HALL_H / 2)
        const legBot = Math.max(doorY, hallY + HALL_H / 2)

        if (legBot > legTop) {
          g.fillStyle(HALL_FLOOR, 0.72)
          g.fillRect(room.x - LEG_W / 2, legTop, LEG_W, legBot - legTop)
          g.fillStyle(HALL_EDGE, 0.9)
          g.fillRect(room.x - LEG_W / 2, legTop, 1, legBot - legTop)
          g.fillRect(room.x + LEG_W / 2 - 1, legTop, 1, legBot - legTop)
          // ── Vertical leg pipe shading ──
          g.fillStyle(0x5a6a7a, 0.25)
          g.fillRect(room.x - LEG_W / 2 + 1, legTop, 3, legBot - legTop)
          g.fillStyle(0x0a0e14, 0.3)
          g.fillRect(room.x + LEG_W / 2 - 4, legTop, 3, legBot - legTop)
          // Rivets along vertical legs (sprite-based)
          for (let ry = legTop; ry <= legBot; ry += 50) {
            const rivetL = this.scene.add.sprite(room.x - LEG_W / 2 + 3, ry, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
              .setScale(0.10).setAlpha(0.3).setDepth(-0.5).setTint(0x4a5a6a)
            this.junctionSprites.push(rivetL)
            const rivetR = this.scene.add.sprite(room.x + LEG_W / 2 - 3, ry, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
              .setScale(0.10).setAlpha(0.3).setDepth(-0.5).setTint(0x4a5a6a)
            this.junctionSprites.push(rivetR)
          }
        }

        g.fillStyle(HALL_FLOOR, 0.88)
        g.fillRect(room.x - JUNC_W / 2, hallY - HALL_H / 2, JUNC_W, HALL_H)
        g.fillStyle(HALL_EDGE, 0.9)
        g.fillRect(room.x - JUNC_W / 2, hallY - HALL_H / 2, JUNC_W, 1)
        g.fillRect(room.x - JUNC_W / 2, hallY + HALL_H / 2 - 1, JUNC_W, 1)

        // ── Pipe collar/flange at junction ──
        g.fillStyle(0x4a5a6a, 0.3)
        g.fillRect(room.x - (JUNC_W + 8) / 2, hallY - 3, JUNC_W + 8, 6)

        // Junction status dot — sprite-based green circle instead of Graphics fillCircle
        const juncDot = this.scene.add.sprite(room.x, hallY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
          .setScale(0.10)
          .setAlpha(0.25)
          .setDepth(-0.5)
        this.junctionSprites.push(juncDot)

        // Directional arrow sprite pointing from corridor toward the room door
        const arrowY = doorSide === 'top'
          ? hallY - HALL_H / 2 - 6
          : hallY + HALL_H / 2 + 6
        const arrowAngle = doorSide === 'top' ? -90 : 90
        const arrowSprite = this.scene.add.sprite(room.x, arrowY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.ARROW_EAST)
          .setScale(0.12)
          .setAlpha(0.18)
          .setAngle(arrowAngle)
          .setDepth(-0.5)
        this.junctionSprites.push(arrowSprite)

        this.corridorSegments.push({ x1: room.x, y1: doorY, x2: room.x, y2: hallY, color: lineColor })

        const rawLabel = room.label || room.cwd.split('/').pop() || '?'
        const signLabel = rawLabel.length > 6 ? rawLabel.slice(0, 5) + '.' : rawLabel
        const signCharW = 4
        const signW = signLabel.length * signCharW + 6
        const signH = 8
        const signX = room.x - signW / 2
        const signY = hallY - HALL_H / 2 - signH - 2

        g.fillStyle(0x0a0e14, 0.82)
        g.fillRect(signX, signY, signW, signH)
        g.lineStyle(1, lineColor, 0.28)
        g.strokeRect(signX, signY, signW, signH)

        const signText = this.scene.add.text(room.x, signY + signH / 2, signLabel, {
          fontSize: '5px',
          fontFamily: 'monospace',
          color: '#8a96a4',
          resolution: 2,
        })
        signText.setOrigin(0.5, 0.5)
        signText.setDepth(-1)
        this.corridorSignTexts.push(signText)
      }
    }

    // Inter-team corridors: connect adjacent team buildings on the same visual row
    // and connect rows vertically so agents can walk between teams.
    const teamsByRow = new Map<number, { teamKey: string; cx: number; hallY: number }[]>()
    for (const room of roomList) {
      const rowKey = Math.round(room.y / 100) * 100
      if (!teamsByRow.has(rowKey)) teamsByRow.set(rowKey, [])
      const entry = teamsByRow.get(rowKey)!
      // One entry per team per row — use hallY above rooms, not doorY at room edge
      if (!entry.some(e => e.teamKey === room.teamKey)) {
        const roomTop = room.y - room.height / 2
        entry.push({ teamKey: room.teamKey, cx: room.x, hallY: roomTop - ROOM_GAP * 0.45 })
      }
    }

    // For each row, connect adjacent teams with a horizontal corridor
    const rowCenters: { rowKey: number; y: number; minX: number; maxX: number }[] = []
    for (const [rowKey, teams] of teamsByRow) {
      teams.sort((a, b) => a.cx - b.cx)
      if (teams.length >= 2) {
        const hallY = teams[0].hallY
        for (let i = 0; i < teams.length - 1; i++) {
          const fromX = teams[i].cx
          const toX = teams[i + 1].cx
          // Only add if not already covered by an intra-team corridor
          const alreadyConnected = this.corridorSegments.some(s =>
            Math.abs(s.y1 - hallY) < 20 && s.x1 <= fromX && s.x2 >= toX
          )
          if (!alreadyConnected) {
            this.corridorSegments.push({ x1: fromX, y1: hallY, x2: toX, y2: hallY, color: 0x2a3440 })
            // Draw the connector visually
            g.fillStyle(0x0f1520, 0.5)
            g.fillRect(fromX, hallY - 4, toX - fromX, 8)
            g.fillStyle(0x1a2535, 0.6)
            g.fillRect(fromX, hallY - 1, toX - fromX, 2)
          }
        }
        rowCenters.push({
          rowKey,
          y: hallY,
          minX: teams[0].cx,
          maxX: teams[teams.length - 1].cx,
        })
      } else if (teams.length === 1) {
        rowCenters.push({
          rowKey,
          y: teams[0].hallY,
          minX: teams[0].cx,
          maxX: teams[0].cx,
        })
      }
    }

    // Connect rows vertically (stairwell between row 1 and row 2)
    rowCenters.sort((a, b) => a.y - b.y)
    for (let i = 0; i < rowCenters.length - 1; i++) {
      const upper = rowCenters[i]
      const lower = rowCenters[i + 1]
      // Vertical connector at the leftmost team X
      const connX = Math.min(upper.minX, lower.minX)
      this.corridorSegments.push({ x1: connX, y1: upper.y, x2: connX, y2: lower.y, color: 0x2a3440 })
      g.fillStyle(0x0f1520, 0.5)
      g.fillRect(connX - 4, upper.y, 8, lower.y - upper.y)
      g.fillStyle(0x1a2535, 0.6)
      g.fillRect(connX - 1, upper.y, 2, lower.y - upper.y)
    }

    // Connect service row down to the first agent office row
    const cafeBounds = this.host.getCafe().getBounds()
    if (cafeBounds && rowCenters.length > 0) {
      const nearestRow = rowCenters[0]
      const serviceBottomY = cafeBounds.y + cafeBounds.h
      const connX = cafeBounds.x + cafeBounds.w / 2
      // Vertical corridor from service row bottom to agent row corridor
      this.corridorSegments.push({ x1: connX, y1: serviceBottomY, x2: connX, y2: nearestRow.y, color: 0x2a3440 })
      // Horizontal leg to connect to the nearest team
      if (Math.abs(connX - nearestRow.minX) > 10) {
        this.corridorSegments.push({ x1: connX, y1: nearestRow.y, x2: nearestRow.minX, y2: nearestRow.y, color: 0x2a3440 })
      }
    }

    // Sync updated corridor segments to the particle system
    this.host.setCorridorData(this.corridorSegments, false)
  }

  // ---------------------------------------------------------------------------
  // drawHallwayIndicators
  // ---------------------------------------------------------------------------

  drawHallwayIndicators(timeMs: number): void {
    // Clear legacy Graphics layer (sprites handle rendering now)
    this.hallwayIndicatorGraphics?.clear()

    if (this.corridorSegments.length === 0) {
      // Hide all pooled sprites when no segments
      for (const s of this.hallwayDotPool) s.setVisible(false)
      for (const s of this.hallwayDotGlowPool) s.setVisible(false)
      return
    }

    // Count how many segments actually need a dot
    let needed = 0
    for (const seg of this.corridorSegments) {
      if (Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) >= 1) needed++
    }

    // Grow pools if needed
    while (this.hallwayDotPool.length < needed) {
      const glow = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.14).setAlpha(0.2).setDepth(-0.4).setVisible(false)
      this.hallwayDotGlowPool.push(glow)
      const core = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.08).setAlpha(0.6).setDepth(-0.3).setVisible(false).setTint(0xcbd5e1)
      this.hallwayDotPool.push(core)
    }

    let idx = 0
    for (let i = 0; i < this.corridorSegments.length; i++) {
      const seg = this.corridorSegments[i]
      const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
      if (len < 1) continue
      const speed = 0.00042
      const t = (timeMs * speed + i * 0.173) % 1
      const px = Phaser.Math.Linear(seg.x1, seg.x2, t)
      const py = Phaser.Math.Linear(seg.y1, seg.y2, t)

      // Outer glow — tinted to segment color
      const glow = this.hallwayDotGlowPool[idx]
      glow.setPosition(px, py).setVisible(true).setTint(seg.color).setAlpha(0.2)
      // Inner bright core
      const core = this.hallwayDotPool[idx]
      core.setPosition(px, py).setVisible(true)
      idx++
    }

    // Hide unused pool sprites
    for (let j = idx; j < this.hallwayDotPool.length; j++) {
      this.hallwayDotPool[j].setVisible(false)
      this.hallwayDotGlowPool[j].setVisible(false)
    }
  }

  // ---------------------------------------------------------------------------
  // drawFloorArrows
  // ---------------------------------------------------------------------------

  drawFloorArrows(time: number, rooms: Map<string, Room>): void {
    const g = this.floorArrowGfx
    if (!g) return
    g.clear()

    const activeRooms: Room[] = []
    for (const room of rooms.values()) {
      const hasWorking = room.agents.some(
        (a) => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
      )
      if (hasWorking) activeRooms.push(room)
    }
    if (activeRooms.length === 0) return

    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    const entranceX = (minX + maxX) / 2
    const entranceY = maxY + 20

    const ARROW_SPACING = 20
    const CHEVRON_W = 3
    const CHEVRON_L = 5
    const arrowColor = activeTheme.doorFrame

    for (const room of activeRooms) {
      const doorX = room.x
      const doorY = this.host.getRoomDoorY(room)
      const ddx = doorX - entranceX
      const ddy = doorY - entranceY
      const totalDist = Math.hypot(ddx, ddy)
      if (totalDist < 1) continue
      const nx = ddx / totalDist
      const ny = ddy / totalDist
      const perpX = -ny
      const perpY = nx
      const stopDist = totalDist - room.height / 2 - 4
      if (stopDist < ARROW_SPACING) continue

      for (let d = ARROW_SPACING; d <= stopDist; d += ARROW_SPACING) {
        const tipX = entranceX + nx * d
        const tipY = entranceY + ny * d
        const baseX = tipX - nx * CHEVRON_L
        const baseY = tipY - ny * CHEVRON_L
        const lx = baseX - perpX * CHEVRON_W
        const ly = baseY - perpY * CHEVRON_W
        const rx = baseX + perpX * CHEVRON_W
        const ry = baseY + perpY * CHEVRON_W
        const distFromRoom = totalDist - d
        const alpha = 0.04 + 0.06 * Math.sin(time * 0.003 + distFromRoom * 0.05)
        if (alpha <= 0) continue
        g.lineStyle(0.8, arrowColor, alpha)
        g.beginPath()
        g.moveTo(lx, ly)
        g.lineTo(tipX, tipY)
        g.lineTo(rx, ry)
        g.strokePath()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // clearFloorArrows
  // ---------------------------------------------------------------------------

  clearFloorArrows(): void {
    this.floorArrowGfx?.clear()
  }

  // ---------------------------------------------------------------------------
  // clearCorridors — used when room list is empty
  // ---------------------------------------------------------------------------

  clearCorridors(): void {
    this.corridorGraphics?.clear()
    this.corridorSegments = []
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    for (const s of this.junctionSprites) s.destroy()
    this.junctionSprites = []
    for (const s of this.hallwayDotPool) s.destroy()
    this.hallwayDotPool = []
    for (const s of this.hallwayDotGlowPool) s.destroy()
    this.hallwayDotGlowPool = []
  }

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.corridorGraphics?.destroy()
    this.corridorGraphics = null
    this.hallwayIndicatorGraphics?.destroy()
    this.hallwayIndicatorGraphics = null
    this.floorArrowGfx?.destroy()
    this.floorArrowGfx = null
    this.corridorSegments = []
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    for (const s of this.junctionSprites) s.destroy()
    this.junctionSprites = []
    for (const s of this.hallwayDotPool) s.destroy()
    this.hallwayDotPool = []
    for (const s of this.hallwayDotGlowPool) s.destroy()
    this.hallwayDotGlowPool = []
  }
}
