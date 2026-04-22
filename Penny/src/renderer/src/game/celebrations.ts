// ---------------------------------------------------------------------------
// celebrations.ts
// CelebrationManager — rank-up, task-complete, milestone, error, and
// achievement effects.
//
// All effects use Phaser Graphics/Text + tweens + VFX sprites.
// Particles are pre-allocated Arc GameObjects recycled via getData('busy').
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { SeasonCeremonyRankingRow, SeasonEndedEventPayload } from './events'
import { SPRITESHEET_KEYS, EFFECT_ANIM_KEYS, ICON_FRAMES, LEGO_SPECIAL_FRAMES, DIFFICULTY_STAR_FRAME, MEDAL_HD_FRAMES } from './office-asset-keys'
import type { QuestDifficulty } from './quest-system'
import { soundEngine } from './sound-engine'
import { audioManager } from './audio-manager'
import { AnimConfig } from './animation-config'
import { scaledFontSize } from './office-constants'
import { activeTheme } from './office-theme'

// Pool sizes
const BURST_POOL_SIZE = 48   // shared by rankUp + milestone burst layers
const CONFETTI_POOL_SIZE = 40
const SPARKLE_POOL_SIZE = 16 // small task-complete sparkles

// Confetti palette
const CONFETTI_COLORS = [
  0xf59e0b, 0xef4444, 0x10b981, 0x3b82f6, 0xa855f7, 0xf43f5e, 0xfbbf24, 0x06b6d4,
]

// Difficulty color mapping for quest reward effects
const DIFFICULTY_COLORS: Record<string, number> = {
  trivial:   0x6b7280,
  normal:    0x3b82f6,
  hard:      0xa855f7,
  epic:      0xf59e0b,
  legendary: 0xef4444,
}

export function themeIconFrameForTheme(theme: string): number {
  switch (theme) {
    case 'neon':
      return ICON_FRAMES.MEDAL_GOLD_BLUE
    case 'focus':
      return ICON_FRAMES.MEDAL_GOLD_PURPLE
    case 'ship':
      return ICON_FRAMES.MEDAL_GOLD_WHITE
    case 'blitz':
      return ICON_FRAMES.STAR_YELLOW
    default:
      return ICON_FRAMES.STAR_BLUE
  }
}

export interface SeasonEndCeremonyPayload extends SeasonEndedEventPayload {
  rankings: SeasonCeremonyRankingRow[]
  mvpAgentId: string | null
  mvpWorldX: number
  mvpWorldY: number
  creditBonusShown: number
}

export interface SeasonIntroPayload {
  seasonName: string
  theme: string
  accentColor: number
  themeIconFrame: number
  challenges: { description: string; completed: boolean }[]
}

export interface SeasonCeremonyOpts {
  bypassDedupe?: boolean
  onComplete?: () => void
}

export type CameraJuiceHint = 'taskComplete' | 'rankUp' | 'errorZoomOut'

export interface CelebrationManagerOptions {
  onCameraJuice?: (hint: CameraJuiceHint) => void
  /** Called immediately before camera.shake() — lets PostFXManager sync chromatic aberration. */
  onShake?: () => void
}

/** Optional per-call guards (global toggle via {@link CelebrationManager.setCelebrationsAllowed}). */
export interface CelebrationOptions {
  agentId?: string
  skipCooldown?: boolean
  /** When false, this call is skipped (e.g. agent not visible). */
  allow?: boolean
  /** When set, a second call with the same key before TTL expires is ignored. */
  dedupeKey?: string
  dedupeTtlMs?: number
}

type QueuedCelebrationKind = 'rank-up' | 'milestone' | 'quest' | 'task' | 'error'

const CELEBRATION_PRIORITY: Record<QueuedCelebrationKind, number> = {
  'rank-up': 5,
  milestone: 4,
  quest: 3,
  task: 2,
  error: 1,
}

type PendingCelebration = {
  seq: number
  kind: QueuedCelebrationKind
  enqueuedAtScene: number
  mergeCount: number
  run: () => void
}

// ---------------------------------------------------------------------------
// CelebrationManager
// ---------------------------------------------------------------------------
//
// Queued: rank-up > milestone > quest > task > error (sidekick#72). Season
// ceremonies, achievements, purchases, approveSparkle, and xpGain bypass the
// queue and fire immediately.

export class CelebrationManager {
  private _scene: Phaser.Scene
  private _onCameraJuice?: (hint: CameraJuiceHint) => void
  private _onShake?: () => void

  private _celebrationsAllowed = true
  private _lastSeasonEndKey = ''
  private _lastSeasonEndAt = 0

  private _celebrationsEnabled = true
  private _dedupeKeys = new Set<string>()

  // Burst particle pool (Arc circles, ADD blend)
  private _burstPool: Phaser.GameObjects.Arc[] = []

  // Confetti pool (Graphics rectangles)
  private _confettiPool: Phaser.GameObjects.Graphics[] = []

  // Small sparkle pool for taskComplete
  private _sparklePool: Phaser.GameObjects.Arc[] = []

  private _pending: PendingCelebration[] = []
  private _pendingSeq = 0
  private _nextAllowedStart = 0
  private _dispatchTimer: Phaser.Time.TimerEvent | null = null
  private _lastRankUpAt = new Map<string, number>()
  private _lastTaskCompleteAt = new Map<string, number>()
  private _lastErrorAt = new Map<string, number>()
  private _taskComboStreak = 0
  private _taskComboLastPlayAt = 0

  constructor(scene: Phaser.Scene, opts?: CelebrationManagerOptions) {
    this._scene = scene
    this._onCameraJuice = opts?.onCameraJuice
    this._onShake = opts?.onShake
    this._initBurstPool()
    this._initConfettiPool()
    this._initSparklePool()
  }

  setCelebrationsAllowed(allowed: boolean): void {
    this._celebrationsAllowed = allowed
    this._celebrationsEnabled = allowed
    if (!allowed) {
      this._cancelDispatchTimer()
      this._pending = []
      this._taskComboStreak = 0
      this._taskComboLastPlayAt = 0
    }
  }

  setWindOutdoor(_outdoor: boolean): void { /* reserved for wind-aware FX */ }

  private _guardCelebration(opts?: CelebrationOptions): boolean {
    if (!this._celebrationsEnabled) return false
    if (!this._celebrationsAllowed) return false
    return true
  }

  private _cancelDispatchTimer(): void {
    if (this._dispatchTimer) {
      this._dispatchTimer.remove(false)
      this._dispatchTimer = null
    }
  }

  private _enqueueCelebration(
    kind: QueuedCelebrationKind,
    opts: CelebrationOptions | undefined,
    cooldown: { map: Map<string, number>; key: string; ms: number } | null,
    buildRun: (e: PendingCelebration) => void,
  ): void {
    if (!this._celebrationsAllowed) return

    const c = AnimConfig.celebrations
    const nowS = this._scene.time.now
    const tail = this._pending[this._pending.length - 1]
    if (tail && tail.kind === kind && nowS - tail.enqueuedAtScene < c.sameTypeMergeWindowMs) {
      tail.mergeCount += 1
      tail.enqueuedAtScene = nowS
      this._kickDispatch()
      return
    }

    if (cooldown && !opts?.skipCooldown) {
      const last = cooldown.map.get(cooldown.key) ?? 0
      if (nowS - last < cooldown.ms) return
    }

    const entry: PendingCelebration = {
      seq: ++this._pendingSeq,
      kind,
      enqueuedAtScene: nowS,
      mergeCount: 1,
      run: () => {},
    }
    buildRun(entry)
    this._pending.push(entry)
    this._kickDispatch()
  }

  private _kickDispatch(): void {
    if (this._dispatchTimer != null) return
    if (this._pending.length === 0) return
    const now = this._scene.time.now
    const wait = Math.max(0, this._nextAllowedStart - now)
    this._dispatchTimer = this._scene.time.delayedCall(Math.max(1, wait), () => {
      this._dispatchTimer = null
      this._dispatchOne()
    })
  }

  private _dispatchOne(): void {
    if (!this._celebrationsAllowed) {
      this._pending = []
      return
    }
    if (this._pending.length === 0) return
    const now = this._scene.time.now
    if (now < this._nextAllowedStart) {
      this._dispatchTimer = this._scene.time.delayedCall(this._nextAllowedStart - now, () => {
        this._dispatchTimer = null
        this._dispatchOne()
      })
      return
    }

    let bi = 0
    for (let i = 1; i < this._pending.length; i++) {
      const a = this._pending[i], b = this._pending[bi]
      const pa = CELEBRATION_PRIORITY[a.kind], pb = CELEBRATION_PRIORITY[b.kind]
      if (pa > pb || (pa === pb && a.seq < b.seq)) bi = i
    }
    const item = this._pending.splice(bi, 1)[0]
    const gap = AnimConfig.celebrations.queueGapMs
    this._nextAllowedStart = now + gap
    item.run()
    if (this._pending.length > 0) this._kickDispatch()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Full rank-up celebration at a workstation world position.
   * 1. Colored particle burst radiating outward
   * 2. Rising "PROMOTED!" headline text
   * 3. Expanding ring that grows and fades
   * 4. Brief screen flash overlay
   * 5. Secondary rank name text, delayed 400 ms
   */
  rankUp(x: number, y: number, agentName: string, newRank: string, rankColor: number, opts?: CelebrationOptions): void {
    const c = AnimConfig.celebrations
    const key = opts?.agentId ?? agentName
    this._enqueueCelebration(
      'rank-up',
      opts,
      { map: this._lastRankUpAt, key, ms: c.rankUpCooldownMs },
      (e) => {
        e.run = () => {
          this._lastRankUpAt.set(key, this._scene.time.now)
          this._playRankUp(x, y, agentName, newRank, rankColor, e.mergeCount)
        }
      },
    )
  }

  private _playRankUp(
    x: number,
    y: number,
    agentName: string,
    newRank: string,
    rankColor: number,
    mergeCount: number,
  ): void {
    this._onCameraJuice?.('rankUp')
    audioManager.rankUpFanfare()
    // Screen shake for impact — scales with merge count
    this._scene.cameras.main.shake(80 + mergeCount * 8, 0.0025 + 0.0003 * (mergeCount - 1))
    const burstN = Math.min(28, Math.round(10 * (1 + 0.15 * (mergeCount - 1))))
    const radius = Math.round(52 * (1 + 0.08 * (mergeCount - 1)))
    this._particleBurst(x, y, burstN, rankColor, radius)
    // Gold particle burst slightly delayed for layered feel
    this._scene.time.delayedCall(60, () => {
      this._particleBurst(x, y, Math.round(burstN * 0.55), 0xfbbf24, Math.round(radius * 0.72))
    })
    this._risingText(x, y - 18, `PROMOTED!`, {
      fontSize: scaledFontSize(13),
      fontFamily: 'monospace',
      color: '#' + rankColor.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    })
    this._expandingRing(x, y, rankColor)
    this._screenFlash(rankColor)
    this._scene.time.delayedCall(400, () => {
      this._risingText(x, y - 10, newRank, {
        fontSize: scaledFontSize(10),
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })
    this._scene.time.delayedCall(200, () => {
      this._risingText(x, y + 8, agentName, {
        fontSize: scaledFontSize(9),
        fontFamily: 'monospace',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })
  }

  /**
   * Small celebration for a completed task.
   * 1. Green checkmark pop-up with pulse
   * 2. 3-4 tiny sparkle particles
   */
  taskComplete(x: number, y: number, opts?: CelebrationOptions): void {
    const c = AnimConfig.celebrations
    const key = opts?.agentId ?? '_global'
    this._enqueueCelebration(
      'task',
      opts,
      { map: this._lastTaskCompleteAt, key, ms: c.taskCompleteCooldownMs },
      (e) => {
        e.run = () => {
          this._lastTaskCompleteAt.set(key, this._scene.time.now)
          this._playTaskComplete(x, y, e.mergeCount)
        }
      },
    )
  }

  private _playTaskComplete(x: number, y: number, mergeCount: number): void {
    const cel = AnimConfig.celebrations
    const now = this._scene.time.now
    if (now - this._taskComboLastPlayAt > cel.comboWindowMs) this._taskComboStreak = 0
    this._taskComboStreak += 1
    this._taskComboLastPlayAt = now
    const streak = this._taskComboStreak

    this._onCameraJuice?.('taskComplete')
    audioManager.taskComplete()

    const onFire = streak >= cel.comboTierFireMin
    const comboTier = streak >= cel.comboTier3Min
    const biggerBurst = streak >= cel.comboTier2Min
    const sparkleColor = onFire ? 0xff6600 : 0x34d399
    const checkScale = biggerBurst ? 0.46 : 0.4
    const checkPeak = biggerBurst ? 1.42 : 1.3

    if (comboTier) {
      this._screenFlash(0x34d399)
      this._comboFloatingLabel(streak)
    }

    const check = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CHECKMARK)
      .setScale(checkScale).setOrigin(0.5).setAlpha(0).setDepth(600).setTint(sparkleColor)

    this._scene.tweens.add({
      targets: check,
      alpha: 1,
      scaleX: checkPeak,
      scaleY: checkPeak,
      y: y - 24,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: check,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          y: y - 34,
          duration: 260,
          ease: 'Power2',
          delay: 300,
          onComplete: () => check.destroy(),
        })
      },
    })

    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
      const puff = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.EFFECTS_PUFF)
        .setDepth(600)
        .setScale(0.16)
        .setAlpha(0.6)
        .setBlendMode(Phaser.BlendModes.ADD)
      puff.play(EFFECT_ANIM_KEYS.PUFF)
      puff.once('animationcomplete', () => puff.destroy())
    }

    let count = 3 + Math.floor(Math.random() * 2)
    if (biggerBurst) count += 2
    if (onFire) count += 4
    count += Math.min(4, mergeCount - 1)
    for (let i = 0; i < count; i++) {
      const p = this._sparklePool.find(c => !c.getData('busy'))
      if (!p) continue
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const dist = (10 + Math.random() * 12) * (biggerBurst ? 1.2 : 1)
      const sy = y - 14
      p.setPosition(x, sy)
      p.setFillStyle(sparkleColor)
      p.setRadius((1.2 + Math.random()) * (biggerBurst ? 1.15 : 1))
      p.setAlpha(0.9).setVisible(true).setData('busy', true)
      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: sy + Math.sin(angle) * dist,
        alpha: 0,
        duration: 380 + Math.random() * 120,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
    }
  }

  /**
   * Task start VFX — expanding white ring (0→40px, 400ms) + 3–4 sparkle particles.
   * Fires immediately (not queued) when an agent transitions idle→working.
   */
  taskStart(x: number, y: number): void {
    if (!this._celebrationsAllowed) return
    this._playTaskStart(x, y)
  }

  private _playTaskStart(x: number, y: number): void {
    audioManager.taskStart()
    // Expanding white ring: radius 0→40px, alpha 1→0, 400ms
    const gfx = this._scene.add.graphics().setDepth(599)
    this._scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0
        const r = t * 40
        const a = (1 - t) * 0.75
        gfx.clear()
        gfx.lineStyle(2.5 * (1 - t * 0.5), 0xffffff, a)
        gfx.strokeCircle(x, y, r)
      },
      onComplete: () => gfx.destroy(),
    })

    // 3–4 sparkle particles fly outward
    const count = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const p = this._sparklePool.find(c => !c.getData('busy'))
      if (!p) continue
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
      const dist = 8 + Math.random() * 10
      const sy = y - 8
      p.setPosition(x, sy)
      p.setFillStyle(0xffffff)
      p.setRadius(0.9 + Math.random() * 0.8)
      p.setAlpha(0.9).setVisible(true).setData('busy', true)
      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: sy + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300 + Math.random() * 100,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
    }
  }

  /**
   * Task fail VFX — red pulse ring + brief screen-edge red flash (100ms).
   * Enqueued at 'error' priority alongside the existing error() celebration.
   */
  taskFail(x: number, y: number, opts?: CelebrationOptions): void {
    this._enqueueCelebration('error', opts, null, (e) => {
      e.run = () => this._playTaskFail(x, y)
    })
  }

  private _playTaskFail(x: number, y: number): void {
    audioManager.taskFail()
    this._expandingRing(x, y, 0xef4444)
    this._screenEdgeFlash(0xef4444, 100)
  }

  /** Screen-edge flash — fills only the border of the viewport with the given color. */
  private _screenEdgeFlash(color: number, durationMs: number): void {
    const cam = this._scene.cameras.main
    const flash = this._scene.add.graphics().setScrollFactor(0).setDepth(9999)
    const bw = 18
    flash.fillStyle(color, 0.45)
    flash.fillRect(0, 0, cam.width, bw)
    flash.fillRect(0, cam.height - bw, cam.width, bw)
    flash.fillRect(0, bw, bw, cam.height - bw * 2)
    flash.fillRect(cam.width - bw, bw, bw, cam.height - bw * 2)
    this._scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: durationMs,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    })
  }

  private _comboFloatingLabel(streak: number): void {
    const cam = this._scene.cameras.main
    const cx = cam.width / 2
    const cy = cam.height * 0.38
    const t = this._scene.add.text(cx, cy, `COMBO x${streak}`, {
      fontSize: scaledFontSize(18),
      fontFamily: 'monospace',
      color: '#34d399',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001).setAlpha(0)
    this._scene.tweens.add({
      targets: t,
      alpha: 1,
      y: cy - 12,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: t,
          alpha: 0,
          y: cy - 28,
          duration: 500,
          ease: 'Power2',
          delay: 500,
          onComplete: () => t.destroy(),
        })
      },
    })
  }

  /**
   * Milestone celebration (100 tasks, streaks, etc.).
   * 1. Gold particle burst (larger than rankUp) + Explosion VFX
   * 2. Banner text that slides in from the right
   * 3. Confetti — small colored rectangles that fall with gravity
   */
  milestone(x: number, y: number, text: string): void {
    this._enqueueCelebration('milestone', undefined, null, (e) => {
      e.run = () => this._playMilestone(x, y, text, e.mergeCount)
    })
  }

  private _playMilestone(x: number, y: number, text: string, mergeCount: number): void {
    this._onShake?.()
    this._scene.cameras.main.shake(100, 0.003 + 0.0004 * (mergeCount - 1))
    audioManager.rankUpFanfare()
    const n1 = Math.min(28, 16 + (mergeCount - 1) * 2)
    const n2 = Math.min(16, 8 + (mergeCount - 1))
    this._particleBurst(x, y, n1, 0xfbbf24, 72)
    this._scene.time.delayedCall(80, () => this._particleBurst(x, y, n2, 0xf59e0b, 36))
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.EXPLOSION)) {
      const explosion = this._scene.add.sprite(x, y, SPRITESHEET_KEYS.EFFECTS_EXPLOSION)
        .setDepth(601)
        .setScale(0.32)
        .setAlpha(0.7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfbbf24)
      explosion.play(EFFECT_ANIM_KEYS.EXPLOSION)
      explosion.once('animationcomplete', () => explosion.destroy())
    }
    const cam = this._scene.cameras.main
    const screenX = cam.width - 20
    const screenY = 60
    const banner = this._scene.add.text(screenX + 200, screenY, text, {
      fontSize: scaledFontSize(14),
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 },
      resolution: 2,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(9998).setAlpha(0)
    this._scene.tweens.add({
      targets: banner,
      x: screenX,
      alpha: 1,
      duration: 340,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: banner,
          alpha: 0,
          x: screenX + 60,
          duration: 300,
          ease: 'Power2',
          delay: 2000,
          onComplete: () => banner.destroy(),
        })
      },
    })
    // 3-second confetti rain: three waves from the top of the viewport
    const waveSize = Math.min(14, 10 + Math.floor((mergeCount - 1) * 1.5))
    this._screenConfetti(waveSize)
    this._scene.time.delayedCall(1000, () => { this._screenConfetti(waveSize) })
    this._scene.time.delayedCall(2000, () => { this._screenConfetti(Math.ceil(waveSize * 0.7)) })
  }

  /**
   * Error/failure effect — black smoke puff + red cross icon.
   * Use for failed quests, agent errors, blocked state.
   */
  error(x: number, y: number, opts?: CelebrationOptions): void {
    const c = AnimConfig.celebrations
    const key = opts?.agentId ?? '_global'
    this._enqueueCelebration(
      'error',
      opts,
      { map: this._lastErrorAt, key, ms: c.errorCooldownMs },
      (e) => {
        e.run = () => {
          this._lastErrorAt.set(key, this._scene.time.now)
          this._playError(x, y, e.mergeCount)
        }
      },
    )
  }

  private _playError(x: number, y: number, mergeCount: number): void {
    this._onCameraJuice?.('errorZoomOut')
    this._onShake?.()
    const shakeDur = Math.min(120, 60 + (mergeCount - 1) * 12)
    this._scene.cameras.main.shake(shakeDur, 0.002 + (mergeCount - 1) * 0.0003)
    soundEngine.error()
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.SMOKE)) {
      const smoke = this._scene.add.sprite(x, y - 10, SPRITESHEET_KEYS.EFFECTS_SMOKE)
        .setDepth(600)
        .setScale(0.20)
        .setAlpha(0.7)
      smoke.play(EFFECT_ANIM_KEYS.SMOKE)
      smoke.once('animationcomplete', () => smoke.destroy())
    }
    const cross = this._scene.add.sprite(x, y - 14, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CROSS_RED)
      .setScale(0.32).setOrigin(0.5).setAlpha(0).setDepth(601)
    this._scene.tweens.add({
      targets: cross,
      alpha: 1,
      scaleX: 0.44,
      scaleY: 0.44,
      y: y - 28,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: cross,
          alpha: 0,
          y: y - 40,
          duration: 400,
          ease: 'Power2',
          delay: 500,
          onComplete: () => cross.destroy(),
        })
      },
    })
  }

  /**
   * Achievement unlock visual — badge sprite + rising title text.
   * Called via ACHIEVEMENT_UNLOCKED event from the AchievementManager.
   */
  achievementUnlocked(x: number, y: number, title: string, iconFrame: number, opts?: CelebrationOptions): void {
    if (!this._guardCelebration(opts)) return
    // Badge sprite popup
    const badge = this._scene.add.sprite(x, y - 20, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
      .setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

    this._scene.tweens.add({
      targets: badge,
      alpha: 1,
      scaleX: 0.65,
      scaleY: 0.65,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: badge,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          y: y - 50,
          duration: 500,
          ease: 'Power2',
          delay: 1200,
          onComplete: () => badge.destroy(),
        })
      },
    })

    // Rising title text
    this._scene.time.delayedCall(150, () => {
      this._risingText(x, y - 8, title, {
        fontSize: scaledFontSize(10),
        fontFamily: 'monospace',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 2,
      })
    })

    // Small sparkle burst
    this._particleBurst(x, y - 20, 6, 0xfbbf24, 28)
  }

  /**
   * Season end — legacy shorthand (gold flash + banner). Prefer `seasonEndCeremony`.
   */
  seasonEnd(seasonName: string, score: number): void {
    this.seasonEndCeremony(
      {
        seasonId: 'legacy',
        seasonName,
        theme: 'neon',
        accentColor: 0xfbbf24,
        score,
        questsCompletedThisSeason: 0,
        totalSeasonXP: score,
        summaryLine: `${seasonName} Season Complete — 0 quests, ${score} XP`,
        rankings: [],
        mvpAgentId: null,
        mvpWorldX: 0,
        mvpWorldY: 0,
        creditBonusShown: 0,
      },
      { bypassDedupe: true },
    )
  }

  /**
   * Season start — legacy shorthand. Prefer `seasonStartIntro`.
   */
  seasonStart(seasonName: string): void {
    this.seasonStartIntro({
      seasonName,
      theme: 'focus',
      accentColor: 0xa855f7,
      themeIconFrame: themeIconFrameForTheme('focus'),
      challenges: [],
    })
  }

  /**
   * Full season-end sequence: dim overlay, leaderboard from right, MVP spotlight,
   * summary line, credit badge pulse, brief fade to black (~5–7s).
   */
  seasonEndCeremony(payload: SeasonEndCeremonyPayload, opts?: SeasonCeremonyOpts): void {
    const finish = () => { opts?.onComplete?.() }

    if (!this._celebrationsAllowed) {
      finish()
      return
    }

    const dedupeKey = `${payload.seasonId}|${payload.summaryLine}`
    const now = Date.now()
    if (!opts?.bypassDedupe && dedupeKey === this._lastSeasonEndKey && now - this._lastSeasonEndAt < 4000) {
      finish()
      return
    }
    this._lastSeasonEndKey = dedupeKey
    this._lastSeasonEndAt = now

    soundEngine.achievement()
    const cam = this._scene.cameras.main
    const w = cam.width
    const h = cam.height
    const toDestroy: Phaser.GameObjects.GameObject[] = []

    const dim = this._scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.15)
      .setScrollFactor(0).setDepth(9990).setOrigin(0.5)
    toDestroy.push(dim)

    const panelW = 188
    const panelX0 = w + 24
    const panelX1 = w - panelW - 14
    const panelTop = 56
    const rowH = 28
    const rows = payload.rankings
    const panelH = 36 + Math.max(rows.length, 1) * rowH + 8

    const panel = this._scene.add.container(panelX0, panelTop)
      .setScrollFactor(0).setDepth(9992)
    toDestroy.push(panel)

    const bg = this._scene.add.graphics()
    bg.fillStyle(activeTheme.panelBg, 0.94)
    bg.fillRoundedRect(0, 0, panelW, panelH, 8)
    bg.lineStyle(1, payload.accentColor, 0.65)
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8)
    panel.add(bg)

    const hdr = this._scene.add.text(panelW / 2, 10, 'Final standings', {
      fontSize: scaledFontSize(10), fontFamily: 'monospace', color: '#e2e8f0', resolution: 2,
    }).setOrigin(0.5, 0)
    panel.add(hdr)

    if (rows.length === 0) {
      const empty = this._scene.add.text(10, 32, 'No agents ranked yet', {
        fontSize: scaledFontSize(8), fontFamily: 'monospace', color: '#64748b', resolution: 2,
      })
      panel.add(empty)
    } else {
      rows.forEach((entry, i) => {
        const rowY = 30 + i * rowH
        const rank = entry.rank
        let medal: Phaser.GameObjects.Sprite | null = null
        if (rank >= 1 && rank <= 3) {
          const hasHd = this._scene.textures.exists(SPRITESHEET_KEYS.MEDALS_HD)
          const hdFrame = rank === 1 ? MEDAL_HD_FRAMES.GOLD_STAR
            : rank === 2 ? MEDAL_HD_FRAMES.SILVER_FLORAL : MEDAL_HD_FRAMES.BRONZE_FLORAL
          const loFrame = rank === 1 ? ICON_FRAMES.MEDAL_GOLD
            : rank === 2 ? ICON_FRAMES.MEDAL_SILVER : ICON_FRAMES.MEDAL_BRONZE
          medal = hasHd
            ? this._scene.add.sprite(14, rowY + 10, SPRITESHEET_KEYS.MEDALS_HD, hdFrame).setScale(0.14)
            : this._scene.add.sprite(14, rowY + 10, SPRITESHEET_KEYS.GAME_ICONS, loFrame).setScale(0.26)
          panel.add(medal)
        }
        const nameCol = rank <= 3 ? '#fbbf24' : '#94a3b8'
        const line = this._scene.add.text(medal ? 28 : 8, rowY, `${rank}. ${entry.agentName}`, {
          fontSize: scaledFontSize(8), fontFamily: 'monospace', color: nameCol, resolution: 2,
        })
        const sub = this._scene.add.text(medal ? 28 : 8, rowY + 11, `${entry.seasonXP} XP · ${entry.tasksCompleted} tasks`, {
          fontSize: scaledFontSize(7), fontFamily: 'monospace', color: '#64748b', resolution: 2,
        })
        panel.add(line)
        panel.add(sub)
      })
    }

    this._scene.tweens.add({
      targets: panel,
      x: panelX1,
      duration: 480,
      ease: 'Cubic.easeOut',
      delay: 120,
    })

    const cam2 = this._scene.cameras.main
    const mvpSx = payload.mvpAgentId
      ? payload.mvpWorldX - cam2.scrollX
      : w / 2
    const mvpSy = payload.mvpAgentId
      ? payload.mvpWorldY - cam2.scrollY
      : h * 0.55

    this._scene.time.delayedCall(400, () => {
      this._mvpSpotlightScreen(mvpSx, mvpSy, h, payload.accentColor, toDestroy)
      const wx = cam2.scrollX + mvpSx
      const wy = cam2.scrollY + mvpSy
      this._particleBurst(wx, wy, 14, 0xfbbf24, 56)
    })

    const summary = this._scene.add.text(w / 2, h * 0.62, payload.summaryLine, {
      fontSize: scaledFontSize(11),
      fontFamily: 'monospace',
      color: '#f8fafc',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9993).setAlpha(0)
    toDestroy.push(summary)
    this._scene.time.delayedCall(520, () => {
      this._scene.tweens.add({ targets: summary, alpha: 1, duration: 420, ease: 'Power2' })
    })

    const creditLabel = `+${payload.creditBonusShown} season credits`
    const creditBadge = this._scene.add.text(w / 2, h * 0.72, creditLabel, {
      fontSize: scaledFontSize(10),
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#422006cc',
      padding: { x: 10, y: 5 },
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9993).setAlpha(0).setScale(0.92)
    toDestroy.push(creditBadge)
    this._scene.time.delayedCall(900, () => {
      this._scene.tweens.add({
        targets: creditBadge,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 220,
        ease: 'Back.easeOut',
        onComplete: () => {
          this._scene.tweens.add({
            targets: creditBadge,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 280,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
          })
        },
      })
    })

    const blackout = this._scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 1)
      .setScrollFactor(0).setDepth(10020).setOrigin(0.5).setAlpha(0)
    toDestroy.push(blackout)

    this._scene.time.delayedCall(5600, () => {
      this._scene.tweens.add({
        targets: blackout,
        alpha: 1,
        duration: 120,
        ease: 'Power1',
        onComplete: () => {
          for (const o of toDestroy) {
            try { o.destroy() } catch { /* gone */ }
          }
          this._scene.tweens.add({
            targets: blackout,
            alpha: 0,
            duration: 180,
            ease: 'Power1',
            onComplete: () => {
              blackout.destroy()
              finish()
            },
          })
        },
      })
    })
  }

  /** New season intro: title + icon, challenges from left, themed confetti. */
  seasonStartIntro(payload: SeasonIntroPayload, opts?: SeasonCeremonyOpts): void {
    const done = () => { opts?.onComplete?.() }
    if (!this._celebrationsAllowed) {
      done()
      return
    }

    const cam = this._scene.cameras.main
    const w = cam.width
    const h = cam.height
    const cx = w / 2
    const toDestroy: Phaser.GameObjects.GameObject[] = []

    this._screenConfettiThemed(payload.accentColor, 28)

    const accentHex = '#' + payload.accentColor.toString(16).padStart(6, '0')
    const glowLayers: Phaser.GameObjects.Text[] = []
    for (let i = 0; i < 3; i++) {
      const t = this._scene.add.text(cx + (i - 1) * 2, h * 0.28 + (i - 1), payload.seasonName, {
        fontSize: scaledFontSize(20),
        fontFamily: 'monospace',
        color: accentHex,
        stroke: '#000000',
        strokeThickness: 5,
        resolution: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(9991).setAlpha(0)
      glowLayers.push(t)
      toDestroy.push(t)
    }
    const title = this._scene.add.text(cx, h * 0.28, payload.seasonName, {
      fontSize: scaledFontSize(20),
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: accentHex,
      strokeThickness: 4,
      resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9992).setAlpha(0)
    toDestroy.push(title)

    const icon = this._scene.add.sprite(cx, h * 0.28 + 36, SPRITESHEET_KEYS.GAME_ICONS, payload.themeIconFrame)
      .setScrollFactor(0).setDepth(9992).setScale(0.55).setAlpha(0)
    toDestroy.push(icon)

    glowLayers.forEach((t, i) => {
      this._scene.tweens.add({
        targets: t,
        alpha: 0.28 + i * 0.08,
        duration: 480,
        ease: 'Power2',
        delay: 40,
      })
    })
    this._scene.tweens.add({ targets: title, alpha: 1, duration: 480, ease: 'Power2', delay: 40 })
    this._scene.tweens.add({ targets: icon, alpha: 1, duration: 480, ease: 'Power2', delay: 40 })

    const listLeft = -240
    const listX = 24
    const list = this._scene.add.container(listLeft, h * 0.42)
      .setScrollFactor(0).setDepth(9991)
    toDestroy.push(list)

    const listBg = this._scene.add.graphics()
    const challenges = payload.challenges
    const lh = 18
    const listH = 22 + challenges.length * lh + 10
    listBg.fillStyle(activeTheme.panelBg, 0.9)
    listBg.fillRoundedRect(0, 0, 220, listH, 6)
    listBg.lineStyle(1, payload.accentColor, 0.5)
    listBg.strokeRoundedRect(0, 0, 220, listH, 6)
    list.add(listBg)

    const listTitle = this._scene.add.text(110, 8, 'Challenges', {
      fontSize: scaledFontSize(9), fontFamily: 'monospace', color: '#e2e8f0', resolution: 2,
    }).setOrigin(0.5, 0)
    list.add(listTitle)

    challenges.forEach((ch, i) => {
      const mark = ch.completed ? '\u2713' : '\u25CB'
      const row = this._scene.add.text(10, 24 + i * lh, `${mark} ${ch.description}`, {
        fontSize: scaledFontSize(8),
        fontFamily: 'monospace',
        color: ch.completed ? '#34d399' : '#94a3b8',
        resolution: 2,
        wordWrap: { width: 200 },
      })
      list.add(row)
    })

    this._scene.tweens.add({
      targets: list,
      x: listX,
      duration: 520,
      ease: 'Cubic.easeOut',
      delay: 200,
    })

    const worldX = cam.scrollX + cx
    const worldY = cam.scrollY + h * 0.5
    this._scene.time.delayedCall(300, () => {
      this._particleBurst(worldX, worldY, 10, payload.accentColor, 44)
    })

    const fadeOut = [title, icon, list, ...glowLayers]
    this._scene.time.delayedCall(3800, () => {
      this._scene.tweens.add({
        targets: fadeOut,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          for (const o of toDestroy) {
            try { o.destroy() } catch { /* */ }
          }
          done()
        },
      })
    })
  }

  /**
   * Challenge completed mini-celebration.
   * 1. Checkmark sprite popup at screen center
   * 2. Rising text with challenge description
   * 3. Small green particle burst
   */
  challengeCompleted(description: string, opts?: CelebrationOptions): void {
    if (!this._guardCelebration(opts)) return
    const cam = this._scene.cameras.main
    const cx = cam.width / 2
    const cy = cam.height * 0.45

    // 1. Checkmark icon popup
    const check = this._scene.add.sprite(cx, cy, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CHECKMARK)
      .setScrollFactor(0)
      .setScale(0)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10000)
      .setTint(0x34d399)

    this._scene.tweens.add({
      targets: check,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: check,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          y: cy - 30,
          duration: 400,
          ease: 'Power2',
          delay: 800,
          onComplete: () => check.destroy(),
        })
      },
    })

    // 2. Rising text with challenge description
    this._scene.time.delayedCall(100, () => {
      const label = this._scene.add.text(cx, cy + 22, description, {
        fontSize: scaledFontSize(11),
        fontFamily: 'monospace',
        color: '#34d399',
        stroke: '#000000',
        strokeThickness: 2,
        backgroundColor: '#00000077',
        padding: { x: 8, y: 3 },
        resolution: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(0)

      this._scene.tweens.add({
        targets: label,
        alpha: 1,
        y: cy + 16,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this._scene.tweens.add({
            targets: label,
            alpha: 0,
            y: cy + 6,
            duration: 350,
            ease: 'Power1',
            delay: 1200,
            onComplete: () => label.destroy(),
          })
        },
      })
    })

    // 3. Small green particle burst (world coords)
    const worldX = cam.scrollX + cx
    const worldY = cam.scrollY + cy
    this._particleBurst(worldX, worldY, 6, 0x34d399, 30)
  }

  /**
   * Purchase celebration — coin bounce + small confetti + rising item name.
   * Triggered when a cosmetic item is bought from the shop.
   */
  purchase(x: number, y: number, itemName: string, opts?: CelebrationOptions): void {
    if (!this._guardCelebration(opts)) return
    // 1. Coin sprite bouncing upward (use STAR_YELLOW as coin stand-in)
    const hasIcons = this._scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)
    if (hasIcons) {
      const coin = this._scene.add.sprite(x, y, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_YELLOW)
        .setScale(0.5).setOrigin(0.5).setAlpha(0).setDepth(602)

      this._scene.tweens.add({
        targets: coin,
        alpha: 1,
        scaleX: 0.7,
        scaleY: 0.7,
        y: y - 30,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Settle then fade
          this._scene.tweens.add({
            targets: coin,
            y: y - 22,
            duration: 140,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              this._scene.tweens.add({
                targets: coin,
                alpha: 0,
                y: y - 50,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 300,
                ease: 'Power2',
                delay: 200,
                onComplete: () => coin.destroy(),
              })
            },
          })
        },
      })
    }

    // 2. Small confetti burst (5 pieces)
    this._confetti(x, y - 14, 5)

    // 3. Rising text showing the item name
    this._risingText(x, y - 8, itemName, {
      fontSize: scaledFontSize(9),
      fontFamily: 'monospace',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    })
  }

  /**
   * Single queued slot for quest star/ring plus optional XP/credit rewards (sidekick#72).
   * Prefer this over calling `questComplete` + `questReward` separately.
   */
  questCelebration(
    x: number,
    y: number,
    difficulty: QuestDifficulty,
    xpAmount: number,
    creditAmount: number,
    opts?: CelebrationOptions,
  ): void {
    this._enqueueCelebration('quest', opts, null, (e) => {
      e.run = () => this._playQuestCelebration(x, y, difficulty, xpAmount, creditAmount, e.mergeCount)
    })
  }

  /** Thin wrapper — use `questCelebration` from new call sites (one queue slot). */
  questComplete(x: number, y: number, difficulty: QuestDifficulty, opts?: CelebrationOptions): void {
    this.questCelebration(x, y, difficulty, 0, 0, opts)
  }

  /** Thin wrapper — use `questCelebration` from new call sites (one queue slot). */
  questReward(
    x: number,
    y: number,
    difficulty: QuestDifficulty,
    xpAmount: number,
    creditAmount: number,
    opts?: CelebrationOptions,
  ): void {
    this.questCelebration(x, y, difficulty, xpAmount, creditAmount, opts)
  }

  private _playQuestCelebration(
    x: number,
    y: number,
    difficulty: QuestDifficulty,
    xpAmount: number,
    creditAmount: number,
    mergeCount: number,
  ): void {
    const diffColor = DIFFICULTY_COLORS[difficulty] ?? 0x3b82f6
    const diffHex = '#' + diffColor.toString(16).padStart(6, '0')
    const ringBoost = 1 + 0.06 * (mergeCount - 1)
    const starFrame = DIFFICULTY_STAR_FRAME[difficulty] ?? ICON_FRAMES.STAR_GREY
    const star = this._scene.add.sprite(x, y - 16, SPRITESHEET_KEYS.GAME_ICONS, starFrame)
      .setScale(0).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: star,
      alpha: 1,
      scaleX: 0.7 * ringBoost,
      scaleY: 0.7 * ringBoost,
      y: y - 28,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: star,
          alpha: 0,
          scaleX: 0.4,
          scaleY: 0.4,
          y: y - 44,
          duration: 400,
          ease: 'Power2',
          delay: 400,
          onComplete: () => star.destroy(),
        })
      },
    })

    this._expandingRing(x, y - 16, diffColor)
    const burst1 = Math.min(14, 6 + (mergeCount - 1) * 2)
    this._particleBurst(x, y - 16, burst1, diffColor, Math.round(28 * ringBoost))

    const showReward = xpAmount > 0 || creditAmount > 0
    if (showReward) {
      const coin = this._scene.add.sprite(
        x, y - 16,
        SPRITESHEET_KEYS.LEGO_SPECIALS,
        LEGO_SPECIAL_FRAMES.COIN,
      ).setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

      this._scene.tweens.add({
        targets: coin,
        alpha: 1,
        scaleX: 0.78,
        scaleY: 0.78,
        y: y - 28,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          this._scene.tweens.add({
            targets: coin,
            scaleX: 0.6,
            scaleY: 0.6,
            duration: 120,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this._scene.tweens.add({
                targets: coin,
                alpha: 0,
                y: y - 56,
                duration: 600,
                ease: 'Power2',
                delay: 400,
                onComplete: () => coin.destroy(),
              })
            },
          })
        },
      })

      if (difficulty === 'epic' || difficulty === 'legendary') {
        const crate = this._scene.add.sprite(
          x + 14, y - 12,
          SPRITESHEET_KEYS.LEGO_SPECIALS,
          LEGO_SPECIAL_FRAMES.EXPLOSIVE,
        ).setScale(0).setOrigin(0.5).setAlpha(0).setDepth(602)

        this._scene.tweens.add({
          targets: crate,
          alpha: 0.9,
          scaleX: 0.65,
          scaleY: 0.65,
          y: y - 24,
          duration: 300,
          ease: 'Back.easeOut',
          delay: 100,
          onComplete: () => {
            this._scene.tweens.add({
              targets: crate,
              alpha: 0,
              y: y - 50,
              scaleX: 0.3,
              scaleY: 0.3,
              duration: 500,
              ease: 'Power2',
              delay: 500,
              onComplete: () => crate.destroy(),
            })
          },
        })
      }

      this._scene.time.delayedCall(120, () => {
        this._risingText(x, y - 6, `+${xpAmount} XP`, {
          fontSize: scaledFontSize(10),
          fontFamily: 'monospace',
          color: diffHex,
          stroke: '#000000',
          strokeThickness: 2,
          resolution: 2,
        })
      })
      this._scene.time.delayedCall(250, () => {
        this._risingText(x, y + 4, `+${creditAmount}c`, {
          fontSize: scaledFontSize(9),
          fontFamily: 'monospace',
          color: '#fbbf24',
          stroke: '#000000',
          strokeThickness: 2,
          resolution: 2,
        })
      })
      this._particleBurst(x, y - 16, Math.min(12, 6 + mergeCount - 1), diffColor, 32)
    }
  }

  /**
   * Fly a difficulty star from a world position to the quest panel (screen-space).
   */
  starFlyToPanel(
    worldX: number, worldY: number,
    difficulty: QuestDifficulty,
    panelScreenX: number, panelScreenY: number,
  ): void {
    const cam = this._scene.cameras.main
    const sx = (worldX - cam.scrollX) * cam.zoom
    const sy = (worldY - cam.scrollY) * cam.zoom

    const starFrame = DIFFICULTY_STAR_FRAME[difficulty] ?? ICON_FRAMES.STAR_GREY
    const star = this._scene.add.sprite(sx, sy - 16, SPRITESHEET_KEYS.GAME_ICONS, starFrame)
      .setScrollFactor(0)
      .setDepth(10000)
      .setAlpha(0.9)
      .setScale(0.38)

    this._scene.tweens.add({
      targets: star,
      x: panelScreenX,
      y: panelScreenY,
      scaleX: 0.18,
      scaleY: 0.18,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => star.destroy(),
    })
  }

  /**
   * Signature move name flash — a brief italic rising text in the agent's character color,
   * shown when an agent completes a task with bestiary data attached.
   */
  signatureFlash(x: number, y: number, moveName: string, color: number): void {
    if (!this._celebrationsAllowed) return
    const hexColor = '#' + color.toString(16).padStart(6, '0')
    this._risingText(x, y - 8, moveName, {
      fontSize: scaledFontSize(8),
      fontFamily: 'system-ui, monospace',
      color: hexColor,
      stroke: '#000000',
      strokeThickness: 1,
      fontStyle: 'italic',
      resolution: 2,
    })
  }

  /**
   * Brief gold sparkle burst on a workstation when the user approves a tool call.
   * 8-12 particles radiate outward with upward drift, shrink and fade over 500ms.
   */
  approveSparkle(x: number, y: number, opts?: CelebrationOptions): void {
    if (!this._guardCelebration(opts)) return
    soundEngine.ding()
    const count = 8 + Math.floor(Math.random() * 5) // 8-12
    for (let i = 0; i < count; i++) {
      const p = this._sparklePool.find(c => !c.getData('busy'))
      if (!p) continue
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dist = 12 + Math.random() * 16
      p.setPosition(x, y - 14)
      p.setFillStyle(0xfbbf24) // gold/yellow
      p.setRadius(1.2 + Math.random() * 1.2)
      p.setAlpha(0.9).setScale(1).setVisible(true).setData('busy', true)
      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: (y - 14) + Math.sin(angle) * dist - 8, // slight upward drift
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 360 + Math.random() * 140,
        ease: 'Power2',
        onComplete: () => {
          p.setVisible(false)
          p.setAlpha(0)
          p.setScale(1)
          p.setData('busy', false)
        },
      })
    }
  }

  /**
   * Simple XP gain floating number with a Grade A sprite accent.
   * Shows a small GRADE_A sprite at the origin and a rising "+{amount}" text.
   * Subtle upward drift over 1.2 seconds, fading out.
   */
  xpGain(x: number, y: number, amount: number, color: number = 0x34d399, opts?: CelebrationOptions): void {
    if (!this._guardCelebration(opts)) return
    const hexColor = '#' + color.toString(16).padStart(6, '0')

    // Grade A sprite — small accent at the origin
    const badge = this._scene.add.sprite(
      x - 12, y - 14,
      SPRITESHEET_KEYS.LEGO_SPECIALS,
      LEGO_SPECIAL_FRAMES.GRADE_A,
    ).setScale(0.3).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: badge,
      alpha: 0.8,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: badge,
          alpha: 0,
          y: y - 40,
          duration: 1000,
          ease: 'Power1',
          delay: 200,
          onComplete: () => badge.destroy(),
        })
      },
    })

    // Rising "+amount" text
    const txt = this._scene.add.text(x, y - 14, `+${amount}`, {
      fontSize: scaledFontSize(10),
      fontFamily: 'monospace',
      color: hexColor,
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2,
    }).setOrigin(0.5).setAlpha(0).setDepth(601)

    this._scene.tweens.add({
      targets: txt,
      alpha: 1,
      y: y - 22,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this._scene.tweens.add({
          targets: txt,
          alpha: 0,
          y: y - 48,
          duration: 1000,
          ease: 'Power1',
          delay: 200,
          onComplete: () => txt.destroy(),
        })
      },
    })
  }

  /**
   * Release all pooled objects. Call when the scene shuts down.
   */
  destroy(): void {
    this._dedupeKeys.clear()
    this._cancelDispatchTimer()
    this._pending = []
    this._lastRankUpAt.clear()
    this._lastTaskCompleteAt.clear()
    this._lastErrorAt.clear()
    this._taskComboStreak = 0
    this._taskComboLastPlayAt = 0
    for (const p of this._burstPool) { this._scene.tweens.killTweensOf(p); p.destroy() }
    this._burstPool = []
    for (const g of this._confettiPool) { this._scene.tweens.killTweensOf(g); g.destroy() }
    this._confettiPool = []
    for (const s of this._sparklePool) { this._scene.tweens.killTweensOf(s); s.destroy() }
    this._sparklePool = []
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Confetti shower biased toward a season accent color. */
  private _screenConfettiThemed(accent: number, count: number): void {
    const palette = [accent, ...CONFETTI_COLORS]
    const cam = this._scene.cameras.main
    const topY = cam.scrollY - 10
    const leftX = cam.scrollX
    const width = cam.width

    let spawned = 0
    for (const g of this._confettiPool) {
      if (spawned >= count) break
      if (g.getData('busy')) continue
      const color = palette[Math.floor(Math.random() * palette.length)]
      const w = 3 + Math.random() * 5
      const h = 2 + Math.random() * 3
      g.clear()
      g.fillStyle(color, 1)
      g.fillRect(-w / 2, -h / 2, w, h)
      const startX = leftX + Math.random() * width
      g.setPosition(startX, topY - Math.random() * 40)
      g.setAngle(Math.random() * 360)
      g.setAlpha(1).setVisible(true).setData('busy', true)

      const driftX = (Math.random() - 0.5) * 120
      const fallY = cam.height + 40 + Math.random() * 80
      const spinEnd = g.angle + (Math.random() - 0.5) * 720
      const dur = 1400 + Math.random() * 800

      this._scene.tweens.add({
        targets: g,
        x: g.x + driftX,
        y: g.y + fallY,
        angle: spinEnd,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => { g.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /** Soft vertical spotlight in screen space, anchored toward the MVP desk. */
  private _mvpSpotlightScreen(
    screenX: number,
    screenY: number,
    viewH: number,
    accent: number,
    sink: Phaser.GameObjects.GameObject[],
  ): void {
    const beam = this._scene.add.graphics().setScrollFactor(0).setDepth(9991)
    const bottom = Math.min(viewH - 6, Math.max(48, screenY + 28))
    const half = 24
    beam.fillStyle(accent, 0.09)
    beam.fillTriangle(screenX - half, 0, screenX + half, 0, screenX, bottom)
    beam.fillStyle(0xfffbeb, 0.12)
    beam.fillRect(screenX - 2, 0, 4, bottom)
    sink.push(beam)
  }

  /**
   * Spawn N confetti pieces from the top of the screen, falling down.
   * Screen-space (scrollFactor 0 graphics are world-positioned but this
   * uses the existing pool which is world-space — we convert).
   */
  private _screenConfetti(count: number): void {
    const cam = this._scene.cameras.main
    // Spawn confetti across the top of the viewport, in world coords
    const topY = cam.scrollY - 10
    const leftX = cam.scrollX
    const width = cam.width

    let spawned = 0
    for (const g of this._confettiPool) {
      if (spawned >= count) break
      if (g.getData('busy')) continue
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      const w = 3 + Math.random() * 5
      const h = 2 + Math.random() * 3
      g.clear()
      g.fillStyle(color, 1)
      g.fillRect(-w / 2, -h / 2, w, h)
      const startX = leftX + Math.random() * width
      g.setPosition(startX, topY - Math.random() * 40)
      g.setAngle(Math.random() * 360)
      g.setAlpha(1).setVisible(true).setData('busy', true)

      const driftX = (Math.random() - 0.5) * 120
      const fallY = cam.height + 40 + Math.random() * 80
      const spinEnd = g.angle + (Math.random() - 0.5) * 720
      const dur = 1400 + Math.random() * 800

      this._scene.tweens.add({
        targets: g,
        x: g.x + driftX,
        y: g.y + fallY,
        angle: spinEnd,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => { g.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /** Spawn N confetti rectangles from (x, y) that fall with gravity + random drift. */
  private _confetti(x: number, y: number, count: number): void {
    let spawned = 0
    for (const g of this._confettiPool) {
      if (spawned >= count) break
      if (g.getData('busy')) continue
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      const w = 3 + Math.random() * 4
      const h = 2 + Math.random() * 3
      g.clear()
      g.fillStyle(color, 1)
      g.fillRect(-w / 2, -h / 2, w, h)
      g.setPosition(x + (Math.random() - 0.5) * 30, y - 10)
      g.setAngle(Math.random() * 360)
      g.setAlpha(1).setVisible(true).setData('busy', true)

      const driftX = (Math.random() - 0.5) * 80
      const fallY = 90 + Math.random() * 60
      const spinEnd = g.angle + (Math.random() - 0.5) * 720
      const dur = 900 + Math.random() * 600

      this._scene.tweens.add({
        targets: g,
        x: g.x + driftX,
        y: g.y + fallY,
        angle: spinEnd,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => { g.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /**
   * Burst N circles radiating outward from (x, y) in a uniform circle.
   * Uses the pre-allocated burst pool.
   */
  private _particleBurst(x: number, y: number, count: number, color: number, radius: number): void {
    let spawned = 0
    for (const p of this._burstPool) {
      if (spawned >= count) break
      if (p.getData('busy')) continue
      const angle = (spawned / count) * Math.PI * 2
      const jitter = (Math.random() - 0.5) * 0.35
      const finalAngle = angle + jitter
      const dist = radius * (0.7 + Math.random() * 0.6)
      const r = 1.5 + Math.random() * 2.5
      p.setPosition(x, y)
      p.setFillStyle(color)
      p.setRadius(r)
      p.setAlpha(1).setVisible(true).setData('busy', true)

      this._scene.tweens.add({
        targets: p,
        x: x + Math.cos(finalAngle) * dist,
        y: y + Math.sin(finalAngle) * dist,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 480 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => { p.setVisible(false).setData('busy', false) },
      })
      spawned++
    }
  }

  /**
   * Create a text object at (x, y) that floats upward and fades out,
   * then destroys itself. Not pooled — these are short-lived.
   */
  private _risingText(
    x: number,
    y: number,
    text: string,
    style: Partial<Phaser.Types.GameObjects.Text.TextStyle>,
  ): void {
    const obj = this._scene.add.text(x, y, text, {
      ...style,
    } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(600)

    const targetY = y - 42
    this._scene.tweens.add({
      targets: obj,
      alpha: 1,
      y: y - 10,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this._scene.tweens.add({
          targets: obj,
          alpha: 0,
          y: targetY,
          duration: 500,
          ease: 'Power1',
          delay: 600,
          onComplete: () => obj.destroy(),
        })
      },
    })
  }

  /** Expanding ring — a Graphics circle that grows from center and fades. */
  private _expandingRing(x: number, y: number, color: number): void {
    const gfx = this._scene.add.graphics().setDepth(598)
    let progress = 0

    this._scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Power2',
      onUpdate: (tween) => {
        progress = tween.getValue() ?? 0
        const currentRadius = 6 + progress * 52
        const alpha = (1 - progress) * 0.85
        gfx.clear()
        gfx.lineStyle(2.5 * (1 - progress * 0.6), color, alpha)
        gfx.strokeCircle(x, y, currentRadius)
      },
      onComplete: () => gfx.destroy(),
    })
  }

  /**
   * Very brief screen-space flash overlay. Uses the Flash VFX sprite if loaded,
   * with a subtle graphics overlay as supplement.
   */
  private _screenFlash(color: number): void {
    const cam = this._scene.cameras.main

    // Graphics overlay (keeps the color tint)
    const flash = this._scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9999)
    flash.fillStyle(color, 0.10)
    flash.fillRect(0, 0, cam.width, cam.height)
    flash.setAlpha(1)

    this._scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 160,
      ease: 'Power2',
      delay: 50,
      onComplete: () => flash.destroy(),
    })

    // Sprite flash VFX at screen center
    if (this._scene.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      const flashSprite = this._scene.add.sprite(cam.width / 2, cam.height / 2, SPRITESHEET_KEYS.EFFECTS_FLASH)
        .setScrollFactor(0)
        .setDepth(9998)
        .setScale(1.5)
        .setAlpha(0.35)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
      flashSprite.play(EFFECT_ANIM_KEYS.FLASH)
      flashSprite.once('animationcomplete', () => flashSprite.destroy())
    }
  }

  // ---------------------------------------------------------------------------
  // Pool initialization
  // ---------------------------------------------------------------------------

  private _initBurstPool(): void {
    for (let i = 0; i < BURST_POOL_SIZE; i++) {
      const p = this._scene.add.circle(0, 0, 2, 0xffffff, 1)
        .setDepth(599)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this._burstPool.push(p)
    }
  }

  private _initConfettiPool(): void {
    for (let i = 0; i < CONFETTI_POOL_SIZE; i++) {
      const g = this._scene.add.graphics()
        .setDepth(597)
        .setVisible(false)
      g.setData('busy', false)
      this._confettiPool.push(g)
    }
  }

  private _initSparklePool(): void {
    for (let i = 0; i < SPARKLE_POOL_SIZE; i++) {
      const p = this._scene.add.circle(0, 0, 1.5, 0x34d399, 1)
        .setDepth(601)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this._sparklePool.push(p)
    }
  }
}
