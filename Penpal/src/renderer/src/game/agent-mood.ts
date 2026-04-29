import Phaser from 'phaser'
import { ICON_FRAMES } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// AgentMoodManager — emoji thought bubbles and mood derivation for office agents
// Floating emoji text objects rise and fade above workstations at a per-mood
// cadence. Mood is derived deterministically from agent runtime state.
// ---------------------------------------------------------------------------

export type Mood =
  | 'focused'
  | 'happy'
  | 'frustrated'
  | 'tired'
  | 'caffeinated'
  | 'celebrating'
  | 'idle'
  | 'zen'

export interface MoodConfig {
  /** Primary emoji shown most often in the thought bubble. */
  emoji: string
  /** Secondary emojis that appear occasionally instead of the primary. */
  secondaryEmojis: string[]
  /** Sprite frame index from GAME_ICONS sheet for the mood badge indicator. */
  spriteFrame: number
  /** Optional subtle hex tint applied to the agent sprite. */
  spriteTint?: number
  /** Optional hex color for ambient mood particles. */
  particleColor?: number
  /** Milliseconds between thought bubble appearances (lower = more frequent). */
  bubbleRate: number
}

export const MOOD_CONFIGS: Record<Mood, MoodConfig> = {
  focused:     { emoji: '💻', secondaryEmojis: ['⌨️', '🔍', '📝'],   spriteFrame: ICON_FRAMES.PLAY_DARK,      bubbleRate: 15000, spriteTint: 0xd0e8ff },
  happy:       { emoji: '😊', secondaryEmojis: ['🎉', '✨', '💪'],   spriteFrame: ICON_FRAMES.CHECKMARK,      bubbleRate: 12000, spriteTint: 0xd4ffd4 },
  frustrated:  { emoji: '😤', secondaryEmojis: ['🐛', '❌', '💢'],   spriteFrame: ICON_FRAMES.CROSS_RED,      bubbleRate:  8000, spriteTint: 0xffe0d0, particleColor: 0xf97316 },
  tired:       { emoji: '😴', secondaryEmojis: ['💤', '☕', '🥱'],   spriteFrame: ICON_FRAMES.CIRCLE_GREY,    bubbleRate: 10000, spriteTint: 0xd8d8e8 },
  caffeinated: { emoji: '☕', secondaryEmojis: ['⚡', '🚀', '💨'],   spriteFrame: ICON_FRAMES.CIRCLE_YELLOW,  bubbleRate:  6000, spriteTint: 0xfff3c0, particleColor: 0xfbbf24 },
  celebrating: { emoji: '🎉', secondaryEmojis: ['🏆', '⭐', '🥳'],   spriteFrame: ICON_FRAMES.STAR_YELLOW,    bubbleRate:  4000, spriteTint: 0xffffff, particleColor: 0xf472b6 },
  idle:        { emoji: '💭', secondaryEmojis: ['📱', '🎮', '🎵'],   spriteFrame: ICON_FRAMES.CIRCLE_GREY,    bubbleRate: 20000 },
  zen:         { emoji: '🧘', secondaryEmojis: ['🌿', '☮️', '🕊️'], spriteFrame: ICON_FRAMES.CIRCLE_GREEN,   bubbleRate: 25000, spriteTint: 0xdcf5e4 },
}

// Two hours in milliseconds — threshold to consider an agent "tired".
const TIRED_THRESHOLD_MS = 2 * 60 * 60 * 1000

// How long (ms) the caffeinated state lingers after a coffee run.
const COFFEE_DURATION_MS = 10 * 60 * 1000

// How long (ms) the celebrating state lasts after a task completion.
const CELEBRATE_DURATION_MS = 30 * 1000

interface MoodRecord {
  mood: Mood
  since: number
}

interface AgentSnapshot {
  x: number
  y: number
  status: string
  blocked: boolean
  uptime: number
}

export class AgentMoodManager {
  private _moods = new Map<string, MoodRecord>()
  /** Timestamp (Date.now()) of the last coffee run per agent. */
  private _lastCoffee = new Map<string, number>()
  /** Timestamp of the last task completion per agent (for celebrating). */
  private _lastCompletion = new Map<string, number>()
  /** Timestamp of the last thought bubble spawn per agent (for rate-limiting). */
  private _lastBubble = new Map<string, number>()
  /** Previous status per agent — used to detect working→idle transitions. */
  private _prevStatus = new Map<string, string>()

  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Derive a mood from raw agent runtime data.
   * Priority order: blocked > celebrating > caffeinated > tired > working → focused > idle → idle/zen
   */
  deriveMood(
    agentId: string,
    status: string,
    isBlocked: boolean,
    uptimeMs: number,
    hadCoffee: boolean,
  ): Mood {
    if (isBlocked) return 'frustrated'

    const completionAge = Date.now() - (this._lastCompletion.get(agentId) ?? 0)
    if (completionAge < CELEBRATE_DURATION_MS) return 'celebrating'

    if (hadCoffee) {
      const coffeeAge = Date.now() - (this._lastCoffee.get(agentId) ?? Infinity)
      if (coffeeAge < COFFEE_DURATION_MS) return 'caffeinated'
    }

    if (uptimeMs > TIRED_THRESHOLD_MS) return 'tired'

    const s = status.toLowerCase()
    const isWorking = s === 'working' || s === 'busy' || s === 'running'
    if (isWorking) return 'focused'

    const isWaiting = s === 'waiting' || s === 'pending'
    if (isWaiting) return 'zen'

    // Recently transitioned to idle — check if task just finished.
    const prev = this._prevStatus.get(agentId) ?? ''
    const prevWorking = prev === 'working' || prev === 'busy' || prev === 'running'
    if (prevWorking && !isWorking) return 'happy'

    return 'idle'
  }

  /** Explicitly force a mood for an agent. */
  setMood(agentId: string, mood: Mood): void {
    this._moods.set(agentId, { mood, since: Date.now() })
  }

  /** Get the current mood for an agent, defaulting to 'idle'. */
  getMood(agentId: string): Mood {
    return this._moods.get(agentId)?.mood ?? 'idle'
  }

  /**
   * Record that an agent just returned from a coffee run.
   * Call this when the agent's `onCoffeeRun` flag transitions false → true → false.
   */
  notifyCoffeeRun(agentId: string): void {
    this._lastCoffee.set(agentId, Date.now())
  }

  /**
   * Record that an agent just completed a task.
   * Call this when the agent transitions from working → idle.
   */
  notifyTaskComplete(agentId: string): void {
    this._lastCompletion.set(agentId, Date.now())
  }

  /**
   * Spawn a floating emoji thought bubble at world coordinates (x, y).
   * Respects the bubbleRate cooldown for the current mood.
   * Randomly picks between the primary emoji and a secondary one (20% chance).
   */
  showMoodBubble(agentId: string, x: number, y: number): void {
    const mood = this.getMood(agentId)
    const config = MOOD_CONFIGS[mood]
    const now = Date.now()
    const lastAt = this._lastBubble.get(agentId) ?? 0

    if (now - lastAt < config.bubbleRate) return

    this._lastBubble.set(agentId, now)

    // 20% chance to pick a secondary emoji for variety.
    const useSecondary = Math.random() < 0.2 && config.secondaryEmojis.length > 0
    const emoji = useSecondary
      ? config.secondaryEmojis[Math.floor(Math.random() * config.secondaryEmojis.length)]
      : config.emoji

    // Slight horizontal jitter so bubbles don't stack perfectly.
    const jitterX = (Math.random() - 0.5) * 12
    const startY = y - 20

    const text = this.scene.add.text(x + jitterX, startY, emoji, {
      fontSize: scaledFontSize(14),
      fontFamily: 'system-ui, sans-serif',
      resolution: 2,
    })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(300)

    // Fade in while rising, then fade out.
    this.scene.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      y: startY - 8,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        if (!text.active) return
        this.scene.tweens.add({
          targets: text,
          alpha: 0,
          y: startY - 28,
          duration: 700,
          ease: 'Power1',
          delay: 600,
          onComplete: () => text.destroy(),
        })
      },
    })
  }

  /**
   * Call from the scene update loop.
   * Re-derives mood for each agent from current snapshot data, detects
   * working→idle transitions for task-complete events, and spawns
   * thought bubbles at the configured cadence.
   */
  update(
    agents: Map<string, AgentSnapshot>,
  ): void {
    agents.forEach((snapshot, agentId) => {
      const prev = this._prevStatus.get(agentId) ?? ''
      const curr = snapshot.status.toLowerCase()

      // Detect task completion: working → non-working transition.
      const prevWorking = prev === 'working' || prev === 'busy' || prev === 'running'
      const currWorking = curr === 'working' || curr === 'busy' || curr === 'running'
      if (prevWorking && !currWorking) {
        this.notifyTaskComplete(agentId)
      }

      this._prevStatus.set(agentId, curr)

      // Derive and store mood.
      const hadCoffee = this._lastCoffee.has(agentId)
      const mood = this.deriveMood(
        agentId,
        snapshot.status,
        snapshot.blocked,
        snapshot.uptime,
        hadCoffee,
      )
      this._moods.set(agentId, { mood, since: this._moods.get(agentId)?.since ?? Date.now() })

      // Spawn thought bubble if the rate allows.
      this.showMoodBubble(agentId, snapshot.x, snapshot.y)
    })
  }

  /** Remove all tracking state for an agent (e.g. on AGENT_DEPARTED). */
  removeAgent(agentId: string): void {
    this._moods.delete(agentId)
    this._lastCoffee.delete(agentId)
    this._lastCompletion.delete(agentId)
    this._lastBubble.delete(agentId)
    this._prevStatus.delete(agentId)
  }

  /** Tear down all state (e.g. on scene shutdown). */
  destroy(): void {
    this._moods.clear()
    this._lastCoffee.clear()
    this._lastCompletion.clear()
    this._lastBubble.clear()
    this._prevStatus.clear()
  }
}
