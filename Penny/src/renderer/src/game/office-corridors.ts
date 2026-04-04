import Phaser from 'phaser'
import type { Room } from './office-types'
import { activeTheme } from './office-theme'
import { ROOM_GAP } from './office-constants'
import { SPRITESHEET_KEYS, ICON_FRAMES, PIPE_FRAMES, CABLE_FRAMES, LAB_TILESET_FRAMES } from './office-asset-keys'

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
  /** Per-dot speed multiplier for organic variation (±15%) */
  private hallwayDotSpeedMul: number[] = []
  /** Graphics layer for trailing particle effects behind flow dots */
  private trailGraphics: Phaser.GameObjects.Graphics | null = null
  /** Static arrow sprites placed at corridor segment endpoints */
  private endpointArrows: Phaser.GameObjects.Sprite[] = []
  /** Pipe, cable, and hazard stripe sprites placed along corridor paths */
  private pipeSprites: Phaser.GameObjects.GameObject[] = []
  /** PENPAL unified lab — skip corridor pipe/cable decals (zone seams). */
  private suppressCorridorPipeDecals = false

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
    // Trail graphics layer sits just behind the flow dots
    this.trailGraphics = this.scene.add.graphics().setDepth(-0.45)
  }

  // ---------------------------------------------------------------------------
  // drawCorridors
  // ---------------------------------------------------------------------------

  drawCorridors(roomList: Room[]): void {
    const g = this.corridorGraphics
    if (!g) return
    g.clear()
    this.corridorSegments = []
    this.suppressCorridorPipeDecals = false

    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    for (const s of this.junctionSprites) s.destroy()
    this.junctionSprites = []
    for (const s of this.pipeSprites) s.destroy()
    this.pipeSprites = []

    if (roomList.length < 2) {
      this.hallwayIndicatorGraphics?.clear()
      return
    }

    this.suppressCorridorPipeDecals =
      roomList.length > 0 && roomList.every(r => r.teamKey === '__lab__')

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

      const HALL_H = 20
      const HALL_FLOOR = 0x0f1520
      const HALL_STRIPE = 0x1a2535
      const HALL_EDGE = activeTheme.separator
      const LEG_W = 6
      const JUNC_W = 8
      const CHEVRON_GAP = 40

      // Lab mode: no sidewalk/pipe visuals — hazard tape + pipe sprites handle corridors.
      // Only keep the data segment and subtle guide elements.

      // Lab mode: skip old office-style rivets, chevrons, sidewalks, vertical legs.
      // Only build corridor segment data for nav-mesh + hallway flow dots.

      for (const room of rowRooms) {
        const doorY = this.host.getRoomDoorY(room) - 4
        // Only push corridor segment data — no visual elements
        this.corridorSegments.push({ x1: room.x, y1: doorY, x2: room.x, y2: hallY, color: lineColor })
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
            this.corridorSegments.push({ x1: fromX, y1: hallY, x2: toX, y2: hallY, color: activeTheme.wall })
            // Lab mode: no visual sidewalk/pipe — only segment data
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

    // Shared constants for connector walkway rendering (same as intra-team values)
    const C_HALL_H = 20
    const C_HALL_FLOOR = 0x0f1520
    const C_HALL_EDGE = activeTheme.separator
    const C_LEG_W = 6

    // Connect rows vertically (stairwell between row 1 and row 2)
    rowCenters.sort((a, b) => a.y - b.y)
    for (let i = 0; i < rowCenters.length - 1; i++) {
      const upper = rowCenters[i]
      const lower = rowCenters[i + 1]
      const connX = Math.min(upper.minX, lower.minX)
      this.corridorSegments.push({ x1: connX, y1: upper.y, x2: connX, y2: lower.y, color: activeTheme.wall })
      // Lab mode: segment data only — no visual sidewalk/pipe
    }

    // Connect service row (cafe) down to the first agent office row
    const cafeBounds = this.host.getCafe().getBounds()
    if (cafeBounds && rowCenters.length > 0) {
      const nearestRow = rowCenters[0]
      const serviceBottomY = cafeBounds.y + cafeBounds.h
      const connX = cafeBounds.x + cafeBounds.w / 2

      // Vertical corridor from cafe to agent row
      this.corridorSegments.push({ x1: connX, y1: serviceBottomY, x2: connX, y2: nearestRow.y, color: activeTheme.wall })
      // Lab mode: segment data only — no visual sidewalk/pipe/arrows

      // Horizontal leg to connect to the nearest team
      if (Math.abs(connX - nearestRow.minX) > 10) {
        this.corridorSegments.push({ x1: connX, y1: nearestRow.y, x2: nearestRow.minX, y2: nearestRow.y, color: activeTheme.wall })
        // Lab mode: segment data only
      }
    }

    // ── Direction arrows at corridor segment endpoints ──
    // Destroy previous arrows
    for (const a of this.endpointArrows) a.destroy()
    this.endpointArrows = []
    for (const seg of this.corridorSegments) {
      const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
      if (segLen < 30) continue // skip very short segments
      // Compute angle from start to end (Phaser angles are in degrees, 0 = right)
      const angleDeg = Phaser.Math.RadToDeg(Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1))
      // Arrow at the end of the segment, slightly inset
      const inset = 6
      const dx = (seg.x2 - seg.x1) / segLen
      const dy = (seg.y2 - seg.y1) / segLen
      const ax = seg.x2 - dx * inset
      const ay = seg.y2 - dy * inset
      const arrow = this.scene.add.sprite(ax, ay, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.ARROW_EAST)
        .setScale(0.22).setAlpha(0.15).setAngle(angleDeg).setDepth(-0.5).setTint(seg.color)
      this.endpointArrows.push(arrow)
    }

    // ── Lay pipe & cable tileset sprites along corridor segments ──
    this.placePipeSprites()

    // Sync updated corridor segments to the particle system
    this.host.setCorridorData(this.corridorSegments, false)
  }

  // ---------------------------------------------------------------------------
  // placePipeSprites — lay tileset pipe & cable sprites along corridors
  // ---------------------------------------------------------------------------

  private placePipeSprites(): void {
    // Destroy previous sprites
    for (const s of this.pipeSprites) s.destroy()
    this.pipeSprites = []

    // Guard: if the spritesheets aren't loaded yet, bail silently
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) return
    if (this.suppressCorridorPipeDecals) return

    const PIPE_SCALE = 0.25        // 128 * 0.25 = 32px effective
    const CABLE_SCALE = 0.22       // slightly smaller cables
    const PIPE_DEPTH = -1.5        // above floor, below room content
    const PIPE_ALPHA = 0.8
    const CABLE_ALPHA = 0.65
    const CABLE_OFFSET = 10        // px offset perpendicular to corridor
    const PIPE_SPACING = 40        // place a pipe tile every ~40px
    const HAZARD_W = 4             // hazard stripe width
    const HAZARD_SPACING = 8       // alternating stripe gap
    const HAZARD_ALPHA = 0.25
    const HAZARD_OFFSET = 8        // distance from corridor center to stripe

    // Build a set of junction points for corner/T detection
    const junctions = new Map<string, number>() // "x,y" -> count of segments touching it
    for (const seg of this.corridorSegments) {
      const k1 = `${Math.round(seg.x1)},${Math.round(seg.y1)}`
      const k2 = `${Math.round(seg.x2)},${Math.round(seg.y2)}`
      junctions.set(k1, (junctions.get(k1) || 0) + 1)
      junctions.set(k2, (junctions.get(k2) || 0) + 1)
    }

    for (const seg of this.corridorSegments) {
      const dx = seg.x2 - seg.x1
      const dy = seg.y2 - seg.y1
      const len = Math.hypot(dx, dy)
      if (len < 10) continue

      const isHoriz = Math.abs(dx) > Math.abs(dy)
      const nx = dx / len  // unit direction
      const ny = dy / len
      // Perpendicular for cable offset
      const px = -ny
      const py = nx

      // ── Pipe straight tiles along the segment ──
      const pipeFrame = isHoriz ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.VERT_ARROW
      const numTiles = Math.max(1, Math.floor(len / PIPE_SPACING))
      for (let i = 0; i < numTiles; i++) {
        const t = (i + 0.5) / numTiles
        const x = seg.x1 + dx * t
        const y = seg.y1 + dy * t

        const pipe = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PIPES, pipeFrame)
          .setScale(PIPE_SCALE)
          .setAlpha(PIPE_ALPHA)
          .setDepth(PIPE_DEPTH)
          .setTint(seg.color)
        // Rotate for non-axis-aligned segments (rare, but handle gracefully)
        if (!isHoriz && Math.abs(dx) > 1) {
          pipe.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)) - 90)
        }
        this.pipeSprites.push(pipe)
      }

      // ── Cable tiles alongside the pipe (offset by CABLE_OFFSET) ──
      if (this.scene.textures.exists(SPRITESHEET_KEYS.LAB_CABLES)) {
        const cableFrame = isHoriz ? CABLE_FRAMES.HORIZ_STRAIGHT : CABLE_FRAMES.WAVE_A
        const cableCount = Math.max(1, Math.floor(len / (PIPE_SPACING * 1.2)))
        for (let i = 0; i < cableCount; i++) {
          const t = (i + 0.5) / cableCount
          const x = seg.x1 + dx * t + px * CABLE_OFFSET
          const y = seg.y1 + dy * t + py * CABLE_OFFSET

          const cable = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_CABLES, cableFrame)
            .setScale(CABLE_SCALE)
            .setAlpha(CABLE_ALPHA)
            .setDepth(PIPE_DEPTH - 0.1)
          // Rotate vertical cables 90 degrees
          if (!isHoriz) cable.setAngle(90)
          this.pipeSprites.push(cable)
        }
      }

      // ── Junction connectors at segment endpoints ──
      const endKey = `${Math.round(seg.x2)},${Math.round(seg.y2)}`
      const endCount = junctions.get(endKey) || 0
      if (endCount >= 3) {
        // Cross or T at busy junctions
        const jFrame = endCount >= 4 ? PIPE_FRAMES.CROSS : PIPE_FRAMES.T_DOWN
        const junc = this.scene.add.sprite(seg.x2, seg.y2, SPRITESHEET_KEYS.LAB_PIPES, jFrame)
          .setScale(PIPE_SCALE * 1.1)
          .setAlpha(PIPE_ALPHA)
          .setDepth(PIPE_DEPTH + 0.1)
          .setTint(seg.color)
        this.pipeSprites.push(junc)
      } else if (endCount === 1) {
        // Dead-end cap
        const cap = this.scene.add.sprite(seg.x2, seg.y2, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.CAP_TOP)
          .setScale(PIPE_SCALE * 0.9)
          .setAlpha(PIPE_ALPHA * 0.8)
          .setDepth(PIPE_DEPTH + 0.1)
          .setTint(seg.color)
        // Rotate cap to face the direction of the segment
        cap.setAngle(Phaser.Math.RadToDeg(Math.atan2(ny, nx)))
        this.pipeSprites.push(cap)
      }

      // ── Valve wheel accent at segment midpoint (only on longer runs) ──
      if (len > 120) {
        const vx = seg.x1 + dx * 0.5
        const vy = seg.y1 + dy * 0.5
        const valve = this.scene.add.sprite(vx, vy, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.VALVE)
          .setScale(PIPE_SCALE * 0.7)
          .setAlpha(PIPE_ALPHA * 0.6)
          .setDepth(PIPE_DEPTH + 0.2)
        this.pipeSprites.push(valve)
      }

      // ── Hazard stripes along corridor edges ──
      const stripeCount = Math.floor(len / HAZARD_SPACING)
      for (let i = 0; i < stripeCount; i++) {
        const t = (i + 0.5) / stripeCount
        const cx = seg.x1 + dx * t
        const cy = seg.y1 + dy * t
        const isYellow = i % 2 === 0
        const stripeColor = isYellow ? 0xf59e0b : 0x1f2937

        // Top/left edge stripe
        const s1x = cx + px * HAZARD_OFFSET
        const s1y = cy + py * HAZARD_OFFSET
        const stripe1 = this.scene.add.rectangle(s1x, s1y, HAZARD_W, HAZARD_W, stripeColor, HAZARD_ALPHA)
          .setDepth(PIPE_DEPTH - 0.2)
        this.pipeSprites.push(stripe1)

        // Bottom/right edge stripe
        const s2x = cx - px * HAZARD_OFFSET
        const s2y = cy - py * HAZARD_OFFSET
        const stripe2 = this.scene.add.rectangle(s2x, s2y, HAZARD_W, HAZARD_W, stripeColor, HAZARD_ALPHA)
          .setDepth(PIPE_DEPTH - 0.2)
        this.pipeSprites.push(stripe2)
      }
    }

    // ── Corner elbows where two perpendicular segments meet ──
    // Find points shared by exactly 2 segments where one is horizontal and the other vertical
    const pointSegments = new Map<string, Array<{ seg: typeof this.corridorSegments[0]; isStart: boolean }>>()
    for (const seg of this.corridorSegments) {
      const k1 = `${Math.round(seg.x1)},${Math.round(seg.y1)}`
      const k2 = `${Math.round(seg.x2)},${Math.round(seg.y2)}`
      if (!pointSegments.has(k1)) pointSegments.set(k1, [])
      pointSegments.get(k1)!.push({ seg, isStart: true })
      if (!pointSegments.has(k2)) pointSegments.set(k2, [])
      pointSegments.get(k2)!.push({ seg, isStart: false })
    }

    for (const [key, entries] of pointSegments) {
      if (entries.length !== 2) continue
      const [a, b] = entries
      const aDx = a.seg.x2 - a.seg.x1
      const aDy = a.seg.y2 - a.seg.y1
      const bDx = b.seg.x2 - b.seg.x1
      const bDy = b.seg.y2 - b.seg.y1
      const aHoriz = Math.abs(aDx) > Math.abs(aDy)
      const bHoriz = Math.abs(bDx) > Math.abs(bDy)
      if (aHoriz === bHoriz) continue // both same orientation, not a corner

      // Determine which elbow frame based on directions
      const [cx, cy] = key.split(',').map(Number)

      // Determine direction of each segment away from this corner point
      const aAway = a.isStart
        ? { dx: aDx, dy: aDy }
        : { dx: -aDx, dy: -aDy }
      const bAway = b.isStart
        ? { dx: bDx, dy: bDy }
        : { dx: -bDx, dy: -bDy }

      // Pick elbow frame: TL when going right+down, TR when going left+down, etc.
      const goesRight = (aHoriz ? aAway.dx : bAway.dx) > 0
      const goesDown = (aHoriz ? bAway.dy : aAway.dy) > 0
      let elbowFrame: number
      if (goesRight && goesDown) elbowFrame = PIPE_FRAMES.CORNER_TL
      else if (!goesRight && goesDown) elbowFrame = PIPE_FRAMES.CORNER_TR
      else if (goesRight && !goesDown) elbowFrame = PIPE_FRAMES.CORNER_BL
      else elbowFrame = PIPE_FRAMES.CORNER_BR

      const elbow = this.scene.add.sprite(cx, cy, SPRITESHEET_KEYS.LAB_PIPES, elbowFrame)
        .setScale(PIPE_SCALE)
        .setAlpha(PIPE_ALPHA * 0.9)
        .setDepth(PIPE_DEPTH + 0.15)
        .setTint(a.seg.color)
      this.pipeSprites.push(elbow)
    }
  }

  // ---------------------------------------------------------------------------
  // drawHallwayIndicators
  // ---------------------------------------------------------------------------

  drawHallwayIndicators(timeMs: number): void {
    // Clear legacy Graphics layer (sprites handle rendering now)
    this.hallwayIndicatorGraphics?.clear()
    // Clear trail graphics each frame — redrawn below
    this.trailGraphics?.clear()

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

    // Grow pools if needed (including per-dot speed multiplier)
    while (this.hallwayDotPool.length < needed) {
      const glow = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.30).setAlpha(0.2).setDepth(-0.4).setVisible(false)
      this.hallwayDotGlowPool.push(glow)
      const core = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.18).setAlpha(0.6).setDepth(-0.3).setVisible(false).setTint(0xcbd5e1)
      this.hallwayDotPool.push(core)
      // Random speed multiplier: 0.85 to 1.15 (±15%)
      this.hallwayDotSpeedMul.push(0.85 + Math.random() * 0.3)
    }

    const tg = this.trailGraphics
    const BASE_SPEED = 0.00042

    let idx = 0
    for (let i = 0; i < this.corridorSegments.length; i++) {
      const seg = this.corridorSegments[i]
      const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
      if (len < 1) continue

      const speedMul = this.hallwayDotSpeedMul[idx] ?? 1
      const speed = BASE_SPEED * speedMul
      const t = (timeMs * speed + i * 0.173) % 1
      const px = Phaser.Math.Linear(seg.x1, seg.x2, t)
      const py = Phaser.Math.Linear(seg.y1, seg.y2, t)

      // ── Trailing particle effect (fading circles behind the dot) ──
      if (tg) {
        // Direction vector along the segment (normalized)
        const dx = (seg.x2 - seg.x1) / len
        const dy = (seg.y2 - seg.y1) / len
        // Draw 3 trailing circles with decreasing alpha and size
        for (let trail = 1; trail <= 3; trail++) {
          const trailX = px - dx * trail * 3
          const trailY = py - dy * trail * 3
          tg.fillStyle(seg.color, 0.1 / trail)
          tg.fillCircle(trailX, trailY, 2 - trail * 0.3)
        }
      }

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
    this.hallwayDotSpeedMul = []
    this.trailGraphics?.clear()
    for (const a of this.endpointArrows) a.destroy()
    this.endpointArrows = []
    for (const s of this.pipeSprites) s.destroy()
    this.pipeSprites = []
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
    this.trailGraphics?.destroy()
    this.trailGraphics = null
    this.corridorSegments = []
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    for (const s of this.junctionSprites) s.destroy()
    this.junctionSprites = []
    for (const s of this.hallwayDotPool) s.destroy()
    this.hallwayDotPool = []
    for (const s of this.hallwayDotGlowPool) s.destroy()
    this.hallwayDotGlowPool = []
    this.hallwayDotSpeedMul = []
    for (const a of this.endpointArrows) a.destroy()
    this.endpointArrows = []
    for (const s of this.pipeSprites) s.destroy()
    this.pipeSprites = []
  }
}
