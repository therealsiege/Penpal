import Phaser from 'phaser'
import { ANIM_KEYS, SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES } from './office-asset-keys'
import { WS_SPRITE_Y, WS_DESK_Y, CHAR_SCALE } from './office-constants'
import { getAgentCharacterIndex, getRoomDoorY } from './office-helpers'
import type { CafeRoom, CafeWorkstation, CafeVisitor } from './penny-cafe'
import type { NavMesh } from './nav-mesh'
import { buildOwnRoomRect } from './nav-mesh'
import { PathWalker } from './path-walker'
import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PatronPhase =
  | 'walking-to-cafe'
  | 'ordering'
  | 'waiting-for-barista'
  | 'walking-to-stool'
  | 'seated'
  | 'sipping'
  | 'returning'

// ---------------------------------------------------------------------------
// Constants (local — not re-exported)
// ---------------------------------------------------------------------------

const CAFE_W = 340
const STOOL_GAP = 48
const NUM_STOOLS = 6
const TOTAL_STOOLS_W = (NUM_STOOLS - 1) * STOOL_GAP
const STOOL_START_X = (CAFE_W - TOTAL_STOOLS_W) / 2
const WALK_SPEED = 55

const MAX_RUNNERS = 10
const RUN_TIMER_MIN = 3000
const RUN_TIMER_VAR = 5000

/** Max patrons that can queue at the counter waiting for a free barista */
const MAX_COUNTER_QUEUE = 2

// Social emojis reused here for standing-agent idle reactions
const CHAT_EMOJIS = ['\uD83D\uDE04', '\uD83D\uDC4D', '\u2615', '\uD83D\uDCA1', '\uD83E\uDD14', '\uD83D\uDE02', '\uD83D\uDE0E', '\uD83C\uDF1F']

// ---------------------------------------------------------------------------
// Host interface the CafeCoffeeRunManager needs
// ---------------------------------------------------------------------------

export interface CoffeRunHostScene extends Phaser.Scene {
  rooms: Map<string, CafeRoom>
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
  getNavMesh(): NavMesh
}

export interface CoffeeRunHost {
  /** The Phaser container for the cafe visual */
  readonly container: Phaser.GameObjects.Container | null
  /** World-space centre X of the cafe */
  readonly worldX: number
  /** World-space Y aligned to the stool row */
  readonly worldY: number
  /** World-space Y of the serving counter (patrons stand here to order) */
  readonly counterWorldY: number
  /** Barista containers for serving animation */
  readonly baristas: Phaser.GameObjects.Container[]
  /** Barista home X values (local to cafe container) */
  readonly baristaHomeX: number[]
  /** Barista occupancy — true while a barista is actively serving */
  readonly baristasBusy: boolean[]
  /** Set of occupied stool indices */
  readonly stoolOccupied: Set<number>
  /** Currently seated visitors */
  readonly seatedVisitors: Map<string, CafeVisitor>
  /** Convert a stool index to its world-space X coordinate */
  stoolWorldX(stoolIdx: number): number
  /** Notify that a chat should be attempted for a newly seated agent */
  tryStartChat(agentId: string): void
}

// ---------------------------------------------------------------------------
// Internal queue entry
// ---------------------------------------------------------------------------

interface CounterQueueEntry {
  agentId: string
  onReady: (baristaIdx: number) => void
}

// ---------------------------------------------------------------------------
// CafeCoffeeRunManager
// ---------------------------------------------------------------------------

export class CafeCoffeeRunManager {
  private scene: CoffeRunHostScene
  private host: CoffeeRunHost

  /** Map agentId → cleanup fn. Public so PennyCafe can expose `coffeeRunners`. */
  readonly coffeeRunners = new Map<string, () => void>()
  /** Tracks how many runners came from each room cwd. */
  readonly coffeeRunnerRooms = new Map<string, number>()
  /** Current phase for each active patron. Public for testability. */
  readonly patronPhases = new Map<string, PatronPhase>()

  /** FIFO queue of patrons waiting at the counter for a free barista */
  private counterQueue: CounterQueueEntry[] = []
  private coffeeRunTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: CoffeRunHostScene, host: CoffeeRunHost) {
    this.scene = scene
    this.host = host
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Start the periodic coffee run timer. */
  startCoffeeRunTimer(): void {
    if (this.coffeeRunTimer) this.coffeeRunTimer.destroy()
    this.coffeeRunTimer = this.scene.time.addEvent({
      delay: RUN_TIMER_MIN + Math.random() * RUN_TIMER_VAR,
      loop: true,
      callback: () => this.tryStartCoffeeRun(),
    })
  }

  /** Pause the coffee run timer (scene sleep). */
  pause(): void {
    if (this.coffeeRunTimer) this.coffeeRunTimer.paused = true
  }

  /** Resume the coffee run timer (scene wake). */
  resume(): void {
    if (this.coffeeRunTimer) this.coffeeRunTimer.paused = false
  }

  /** Stop and discard the timer. */
  destroy(): void {
    if (this.coffeeRunTimer) { this.coffeeRunTimer.destroy(); this.coffeeRunTimer = null }
    this.coffeeRunners.clear()
    this.coffeeRunnerRooms.clear()
    this.patronPhases.clear()
    this.counterQueue = []
  }

  /** Cancel a running coffee trip — trigger walk back to desk (or force-cleanup pre-seat). */
  cancelCoffeeRun(agentId: string): void {
    const visitor = this.host.seatedVisitors.get(agentId)
    if (visitor?.triggerReturn) {
      visitor.triggerReturn()
    } else {
      const forceCleanup = this.coffeeRunners.get(agentId)
      if (forceCleanup) forceCleanup()
    }
  }

  /** Public entry point for testing — bypasses the random dispatch logic. */
  triggerForAgent(ws: CafeWorkstation, room: CafeRoom): void {
    this.sendAgentForCoffee(ws, room)
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private setPhase(agentId: string, phase: PatronPhase): void {
    this.patronPhases.set(agentId, phase)
    EventBus.emit(EVENTS.CAFE_PATRON_PHASE, agentId, phase)
  }

  private tryStartCoffeeRun(): void {
    const { container, stoolOccupied } = this.host
    if (!container || this.scene.rooms.size === 0) return
    if (this.coffeeRunners.size >= MAX_RUNNERS) return

    const candidates: { ws: CafeWorkstation; room: CafeRoom }[] = []
    for (const room of this.scene.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        if (ws.walkBreakTween) continue
        if (this.coffeeRunners.has(ws.state.config.id)) continue
        const mdl = ws.state.config.model
        if (mdl === 'nemoclaw' || mdl === 'openclaw') continue
        const m = ws.state.sessionMode
        const isBusy = m === 'working' || m === 'plan' || m === 'compressing' || m === 'accept-edits' || ws.state.needsInteraction || ws.state.status === 'active'
        if (isBusy) continue
        candidates.push({ ws, room })
      }
    }
    if (candidates.length === 0) return

    const dispatches = Math.min(3, candidates.length, MAX_RUNNERS - this.coffeeRunners.size)
    for (let i = 0; i < dispatches; i++) {
      const idx = Math.floor(Math.random() * candidates.length)
      const pick = candidates.splice(idx, 1)[0]
      this.sendAgentForCoffee(pick.ws, pick.room)
    }
  }

  private sendAgentForCoffee(ws: CafeWorkstation, room: CafeRoom): void {
    if (!ws.state || !this.host.container) return
    const scene = this.scene
    const agentId = ws.state.config.id

    const stoolIdx = this.pickStool()
    const isStanding = stoolIdx === null

    // Placeholder — real cleanup stored below
    this.coffeeRunners.set(agentId, () => {})
    this.coffeeRunnerRooms.set(room.cwd, (this.coffeeRunnerRooms.get(room.cwd) ?? 0) + 1)
    if (stoolIdx !== null) this.host.stoolOccupied.add(stoolIdx)

    const startX = room.x + ws.container.x
    const startY = room.y + ws.container.y + WS_SPRITE_Y

    // Phase 1 destination:
    //   Seated → walk to the serving counter side (same X as stool, counter Y)
    //   Standing → random spot near the cafe
    const cafeX = stoolIdx !== null
      ? this.host.stoolWorldX(stoolIdx)
      : (this.host.worldX - CAFE_W / 2) + 40 + Math.random() * (CAFE_W - 80)
    const cafeY = stoolIdx !== null
      ? this.host.counterWorldY
      : this.host.worldY + 28 + Math.random() * 16

    ws.sprite.setVisible(false)
    scene.spawnEmojiReaction(startX, startY - 25, '\u2615')

    const charIdx = getAgentCharacterIndex(ws.state)
    const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
    const sitSheetKey  = charIdx === 1 ? ANIM_KEYS.SIT_2  : ANIM_KEYS.SIT_1
    const walker = scene.add.sprite(startX, startY, walkSheetKey, 0)
      .setScale(CHAR_SCALE).setOrigin(0.5, 1).setDepth(9000)
    const shadow = scene.add.ellipse(startX, startY + 2, 16, 5, 0x000000, 0.15).setDepth(8999)

    const pathWalker = new PathWalker(scene, walker, shadow, walkSheetKey, WALK_SPEED)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      pathWalker.destroy()
      if (stoolIdx !== null) this.host.stoolOccupied.delete(stoolIdx)
      this.cleanupVisitor(agentId)
      this.patronPhases.delete(agentId)
      // Remove from counter queue if still waiting
      this.counterQueue = this.counterQueue.filter(e => e.agentId !== agentId)
      shadow.destroy()
      walker.destroy()
      ws.sprite.setVisible(true)
      this.coffeeRunners.delete(agentId)
      const rc = (this.coffeeRunnerRooms.get(room.cwd) ?? 1) - 1
      if (rc <= 0) this.coffeeRunnerRooms.delete(room.cwd)
      else this.coffeeRunnerRooms.set(room.cwd, rc)
    }
    this.coffeeRunners.set(agentId, cleanup)

    // Use NavMesh pathfinding
    const navMesh = scene.getNavMesh()
    const ownRoomRect = buildOwnRoomRect(room)
    const goPath = navMesh.findPath({ x: startX, y: startY }, { x: cafeX, y: cafeY }, ownRoomRect)
    if (!goPath) { cleanup(); return }

    // Return path starts from the stool for seated patrons (not the counter)
    const returnFromY = isStanding ? cafeY : this.host.worldY
    const returnPath = navMesh.findPath({ x: cafeX, y: returnFromY }, { x: startX, y: startY }, ownRoomRect)
      ?? [...goPath].reverse()

    this.setPhase(agentId, 'walking-to-cafe')

    pathWalker.startPath(goPath, () => {
      if (!walker.active) { cleanup(); return }
      walker.setAngle(0)
      walker.setScale(CHAR_SCALE)
      walker.setDepth(9000)

      if (isStanding) {
        // ── Standing flow — no barista service, cup appears immediately ──
        walker.setTexture(walkSheetKey, 6)
        walker.setFlipX(false)
        scene.tweens.add({
          targets: walker, angle: { from: -2, to: 2 },
          duration: 2000 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })

        const visitor: CafeVisitor = {
          agentId, stoolIdx: -1, walker, shadow, cup: null, sipTimer: null, chatPartner: null,
        }
        this.host.seatedVisitors.set(agentId, visitor)

        const cup = scene.add.sprite(walker.x + 6, walker.y - 12, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
          .setScale(0.25).setOrigin(0.5).setDepth(9002)
        visitor.cup = cup
        visitor.sipTimer = scene.time.addEvent({
          delay: 6000 + Math.random() * 6000, loop: true,
          callback: () => this.sipAnimation(visitor),
        })
        scene.time.addEvent({
          delay: 5000 + Math.random() * 5000, loop: true,
          callback: () => {
            if (!walker.active) return
            const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)]
            scene.spawnEmojiReaction(walker.x, walker.y - 30, emoji)
          },
        })

        visitor.triggerReturn = () => {
          if (!walker.active) return
          this.setPhase(agentId, 'returning')
          walker.setTexture(walkSheetKey, 0)
          this.cleanupVisitor(agentId)
          pathWalker.startPath(returnPath, () => {
            cleanup()
            scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
          })
        }
        return
      }

      // ── Seated flow: Phase 2 — ordering at counter ──
      this.setPhase(agentId, 'ordering')
      scene.spawnEmojiReaction(walker.x, walker.y - 25, '\u2615')

      const visitor: CafeVisitor = {
        agentId, stoolIdx: stoolIdx!, walker, shadow, cup: null, sipTimer: null, chatPartner: null,
      }
      this.host.seatedVisitors.set(agentId, visitor)

      // Set triggerReturn early so cancelCoffeeRun works during ordering/waiting
      visitor.triggerReturn = () => {
        const phase = this.patronPhases.get(agentId)
        if (phase === 'seated' || phase === 'sipping') {
          this.setPhase(agentId, 'returning')
          walker.setTexture(walkSheetKey, 0)
          this.cleanupVisitor(agentId)
          pathWalker.startPath(returnPath, () => {
            cleanup()
            scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
          })
        } else {
          cleanup()
        }
      }

      // Phase 3 — wait 500-1000ms then request barista service
      scene.time.delayedCall(500 + Math.random() * 500, () => {
        if (!walker.active) { cleanup(); return }
        this.requestBaristaService(agentId, visitor, stoolIdx!, () => {
          // Phase 5/6 — cup delivered, walk from counter Y to stool Y
          if (!walker.active) { cleanup(); return }
          this.setPhase(agentId, 'walking-to-stool')
          walker.setTexture(walkSheetKey, 0)

          const stoolWorldY = this.host.worldY
          scene.tweens.add({
            targets: walker,
            y: stoolWorldY,
            duration: 400,
            ease: 'Sine.easeOut',
            onComplete: () => {
              if (!walker.active) { cleanup(); return }
              // Phase 6 — seated
              walker.setTexture(sitSheetKey, 3)
              walker.setFlipX(false)
              this.setPhase(agentId, 'seated')

              visitor.sipTimer = scene.time.addEvent({
                delay: 6000 + Math.random() * 6000,
                loop: true,
                callback: () => {
                  if (this.patronPhases.get(agentId) === 'seated') {
                    this.setPhase(agentId, 'sipping')
                  }
                  this.sipAnimation(visitor)
                },
              })

              this.host.tryStartChat(agentId)

              // Update triggerReturn now that patron is fully seated
              visitor.triggerReturn = () => {
                const ph = this.patronPhases.get(agentId)
                if (ph !== 'seated' && ph !== 'sipping') return
                this.setPhase(agentId, 'returning')
                walker.setTexture(walkSheetKey, 0)
                this.cleanupVisitor(agentId)
                pathWalker.startPath(returnPath, () => {
                  cleanup()
                  scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
                })
              }
            },
          })
          // Keep shadow in sync
          scene.tweens.add({
            targets: shadow,
            y: stoolWorldY + 2,
            duration: 400,
            ease: 'Sine.easeOut',
          })
        }, cleanup)
      })
    })
  }

  // ── Barista queue ─────────────────────────────────────────────────────────

  private requestBaristaService(
    agentId: string,
    visitor: CafeVisitor,
    stoolIdx: number,
    onDelivered: () => void,
    cleanup: () => void,
  ): void {
    const { baristasBusy } = this.host
    const freeIdx = baristasBusy.findIndex(busy => !busy)

    if (freeIdx !== -1) {
      // Phase 4 — barista assigned immediately
      baristasBusy[freeIdx] = true
      this.baristaWalkToCounterAndInteract(freeIdx, stoolIdx, visitor, onDelivered)
    } else if (this.counterQueue.length < MAX_COUNTER_QUEUE) {
      // Phase 3 extended — wait in queue
      this.setPhase(agentId, 'waiting-for-barista')
      this.counterQueue.push({
        agentId,
        onReady: (baristaIdx: number) => {
          baristasBusy[baristaIdx] = true
          this.baristaWalkToCounterAndInteract(baristaIdx, stoolIdx, visitor, onDelivered)
        },
      })
    } else {
      // Counter full — skip this run
      cleanup()
    }
  }

  private dequeueNextPatron(): void {
    if (this.counterQueue.length === 0) return
    const { baristasBusy } = this.host
    const freeIdx = baristasBusy.findIndex(busy => !busy)
    if (freeIdx === -1) return
    const entry = this.counterQueue.shift()!
    entry.onReady(freeIdx)
  }

  // ── Barista service animation ─────────────────────────────────────────────

  private baristaWalkToCounterAndInteract(
    baristaIdx: number,
    stoolIdx: number,
    visitor: CafeVisitor,
    onDelivered: () => void,
  ): void {
    const scene = this.scene
    const { container, baristas, baristaHomeX, baristasBusy } = this.host

    const releaseBaristaAndDequeue = () => {
      baristasBusy[baristaIdx] = false
      this.dequeueNextPatron()
    }

    if (!container?.active || baristas.length === 0) {
      releaseBaristaAndDequeue()
      onDelivered()
      return
    }

    const barista = baristas[baristaIdx]
    if (!barista?.active) {
      releaseBaristaAndDequeue()
      onDelivered()
      return
    }

    const stoolLocalX = STOOL_START_X + stoolIdx * STOOL_GAP
    const homeX = baristaHomeX[baristaIdx]
    const targetX = Phaser.Math.Clamp(stoolLocalX, 30, CAFE_W - 30)
    const BEHIND_W = 68
    const counterTopLocalY = BEHIND_W - 4

    // Suspend idle sway so it doesn't fight the service tween
    scene.tweens.killTweensOf(barista)

    // Face toward patron
    const baristaSprite = barista.list?.[0] as Phaser.GameObjects.Sprite | undefined
    if (baristaSprite) {
      baristaSprite.setFlipX(targetX < homeX)
    }

    scene.tweens.add({
      targets: barista,
      x: targetX,
      duration: 600 + Math.abs(barista.x - targetX) * 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!barista.active || !container?.active) {
          releaseBaristaAndDequeue()
          onDelivered()
          return
        }

        // Brief bob — simulate order prep
        scene.tweens.add({
          targets: barista,
          scaleX: 1.05, scaleY: 0.95,
          duration: 200, yoyo: true,
          ease: 'Sine.easeInOut',
        })

        // After ~1200ms prep time, slide cup across the counter
        scene.time.delayedCall(1200, () => {
          if (!barista.active || !container?.active || !visitor.walker.active) {
            releaseBaristaAndDequeue()
            onDelivered()
            return
          }

          const cupX = container.x + targetX
          const cupY = container.y + counterTopLocalY
          const cup = scene.add.sprite(cupX, cupY, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
            .setScale(0.25).setOrigin(0.5).setDepth(9002)
          const steam = scene.add.sprite(cupX, cupY - 6, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
            .setScale(0.15).setOrigin(0.5).setDepth(9002).setAlpha(0.25)

          // Cup travels to patron's current world position (at the counter)
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

              // Reset barista facing and walk home
              if (baristaSprite) baristaSprite.setFlipX(false)
              scene.tweens.add({
                targets: barista,
                x: homeX,
                duration: 600 + Math.abs(barista.x - homeX) * 2,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                  releaseBaristaAndDequeue()
                  // Re-add idle sway tweens
                  scene.tweens.add({
                    targets: barista,
                    angle: { from: -3, to: 3 },
                    duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                  })
                  scene.tweens.add({
                    targets: barista,
                    x: homeX + 12,
                    duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                  })
                },
              })

              onDelivered()
            },
          })
        })
      },
    })
  }

  private sipAnimation(visitor: CafeVisitor): void {
    if (!visitor.cup?.active || !visitor.walker.active) return
    const scene = this.scene

    scene.tweens.add({
      targets: visitor.cup,
      y: visitor.cup.y - 5,
      duration: 350, yoyo: true, hold: 300,
      ease: 'Sine.easeInOut',
    })
    scene.tweens.add({
      targets: visitor.walker,
      scaleY: CHAR_SCALE * 0.97,
      duration: 350, yoyo: true, hold: 300,
      ease: 'Sine.easeInOut',
    })
  }

  // ── Stool management ──────────────────────────────────────────────────────

  private pickStool(): number | null {
    const stoolOccupied = this.host.stoolOccupied
    const adjacentFree: number[] = []
    const otherFree: number[] = []
    for (let i = 0; i < NUM_STOOLS; i++) {
      if (stoolOccupied.has(i)) continue
      const hasNeighbor = stoolOccupied.has(i - 1) || stoolOccupied.has(i + 1)
      if (hasNeighbor) adjacentFree.push(i)
      else otherFree.push(i)
    }
    if (adjacentFree.length > 0 && stoolOccupied.size > 0) {
      return adjacentFree[Math.floor(Math.random() * adjacentFree.length)]
    }
    if (otherFree.length > 0) {
      return otherFree[Math.floor(Math.random() * otherFree.length)]
    }
    return null
  }

  // ── Visitor lifecycle (delegated from PennyCafe) ──────────────────────────

  /**
   * Cleans up cup/sip state and removes the visitor from the seatedVisitors map.
   * Chat teardown is handled by CafeChatManager before this is called.
   */
  cleanupVisitor(agentId: string): void {
    const visitor = this.host.seatedVisitors.get(agentId)
    if (!visitor) return

    if (visitor.sipTimer) { visitor.sipTimer.destroy(); visitor.sipTimer = null }
    if (visitor.cup?.active) {
      this.scene.tweens.killTweensOf(visitor.cup)
      visitor.cup.destroy()
      visitor.cup = null
    }

    this.host.seatedVisitors.delete(agentId)
  }
}
