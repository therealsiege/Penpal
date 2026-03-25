import Phaser from 'phaser'
import type { Room, TeamAreaLayout } from './office-types'
import type { AgentState } from '../types'
import { activeTheme } from './office-theme'
import { lerpColor } from './office-theme'
import {
  OFFICE_FRAME_PLANT, OFFICE_FRAME_PLANT_SM, OFFICE_FRAME_PICTURE,
  OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3, OFFICE_FRAME_BOOKSHELF,
  OFFICE_FRAME_PLANT_TALL, OFFICE_FRAME_CACTUS, OFFICE_FRAME_HANGING_PLANT,
  OFFICE_FRAME_FERN, OFFICE_FRAME_MONSTERA, OFFICE_FRAME_CLOCK,
  OFFICE_FRAME_LAMP, OFFICE_FRAME_TRASH, OFFICE_FRAME_STORAGE,
  OFFICE_FRAME_FILE_CABINET, OFFICE_FRAME_WATER_COOLER, OFFICE_FRAME_WHITEBOARD,
  OFFICE_FRAME_MONITOR, OFFICE_FRAME_SOFA, OFFICE_FRAME_PRINTER,
  WORKSTATION_W, WORKSTATION_H, ROOM_PADDING, ROOM_TOP_EXTRA,
  ROOM_HEADER_H, ROOM_GAP, MAX_AGENTS_PER_ROW,
  TEAM_AREA_PAD_X, TEAM_AREA_PAD_Y, TEAM_AREA_GAP_X, TEAM_AREA_GAP_Y, TEAM_LABEL_H,
  COLOR_WALL, COLOR_BG,
  COLOR_LED_GREEN, COLOR_LED_AMBER, COLOR_LED_GRAY,
  WORLD_MARGIN, LOD_L1_MAX,
} from './office-constants'

// ---------------------------------------------------------------------------
// Host interface — what OfficeBackground needs from OfficeScene
// ---------------------------------------------------------------------------

export interface BackgroundHostScene {
  // Data accessors
  getRooms(): Map<string, Room>
  getAgents(): AgentState[]
  getViewWidth(): number
  isOfficeTilesLoaded(): boolean
  getLastLodLevel(): number
  getWorldSize(): { worldWidth: number; worldHeight: number }

  // Helper methods kept in OfficeScene
  getTeamColor(teamKey: string): number
  hashToken(value: string): number
  formatLabel(label: string): string
  getRoomDoorY(room: Room): number
  drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void
  refreshRoomHeaderText(room: Room): void
  drawDoorPanel(room: Room, floorW: number, accentColor: number): void
  getTeamInfo(cwd: string): { key: string; label: string }

  // Callbacks after layout
  rebuildNavMesh(): void
  updateCameraBounds(): void
  setWorldSize(w: number, h: number): void
  markPodsDirty(): void

  // Particles
  setCorridorData(segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }>, hasActive: boolean): void

  // Atmosphere
  getAtmosphere(): {
    windowPositions: { x: number; y: number; w: number; h: number }[]
    currentTimePhase: string
    wallClockContainer: Phaser.GameObjects.Container | null
    exteriorLights: Phaser.GameObjects.Container | null
    destroyCeilingLights(): void
  }

  // Cafe
  getCafe(): {
    width: number
    height: number
    build(x: number, y: number): void
    getBounds(): { x: number; y: number; w: number; h: number } | null
  }

  // Cafe floor mask management
  getCafeFloorMask(): Phaser.GameObjects.Graphics | null
  setCafeFloorMask(g: Phaser.GameObjects.Graphics | null): void
}

// ---------------------------------------------------------------------------
// OfficeBackground
// Owns: graphics layers, decorations, corridors, whiteboard, team-area labels,
//       and the master layoutRooms / drawOfficeBackground orchestration.
// ---------------------------------------------------------------------------

export class OfficeBackground {
  private scene: Phaser.Scene
  private host: BackgroundHostScene

  // Graphics layers
  private terrainGraphics: Phaser.GameObjects.Graphics | null = null
  private terrainDecos: Phaser.GameObjects.GameObject[] = []
  private lastTerrainW = 0
  private lastTerrainH = 0
  private officeGraphics: Phaser.GameObjects.Graphics | null = null
  private teamAreaGraphics: Phaser.GameObjects.Graphics | null = null
  private corridorGraphics: Phaser.GameObjects.Graphics | null = null
  private hallwayIndicatorGraphics: Phaser.GameObjects.Graphics | null = null
  private floorArrowGfx: Phaser.GameObjects.Graphics | null = null
  private lastFloorArrowAt = 0

  // Decorations
  private officeDecoSprites: Phaser.GameObjects.Sprite[] = []
  private seasonalDecos: Phaser.GameObjects.GameObject[] = []
  private decoTweens: Phaser.Tweens.Tween[] = []
  private waterCoolerBubbleTimer: Phaser.Time.TimerEvent | null = null

  // Whiteboard
  private whiteboardContainer: Phaser.GameObjects.Container | null = null
  private whiteboardTexts: Phaser.GameObjects.Text[] = []
  private lastWhiteboardUpdateAt = 0

  // Team area labels
  private teamAreaLabels: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = []

  // Corridors
  private corridorSegments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> = []
  private corridorSignTexts: Phaser.GameObjects.Text[] = []

  // Background cache dimensions
  private lastOfficeBgW = 0
  private lastOfficeBgH = 0

  // Flag container
  private flagContainer: Phaser.GameObjects.Container | null = null

  // Reactor glow (mako energy source)
  private reactorCenter: { x: number; y: number; rx: number; ry: number } | null = null
  private reactorGlowGfx: Phaser.GameObjects.Graphics | null = null
  private reactorPulseTween: Phaser.Tweens.Tween | null = null
  private lastReactorTickAt = 0

  constructor(scene: Phaser.Scene, host: BackgroundHostScene) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Init — create and register the graphics layers
  // ---------------------------------------------------------------------------

  init(): void {
    this.terrainGraphics = this.scene.add.graphics().setDepth(-10)
    this.officeGraphics = this.scene.add.graphics().setDepth(-4)
    this.teamAreaGraphics = this.scene.add.graphics().setDepth(-3)
    this.corridorGraphics = this.scene.add.graphics().setDepth(-2)
    this.floorArrowGfx = this.scene.add.graphics().setDepth(-1.5)
    this.hallwayIndicatorGraphics = this.scene.add.graphics().setDepth(-1)
  }

  // ---------------------------------------------------------------------------
  // Public getters used by OfficeScene
  // ---------------------------------------------------------------------------

  getCorridorSegments(): Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> {
    return this.corridorSegments
  }

  getBgDimensions(): { w: number; h: number } {
    return { w: this.lastOfficeBgW, h: this.lastOfficeBgH }
  }

  invalidateBgCache(): void {
    this.lastOfficeBgW = 0
    this.lastOfficeBgH = 0
  }

  getLastFloorArrowAt(): number { return this.lastFloorArrowAt }
  setLastFloorArrowAt(t: number): void { this.lastFloorArrowAt = t }

  getLastWhiteboardUpdateAt(): number { return this.lastWhiteboardUpdateAt }
  setLastWhiteboardUpdateAt(t: number): void { this.lastWhiteboardUpdateAt = t }

  hasWhiteboardContainer(): boolean { return this.whiteboardContainer !== null }

  // ---------------------------------------------------------------------------
  // calcRoomSize
  // ---------------------------------------------------------------------------

  calcRoomSize(agentCount: number): { width: number; height: number } {
    const n    = Math.max(1, agentCount)
    const cols = Math.min(n, MAX_AGENTS_PER_ROW)
    const rows = Math.ceil(n / cols)
    const WALL_T = 8
    const WALL_I = 4
    return {
      width:  (WALL_T + WALL_I + ROOM_PADDING) * 2 + cols * WORKSTATION_W,
      height: (WALL_T + WALL_I) * 2 + ROOM_HEADER_H + ROOM_PADDING * 2 + ROOM_TOP_EXTRA + rows * WORKSTATION_H,
    }
  }

  // ---------------------------------------------------------------------------
  // layoutRooms — master layout orchestrator
  // ---------------------------------------------------------------------------

  layoutRooms(): void {
    const rooms = this.host.getRooms()
    const roomList = Array.from(rooms.values())

    if (roomList.length === 0) {
      this.officeGraphics?.clear()
      for (const t of this.decoTweens) { try { t.destroy() } catch { /* gone */ } }
      this.decoTweens = []
      if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
      for (const s of this.officeDecoSprites) s.destroy()
      this.officeDecoSprites = []
      this.lastOfficeBgW = 0
      this.lastOfficeBgH = 0
      this.corridorGraphics?.clear()
      this.hallwayIndicatorGraphics?.clear()
      this.corridorSegments = []
      for (const t of this.corridorSignTexts) t.destroy()
      this.corridorSignTexts = []
      this.drawTeamAreas([])

      // Still build service buildings even with no agent rooms
      const cafe = this.host.getCafe()
      const cafeX = WORLD_MARGIN + cafe.width / 2
      const cafeTopY = WORLD_MARGIN
      cafe.build(cafeX, cafeTopY)
      const serviceMaxX = WORLD_MARGIN + cafe.width + WORLD_MARGIN
      const serviceMaxY = WORLD_MARGIN + cafe.height + WORLD_MARGIN
      this.host.setWorldSize(Math.max(serviceMaxX, 800), Math.max(serviceMaxY, 600))
      this.host.updateCameraBounds()
      this.host.rebuildNavMesh()
      return
    }

    // Team zoning
    const viewWidth = this.host.getViewWidth()
    const availableW = Math.max(viewWidth - WORLD_MARGIN * 2, 340)
    const areaPadX = TEAM_AREA_PAD_X
    const areaPadY = TEAM_AREA_PAD_Y
    const areaGapX = TEAM_AREA_GAP_X
    const areaGapY = TEAM_AREA_GAP_Y
    const teamLabelH = TEAM_LABEL_H
    const teams = new Map<string, Room[]>()
    for (const room of roomList) {
      const key = room.teamKey || room.cwd
      if (!teams.has(key)) teams.set(key, [])
      teams.get(key)!.push(room)
    }
    const teamKeys = Array.from(teams.keys()).sort((a, b) => {
      if (a === '__unassigned__') return 1
      if (b === '__unassigned__') return -1
      return a.localeCompare(b)
    })

    const teamCount = teamKeys.length
    const maxRoomWidth = Math.max(...roomList.map(r => r.width))
    const minTeamWidth = maxRoomWidth + areaPadX * 2
    const colsByWidth =
      availableW >= minTeamWidth * 3 + areaGapX * 2 ? 3 :
      availableW >= minTeamWidth * 2 + areaGapX ? 2 : 1
    const desiredCols = teamCount >= 6 ? 3 : teamCount >= 3 ? 2 : 1
    const teamColumns = Math.max(1, Math.min(colsByWidth, desiredCols))
    const preferredTeamWidth = Math.max(
      minTeamWidth,
      Math.floor((availableW - areaGapX * (teamColumns - 1)) / teamColumns),
    )

    const teamLayouts: TeamAreaLayout[] = []
    const teamDrafts: Array<{
      teamKey: string
      teamLabel: string
      rooms: Room[]
      roomLocalPos: Map<Room, { x: number; y: number }>
      width: number
      height: number
    }> = []
    for (const teamKey of teamKeys) {
      const teamRooms = teams.get(teamKey) ?? []
      teamRooms.sort((a, b) => a.label.localeCompare(b.label))
      const roomLocalPos = new Map<Room, { x: number; y: number }>()
      const widestRoomInTeam = teamRooms.reduce((max, room) => Math.max(max, room.width), 0)
      const teamMinWidth = Math.max(150, widestRoomInTeam + areaPadX * 2)

      let cursorX = 0
      let cursorY = 0
      let rowHeight = 0
      let maxUsedWidth = 0

      for (const room of teamRooms) {
        const maxTeamWidth = Math.max(180, preferredTeamWidth - areaPadX * 2)
        if (cursorX > 0 && cursorX + room.width > maxTeamWidth) {
          cursorX = 0
          cursorY += rowHeight + ROOM_GAP
          rowHeight = 0
        }
        roomLocalPos.set(room, {
          x: areaPadX + cursorX + room.width / 2,
          y: areaPadY + teamLabelH + cursorY + room.height / 2,
        })

        cursorX += room.width + ROOM_GAP
        rowHeight = Math.max(rowHeight, room.height)
        maxUsedWidth = Math.max(maxUsedWidth, Math.max(0, cursorX - ROOM_GAP))
      }

      const contentH = teamRooms.length > 0 ? cursorY + rowHeight : 0
      const contentW = areaPadX * 2 + maxUsedWidth
      const teamWidth = Math.max(
        teamMinWidth,
        Math.min(preferredTeamWidth, Math.max(contentW, teamMinWidth)),
      )
      const teamHeight = Math.max(115, areaPadY * 2 + teamLabelH + Math.max(contentH, 62))
      const teamLabel = teamRooms[0]?.teamLabel ?? this.host.formatLabel(teamKey)
      teamDrafts.push({
        teamKey,
        teamLabel,
        rooms: teamRooms,
        roomLocalPos,
        width: teamWidth,
        height: teamHeight,
      })
    }

    type TeamDraft = typeof teamDrafts[number]

    // ── Row 0: Service buildings (cafe) ──
    // These occupy a dedicated top row; agent offices start below.
    const cafe = this.host.getCafe()
    const serviceRowH = cafe.height
    const serviceRowBottomY = serviceRowH + areaGapY

    // ── Row 1+: Agent office teams ──
    const rows: Array<{ drafts: TeamDraft[]; width: number; height: number }> = []
    let rowDrafts: TeamDraft[] = []
    let rowWidth = 0
    let rowHeight = 0
    for (const draft of teamDrafts) {
      const nextWidth = rowDrafts.length === 0 ? draft.width : rowWidth + areaGapX + draft.width
      if (rowDrafts.length > 0 && nextWidth > availableW) {
        rows.push({ drafts: rowDrafts, width: rowWidth, height: rowHeight })
        rowDrafts = []
        rowWidth = 0
        rowHeight = 0
      }
      rowDrafts.push(draft)
      rowWidth = rowDrafts.length === 1 ? draft.width : rowWidth + areaGapX + draft.width
      rowHeight = Math.max(rowHeight, draft.height)
    }
    if (rowDrafts.length > 0) {
      rows.push({ drafts: rowDrafts, width: rowWidth, height: rowHeight })
    }

    // Agent offices start below the service row
    let areaCursorY = serviceRowBottomY

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      const doorSide: 'top' | 'bottom' = rowIdx % 2 === 0 ? 'bottom' : 'top'
      let areaCursorX = 0
      for (const draft of row.drafts) {
        const areaX = WORLD_MARGIN + areaCursorX
        const areaY = WORLD_MARGIN + areaCursorY

        for (const room of draft.rooms) {
          const local = draft.roomLocalPos.get(room)
          if (!local) continue
          room.x = areaX + local.x
          room.y = areaY + local.y
          room.doorSide = doorSide
          this.scene.tweens.killTweensOf(room.container)
          room.container.setPosition(room.x, room.y)
        }

        teamLayouts.push({
          teamKey: draft.teamKey,
          teamLabel: draft.teamLabel,
          x: areaX,
          y: areaY,
          width: draft.width,
          height: draft.height,
          agentCount: draft.rooms.reduce((sum, r) => sum + r.agents.length, 0),
        })
        areaCursorX += draft.width + areaGapX
      }
      areaCursorY += row.height + areaGapY
    }

    for (const room of roomList) {
      if (!room.cwd.startsWith('__')) {
        this.host.refreshRoomHeaderText(room)
      }
      const accentColor = this.host.getTeamColor(room.teamKey)
      const floorW = room.width - 12
      this.host.drawDoorPanel(room, floorW, accentColor)
    }

    // Room extents (tight) — used for building walls
    let roomMaxX = 0, roomMaxY = 0
    for (const room of roomList) {
      roomMaxX = Math.max(roomMaxX, room.x + room.width  / 2)
      roomMaxY = Math.max(roomMaxY, room.y + room.height / 2)
    }
    // Full extents including team area padding — used for world size
    let maxX = roomMaxX, maxY = roomMaxY
    for (const area of teamLayouts) {
      maxX = Math.max(maxX, area.x + area.width)
      maxY = Math.max(maxY, area.y + area.height)
    }

    // ── Position service buildings in top row ──
    // Vertically center cafe in the service row
    const cafeX = WORLD_MARGIN + cafe.width / 2
    const cafeTopY = WORLD_MARGIN + (serviceRowH - cafe.height) / 2
    const cafeBottomY = cafeTopY + cafe.height

    // Background cleanup + decoration positioning
    if (this.officeGraphics) {
      const bgW = Math.max(roomMaxX, maxX) + WORLD_MARGIN
      const bgH = Math.max(roomMaxY, maxY) + WORLD_MARGIN
      this.drawOfficeBackground(bgW, bgH)
    }

    // World size: include all team areas + service buildings
    const serviceMaxX = WORLD_MARGIN + cafe.width
    const totalMaxX = Math.max(maxX, serviceMaxX)
    const totalMaxY = Math.max(maxY, cafeBottomY)
    this.host.setWorldSize(totalMaxX + WORLD_MARGIN, totalMaxY + WORLD_MARGIN)

    // Draw outdoor terrain (grass, trees, paths) around buildings
    this.drawOutdoorTerrain(totalMaxX + WORLD_MARGIN, totalMaxY + WORLD_MARGIN)
    this.initReactorGlow()
    this.host.markPodsDirty()

    // Build service buildings
    if (rooms.size > 0) {
      cafe.build(cafeX, cafeTopY)
    }

    // Clean up stale floor mask (L-shape building handles this natively now)
    const existingMask = this.host.getCafeFloorMask()
    if (existingMask) { existingMask.destroy(); this.host.setCafeFloorMask(null) }

    this.host.rebuildNavMesh()
    this.drawTeamAreas(teamLayouts)
    this.drawCorridors(roomList)
    this.drawHallwayIndicators(this.scene.time.now)

    this.host.updateCameraBounds()
  }

  // ---------------------------------------------------------------------------
  // drawTeamAreas
  // ---------------------------------------------------------------------------

  drawTeamAreas(layouts: TeamAreaLayout[]): void {
    const g = this.teamAreaGraphics
    if (!g) return
    g.clear()
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    if (layouts.length === 0) return

    const BANNER_H = 22
    const CORNER_LEN = 8
    const ICON_TYPES = ['code', 'gear', 'chart', 'folder'] as const
    type IconType = typeof ICON_TYPES[number]

    for (const area of layouts) {
      const color = this.host.getTeamColor(area.teamKey)
      const { x, y, width, height } = area

      // Building walls + floor per team (each team is its own "building")
      const BWALL = 4
      g.fillStyle(COLOR_WALL)
      g.fillRoundedRect(x - 6, y - 6, width + 12, height + 12, 6)
      g.fillStyle(0x0a0e14)
      g.fillRoundedRect(x - 6 + BWALL, y - 6 + BWALL, width + 12 - BWALL * 2, height + 12 - BWALL * 2, 3)

      // Windows along the top wall of each team building (for atmosphere glint effect)
      const atmosphere = this.host.getAtmosphere()
      const winCount = Math.max(1, Math.floor(width / 80))
      const winSpacing = width / (winCount + 1)
      for (let wi = 0; wi < winCount; wi++) {
        atmosphere.windowPositions.push({
          x: x + winSpacing * (wi + 1) - 8,
          y: y - 4,
          w: 16,
          h: 6,
        })
      }

      // Ceiling light per team building
      const lightX = x + width / 2
      const lightY = y + BANNER_H + 10
      const lightGfx = this.scene.add.graphics()
      lightGfx.fillStyle(0x94a3b8, 0.06)
      lightGfx.fillCircle(0, 0, 20)
      lightGfx.fillStyle(0xcbd5e1, 0.12)
      lightGfx.fillCircle(0, 0, 6)
      lightGfx.fillStyle(0xffffff, 0.25)
      lightGfx.fillCircle(0, 0, 2)
      const lightContainer = this.scene.add.container(lightX, lightY, [lightGfx]).setDepth(-1).setAlpha(0.5)
      atmosphere.ceilingLights.push(lightContainer)

      // Gradient-style team overlay on top of the building floor
      g.fillStyle(color, 0.04)
      g.fillRoundedRect(x, y, width, height, 10)
      g.fillStyle(color, 0.06)
      g.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 8)
      g.fillStyle(color, 0.08)
      g.fillRoundedRect(x + 8, y + 8, width - 16, height - 16, 6)

      // Department banner
      g.fillStyle(color, 0.15)
      g.fillRoundedRect(x, y, width, BANNER_H, { tl: 10, tr: 10, bl: 0, br: 0 })
      g.lineStyle(1, color, 0.4)
      g.lineBetween(x, y + BANNER_H, x + width, y + BANNER_H)

      // Accent border (replaces dashed border — cleaner with per-team buildings)
      g.lineStyle(1, color, 0.25)
      g.strokeRoundedRect(x, y, width, height, 10)

      // Corner accent brackets
      g.lineStyle(1.5, color, 0.3)
      g.beginPath()
      g.moveTo(x + CORNER_LEN, y + 2); g.lineTo(x + 2, y + 2); g.lineTo(x + 2, y + CORNER_LEN)
      g.strokePath()
      g.beginPath()
      g.moveTo(x + width - CORNER_LEN, y + 2); g.lineTo(x + width - 2, y + 2); g.lineTo(x + width - 2, y + CORNER_LEN)
      g.strokePath()
      g.beginPath()
      g.moveTo(x + 2, y + height - CORNER_LEN); g.lineTo(x + 2, y + height - 2); g.lineTo(x + CORNER_LEN, y + height - 2)
      g.strokePath()
      g.beginPath()
      g.moveTo(x + width - CORNER_LEN, y + height - 2); g.lineTo(x + width - 2, y + height - 2); g.lineTo(x + width - 2, y + height - CORNER_LEN)
      g.strokePath()

      // Team icon
      const iconType: IconType = ICON_TYPES[this.host.hashToken(area.teamLabel) % ICON_TYPES.length]
      const iconX = x + 12
      const iconY = y + BANNER_H / 2
      g.lineStyle(1.2, color, 0.5)
      if (iconType === 'code') {
        g.beginPath()
        g.moveTo(iconX - 1, iconY - 3); g.lineTo(iconX - 4, iconY); g.lineTo(iconX - 1, iconY + 3)
        g.strokePath()
        g.beginPath()
        g.moveTo(iconX + 1, iconY - 3); g.lineTo(iconX + 4, iconY); g.lineTo(iconX + 1, iconY + 3)
        g.strokePath()
        g.fillStyle(color, 0.5)
        g.fillRect(iconX - 0.5, iconY - 0.5, 1, 1)
      } else if (iconType === 'gear') {
        g.beginPath(); g.moveTo(iconX - 4, iconY); g.lineTo(iconX + 4, iconY); g.strokePath()
        g.beginPath(); g.moveTo(iconX, iconY - 4); g.lineTo(iconX, iconY + 4); g.strokePath()
        g.beginPath(); g.moveTo(iconX - 3, iconY - 3); g.lineTo(iconX + 3, iconY + 3); g.strokePath()
        g.beginPath(); g.moveTo(iconX + 3, iconY - 3); g.lineTo(iconX - 3, iconY + 3); g.strokePath()
        g.lineStyle(1, color, 0.5)
        g.strokeCircle(iconX, iconY, 2)
      } else if (iconType === 'chart') {
        g.fillStyle(color, 0.5)
        g.fillRect(iconX - 5, iconY, 2, 3)
        g.fillRect(iconX - 1, iconY - 2, 2, 5)
        g.fillRect(iconX + 3, iconY - 4, 2, 7)
        g.lineStyle(1, color, 0.5)
        g.lineBetween(iconX - 6, iconY + 3, iconX + 6, iconY + 3)
      } else {
        g.beginPath()
        g.moveTo(iconX - 5, iconY - 1); g.lineTo(iconX - 5, iconY + 3); g.lineTo(iconX + 5, iconY + 3); g.lineTo(iconX + 5, iconY - 1)
        g.strokePath()
        g.beginPath()
        g.moveTo(iconX - 5, iconY - 1); g.lineTo(iconX - 5, iconY - 3); g.lineTo(iconX - 1, iconY - 3); g.lineTo(iconX - 1, iconY - 1)
        g.strokePath()
      }

      // Team label
      const labelText = this.scene.add.text(x + width / 2 + 4, y + BANNER_H / 2, area.teamLabel, {
        fontSize: '14px',
        color: activeTheme.headerText,
        fontFamily: 'system-ui, monospace',
        fontStyle: 'bold',
        resolution: 2,
      })
      labelText.setOrigin(0.5, 0.5)
      labelText.setDepth(-1)
      this.teamAreaLabels.push(labelText)

      // Animated underline
      const underlineGfx = this.scene.add.graphics()
      const ulY = y + BANNER_H - 3
      const ulX = x + width / 2 + 4 - labelText.width / 2
      underlineGfx.lineStyle(2, color, 0.5)
      underlineGfx.lineBetween(0, 0, labelText.width, 0)
      underlineGfx.setPosition(ulX, ulY)
      underlineGfx.setDepth(-1)
      underlineGfx.setScale(0, 1)
      this.scene.tweens.add({
        targets: underlineGfx,
        scaleX: 1,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: underlineGfx,
            alpha: { from: 0.45, to: 0.85 },
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
          })
        },
      })
      this.teamAreaLabels.push(underlineGfx)

      // Agent count badge
      const badgeLabel = `${area.agentCount} agent${area.agentCount !== 1 ? 's' : ''}`
      const badgePadX = 5
      const badgePadY = 3
      const badgeTextObj = this.scene.add.text(0, 0, badgeLabel, {
        fontSize: '10px',
        color: '#00e5ff',
        fontFamily: 'system-ui, monospace',
        resolution: 2,
      })
      badgeTextObj.setDepth(-1)
      const badgeW = badgeTextObj.width + badgePadX * 2
      const badgeH = badgeTextObj.height + badgePadY * 2
      const badgeX = x + width - badgeW - 8
      const badgeY = y + (BANNER_H - badgeH) / 2
      g.fillStyle(color, 0.2)
      g.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 4)
      g.lineStyle(1, color, 0.3)
      g.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 4)
      badgeTextObj.setPosition(badgeX + badgePadX, badgeY + badgePadY)
      this.teamAreaLabels.push(badgeTextObj)
    }
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

      // ── Rivets/bolts along main corridor runs ──
      g.fillStyle(0x4a5a6a, 0.3)
      for (let rx = minX; rx <= maxX; rx += 50) {
        g.fillCircle(rx, hallY - HALL_H / 2 + 3, 2.5)
        g.fillCircle(rx, hallY + HALL_H / 2 - 3, 2.5)
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
          // Rivets along vertical legs
          g.fillStyle(0x4a5a6a, 0.3)
          for (let ry = legTop; ry <= legBot; ry += 50) {
            g.fillCircle(room.x - LEG_W / 2 + 3, ry, 2.5)
            g.fillCircle(room.x + LEG_W / 2 - 3, ry, 2.5)
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

        g.fillStyle(0x00ff88, 0.1)
        g.fillCircle(room.x, hallY, 3)

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
    const teamsByRow = new Map<number, { teamKey: string; cx: number; doorY: number }[]>()
    for (const room of roomList) {
      const rowKey = Math.round(room.y / 100) * 100
      if (!teamsByRow.has(rowKey)) teamsByRow.set(rowKey, [])
      const entry = teamsByRow.get(rowKey)!
      // One entry per team per row
      if (!entry.some(e => e.teamKey === room.teamKey)) {
        entry.push({ teamKey: room.teamKey, cx: room.x, doorY: this.host.getRoomDoorY(room) })
      }
    }

    // For each row, connect adjacent teams with a horizontal corridor
    const rowCenters: { rowKey: number; y: number; minX: number; maxX: number }[] = []
    for (const [rowKey, teams] of teamsByRow) {
      teams.sort((a, b) => a.cx - b.cx)
      if (teams.length >= 2) {
        const hallY = teams[0].doorY
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
          y: teams[0].doorY,
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
      // Draw the vertical pipe visually
      g.fillStyle(0x0f1520, 0.5)
      g.fillRect(connX - 4, serviceBottomY, 8, nearestRow.y - serviceBottomY)
      g.fillStyle(0x1a2535, 0.6)
      g.fillRect(connX - 1, serviceBottomY, 2, nearestRow.y - serviceBottomY)

      // Draw a proper door at the top of the corridor (service row exit)
      const doorW = 22
      const doorH = 10
      const doorX = connX - doorW / 2
      const doorY = serviceBottomY - 2
      g.fillStyle(0x3b82f6, 0.6)
      g.fillRoundedRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4, 3)
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(doorX, doorY, doorW, doorH, 2)
      g.fillStyle(0x3b82f6, 0.4)
      g.fillRect(doorX + 3, doorY + 2, doorW - 6, 2)
      g.lineStyle(1, 0x3b82f6, 0.3)
      g.lineBetween(connX, doorY + 1, connX, doorY + doorH - 1)
      g.fillStyle(0xfbbf24, 1)
      g.fillCircle(doorX + doorW - 4, doorY + doorH / 2, 1.5)

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
    const g = this.hallwayIndicatorGraphics
    if (!g) return
    g.clear()
    if (this.corridorSegments.length === 0) return

    for (let i = 0; i < this.corridorSegments.length; i++) {
      const seg = this.corridorSegments[i]
      const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
      if (len < 1) continue
      const speed = 0.00042
      const t = (timeMs * speed + i * 0.173) % 1
      const px = Phaser.Math.Linear(seg.x1, seg.x2, t)
      const py = Phaser.Math.Linear(seg.y1, seg.y2, t)
      g.fillStyle(seg.color, 0.2)
      g.fillCircle(px, py, 4.2)
      g.fillStyle(0xcbd5e1, 0.6)
      g.fillCircle(px, py, 1.6)
    }
  }

  // ---------------------------------------------------------------------------
  // drawFloorArrows
  // ---------------------------------------------------------------------------

  drawFloorArrows(time: number): void {
    const g = this.floorArrowGfx
    if (!g) return
    g.clear()

    const rooms = this.host.getRooms()
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

  /**
   * Draw an L-shaped building when rows have different widths.
   * Uses a polygon path instead of a rectangle so there's no empty floor.
   */
  private drawLShapedBuilding(
    g: Phaser.GameObjects.Graphics,
    rowExtents: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
    PAD: number,
    WALL_T: number,
  ): void {
    const sorted = [...rowExtents].sort((a, b) => a.minY - b.minY)

    // Compute the bounding box per row with padding
    const rects = sorted.map(r => ({
      left: WORLD_MARGIN - PAD,
      top: r.minY - PAD,
      right: r.maxX + PAD,
      bottom: r.maxY + PAD,
    }))

    // Merge into an L-shape polygon path (clockwise)
    // For 2 rows where row 1 is wider:
    //   ┌──────────────┐
    //   │   Row 1      │
    //   │              │
    //   ├─────┐        │  ← step-in at row 2 right edge
    //   │ R2  │        │
    //   └─────┘────────┘
    //
    // We need the outline of the union of all row rects.

    // Simple approach for 2 rows: build the L-shape explicitly
    const left = Math.min(...rects.map(r => r.left))
    const top = Math.min(...rects.map(r => r.top))
    const right = Math.max(...rects.map(r => r.right))
    const bottom = Math.max(...rects.map(r => r.bottom))

    // Build polygon points for the union outline (clockwise)
    const points: { x: number; y: number }[] = []

    if (rects.length === 2 && rects[1].right < rects[0].right - 10) {
      // L-shape: row 1 wider than row 2
      const r0 = rects[0] // top row (wider)
      const r1 = rects[1] // bottom row (narrower)
      // Connect them vertically through the corridor gap
      const midY = (r0.bottom + r1.top) / 2

      points.push({ x: left, y: top })       // top-left
      points.push({ x: right, y: top })      // top-right
      points.push({ x: right, y: midY })     // step down on right side to corridor
      points.push({ x: r1.right, y: midY })  // step in to row 2 width
      points.push({ x: r1.right, y: bottom })// down to bottom
      points.push({ x: left, y: bottom })    // bottom-left
    } else {
      // Fallback: simple rect
      points.push({ x: left, y: top })
      points.push({ x: right, y: top })
      points.push({ x: right, y: bottom })
      points.push({ x: left, y: bottom })
    }

    // Outer wall
    g.fillStyle(COLOR_WALL)
    g.fillPoints(points, true)

    // Floor (inset by WALL_T)
    const floorPoints = points.map(p => ({
      x: p.x + (p.x <= left + 1 ? WALL_T : p.x >= right - 1 ? -WALL_T : p.x <= rects[1]?.right + 1 ? -WALL_T : WALL_T),
      y: p.y + (p.y <= top + 1 ? WALL_T : p.y >= bottom - 1 ? -WALL_T : 0),
    }))

    // Simpler: draw the floor as the union of two inset rects
    g.fillStyle(0x0a0e14)
    // Row 1 floor
    g.fillRect(left + WALL_T, top + WALL_T, right - left - WALL_T * 2, rects[0].bottom - top - WALL_T)
    // Corridor connector + Row 2 floor
    if (rects.length >= 2) {
      const r1 = rects[1]
      g.fillRect(left + WALL_T, rects[0].bottom, r1.right - left - WALL_T * 2, r1.bottom - rects[0].bottom - WALL_T)
    }
  }

  clearFloorArrows(): void {
    this.floorArrowGfx?.clear()
  }

  // ---------------------------------------------------------------------------
  // getSeasonalConfig
  // ---------------------------------------------------------------------------

  private getSeasonalConfig(): {
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

    // Bolts at plate corners
    g.fillStyle(0x3a4050, 0.3)
    for (let gx = x0; gx < x0 + w; gx += PLATE) {
      for (let gy = y0; gy < y0 + h; gy += PLATE) {
        if (rand() > 0.4) continue
        g.fillCircle(gx + 8, gy + 8, 4)
        g.fillCircle(gx + PLATE - 8, gy + 8, 4)
        g.fillCircle(gx + 8, gy + PLATE - 8, 4)
        g.fillCircle(gx + PLATE - 8, gy + PLATE - 8, 4)
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
      g.fillStyle(MAKO_GREEN, 0.035)
      g.fillCircle(gx, gy, gr)
      g.fillStyle(MAKO_GREEN, 0.06)
      g.fillCircle(gx, gy, gr * 0.4)
      // Tiny vent grating at center
      g.fillStyle(0x2a3040, 0.3)
      g.fillRoundedRect(gx - 8, gy - 5, 16, 10, 2)
      g.lineStyle(2, 0x1a2030, 0.3)
      g.lineBetween(gx - 4, gy - 4, gx - 4, gy + 4)
      g.lineBetween(gx, gy - 4, gx, gy + 4)
      g.lineBetween(gx + 4, gy - 4, gx + 4, gy + 4)
    }
  }

  // ---------------------------------------------------------------------------
  // drawOfficeBackground
  // ---------------------------------------------------------------------------

  drawOfficeBackground(contentW: number, contentH: number, rowExtents?: Array<{ minX: number; maxX: number; minY: number; maxY: number }>): void {
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
    const WALL_I = 2
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
    if (false as boolean) {
      // Dead code kept for reference — everything below is skipped
      const DECO_SCALE = 0.65; const decos: Phaser.GameObjects.Sprite[] = []; void DECO_SCALE; void decos

      if (fw > 300) {
        const clockX = fx + fw / 2
        const clockY = by + 12
        const atm2 = this.host.getAtmosphere()
        if (atm2.wallClockContainer) {
          atm2.wallClockContainer.destroy()
          ;(atm2 as { wallClockContainer: Phaser.GameObjects.Container | null }).wallClockContainer = null
        }
        const clockFace = this.scene.add.graphics()
        clockFace.fillStyle(0x141a22, 0.8)
        clockFace.fillCircle(0, 0, 12)
        clockFace.lineStyle(1, 0x2a3440, 1)
        clockFace.strokeCircle(0, 0, 12)
        clockFace.lineStyle(1, 0x3a4858, 0.8)
        for (let t = 0; t < 12; t++) {
          const ang = Phaser.Math.DegToRad(t * 30 - 90)
          clockFace.lineBetween(Math.cos(ang) * 10, Math.sin(ang) * 10, Math.cos(ang) * 12, Math.sin(ang) * 12)
        }
        clockFace.fillStyle(0xffffff, 1)
        clockFace.fillCircle(0, 0, 1)
        const hourHand = this.scene.add.graphics()
        const minuteHand = this.scene.add.graphics()
        const secondHand = this.scene.add.graphics()
        const wc = this.scene.add.container(clockX, clockY, [clockFace, hourHand, minuteHand, secondHand])
        wc.setDepth(-0.5)
        wc.setAlpha(0.88)
        void hourHand; void minuteHand; void secondHand; void wc
      }

      const picFrames = [OFFICE_FRAME_PICTURE, OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3]
      const picCount = Math.min(6, Math.floor(fw / 80))
      const picSpacing = fw / (picCount + 1)
      for (let i = 0; i < picCount; i++) {
        decos.push(this.scene.add.sprite(fx + picSpacing * (i + 1), by + 8, 'office', picFrames[i % picFrames.length])
          .setScale(DECO_SCALE * 0.85).setAlpha(0.65).setDepth(-1))
      }

      if (fh > 140) {
        decos.push(this.scene.add.sprite(fx + 14, fy + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.65).setDepth(-1))
      }
      if (fh > 160 && fw > 250) {
        decos.push(this.scene.add.sprite(fx + fw - 20, fy + fh - 50, 'office', OFFICE_FRAME_FILE_CABINET).setScale(DECO_SCALE * 0.9).setAlpha(0.7).setDepth(-1))
      }
      if (fw > 350) {
        decos.push(this.scene.add.sprite(fx + fw / 2 - 60, fy + fh - 30, 'office', OFFICE_FRAME_WATER_COOLER).setScale(DECO_SCALE * 0.85).setAlpha(0.6).setDepth(-1))
      }
      if (fw > 200) {
        decos.push(this.scene.add.sprite(fx + 30, fy + 5, 'office', OFFICE_FRAME_HANGING_PLANT).setScale(DECO_SCALE * 0.8).setAlpha(0.55).setDepth(-1))
      }
      if (fh > 180) {
        decos.push(this.scene.add.sprite(fx + 40, fy + fh - 25, 'office', OFFICE_FRAME_MONSTERA).setScale(DECO_SCALE * 0.9).setAlpha(0.7).setDepth(-1))
      }
      if (fw > 300 && fh > 160) {
        decos.push(this.scene.add.sprite(fx + 80, fy + fh - 50, 'office', OFFICE_FRAME_SOFA).setScale(0.35).setAlpha(0.7).setDepth(-1))
      }
      if (fw > 280 && fh > 140) {
        decos.push(this.scene.add.sprite(fx + fw - 22, fy + fh / 2, 'office', OFFICE_FRAME_PRINTER).setScale(DECO_SCALE * 0.9).setAlpha(0.65).setDepth(-1))
      }
      decos.push(this.scene.add.sprite(fx + 8, fy + 14, 'office', OFFICE_FRAME_TRASH).setScale(DECO_SCALE * 0.9).setAlpha(0.6).setDepth(-1))
      if (fw > 200) {
        decos.push(this.scene.add.sprite(fx + fw - 10, fy + 14, 'office', OFFICE_FRAME_TRASH).setScale(DECO_SCALE * 0.9).setAlpha(0.6).setDepth(-1))
      }
      if (fh > 180 && fw > 200) {
        decos.push(this.scene.add.sprite(fx + fw - 16, fy + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.62).setDepth(-1))
      }
      if (fw > 320 && fh > 150) {
        decos.push(this.scene.add.sprite(fx + fw * 0.65, fy + fh - 28, 'office', OFFICE_FRAME_STORAGE).setScale(DECO_SCALE * 0.9).setAlpha(0.65).setDepth(-1))
      }
      if (fw > 400) {
        const bottomPlantFrames = [OFFICE_FRAME_FERN, OFFICE_FRAME_PLANT_SM, OFFICE_FRAME_MONSTERA, OFFICE_FRAME_FERN]
        const bottomPlantCount = Math.min(4, Math.floor((fw - 120) / 90))
        const bottomPlantSpacing = (fw - 120) / (bottomPlantCount + 1)
        for (let i = 0; i < bottomPlantCount; i++) {
          decos.push(
            this.scene.add
              .sprite(fx + 60 + bottomPlantSpacing * (i + 1), fy + fh - 16, 'office', bottomPlantFrames[i % bottomPlantFrames.length])
              .setScale(DECO_SCALE * 0.8)
              .setAlpha(0.42)
              .setDepth(-1)
          )
        }
      }
      if (fh > 200) {
        const sidePicFrames = [OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3, OFFICE_FRAME_PICTURE]
        const sidePicCount = Math.min(3, Math.floor((fh - 80) / 65))
        const sidePicSpacing = (fh - 80) / (sidePicCount + 1)
        for (let i = 0; i < sidePicCount; i++) {
          decos.push(
            this.scene.add
              .sprite(fx + 8, fy + 40 + sidePicSpacing * (i + 1), 'office', sidePicFrames[i % sidePicFrames.length])
              .setScale(DECO_SCALE * 0.8)
              .setAlpha(0.38)
              .setDepth(-1)
          )
        }
      }
      if (fw > 350 && fh > 160) {
        decos.push(this.scene.add.sprite(fx + fw - 55, fy + 35, 'office', OFFICE_FRAME_MONITOR).setScale(DECO_SCALE * 0.85).setAlpha(0.68).setDepth(-1))
      }

      this.officeDecoSprites = decos
      this.animateDecorations()
    }

    // Live stats whiteboard
    // Re-read whiteboardContainer to reset TypeScript's narrowed type
    // (earlier code may have set it to null, causing 'never' inference)
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
        ? this.scene.add.sprite(0, 0, 'office', OFFICE_FRAME_WHITEBOARD).setScale(0.32).setAlpha(0.55).setDepth(-0.5)
        : null
      const titleText = this.scene.add.text(0, -11, 'TEAM STATUS', {
        fontSize: '5px', fontFamily: 'monospace', color: '#8a96a4', fontStyle: 'bold', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.9).setDepth(0)
      const agentLine = this.scene.add.text(0, -3, 'Agents: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const activeLine = this.scene.add.text(0, 4, 'Active: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const roomLine = this.scene.add.text(0, 11, 'Rooms: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#5a6a7a', resolution: 2,
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

        const halo = this.scene.add.arc(flx, floodY - 2, 10, 0, 360, false, 0xd4a017, 1)
        halo.setAlpha(initAlpha * 0.25)
        lightChildren.push(halo)

        const bulb = this.scene.add.arc(flx, floodY - 2, 4, 0, 360, false, 0xd4a017, 1)
        bulb.setAlpha(initAlpha)
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

        const sconce = this.scene.add.arc(wallX, sconceY, 4, 270, 90, false, 0xd4a017, 1)
        sconce.setAlpha(initAlpha)
        lightChildren.push(sconce)
      }

      const extLights = this.scene.add.container(0, 0, lightChildren)
      extLights.setDepth(-3.8)
      ;(atmosphere as { exteriorLights: Phaser.GameObjects.Container | null }).exteriorLights = extLights
    }

    // Seasonal decorations
    {
      const seasonal = this.getSeasonalConfig()

      if (seasonal.extraDecorType === 'winter') {
        const lightColors = [0xef4444, 0x22c55e, 0x3b82f6]
        const lightY = by + 1.5
        g.lineStyle(1, 0x2a3440, 0.1)
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
  // animateDecorations
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
          const bubble = this.scene.add.circle(bubbleX, bubbleY, 1, 0x7dd3fc, 0.3).setDepth(-0.8)
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
    room.activityBarTween = this.scene.tweens.add({ targets: room.activityBar, width: activeWidth, duration: 280, ease: 'Power2' })
    room.waitingBarTween = this.scene.tweens.add({ targets: room.waitingBar, width: waitingWidth, duration: 280, ease: 'Power2' })
    room.waitingBar.setAlpha(waitingCount > 0 ? 0.95 : 0.15)

    const ledMode: Room['ledMode'] = hasWaiting ? 'waiting' : activeCount > 0 ? 'active' : 'idle'
    if (room.ledMode !== ledMode) {
      room.ledMode = ledMode
      if (room.statusLedTween) {
        room.statusLedTween.destroy()
        room.statusLedTween = null
      }

      const ledColor = ledMode === 'waiting' ? COLOR_LED_AMBER : ledMode === 'active' ? COLOR_LED_GREEN : COLOR_LED_GRAY
      room.statusLed.setFillStyle(ledColor, 1)
      room.statusLedGlow.setFillStyle(ledColor, 1)

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
      const stripColor = hasWaiting ? 0xfbbf24 : activeCount > 0 ? 0x34d399 : 0x2a3440
      const stripAlpha = hasWaiting ? 0.75 : activeCount > 0 ? 0.7 : 0.35
      const targetW = agents.length > 0
        ? Math.max(2, (activeCount / agents.length) * floorW)
        : 2
      const hBarX = -room.width / 2 + WALL_T + WALL_I
      const hBarY = -room.height / 2 + WALL_T + WALL_I
      const stripY = hBarY + ROOM_HEADER_H + 1
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
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
      })
    }

    // Heat overlay
    if (room.heatOverlay) {
      const heat = agents.length > 0 ? activeCount / agents.length : 0
      const targetAlpha = heat * 0.06

      const heatColor = heat > 0.5
        ? lerpColor(0xfbbf24, 0xef4444, (heat - 0.5) * 2)
        : 0xfbbf24
      room.heatOverlay.setFillStyle(heatColor, room.heatOverlay.fillAlpha)

      if (room.heatTween) {
        room.heatTween.destroy()
        room.heatTween = undefined
      }
      room.heatTween = this.scene.tweens.add({
        targets: room.heatOverlay,
        fillAlpha: targetAlpha,
        duration: 500,
        ease: 'Sine.easeInOut',
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
  // destroy
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Reactor Glow — animated mako energy source
  // ---------------------------------------------------------------------------

  private initReactorGlow(): void {
    // Clean up previous
    if (this.reactorPulseTween) { this.reactorPulseTween.destroy(); this.reactorPulseTween = null }
    if (this.reactorGlowGfx) { this.reactorGlowGfx.destroy(); this.reactorGlowGfx = null }

    if (!this.reactorCenter) return

    const { x, y, rx, ry } = this.reactorCenter
    const gfx = this.scene.add.graphics().setDepth(-9.5)

    // Draw 3 concentric ellipses radiating outward
    gfx.fillStyle(0x00ff88, 0.12)
    gfx.fillEllipse(x, y, rx * 2, ry * 2)       // 1x — inner
    gfx.fillStyle(0x00ff88, 0.08)
    gfx.fillEllipse(x, y, rx * 3.6, ry * 3.6)   // 1.8x — mid
    gfx.fillStyle(0x00ff88, 0.04)
    gfx.fillEllipse(x, y, rx * 6, ry * 6)       // 3x — outer

    this.reactorGlowGfx = gfx

    // Pulsing tween — oscillates alpha between 0.5 and 1.0
    this.reactorPulseTween = this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.6, to: 1.0 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Tick the reactor glow — call from OfficeScene update loop. Throttled to every 800ms. */
  tickReactorGlow(time: number): void {
    if (!this.reactorGlowGfx || !this.reactorCenter) return
    if (time - this.lastReactorTickAt < 800) return
    this.lastReactorTickAt = time

    const { x, y, rx, ry } = this.reactorCenter
    const gfx = this.reactorGlowGfx

    // Modulate inner ring alpha based on sine for churning mako effect
    const churn = Math.sin(time * 0.001)
    const innerAlpha = 0.12 + churn * 0.04   // oscillates 0.08 – 0.16
    const midAlpha = 0.08 + churn * 0.02     // oscillates 0.06 – 0.10
    const outerAlpha = 0.04 + churn * 0.012  // oscillates 0.028 – 0.052

    gfx.clear()
    gfx.fillStyle(0x00ff88, innerAlpha)
    gfx.fillEllipse(x, y, rx * 2, ry * 2)
    gfx.fillStyle(0x00ff88, midAlpha)
    gfx.fillEllipse(x, y, rx * 3.6, ry * 3.6)
    gfx.fillStyle(0x00ff88, outerAlpha)
    gfx.fillEllipse(x, y, rx * 6, ry * 6)
  }

  destroy(): void {
    for (const t of this.decoTweens) { try { t.destroy() } catch { /* gone */ } }
    this.decoTweens = []
    if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    if (this.whiteboardContainer) { this.whiteboardContainer.destroy(); this.whiteboardContainer = null; this.whiteboardTexts = [] }
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    this.teamAreaGraphics?.destroy(); this.teamAreaGraphics = null
    this.corridorGraphics?.destroy(); this.corridorGraphics = null
    this.hallwayIndicatorGraphics?.destroy(); this.hallwayIndicatorGraphics = null
    this.floorArrowGfx?.destroy(); this.floorArrowGfx = null
    this.corridorSegments = []
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    this.officeGraphics?.destroy(); this.officeGraphics = null
    this.terrainGraphics?.destroy(); this.terrainGraphics = null
    for (const d of this.terrainDecos) { try { (d as { destroy(): void }).destroy() } catch { /* */ } }
    this.terrainDecos = []
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
