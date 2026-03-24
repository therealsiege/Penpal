import Phaser from 'phaser'
import type { Room, MinimapProjection, MinimapExtraBuilding } from './office-types'
import {
  MINIMAP_W,
  MINIMAP_H,
  MINIMAP_MARGIN,
  MINIMAP_BG,
  MINIMAP_ROOM_COLOR,
  MINIMAP_VIEWPORT_COLOR,
} from './office-constants'

// ---------------------------------------------------------------------------
// OfficeMinimap — extracted minimap subsystem for OfficeScene
// ---------------------------------------------------------------------------

export class OfficeMinimap {
  private scene: Phaser.Scene

  // Callback invoked when the user clicks/drags on the minimap to pan the camera
  private onPanCamera: (worldX: number, worldY: number) => void

  // View dimensions (kept in sync via reposition())
  private viewWidth = 800
  private viewHeight = 600

  // Phaser display objects
  private minimapContainer: Phaser.GameObjects.Container | null = null
  private minimapGraphics: Phaser.GameObjects.Graphics | null = null
  private minimapViewport: Phaser.GameObjects.Graphics | null = null
  private minimapHitZone: Phaser.GameObjects.Rectangle | null = null
  private minimapHoverLabel: Phaser.GameObjects.Text | null = null
  private minimapHoverBg: Phaser.GameObjects.Graphics | null = null
  private minimapHoverLine: Phaser.GameObjects.Graphics | null = null

  // Runtime state
  private minimapProjection: MinimapProjection | null = null
  private minimapPanning = false
  private minimapDirty = true
  private minimapRoomFlashes = new Map<string, { until: number; color: number }>()
  private lastMinimapDrawAt = 0
  // Cached rooms reference — needed for hover label hit-testing between draw calls
  private lastDrawnRooms: ReadonlyMap<string, Room> = new Map()

  constructor(
    scene: Phaser.Scene,
    onPanCamera: (worldX: number, worldY: number) => void,
  ) {
    this.scene = scene
    this.onPanCamera = onPanCamera
  }

  // ---------------------------------------------------------------------------
  // Initialise — call once from OfficeScene.create()
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight

    this.minimapContainer = this.scene.add
      .container(0, 0)
      .setDepth(10010)
      .setScrollFactor(0)

    this.minimapGraphics = this.scene.add.graphics().setScrollFactor(0)
    this.minimapViewport = this.scene.add.graphics().setScrollFactor(0)

    this.minimapHitZone = this.scene.add
      .rectangle(0, 0, MINIMAP_W, MINIMAP_H, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })

    this.minimapHitZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.minimapPanning = true
      this.panCameraFromMinimapPointer(p)
    })

    this.minimapHitZone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.minimapPanning && p.isDown) {
        this.panCameraFromMinimapPointer(p)
      }
      this.updateMinimapHoverLabel(p)
    })

    this.minimapHitZone.on('pointerup', () => {
      this.minimapPanning = false
    })

    this.minimapHitZone.on('pointerout', () => {
      this.minimapPanning = false
      this.hideMinimapHoverLabel()
    })

    this.minimapContainer.add([
      this.minimapGraphics,
      this.minimapViewport,
      this.minimapHitZone,
    ])

    // Hover label elements — screen-space, depth above minimap container
    this.minimapHoverBg = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(10020)
      .setVisible(false)

    this.minimapHoverLine = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(10019)
      .setVisible(false)

    this.minimapHoverLabel = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setScrollFactor(0)
      .setDepth(10021)
      .setVisible(false)

    this.reposition(viewWidth, viewHeight)
  }

  // ---------------------------------------------------------------------------
  // Public API called from OfficeScene
  // ---------------------------------------------------------------------------

  /** Mark the minimap as needing a redraw on the next tick. */
  markDirty(): void {
    this.minimapDirty = true
  }

  /** Queue a brief flash ring around a room on the minimap. */
  queueFlash(cwd: string, color: number, durationMs: number): void {
    this.minimapRoomFlashes.set(cwd, {
      until: this.scene.time.now + durationMs,
      color,
    })
    this.minimapDirty = true
  }

  /**
   * Called from OfficeScene.update().
   * Ticks flash expiry and redraws if dirty + enough time has elapsed.
   * @param time      - current scene time (ms)
   * @param refreshMs - minimum ms between redraws
   * @param rooms     - current room map (read-only)
   */
  tick(time: number, refreshMs: number, rooms: ReadonlyMap<string, Room>, extraBuildings?: MinimapExtraBuilding[]): void {
    this.tickRoomFlashes(time)
    if (this.minimapDirty && time - this.lastMinimapDrawAt >= refreshMs) {
      this.draw(rooms, extraBuildings)
      this.lastMinimapDrawAt = time
      this.minimapDirty = false
    }
  }

  /** Reposition the minimap panel after a viewport resize. */
  reposition(viewWidth: number, viewHeight: number): void {
    if (!this.minimapContainer) return
    if (viewWidth < 10 || viewHeight < 10) return
    this.viewWidth = viewWidth
    this.viewHeight = viewHeight
    this.minimapContainer.setPosition(
      viewWidth - MINIMAP_W - MINIMAP_MARGIN,
      viewHeight - MINIMAP_H - MINIMAP_MARGIN,
    )
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private tickRoomFlashes(now: number): void {
    if (this.minimapRoomFlashes.size === 0) return
    let expired = false
    for (const [cwd, flash] of this.minimapRoomFlashes) {
      if (flash.until <= now) {
        this.minimapRoomFlashes.delete(cwd)
        expired = true
      }
    }
    if (expired || this.minimapRoomFlashes.size > 0) this.minimapDirty = true
  }

  private draw(rooms: ReadonlyMap<string, Room>, extraBuildings?: MinimapExtraBuilding[]): void {
    this.lastDrawnRooms = rooms
    if (!this.minimapGraphics || !this.minimapViewport) return
    const mg = this.minimapGraphics
    const vg = this.minimapViewport
    mg.clear()
    vg.clear()

    const hasExtra = extraBuildings && extraBuildings.length > 0
    if (rooms.size === 0 && !hasExtra) {
      this.minimapProjection = null
      return
    }

    mg.fillStyle(MINIMAP_BG, 0.85)
    mg.fillRoundedRect(0, 0, MINIMAP_W, MINIMAP_H, 4)
    mg.lineStyle(1, 0x334155, 0.8)
    mg.strokeRoundedRect(0, 0, MINIMAP_W, MINIMAP_H, 4)

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    if (extraBuildings) {
      for (const eb of extraBuildings) {
        minX = Math.min(minX, eb.bounds.x)
        minY = Math.min(minY, eb.bounds.y)
        maxX = Math.max(maxX, eb.bounds.x + eb.bounds.w)
        maxY = Math.max(maxY, eb.bounds.y + eb.bounds.h)
      }
    }

    const pad = 8
    const drawW = MINIMAP_W - pad * 2
    const drawH = MINIMAP_H - pad * 2
    const s = Math.min(
      drawW / Math.max(maxX - minX, 1),
      drawH / Math.max(maxY - minY, 1),
    )
    this.minimapProjection = { minX, minY, drawW, drawH, scale: s, pad }

    const now = this.scene.time.now

    for (const room of rooms.values()) {
      const rx = pad + (room.x - room.width / 2 - minX) * s
      const ry = pad + (room.y - room.height / 2 - minY) * s
      const hasWorking = room.agents.some(
        (a) => a.sessionMode === 'working' || a.sessionMode === 'plan',
      )
      const hasWaiting = room.agents.some((a) => a.needsInteraction)

      mg.fillStyle(
        hasWaiting ? 0xfbbf24 : hasWorking ? 0x34d399 : MINIMAP_ROOM_COLOR,
        hasWaiting || hasWorking ? 0.6 : 0.4,
      )
      mg.fillRect(rx, ry, room.width * s, room.height * s)

      // Activity pulse ring for rooms with working agents
      if (hasWorking) {
        const pulseAlpha = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(now * 0.003))
        mg.lineStyle(1.5, 0x34d399, pulseAlpha)
        mg.strokeRect(rx - 2, ry - 2, room.width * s + 4, room.height * s + 4)
      }

      const flash = this.minimapRoomFlashes.get(room.cwd)
      if (flash) {
        const pulse = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(now * 0.015))
        mg.lineStyle(2, flash.color, pulse)
        mg.strokeRect(
          rx - 1.5,
          ry - 1.5,
          room.width * s + 3,
          room.height * s + 3,
        )
      }

      // Draw active agent dots in a small row along the bottom of the room rect
      const workstationList = Array.from(room.workstations.values())
      if (workstationList.length === 0) continue
      const dotRadius = 1.5
      const dotSpacing = dotRadius * 2 + 1.5
      const totalDotsW = workstationList.length * dotSpacing - 1.5
      const roomW = room.width * s
      const roomH = room.height * s
      const dotStartX =
        rx + Math.max(0, (roomW - totalDotsW) / 2) + dotRadius
      const dotY = ry + roomH - dotRadius - 1.5
      workstationList.forEach((ws, i) => {
        if (!ws.state) return
        const dotColor = ws.state.needsInteraction
          ? 0xfbbf24
          : ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan'
            ? 0x34d399
            : 0x64748b
        mg.fillStyle(dotColor, 0.9)
        mg.fillCircle(dotStartX + i * dotSpacing, dotY, dotRadius)
      })
    }

    // Extra buildings (e.g. GitHub dispatch)
    if (extraBuildings) {
      for (const eb of extraBuildings) {
        const ebx = pad + (eb.bounds.x - minX) * s
        const eby = pad + (eb.bounds.y - minY) * s
        mg.fillStyle(eb.color, 0.5)
        mg.fillRect(ebx, eby, eb.bounds.w * s, eb.bounds.h * s)
        mg.lineStyle(1, eb.color, 0.4)
        mg.strokeRect(ebx, eby, eb.bounds.w * s, eb.bounds.h * s)
      }
    }

    const cam = this.scene.cameras.main
    const vpX = Phaser.Math.Clamp(pad + (cam.scrollX - minX) * s, pad, pad + drawW)
    const vpY = Phaser.Math.Clamp(pad + (cam.scrollY - minY) * s, pad, pad + drawH)
    const vpW = Math.min((cam.width / cam.zoom) * s, drawW)
    const vpH = Math.min((cam.height / cam.zoom) * s, drawH)

    // Viewport glow — draw a slightly larger rect behind at low alpha, pulsing subtly
    const glowAlpha = 0.1 + 0.05 * (0.5 + 0.5 * Math.sin(now * 0.002))
    vg.lineStyle(3, MINIMAP_VIEWPORT_COLOR, glowAlpha)
    vg.strokeRect(vpX - 1, vpY - 1, vpW + 2, vpH + 2)

    // Normal viewport rect on top
    vg.lineStyle(1.5, MINIMAP_VIEWPORT_COLOR, 0.9)
    vg.strokeRect(vpX, vpY, vpW, vpH)
  }

  private updateMinimapHoverLabel(pointer: Phaser.Input.Pointer): void {
    if (!this.minimapContainer || !this.minimapProjection) {
      this.hideMinimapHoverLabel()
      return
    }

    const { pad, minX, minY, scale } = this.minimapProjection
    const localX = pointer.x - this.minimapContainer.x
    const localY = pointer.y - this.minimapContainer.y

    // Hit-test each room rectangle in minimap-local space
    // NOTE: we need rooms here — stored via closure over the last drawn rooms.
    // We access rooms through the scene's camera context is not enough; instead we
    // re-derive from projection. But rooms are not stored — we need a reference.
    // Solution: store rooms reference after each draw() call.
    let hoveredRoom: Room | null = null
    let roomMidMX = 0
    let roomMidMY = 0

    for (const room of this.lastDrawnRooms.values()) {
      const rx = pad + (room.x - room.width / 2 - minX) * scale
      const ry = pad + (room.y - room.height / 2 - minY) * scale
      const rw = room.width * scale
      const rh = room.height * scale
      if (
        localX >= rx &&
        localX <= rx + rw &&
        localY >= ry &&
        localY <= ry + rh
      ) {
        hoveredRoom = room
        roomMidMX = rx + rw / 2
        roomMidMY = ry + rh / 2
        break
      }
    }

    if (!hoveredRoom) {
      this.hideMinimapHoverLabel()
      return
    }

    // Short display name — truncate at 18 chars
    const rawLabel = hoveredRoom.label || hoveredRoom.cwd.split('/').pop() || '?'
    const shortName =
      rawLabel.length > 18 ? rawLabel.slice(0, 16) + '..' : rawLabel

    if (!this.minimapHoverLabel || !this.minimapHoverBg || !this.minimapHoverLine)
      return

    this.minimapHoverLabel.setText(shortName)
    this.minimapHoverLabel.setVisible(true)

    const textW = this.minimapHoverLabel.width
    const textH = this.minimapHoverLabel.height
    const pillPadX = 6
    const pillPadY = 3
    const pillW = textW + pillPadX * 2
    const pillH = textH + pillPadY * 2
    const pillR = 4

    // Pill floats above the minimap panel, centered over the hovered room
    const mmScreenX = this.minimapContainer.x
    const mmScreenY = this.minimapContainer.y
    const roomScreenMX = mmScreenX + roomMidMX
    const pillY = mmScreenY - pillH - 6
    const pillX = Phaser.Math.Clamp(
      roomScreenMX - pillW / 2,
      4,
      this.viewWidth - pillW - 4,
    )

    // Draw dark pill background
    this.minimapHoverBg.clear()
    this.minimapHoverBg.fillStyle(0x0f172a, 0.92)
    this.minimapHoverBg.fillRoundedRect(pillX, pillY, pillW, pillH, pillR)
    this.minimapHoverBg.lineStyle(1, 0x334155, 0.8)
    this.minimapHoverBg.strokeRoundedRect(pillX, pillY, pillW, pillH, pillR)
    this.minimapHoverBg.setVisible(true)

    // Label text inside pill
    this.minimapHoverLabel.setPosition(pillX + pillPadX, pillY + pillPadY)

    // Vertical connector from pill bottom to room midpoint on the minimap
    const lineX = Phaser.Math.Clamp(
      roomScreenMX,
      mmScreenX + 4,
      mmScreenX + MINIMAP_W - 4,
    )
    const lineTopY = pillY + pillH
    const lineBottomY = mmScreenY + roomMidMY
    this.minimapHoverLine.clear()
    this.minimapHoverLine.lineStyle(1, 0x94a3b8, 0.5)
    this.minimapHoverLine.lineBetween(lineX, lineTopY, lineX, lineBottomY)
    this.minimapHoverLine.setVisible(true)
  }

  private hideMinimapHoverLabel(): void {
    this.minimapHoverLabel?.setVisible(false)
    this.minimapHoverBg?.setVisible(false)
    this.minimapHoverLine?.setVisible(false)
  }

  private panCameraFromMinimapPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.minimapContainer || !this.minimapProjection) return
    const { pad, drawW, drawH, minX, minY, scale } = this.minimapProjection
    const localX = pointer.x - this.minimapContainer.x
    const localY = pointer.y - this.minimapContainer.y
    const clampedX = Phaser.Math.Clamp(localX, pad, pad + drawW)
    const clampedY = Phaser.Math.Clamp(localY, pad, pad + drawH)
    const safeScale = Math.max(scale, 0.0001)
    const worldX = minX + (clampedX - pad) / safeScale
    const worldY = minY + (clampedY - pad) / safeScale
    this.onPanCamera(worldX, worldY)
    this.minimapDirty = true
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.minimapHitZone?.destroy()
    this.minimapGraphics?.destroy()
    this.minimapViewport?.destroy()
    this.minimapContainer?.destroy()
    this.minimapHoverLabel?.destroy()
    this.minimapHoverBg?.destroy()
    this.minimapHoverLine?.destroy()

    this.minimapHitZone = null
    this.minimapGraphics = null
    this.minimapViewport = null
    this.minimapContainer = null
    this.minimapProjection = null
    this.minimapPanning = false
    this.minimapRoomFlashes.clear()
    this.minimapHoverLabel = null
    this.minimapHoverBg = null
    this.minimapHoverLine = null
    this.lastDrawnRooms = new Map()
  }
}
