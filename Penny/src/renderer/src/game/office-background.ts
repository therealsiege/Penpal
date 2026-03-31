import Phaser from 'phaser'
import { computeRoomLayout, detectRoomType } from './office-layout'
import type { Room, TeamAreaLayout } from './office-types'
import type { AgentState } from '../types'
import { activeTheme } from './office-theme'
import { SPRITESHEET_KEYS, ICON_FRAMES, PIPE_FRAMES, CABLE_FRAMES } from './office-asset-keys'
import {
  ROOM_GAP, LAB_TILE_SIZE,
  TEAM_AREA_PAD_X, TEAM_AREA_PAD_Y, TEAM_AREA_GAP_X, TEAM_AREA_GAP_Y, TEAM_LABEL_H,
  COLOR_WALL,
  WORLD_MARGIN, LOD_L1_MAX,
} from './office-constants'
import { OfficeTerrain } from './office-terrain'
import type { TerrainHostScene } from './office-terrain'
import { OfficeCorridors } from './office-corridors'
import type { CorridorHostScene } from './office-corridors'
import { OfficeInterior } from './office-interior'
import type { InteriorHostScene } from './office-interior'
import { WorkspaceUnifiedFloor } from './workspace-unified-floor'
import type { UnifiedFloorHostScene } from './workspace-unified-floor'

// Suppress unused import warnings for constants only referenced inside the
// sub-modules (they are still re-exported conceptually via the barrel).
void LOD_L1_MAX

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
    ceilingLights: Phaser.GameObjects.Container[]
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
// Owns: team-area graphics + labels, the master layoutRooms orchestration,
//       and coordinates OfficeTerrain, OfficeCorridors, and OfficeInterior.
// ---------------------------------------------------------------------------

export class OfficeBackground {
  private scene: Phaser.Scene
  private host: BackgroundHostScene

  // Graphics layers
  private teamAreaGraphics: Phaser.GameObjects.Graphics | null = null

  // Team area labels
  private teamAreaLabels: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = []

  // Pipe/cable sprites placed between rooms inside team areas
  private teamPipeSprites: Phaser.GameObjects.GameObject[] = []

  // Sub-modules
  private terrain: OfficeTerrain
  private corridors: OfficeCorridors
  private interior: OfficeInterior
  private unifiedFloor: WorkspaceUnifiedFloor

  constructor(scene: Phaser.Scene, host: BackgroundHostScene) {
    this.scene = scene
    this.host = host

    // Build host adapters for each sub-module
    const terrainHost: TerrainHostScene = {
      getRooms: () => host.getRooms(),
    }

    const corridorHost: CorridorHostScene = {
      getTeamColor: (k) => host.getTeamColor(k),
      getRoomDoorY: (r) => host.getRoomDoorY(r),
      setCorridorData: (segs, active) => host.setCorridorData(segs, active),
      getCafe: () => host.getCafe(),
    }

    const interiorHost: InteriorHostScene = {
      isOfficeTilesLoaded: () => host.isOfficeTilesLoaded(),
      getLastLodLevel: () => host.getLastLodLevel(),
      getAgents: () => host.getAgents(),
      getRooms: () => host.getRooms(),
      getAtmosphere: () => host.getAtmosphere(),
    }

    const unifiedFloorHost: UnifiedFloorHostScene = {
      getLastLodLevel: () => host.getLastLodLevel(),
    }

    this.terrain = new OfficeTerrain(scene, terrainHost)
    this.corridors = new OfficeCorridors(scene, corridorHost)
    this.interior = new OfficeInterior(scene, interiorHost)
    this.unifiedFloor = new WorkspaceUnifiedFloor(scene, unifiedFloorHost)
  }

  // ---------------------------------------------------------------------------
  // Init — create and register the graphics layers
  // ---------------------------------------------------------------------------

  init(): void {
    const terrainGfx = this.scene.add.graphics().setDepth(-10)
    this.terrain.init(terrainGfx)

    const officeGfx = this.scene.add.graphics().setDepth(-4)
    this.interior.init(officeGfx)

    this.teamAreaGraphics = this.scene.add.graphics().setDepth(-3)

    const corridorGfx = this.scene.add.graphics().setDepth(-2)
    const floorArrowGfx = this.scene.add.graphics().setDepth(-1.5)
    const hallwayGfx = this.scene.add.graphics().setDepth(-1)
    this.corridors.init(corridorGfx, hallwayGfx, floorArrowGfx)
  }

  // ---------------------------------------------------------------------------
  // Public getters used by OfficeScene
  // ---------------------------------------------------------------------------

  getCorridorSegments(): Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> {
    return this.corridors.corridorSegments
  }

  getBgDimensions(): { w: number; h: number } {
    return this.interior.getBgDimensions()
  }

  invalidateBgCache(): void {
    this.interior.invalidateBgCache()
  }

  getLastFloorArrowAt(): number { return this.corridors.lastFloorArrowAt }
  setLastFloorArrowAt(t: number): void { this.corridors.lastFloorArrowAt = t }

  getLastWhiteboardUpdateAt(): number { return this._lastWhiteboardUpdateAt }
  setLastWhiteboardUpdateAt(t: number): void { this._lastWhiteboardUpdateAt = t }
  private _lastWhiteboardUpdateAt = 0

  hasWhiteboardContainer(): boolean { return this.interior.hasWhiteboardContainer() }

  // ---------------------------------------------------------------------------
  // calcRoomSize
  // ---------------------------------------------------------------------------

  calcRoomSize(agentCount: number, cwd?: string): { width: number; height: number } {
    const roomType = cwd ? detectRoomType(cwd) : 'standard'
    const layout = computeRoomLayout(agentCount, roomType)
    return { width: layout.width, height: layout.height }
  }

  // ---------------------------------------------------------------------------
  // layoutRooms — master layout orchestrator
  // ---------------------------------------------------------------------------

  layoutRooms(): void {
    const rooms = this.host.getRooms()
    const roomList = Array.from(rooms.values())

    if (roomList.length === 0) {
      this.interior.invalidateBgCache()
      this.corridors.clearCorridors()
      this.drawTeamAreas([])

      // Still build service buildings even with no agent rooms
      const cafe = this.host.getCafe()
      const cafeX = WORLD_MARGIN + cafe.width / 2
      const cafeTopY = WORLD_MARGIN
      cafe.build(cafeX, cafeTopY)
      const serviceMaxX = WORLD_MARGIN + cafe.width + WORLD_MARGIN
      const serviceMaxY = WORLD_MARGIN + cafe.height + WORLD_MARGIN
      const cam = this.scene.cameras.main
      const vpW0 = cam.width / Math.max(cam.zoom, 0.7)
      const vpH0 = cam.height / Math.max(cam.zoom, 0.7)
      this.host.setWorldSize(
        Math.max(serviceMaxX, vpW0 + WORLD_MARGIN * 2, 800),
        Math.max(serviceMaxY, vpH0 + WORLD_MARGIN * 2, 600),
      )
      this.host.updateCameraBounds()
      this.host.rebuildNavMesh()
      return
    }

    // ── Unified lab layout — all rooms as zones in one wide facility ──
    const viewWidth = this.host.getViewWidth()
    // Fill the full viewport width for a wide lab
    const availableW = Math.max(viewWidth * 1.1, 800)
    const areaPadX = TEAM_AREA_PAD_X
    const areaPadY = TEAM_AREA_PAD_Y
    const areaGapX = TEAM_AREA_GAP_X
    const areaGapY = TEAM_AREA_GAP_Y
    const teamLabelH = TEAM_LABEL_H

    // Merge ALL rooms into a single "lab" team so they pack into one facility
    const teams = new Map<string, Room[]>()
    const UNIFIED_KEY = '__lab__'
    teams.set(UNIFIED_KEY, [...roomList].sort((a, b) => a.label.localeCompare(b.label)))

    const teamKeys = [UNIFIED_KEY]

    // Single team fills the full available width
    const teamColumns = 1
    const preferredTeamWidth = availableW

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
      const teamLabel = teamKey === '__lab__' ? 'PENPAL LAB' : (teamRooms[0]?.teamLabel ?? this.host.formatLabel(teamKey))
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
      const doorSide: 'top' | 'bottom' = 'top'
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
    const cafeX = WORLD_MARGIN + cafe.width / 2
    const cafeTopY = WORLD_MARGIN + (serviceRowH - cafe.height) / 2
    const cafeBottomY = cafeTopY + cafe.height

    // Viewport size at current zoom — ensures terrain/bg always fill the screen
    const cam = this.scene.cameras.main
    const vpW = cam.width / Math.max(cam.zoom, 0.7)
    const vpH = cam.height / Math.max(cam.zoom, 0.7)

    // Background cleanup + decoration positioning — use viewport-aware size
    const bgW = Math.max(Math.max(roomMaxX, maxX) + WORLD_MARGIN, vpW + WORLD_MARGIN * 2)
    const bgH = Math.max(Math.max(roomMaxY, maxY) + WORLD_MARGIN, vpH + WORLD_MARGIN * 2)
    this.interior.drawOfficeBackground(bgW, bgH, () => this.terrain.getSeasonalConfig())

    // World size: include all team areas + service buildings.
    // Ensure the world is at least as large as the viewport (at current zoom)
    // so the terrain always fills the visible area.
    const serviceMaxX = WORLD_MARGIN + cafe.width
    const totalMaxX = Math.max(maxX, serviceMaxX)
    const totalMaxY = Math.max(maxY, cafeBottomY)
    const worldW = Math.max(totalMaxX + WORLD_MARGIN, vpW + WORLD_MARGIN * 2)
    const worldH = Math.max(totalMaxY + WORLD_MARGIN, vpH + WORLD_MARGIN * 2)
    this.host.setWorldSize(worldW, worldH)

    // Draw outdoor terrain (grass, trees, paths) around buildings
    this.terrain.drawOutdoorTerrain(worldW, worldH)
    // Init reactor glow in interior using the reactor center computed by terrain
    this.interior.initReactorGlow(this.terrain.reactorCenter)
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
    this.corridors.drawCorridors(roomList)
    this.corridors.drawHallwayIndicators(this.scene.time.now)

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
    // Clean up pipe sprites from previous draw
    for (const s of this.teamPipeSprites) s.destroy()
    this.teamPipeSprites = []
    if (layouts.length === 0) {
      this.unifiedFloor.cleanup()
      return
    }

    // Rebuild unified floor tiles for team areas
    this.unifiedFloor.cleanup()

    const BANNER_H = 22
    const CORNER_LEN = 8
    const ICON_TYPES = ['code', 'gear', 'chart', 'folder'] as const
    type IconType = typeof ICON_TYPES[number]

    // ── Unified facility bounding box encompassing ALL team areas ──
    const allX = Math.min(...layouts.map(a => a.x)) - 20
    const allY = Math.min(...layouts.map(a => a.y)) - 20
    const allRight = Math.max(...layouts.map(a => a.x + a.width)) + 20
    const allBottom = Math.max(...layouts.map(a => a.y + a.height)) + 20

    // ONE facility outline around all teams — dark, thick walls
    g.fillStyle(COLOR_WALL)
    g.fillRoundedRect(allX - 6, allY - 6, (allRight - allX) + 12, (allBottom - allY) + 12, 8)
    g.fillStyle(activeTheme.bg, 0.15)
    g.fillRoundedRect(allX, allY, allRight - allX, allBottom - allY, 5)

    // ONE unified floor spanning the entire facility
    this.unifiedFloor.drawFloor(allX, allY, allRight - allX, allBottom - allY, 0x3b82f6)

    // Windows along the top wall of the facility (for atmosphere glint effect)
    const atmosphere = this.host.getAtmosphere()
    const facilityWidth = allRight - allX
    const winCount = Math.max(1, Math.floor(facilityWidth / 80))
    const winSpacing = facilityWidth / (winCount + 1)
    for (let wi = 0; wi < winCount; wi++) {
      atmosphere.windowPositions.push({
        x: allX + winSpacing * (wi + 1) - 8,
        y: allY - 4,
        w: 16,
        h: 6,
      })
    }

    for (const area of layouts) {
      const color = this.host.getTeamColor(area.teamKey)
      const { x, y, width, height } = area

      // Ceiling light per team zone
      const lightX = x + width / 2
      const lightY = y + BANNER_H + 10
      const lightGfx = this.scene.add.graphics()
      lightGfx.fillStyle(0x94a3b8, 0.06)
      lightGfx.fillCircle(0, 0, 20)
      // Mid glow ring — sprite circle
      const lightMid = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.12).setAlpha(0.12).setTint(0xcbd5e1)
      // Center bright dot — sprite circle
      const lightCenter = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.06).setAlpha(0.25).setTint(0xffffff)
      const lightContainer = this.scene.add.container(lightX, lightY, [lightGfx, lightMid, lightCenter]).setDepth(-1).setAlpha(0.5)
      atmosphere.ceilingLights.push(lightContainer)

      // Subtle team color overlay — kept very dark to preserve moody atmosphere
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
        color: activeTheme.accentText,
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

    // ── Corridor detail rendering (hazard stripes, glow lights, laser lines) ──
    this.drawCorridorDetails(g)

    // ── Place pipe & cable sprites between rooms inside team areas ──
    this.placeTeamPipes(layouts)
  }

  // ---------------------------------------------------------------------------
  // drawCorridorDetails — hazard stripes, glow lights, laser lines between rooms
  // ---------------------------------------------------------------------------

  private drawCorridorDetails(g: Phaser.GameObjects.Graphics): void {
    const rooms = this.host.getRooms()
    if (rooms.size < 2) return

    const roomList = Array.from(rooms.values())

    // Sort rooms by row then x — same logic as placeTeamPipes
    const sorted = [...roomList].sort((a, b) => {
      const rowDiff = Math.round(a.y / 50) - Math.round(b.y / 50)
      return rowDiff !== 0 ? rowDiff : a.x - b.x
    })

    // ── Horizontally adjacent rooms (same row, gap between them) ──
    for (let i = 0; i < sorted.length - 1; i++) {
      const roomA = sorted[i]
      const roomB = sorted[i + 1]

      // Only connect rooms on the same approximate row
      if (Math.abs(roomA.y - roomB.y) > roomA.height) continue

      const gapX1 = roomA.x + roomA.width / 2
      const gapX2 = roomB.x - roomB.width / 2
      const gapLen = gapX2 - gapX1
      if (gapLen < 10) continue

      // Top/bottom Y extents from both rooms
      const topY = Math.min(roomA.y - roomA.height / 2, roomB.y - roomB.height / 2)
      const bottomY = Math.max(roomA.y + roomA.height / 2, roomB.y + roomB.height / 2)
      const midY = (roomA.y + roomB.y) / 2

      // Yellow hazard dashed stripes — top edge
      g.fillStyle(0xfbbf24, 0.60)
      for (let dx = gapX1; dx < gapX2; dx += 14 + 3) {
        g.fillRect(dx, topY, Math.min(14, gapX2 - dx), 5)
      }
      // Yellow hazard dashed stripes — bottom edge
      for (let dx = gapX1; dx < gapX2; dx += 14 + 3) {
        g.fillRect(dx, bottomY - 5, Math.min(14, gapX2 - dx), 5)
      }

      // Cyan glow circles at corridor center every ~80px
      const corridorH = bottomY - topY
      const cy = topY + corridorH / 2
      for (let dx = gapX1 + 40; dx < gapX2 - 20; dx += 80) {
        g.fillStyle(0x00e5ff, 0.12)
        g.fillCircle(dx, cy, 18)
        g.fillStyle(0x00e5ff, 0.25)
        g.fillCircle(dx, cy, 10)
        g.fillStyle(0x00e5ff, 0.45)
        g.fillCircle(dx, cy, 5)
      }

      // Thin red laser line through corridor center
      g.lineStyle(1.5, 0xff3333, 0.45)
      g.lineBetween(gapX1, midY, gapX2, midY)
    }

    // ── Vertically adjacent rooms (X ranges overlap, Y gap > 20) ──
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const roomA = sorted[i]
        const roomB = sorted[j]

        // Check X overlap: rooms whose X ranges overlap significantly
        if (Math.abs(roomA.x - roomB.x) >= roomA.width * 0.8) continue

        // Determine top/bottom room
        const topRoom = roomA.y < roomB.y ? roomA : roomB
        const bottomRoom = roomA.y < roomB.y ? roomB : roomA

        const gapY1 = topRoom.y + topRoom.height / 2
        const gapY2 = bottomRoom.y - bottomRoom.height / 2
        const gapLen = gapY2 - gapY1
        if (gapLen <= 20) continue

        // Left/right X extents from both rooms
        const leftX = Math.min(topRoom.x - topRoom.width / 2, bottomRoom.x - bottomRoom.width / 2)
        const rightX = Math.max(topRoom.x + topRoom.width / 2, bottomRoom.x + bottomRoom.width / 2)
        const midX = (topRoom.x + bottomRoom.x) / 2

        // Yellow hazard dashed stripes — left edge
        g.fillStyle(0xfbbf24, 0.60)
        for (let dy = gapY1; dy < gapY2; dy += 14 + 3) {
          g.fillRect(leftX, dy, 5, Math.min(14, gapY2 - dy))
        }
        // Yellow hazard dashed stripes — right edge
        for (let dy = gapY1; dy < gapY2; dy += 14 + 3) {
          g.fillRect(rightX - 5, dy, 5, Math.min(14, gapY2 - dy))
        }

        // Cyan glow circles along vertical center every ~80px
        const cx = leftX + (rightX - leftX) / 2
        for (let dy = gapY1 + 40; dy < gapY2 - 20; dy += 80) {
          g.fillStyle(0x00e5ff, 0.12)
          g.fillCircle(cx, dy, 18)
          g.fillStyle(0x00e5ff, 0.25)
          g.fillCircle(cx, dy, 10)
          g.fillStyle(0x00e5ff, 0.45)
          g.fillCircle(cx, dy, 5)
        }

        // Thin red laser line through vertical corridor center
        g.lineStyle(1.5, 0xff3333, 0.45)
        g.lineBetween(midX, gapY1, midX, gapY2)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // placeTeamPipes — lay pipe/cable sprites in corridors between rooms
  // ---------------------------------------------------------------------------

  private placeTeamPipes(layouts: TeamAreaLayout[]): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) return

    const rooms = this.host.getRooms()
    const PIPE_SCALE = 0.22
    const PIPE_DEPTH = -2.7  // between unified floor (-3) and room walls (-2)
    const PIPE_ALPHA = 0.55
    const CABLE_SCALE = 0.18
    const CABLE_ALPHA = 0.4
    const PIPE_SPACING = 45

    // Group rooms by team
    const teamRooms = new Map<string, Room[]>()
    for (const room of rooms.values()) {
      const key = room.teamKey || room.cwd
      if (!teamRooms.has(key)) teamRooms.set(key, [])
      teamRooms.get(key)!.push(room)
    }

    for (const area of layouts) {
      const areaRooms = teamRooms.get(area.teamKey)
      if (!areaRooms || areaRooms.length < 2) continue

      const color = this.host.getTeamColor(area.teamKey)

      // Connect adjacent rooms with horizontal pipe runs
      // Sort rooms by position to find neighbors
      const sorted = [...areaRooms].sort((a, b) => {
        const rowDiff = Math.round(a.y / 50) - Math.round(b.y / 50)
        return rowDiff !== 0 ? rowDiff : a.x - b.x
      })

      for (let i = 0; i < sorted.length - 1; i++) {
        const roomA = sorted[i]
        const roomB = sorted[i + 1]

        // Only connect rooms on the same approximate row
        if (Math.abs(roomA.y - roomB.y) > roomA.height) continue

        const gapX1 = roomA.x + roomA.width / 2
        const gapX2 = roomB.x - roomB.width / 2
        const gapLen = gapX2 - gapX1
        if (gapLen < 10) continue

        const midY = (roomA.y + roomB.y) / 2

        // Horizontal pipe run through the gap
        const numPipes = Math.max(1, Math.floor(gapLen / PIPE_SPACING))
        for (let pi = 0; pi < numPipes; pi++) {
          const t = (pi + 0.5) / numPipes
          const px = gapX1 + gapLen * t
          const pipe = this.scene.add.sprite(px, midY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.HORIZ_ARROW)
            .setScale(PIPE_SCALE)
            .setAlpha(PIPE_ALPHA)
            .setDepth(PIPE_DEPTH)
            .setTint(color)
          this.teamPipeSprites.push(pipe)
        }

        // Cable run offset below the pipe
        if (this.scene.textures.exists(SPRITESHEET_KEYS.LAB_CABLES)) {
          const cableCount = Math.max(1, Math.floor(gapLen / (PIPE_SPACING * 1.3)))
          for (let ci = 0; ci < cableCount; ci++) {
            const t = (ci + 0.5) / cableCount
            const cx = gapX1 + gapLen * t
            const cable = this.scene.add.sprite(cx, midY + 8, SPRITESHEET_KEYS.LAB_CABLES, CABLE_FRAMES.HORIZ_STRAIGHT)
              .setScale(CABLE_SCALE)
              .setAlpha(CABLE_ALPHA)
              .setDepth(PIPE_DEPTH - 0.1)
            this.teamPipeSprites.push(cable)
          }
        }

        // Coupling flanges at the ends
        const couplingL = this.scene.add.sprite(gapX1 + 4, midY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.COUPLING_HORIZ)
          .setScale(PIPE_SCALE * 0.8)
          .setAlpha(PIPE_ALPHA * 0.7)
          .setDepth(PIPE_DEPTH + 0.1)
          .setTint(color)
        this.teamPipeSprites.push(couplingL)

        const couplingR = this.scene.add.sprite(gapX2 - 4, midY, SPRITESHEET_KEYS.LAB_PIPES, PIPE_FRAMES.COUPLING_HORIZ)
          .setScale(PIPE_SCALE * 0.8)
          .setAlpha(PIPE_ALPHA * 0.7)
          .setDepth(PIPE_DEPTH + 0.1)
          .setTint(color)
        this.teamPipeSprites.push(couplingR)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Delegation accessors for OfficeScene update loop
  // ---------------------------------------------------------------------------

  drawHallwayIndicators(timeMs: number): void {
    this.corridors.drawHallwayIndicators(timeMs)
  }

  drawFloorArrows(time: number): void {
    this.corridors.drawFloorArrows(time, this.host.getRooms())
  }

  clearFloorArrows(): void {
    this.corridors.clearFloorArrows()
  }

  updateWhiteboardStats(): void {
    this.interior.updateWhiteboardStats()
  }

  updateRoomActivity(room: Room): void {
    this.interior.updateRoomActivity(room)
  }

  applyLodToWhiteboard(lodLevel: number): void {
    this.interior.applyLodToWhiteboard(lodLevel)
    this.unifiedFloor.applyLod(lodLevel)
  }

  tickReactorGlow(time: number): void {
    this.interior.tickReactorGlow(time)
    this.terrain.tickReactorPulse(time)
  }

  // ---------------------------------------------------------------------------
  // drawLShapedBuilding — L-shaped building polygon
  // ---------------------------------------------------------------------------

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

    // Simpler: draw the floor as the union of two inset rects
    g.fillStyle(activeTheme.bg)
    // Row 1 floor
    g.fillRect(left + WALL_T, top + WALL_T, right - left - WALL_T * 2, rects[0].bottom - top - WALL_T)
    // Corridor connector + Row 2 floor
    if (rects.length >= 2) {
      const r1 = rects[1]
      g.fillRect(left + WALL_T, rects[0].bottom, r1.right - left - WALL_T * 2, r1.bottom - rects[0].bottom - WALL_T)
    }
  }

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    for (const s of this.teamPipeSprites) s.destroy()
    this.teamPipeSprites = []
    this.teamAreaGraphics?.destroy()
    this.teamAreaGraphics = null

    this.terrain.destroy()
    this.corridors.destroy()
    this.interior.destroy()
    this.unifiedFloor.destroy()
  }
}
