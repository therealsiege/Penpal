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
  COLOR_DOOR_FILL,
  ROOM_HEADER_H,
} from './office-constants'
import { SPRITESHEET_KEYS, ICON_FRAMES, ITEM_FRAMES, EFFECT_ANIM_KEYS, LEGO_FRAMES, LAB_TILESET_FRAMES, LAB_SMOOTH_FRAMES, PIPE_FRAMES, CABLE_FRAMES } from './office-asset-keys'
import { LAB_TILE_SIZE } from './office-constants'
import { ROOM_HEADER_ITEM } from './workstation-creation'
import { LAB_PROP_FRAMES as LP } from './lab-prop-frames.generated'
import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Host-scene interface — only the properties/methods OfficeRooms needs
// ---------------------------------------------------------------------------

export interface RoomsHostScene {
  atmosphere: OfficeAtmosphere
  calcRoomSize(agentCount: number, cwd?: string): { width: number; height: number }
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
    const { width, height } = this.host.calcRoomSize(agents.length, cwd)
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
    const ledY = height / 2 - ledWallT - ledWallI - ROOM_HEADER_H / 2
    const statusLedGlow = this.scene.add
      .sprite(ledX, ledY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
      .setScale(0.25)
      .setAlpha(0.15)
      .setBlendMode(Phaser.BlendModes.ADD)
    container.add(statusLedGlow)
    const statusLed = this.scene.add
      .sprite(ledX, ledY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
      .setScale(0.19)
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
    const { width, height } = this.host.calcRoomSize(agents.length, room.cwd)
    const sizeChanged = width !== room.width || height !== room.height
    if (sizeChanged) {
      // Animate the room container scale from old proportions to new, then snap
      const oldW = room.width
      const oldH = room.height
      room.width  = width
      room.height = height
      this.drawRoomBackground(room)
      // Start scaled to old proportions, tween to 1.0 over 300ms
      const scaleX = oldW / Math.max(width, 1)
      const scaleY = oldH / Math.max(height, 1)
      room.container.setScale(scaleX, scaleY)
      this.scene.tweens.add({
        targets: room.container,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Sine.easeOut',
      })
    } else {
      room.width  = width
      room.height = height
    }
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
    if (room.statusStripPulseTween) room.statusStripPulseTween.destroy()
    if (room.badgeDotTween) room.badgeDotTween.destroy()
    if (room.heatTween) room.heatTween.destroy()
    if (room.heatBreathTween) room.heatBreathTween.destroy()
    if (room.heatOverlay) room.heatOverlay.destroy()
    if (room.headerGlowTween) room.headerGlowTween.destroy()
    room.headerGlowFx = undefined
    if (room.roomHeaderIcon) { room.roomHeaderIcon.destroy(); room.roomHeaderIcon = undefined }
    if (room.headerLegoBricks) {
      for (const b of room.headerLegoBricks) b.destroy()
      room.headerLegoBricks = undefined
    }
    if (room.headerStatusDotTweens) {
      for (const t of room.headerStatusDotTweens) t.destroy()
      room.headerStatusDotTweens = []
    }
    if (room.headerStatusDots) {
      for (const s of room.headerStatusDots) s.destroy()
      room.headerStatusDots = []
    }
    if (room.floorTileSprites) {
      for (const s of room.floorTileSprites) s.destroy()
      room.floorTileSprites = []
    }
    if (room.wallTileSprites) {
      for (const s of room.wallTileSprites) s.destroy()
      room.wallTileSprites = []
    }
    if (room.cornerTileSprites) {
      for (const s of room.cornerTileSprites) s.destroy()
      room.cornerTileSprites = []
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

    // Directory-based theming — deterministic colors per room type
    const template = getTemplate(getRoomType(room.cwd))
    const roomStyle = {
      floorGrid: template.rugColor,
      header: COLOR_HEADER_BG,
      accent: template.accentColor,
    }

    // ── Room area bounds — tileset covers the entire room including walls ──
    const floorX = -w / 2
    const floorY = -h / 2
    const floorW = w
    const floorH = h - ROOM_HEADER_H

    // ── PRIMARY VISUAL: Autotiled lab room (floor + walls + corners + equipment) ──
    this.tileHexFloor(room, floorX, floorY, floorW, floorH, roomStyle)

    // ── Header bar at the bottom of the room ──
    const hBarX = -w / 2
    const hBarY = h / 2 - ROOM_HEADER_H
    g.fillStyle(roomStyle.header, 1)
    g.fillRect(hBarX, hBarY, w, ROOM_HEADER_H)
    // Subtle gradient overlay on header
    g.fillStyle(0x0a1628, 0.3)
    g.fillRect(hBarX, hBarY, w, Math.ceil(ROOM_HEADER_H * 0.6))
    g.fillStyle(0xffffff, 0.06)
    g.fillRect(hBarX, hBarY + ROOM_HEADER_H - 2, w, 2)

    // Accent line above the header
    g.lineStyle(2, roomStyle.accent, 0.72)
    g.lineBetween(hBarX, hBarY, hBarX + w, hBarY)

    // Room number plate
    const roomIndex = this.hashToken(room.teamKey || room.cwd || room.label) % 99
    const plateW = 16
    const plateH = 10
    const plateX = hBarX + 4
    const plateY = hBarY + (ROOM_HEADER_H - plateH) / 2
    g.fillStyle(0x0d1b2a, 0.5)
    g.fillRoundedRect(plateX, plateY, plateW, plateH, 2)
    g.lineStyle(1, roomStyle.accent, 0.4)
    g.strokeRoundedRect(plateX, plateY, plateW, plateH, 2)

    // Status strip
    if (room.statusStrip) {
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
      room.statusStrip.destroy()
      room.statusStrip = null
    }
    {
      const sg = this.scene.add.graphics()
      sg.fillStyle(0x64748b, 0.4)
      sg.fillRect(hBarX, hBarY - 3, w, 2)
      room.container.add(sg)
      room.statusStrip = sg
    }

    // Door panel
    const doorFloorW = w
    this.drawDoorPanel(room, doorFloorW, roomStyle.accent)

    // ── Lab detail layers — pipes, cables, props ──
    this.tilePipeDetail(room, floorX, floorY, floorW, floorH)
    this.tileCableDetail(room, floorX, floorY, floorW, floorH)
    this.tileLabProps(room, floorX, floorY, floorW, floorH)
    this.placeFloorGlowLights(room, floorX, floorY, floorW, floorH)

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
    const doorW = Math.max(24, Math.min(50, floorW * 0.28))
    const doorH = Math.max(14, Math.min(20, h * 0.08))
    const doorLeftX = -doorW / 2
    // Top door: near top wall. Bottom door: near bottom wall (above header).
    const doorY = room.doorSide === 'top'
      ? -h / 2 + WALL_T + WALL_I
      : h / 2 - WALL_T - WALL_I - ROOM_HEADER_H - doorH

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
    dg.setAngle(0)

    // Spawn a small puff VFX at the door position when it swings open
    this.spawnDoorPuff(room)

    // Door shadow — simulates the door swinging into the room
    const WALL_T = 3
    const WALL_I = 1
    const floorW = room.width - (WALL_T + WALL_I) * 2
    const doorW = Math.max(24, Math.min(50, floorW * 0.28))
    const doorH = Math.max(14, Math.min(20, room.height * 0.08))
    const doorY = room.doorSide === 'top'
      ? -room.height / 2 + WALL_T + WALL_I + doorH / 2
      : room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H - doorH / 2
    const doorShadow = this.scene.add.rectangle(5, doorY, 8, doorH, 0x000000, 0.15)
    room.container.add(doorShadow)
    this.scene.tweens.add({
      targets: doorShadow,
      alpha: 0,
      duration: 600,
      delay: 400,
      onComplete: () => { try { doorShadow.destroy() } catch { /* gone */ } },
    })

    // Open: scale + rotation with spring ease
    this.scene.tweens.add({
      targets: dg,
      scaleX: 0.3,
      angle: -12,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Close: bounce back into place
        this.scene.tweens.add({
          targets: dg,
          scaleX: 1,
          angle: 0,
          delay: 500,
          duration: 400,
          ease: 'Bounce.easeOut',
        })
      },
    })
  }

  /** Spawn a puff sprite effect at the room door location. */
  private spawnDoorPuff(room: Room): void {
    if (!this.scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) return

    const WALL_T = 3
    const WALL_I = 1
    const floorW = room.width - (WALL_T + WALL_I) * 2
    const doorW = Math.max(24, Math.min(50, floorW * 0.28))
    const doorH = Math.max(14, Math.min(20, room.height * 0.08))
    // Door center in container-local coords
    const doorCX = 0
    const doorCY = room.doorSide === 'top'
      ? -room.height / 2 + WALL_T + WALL_I + doorH / 2
      : room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H - doorH / 2

    // Convert to world coords via room container position
    const worldX = room.container.x + doorCX
    const worldY = room.container.y + doorCY

    const puff = this.scene.add.sprite(worldX, worldY, SPRITESHEET_KEYS.EFFECTS_PUFF)
      .setDepth(200)
      .setScale(0.22)
      .setAlpha(0.4)
    puff.play(EFFECT_ANIM_KEYS.PUFF)
    puff.once('animationcomplete', () => puff.destroy())

    // Second smaller puff offset to the hinge side for a wispy feel
    const hingeX = worldX - doorW / 2
    const puff2 = this.scene.add.sprite(hingeX, worldY, SPRITESHEET_KEYS.EFFECTS_PUFF)
      .setDepth(200)
      .setScale(0.15)
      .setAlpha(0.25)
    puff2.play(EFFECT_ANIM_KEYS.PUFF)
    puff2.once('animationcomplete', () => puff2.destroy())

    // Door burst — 3-4 small circle sprites fanning outward from the door
    const burstCount = 3 + Math.floor(Math.random() * 2)
    const arcStart = room.doorSide === 'top' ? Math.PI * 0.25 : -Math.PI * 0.75
    const arcSpan = Math.PI * 0.5
    for (let bi = 0; bi < burstCount; bi++) {
      const angle = arcStart + (bi / (burstCount - 1)) * arcSpan
      const burst = this.scene.add.sprite(worldX, worldY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.18).setAlpha(0.5).setDepth(200)
      this.scene.tweens.add({
        targets: burst,
        x: worldX + Math.cos(angle) * 20,
        y: worldY + Math.sin(angle) * 20,
        alpha: 0,
        scale: 0.03,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => { try { burst.destroy() } catch { /* gone */ } },
      })
    }
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
  // Hex floor tiling — sprite-based hex floor replacing procedural pattern
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Autotile room — unified grid-based tilemap using correct frame assignments
  // -------------------------------------------------------------------------

  private tileHexFloor(
    room: Room,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
    _roomStyle: { floorGrid: number },
  ): void {
    // Clean up previous sprites
    if (room.floorTileSprites) { for (const s of room.floorTileSprites) s.destroy() }
    room.floorTileSprites = []
    if (room.wallTileSprites) { for (const s of room.wallTileSprites) s.destroy() }
    room.wallTileSprites = []
    if (room.cornerTileSprites) { for (const s of room.cornerTileSprites) s.destroy() }
    room.cornerTileSprites = []

    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_MAIN_TILESET)) return

    // ── Autotile: single grid covering the entire floor area ──
    // 128px tiles scaled to fit. Grid is fitted WITHIN room bounds
    // (floor division) and centered so tiles don't overflow.
    const tileScale = 0.35
    const step = LAB_TILE_SIZE * tileScale  // ~45px

    const cols = Math.max(4, Math.floor(floorW / step))
    const rows = Math.max(4, Math.floor(floorH / step))
    const hash = this.hashToken(room.cwd)

    // Center the grid within the floor area
    const gridW = cols * step
    const gridH = rows * step
    const offsetX = floorX + (floorW - gridW) / 2
    const offsetY = floorY + (floorH - gridH) / 2

    // Console equipment along inner wall edges (1 tile in from wall)
    const consolePositions = new Set<string>()
    if (cols > 4 && rows > 4) {
      const cCount = Math.min(3, Math.floor((cols + rows) / 6))
      for (let i = 0; i < cCount; i++) {
        const ch = (hash + i * 17) % 4
        if (ch === 0 && rows > 4)      consolePositions.add(`1,${2 + ((hash + i * 3) % Math.max(1, rows - 4))}`)
        else if (ch === 1 && rows > 4)  consolePositions.add(`${cols - 2},${2 + ((hash + i * 7) % Math.max(1, rows - 4))}`)
        else if (ch === 2 && cols > 4)  consolePositions.add(`${2 + ((hash + i * 5) % Math.max(1, cols - 4))},1`)
        else if (ch === 3 && cols > 4)  consolePositions.add(`${2 + ((hash + i * 11) % Math.max(1, cols - 4))},${rows - 2}`)
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isTop = r === 0
        const isBottom = r === rows - 1
        const isLeft = c === 0
        const isRight = c === cols - 1

        let frame: number

        // ── Corners ──
        if (isTop && isLeft)          frame = LAB_TILESET_FRAMES.CORNER_TL
        else if (isTop && isRight)    frame = LAB_TILESET_FRAMES.CORNER_TR
        else if (isBottom && isLeft)  frame = LAB_TILESET_FRAMES.CORNER_BL
        else if (isBottom && isRight) frame = LAB_TILESET_FRAMES.CORNER_BR
        // ── Edges ──
        else if (isTop)    frame = LAB_TILESET_FRAMES.WALL_TOP
        else if (isBottom) {
          // Occasional window accent on bottom wall
          const bottomAccent = (hash + c * 3) % 6
          if (bottomAccent === 0 && c > 0 && c < cols - 1) frame = LAB_TILESET_FRAMES.WALL_BOTTOM_WINDOW_A
          else frame = LAB_TILESET_FRAMES.WALL_BOTTOM
        }
        else if (isLeft)   frame = LAB_TILESET_FRAMES.WALL_LEFT
        else if (isRight)  frame = LAB_TILESET_FRAMES.WALL_RIGHT
        // ── Console equipment ──
        else if (consolePositions.has(`${c},${r}`)) {
          if (c === 1)               frame = LAB_TILESET_FRAMES.CONSOLE_LEFT
          else if (c === cols - 2)   frame = LAB_TILESET_FRAMES.CONSOLE_RIGHT
          else if (r === 1)          frame = LAB_TILESET_FRAMES.CONSOLE_TOP
          else                       frame = LAB_TILESET_FRAMES.CONSOLE_SMALL
        }
        // ── Interior floor ──
        else {
          const cellHash = (hash + r * 7 + c * 13) % 25
          if (cellHash === 0 && r > 1 && c > 1 && r < rows - 2 && c < cols - 2) {
            frame = LAB_TILESET_FRAMES.FLOOR_FEATURE
          } else {
            const floorVariant = (r + c + hash) % 5
            if (floorVariant === 0)      frame = LAB_TILESET_FRAMES.HEX_FLOOR_B
            else if (floorVariant === 3)  frame = LAB_TILESET_FRAMES.HEX_FLOOR_C
            else                          frame = LAB_TILESET_FRAMES.HEX_FLOOR_A
          }
        }

        const tx = offsetX + c * step + step / 2
        const ty = offsetY + r * step + step / 2

        const tile = this.scene.add.sprite(tx, ty, SPRITESHEET_KEYS.LAB_MAIN_TILESET, frame)
          .setScale(tileScale)
          .setAlpha(0.90)
          .setDepth(-2.5)
        room.container.add(tile)
        room.floorTileSprites!.push(tile)
      }
    }
  }

  // tileWallEdges is now handled by the autotiler above — this is a no-op
  // kept for call-site compatibility
  private tileWallEdges(
    _room: Room,
    _floorX: number,
    _floorY: number,
    _floorW: number,
    _floorH: number,
  ): void {
    // Wall edges + corners are now placed by tileHexFloor autotiler
  }

  // -------------------------------------------------------------------------
  // LOD visibility for lab tile sprites
  // -------------------------------------------------------------------------

  applyLodToRoomTiles(room: Room, lodLevel: number): void {
    const visible = lodLevel >= 2
    if (room.floorTileSprites) {
      for (const s of room.floorTileSprites) s.setVisible(visible)
    }
    if (room.wallTileSprites) {
      for (const s of room.wallTileSprites) s.setVisible(visible)
    }
    if (room.cornerTileSprites) {
      for (const s of room.cornerTileSprites) s.setVisible(visible)
    }
  }

  // -------------------------------------------------------------------------
  // Pipe detail — decorative pipe sprites along room edges
  // -------------------------------------------------------------------------

  private tilePipeDetail(
    room: Room,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PIPES)) return

    const h = this.hashToken(room.cwd)

    // Helper to add a pipe sprite with consistent styling
    const addPipe = (
      x: number, y: number, frame: number,
      scale: number, alpha: number, depth: number,
    ): void => {
      const spr = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PIPES, frame)
        .setScale(scale).setAlpha(alpha).setDepth(depth)
      room.container.add(spr)
      room.wallTileSprites!.push(spr)
    }

    // ── Interior pipe runs (scaled up for visibility) ──
    const intScale = 0.28
    const intStep = 30
    const showLeftPipe = (h % 3) !== 2
    const showBottomPipe = (h % 5) >= 2

    // Left edge interior pipe run (vertical)
    if (showLeftPipe && floorH > 100) {
      const pipeX = floorX + 14
      const startY = floorY + 50
      const endY = floorY + floorH - 50

      // Top cap
      addPipe(pipeX, startY, PIPE_FRAMES.CAP_TOP, intScale, 0.75, -1.5)

      // Vertical segments
      for (let y = startY + intStep; y < endY - intStep; y += intStep) {
        addPipe(pipeX, y, PIPE_FRAMES.VERT_LEFT, intScale, 0.75, -1.5)
      }

      // Valve near the middle
      const valveY = startY + Math.round((endY - startY) / 2)
      addPipe(pipeX, valveY, PIPE_FRAMES.VALVE, intScale * 0.85, 0.70, -1.4)
    }

    // Bottom edge interior pipe run (horizontal)
    if (showBottomPipe && floorW > 120) {
      const pipeY = floorY + floorH - 14
      const startX = floorX + 50
      const endX = floorX + floorW - 50
      for (let x = startX; x < endX; x += intStep) {
        addPipe(x, pipeY, PIPE_FRAMES.HORIZ_TOP, intScale, 0.70, -1.5)
      }
      // Coupling at midpoint
      const couplingX = startX + Math.round((endX - startX) / 2)
      addPipe(couplingX, pipeY, PIPE_FRAMES.COUPLING_HORIZ, intScale * 0.85, 0.65, -1.4)
    }

    // ── Exterior pipe runs — prominent pipes OUTSIDE room walls ──
    // Visible against team area background for a sci-fi lab aesthetic.
    const extScale = 0.25
    const extAlpha = 0.75
    const extDepth = -1.8
    const extStep = 30
    const extOffset = 12  // pixels outside room boundary

    // Determine which exterior sides this room gets (1-2 runs per room)
    const showTopExterior = (h % 7) < 4         // ~57% of rooms
    const showRightExterior = (h % 11) < 6      // ~55% of rooms

    // ── Top exterior pipe run (horizontal, above room) ──
    if (showTopExterior && floorW > 80) {
      const pipeY = floorY - extOffset
      const startX = floorX
      const endX = floorX + floorW
      const segCount = Math.max(2, Math.floor((endX - startX) / extStep))
      const valveIdx = Math.floor(segCount / 2) + (h % 3) - 1

      // Left corner elbow
      addPipe(startX, pipeY, PIPE_FRAMES.CORNER_TL, extScale, extAlpha, extDepth)

      // Horizontal segments
      for (let i = 1; i < segCount - 1; i++) {
        const sx = startX + i * extStep
        if (i === valveIdx) {
          addPipe(sx, pipeY, PIPE_FRAMES.VALVE, extScale * 0.9, extAlpha * 0.95, extDepth + 0.1)
        } else if (i === 1 && segCount > 5) {
          addPipe(sx, pipeY, PIPE_FRAMES.T_DOWN, extScale, extAlpha, extDepth)
        } else {
          const frame = (i % 4 === 0) ? PIPE_FRAMES.HORIZ_ARROW : PIPE_FRAMES.HORIZ_TOP
          addPipe(sx, pipeY, frame, extScale, extAlpha, extDepth)
        }
      }

      // Right corner elbow
      addPipe(endX - extStep, pipeY, PIPE_FRAMES.CORNER_TR, extScale, extAlpha, extDepth)
    }

    // ── Right exterior pipe run (vertical, right of room) ──
    if (showRightExterior && floorH > 80) {
      const pipeX = floorX + floorW + extOffset
      const startY = floorY
      const endY = floorY + floorH
      const segCount = Math.max(2, Math.floor((endY - startY) / extStep))
      const valveIdx = Math.floor(segCount / 2) + ((h >> 4) % 3) - 1

      // Top cap
      addPipe(pipeX, startY, PIPE_FRAMES.CAP_TOP, extScale, extAlpha, extDepth)

      // Vertical segments
      for (let i = 1; i < segCount - 1; i++) {
        const sy = startY + i * extStep
        if (i === valveIdx) {
          addPipe(pipeX, sy, PIPE_FRAMES.VALVE, extScale * 0.9, extAlpha * 0.95, extDepth + 0.1)
        } else {
          const frame = (i % 5 === 0) ? PIPE_FRAMES.VERT_ARROW : PIPE_FRAMES.VERT_RIGHT
          addPipe(pipeX, sy, frame, extScale, extAlpha, extDepth)
        }
      }

      // Bottom corner
      addPipe(pipeX, endY - extStep, PIPE_FRAMES.CORNER_BR, extScale, extAlpha, extDepth)
    }
  }

  // -------------------------------------------------------------------------
  // Cable detail — decorative cable sprites along room walls
  // -------------------------------------------------------------------------

  private tileCableDetail(
    room: Room,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_CABLES)) return

    const h = this.hashToken(room.cwd)
    let placed = 0
    const MAX_CABLES = 10

    // Helper to add a cable sprite with consistent styling
    const addCable = (
      x: number, y: number, frame: number,
      scale = 0.14, alpha = 0.45, depth = -1.3,
    ): void => {
      if (placed >= MAX_CABLES) return
      const cable = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_CABLES, frame)
        .setScale(scale).setAlpha(alpha).setDepth(depth)
      room.container.add(cable)
      room.wallTileSprites!.push(cable)
      placed++
    }

    // Frame palette — broader selection for variety
    const rightWallFrames = [
      CABLE_FRAMES.LOOP_ROUND_A, CABLE_FRAMES.LOOP_ROUND_B,
      CABLE_FRAMES.CONNECTOR_A, CABLE_FRAMES.STUB_A,
      CABLE_FRAMES.KNOT_A, CABLE_FRAMES.RECT_PLATE,
    ]
    const topWallFrames = [
      CABLE_FRAMES.HORIZ_STRAIGHT, CABLE_FRAMES.CURVE_A,
      CABLE_FRAMES.CURVE_B, CABLE_FRAMES.WAVE_A,
    ]
    const bottomWallFrames = [
      CABLE_FRAMES.CURVE_A, CABLE_FRAMES.LOOP_ROUND_B,
      CABLE_FRAMES.WAVE_A, CABLE_FRAMES.STUB_B,
      CABLE_FRAMES.KNOT_TRIPLE,
    ]
    const dotFrames = [CABLE_FRAMES.DOT_SINGLE, CABLE_FRAMES.DOT_PAIR]

    // --- Right wall cable run — loops, connectors, knots ---
    if ((h % 4) !== 3 && floorH > 100) {
      const cableX = floorX + floorW - 16
      const startY = floorY + 40
      const spacing = 35
      const count = Math.min(3, Math.floor((floorH - 80) / spacing))
      for (let i = 0; i < count; i++) {
        const frame = rightWallFrames[(h + i) % rightWallFrames.length]
        const cy = startY + i * spacing
        addCable(cableX, cy, frame, 0.14, 0.45, -1.3)
      }
    }

    // --- Top wall cable detail — horizontal run with curves ---
    if ((h % 3) !== 2 && floorW > 120) {
      const cableY = floorY + 14
      const frame = topWallFrames[(h >> 2) % topWallFrames.length]
      const xPos = floorX + floorW * (0.35 + (h % 5) * 0.08)
      addCable(xPos, cableY, frame, 0.13, 0.42, -1.3)
    }

    // --- Bottom wall interior cable run — 1 tile in from wall ---
    if ((h % 5) < 3 && floorW > 130) {
      const cableY = floorY + floorH - 20
      const count = 2 + (h % 2) // 2 or 3 sprites
      const segW = (floorW - 80) / (count + 1)
      for (let i = 0; i < count; i++) {
        const frame = bottomWallFrames[(h + i * 3) % bottomWallFrames.length]
        const cx = floorX + 40 + segW * (i + 1)
        addCable(cx, cableY, frame, 0.12, 0.40, -1.2)
      }
    }

    // --- Connector dots along walls (2-3 positions) ---
    const dotCount = 2 + ((h >> 3) % 2) // 2 or 3 dots
    const dotPositions: Array<[number, number]> = []
    // Top wall dot
    if (floorW > 100) {
      dotPositions.push([
        floorX + 30 + (h % 7) * 12,
        floorY + 12,
      ])
    }
    // Right wall dot
    if (floorH > 100) {
      dotPositions.push([
        floorX + floorW - 14,
        floorY + floorH * 0.7 + (h % 3) * 8,
      ])
    }
    // Bottom wall dot
    if (floorW > 140) {
      dotPositions.push([
        floorX + floorW * 0.3 + (h % 4) * 10,
        floorY + floorH - 12,
      ])
    }
    for (let i = 0; i < Math.min(dotCount, dotPositions.length); i++) {
      const [dx, dy] = dotPositions[i]
      const frame = dotFrames[(h + i) % dotFrames.length]
      addCable(dx, dy, frame, 0.12, 0.50, -1.25)
    }
  }

  // -------------------------------------------------------------------------
  // Lab props — small decorative sprites (warning signs, vents, panels)
  // -------------------------------------------------------------------------

  private tileLabProps(
    room: Room,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
  ): void {
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return

    const h = this.hashToken(room.cwd)
    const right = floorX + floorW
    const bottom = floorY + floorH

    // Pick a zone type per room — each has different prop placement
    const zone = h % 4

    const addProp = (frame: number, x: number, y: number, scale: number, alpha = 0.75) => {
      const spr = this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, frame)
        .setScale(scale).setAlpha(alpha).setDepth(-1.5)
      room.container.add(spr)
      room.wallTileSprites!.push(spr)
    }

    if (zone === 0) {
      // ── Control Room — consoles along top wall, keyboard, stool ──
      const spacing = floorW / 3
      addProp(LP.CONSOLE_EXAMPLE_LONG, floorX + spacing, floorY + 14, 0.35, 0.88)
      addProp(LP.CONSOLE_EXAMPLE_SHORT, floorX + spacing * 2, floorY + 14, 0.35, 0.88)
      addProp(LP.CONSOLE_SCREEN, floorX + spacing, floorY + 22, 0.30, 0.85)
      addProp(LP.COMPUTER_KEYBOARD, right - floorW * 0.25, bottom - 14, 0.28, 0.82)
      addProp(LP.WARNING_POWER, right - 16, floorY + 10, 0.25, 0.82)
      if (floorW > 120) addProp(LP.CABLE_PIECE_01, floorX + 18, bottom - 12, 0.22, 0.80)
    }

    else if (zone === 1) {
      // ── Chemical Station — sink, microscope, beakers ──
      addProp(LP.CIRCULAR_SINK, floorX + floorW * 0.5, floorY + 16, 0.38, 0.88)
      addProp(LP.MICROSCOPE, floorX + floorW * 0.25, floorY + 16, 0.32, 0.85)
      addProp(LP.BEAKER, floorX + floorW * 0.72, floorY + 14, 0.28, 0.82)
      addProp(LP.CONICAL_BEAKER, floorX + floorW * 0.80, floorY + 14, 0.28, 0.82)
      addProp(LP.WARNING_BIOLOGICAL, floorX + 14, floorY + 10, 0.25, 0.82)
      if (floorH > 100) addProp(LP.SHELF, floorX + floorW * 0.4, bottom - 14, 0.32, 0.82)
    }

    else if (zone === 2) {
      // ── Machinery — generator centerpiece, power cells ──
      const centers = [LP.GENERATOR, LP.LAB_MACHINE_01, LP.LARGE_TANK]
      addProp(centers[h % centers.length], floorX + floorW * 0.5, floorY + 18, 0.45, 0.90)
      addProp(LP.DOME, floorX + floorW * 0.2, floorY + 16, 0.35, 0.85)
      const cellCount = floorW > 120 ? 3 : 2
      const cellSpacing = floorW / (cellCount + 1)
      for (let i = 0; i < cellCount; i++) {
        addProp(LP.POWER_CELL, floorX + cellSpacing * (i + 1), bottom - 14, 0.30, 0.82)
      }
      addProp(LP.SUNKEN_VENT, floorX + 18, bottom - 12, 0.22, 0.80)
      addProp(LP.WARNING_DEATH, floorX + floorW * 0.5 + 22, floorY + 10, 0.25, 0.82)
    }

    else {
      // ── Pod Bay — pods along top, warning signs, sliding door ──
      const podCount = floorW > 140 ? 3 : 2
      const podSpacing = floorW / (podCount + 1)
      for (let i = 0; i < podCount; i++) {
        const broken = (h + i) % 5 === 0
        addProp(broken ? LP.BROKEN_POD : LP.POD, floorX + podSpacing * (i + 1), floorY + 18, 0.36, broken ? 0.80 : 0.88)
      }
      addProp(LP.SLIDING_DOOR, floorX + 16, floorY + floorH * 0.5, 0.32, 0.82)
      addProp(LP.WARNING_BIOLOGICAL, floorX + 14, floorY + 10, 0.25, 0.82)
      addProp(LP.WARNING_STRIPES, right - 16, floorY + 10, 0.25, 0.82)
      addProp(LP.WARNING_STRIPES, floorX + floorW * 0.3, bottom - 12, 0.25, 0.80)
    }

    // ── Shared detail — every room gets a couple of floor accents ──
    // Cable cover near door
    if ((h % 3) !== 2) addProp(LP.CABLE_COVER, floorX + floorW * 0.6, bottom - 12, 0.22, 0.80)
    // Wall light on top wall
    if ((h % 4) !== 3) addProp(LP.WALL_LIGHT, floorX + floorW * 0.85, floorY + 10, 0.25, 0.82)
    // Vent near bottom edge
    if ((h % 5) >= 2 && floorH > 80) addProp(LP.VENT_SLATS, floorX + 20, bottom - 16, 0.28, 0.80)
  }

  // -------------------------------------------------------------------------
  // Floor glow lights — subtle cyan illumination on the hex floor
  // -------------------------------------------------------------------------

  private placeFloorGlowLights(
    room: Room,
    floorX: number,
    floorY: number,
    floorW: number,
    floorH: number,
  ): void {
    const h = this.hashToken(room.cwd)

    // 2 lights for small rooms, 3-4 for larger rooms
    const lightCount = floorW > 150 ? (3 + (h % 2)) : 2

    // Interior safe zone — at least 30% from edges
    const marginX = floorW * 0.30
    const marginY = floorH * 0.30
    const innerW = floorW - marginX * 2
    const innerH = floorH - marginY * 2
    const innerX = floorX + marginX
    const innerY = floorY + marginY

    for (let i = 0; i < lightCount; i++) {
      // Deterministic position within the interior
      const seed = (h + i * 31) | 0
      const fx = innerX + ((seed * 7 + i * 53) % 1000) / 1000 * innerW
      const fy = innerY + ((seed * 13 + i * 97) % 1000) / 1000 * innerH

      // Bloom halo — larger, more transparent background glow
      const bloomRadius = 14 + (seed % 7)  // 14-20
      const bloomAlpha = 0.04 + ((seed % 3) * 0.01)  // 0.04-0.06
      const bloom = this.scene.add.circle(fx, fy, bloomRadius, 0x00e5ff, bloomAlpha)
      bloom.setDepth(-2.0)
      room.container.add(bloom)
      room.wallTileSprites!.push(bloom as unknown as Phaser.GameObjects.Sprite)

      // Core glow — smaller, brighter center
      const coreRadius = 6 + (seed % 5)  // 6-10
      const coreAlpha = 0.12 + ((seed % 4) * 0.02)  // 0.12-0.18
      const core = this.scene.add.circle(fx, fy, coreRadius, 0x00e5ff, coreAlpha)
      core.setDepth(-2.0)
      room.container.add(core)
      room.wallTileSprites!.push(core as unknown as Phaser.GameObjects.Sprite)
    }
  }

  // -------------------------------------------------------------------------
  // Industrial detail — vent grates, pipes, brackets (legacy procedural)
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
        g.fillStyle(activeTheme.ventFill, 0.525)
        g.fillRect(ventX, ventY, ventW, ventH)
        // Louver bars (3-4 vertical bars)
        g.lineStyle(1.5, activeTheme.wallInner, 0.375)
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
        g.fillStyle(activeTheme.wallInner, 0.30)
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
    // Clean up previous room header icon
    if (room.roomHeaderIcon) { room.roomHeaderIcon.destroy(); room.roomHeaderIcon = undefined }
    // Clean up previous lego brick sprites
    if (room.headerLegoBricks) {
      for (const b of room.headerLegoBricks) b.destroy()
      room.headerLegoBricks = undefined
    }

    const WALL_T = 8
    const WALL_I = 4
    const headerY = room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H / 2

    const headerText = this.scene.add.text(
      0,
      headerY,
      this.host.formatLabel(room.label),
      {
        fontSize: '20px', color: activeTheme.headerText,
        fontFamily: "'Monogram', system-ui, monospace", fontStyle: 'bold', align: 'center',
        resolution: 2,
      },
    ).setOrigin(0.5, 0.5).setName('headerText')
    room.container.add(headerText)

    // Make header clickable — emit DESK_CLICKED with world coords so camera pans to room
    headerText.setInteractive({ useHandCursor: true })
    headerText.on('pointerdown', () => {
      const worldX = room.container.x
      const worldY = room.container.y
      EventBus.emit(EVENTS.DESK_CLICKED, room.cwd, worldX, worldY)
    })

    // Lego brick sprites behind the room label — colorful "built from bricks" decoration
    if (this.scene.textures.exists(SPRITESHEET_KEYS.LEGO_BAR)) {
      const brickFrames = [LEGO_FRAMES.BLUE, LEGO_FRAMES.GREEN, LEGO_FRAMES.YELLOW, LEGO_FRAMES.RED, LEGO_FRAMES.SPECIAL]
      const labelHash = this.hashToken(room.teamKey || room.label)
      const brickCount = 3 + (labelHash % 3) // 3-5 bricks
      const brickScale = 0.5
      const brickSpacing = 10
      const totalBrickW = brickCount * brickSpacing
      const brickStartX = -totalBrickW / 2 + brickSpacing / 2
      const bricks: Phaser.GameObjects.Sprite[] = []
      for (let bi = 0; bi < brickCount; bi++) {
        const frameIdx = brickFrames[(labelHash + bi) % brickFrames.length]
        const bx = brickStartX + bi * brickSpacing
        // Stagger vertically for a stacked/scattered effect
        const by = headerY + ((bi % 2 === 0) ? -1 : 1)
        const brick = this.scene.add.sprite(bx, by, SPRITESHEET_KEYS.LEGO_BAR, frameIdx)
          .setScale(brickScale)
          .setAlpha(0.2)
          .setOrigin(0.5)
        room.container.add(brick)
        bricks.push(brick)
      }
      // Move header text above the bricks so text is legible
      room.container.bringToTop(headerText)
      room.headerLegoBricks = bricks
    }

    // Neon signage glow on header text
    // Drop shadow for depth + subtle glow FX that pulses when room has agents
    headerText.postFX.addShadow(1, 1, 0.03, 0.6, 0x000000, 2)
    const template2 = getTemplate(getRoomType(room.cwd))
    room.headerGlowFx = headerText.postFX.addGlow(template2.accentColor, 1, 0, false, 0.1, 10)
    if (room.agents.length > 0) {
      room.headerGlowTween = this.scene.tweens.addCounter({
        from: 1,
        to: 3,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          if (room.headerGlowFx) {
            room.headerGlowFx.outerStrength = tw.getValue() ?? 0
          }
        },
      })
    }

    // Room-type themed icon — small sprite to the left of the header text
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)) {
      const roomType = getRoomType(room.cwd)
      const iconFrame = ROOM_HEADER_ITEM[roomType] ?? ROOM_HEADER_ITEM['standard']
      const iconX = -(headerText.width / 2) - 14
      room.roomHeaderIcon = this.scene.add.sprite(iconX, headerY, SPRITESHEET_KEYS.GAME_ITEMS, iconFrame)
        .setScale(0.22)
        .setAlpha(0.6)
        .setOrigin(0.5)
      room.container.add(room.roomHeaderIcon)
    }

    // Bloom accent line beneath the header — draw a wider, low-alpha duplicate for glow effect
    {
      const accentLineY = room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H
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
    const dotExisting = room.container.getByName('badgeDot') as Phaser.GameObjects.Sprite | null
    if (dotExisting) dotExisting.destroy()
    if (room.badgeDotTween) { room.badgeDotTween.destroy(); room.badgeDotTween = null }

    // Determine activity state for dot color
    const workingCount = room.agents.filter(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    ).length
    const waitingCount = room.agents.filter(a => a.needsInteraction).length
    const isActive = workingCount > 0
    const isWaiting = waitingCount > 0

    // Small filled circle left of the count number — sprite from GAME_ICONS sheet
    const badgeRightX = room.width / 2 - WALL_T - WALL_I - 8
    const dotFrame = isWaiting
      ? ICON_FRAMES.CIRCLE_YELLOW
      : isActive
        ? ICON_FRAMES.CIRCLE_GREEN
        : ICON_FRAMES.CIRCLE_GREY
    const dot = this.scene.add
      .sprite(badgeRightX - 18, headerY, SPRITESHEET_KEYS.GAME_ICONS, dotFrame)
      .setScale(0.16)
      .setAlpha(isActive || isWaiting ? 0.9 : 0.5)
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
        color: isActive ? activeTheme.accentText : isWaiting ? '#fbbf24' : '#3a4858',
        fontFamily: 'system-ui, monospace',
        backgroundColor: activeTheme.nameBg,
        padding: { x: 5, y: 2 },
        resolution: 2,
      },
    ).setOrigin(1, 0.5).setName('agentBadge')
    room.container.add(badge)

    // ── Agent status dot row (visible at L1 overview zoom) ──────────────
    // Shows a tiny colored circle per agent below the header text, giving
    // an at-a-glance activity summary when zoomed out too far to see
    // individual workstations.
    this.rebuildHeaderStatusDots(room, headerY)
  }

  // -------------------------------------------------------------------------
  // Header status dots — per-agent colored circles below the room header
  // -------------------------------------------------------------------------

  rebuildHeaderStatusDots(room: Room, headerY?: number): void {
    // Clean up previous dots and tweens
    if (room.headerStatusDots) {
      for (const s of room.headerStatusDots) s.destroy()
    }
    if (room.headerStatusDotTweens) {
      for (const t of room.headerStatusDotTweens) t.destroy()
    }
    room.headerStatusDots = []
    room.headerStatusDotTweens = []

    if (room.agents.length === 0) return

    const WALL_T = 8
    const WALL_I = 4
    const baseY = headerY ?? (room.height / 2 - WALL_T - WALL_I - ROOM_HEADER_H / 2)
    const dotY = baseY + 10  // below the header text line
    const dotSpacing = 5
    const dotScale = 0.12
    const maxDots = 8
    const count = Math.min(room.agents.length, maxDots)

    // Center the row horizontally
    const totalWidth = (count - 1) * dotSpacing
    const startX = -totalWidth / 2

    for (let i = 0; i < count; i++) {
      const agent = room.agents[i]
      const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !agent.needsInteraction
      const isWaitingAgent = agent.needsInteraction
      const frame = isWaitingAgent
        ? ICON_FRAMES.CIRCLE_YELLOW
        : isWorking
          ? ICON_FRAMES.CIRCLE_GREEN
          : ICON_FRAMES.CIRCLE_GREY

      const dotSprite = this.scene.add
        .sprite(startX + i * dotSpacing, dotY, SPRITESHEET_KEYS.GAME_ICONS, frame)
        .setScale(dotScale)
        .setAlpha(isWorking || isWaitingAgent ? 0.85 : 0.45)
        .setName('headerStatusDot')
      room.container.add(dotSprite)
      room.headerStatusDots.push(dotSprite)

      // Gentle pulse on active/waiting dots
      if (isWorking || isWaitingAgent) {
        const tween = this.scene.tweens.add({
          targets: dotSprite,
          alpha: { from: 0.5, to: 0.95 },
          duration: isWaitingAgent ? 600 : 2200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        room.headerStatusDotTweens!.push(tween)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Room ambient haze — subtle productivity haze for busy rooms
  // -------------------------------------------------------------------------

  /** Call from the update loop. Spawns a faint puff VFX in rooms with 3+
   *  active (working) agents every 10-15 seconds, creating a subtle "busy
   *  office" atmosphere. The puff is tinted to the room's accent color. */
  tickRoomHaze(time: number, rooms: Map<string, Room>): void {
    if (!this.scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) return

    for (const room of rooms.values()) {
      const workingCount = room.agents.filter(
        a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
      ).length
      if (workingCount < 3) continue

      const lastHaze = room.lastHazeTime ?? 0
      const interval = 10000 + Math.random() * 5000 // 10-15s jitter
      if (time - lastHaze < interval) continue

      room.lastHazeTime = time

      // Random position within the room floor area
      const WALL_T = 3
      const WALL_I = 1
      const floorW = room.width - (WALL_T + WALL_I) * 2
      const floorH = room.height - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H
      const rx = (Math.random() - 0.5) * floorW * 0.7
      const ry = -room.height / 2 + WALL_T + WALL_I + Math.random() * floorH * 0.8

      const worldX = room.container.x + rx
      const worldY = room.container.y + ry

      const template = getTemplate(getRoomType(room.cwd))
      const haze = this.scene.add.sprite(worldX, worldY, SPRITESHEET_KEYS.EFFECTS_PUFF)
        .setDepth(50)
        .setScale(0.20)
        .setAlpha(0.08)
        .setTint(template.accentColor)
      haze.play(EFFECT_ANIM_KEYS.PUFF)
      haze.once('animationcomplete', () => { try { haze.destroy() } catch { /* gone */ } })
    }
  }
}
