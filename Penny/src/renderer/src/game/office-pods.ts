import Phaser from 'phaser'
import type { Room, PodLineInfo } from './office-types'
import { COLOR_LED_AMBER } from './office-constants'
import { hashToken } from './office-helpers'

// ---------------------------------------------------------------------------
// Chat animation entry type
// ---------------------------------------------------------------------------

export interface ChatAnimation {
  fromPos: { x: number; y: number }
  toPos: { x: number; y: number }
  controlPt: { x: number; y: number }
  dot: Phaser.GameObjects.Arc
  startTime: number
  travelDuration: number
  fadeDuration: number
  fadeStart: number
  lineAlpha: number
  expired: boolean
}

// ---------------------------------------------------------------------------
// OfficePods — pod connecting lines and agent-to-agent chat animations
// ---------------------------------------------------------------------------

export class OfficePods {
  private scene: Phaser.Scene

  podLines: PodLineInfo[] = []
  private podGraphics: Phaser.GameObjects.Graphics | null = null

  private chatLineGraphics: Phaser.GameObjects.Graphics | null = null
  private chatAnimations: ChatAnimation[] = []

  private podsDirty = true
  private lastDrawAt = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Must be called after the scene `create()` phase so the scene has an `add` factory. */
  init(): void {
    this.chatLineGraphics = this.scene.add.graphics().setDepth(200)
  }

  setPodLines(lines: PodLineInfo[]): void {
    this.podLines = lines
    this.podsDirty = true
  }

  markDirty(): void {
    this.podsDirty = true
  }

  isDirty(): boolean {
    return this.podsDirty
  }

  clearDirty(): void {
    this.podsDirty = false
  }

  getLastDrawAt(): number {
    return this.lastDrawAt
  }

  setLastDrawAt(t: number): void {
    this.lastDrawAt = t
  }

  hasAnimatedPods(): boolean {
    return this.podLines.some(t => this.isPodAnimatedStatus(t.status))
  }

  // ---------------------------------------------------------------------------
  // Pod connecting lines (Fix 11)
  // ---------------------------------------------------------------------------

  drawPodLines(timeMs: number, rooms: Map<string, Room>): void {
    if (!this.podGraphics) {
      this.podGraphics = this.scene.add.graphics()
      this.podGraphics.setDepth(9999)
    }
    this.podGraphics.clear()

    for (const pod of this.podLines) {
      const agentIds = [pod.solverAgentId, pod.reviewerAgentId, pod.executorAgentId]
      const positions: { x: number; y: number }[] = []

      for (const agentId of agentIds) {
        const pos = this.getWorkstationWorldPos(agentId, rooms)
        if (pos) positions.push(pos)
      }

      if (positions.length < 2) continue

      // Color based on workflow status
      let lineColor = 0x64748b
      let lineAlpha = 0.4
      if (pod.status === 'solving' || pod.status === 'reviewing' || pod.status === 'executing') {
        lineColor = 0x3b82f6
        lineAlpha = 0.6
      } else if (pod.status === 'feedback') {
        lineColor = 0xfbbf24
        lineAlpha = 0.5
      }

      this.podGraphics.lineStyle(2, lineColor, lineAlpha)

      // Draw dashed lines between each pair
      for (let i = 0; i < positions.length - 1; i++) {
        this.drawDashedLine(
          this.podGraphics,
          positions[i].x, positions[i].y,
          positions[i + 1].x, positions[i + 1].y,
          4, 4,
        )
      }

      if (this.isPodAnimatedStatus(pod.status)) {
        const pulseSegments = this.getPodPulseSegments(pod.status, positions.length)
        const pulseColor = pod.status === 'feedback' ? COLOR_LED_AMBER : 0x60a5fa
        const seed = hashToken(pod.workflowId) % 1000
        pulseSegments.forEach((seg, i) => {
          if (seg.from < 0 || seg.to < 0 || seg.from >= positions.length || seg.to >= positions.length) return
          const speed = 0.00058
          const base = (timeMs * speed + seed * 0.001 + i * 0.21) % 1
          const t = seg.from <= seg.to ? base : 1 - base
          this.drawPodPulse(this.podGraphics!, positions[seg.from], positions[seg.to], t, pulseColor)
        })
      }
    }
  }

  private isPodAnimatedStatus(status: string): boolean {
    return status === 'solving' || status === 'reviewing' || status === 'executing' || status === 'feedback'
  }

  private getPodPulseSegments(status: string, pointCount: number): Array<{ from: number; to: number }> {
    if (pointCount < 2) return []
    if (status === 'feedback') return [{ from: Math.min(1, pointCount - 1), to: 0 }]
    if (status === 'reviewing' || status === 'executing') {
      if (pointCount >= 3) return [{ from: 1, to: 2 }]
      return [{ from: 0, to: 1 }]
    }
    if (status === 'solving') return [{ from: 0, to: 1 }]
    return []
  }

  private drawPodPulse(
    g: Phaser.GameObjects.Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    t: number,
    color: number,
  ): void {
    const px = Phaser.Math.Linear(start.x, end.x, t)
    const py = Phaser.Math.Linear(start.y, end.y, t)
    g.fillStyle(color, 0.2)
    g.fillCircle(px, py, 6.5)
    g.fillStyle(color, 0.85)
    g.fillCircle(px, py, 2.6)
  }

  private drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.001) return
    const ux = dx / len
    const uy = dy / len
    let d = 0
    let drawing = true
    g.beginPath()
    g.moveTo(x1, y1)
    while (d < len) {
      const step = drawing ? dashLen : gapLen
      d = Math.min(d + step, len)
      const px = x1 + ux * d
      const py = y1 + uy * d
      if (drawing) g.lineTo(px, py)
      else g.moveTo(px, py)
      drawing = !drawing
    }
    g.strokePath()
  }

  getWorkstationWorldPos(agentId: string, rooms: Map<string, Room>): { x: number; y: number } | null {
    for (const room of rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        return { x: room.x + ws.container.x, y: room.y + ws.container.y }
      }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Agent chat connection animations
  // ---------------------------------------------------------------------------

  /**
   * Animate a data-sharing arc from one agent to another.
   * Draws a curved bezier line and animates a dot traveling from source to target.
   *
   * Usage example:
   *   scene.showAgentChat('marcus-chen', 'lena-park')
   *   scene.showAgentChat('solver-id', 'reviewer-id', 3000)
   */
  showAgentChat(fromAgentId: string, toAgentId: string, duration: number, rooms: Map<string, Room>): void {
    if (!this.chatLineGraphics) return

    const fromPos = this.getWorkstationWorldPos(fromAgentId, rooms)
    const toPos   = this.getWorkstationWorldPos(toAgentId, rooms)
    if (!fromPos || !toPos) return

    const midX = (fromPos.x + toPos.x) / 2
    const midY = (fromPos.y + toPos.y) / 2
    const dist  = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y)
    const controlPt = { x: midX, y: midY - dist * 0.4 }

    const dot = this.scene.add.circle(fromPos.x, fromPos.y, 2, 0x3b82f6, 1) as unknown as Phaser.GameObjects.Arc
    dot.setDepth(210).setVisible(false)

    this.chatAnimations.push({
      fromPos:        { ...fromPos },
      toPos:          { ...toPos },
      controlPt,
      dot,
      startTime:      this.scene.time.now,
      travelDuration: 800,
      fadeDuration:   300,
      fadeStart:      -1,
      lineAlpha:      0.4,
      expired:        false,
    })

    this.scene.time.delayedCall(duration, () => {
      for (const anim of this.chatAnimations) {
        if (anim.dot === dot && !anim.expired && anim.fadeStart < 0) {
          anim.fadeStart = this.scene.time.now
        }
      }
    })
  }

  /**
   * Compute position on a quadratic bezier at parameter t and draw a traveling
   * dot at that position.
   * B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
   */
  private drawBezierDot(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    controlPt: { x: number; y: number },
    t: number,
    color: number,
  ): void {
    const mt = 1 - t
    const px = mt * mt * from.x + 2 * mt * t * controlPt.x + t * t * to.x
    const py = mt * mt * from.y + 2 * mt * t * controlPt.y + t * t * to.y
    g.fillStyle(color, 0.2)
    g.fillCircle(px, py, 5)
    g.fillStyle(color, 0.85)
    g.fillCircle(px, py, 2.5)
  }

  tickChatAnimations(timeMs: number): void {
    if (!this.chatLineGraphics) return
    const g = this.chatLineGraphics
    g.clear()

    let hasExpired = false

    for (const anim of this.chatAnimations) {
      if (anim.expired) continue

      const elapsed = timeMs - anim.startTime

      let lineAlpha = 0.4
      if (anim.fadeStart >= 0) {
        const fadePct = Math.min((timeMs - anim.fadeStart) / anim.fadeDuration, 1)
        lineAlpha = 0.4 * (1 - fadePct)
        if (fadePct >= 1) {
          anim.expired = true
          hasExpired   = true
          try { anim.dot.destroy() } catch { /* already gone */ }
          continue
        }
      }

      // Draw bezier curve as connected line segments
      const SEGMENTS = 20
      g.lineStyle(1.5, 0x60a5fa, lineAlpha)
      g.beginPath()
      for (let i = 0; i <= SEGMENTS; i++) {
        const ts  = i / SEGMENTS
        const mts = 1 - ts
        const px = mts * mts * anim.fromPos.x + 2 * mts * ts * anim.controlPt.x + ts * ts * anim.toPos.x
        const py = mts * mts * anim.fromPos.y + 2 * mts * ts * anim.controlPt.y + ts * ts * anim.toPos.y
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.strokePath()

      // Animate traveling dot along the bezier
      if (anim.fadeStart < 0) {
        const tDot = Math.min(elapsed / anim.travelDuration, 1)
        this.drawBezierDot(g, anim.fromPos, anim.toPos, anim.controlPt, tDot, 0x3b82f6)
        if (tDot >= 1) {
          anim.fadeStart = timeMs
        }
      }
    }

    if (hasExpired) {
      this.chatAnimations = this.chatAnimations.filter(a => !a.expired)
    }
  }

  hasChatAnimations(): boolean {
    return this.chatAnimations.length > 0
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.podGraphics?.destroy()
    this.podGraphics = null

    for (const anim of this.chatAnimations) {
      try { anim.dot.destroy() } catch { /* already gone */ }
    }
    this.chatAnimations = []
    this.chatLineGraphics?.destroy()
    this.chatLineGraphics = null
  }

}
