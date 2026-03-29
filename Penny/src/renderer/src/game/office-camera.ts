// ---------------------------------------------------------------------------
// office-camera.ts
// Camera navigation, zoom-to-fit, camera bounds, and smooth follow/zoom.
// Extracted from OfficeScene to keep the orchestrator focused.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { Room } from './office-types'
import { WORLD_MARGIN, ZOOM_MIN, ZOOM_MAX, ZOOM_FIT_MAX, ZOOM_LERP_SPEED, FOLLOW_LERP_SPEED } from './office-constants'

export interface CameraHostScene {
  getRooms(): Map<string, Room>
  getBackground(): {
    getBgDimensions(): { w: number; h: number }
  }
  getCafe(): {
    getBounds(): { x: number; y: number; w: number; h: number } | null
  }
  getViewSize(): { viewWidth: number; viewHeight: number }
  getWorldSize(): { worldWidth: number; worldHeight: number }
  setWorldSize(w: number, h: number): void
}

export class OfficeCamera {
  private scene: Phaser.Scene
  private host: CameraHostScene

  targetZoom = 1
  followTarget: { x: number; y: number } | null = null
  lastCamScrollX = 0
  lastCamScrollY = 0
  lastCamZoom = 1
  pendingCameraRecoveryUntil = 0
  hasInitialFit = false

  constructor(scene: Phaser.Scene, host: CameraHostScene) {
    this.scene = scene
    this.host = host
  }

  /** Initialize camera tracking state from current camera */
  init(): void {
    const cam = this.scene.cameras.main
    this.lastCamScrollX = cam.scrollX
    this.lastCamScrollY = cam.scrollY
    this.lastCamZoom = cam.zoom
    this.targetZoom = cam.zoom
  }

  getMinZoom(): number {
    return ZOOM_MIN
  }

  /** Smooth zoom + follow lerp — call from update() */
  updateZoomAndFollow(time: number): boolean {
    const cam = this.scene.cameras.main

    // Smooth zoom lerp
    const zoomDiff = this.targetZoom - cam.zoom
    if (Math.abs(zoomDiff) > 0.001) {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + zoomDiff * ZOOM_LERP_SPEED, this.getMinZoom(), ZOOM_MAX))
    } else if (Math.abs(zoomDiff) > 0) {
      cam.setZoom(this.targetZoom)
    }

    // Smooth camera follow
    if (this.followTarget) {
      const cx = cam.scrollX + cam.width / (2 * cam.zoom)
      const cy = cam.scrollY + cam.height / (2 * cam.zoom)
      const dx = this.followTarget.x - cx
      const dy = this.followTarget.y - cy
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        cam.scrollX += dx * FOLLOW_LERP_SPEED
        cam.scrollY += dy * FOLLOW_LERP_SPEED
      } else {
        cam.scrollX += dx
        cam.scrollY += dy
        this.followTarget = null
      }
    }

    // Short safety window after layout/data changes to ensure agents stay discoverable
    if (this.pendingCameraRecoveryUntil > 0 && this.host.getRooms().size > 0) {
      if (!this.isAnyRoomVisible()) {
        this.followTarget = null
        this.zoomToFit(false)
      } else {
        this.pendingCameraRecoveryUntil = 0
      }
      if (time >= this.pendingCameraRecoveryUntil) {
        this.pendingCameraRecoveryUntil = 0
      }
    }

    // Track camera movement for other systems
    const cameraChanged =
      Math.abs(cam.scrollX - this.lastCamScrollX) > 0.5 ||
      Math.abs(cam.scrollY - this.lastCamScrollY) > 0.5 ||
      Math.abs(cam.zoom - this.lastCamZoom) > 0.001
    if (cameraChanged) {
      this.lastCamScrollX = cam.scrollX
      this.lastCamScrollY = cam.scrollY
      this.lastCamZoom = cam.zoom
    }

    return cameraChanged
  }

  isAnyRoomVisible(padding = 24): boolean {
    const rooms = this.host.getRooms()
    if (rooms.size === 0) return false
    const view = this.scene.cameras.main.worldView
    const vx1 = view.x - padding
    const vy1 = view.y - padding
    const vx2 = view.right + padding
    const vy2 = view.bottom + padding
    for (const room of rooms.values()) {
      const rx1 = room.x - room.width / 2
      const ry1 = room.y - room.height / 2
      const rx2 = room.x + room.width / 2
      const ry2 = room.y + room.height / 2
      if (rx2 >= vx1 && rx1 <= vx2 && ry2 >= vy1 && ry1 <= vy2) return true
    }
    return false
  }

  updateCameraBounds(): void {
    const cam = this.scene.cameras.main
    const rooms = this.host.getRooms()
    let maxX = 0
    let maxY = 0
    for (const room of rooms.values()) {
      maxX = Math.max(maxX, room.x + room.width / 2 + WORLD_MARGIN)
      maxY = Math.max(maxY, room.y + room.height / 2 + WORLD_MARGIN)
    }
    // Include building background extents (rooms only, no cafe)
    const hasRooms = rooms.size > 0
    const bgDims = this.host.getBackground().getBgDimensions()
    let contentW = Math.max(maxX, hasRooms ? bgDims.w + 30 : 0)
    let contentH = Math.max(maxY, hasRooms ? bgDims.h + 30 : 0)
    // Include cafe (positioned outside the building)
    const cafeBounds = this.host.getCafe().getBounds()
    if (cafeBounds) {
      contentW = Math.max(contentW, cafeBounds.x + cafeBounds.w + WORLD_MARGIN)
      contentH = Math.max(contentH, cafeBounds.y + cafeBounds.h + WORLD_MARGIN)
    }
    const { viewWidth, viewHeight } = this.host.getViewSize()
    const worldWidth = Math.max(contentW, viewWidth)
    const worldHeight = Math.max(contentH, viewHeight)
    this.host.setWorldSize(worldWidth, worldHeight)
    cam.setBounds(-WORLD_MARGIN, -WORLD_MARGIN, worldWidth + WORLD_MARGIN * 2, worldHeight + WORLD_MARGIN * 2)
  }

  zoomToFit(animated: boolean): void {
    const rooms = this.host.getRooms()
    if (rooms.size === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    // Expand bounds to include the building rect (rooms only)
    const bgDims = this.host.getBackground().getBgDimensions()
    if (bgDims.w > 0) {
      minX = Math.min(minX, 0)
      minY = Math.min(minY, 0)
      maxX = Math.max(maxX, bgDims.w + 30)
      maxY = Math.max(maxY, bgDims.h + 30)
    }
    // Don't include the cafe in zoom-to-fit — it's a peripheral area.
    const padFactor = 1.08
    const { viewWidth, viewHeight } = this.host.getViewSize()
    const fitZoom = Phaser.Math.Clamp(
      Math.min(viewWidth / ((maxX - minX) * padFactor), viewHeight / ((maxY - minY) * padFactor)),
      this.getMinZoom(), Math.min(ZOOM_MAX, ZOOM_FIT_MAX),
    )
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    if (animated) {
      this.targetZoom = fitZoom
      this.followTarget = { x: cx, y: cy }
    } else {
      this.targetZoom = fitZoom
      this.followTarget = null
      this.scene.cameras.main.setZoom(fitZoom)
      this.scene.cameras.main.centerOn(cx, cy)
    }
  }

  /** Smooth-pan camera to center on a specific agent's workstation */
  panToAgent(agentId: string, rooms: Map<string, Room>): void {
    const pos = getWorkstationWorldPos(agentId, rooms)
    if (pos) {
      this.followTarget = { x: pos.x, y: pos.y }
      if (this.targetZoom < 0.8) this.targetZoom = 0.9
    }
  }

  /** Brief zoom pulse for camera juice effects (celebrations, errors, departures) */
  pulseZoom(hint: string): void {
    const cam = this.scene.cameras.main
    const saved = this.targetZoom
    let delta = 0
    let duration = 200

    switch (hint) {
      case 'rankUp':      delta = -0.08; duration = 300; break
      case 'taskComplete': delta = 0.04; duration = 200; break
      case 'errorZoomOut': delta = -0.05; duration = 250; break
      case 'agentLeave':   delta = -0.03; duration = 200; break
      default: return
    }

    this.targetZoom = Phaser.Math.Clamp(saved + delta, this.getMinZoom(), ZOOM_MAX)
    this.scene.time.delayedCall(duration, () => {
      if (Math.abs(this.targetZoom - (saved + delta)) < 0.01) {
        this.targetZoom = saved
      }
    })
    if (hint === 'errorZoomOut') cam.shake(60, 0.002)
  }
}

/** Find world-space position of a workstation by agent ID */
export function getWorkstationWorldPos(agentId: string, rooms: Map<string, Room>): { x: number; y: number } | null {
  for (const room of rooms.values()) {
    const ws = room.workstations.get(agentId)
    if (ws) {
      return { x: room.x + ws.container.x, y: room.y + ws.container.y }
    }
  }
  return null
}
