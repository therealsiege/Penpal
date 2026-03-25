// ---------------------------------------------------------------------------
// OfficeRooms — Room creation, rendering, doors, and headers
// Extracted from OfficeScene.ts (~lines 1051-1625)
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import type { Room } from './office-types'
import type { OfficeAtmosphere } from './office-atmosphere'
import { getRoomType, getTemplate } from './room-renderer'
import { activeTheme } from './office-theme'
import {
  COLOR_HEADER_BG,
  COLOR_LED_GRAY,
  COLOR_DOOR_FILL,
  ROOM_HEADER_H,
} from './office-constants'

// ---------------------------------------------------------------------------
// Host-scene interface — only the properties/methods OfficeRooms needs
// ---------------------------------------------------------------------------

export interface RoomsHostScene {
  atmosphere: OfficeAtmosphere
  calcRoomSize(agentCount: number): { width: number; height: number }
  syncWorkstations(room: Room, agents: AgentState[]): void
  updateRoomActivity(room: Room): void
  destroyWorkstation(ws: import('./office-types').WorkstationSprite): void
  formatLabel(label: string): string
}

// ---------------------------------------------------------------------------
// OfficeRooms
// ---------------------------------------------------------------------------

export class OfficeRooms {
  private scene: Phaser.Scene
  private host: RoomsHostScene

  constructor(scene: Phaser.Scene, host: RoomsHostScene) {
    this.scene = scene
    this.host = host
  }

  // -------------------------------------------------------------------------
  // Deterministic hash helper (mirrors OfficeScene.hashToken)
  // -------------------------------------------------------------------------

  private hashToken(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  // -------------------------------------------------------------------------
  // Room lifecycle
  // -------------------------------------------------------------------------

  createRoom(
    cwd: string,
    label: string,
    teamKey: string,
    teamLabel: string,
    agents: AgentState[],
  ): Room {
    const { width, height } = this.host.calcRoomSize(agents.length)
    const container = this.scene.add.container(0, 0)
    const floorGraphics = this.scene.add.graphics()
    container.add(floorGraphics)

    const activityBar = this.scene.add
      .rectangle(-width / 2, height / 2 + 2, 0, 2, 0x34d399, 1)
      .setOrigin(0, 0)
    container.add(activityBar)
    const waitingBar = this.scene.add
      .rectangle(-width / 2, height / 2 - 1, 0, 2, 0xfbbf24, 0.95)
      .setOrigin(0, 0)
    container.add(waitingBar)

    // Status LED indicator (top-left of header, next to room name)
    const ledWallT = 6
    const ledWallI = 2
    const ledX = -width / 2 + ledWallT + ledWallI + 10
    const ledY = -height / 2 + ledWallT + ledWallI + ROOM_HEADER_H / 2
    const statusLedGlow = this.scene.add.circle(ledX, ledY, 6, COLOR_LED_GRAY, 0.15)
    container.add(statusLedGlow)
    const statusLed = this.scene.add.circle(ledX, ledY, 3, COLOR_LED_GRAY, 1)
    container.add(statusLed)

    // Door graphics — separate objects so they can be animated independently.
    // doorFrameGraphics holds the accent frame (alpha-pulsed when room is active).
    // doorGraphics holds the door panel itself (scaleX-animated on headcount change).
    const doorFrameGraphics = this.scene.add.graphics()
    container.add(doorFrameGraphics)
    const doorGraphics = this.scene.add.graphics()
    container.add(doorGraphics)

    // Heat overlay — warm amber rectangle over the floor area.
    // Alpha starts at 0; tweened toward heat * 0.06 in updateRoomActivity
    // for a barely-perceptible thermal camera warmth on busy rooms.
    const heatOverlay = this.scene.add.rectangle(0, 0, width, height, 0xfbbf24, 0)
    heatOverlay.setDepth(0.5) // above floor graphics, below workstation containers
    container.add(heatOverlay)

    const room: Room = {
      cwd, label, teamKey, teamLabel, agents,
      x: 0, y: 0, width, height,
      container,
      workstations: new Map(),
      floorGraphics,
      activityBar, activityBarTween: null,
      waitingBar, waitingBarTween: null,
      statusLed, statusLedGlow, statusLedTween: null,
      ledMode: 'idle',
      doorGraphics, doorFrameGraphics, doorPulseTween: null,
      prevAgentCount: agents.length,
      statusStrip: null, statusStripTween: null,
      badgeDotTween: null,
      heatOverlay,
      heatTween: undefined,
      doorSide: 'bottom',
    }

    this.drawRoomBackground(room)
    this.host.syncWorkstations(room, agents)
    this.host.updateRoomActivity(room)
    this.updateDoorGlow(room)
    return room
  }

  updateRoom(room: Room, agents: AgentState[]): void {
    room.agents = agents
    const { width, height } = this.host.calcRoomSize(agents.length)
    const sizeChanged = width !== room.width || height !== room.height
    room.width  = width
    room.height = height
    if (sizeChanged) this.drawRoomBackground(room)
    this.host.syncWorkstations(room, agents)
    this.host.updateRoomActivity(room)
    this.updateDoorGlow(room)
  }

  destroyRoom(room: Room): void {
    if (room.activityBarTween) room.activityBarTween.destroy()
    if (room.waitingBarTween) room.waitingBarTween.destroy()
    if (room.statusLedTween) room.statusLedTween.destroy()
    if (room.doorPulseTween) room.doorPulseTween.destroy()
    if (room.statusStripTween) room.statusStripTween.destroy()
    if (room.badgeDotTween) room.badgeDotTween.destroy()
    if (room.heatTween) room.heatTween.destroy()
    if (room.heatOverlay) room.heatOverlay.destroy()
    if (room.headerGlowTween) room.headerGlowTween.destroy()
    room.headerGlowFx = undefined
    if (room.floorTileSprites) {
      for (const s of room.floorTileSprites) s.destroy()
      room.floorTileSprites = []
    }
    if (room.miniWhiteboard) {
      room.miniWhiteboard.destroy()
      room.miniWhiteboard = undefined
    }
    if (room.miniWhiteboardTexts) {
      for (const t of room.miniWhiteboardTexts) t.destroy()
      room.miniWhiteboardTexts = []
    }
    for (const ws of room.workstations.values()) {
      this.host.destroyWorkstation(ws)
    }
    room.workstations.clear()
    room.container.destroy()
  }

  // -------------------------------------------------------------------------
  // Room background drawing
  // -------------------------------------------------------------------------

  drawRoomBackground(room: Room): void {
    const g = room.floorGraphics
    g.clear()

    const w = room.width
    const h = room.height

    // Keep heat overlay sized to match the room floor when dimensions change.
    if (room.heatOverlay) {
      room.heatOverlay.setSize(w, h)
    }

    const WALL_T = 3          // thinner than outer building walls (5)
    const WALL_I = 1
    // Directory-based theming — deterministic colors per room type
    const template = getTemplate(getRoomType(room.cwd))
    const roomStyle = {
      wallOuter: 0x475569,
      wallInner: 0x64748b,
      floor: template.floorColor,
      floorGrid: template.rugColor,
      header: COLOR_HEADER_BG,
      accent: template.accentColor,
      rug: template.rugColor,
    }

    // Subtle drop shadow
    g.fillStyle(0x000000, 0.15)
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 6)

    // Outer wall
    g.fillStyle(roomStyle.wallOuter)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 5)

    // Inner wall highlight
    g.fillStyle(roomStyle.wallInner)
    g.fillRoundedRect(-w / 2 + WALL_T, -h / 2 + WALL_T, w - WALL_T * 2, h - WALL_T * 2, 3)

    // Floor
    const floorX = -w / 2 + WALL_T + WALL_I
    const floorY = -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H
    const floorW = w - (WALL_T + WALL_I) * 2
    const floorH = h - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H

    g.fillStyle(roomStyle.floor)
    g.fillRect(floorX, floorY, floorW, floorH)

    // Diamond-plate steel grating pattern — raised diamond bumps in a cross layout
    const CELL = 12
    const DS = 1.8 // diamond half-size
    const cellCols = Math.ceil(floorW / CELL)
    const cellRows = Math.ceil(floorH / CELL)
    g.fillStyle(roomStyle.floorGrid, 0.18)
    for (let cr = 0; cr < cellRows; cr++) {
      for (let cc = 0; cc < cellCols; cc++) {
        const cx = floorX + cc * CELL + CELL / 2
        const cy = floorY + cr * CELL + CELL / 2
        if (cx > floorX + floorW || cy > floorY + floorH) continue
        // 4 tiny rhombuses arranged in a cross pattern around cell center
        const offsets = [
          { dx: 0, dy: -3 },
          { dx: 3, dy: 0 },
          { dx: 0, dy: 3 },
          { dx: -3, dy: 0 },
        ]
        for (const { dx, dy } of offsets) {
          const rx = cx + dx, ry = cy + dy
          g.fillPoints([
            { x: rx, y: ry - DS },
            { x: rx + DS, y: ry },
            { x: rx, y: ry + DS },
            { x: rx - DS, y: ry },
          ], true)
        }
      }
    }
    // Steel plate joint grid lines every 48px
    g.lineStyle(1.0, 0x3a4858, 0.14)
    for (let jy = floorY; jy <= floorY + floorH; jy += 48) {
      g.lineBetween(floorX, jy, floorX + floorW, jy)
    }
    for (let jx = floorX; jx <= floorX + floorW; jx += 48) {
      g.lineBetween(jx, floorY, jx, floorY + floorH)
    }
    // Bolt circles at plate corners
    g.fillStyle(0x4a5a6a, 0.25)
    for (let by = floorY; by <= floorY + floorH; by += 48) {
      for (let bx = floorX; bx <= floorX + floorW; bx += 48) {
        g.fillCircle(bx, by, 2.0)
      }
    }

    // Rug — themed by directory type
    const rugInsetX = 8
    const rugInsetY = 10
    g.fillStyle(roomStyle.rug, 0.12)
    g.fillRoundedRect(
      floorX + rugInsetX,
      floorY + rugInsetY,
      Math.max(floorW - rugInsetX * 2, 12),
      Math.max(floorH - rugInsetY * 2, 12),
      6,
    )

    // Rug interior pattern — varies by template type for visual variety
    const rugX = floorX + rugInsetX
    const rugY = floorY + rugInsetY
    const rugW = Math.max(floorW - rugInsetX * 2, 12)
    const rugH = Math.max(floorH - rugInsetY * 2, 12)
    const rugStyle = this.hashToken(template.type) % 3
    if (rugStyle === 0) {
      // Diamond lattice
      g.lineStyle(1, roomStyle.rug, 0.15)
      g.strokeRect(rugX + 2, rugY + 2, rugW - 4, rugH - 4)
      for (let dr = 0; dr < Math.ceil(rugH / 6); dr++) {
        for (let dc = 0; dc < Math.ceil(rugW / 6); dc++) {
          const a = (dr + dc) % 2 === 0 ? 0.08 : 0.12
          g.fillStyle(roomStyle.rug, a)
          const dx = rugX + dc * 6, dy = rugY + dr * 6
          g.fillPoints([{x:dx,y:dy-3},{x:dx+3,y:dy},{x:dx,y:dy+3},{x:dx-3,y:dy}], true)
        }
      }
    } else if (rugStyle === 1) {
      // Horizontal stripe
      for (let s = 0; s < Math.ceil(rugH / 4); s++) {
        g.fillStyle(roomStyle.rug, s % 2 === 0 ? 0.08 : 0.14)
        g.fillRect(rugX, rugY + s * 4, rugW, Math.min(4, rugH - s * 4))
      }
      g.lineStyle(1, roomStyle.rug, 0.1)
      for (let fx = 0; fx < Math.floor(rugW / 4); fx++) {
        const lx = rugX + fx * 4
        g.lineBetween(lx, rugY, lx, rugY + 3)
        g.lineBetween(lx, rugY + rugH - 3, lx, rugY + rugH)
      }
    } else {
      // Concentric medallion with corner brackets
      const mcx = rugX + rugW / 2, mcy = rugY + rugH / 2
      const or2 = Math.min(rugW, rugH) * 0.3
      g.fillStyle(roomStyle.rug, 0.1); g.fillCircle(mcx, mcy, or2)
      g.fillStyle(roomStyle.rug, 0.06); g.fillCircle(mcx, mcy, or2 * 0.6)
      g.lineStyle(1, roomStyle.rug, 0.2)
      g.lineBetween(rugX+2,rugY+7,rugX+2,rugY+2); g.lineBetween(rugX+2,rugY+2,rugX+7,rugY+2)
      g.lineBetween(rugX+rugW-7,rugY+2,rugX+rugW-2,rugY+2); g.lineBetween(rugX+rugW-2,rugY+2,rugX+rugW-2,rugY+7)
      g.lineBetween(rugX+2,rugY+rugH-7,rugX+2,rugY+rugH-2); g.lineBetween(rugX+2,rugY+rugH-2,rugX+7,rugY+rugH-2)
      g.lineBetween(rugX+rugW-7,rugY+rugH-2,rugX+rugW-2,rugY+rugH-2); g.lineBetween(rugX+rugW-2,rugY+rugH-2,rugX+rugW-2,rugY+rugH-7)
    }

    // Drop-ceiling grid in the header zone (subtle lines before the solid header paints over)
    g.lineStyle(0.5, roomStyle.wallInner, 0.15)
    const CEIL_GRID = 16
    const headerAreaY = -h / 2 + WALL_T + WALL_I
    const headerAreaBottom = headerAreaY + ROOM_HEADER_H
    for (let cy = headerAreaY; cy <= headerAreaBottom; cy += CEIL_GRID) {
      g.lineBetween(floorX, cy, floorX + floorW, cy)
    }
    for (let cx = floorX; cx <= floorX + floorW; cx += CEIL_GRID) {
      g.lineBetween(cx, headerAreaY, cx, headerAreaBottom)
    }

    // Header bar — gradient simulation via 3 overlapping rects (dark base to lighter top)
    const hBarX = -w / 2 + WALL_T + WALL_I
    const hBarY = -h / 2 + WALL_T + WALL_I
    g.fillStyle(roomStyle.header, 1)
    g.fillRect(hBarX, hBarY, floorW, ROOM_HEADER_H)
    g.fillStyle(roomStyle.wallOuter, 0.12)
    g.fillRect(hBarX, hBarY + Math.floor(ROOM_HEADER_H * 0.4), floorW, Math.ceil(ROOM_HEADER_H * 0.6))
    g.fillStyle(0xffffff, 0.06)
    g.fillRect(hBarX, hBarY, floorW, 2)

    // Room icon — line-drawn icon left of the room label, slot driven by label hash
    const iconSlot = this.hashToken(room.teamKey || room.label) % 3
    const iconX = hBarX + 6
    const iconY = hBarY + Math.floor(ROOM_HEADER_H / 2)
    g.lineStyle(1.5, roomStyle.accent, 0.5)
    if (iconSlot === 0) {
      // Code brackets < >
      g.lineBetween(iconX,     iconY - 3, iconX - 3, iconY)
      g.lineBetween(iconX - 3, iconY,     iconX,     iconY + 3)
      g.lineBetween(iconX + 5, iconY - 3, iconX + 8, iconY)
      g.lineBetween(iconX + 8, iconY,     iconX + 5, iconY + 3)
    } else if (iconSlot === 1) {
      // Terminal prompt > _
      g.lineBetween(iconX,     iconY - 3, iconX + 3, iconY)
      g.lineBetween(iconX + 3, iconY,     iconX,     iconY + 3)
      g.lineBetween(iconX + 5, iconY + 3, iconX + 9, iconY + 3)
    } else {
      // Folder icon
      g.lineBetween(iconX,     iconY + 3, iconX,     iconY - 1)
      g.lineBetween(iconX,     iconY - 1, iconX + 3, iconY - 1)
      g.lineBetween(iconX + 3, iconY - 1, iconX + 4, iconY - 3)
      g.lineBetween(iconX + 4, iconY - 3, iconX + 9, iconY - 3)
      g.lineBetween(iconX + 9, iconY - 3, iconX + 9, iconY + 3)
      g.lineBetween(iconX + 9, iconY + 3, iconX,     iconY + 3)
    }

    // Room number plate on the left side of the header bar
    const roomIndex = this.hashToken(room.teamKey || room.cwd || room.label) % 99
    const plateW = 16
    const plateH = 10
    const plateX = -w / 2 + WALL_T + WALL_I + 4
    const plateY = -h / 2 + WALL_T + WALL_I + (ROOM_HEADER_H - plateH) / 2
    g.fillStyle(roomStyle.wallOuter, 0.5)
    g.fillRoundedRect(plateX, plateY, plateW, plateH, 2)
    g.lineStyle(1, roomStyle.accent, 0.4)
    g.strokeRoundedRect(plateX, plateY, plateW, plateH, 2)

    // Accent line beneath the header
    g.lineStyle(2, roomStyle.accent, 0.72)
    g.lineBetween(
      -w / 2 + WALL_T + WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
      w / 2 - WALL_T - WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
    )

    // Status strip — separate Graphics object just below the accent line.
    // Recreated here so drawRoomBackground is idempotent on resize.
    // updateRoomActivity drives tweened width and color.
    if (room.statusStrip) {
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
      room.statusStrip.destroy()
      room.statusStrip = null
    }
    {
      const sg = this.scene.add.graphics()
      sg.fillStyle(0x64748b, 0.4)
      sg.fillRect(hBarX, hBarY + ROOM_HEADER_H + 1, floorW, 2)
      room.container.add(sg)
      room.statusStrip = sg
    }

    // Baseboard molding — 2px strip along all 4 edges of the floor area
    const baseH = 2
    g.fillStyle(roomStyle.wallOuter, 0.3)
    g.fillRect(floorX, floorY, floorW, baseH)
    g.fillRect(floorX, floorY + floorH - baseH, floorW, baseH)
    g.fillRect(floorX, floorY, baseH, floorH)
    g.fillRect(floorX + floorW - baseH, floorY, baseH, floorH)

    // Inner shadow strips along the top and left walls (0.08 to 0.02 alpha gradient)
    g.fillStyle(0x000000, 0.08)
    g.fillRect(floorX, floorY, floorW, 3)
    g.fillRect(floorX, floorY, 3, floorH)
    g.fillStyle(0x000000, 0.05)
    g.fillRect(floorX, floorY + 1, floorW, 2)
    g.fillRect(floorX + 1, floorY, 2, floorH)
    g.fillStyle(0x000000, 0.02)
    g.fillRect(floorX, floorY + 2, floorW, 1)
    g.fillRect(floorX + 2, floorY, 1, floorH)

    // Back-wall window (only for rooms with sufficient vertical space)
    if (floorH > 140) {
      const winW = 20
      const winH = 8
      const winX = floorX + (floorW - winW) / 2
      const winY = floorY + 8
      g.fillStyle(this.host.atmosphere.windowTintColor, this.host.atmosphere.windowTintAlpha * 1.5)
      g.fillRect(winX, winY, winW, winH)

      // ── Tiny scenic view through the window ──────────────────────────────
      // Layers drawn bottom-to-top inside the window bounds so they composite
      // naturally before the frame, mullions, and curtains are painted over.
      if (this.host.atmosphere.currentTimePhase === 'day' || this.host.atmosphere.currentTimePhase === 'morning') {
        // Pale blue sky wash across the full pane
        g.fillStyle(0x7dd3fc, 0.06)
        g.fillRect(winX, winY, winW, winH)
        // Green hill — squat ellipse sitting just below the sill
        g.fillStyle(0x166534, 0.08)
        g.fillEllipse(winX + winW / 2, winY + winH + 1, winW * 0.9, 6)
        // Tiny sun dot in the upper-right quadrant
        g.fillStyle(0xfde68a, 0.10)
        g.fillCircle(winX + winW - 3, winY + 2, 1)
      } else if (this.host.atmosphere.currentTimePhase === 'night') {
        // Dark sky wash
        g.fillStyle(0x0f172a, 0.08)
        g.fillRect(winX, winY, winW, winH)
        // Three scattered star dots
        g.fillStyle(0xffffff, 0.08)
        g.fillCircle(winX + 4, winY + 2, 0.5)
        g.fillCircle(winX + 11, winY + 1, 0.5)
        g.fillCircle(winX + 16, winY + 3, 0.5)
        // Tiny crescent moon — bright circle with a dark bite taken out
        g.fillStyle(0xfef3c7, 0.08)
        g.fillCircle(winX + 15, winY + 2, 1.5)
        g.fillStyle(0x0f172a, 0.08)
        g.fillCircle(winX + 16, winY + 2, 1.2)
      } else {
        // Evening — warm orange sky tint
        g.fillStyle(0xf97316, 0.05)
        g.fillRect(winX, winY, winW, winH)
        // Dark silhouette hill at the base
        g.fillStyle(0x1e293b, 0.06)
        g.fillEllipse(winX + winW / 2, winY + winH + 1, winW * 0.9, 6)
      }
      // ─────────────────────────────────────────────────────────────────────

      g.lineStyle(1, 0x475569, 0.8)
      g.strokeRect(winX, winY, winW, winH)
      g.lineStyle(1, 0x475569, 0.5)
      g.lineBetween(winX + winW / 2, winY, winX + winW / 2, winY + winH)
      g.lineBetween(winX, winY + winH / 2, winX + winW, winY + winH / 2)
      g.fillStyle(this.host.atmosphere.windowTintColor, 0.04)
      g.fillRect(winX - 4, winY + winH, winW + 8, 10)

      // Curtain rod above window
      g.lineStyle(1, 0x64748b, 0.3)
      g.lineBetween(winX - 2, winY - 1, winX + winW + 2, winY - 1)

      // Left curtain panel
      g.fillStyle(0x475569, 0.4)
      g.fillRect(winX, winY, 3, winH)

      // Right curtain panel
      g.fillRect(winX + winW - 3, winY, 3, winH)

      // Venetian blind lines (very subtle horizontal lines across the window)
      g.lineStyle(1, 0x475569, 0.1)
      for (let bl = 0; bl < 3; bl++) {
        const blindY = winY + 2 + bl * 2.5
        g.lineBetween(winX, blindY, winX + winW, blindY)
      }
    }

    // Door is now drawn in separate graphics objects so it can be animated.
    this.drawDoorPanel(room, floorW, roomStyle.accent)

    // Industrial detail overlays (vent grates, pipes, brackets)
    this.drawIndustrialDetail(g, floorX, floorY, floorW, floorH, room.cwd)

    // Stash room index for downstream use
    ;(room as unknown as Record<string, unknown>)._roomIndex = roomIndex

    this.refreshRoomHeaderText(room)
  }

  // -------------------------------------------------------------------------
  // Door panel drawing and animation
  // -------------------------------------------------------------------------

  drawDoorPanel(room: Room, floorW: number, accentColor: number): void {
    const h = room.height
    const WALL_T = 3
    const WALL_I = 1
    const doorW = Math.max(20, Math.min(34, floorW * 0.22))
    const doorH = 12
    const doorLeftX = -doorW / 2
    // Bottom door: near bottom wall. Top door: near top wall (below header).
    const doorY = room.doorSide === 'top'
      ? -h / 2 + WALL_T + WALL_I + 16  // below header area
      : h / 2 - WALL_T - WALL_I - doorH

    // Frame drawn in container space — static, does not scale with swing.
    const fg = room.doorFrameGraphics
    fg.clear()
    fg.setPosition(0, 0)
    fg.fillStyle(accentColor, 0.75)
    fg.fillRoundedRect(doorLeftX - 2, doorY - 2, doorW + 4, doorH + 4, 3)

    // Panel: positioned with local x=0 at the hinge (left) edge so that
    // tweening scaleX shrinks/expands the door from the hinge outward.
    const dg = room.doorGraphics
    dg.clear()
    dg.setPosition(doorLeftX, 0)
    dg.fillStyle(COLOR_DOOR_FILL, 1)
    dg.fillRoundedRect(0, doorY, doorW, doorH, 2)
    dg.fillStyle(accentColor, 0.45)
    dg.fillRect(4, doorY + 2, Math.max(doorW - 8, 4), 2)
    dg.lineStyle(1, accentColor, 0.3)
    dg.lineBetween(doorW / 2, doorY + 1, doorW / 2, doorY + doorH - 1)
    // Gold handle near latch side
    dg.fillStyle(0xfbbf24, 1)
    dg.fillCircle(doorW - 4, doorY + doorH / 2, 1.5)
    // Reset scale in case a previous swing left it at 0.3
    dg.setScale(1, 1)
  }

  triggerDoorAnimation(room: Room): void {
    const dg = room.doorGraphics
    if (!dg || !dg.active) return
    this.scene.tweens.killTweensOf(dg)
    dg.setScale(1, 1)
    this.scene.tweens.add({
      targets: dg,
      scaleX: 0.3,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: dg,
          scaleX: 1,
          delay: 500,
          duration: 300,
          ease: 'Quad.easeIn',
        })
      },
    })
  }

  updateDoorGlow(room: Room): void {
    if (!room.doorFrameGraphics || !room.doorFrameGraphics.active) return
    const hasAgents = room.agents.length > 0
    if (hasAgents) {
      if (room.doorPulseTween) return
      room.doorFrameGraphics.setAlpha(0.75)
      room.doorPulseTween = this.scene.tweens.add({
        targets: room.doorFrameGraphics,
        alpha: { from: 0.5, to: 0.9 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      if (room.doorPulseTween) {
        room.doorPulseTween.destroy()
        room.doorPulseTween = null
      }
      room.doorFrameGraphics.setAlpha(0.75)
    }
  }

  // -------------------------------------------------------------------------
  // Industrial detail — vent grates, pipes, brackets
  // -------------------------------------------------------------------------

  private drawIndustrialDetail(
    g: Phaser.GameObjects.Graphics,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
    roomCwd: string,
  ): void {
    // Use a hash of the cwd to vary which details appear
    const h = this.hashToken(roomCwd)
    const showVents = (h % 3) !== 2        // ~2/3 of rooms get vents
    const showPipe = (h % 5) !== 0         // ~4/5 of rooms get pipe
    const pipeSide = (h % 2) === 0 ? 'left' : 'right'

    // Vent grates along the top wall (near ceiling)
    if (showVents) {
      const ventW = 22
      const ventH = 8
      const ventY = floorY + 4
      const ventSpacing = Math.floor(floorW / 3)
      for (let vi = 0; vi < 2; vi++) {
        const ventX = floorX + ventSpacing * (vi + 0.5) - ventW / 2
        // Dark vent body
        g.fillStyle(0x1a2230, 0.525)
        g.fillRect(ventX, ventY, ventW, ventH)
        // Louver bars (3-4 vertical bars)
        g.lineStyle(1.5, 0x3a4858, 0.375)
        const louverCount = 3 + (h % 2)
        const louverGap = ventW / (louverCount + 1)
        for (let li = 1; li <= louverCount; li++) {
          const lx = ventX + li * louverGap
          g.lineBetween(lx, ventY + 1, lx, ventY + ventH - 1)
        }
        // Thin border
        g.lineStyle(0.5, 0x4a5a6a, 0.225)
        g.strokeRect(ventX, ventY, ventW, ventH)
      }
    }

    // Horizontal pipe run along one wall interior
    if (showPipe) {
      const pipeW = 6
      const pipeX = pipeSide === 'left' ? floorX + 2 : floorX + floorW - 2 - pipeW
      const pipeStartY = floorY + 12
      const pipeEndY = floorY + floorH - 8
      const pipeLen = pipeEndY - pipeStartY
      if (pipeLen > 20) {
        // Main pipe body
        g.fillStyle(0x3a4858, 0.30)
        g.fillRect(pipeX, pipeStartY, pipeW, pipeLen)
        // Highlight stripe (2px)
        g.fillStyle(0x64748b, 0.18)
        g.fillRect(pipeX + 1, pipeStartY, 2, pipeLen)
        // Bracket mounts (2-3 along the pipe)
        const bracketCount = pipeLen > 60 ? 3 : 2
        g.fillStyle(0x4a5a6a, 0.35)
        for (let bi = 0; bi < bracketCount; bi++) {
          const by = pipeStartY + ((bi + 1) * pipeLen) / (bracketCount + 1)
          g.fillRect(pipeX - 2, by - 2, pipeW + 4, 4)
        }
      }
    }
  }

  refreshRoomHeaderText(room: Room): void {
    // Clean up previous header glow FX and tween before rebuilding
    if (room.headerGlowTween) { room.headerGlowTween.destroy(); room.headerGlowTween = undefined }
    if (room.headerGlowFx) { room.headerGlowFx = undefined }

    const existing = room.container.getByName('headerText') as Phaser.GameObjects.Text | null
    if (existing) existing.destroy()
    const existingBloom = room.container.getByName('headerAccentBloom') as Phaser.GameObjects.Graphics | null
    if (existingBloom) existingBloom.destroy()

    const WALL_T = 8
    const WALL_I = 4
    const headerY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H / 2

    const headerText = this.scene.add.text(
      0,
      headerY,
      this.host.formatLabel(room.label),
      {
        fontSize: '14px', color: activeTheme.headerText,
        fontFamily: 'system-ui, monospace', fontStyle: 'bold', align: 'center',
        resolution: 2,
      },
    ).setOrigin(0.5, 0.5).setName('headerText')
    room.container.add(headerText)

    // Neon signage glow on header text
    const glowFx = headerText.postFX.addGlow(0x00ff88, 2, 0, false, 0.08, 10)
    room.headerGlowFx = glowFx
    room.headerGlowTween = this.scene.tweens.add({
      targets: glowFx,
      outerStrength: { from: 2.5, to: 5.0 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Bloom accent line beneath the header — draw a wider, low-alpha duplicate for glow effect
    {
      const accentLineY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H
      const template = getTemplate(getRoomType(room.cwd))
      const lineX1 = -room.width / 2 + 3 + 1  // WALL_T=3, WALL_I=1 from drawRoomBackground
      const lineX2 = room.width / 2 - 3 - 1
      const bloomG = this.scene.add.graphics()
      bloomG.setName('headerAccentBloom')
      bloomG.lineStyle(8, template.accentColor, 0.20)
      bloomG.lineBetween(lineX1, accentLineY, lineX2, accentLineY)
      room.container.add(bloomG)
    }

    // Destroy existing badge, dot, and dot tween before rebuilding
    const badgeExisting = room.container.getByName('agentBadge') as Phaser.GameObjects.Text | null
    if (badgeExisting) badgeExisting.destroy()
    const dotExisting = room.container.getByName('badgeDot') as Phaser.GameObjects.Arc | null
    if (dotExisting) dotExisting.destroy()
    if (room.badgeDotTween) { room.badgeDotTween.destroy(); room.badgeDotTween = null }

    // Determine activity state for dot color
    const workingCount = room.agents.filter(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    ).length
    const waitingCount = room.agents.filter(a => a.needsInteraction).length
    const isActive = workingCount > 0
    const isWaiting = waitingCount > 0
    const dotColor = isWaiting ? 0xfbbf24 : isActive ? 0x34d399 : 0x3a4858

    // Small filled circle left of the count number
    const badgeRightX = room.width / 2 - WALL_T - WALL_I - 8
    const dot = this.scene.add.circle(badgeRightX - 18, headerY, 2.5, dotColor, isActive || isWaiting ? 0.9 : 0.5)
    dot.setName('badgeDot')
    room.container.add(dot)

    // Pulse the dot when agents are active or waiting
    if (isActive || isWaiting) {
      room.badgeDotTween = this.scene.tweens.add({
        targets: dot,
        alpha: { from: 0.4, to: 0.95 },
        duration: isWaiting ? 500 : 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Agent count badge — text color reflects activity state
    const badge = this.scene.add.text(
      badgeRightX,
      headerY,
      `${room.agents.length}`,
      {
        fontSize: '11px',
        color: isActive ? '#00e5ff' : isWaiting ? '#fbbf24' : '#3a4858',
        fontFamily: 'system-ui, monospace',
        backgroundColor: '#0a0e14cc',
        padding: { x: 5, y: 2 },
        resolution: 2,
      },
    ).setOrigin(1, 0.5).setName('agentBadge')
    room.container.add(badge)
  }
}
