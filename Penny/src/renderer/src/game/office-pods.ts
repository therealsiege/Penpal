import Phaser from 'phaser'
import type { Room, PodLineInfo } from './office-types'
import { COLOR_LED_AMBER } from './office-constants'
import { hashToken, drawDashedLine } from './office-helpers'
import { SPRITESHEET_KEYS, ICON_FRAMES, EFFECT_ANIM_KEYS } from './office-asset-keys'
import { leaderboardManager } from './leaderboard'
import type { Rivalry } from './leaderboard'

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

  /** Sprite-based endpoint dots at pod line agent positions */
  private endpointSprites: Phaser.GameObjects.Sprite[] = []
  /** Sprite-based pulse dots traveling along active pod segments */
  private pulseSprites: Phaser.GameObjects.Sprite[] = []

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

  /** L1 overview — remove pod lines/dots so the lab floor reads clearly (same idea as MCP lines). */
  clearPodLineVisuals(): void {
    this.podGraphics?.clear()
    for (const s of this.endpointSprites) s.destroy()
    this.endpointSprites = []
    for (const s of this.pulseSprites) s.destroy()
    this.pulseSprites = []
  }

  clearRivalryVisuals(): void {
    this.rivalryGraphics?.clear()
  }

  /** Hide all pod visuals (lines, dots, rivalry). */
  setVisible(visible: boolean): void {
    if (!visible) {
      this.clearPodLineVisuals()
      this.clearRivalryVisuals()
    }
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

    // Recycle old endpoint and pulse sprites
    for (const s of this.endpointSprites) s.destroy()
    this.endpointSprites = []
    for (const s of this.pulseSprites) s.destroy()
    this.pulseSprites = []

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
      let endpointFrame: number = ICON_FRAMES.CIRCLE_GREY
      if (pod.status === 'solving' || pod.status === 'reviewing' || pod.status === 'executing' || pod.status === 'self-fixing') {
        lineColor = 0x3b82f6
        lineAlpha = 0.6
        endpointFrame = ICON_FRAMES.CIRCLE_BLUE
      } else if (pod.status === 'self-fixing') {
        lineColor = 0xf97316
        lineAlpha = 0.6
        endpointFrame = ICON_FRAMES.CIRCLE_YELLOW
      } else if (pod.status === 'feedback') {
        lineColor = 0xfbbf24
        lineAlpha = 0.5
        endpointFrame = ICON_FRAMES.CIRCLE_YELLOW
      }

      this.podGraphics.lineStyle(2, lineColor, lineAlpha)

      // Draw dashed lines between each pair
      for (let i = 0; i < positions.length - 1; i++) {
        drawDashedLine(
          this.podGraphics,
          positions[i].x, positions[i].y,
          positions[i + 1].x, positions[i + 1].y,
          4, 4,
        )
      }

      // Sprite-based endpoint dots at each agent position
      for (const pos of positions) {
        const ep = this.scene.add.sprite(pos.x, pos.y, SPRITESHEET_KEYS.GAME_ICONS, endpointFrame)
          .setScale(0.10)
          .setAlpha(lineAlpha * 0.8)
          .setDepth(10000)
        this.endpointSprites.push(ep)
      }

      if (this.isPodAnimatedStatus(pod.status)) {
        const pulseSegments = this.getPodPulseSegments(pod.status, positions.length)
        const pulseFrame = pod.status === 'feedback' ? ICON_FRAMES.CIRCLE_YELLOW : ICON_FRAMES.CIRCLE_BLUE
        const seed = hashToken(pod.workflowId) % 1000
        pulseSegments.forEach((seg, i) => {
          if (seg.from < 0 || seg.to < 0 || seg.from >= positions.length || seg.to >= positions.length) return
          const speed = 0.00058
          const base = (timeMs * speed + seed * 0.001 + i * 0.21) % 1
          const t = seg.from <= seg.to ? base : 1 - base
          // Sprite-based pulse dot traveling along the segment
          const px = Phaser.Math.Linear(positions[seg.from].x, positions[seg.to].x, t)
          const py = Phaser.Math.Linear(positions[seg.from].y, positions[seg.to].y, t)
          const pulseSprite = this.scene.add.sprite(px, py, SPRITESHEET_KEYS.GAME_ICONS, pulseFrame)
            .setScale(0.15)
            .setAlpha(0.75)
            .setDepth(10001)
          this.pulseSprites.push(pulseSprite)
          // Keep the Graphics glow halo behind the sprite for the bloom effect
          this.podGraphics!.fillStyle(pulseFrame === ICON_FRAMES.CIRCLE_YELLOW ? COLOR_LED_AMBER : 0x60a5fa, 0.15)
          this.podGraphics!.fillCircle(px, py, 7)
        })
      }
    }
  }

  private isPodAnimatedStatus(status: string): boolean {
    return status === 'solving' || status === 'reviewing' || status === 'executing' || status === 'self-fixing' || status === 'feedback'
  }

  private getPodPulseSegments(status: string, pointCount: number): Array<{ from: number; to: number }> {
    if (pointCount < 2) return []
    if (status === 'feedback') return [{ from: Math.min(1, pointCount - 1), to: 0 }]
    if (status === 'reviewing' || status === 'executing' || status === 'self-fixing') {
      if (pointCount >= 3) return [{ from: 1, to: 2 }]
      return [{ from: 0, to: 1 }]
    }
    if (status === 'solving') return [{ from: 0, to: 1 }]
    return []
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

    const dot = this.scene.add.sprite(fromPos.x, fromPos.y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
      .setScale(0.12).setDepth(210).setVisible(false) as unknown as Phaser.GameObjects.Arc


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
  // Rivalry connecting lines — electric blue lines between rival agents
  // ---------------------------------------------------------------------------

  private rivalryGraphics: Phaser.GameObjects.Graphics | null = null
  private lastRivalryDrawAt = 0
  private lastRivalryClashAt = 0

  /** Draw electric-blue dashed lines between rival agents who share a room.
   *  Spawns a subtle clash VFX at the midpoint every 8-10 seconds. */
  drawRivalryLines(timeMs: number, rooms: Map<string, Room>): void {
    if (!this.rivalryGraphics) {
      this.rivalryGraphics = this.scene.add.graphics().setDepth(201)
    }
    this.rivalryGraphics.clear()

    const rivalries = leaderboardManager.getRivalries()
    if (rivalries.length === 0) return

    // Build agentId -> roomKey lookup for quick same-room detection
    const agentRoomMap = new Map<string, string>()
    for (const [roomKey, room] of rooms) {
      for (const agentId of room.workstations.keys()) {
        agentRoomMap.set(agentId, roomKey)
      }
    }

    const CLASH_INTERVAL_MS = 9000
    const shouldClash = timeMs - this.lastRivalryClashAt >= CLASH_INTERVAL_MS

    for (const rivalry of rivalries) {
      const room1 = agentRoomMap.get(rivalry.agent1Id)
      const room2 = agentRoomMap.get(rivalry.agent2Id)
      // Only draw line if both agents are in the same room
      if (!room1 || !room2 || room1 !== room2) continue

      const pos1 = this.getWorkstationWorldPos(rivalry.agent1Id, rooms)
      const pos2 = this.getWorkstationWorldPos(rivalry.agent2Id, rooms)
      if (!pos1 || !pos2) continue

      // Electric blue dashed line between rivals
      const g = this.rivalryGraphics!

      // Outer glow line
      g.lineStyle(3, 0x00e5ff, 0.1)
      drawDashedLine(g, pos1.x, pos1.y, pos2.x, pos2.y, 5, 4)

      // Core line
      g.lineStyle(1.5, 0x00e5ff, 0.35)
      drawDashedLine(g, pos1.x, pos1.y, pos2.x, pos2.y, 5, 4)

      // Small glow dots at each endpoint
      g.fillStyle(0x00e5ff, 0.15)
      g.fillCircle(pos1.x, pos1.y, 5)
      g.fillCircle(pos2.x, pos2.y, 5)

      // Midpoint clash VFX — tiny explosion puff every ~9 seconds
      if (shouldClash) {
        const mx = (pos1.x + pos2.x) / 2
        const my = (pos1.y + pos2.y) / 2

        // Use the puff VFX if available, otherwise draw a simple flash
        if (this.scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
          const puff = this.scene.add.sprite(mx, my, SPRITESHEET_KEYS.EFFECTS_PUFF)
            .setDepth(202).setScale(0.15).setAlpha(0.4).setTint(0x00e5ff)
          puff.play(EFFECT_ANIM_KEYS.PUFF)
          puff.once('animationcomplete', () => puff.destroy())
        } else {
          // Fallback: simple circle flash
          g.fillStyle(0x00e5ff, 0.3)
          g.fillCircle(mx, my, 6)
        }
      }
    }

    if (shouldClash) {
      this.lastRivalryClashAt = timeMs
    }
    this.lastRivalryDrawAt = timeMs
  }

  hasRivalries(): boolean {
    return leaderboardManager.getRivalries().length > 0
  }

  getLastRivalryDrawAt(): number {
    return this.lastRivalryDrawAt
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.podGraphics?.destroy()
    this.podGraphics = null

    this.rivalryGraphics?.destroy()
    this.rivalryGraphics = null

    for (const s of this.endpointSprites) s.destroy()
    this.endpointSprites = []
    for (const s of this.pulseSprites) s.destroy()
    this.pulseSprites = []

    for (const anim of this.chatAnimations) {
      try { anim.dot.destroy() } catch { /* already gone */ }
    }
    this.chatAnimations = []
    this.chatLineGraphics?.destroy()
    this.chatLineGraphics = null
  }

}
