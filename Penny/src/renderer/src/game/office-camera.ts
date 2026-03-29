// ---------------------------------------------------------------------------
// office-camera.ts
// Camera navigation, zoom-to-fit, camera bounds, smooth follow/zoom, and
// camera juice (sidekick#79): pulses, scripted pans, slow zoom-to-fit.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { Room } from './office-types'
import { WORLD_MARGIN, ZOOM_MIN, ZOOM_MAX, ZOOM_FIT_MAX, ZOOM_LERP_SPEED, FOLLOW_LERP_SPEED } from './office-constants'
import { AnimConfig } from './animation-config'

export type CameraPulseKind =
  | 'taskComplete'
  | 'rankUp'
  | 'errorZoomOut'
  | 'agentLeave'
  | 'epicQuest'

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
  softLockCameraInput?: () => void
  softUnlockCameraInput?: () => void
}

export function panDurationFromDistance(worldDist: number): number {
  const p = AnimConfig.camera.pan
  const d = Math.max(0, worldDist - p.minWorldDist)
  const span = Math.max(1e-6, p.maxWorldDist - p.minWorldDist)
  const t = Phaser.Math.Clamp(d / span, 0, 1)
  return Math.round(p.minMs + t * (p.maxMs - p.minMs))
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

  private _panTween: Phaser.Tweens.Tween | null = null
  private _pulseTween: Phaser.Tweens.Tween | null = null
  private _slowFitTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, host: CameraHostScene) {
    this.scene = scene
    this.host = host
  }

  private _scriptedPanActive(): boolean {
    return this._panTween != null && this._panTween.isPlaying()
  }

  private _scriptedZoomActive(): boolean {
    return (this._pulseTween != null && this._pulseTween.isPlaying()) ||
      (this._slowFitTween != null && this._slowFitTween.isPlaying())
  }

  private _stopPanTween(): void {
    if (this._panTween) {
      this._panTween.stop()
      this._panTween = null
    }
  }

  private _stopPulseTween(): void {
    if (this._pulseTween) {
      this._pulseTween.stop()
      this._pulseTween = null
    }
  }

  private _stopSlowFitTween(): void {
    if (this._slowFitTween) {
      this._slowFitTween.stop()
      this._slowFitTween = null
    }
  }

  smoothPanTo(worldX: number, worldY: number, durationMs: number, onComplete?: () => void): void {
    const cam = this.scene.cameras.main
    this.followTarget = null
    this._stopPanTween()

    const z = cam.zoom
    let tx = worldX - cam.width / (2 * z)
    let ty = worldY - cam.height / (2 * z)
    const bounds = cam.getBounds()
    const vw = cam.width / z
    const vh = cam.height / z
    tx = Phaser.Math.Clamp(tx, bounds.x, Math.max(bounds.x, bounds.right - vw))
    ty = Phaser.Math.Clamp(ty, bounds.y, Math.max(bounds.y, bounds.bottom - vh))

    this.host.softLockCameraInput?.()
    this._panTween = this.scene.tweens.add({
      targets: cam,
      scrollX: tx,
      scrollY: ty,
      duration: durationMs,
      ease: AnimConfig.camera.pan.ease,
      onComplete: () => {
        this._panTween = null
        this.lastCamScrollX = cam.scrollX
        this.lastCamScrollY = cam.scrollY
        this.host.softUnlockCameraInput?.()
        onComplete?.()
      },
    })
  }

  pulseZoom(kind: CameraPulseKind): void {
    const spec = AnimConfig.camera.pulse[kind]
    const cam = this.scene.cameras.main
    const base = cam.zoom
    const peak = Phaser.Math.Clamp(base + spec.delta, this.getMinZoom(), ZOOM_MAX)
    if (Math.abs(spec.delta) < 1e-4) return

    this.followTarget = null
    this._stopPulseTween()
    this.host.softLockCameraInput?.()

    const half = Math.max(40, Math.floor(spec.durationMs / 2))
    this._pulseTween = this.scene.tweens.add({
      targets: cam,
      zoom: peak,
      duration: half,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        this._pulseTween = null
        this.targetZoom = cam.zoom
        this.host.softUnlockCameraInput?.()
      },
    })
  }

  focusAgentBriefly(agentId: string, rooms: Map<string, Room>): void {
    const pos = getWorkstationWorldPos(agentId, rooms)
    if (!pos) return
    const cam = this.scene.cameras.main
    const cx = cam.scrollX + cam.width / (2 * cam.zoom)
    const cy = cam.scrollY + cam.height / (2 * cam.zoom)
    const dist = Phaser.Math.Distance.Between(cx, cy, pos.x, pos.y)
    const dur = panDurationFromDistance(dist)
    this.smoothPanTo(pos.x, pos.y, dur, () => {
      this.scene.time.delayedCall(AnimConfig.camera.epicQuestHoldMs, () => {
        this.pulseZoom('epicQuest')
      })
    })
  }

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

  updateZoomAndFollow(time: number): boolean {
    const cam = this.scene.cameras.main

    if (!this._scriptedZoomActive()) {
      const zoomDiff = this.targetZoom - cam.zoom
      if (Math.abs(zoomDiff) > 0.001) {
        cam.setZoom(Phaser.Math.Clamp(cam.zoom + zoomDiff * ZOOM_LERP_SPEED, this.getMinZoom(), ZOOM_MAX))
      } else if (Math.abs(zoomDiff) > 0) {
        cam.setZoom(this.targetZoom)
      }
    }

    if (this.followTarget && !this._scriptedPanActive()) {
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
    const hasRooms = rooms.size > 0
    const bgDims = this.host.getBackground().getBgDimensions()
    let contentW = Math.max(maxX, hasRooms ? bgDims.w + 30 : 0)
    let contentH = Math.max(maxY, hasRooms ? bgDims.h + 30 : 0)
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

  zoomToFit(animated: boolean, opts?: { slow?: boolean }): void {
    const rooms = this.host.getRooms()
    if (rooms.size === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    const bgDims = this.host.getBackground().getBgDimensions()
    if (bgDims.w > 0) {
      minX = Math.min(minX, 0)
      minY = Math.min(minY, 0)
      maxX = Math.max(maxX, bgDims.w + 30)
      maxY = Math.max(maxY, bgDims.h + 30)
    }
    const padFactor = 1.08
    const { viewWidth, viewHeight } = this.host.getViewSize()
    const fitZoom = Phaser.Math.Clamp(
      Math.min(viewWidth / ((maxX - minX) * padFactor), viewHeight / ((maxY - minY) * padFactor)),
      this.getMinZoom(), Math.min(ZOOM_MAX, ZOOM_FIT_MAX),
    )
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const cam = this.scene.cameras.main

    if (animated && opts?.slow) {
      this.followTarget = null
      this._stopSlowFitTween()
      this._stopPanTween()
      const tx = cx - viewWidth / (2 * fitZoom)
      const ty = cy - viewHeight / (2 * fitZoom)
      const bounds = cam.getBounds()
      const vw = viewWidth / fitZoom
      const vh = viewHeight / fitZoom
      const sx = Phaser.Math.Clamp(tx, bounds.x, Math.max(bounds.x, bounds.right - vw))
      const sy = Phaser.Math.Clamp(ty, bounds.y, Math.max(bounds.y, bounds.bottom - vh))

      this.host.softLockCameraInput?.()
      const proxy = { z: cam.zoom, x: cam.scrollX, y: cam.scrollY }
      this._slowFitTween = this.scene.tweens.add({
        targets: proxy,
        z: fitZoom,
        x: sx,
        y: sy,
        duration: AnimConfig.camera.fitSlowDurationMs,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          cam.setZoom(proxy.z)
          cam.setScroll(proxy.x, proxy.y)
        },
        onComplete: () => {
          this._slowFitTween = null
          this.targetZoom = fitZoom
          cam.setZoom(fitZoom)
          cam.setScroll(sx, sy)
          this.lastCamScrollX = cam.scrollX
          this.lastCamScrollY = cam.scrollY
          this.lastCamZoom = cam.zoom
          this.host.softUnlockCameraInput?.()
        },
      })
      return
    }

    if (animated) {
      this.targetZoom = fitZoom
      this.followTarget = { x: cx, y: cy }
    } else {
      this.targetZoom = fitZoom
      this.followTarget = null
      cam.setZoom(fitZoom)
      cam.centerOn(cx, cy)
    }
  }

  panToAgent(agentId: string, rooms: Map<string, Room>, opts?: { scripted?: boolean }): void {
    const pos = getWorkstationWorldPos(agentId, rooms)
    if (!pos) return
    if (opts?.scripted) {
      const cam = this.scene.cameras.main
      const cx = cam.scrollX + cam.width / (2 * cam.zoom)
      const cy = cam.scrollY + cam.height / (2 * cam.zoom)
      const dist = Phaser.Math.Distance.Between(cx, cy, pos.x, pos.y)
      const dur = panDurationFromDistance(dist)
      this.smoothPanTo(pos.x, pos.y, dur)
      if (this.targetZoom < 0.8) this.targetZoom = 0.9
      return
    }
    this.followTarget = { x: pos.x, y: pos.y }
    if (this.targetZoom < 0.8) this.targetZoom = 0.9
  }
}

export function getWorkstationWorldPos(agentId: string, rooms: Map<string, Room>): { x: number; y: number } | null {
  for (const room of rooms.values()) {
    const ws = room.workstations.get(agentId)
    if (ws) {
      return { x: room.x + ws.container.x, y: room.y + ws.container.y }
    }
  }
  return null
}
