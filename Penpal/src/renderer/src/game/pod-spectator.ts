/**
 * PodSpectator — Real-time stage visualization for active pods.
 *
 * Listens for pod stage-change events forwarded from the main process and
 * renders stage labels + glow rings on the active agent's workstation.
 * On pod completion/failure, triggers the existing celebration/error VFX.
 */

import Phaser from 'phaser'
import { activeTheme } from './office-theme'
import { scaledFontSize } from './office-constants'
import type { WorkstationSprite, Room } from './office-types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PodStageEvent {
  podId: string
  status: string // solving | reviewing | executing | self-fixing | complete | failed
  solverId: string
  reviewerId: string
  executorId: string
  iteration: number
}

interface ActivePod {
  podId: string
  status: string
  solverId: string
  reviewerId: string
  executorId: string
  labels: Phaser.GameObjects.Text[]
  rings: Phaser.GameObjects.Graphics[]
}

// ── Stage colors ────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, { color: number; label: string }> = {
  solving:       { color: 0x3b82f6, label: 'SOLVING' },
  reviewing:     { color: 0xf59e0b, label: 'REVIEWING' },
  executing:     { color: 0x22c55e, label: 'EXECUTING' },
  'self-fixing': { color: 0xef4444, label: 'SELF-FIX' },
}

// ── Module ──────────────────────────────────────────────────────────────────

export class PodSpectator {
  private scene: Phaser.Scene
  private activePods = new Map<string, ActivePod>()
  private _cleanup: (() => void) | null = null
  private _getRooms: (() => Room[]) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Provide a rooms accessor so spectator can find workstations. */
  setRoomsAccessor(fn: () => Room[]): void {
    this._getRooms = fn
  }

  /** Start listening for pod stage events from preload bridge. */
  wire(): void {
    if (typeof window !== 'undefined' && window.api?.onPodStageChanged) {
      this._cleanup = window.api.onPodStageChanged((event: PodStageEvent) => {
        this.handleStageChange(event)
      })
    }
  }

  /** Clean up listeners and overlays. */
  destroy(): void {
    this._cleanup?.()
    this._cleanup = null
    for (const pod of this.activePods.values()) {
      this.clearPodOverlays(pod)
    }
    this.activePods.clear()
  }

  // ── Event handling ──────────────────────────────────────────────────────

  private handleStageChange(event: PodStageEvent): void {
    const { podId, status } = event

    // Terminal states — clean up overlays
    if (status === 'complete' || status === 'failed') {
      const pod = this.activePods.get(podId)
      if (pod) {
        this.clearPodOverlays(pod)
        this.activePods.delete(podId)
      }
      return
    }

    // Active stage — create or update overlays
    let pod = this.activePods.get(podId)
    if (!pod) {
      pod = {
        podId,
        status,
        solverId: event.solverId,
        reviewerId: event.reviewerId,
        executorId: event.executorId,
        labels: [],
        rings: [],
      }
      this.activePods.set(podId, pod)
    }

    // Clear previous overlays for this pod
    this.clearPodOverlays(pod)
    pod.status = status

    // Determine which agent is active in this stage
    const activeAgentId =
      status === 'solving' ? pod.solverId :
      status === 'reviewing' ? pod.reviewerId :
      status === 'executing' || status === 'self-fixing' ? pod.executorId :
      null

    if (!activeAgentId) return

    const stageInfo = STAGE_COLORS[status]
    if (!stageInfo) return

    // Find the workstation for the active agent
    const ws = this.findWorkstation(activeAgentId)
    if (!ws) return

    const worldX = ws.container.x
    const worldY = ws.container.y

    // Stage label above workstation
    const label = this.scene.add.text(worldX, worldY - 45, stageInfo.label, {
      fontSize: scaledFontSize(7),
      fontFamily: 'system-ui, monospace',
      fontStyle: 'bold',
      color: '#' + stageInfo.color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5).setDepth(500)

    // Glow ring around workstation
    const ring = this.scene.add.graphics().setDepth(499)
    ring.lineStyle(2, stageInfo.color, 0.6)
    ring.strokeCircle(worldX, worldY, 28)

    pod.labels.push(label)
    pod.rings.push(ring)

    // Pulse animation on the label
    this.scene.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Ring pulse
    this.scene.tweens.add({
      targets: ring,
      alpha: { from: 0.6, to: 0.15 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Also show labels on the other two pod members (dimmer, showing their role)
    const roles: Array<{ id: string; role: string }> = [
      { id: pod.solverId, role: 'S' },
      { id: pod.reviewerId, role: 'R' },
      { id: pod.executorId, role: 'E' },
    ]
    for (const { id, role } of roles) {
      if (id === activeAgentId) continue
      const otherWs = this.findWorkstation(id)
      if (!otherWs) continue
      const roleLabel = this.scene.add.text(
        otherWs.container.x, otherWs.container.y - 40, role, {
          fontSize: scaledFontSize(6),
          fontFamily: 'system-ui, monospace',
          color: '#5a6a7a',
          stroke: '#000000',
          strokeThickness: 1,
          resolution: 2,
        },
      ).setOrigin(0.5).setDepth(498).setAlpha(0.5)
      pod.labels.push(roleLabel)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private clearPodOverlays(pod: ActivePod): void {
    for (const label of pod.labels) {
      this.scene.tweens.killTweensOf(label)
      label.destroy()
    }
    for (const ring of pod.rings) {
      this.scene.tweens.killTweensOf(ring)
      ring.destroy()
    }
    pod.labels = []
    pod.rings = []
  }

  private findWorkstation(agentId: string): WorkstationSprite | null {
    const rooms = this._getRooms?.() ?? []
    for (const room of rooms) {
      const ws = room.workstations.get(agentId)
      if (ws) return ws
    }
    return null
  }
}
