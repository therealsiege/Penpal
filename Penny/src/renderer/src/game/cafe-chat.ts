import Phaser from 'phaser'
import type { CafeVisitor, ChatSession } from './penny-cafe'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// Social emojis
// ---------------------------------------------------------------------------

const CHAT_EMOJIS = ['\uD83D\uDE04', '\uD83D\uDC4D', '\u2615', '\uD83D\uDCA1', '\uD83E\uDD14', '\uD83D\uDE02', '\uD83D\uDE0E', '\uD83C\uDF1F']

// ---------------------------------------------------------------------------
// Host interface the CafeChatManager needs from PennyCafe
// ---------------------------------------------------------------------------

export interface ChatHost {
  /** All currently seated visitors (stool or standing). */
  readonly seatedVisitors: Map<string, CafeVisitor>
  /** Convert a stool index to world-space X. */
  stoolWorldX(stoolIdx: number): number
  /** The cafe's Phaser container (for positioning). */
  readonly container: Phaser.GameObjects.Container | null
}

export interface ChatHostScene extends Phaser.Scene {
  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void
}

// ---------------------------------------------------------------------------
// CafeChatManager
// ---------------------------------------------------------------------------

export class CafeChatManager {
  private scene: ChatHostScene
  private host: ChatHost
  private chatSessions: ChatSession[] = []

  constructor(scene: ChatHostScene, host: ChatHost) {
    this.scene = scene
    this.host = host
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Attempt to start a chat between a newly seated agent and an adjacent visitor. */
  tryStartChat(newAgentId: string): void {
    const newVisitor = this.host.seatedVisitors.get(newAgentId)
    if (!newVisitor) return
    if (newVisitor.chatPartner) return

    for (const [otherId, other] of this.host.seatedVisitors) {
      if (otherId === newAgentId) continue
      const stoolDiff = Math.abs(other.stoolIdx - newVisitor.stoolIdx)
      if (stoolDiff !== 1) continue

      if (other.chatPartner) {
        this.startGroupReactions(newAgentId, otherId)
        return
      }

      this.startChatSession(newAgentId, otherId)
      return
    }
  }

  /** Tear down any chat session involving this agent and attempt to re-pair the partner. */
  cleanupVisitorChats(agentId: string): void {
    const sessionIdx = this.chatSessions.findIndex(
      s => s.agentA === agentId || s.agentB === agentId,
    )
    if (sessionIdx < 0) return

    const session = this.chatSessions[sessionIdx]
    this.destroyChatSession(session)
    this.chatSessions.splice(sessionIdx, 1)

    // The remaining partner might find a new chat buddy
    const remainingId = session.agentA === agentId ? session.agentB : session.agentA
    this.scene.time.delayedCall(2000, () => {
      if (this.host.seatedVisitors.has(remainingId)) {
        this.tryStartChat(remainingId)
      }
    })
  }

  /** Destroy all active chat sessions (called on full cafe teardown). */
  destroyAll(): void {
    for (const session of this.chatSessions) {
      this.destroyChatSession(session)
    }
    this.chatSessions = []
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private startGroupReactions(observerId: string, nearChatAgentId: string): void {
    const observer = this.host.seatedVisitors.get(observerId)
    if (!observer) return
    const scene = this.scene

    observer.chatPartner = nearChatAgentId
    const other = this.host.seatedVisitors.get(nearChatAgentId)
    if (other) {
      const obsIsLeft = observer.stoolIdx < other.stoolIdx
      observer.walker.setFrame(2)
      observer.walker.setFlipX(!obsIsLeft)
    }

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
    const visA = this.host.seatedVisitors.get(agentA)
    const visB = this.host.seatedVisitors.get(agentB)
    if (!visA || !visB) return

    visA.chatPartner = agentB
    visB.chatPartner = agentA

    const aIsLeft = visA.stoolIdx < visB.stoolIdx
    visA.walker.setFrame(2)
    visB.walker.setFrame(2)
    visA.walker.setFlipX(!aIsLeft)
    visB.walker.setFlipX(aIsLeft)

    const scene = this.scene

    const bubbleA = this.createChatBubble(visA.walker.x, visA.walker.y - 28)
    const bubbleB = this.createChatBubble(visB.walker.x, visB.walker.y - 28)
    bubbleB.setAlpha(0)

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

    const bg = scene.add.graphics()
    bg.fillStyle(0x0d1a2a, 0.9)
    bg.fillRoundedRect(-10, -7, 20, 14, 4)
    bg.fillTriangle(-2, 7, 2, 7, 0, 11)
    c.add(bg)

    const dots = scene.add.text(0, 0, '...', {
      fontSize: scaledFontSize(8), fontFamily: 'system-ui, sans-serif',
      color: '#00ff88', resolution: 2,
    }).setOrigin(0.5)
    c.add(dots)

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

    const visA = this.host.seatedVisitors.get(session.agentA)
    const visB = this.host.seatedVisitors.get(session.agentB)
    if (visA) {
      visA.chatPartner = null
      if (visA.walker.active) { visA.walker.setFrame(3); visA.walker.setFlipX(false) }
    }
    if (visB) {
      visB.chatPartner = null
      if (visB.walker.active) { visB.walker.setFrame(3); visB.walker.setFlipX(false) }
    }
  }
}
