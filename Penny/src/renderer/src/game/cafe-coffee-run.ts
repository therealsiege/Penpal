import Phaser from 'phaser'
import { ANIM_KEYS, SPRITESHEET_KEYS, ITEM_FRAMES, ICON_FRAMES } from './office-asset-keys'
import { WS_SPRITE_Y, WS_DESK_Y, CHAR_SCALE } from './office-constants'
import { getAgentCharacterIndex, getRoomDoorY } from './office-helpers'
import type { CafeRoom, CafeWorkstation, CafeVisitor } from './penny-cafe'
import type { NavMesh } from './nav-mesh'
import { buildOwnRoomRect } from './nav-mesh'
import { PathWalker } from './path-walker'

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
  /** Barista containers for serving animation */
  readonly baristas: Phaser.GameObjects.Container[]
  /** Barista home X values (local to cafe container) */
  readonly baristaHomeX: number[]
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
// CafeCoffeeRunManager
// ---------------------------------------------------------------------------

export class CafeCoffeeRunManager {
  private scene: CoffeRunHostScene
  private host: CoffeeRunHost

  /** Map agentId → cleanup fn. Public so PennyCafe can expose `coffeeRunners`. */
  readonly coffeeRunners = new Map<string, () => void>()
  /** Tracks how many runners came from each room cwd. */
  readonly coffeeRunnerRooms = new Map<string, number>()

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

  /** Stop and discard the timer. */
  destroy(): void {
    if (this.coffeeRunTimer) { this.coffeeRunTimer.destroy(); this.coffeeRunTimer = null }
    this.coffeeRunners.clear()
    this.coffeeRunnerRooms.clear()
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

  // ── Private ──────────────────────────────────────────────────────────────

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
    const doorX = room.x
    const doorY = getRoomDoorY(room)

    const cafeX = stoolIdx !== null
      ? this.host.stoolWorldX(stoolIdx)
      : (this.host.worldX - CAFE_W / 2) + 40 + Math.random() * (CAFE_W - 80)
    const cafeY = stoolIdx !== null
      ? this.host.worldY
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
      shadow.destroy()
      walker.destroy()
      ws.sprite.setVisible(true)
      this.coffeeRunners.delete(agentId)
      const rc = (this.coffeeRunnerRooms.get(room.cwd) ?? 1) - 1
      if (rc <= 0) this.coffeeRunnerRooms.delete(room.cwd)
      else this.coffeeRunnerRooms.set(room.cwd, rc)
    }
    this.coffeeRunners.set(agentId, cleanup)

    // Use NavMesh pathfinding — base grid has corridors + cafe only.
    // ownRoomRect adds this agent's room + door zone as walkable.
    const navMesh = scene.getNavMesh()
    const ownRoomRect = buildOwnRoomRect(room)
    const goPath = navMesh.findPath({ x: startX, y: startY }, { x: cafeX, y: cafeY }, ownRoomRect)
    if (!goPath) { cleanup(); return }
    const returnPath = navMesh.findPath({ x: cafeX, y: cafeY }, { x: startX, y: startY }, ownRoomRect)
      ?? [...goPath].reverse()

    let phase: 'going' | 'sitting' | 'returning' = 'going'

    const onArrival = () => {
      if (!walker.active) { cleanup(); return }
      if (phase === 'going') {
        phase = 'sitting'
        walker.setAngle(0)
        walker.setScale(CHAR_SCALE)
        walker.setDepth(9000)

        if (isStanding) {
          walker.setTexture(walkSheetKey, 6)
          walker.setFlipX(false)
          scene.tweens.add({
            targets: walker, angle: { from: -2, to: 2 },
            duration: 2000 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
        } else {
          walker.setTexture(sitSheetKey, 3)
          walker.setFlipX(false)
        }

        const visitor: CafeVisitor = {
          agentId,
          stoolIdx: stoolIdx ?? -1,
          walker,
          shadow,
          cup: null,
          sipTimer: null,
          chatPartner: null,
        }
        this.host.seatedVisitors.set(agentId, visitor)

        if (isStanding) {
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
        } else {
          this.serveDrink(visitor)
          this.host.tryStartChat(agentId)
        }

        visitor.triggerReturn = () => {
          if (phase !== 'sitting' || !walker.active) return
          phase = 'returning'
          walker.setTexture(walkSheetKey, 0)
          this.cleanupVisitor(agentId)
          pathWalker.startPath(returnPath, () => {
            cleanup()
            scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
          })
        }
      } else {
        cleanup()
        scene.spawnEmojiReaction(startX, startY - 25, '\uD83D\uDE0A')
      }
    }

    pathWalker.startPath(goPath, onArrival)
  }

  // ── Barista service ───────────────────────────────────────────────────────

  private serveDrink(visitor: CafeVisitor): void {
    const scene = this.scene
    const { container, baristas, baristaHomeX } = this.host
    if (!container?.active || baristas.length === 0) return

    const stoolLocalX = STOOL_START_X + visitor.stoolIdx * STOOL_GAP
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < baristas.length; i++) {
      const d = Math.abs(baristaHomeX[i] - stoolLocalX)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }

    const barista = baristas[bestIdx]
    if (!barista?.active) return

    const homeX = baristaHomeX[bestIdx]
    const targetX = Phaser.Math.Clamp(stoolLocalX, 30, CAFE_W - 30)
    const BEHIND_W = 68
    const counterTopLocalY = BEHIND_W - 4

    scene.tweens.add({
      targets: barista,
      x: targetX,
      duration: 600 + Math.abs(barista.x - targetX) * 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!barista.active || !container?.active) return

        const cupX = container.x + targetX
        const cupY = container.y + counterTopLocalY
        const cup = scene.add.sprite(cupX, cupY, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
          .setScale(0.25).setOrigin(0.5).setDepth(9002)
        const steam = scene.add.sprite(cupX, cupY - 6, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
          .setScale(0.15).setOrigin(0.5).setDepth(9002).setAlpha(0.25)

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
              visitor.sipTimer = scene.time.addEvent({
                delay: 6000 + Math.random() * 6000,
                loop: true,
                callback: () => this.sipAnimation(visitor),
              })
            },
          })
        })

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
