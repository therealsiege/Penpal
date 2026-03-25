import Phaser from 'phaser'
import type { AgentState } from '../types'
import { WS_SPRITE_Y, WS_DESK_Y, CHAR_SCALE, ROOM_GAP } from './office-constants'
import { getAgentCharacterIndex, getRoomDoorY } from './office-helpers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAFE_W = 340
const CAFE_H = 180
const COUNTER_W = 16
const BEHIND_W = 68
const STOOL_GAP = 48
const WALK_SPEED = 55
const NUM_STOOLS = 6
const TOTAL_STOOLS_W = (NUM_STOOLS - 1) * STOOL_GAP
const STOOL_START_X = (CAFE_W - TOTAL_STOOLS_W) / 2

// Tuning — high traffic, stay until recalled
const MAX_RUNNERS = 10
const RUN_TIMER_MIN = 3000
const RUN_TIMER_VAR = 5000

// Social interaction emojis
const CHAT_EMOJIS = ['\uD83D\uDE04', '\uD83D\uDC4D', '\u2615', '\uD83D\uDCA1', '\uD83E\uDD14', '\uD83D\uDE02', '\uD83D\uDE0E', '\uD83C\uDF1F']

// ---------------------------------------------------------------------------
// Interface the host scene must satisfy
// ---------------------------------------------------------------------------

export interface CafeHostScene extends Phaser.Scene {
  rooms: Map<string, CafeRoom>
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
}

export interface CafeRoom {
  cwd: string
  x: number
  y: number
  width: number
  height: number
  doorSide: 'top' | 'bottom'
  workstations: Map<string, CafeWorkstation>
}

export interface CafeWorkstation {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  state: AgentState | null
  walkBreakTween?: Phaser.Tweens.Tween
}

// ---------------------------------------------------------------------------
// Visitor tracking
// ---------------------------------------------------------------------------

interface CafeVisitor {
  agentId: string
  stoolIdx: number
  walker: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  cup: Phaser.GameObjects.Arc | null
  sipTimer: Phaser.Time.TimerEvent | null
  chatPartner: string | null
  /** Trigger walk-back to desk (called by cancelCoffeeRun when seated) */
  triggerReturn?: () => void
}

interface ChatSession {
  agentA: string
  agentB: string
  bubbleA: Phaser.GameObjects.Container | null
  bubbleB: Phaser.GameObjects.Container | null
  turnTimer: Phaser.Time.TimerEvent
  emojiTimer: Phaser.Time.TimerEvent
  leanTimer: Phaser.Time.TimerEvent
}

// ---------------------------------------------------------------------------
// PennyCafe
// ---------------------------------------------------------------------------

export class PennyCafe {
  private scene: CafeHostScene
  container: Phaser.GameObjects.Container | null = null
  private baristas: Phaser.GameObjects.Container[] = []
  private baristaHomeX: number[] = []
  private visitorTimer: Phaser.Time.TimerEvent | null = null
  private steamTimer: Phaser.Time.TimerEvent | null = null
  private coffeeRunTimer: Phaser.Time.TimerEvent | null = null
  readonly coffeeRunners = new Map<string, () => void>()
  private coffeeRunnerRooms = new Map<string, number>()
  private stoolOccupied = new Set<number>()
  private seatedVisitors = new Map<string, CafeVisitor>()
  private chatSessions: ChatSession[] = []
  worldX = 0
  worldY = 0

  constructor(scene: CafeHostScene) {
    this.scene = scene
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get width(): number { return CAFE_W }
  get height(): number { return CAFE_H }

  /** Build (or rebuild) the café visual at the given position. */
  build(cx: number, cy: number): void {
    this.destroyVisuals()

    const scene = this.scene
    const containerX = cx - CAFE_W / 2
    const container = scene.add.container(containerX, cy).setDepth(2)
    this.worldX = containerX + CAFE_W / 2
    this.container = container
    const g = scene.add.graphics()
    container.add(g)

    // ── Barista workspace (top) — dark gunmetal ──
    g.fillStyle(0x1a2030, 0.9)
    g.fillRoundedRect(0, 0, CAFE_W, BEHIND_W, { tl: 6, tr: 6, bl: 0, br: 0 })
    g.fillStyle(0x0d1117, 0.6)
    g.fillRect(6, 6, CAFE_W - 12, BEHIND_W - 12)

    // ── Header sign ──
    g.fillStyle(0x0a0f1a, 0.9)
    g.fillRoundedRect(6, 2, CAFE_W - 12, 24, { tl: 4, tr: 4, bl: 0, br: 0 })
    g.lineStyle(2, 0x00ff88, 0.5)
    g.lineBetween(6, 26, CAFE_W - 6, 26)
    const signText = scene.add.text(CAFE_W / 2, 14, 'PENPAL CAFE', {
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#00ff88', resolution: 2,
    }).setOrigin(0.5)
    container.add(signText)

    // ── Equipment (espresso machines + menu board) ──
    const eqY = 30
    const machinePositions = [30, 110]
    for (const mx of machinePositions) {
      g.fillStyle(0x334155, 0.7)
      g.fillRoundedRect(mx, eqY, 20, 22, 3)
      g.fillStyle(0xef4444, 0.4)
      g.fillCircle(mx + 10, eqY + 5, 2)
    }
    // Menu board
    g.fillStyle(0x0d1117, 0.85)
    g.fillRoundedRect(200, eqY, 60, 28, 2)
    g.lineStyle(1, 0x00e5ff, 0.4)
    g.strokeRoundedRect(200, eqY, 60, 28, 2)
    for (let ml = 0; ml < 3; ml++) {
      g.fillStyle(0x00e5ff, 0.08)
      g.fillRect(204, eqY + 4 + ml * 8, 28, 2)
      g.fillStyle(0x00ff88, 0.12)
      g.fillRect(240, eqY + 4 + ml * 8, 14, 2)
    }

    // ── Counter bar ──
    const counterY = BEHIND_W
    g.fillStyle(0x2a3040, 0.9)
    g.fillRoundedRect(8, counterY, CAFE_W - 16, COUNTER_W, 3)
    g.fillStyle(0x00e5ff, 0.15)
    g.fillRect(10, counterY + 2, CAFE_W - 20, 4)

    // ── Customer area (bottom) ──
    const customerTopY = counterY + COUNTER_W
    const customerH = CAFE_H - BEHIND_W - COUNTER_W
    g.fillStyle(0x1a2030, 0.55)
    g.fillRoundedRect(0, customerTopY, CAFE_W, customerH, { tl: 0, tr: 0, bl: 6, br: 6 })

    // ── Baristas ──
    const baristaWorkY = BEHIND_W - 14
    const baristaConfigs = [
      { homeX: 80, charIdx: 1, name: 'Latte Larry' },
      { homeX: 250, charIdx: 0, name: 'Mocha Maya' },
    ]

    this.baristaHomeX = []
    for (const cfg of baristaConfigs) {
      const walkKey = cfg.charIdx === 1 ? 'anim-walk-2' : 'anim-walk-1'
      const bc = scene.add.container(cfg.homeX, baristaWorkY)
      container.add(bc)

      const bSprite = scene.add.sprite(0, 0, walkKey, 0)
        .setScale(CHAR_SCALE).setOrigin(0.5, 1)
      bc.add(bSprite)

      const apron = scene.add.rectangle(0, -8, 14, 12, 0x059669, 0.35)
      bc.add(apron)

      const tag = scene.add.text(0, 6, cfg.name, {
        fontSize: '10px', fontFamily: 'system-ui, sans-serif', color: '#00e5ff',
        backgroundColor: '#0a0e14cc', padding: { x: 4, y: 2 }, resolution: 2,
      }).setOrigin(0.5, 0)
      bc.add(tag)

      this.baristas.push(bc)
      this.baristaHomeX.push(cfg.homeX)

      scene.tweens.add({ targets: bc, angle: { from: -3, to: 3 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 })
      scene.tweens.add({ targets: bSprite, y: -2, scaleY: CHAR_SCALE * 0.97, duration: 450 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 400 })
      scene.tweens.add({ targets: bc, x: cfg.homeX + 10, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
    }

    // ── Stools — centered below counter ──
    const stoolY = counterY + COUNTER_W + 16
    for (let si = 0; si < NUM_STOOLS; si++) {
      const sx = STOOL_START_X + si * STOOL_GAP
      // Footrest ring
      g.lineStyle(1.5, 0x4a5a6c, 0.4)
      g.strokeCircle(sx, stoolY + 12, 6)
      // Center post
      g.fillStyle(0x64748b, 0.7)
      g.fillRect(sx - 1.5, stoolY + 2, 3, 12)
      // Seat cushion (rounded)
      g.fillStyle(0x334155, 0.85)
      g.fillCircle(sx, stoolY, 7)
      // Seat highlight
      g.fillStyle(0x475569, 0.6)
      g.fillCircle(sx, stoolY - 1, 5)
      // Seat rim
      g.lineStyle(1, 0x00e5ff, 0.15)
      g.strokeCircle(sx, stoolY, 7)
    }

    this.worldY = cy + stoolY

    // ── Animated steam ──
    this.steamTimer = scene.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (!this.container?.active) return
        const mx = machinePositions[Math.floor(Math.random() * machinePositions.length)]
        for (let si = 0; si < 2; si++) {
          const p = scene.add.circle(mx + 10 + (si - 0.5) * 4, eqY - 2, 2, 0x00e5ff, 0.22)
          container.add(p)
          scene.tweens.add({
            targets: p, y: eqY - 16 - Math.random() * 8, x: mx + 10 + (si - 0.5) * 4 + (Math.random() - 0.5) * 6,
            alpha: 0, duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut',
            onComplete: () => { p.destroy() },
          })
        }
      },
    })
  }

  /** Start the periodic coffee run timer. */
  startCoffeeRunTimer(): void {
    if (this.coffeeRunTimer) this.coffeeRunTimer.destroy()
    this.coffeeRunTimer = this.scene.time.addEvent({
      delay: RUN_TIMER_MIN + Math.random() * RUN_TIMER_VAR,
      loop: true,
      callback: () => this.tryStartCoffeeRun(),
    })
  }

  /** Returns bounds for nav mesh integration. */
  getBounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.container) return null
    return { x: this.container.x, y: this.container.y, w: CAFE_W, h: CAFE_H }
  }

  /** Check if an agent is on a coffee run. */
  isOnCoffeeRun(agentId: string): boolean {
    return this.coffeeRunners.has(agentId)
  }

  /** Cancel a coffee run — trigger walk back to desk. */
  cancelCoffeeRun(agentId: string): void {
    const visitor = this.seatedVisitors.get(agentId)
    if (visitor?.triggerReturn) {
      // Trigger the walk-back animation (cleanup happens on arrival)
      visitor.triggerReturn()
    } else {
      // Not yet seated — force-cleanup the walker immediately to prevent orphan clones
      const forceCleanup = this.coffeeRunners.get(agentId)
      if (forceCleanup) forceCleanup()
    }
  }

  /** Destroy everything. */
  destroy(): void {
    if (this.coffeeRunTimer) { this.coffeeRunTimer.destroy(); this.coffeeRunTimer = null }
    // Clean up all chat sessions
    for (const session of this.chatSessions) {
      this.destroyChatSession(session)
    }
    this.chatSessions = []
    this.seatedVisitors.clear()
    this.stoolOccupied.clear()
    this.destroyVisuals()
    this.coffeeRunners.clear()
    this.coffeeRunnerRooms.clear()
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private destroyVisuals(): void {
    this.baristas = []
    this.baristaHomeX = []
    if (this.visitorTimer) { this.visitorTimer.destroy(); this.visitorTimer = null }
    if (this.steamTimer) { this.steamTimer.destroy(); this.steamTimer = null }
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.destroy(true)
      this.container = null
    }
  }

  // ── Stool management ──────────────────────────────────────────────────

  private pickStool(): number | null {
    // Prefer stools adjacent to an occupied one (social seating)
    const adjacentFree: number[] = []
    const otherFree: number[] = []
    for (let i = 0; i < NUM_STOOLS; i++) {
      if (this.stoolOccupied.has(i)) continue
      const hasNeighbor = this.stoolOccupied.has(i - 1) || this.stoolOccupied.has(i + 1)
      if (hasNeighbor) adjacentFree.push(i)
      else otherFree.push(i)
    }
    // If someone is already seated, strongly prefer adjacent stools
    if (adjacentFree.length > 0 && this.stoolOccupied.size > 0) {
      return adjacentFree[Math.floor(Math.random() * adjacentFree.length)]
    }
    if (otherFree.length > 0) {
      return otherFree[Math.floor(Math.random() * otherFree.length)]
    }
    return null // All stools full
  }

  private stoolWorldX(stoolIdx: number): number {
    return (this.worldX - CAFE_W / 2) + STOOL_START_X + stoolIdx * STOOL_GAP
  }

  // ── Coffee run dispatch ───────────────────────────────────────────────

  private tryStartCoffeeRun(): void {
    if (!this.container || this.scene.rooms.size === 0) return
    if (this.coffeeRunners.size >= MAX_RUNNERS) return

    const candidates: { ws: CafeWorkstation; room: CafeRoom }[] = []
    for (const room of this.scene.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        if (ws.walkBreakTween) continue
        if (this.coffeeRunners.has(ws.state.config.id)) continue
        // Remote gateway agents (nemoclaw, openclaw) have no reliable status — keep at desk
        const mdl = ws.state.config.model
        if (mdl === 'nemoclaw' || mdl === 'openclaw') continue
        const m = ws.state.sessionMode
        const isBusy = m === 'working' || m === 'plan' || m === 'compressing' || m === 'accept-edits' || ws.state.needsInteraction || ws.state.status === 'active'
        if (isBusy) continue
        candidates.push({ ws, room })
      }
    }
    if (candidates.length === 0) return

    // Dispatch up to 3 agents per tick for faster cafe fill
    const dispatches = Math.min(3, candidates.length, MAX_RUNNERS - this.coffeeRunners.size)
    for (let i = 0; i < dispatches; i++) {
      const idx = Math.floor(Math.random() * candidates.length)
      const pick = candidates.splice(idx, 1)[0]
      this.sendAgentForCoffee(pick.ws, pick.room)
    }
  }

  private sendAgentForCoffee(ws: CafeWorkstation, room: CafeRoom): void {
    if (!ws.state || !this.container) return
    const scene = this.scene
    const agentId = ws.state.config.id

    const stoolIdx = this.pickStool() // null = standing overflow
    const isStanding = stoolIdx === null

    // Placeholder — real cleanup stored after it's defined below
    this.coffeeRunners.set(agentId, () => {})
    this.coffeeRunnerRooms.set(room.cwd, (this.coffeeRunnerRooms.get(room.cwd) ?? 0) + 1)
    if (stoolIdx !== null) this.stoolOccupied.add(stoolIdx)

    const startX = room.x + ws.container.x
    const startY = room.y + ws.container.y + WS_SPRITE_Y
    const doorX = room.x
    const doorY = getRoomDoorY(room)
    // Standing agents cluster below the counter area with random spread
    const cafeX = stoolIdx !== null
      ? this.stoolWorldX(stoolIdx)
      : (this.worldX - CAFE_W / 2) + 40 + Math.random() * (CAFE_W - 80)
    const cafeY = stoolIdx !== null
      ? this.worldY
      : this.worldY + 28 + Math.random() * 16

    // Safe corridor X — past all rooms to the LEFT (cafe is top-left)
    let safeLeftX = Infinity
    for (const r of scene.rooms.values()) {
      safeLeftX = Math.min(safeLeftX, r.x - r.width / 2)
    }
    safeLeftX -= 20

    // Row corridor Y
    const thisRowTop = Math.round(room.y - room.height / 2)
    let rowMaxBottom = room.y + room.height / 2
    let rowMinTop = room.y - room.height / 2
    for (const r of scene.rooms.values()) {
      if (Math.abs(Math.round(r.y - r.height / 2) - thisRowTop) < 10) {
        rowMaxBottom = Math.max(rowMaxBottom, r.y + r.height / 2)
        rowMinTop = Math.min(rowMinTop, r.y - r.height / 2)
      }
    }
    const WALK_CORRIDOR_OFFSET = ROOM_GAP * 0.45 + 12

    const rowCorridorY = room.doorSide === 'top'
      ? rowMinTop - WALK_CORRIDOR_OFFSET
      : rowMaxBottom + WALK_CORRIDOR_OFFSET

    const localCorridorY = room.doorSide === 'top'
      ? room.y - room.height / 2 - WALK_CORRIDOR_OFFSET
      : room.y + room.height / 2 + WALK_CORRIDOR_OFFSET

    // Hide desk sprite while on coffee run
    ws.sprite.setVisible(false)
    scene.spawnEmojiReaction(startX, startY - 25, '\u2615')

    const charIdx = getAgentCharacterIndex(ws.state)
    const walkSuffix = charIdx === 1 ? '2' : '1'
    const walkSheetKey = `anim-walk-${walkSuffix}`
    const sitSheetKey = `anim-sit-${walkSuffix}`
    const walker = scene.add.sprite(startX, startY, walkSheetKey, 0)
      .setScale(CHAR_SCALE).setOrigin(0.5, 1).setDepth(9000)
    const shadow = scene.add.ellipse(startX, startY + 2, 16, 5, 0x000000, 0.15).setDepth(8999)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      if (stoolIdx !== null) this.stoolOccupied.delete(stoolIdx)
      this.cleanupVisitor(agentId)
      shadow.destroy()
      walker.destroy()
      ws.sprite.setVisible(true)
      this.coffeeRunners.delete(agentId)
      const rc = (this.coffeeRunnerRooms.get(room.cwd) ?? 1) - 1
      if (rc <= 0) this.coffeeRunnerRooms.delete(room.cwd)
      else this.coffeeRunnerRooms.set(room.cwd, rc)
    }
    // Now store the real cleanup so cancelCoffeeRun can force-destroy mid-walk
    this.coffeeRunners.set(agentId, cleanup)

    const deskBottomY = room.y + ws.container.y + WS_DESK_Y + 14

    // Walk path: desk → door → corridor → left past buildings → up/down to cafe row → cafe stool
    const goPoints = [
      { x: startX, y: deskBottomY },
      { x: room.x, y: deskBottomY },
      { x: room.x, y: doorY },
      { x: room.x, y: localCorridorY },
      { x: room.x, y: rowCorridorY },
      { x: safeLeftX, y: rowCorridorY },
      { x: safeLeftX, y: cafeY },
      { x: cafeX, y: cafeY },
    ]
    const backPoints = [
      { x: safeLeftX, y: cafeY },
      { x: safeLeftX, y: rowCorridorY },
      { x: room.x, y: rowCorridorY },
      { x: room.x, y: localCorridorY },
      { x: room.x, y: doorY },
      { x: room.x, y: deskBottomY },
      { x: startX, y: deskBottomY },
      { x: startX, y: startY },
    ]

    let pointIdx = 0
    let currentPoints = goPoints
    let phase: 'going' | 'sitting' | 'returning' = 'going'

    const stepNext = () => {
      if (!walker.active) { cleanup(); return }
      if (pointIdx >= currentPoints.length) {
        if (phase === 'going') {
          // Arrived at cafe
          phase = 'sitting'
          walker.setAngle(0)
          walker.setScale(CHAR_SCALE)
          walker.setDepth(9000)

          if (isStanding) {
            // Standing with coffee — idle facing counter, slight sway
            walker.setTexture(walkSheetKey, 6) // face up toward counter
            walker.setFlipX(false)
            scene.tweens.add({
              targets: walker, angle: { from: -2, to: 2 },
              duration: 2000 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          } else {
            walker.setTexture(sitSheetKey, 3)
            walker.setFlipX(false)
          }

          // Register as visitor (seated or standing)
          const visitor: CafeVisitor = {
            agentId,
            stoolIdx: stoolIdx ?? -1,
            walker,
            shadow,
            cup: null,
            sipTimer: null,
            chatPartner: null,
          }
          this.seatedVisitors.set(agentId, visitor)

          if (isStanding) {
            // Standing agents get a cup right away
            const cup = scene.add.circle(walker.x + 6, walker.y - 12, 3, 0x00ff88, 0.8).setDepth(9002)
            visitor.cup = cup
            visitor.sipTimer = scene.time.addEvent({
              delay: 6000 + Math.random() * 6000, loop: true,
              callback: () => this.sipAnimation(visitor),
            })
            // Periodic emoji while standing around
            scene.time.addEvent({
              delay: 5000 + Math.random() * 5000, loop: true,
              callback: () => {
                if (!walker.active) return
                const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)]
                scene.spawnEmojiReaction(walker.x, walker.y - 30, emoji)
              },
            })
          } else {
            // Barista serves the drink
            this.serveDrink(visitor)
            // Check for adjacent seated neighbors to start chatting
            this.tryStartChat(agentId)
          }

          // No auto-return timer — agent stays until desk is clicked or work arrives.
          // Store a return callback so cancelCoffeeRun can trigger the walk back.
          visitor.triggerReturn = () => {
            if (phase !== 'sitting' || !walker.active) return
            phase = 'returning'
            walker.setTexture(walkSheetKey, 0)
            currentPoints = backPoints
            pointIdx = 0
            this.cleanupVisitor(agentId)
            stepNext()
          }
        } else {
          // Arrived back at desk
          cleanup()
          scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
        }
        return
      }

      const target = currentPoints[pointIdx++]
      const dx = target.x - walker.x
      const dy = target.y - walker.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) { stepNext(); return }

      const adx = Math.abs(dx), ady = Math.abs(dy)
      let startFrame: number
      if (adx > ady * 1.5) {
        startFrame = dx > 0 ? 3 : 9
      } else if (ady > adx * 1.5) {
        startFrame = dy > 0 ? 0 : 6
      } else {
        if (adx > ady) { startFrame = dx > 0 ? 3 : 9 }
        else { startFrame = dy > 0 ? 0 : 6 }
      }

      walker.setTexture(walkSheetKey, startFrame)
      walker.setFlipX(false)
      walker.setScale(CHAR_SCALE)

      const dur = Math.max(200, (dist / WALK_SPEED) * 1000)
      let cycleIdx = 0
      const walkCycleTimer = scene.time.addEvent({
        delay: 200, loop: true,
        callback: () => {
          if (!walker.active) { walkCycleTimer.destroy(); return }
          cycleIdx = cycleIdx === 0 ? 1 : 0
          walker.setFrame(startFrame + 1 + cycleIdx)
          walker.setAngle(cycleIdx === 0 ? -3 : 3)
        },
      })
      scene.tweens.add({
        targets: walker,
        x: target.x, y: target.y,
        duration: dur, ease: 'Linear',
        onComplete: () => { walkCycleTimer.destroy(); stepNext() },
      })
      scene.tweens.add({ targets: shadow, x: target.x, y: target.y + 2, duration: dur, ease: 'Linear' })
    }

    stepNext()
  }

  // ── Barista service ───────────────────────────────────────────────────

  private serveDrink(visitor: CafeVisitor): void {
    const scene = this.scene
    if (!this.container?.active || this.baristas.length === 0) return

    // Find nearest barista to the stool
    const stoolLocalX = STOOL_START_X + visitor.stoolIdx * STOOL_GAP
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < this.baristas.length; i++) {
      const d = Math.abs(this.baristaHomeX[i] - stoolLocalX)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }

    const barista = this.baristas[bestIdx]
    if (!barista?.active) return

    const homeX = this.baristaHomeX[bestIdx]
    // Clamp barista to behind-counter area (don't walk past edges)
    const targetX = Phaser.Math.Clamp(stoolLocalX, 30, CAFE_W - 30)
    const counterTopLocalY = BEHIND_W - 4

    // Walk barista toward the agent's stool position
    scene.tweens.add({
      targets: barista,
      x: targetX,
      duration: 600 + Math.abs(barista.x - targetX) * 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!barista.active || !this.container?.active) return

        // Place cup on counter, then slide to agent
        const cupX = this.container.x + targetX
        const cupY = this.container.y + counterTopLocalY
        const cup = scene.add.circle(cupX, cupY, 3, 0x00ff88, 0.8).setDepth(9002)
        const steam = scene.add.circle(cupX, cupY - 6, 2, 0x00e5ff, 0.25).setDepth(9002)

        // Slide cup to agent
        scene.time.delayedCall(300, () => {
          if (!cup.active || !visitor.walker.active) {
            cup.destroy(); steam.destroy(); return
          }
          const agentCupX = visitor.walker.x
          const agentCupY = visitor.walker.y - 10
          scene.tweens.add({
            targets: [cup, steam],
            x: agentCupX,
            y: { value: agentCupY, ease: 'Quad.easeOut' },
            duration: 500, ease: 'Sine.easeOut',
            onComplete: () => {
              steam.destroy()
              visitor.cup = cup

              // Start sipping animation
              visitor.sipTimer = scene.time.addEvent({
                delay: 6000 + Math.random() * 6000,
                loop: true,
                callback: () => this.sipAnimation(visitor),
              })
            },
          })
        })

        // Walk barista back home
        scene.time.delayedCall(800, () => {
          if (!barista.active) return
          scene.tweens.add({
            targets: barista,
            x: homeX,
            duration: 600 + Math.abs(barista.x - homeX) * 2,
            ease: 'Sine.easeInOut',
          })
        })
      },
    })
  }

  private sipAnimation(visitor: CafeVisitor): void {
    if (!visitor.cup?.active || !visitor.walker.active) return
    const scene = this.scene

    // Cup lifts up briefly
    scene.tweens.add({
      targets: visitor.cup,
      y: visitor.cup.y - 5,
      duration: 350, yoyo: true, hold: 300,
      ease: 'Sine.easeInOut',
    })
    // Agent tilts back slightly
    scene.tweens.add({
      targets: visitor.walker,
      scaleY: CHAR_SCALE * 0.97,
      duration: 350, yoyo: true, hold: 300,
      ease: 'Sine.easeInOut',
    })
  }

  // ── Social interactions ───────────────────────────────────────────────

  private tryStartChat(newAgentId: string): void {
    const newVisitor = this.seatedVisitors.get(newAgentId)
    if (!newVisitor) return

    // Already in a chat?
    if (newVisitor.chatPartner) return

    // Find an adjacent seated neighbor
    for (const [otherId, other] of this.seatedVisitors) {
      if (otherId === newAgentId) continue
      const stoolDiff = Math.abs(other.stoolIdx - newVisitor.stoolIdx)
      if (stoolDiff !== 1) continue

      if (other.chatPartner) {
        // Neighbor is already chatting — join as group observer with periodic emoji reactions
        this.startGroupReactions(newAgentId, otherId)
        return
      }

      // Found a free adjacent neighbor — start chatting
      this.startChatSession(newAgentId, otherId)
      return
    }
  }

  /** Group chat: a third agent near an existing chat pair spawns periodic emoji reactions */
  private startGroupReactions(observerId: string, nearChatAgentId: string): void {
    const observer = this.seatedVisitors.get(observerId)
    if (!observer) return
    const scene = this.scene

    // Mark observer as "chatting" with the neighbor so they face each other
    observer.chatPartner = nearChatAgentId
    const other = this.seatedVisitors.get(nearChatAgentId)
    if (other) {
      const obsIsLeft = observer.stoolIdx < other.stoolIdx
      observer.walker.setFrame(2)
      observer.walker.setFlipX(!obsIsLeft)
    }

    // Periodic emoji reactions from the observer
    const groupTimer = scene.time.addEvent({
      delay: 3000 + Math.random() * 3000,
      loop: true,
      callback: () => {
        if (!observer.walker.active) { groupTimer.destroy(); return }
        const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)]
        scene.spawnEmojiReaction(observer.walker.x, observer.walker.y - 30, emoji)
      },
    })
  }

  private startChatSession(agentA: string, agentB: string): void {
    const visA = this.seatedVisitors.get(agentA)
    const visB = this.seatedVisitors.get(agentB)
    if (!visA || !visB) return

    visA.chatPartner = agentB
    visB.chatPartner = agentA

    // Face each other — switch to side-facing sit frame (frame 2)
    // Frame 2 = side-right by default. FlipX mirrors to side-left.
    // Left agent faces right (no flip), right agent faces left (flip).
    const aIsLeft = visA.stoolIdx < visB.stoolIdx
    visA.walker.setFrame(2)
    visB.walker.setFrame(2)
    visA.walker.setFlipX(!aIsLeft)
    visB.walker.setFlipX(aIsLeft)

    const scene = this.scene

    // Create chat bubbles
    const bubbleA = this.createChatBubble(visA.walker.x, visA.walker.y - 28)
    const bubbleB = this.createChatBubble(visB.walker.x, visB.walker.y - 28)
    bubbleB.setAlpha(0)

    // Alternate bubbles — simulate turn-taking
    let turnA = true
    const turnTimer = scene.time.addEvent({
      delay: 1500 + Math.random() * 1000,
      loop: true,
      callback: () => {
        if (!visA.walker.active || !visB.walker.active) return
        turnA = !turnA
        if (bubbleA.active) {
          scene.tweens.add({ targets: bubbleA, alpha: turnA ? 1 : 0, duration: 200 })
        }
        if (bubbleB.active) {
          scene.tweens.add({ targets: bubbleB, alpha: turnA ? 0 : 1, duration: 200 })
        }
      },
    })

    // Emoji reactions between the two
    const emojiTimer = scene.time.addEvent({
      delay: 4000 + Math.random() * 4000,
      loop: true,
      callback: () => {
        if (!visA.walker.active || !visB.walker.active) return
        const target = Math.random() > 0.5 ? visA : visB
        const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)]
        scene.spawnEmojiReaction(target.walker.x, target.walker.y - 30, emoji)
      },
    })

    // Lean-in gesture — one agent leans toward the other
    const leanTimer = scene.time.addEvent({
      delay: 6000 + Math.random() * 6000,
      loop: true,
      callback: () => {
        const leaner = Math.random() > 0.5 ? visA : visB
        const other = leaner === visA ? visB : visA
        if (!leaner.walker.active || !other.walker.active) return
        const leanDir = other.stoolIdx > leaner.stoolIdx ? 4 : -4
        scene.tweens.add({
          targets: leaner.walker,
          x: leaner.walker.x + leanDir,
          angle: leanDir > 0 ? 3 : -3,
          duration: 500, yoyo: true, hold: 600,
          ease: 'Sine.easeInOut',
        })
      },
    })

    const session: ChatSession = {
      agentA, agentB,
      bubbleA, bubbleB,
      turnTimer, emojiTimer, leanTimer,
    }
    this.chatSessions.push(session)
  }

  private createChatBubble(x: number, y: number): Phaser.GameObjects.Container {
    const scene = this.scene
    const c = scene.add.container(x, y).setDepth(9001)

    // Small rounded bubble with "..."
    const bg = scene.add.graphics()
    bg.fillStyle(0x0d1a2a, 0.9)
    bg.fillRoundedRect(-10, -7, 20, 14, 4)
    // Speech tail
    bg.fillTriangle(-2, 7, 2, 7, 0, 11)
    c.add(bg)

    const dots = scene.add.text(0, 0, '...', {
      fontSize: '8px', fontFamily: 'system-ui, sans-serif',
      color: '#00ff88', resolution: 2,
    }).setOrigin(0.5)
    c.add(dots)

    // Gentle float
    scene.tweens.add({
      targets: c, y: y - 2,
      duration: 1200, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    })

    return c
  }

  private destroyChatSession(session: ChatSession): void {
    session.turnTimer.destroy()
    session.emojiTimer.destroy()
    session.leanTimer.destroy()
    if (session.bubbleA?.active) session.bubbleA.destroy()
    if (session.bubbleB?.active) session.bubbleB.destroy()

    // Clear partner refs and restore counter-facing pose (frame 3, no flip)
    const visA = this.seatedVisitors.get(session.agentA)
    const visB = this.seatedVisitors.get(session.agentB)
    if (visA) {
      visA.chatPartner = null
      if (visA.walker.active) { visA.walker.setFrame(3); visA.walker.setFlipX(false) }
    }
    if (visB) {
      visB.chatPartner = null
      if (visB.walker.active) { visB.walker.setFrame(3); visB.walker.setFlipX(false) }
    }
  }

  // ── Visitor lifecycle ─────────────────────────────────────────────────

  private cleanupVisitor(agentId: string): void {
    const visitor = this.seatedVisitors.get(agentId)
    if (!visitor) return

    // End any chat session involving this agent
    const sessionIdx = this.chatSessions.findIndex(
      s => s.agentA === agentId || s.agentB === agentId,
    )
    if (sessionIdx >= 0) {
      const session = this.chatSessions[sessionIdx]
      this.destroyChatSession(session)
      this.chatSessions.splice(sessionIdx, 1)

      // The remaining partner might find a new chat buddy
      const remainingId = session.agentA === agentId ? session.agentB : session.agentA
      this.scene.time.delayedCall(2000, () => {
        if (this.seatedVisitors.has(remainingId)) {
          this.tryStartChat(remainingId)
        }
      })
    }

    // Clean up cup immediately
    if (visitor.sipTimer) { visitor.sipTimer.destroy(); visitor.sipTimer = null }
    if (visitor.cup?.active) {
      this.scene.tweens.killTweensOf(visitor.cup)
      visitor.cup.destroy()
      visitor.cup = null
    }

    this.seatedVisitors.delete(agentId)
  }
}
