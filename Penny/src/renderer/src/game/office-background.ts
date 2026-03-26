import Phaser from 'phaser'
import { computeRoomLayout, detectRoomType } from './office-layout'
import type { Room, TeamAreaLayout } from './office-types'
import type { AgentState } from '../types'
import { activeTheme } from './office-theme'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'
import {
  ROOM_GAP,
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

  // Sub-modules
  private terrain: OfficeTerrain
  private corridors: OfficeCorridors
  private interior: OfficeInterior

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

    this.terrain = new OfficeTerrain(scene, terrainHost)
    this.corridors = new OfficeCorridors(scene, corridorHost)
    this.interior = new OfficeInterior(scene, interiorHost)
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

    // Background cleanup + decoration positioning
    const bgW = Math.max(roomMaxX, maxX) + WORLD_MARGIN
    const bgH = Math.max(roomMaxY, maxY) + WORLD_MARGIN
    this.interior.drawOfficeBackground(bgW, bgH, () => this.terrain.getSeasonalConfig())

    // World size: include all team areas + service buildings
    const serviceMaxX = WORLD_MARGIN + cafe.width
    const totalMaxX = Math.max(maxX, serviceMaxX)
    const totalMaxY = Math.max(maxY, cafeBottomY)
    this.host.setWorldSize(totalMaxX + WORLD_MARGIN, totalMaxY + WORLD_MARGIN)

    // Draw outdoor terrain (grass, trees, paths) around buildings
    this.terrain.drawOutdoorTerrain(totalMaxX + WORLD_MARGIN, totalMaxY + WORLD_MARGIN)
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
      // Mid glow ring — sprite circle
      const lightMid = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.12).setAlpha(0.12).setTint(0xcbd5e1)
      // Center bright dot — sprite circle
      const lightCenter = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
        .setScale(0.06).setAlpha(0.25).setTint(0xffffff)
      const lightContainer = this.scene.add.container(lightX, lightY, [lightGfx, lightMid, lightCenter]).setDepth(-1).setAlpha(0.5)
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
    g.fillStyle(0x0a0e14)
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
    this.teamAreaGraphics?.destroy()
    this.teamAreaGraphics = null

    this.terrain.destroy()
    this.corridors.destroy()
    this.interior.destroy()
  }
}
