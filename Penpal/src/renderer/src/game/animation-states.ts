// ---------------------------------------------------------------------------
// animation-states.ts
// Discrete animation state handlers extracted from WorkstationAnimator.
//
// Each class owns the enter/exit/update contract for one animation mode
// (idle, working, waiting).  WorkstationAnimator remains the orchestrator:
// it handles mode detection, blend-guard serialisation, and the common
// teardown that runs on every mode transition, then delegates to the active
// state's enter() method.
//
// Module pattern: each class receives Phaser.Scene in its constructor.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import type { WorkstationSprite, Room } from './office-types'
import { activeTheme } from './office-theme'
import { AnimConfig } from './animation-config'
import { EventBus, EVENTS } from './events'
import { questSystem, type QuestDifficulty } from './quest-system'
import { creditManager } from './credits'
import { leaderboardManager } from './leaderboard'
import { seasonManager } from './seasons'
import {
  CHAR_COLS,
  POSE_IDLE,
  POSE_INTERACT,
  POSE_SIT,
  POSE_WALK,
  CHAR_SCALE,
  WS_DESK_Y,
  WS_SPRITE_Y,
  IDLE_WALK_BREAK_MIN_MS,
  IDLE_WALK_BREAK_VAR_MS,
  LOD_L2_MAX,
  ROOM_HEADER_H,
} from './office-constants'
import {
  ANIM_KEYS,
  DIFFICULTY_STAR_FRAME,
  ICON_FRAMES,
  EFFECT_ANIM_KEYS,
  SPRITESHEET_KEYS,
} from './office-asset-keys'
import { getAgentCharacterIndex } from './office-helpers'
import type { WorkstationHost } from './office-workstation'
import { buildOwnRoomRect } from './nav-mesh'
import { PathWalker } from './path-walker'
import type { StateMachine } from './state-machine'

// ---------------------------------------------------------------------------
// Context interface — what each state class needs from the orchestrator
// ---------------------------------------------------------------------------

export interface AnimationStateContext {
  readonly scene: Phaser.Scene
  readonly host: WorkstationHost
  restoreDeskStroke(ws: WorkstationSprite): void
  refreshTaskCount(ws: WorkstationSprite): void
  updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void
  showSpeechBubble(ws: WorkstationSprite, agent: AgentState): void
  hideThinkingDots(ws: WorkstationSprite): void
  applyQuestStarStyle(ws: WorkstationSprite, difficulty: QuestDifficulty): void
  finishBlend(agentId: string, sm: StateMachine): void
}

// ---------------------------------------------------------------------------
// AnimationState interface
// ---------------------------------------------------------------------------

export interface AnimationState {
  readonly name: 'idle' | 'working' | 'waiting'

  /**
   * Called when the workstation transitions INTO this state.
   * Responsible for setting up all tweens, timers, and visual state.
   */
  enter(
    ws: WorkstationSprite,
    agent: AgentState,
    prevMode: 'idle' | 'working' | 'waiting' | undefined,
    blendSM: StateMachine,
    agentId: string,
  ): void

  /**
   * Called when the workstation transitions OUT OF this state.
   * State-specific cleanup beyond the common teardown (TweenBag.killAll).
   * Most cleanup is handled by the orchestrator's common teardown; this
   * is for any additional state-specific resources.
   */
  exit(ws: WorkstationSprite): void

  /**
   * Per-frame update (currently unused — all animation is tween-driven).
   * Reserved for future per-frame logic (e.g. shader uniforms, manual
   * interpolation) without requiring changes to the orchestrator.
   */
  update(ws: WorkstationSprite, dt: number): void
}

// ---------------------------------------------------------------------------
// WaitingState
// ---------------------------------------------------------------------------

export class WaitingState implements AnimationState {
  readonly name = 'waiting' as const
  private scene: Phaser.Scene
  private ctx: AnimationStateContext

  constructor(scene: Phaser.Scene, ctx: AnimationStateContext) {
    this.scene = scene
    this.ctx = ctx
  }

  enter(
    ws: WorkstationSprite,
    agent: AgentState,
    _prevMode: 'idle' | 'working' | 'waiting' | undefined,
    blendSM: StateMachine,
    agentId: string,
  ): void {
    const gdsLock = this.ctx.host.getOrAssignGdsDeskSlot != null
    const charIdx = this.ctx.host.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    // any→waiting: fade the sprite in gradually over 400 ms so the waiting
    // pose doesn't snap in abruptly.  Main-loop tweens are delayed by the
    // same duration so they only start once the agent is fully visible.
    const waitingBlendMs = AnimConfig.stateTransitions.anyToWaiting.durationMs
    ws.sprite.setAlpha(0)
    blendSM.setState('blending')
    this.scene.tweens.add({
      targets: ws.sprite, alpha: 1,
      duration: waitingBlendMs, ease: 'Sine.easeOut',
      onComplete: () => this.ctx.finishBlend(agentId, blendSM),
    })

    if (!gdsLock) ws.sprite.setFrame(base + POSE_IDLE)
    ws.pulseTween = ws.tweenBag.add('pulse', this.scene.tweens.add({
      targets: ws.sprite, scaleX: CHAR_SCALE * AnimConfig.waiting.pulseScaleFactor, scaleY: CHAR_SCALE * AnimConfig.waiting.pulseScaleFactor,
      duration: AnimConfig.waiting.pulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: waitingBlendMs,
    }))
    ws.typingTween = ws.tweenBag.add('typing', this.scene.tweens.add({
      targets: ws.sprite, x: AnimConfig.waiting.swayAmplitude,
      duration: AnimConfig.waiting.swayDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: waitingBlendMs,
    }))
    ws.dotPulseTween = ws.tweenBag.add('dotPulse', this.scene.tweens.add({
      targets: ws.statusDot, alpha: AnimConfig.waiting.dotPulseAlphaMin,
      duration: AnimConfig.waiting.dotPulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: waitingBlendMs,
    }))
    // LED: waiting — amber steady glow
    if (ws.ledGlow) {
      ws.ledGlow.clear()
      ws.ledGlow.fillStyle(activeTheme.deskStrokeWaiting, 1)
      ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
      this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.5, duration: 300, ease: 'Sine.easeOut' })
    }
    // Lamp light cone: dim when waiting
    if (ws.lampLight) {
      ws.lampLightTween = ws.tweenBag.add('lampLight', this.scene.tweens.add({
        targets: ws.lampLight, alpha: AnimConfig.waiting.lampDimAlpha,
        duration: AnimConfig.waiting.ledFadeDuration, ease: 'Sine.easeOut',
      }))
    }
    // Task review ring — yellow rotating arc during accept-edits review phase
    if (agent.interactionType === 'accept-edits') {
      const reviewRing = this.scene.add.graphics()
      ws.container.add(reviewRing)
      ws.taskReviewRing = reviewRing
      const REVIEW_RING_R = 14
      ws.taskReviewRingTween = ws.tweenBag.add('taskReviewRing', this.scene.tweens.addCounter({
        from: 0,
        to: Math.PI * 2,
        duration: 1600,
        repeat: -1,
        ease: 'Linear',
        onUpdate: (tween) => {
          if (!reviewRing.active) return
          const a = tween.getValue() ?? 0
          reviewRing.clear()
          reviewRing.lineStyle(1.5, activeTheme.statusWaiting, 0.75)
          reviewRing.beginPath()
          reviewRing.arc(0, WS_SPRITE_Y, REVIEW_RING_R, a, a + Math.PI * 1.1, false)
          reviewRing.strokePath()
        },
      }))
    }
    this.ctx.restoreDeskStroke(ws)
  }

  exit(_ws: WorkstationSprite): void {
    // Common teardown (TweenBag.killAll) handles all cleanup
  }

  update(_ws: WorkstationSprite, _dt: number): void {
    // All animation is tween-driven; no per-frame work needed
  }
}

// ---------------------------------------------------------------------------
// WorkingState
// ---------------------------------------------------------------------------

export class WorkingState implements AnimationState {
  readonly name = 'working' as const
  private scene: Phaser.Scene
  private ctx: AnimationStateContext

  constructor(scene: Phaser.Scene, ctx: AnimationStateContext) {
    this.scene = scene
    this.ctx = ctx
  }

  enter(
    ws: WorkstationSprite,
    agent: AgentState,
    prevMode: 'idle' | 'working' | 'waiting' | undefined,
    blendSM: StateMachine,
    agentId: string,
  ): void {
    const gdsLock = this.ctx.host.getOrAssignGdsDeskSlot != null
    const charIdx = this.ctx.host.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    if (!gdsLock) ws.sprite.setFrame(base + POSE_INTERACT)

    // idle→working: squash-compression burst (scaleY) before typing starts.
    const workingBlendMs = (prevMode === 'idle' || prevMode === undefined)
      ? AnimConfig.stateTransitions.idleToWorking.durationMs
      : 0
    if (workingBlendMs > 0) {
      blendSM.setState('blending')
      const halfBlend = workingBlendMs / 2
      this.scene.tweens.add({
        targets: ws.sprite,
        scaleY: CHAR_SCALE * AnimConfig.stateTransitions.idleToWorking.compressionScale,
        duration: halfBlend,
        ease: 'Sine.easeIn',
        yoyo: true,
        onComplete: () => {
          ws.sprite.setScale(CHAR_SCALE)
          this.ctx.finishBlend(agentId, blendSM)
        },
      })
    }

    ws.typingTween = ws.tweenBag.add('typing', this.scene.tweens.add({
      targets: ws.sprite, x: AnimConfig.working.typingAmplitude,
      duration: AnimConfig.working.typingDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: workingBlendMs,
    }))
    ws.bounceTween = ws.tweenBag.add('bounce', this.scene.tweens.add({
      targets: ws.sprite, y: WS_SPRITE_Y - AnimConfig.working.bounceOffset,
      duration: AnimConfig.working.bounceDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: workingBlendMs,
    }))
    ws.headTiltTween = ws.tweenBag.add('headTilt', this.scene.tweens.add({
      targets: ws.sprite, angle: AnimConfig.working.headTiltAngle,
      duration: AnimConfig.working.headTiltDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: workingBlendMs,
    }))
    if (!this.ctx.host.getOrAssignGdsDeskSlot) ws.deskBody.setStrokeStyle(1, activeTheme.statusWorking, 0.55)

    // Keyboard glow — subtle blue stroke shimmer while typing
    if (ws.keyboard) {
      ws.keyboard.setStrokeStyle(0.5, 0x0ea5e9, 0.4)
      if (!ws.kbGlowTween) {
        ws.kbGlowTween = ws.tweenBag.add('kbGlow', this.scene.tweens.add({
          targets: ws.keyboard,
          alpha: { from: AnimConfig.working.keyboardGlowAlphaMin, to: AnimConfig.working.keyboardGlowAlphaMax },
          duration: AnimConfig.working.keyboardGlowDuration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }))
      }
    }

    // ── Game systems: auto-wrap into quest ──
    if (prevMode !== 'working') {
      const aid = agent.config.id
      if (questSystem.getAgentActiveQuests(aid).length === 0) {
        const blurb = agent.isOrchestratorTask
          ? (agent.taskTitle?.slice(0, 40) ?? 'Task')
          : (agent.lastAssistantBlurb?.slice(0, 40) ?? 'Working')
        questSystem.startQuest({
          title: blurb,
          agentId: aid,
          priority: 'normal',
        })
      }
      const xpD = agent.xp
      leaderboardManager.recordXP(aid, agent.config.name, 0, xpD?.level ?? 1, xpD?.rank ?? 'Intern')

      // Show quest difficulty star with difficulty-proportional animation
      const activeQ = questSystem.getAgentActiveQuests(aid)[0]
      if (activeQ && ws.questIcon) {
        const frame = DIFFICULTY_STAR_FRAME[activeQ.difficulty] ?? ICON_FRAMES.STAR_GREY
        ws.questIcon.setFrame(frame).setVisible(true).setAlpha(0)
        ws.tweenBag.kill('questIcon')
        ws.tweenBag.kill('questIconPulse')
        this.ctx.applyQuestStarStyle(ws, activeQ.difficulty as QuestDifficulty)
      }

      // Task start VFX: expanding white ring + sparkles (idle→working)
      for (const room of this.ctx.host.getRooms().values()) {
        if (room.workstations.has(agent.config.id)) {
          const worldX = room.x + ws.container.x
          const worldY = room.y + ws.container.y + WS_SPRITE_Y
          this.ctx.host.celebrations?.taskStart(worldX, worldY)
          break
        }
      }
    }
    // LED: working — green pulsing glow
    if (ws.ledGlow) {
      ws.ledGlow.clear()
      ws.ledGlow.fillStyle(activeTheme.deskStrokeWorking, 1)
      ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
      this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.6, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => {
          if (!ws.ledGlow) return
          ws.ledGlow.setAlpha(AnimConfig.working.ledPulseAlphaBase)
          ws.ledPulseTween = ws.tweenBag.add('ledPulse', this.scene.tweens.add({
            targets: ws.ledGlow, alpha: AnimConfig.working.ledPulseAlphaPeak,
            duration: AnimConfig.working.ledPulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          }))
        },
      })
    }
    // Lamp light cone: brighten when working with a warm glow
    if (ws.lampLight) {
      ws.lampLightTween = ws.tweenBag.add('lampLight', this.scene.tweens.add({
        targets: ws.lampLight, alpha: AnimConfig.working.lampBrightAlpha,
        duration: 300, ease: 'Sine.easeOut',
      }))
      // Subtle flicker every 8-15 seconds
      ws.lampFlickerTimer = ws.tweenBag.add('lampFlicker', this.scene.time.addEvent({
        delay: AnimConfig.working.lampFlickerIntervalMin + Math.random() * AnimConfig.working.lampFlickerIntervalVar,
        loop: true,
        callback: () => {
          if (!ws.lampLight || !ws.lampLight.active || ws.lastAnimMode !== 'working') return
          this.scene.tweens.add({
            targets: ws.lampLight,
            alpha: 0.08,
            duration: 50,
            yoyo: true,
            hold: 30,
            ease: 'Sine.easeInOut',
          })
        },
      }))
    }

    // Ambient sound-wave indicator
    if (ws.soundWaveGfx) {
      const gfx = ws.soundWaveGfx
      gfx.clear()
      gfx.lineStyle(1, activeTheme.wallInner, 0.15)
      gfx.beginPath()
      gfx.arc(0, 0, 3, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
      gfx.strokePath()
      gfx.lineStyle(1, activeTheme.wallInner, 0.10)
      gfx.beginPath()
      gfx.arc(0, 0, 5, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
      gfx.strokePath()
      gfx.lineStyle(1, activeTheme.wallInner, 0.05)
      gfx.beginPath()
      gfx.arc(0, 0, 7, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
      gfx.strokePath()
      gfx.setAlpha(1)
      ws.soundWaveTween = ws.tweenBag.add('soundWave', this.scene.tweens.add({
        targets: gfx, alpha: 0,
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      }))

      // Small PLAY_DARK "speaker" sprite at the sound wave origin
      const speaker = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.PLAY_DARK)
        .setScale(0.14).setAlpha(0.2)
      ws.container.add(speaker)
      speaker.setPosition(gfx.x, gfx.y)
      ws.soundWaveSpeaker = speaker
      this.scene.tweens.add({
        targets: speaker, alpha: 0.05,
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // Floating "typing note" sprites
    ws.typingNoteTimer = ws.tweenBag.add('typingNote', this.scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (this.scene.cameras.main.zoom <= LOD_L2_MAX) return
        const count = 1 + Math.floor(Math.random() * 2)
        for (let n = 0; n < count; n++) {
          const noteX = (Math.random() - 0.5) * 10
          const noteY = WS_SPRITE_Y - 2
          const note = this.scene.add.sprite(noteX, noteY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
            .setScale(0.12).setAlpha(0.3)
          ws.container.add(note)
          this.scene.tweens.add({
            targets: note,
            y: noteY - 15,
            x: noteX + (Math.random() - 0.5) * 6,
            alpha: 0,
            duration: 800,
            ease: 'Sine.easeOut',
            delay: n * 100,
            onComplete: () => { try { note.destroy() } catch { /* already gone */ } },
          })
        }
      },
    }))

    // Progress ring
    if (ws.progressRing) {
      ws.workStartTime = Date.now()
      const ring = ws.progressRing
      const RING_DURATION_MS = 60_000
      const RING_R = 10
      const drawRing = (progress: number) => {
        if (!ring.active) return
        ring.clear()
        ring.lineStyle(1.5, activeTheme.wall, 0.3)
        ring.beginPath()
        ring.arc(0, 0, RING_R, 0, Math.PI * 2, false)
        ring.strokePath()
        const fill = Math.min(progress, 1)
        if (fill > 0) {
          const arcColor = fill < 0.8 ? activeTheme.statusWorking : activeTheme.statusWaiting
          ring.lineStyle(1.5, arcColor, 0.5)
          ring.beginPath()
          ring.arc(0, 0, RING_R,
            Phaser.Math.DegToRad(-90),
            Phaser.Math.DegToRad(fill * 360 - 90),
            false,
          )
          ring.strokePath()
        }
      }
      ring.setAlpha(0)
      drawRing(0)
      this.scene.tweens.add({ targets: ring, alpha: 1, duration: 400, ease: 'Sine.easeOut' })
      ws.progressRingTween = ws.tweenBag.add('progressRing', this.scene.tweens.addCounter({
        from: 0, to: 100,
        duration: RING_DURATION_MS,
        ease: 'Linear',
        onUpdate: (tw) => {
          const pct = tw.getValue() / 100
          drawRing(pct)
        },
        onComplete: () => {
          drawRing(1)
          ws.progressRingTween = ws.tweenBag.add('progressRing', this.scene.tweens.add({
            targets: ring, alpha: 0.35,
            duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          }))
        },
      }))
    }

    // Speech bubble
    this.ctx.showSpeechBubble(ws, agent)
  }

  exit(_ws: WorkstationSprite): void {
    // Common teardown (TweenBag.killAll) handles all cleanup
  }

  update(_ws: WorkstationSprite, _dt: number): void {
    // All animation is tween-driven; no per-frame work needed
  }
}

// ---------------------------------------------------------------------------
// IdleState
// ---------------------------------------------------------------------------

export class IdleState implements AnimationState {
  readonly name = 'idle' as const
  private scene: Phaser.Scene
  private ctx: AnimationStateContext

  constructor(scene: Phaser.Scene, ctx: AnimationStateContext) {
    this.scene = scene
    this.ctx = ctx
  }

  enter(
    ws: WorkstationSprite,
    agent: AgentState,
    prevMode: 'idle' | 'working' | 'waiting' | undefined,
    blendSM: StateMachine,
    agentId: string,
  ): void {
    const gdsLock = this.ctx.host.getOrAssignGdsDeskSlot != null
    const charIdx = this.ctx.host.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    if (!gdsLock) ws.sprite.setFrame(base + POSE_SIT)

    // working→idle: hands-lift + lean-back before settling into the idle pose.
    const idleBlendMs = prevMode === 'working'
      ? AnimConfig.stateTransitions.workingToIdle.durationMs
      : 0
    if (idleBlendMs > 0) {
      blendSM.setState('blending')
      const halfBlend = idleBlendMs / 3
      const settleMs  = idleBlendMs * 2 / 3
      this.scene.tweens.add({
        targets: ws.sprite,
        y:     WS_SPRITE_Y - AnimConfig.stateTransitions.workingToIdle.liftPx,
        angle: AnimConfig.stateTransitions.workingToIdle.leanAngle,
        duration: halfBlend,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: ws.sprite,
            y:     WS_SPRITE_Y,
            angle: 0,
            duration: settleMs,
            ease: 'Sine.easeIn',
            onComplete: () => this.ctx.finishBlend(agentId, blendSM),
          })
        },
      })
    }

    ws.breathTween = ws.tweenBag.add('breath', this.scene.tweens.add({
      targets: ws.sprite, scaleY: CHAR_SCALE * AnimConfig.idle.breathScaleFactor,
      duration: AnimConfig.idle.breathDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: idleBlendMs,
    }))

    // Idle chair rocking
    if (ws.chairSprite?.visible) {
      ws.chairRockTween = ws.tweenBag.add('chairRock', this.scene.tweens.add({
        targets: ws.chairSprite,
        angle: { from: -AnimConfig.idle.chairRockAngle, to: AnimConfig.idle.chairRockAngle },
        duration: AnimConfig.idle.chairRockDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: idleBlendMs,
      }))
    }

    // Monitor screensaver
    if (ws.monitorSprite) {
      const SS_COLORS = [activeTheme.wall, activeTheme.screensaverPurple, activeTheme.screensaverTeal]
      ws.tweenBag.add('screensaver', this.scene.tweens.addCounter({
        from: 0, to: 1, duration: 12000, repeat: -1, ease: 'Linear',
        onUpdate: (tw: Phaser.Tweens.Tween) => {
          if (!ws.monitorSprite?.active) return
          const raw = tw.getValue() * 3
          const seg = Math.floor(raw) % 3
          const frac = raw - Math.floor(raw)
          const c1 = SS_COLORS[seg] ?? SS_COLORS[0]!
          const c2 = SS_COLORS[(seg + 1) % 3] ?? SS_COLORS[0]!
          const lerp = (a: number, b: number) => Math.round(a + (b - a) * frac)
          const r = lerp((c1 >> 16) & 0xff, (c2 >> 16) & 0xff)
          const g = lerp((c1 >> 8) & 0xff, (c2 >> 8) & 0xff)
          const b = lerp(c1 & 0xff, c2 & 0xff)
          ws.monitorSprite!.setTint((r << 16) | (g << 8) | b)
          ws.monitorSprite!.setAlpha(0.45)
        },
      }))
    }

    // Coffee mug steam
    if (!ws.steamContainer) {
      ws.steamContainer = this.scene.add.container(8, WS_DESK_Y - 2)
      ws.container.add(ws.steamContainer)
    }
    const spawnMugSteam = () => {
      if (ws.lastAnimMode !== 'idle' || !ws.steamContainer?.active) return
      for (let i = 0; i < 5; i++) {
        const xOff = (i - 2) * 2.0 + (Math.random() - 0.5) * 0.5
        const p = this.scene.add.circle(xOff, 0, 1.5, 0xd4d4d8, 0.08)
        ws.steamContainer.add(p)
        this.scene.tweens.add({
          targets: p,
          y: -8 - Math.random() * 3,
          alpha: 0,
          duration: 2000,
          delay: i * 350,
          ease: 'Sine.easeOut',
          onComplete: () => { try { ws.steamContainer?.remove(p, true) } catch { /* gone */ } },
        })
      }
    }
    spawnMugSteam()
    ws.mugSteamTimer = ws.tweenBag.add('mugSteam', this.scene.time.addEvent({
      delay: 2500, loop: true, callback: () => { spawnMugSteam() },
    }))

    // Fart VFX when entering compressing mode
    if (agent.sessionMode === 'compressing' && this.scene.anims.exists(EFFECT_ANIM_KEYS.FART)) {
      const fart = this.scene.add.sprite(0, WS_SPRITE_Y - 8, SPRITESHEET_KEYS.EFFECTS_FART)
        .setDepth(600).setScale(0.18).setAlpha(0.5)
      ws.container.add(fart)
      fart.play(EFFECT_ANIM_KEYS.FART)
      fart.once('animationcomplete', () => fart.destroy())
    }

    // Remove keyboard glow
    ws.tweenBag.kill('kbGlow')
    ws.kbGlowTween = undefined
    if (ws.keyboard) ws.keyboard.setStrokeStyle(0, 0, 0).setAlpha(0.8)

    // LED: idle — muted dim glow
    if (ws.ledGlow) {
      ws.ledGlow.clear()
      ws.ledGlow.fillStyle(activeTheme.deskStrokeIdle, 1)
      ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
      this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.1, duration: 600, ease: 'Sine.easeOut' })
    }
    // Lamp light cone: dim when idle
    if (ws.lampLight) {
      ws.lampLightTween = ws.tweenBag.add('lampLight', this.scene.tweens.add({
        targets: ws.lampLight, alpha: AnimConfig.waiting.lampDimAlpha,
        duration: AnimConfig.waiting.ledFadeDuration, ease: 'Sine.easeOut',
      }))
    }
    this.ctx.restoreDeskStroke(ws)

    // "Just finished" confetti + game-systems
    if (prevMode === 'working') {
      this.handleWorkingToIdleTransition(ws, agent)
    }

    // Stamp idleSince so later timers can detect prolonged boredom
    ws.sprite.setData('idleSince', Date.now())

    // Head tilt: tween angle -4..+4 degrees every 8-15s
    if (!gdsLock) {
      ws.lookAroundTimer = ws.tweenBag.add('lookAround', this.scene.time.addEvent({
        delay: 8000 + Math.random() * 7000,
        loop: true,
        callback: () => {
          const angle = (Math.random() - 0.5) * 8
          ws.headTiltTween = ws.tweenBag.add('headTilt', this.scene.tweens.add({
            targets: ws.sprite, angle,
            duration: 400, hold: 1000, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
          }))
        },
      }))
    }

    // Stretch: scaleY 1→1.04 over 300ms, hold 200ms, back to 1 every 20-30s
    ws.stretchTimer = ws.tweenBag.add('stretch', this.scene.time.addEvent({
      delay: 20000 + Math.random() * 10000,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: ws.sprite,
          scaleY: CHAR_SCALE * 1.04,
          duration: 300, ease: 'Sine.easeOut',
          onComplete: () => {
            this.scene.time.delayedCall(200, () => {
              this.scene.tweens.add({
                targets: ws.sprite,
                scaleY: CHAR_SCALE,
                duration: 300, ease: 'Sine.easeIn',
              })
            })
          },
        })
      },
    }))

    // Look at neighbor: tilt -3/+3 degrees toward a working peer every 12-18s
    ws.lookAtNeighborTimer = ws.tweenBag.add('lookAtNeighbor', this.scene.time.addEvent({
      delay: 12000 + Math.random() * 6000,
      loop: true,
      callback: () => {
        if (ws.tweenBag.has('walkBreak') || ws.tweenBag.has('headTilt')) return
        let neighborContainerX: number | null = null
        for (const room of this.ctx.host.getRooms().values()) {
          if (!room.workstations.has(agent.config.id)) continue
          for (const [otherId, otherWs] of room.workstations) {
            if (otherId === agent.config.id) continue
            const otherMode = otherWs.state?.sessionMode
            const isOtherWorking =
              (otherMode === 'working' || otherMode === 'plan') &&
              !otherWs.state?.needsInteraction
            if (isOtherWorking) {
              neighborContainerX = otherWs.container.x
              break
            }
          }
          break
        }
        if (neighborContainerX === null) return
        const tiltAngle = neighborContainerX < ws.container.x ? -3 : 3
        ws.headTiltTween = ws.tweenBag.add('headTilt', this.scene.tweens.add({
          targets: ws.sprite, angle: tiltAngle,
          duration: 350, ease: 'Sine.easeOut',
          onComplete: () => {
            this.scene.time.delayedCall(2000, () => {
              this.scene.tweens.add({
                targets: ws.sprite, angle: 0,
                duration: 350, ease: 'Sine.easeIn',
                onComplete: () => { ws.tweenBag.remove('headTilt') },
              })
            })
          },
        }))
      },
    }))

    // Yawn/bored pose: after 60s+ idle
    ws.yawnTimer = ws.tweenBag.add('yawn', this.scene.time.addEvent({
      delay: 65000 + Math.random() * 10000,
      loop: true,
      callback: () => {
        const idleSince: number = ws.sprite.getData('idleSince') ?? Date.now()
        if (Date.now() - idleSince < 60000) return
        if (ws.tweenBag.has('walkBreak')) return
        if (!gdsLock) ws.sprite.setFrame(base + POSE_INTERACT)
        this.scene.time.delayedCall(1500, () => {
          if (ws.lastAnimMode === 'idle' && !gdsLock) {
            ws.sprite.setFrame(base + POSE_SIT)
          }
        })
      },
    }))

    // Look at desk pet
    if (ws.deskPet && ws.deskPet.visible) {
      this.scene.time.addEvent({
        delay: 15000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          if (gdsLock) return
          if (ws.tweenBag.has('walkBreak') || ws.tweenBag.has('headTilt') || ws.lastAnimMode !== 'idle') return
          if (!ws.deskPet || !ws.deskPet.visible) return
          const petDir = ws.deskPet.x > 0 ? 3 : -3
          ws.headTiltTween = ws.tweenBag.add('headTilt', this.scene.tweens.add({
            targets: ws.sprite, angle: petDir,
            duration: 300, hold: 600, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
          }))
          this.scene.tweens.add({
            targets: ws.deskPet,
            y: ws.deskPet.y - 2,
            duration: 200, yoyo: true, ease: 'Sine.easeOut', delay: 200,
          })
        },
      })
    }

    // Tap signature item
    if (ws.signatureItem && ws.signatureItem.visible) {
      this.scene.time.addEvent({
        delay: 25000 + Math.random() * 15000,
        loop: true,
        callback: () => {
          if (ws.tweenBag.has('walkBreak') || ws.lastAnimMode !== 'idle') return
          if (!ws.signatureItem || !ws.signatureItem.visible) return
          this.scene.tweens.add({
            targets: ws.signatureItem,
            angle: { from: 0, to: 8 },
            duration: 150, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
          })
        },
      })
    }

    // Glance at energy bar when energy is low (<30%)
    this.scene.time.addEvent({
      delay: 18000 + Math.random() * 12000,
      loop: true,
      callback: () => {
        if (gdsLock) return
        if (ws.tweenBag.has('walkBreak') || ws.tweenBag.has('headTilt') || ws.lastAnimMode !== 'idle') return
        if ((ws.energyLevel ?? 1) > 0.3) return
        ws.headTiltTween = ws.tweenBag.add('headTilt', this.scene.tweens.add({
          targets: ws.sprite, angle: -4,
          duration: 250, hold: 500, yoyo: true, ease: 'Sine.easeInOut',
          onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
        }))
      },
    })

    ws.walkBreakTimer = ws.tweenBag.add('walkBreakTimer', this.scene.time.addEvent({
      delay: IDLE_WALK_BREAK_MIN_MS + Math.random() * IDLE_WALK_BREAK_VAR_MS,
      loop: true,
      callback: () => {
        if (!ws.state || ws.tweenBag.has('walkBreak') || !ws.sprite.visible) return
        const stillIdle =
          !ws.state.needsInteraction &&
          ws.state.sessionMode !== 'working' &&
          ws.state.sessionMode !== 'plan' &&
          ws.state.sessionMode !== 'compressing'
        if (!stillIdle) return
        this.executeWalkBreak(ws, agent)
      },
    }))
  }

  exit(_ws: WorkstationSprite): void {
    // Common teardown (TweenBag.killAll) handles all cleanup
  }

  update(_ws: WorkstationSprite, _dt: number): void {
    // All animation is tween-driven; no per-frame work needed
  }

  // ---------------------------------------------------------------------------
  // Walk break
  // ---------------------------------------------------------------------------

  executeWalkBreak(ws: WorkstationSprite, agent: AgentState): void {
    const navMesh = this.ctx.host.getNavMesh()
    if (!navMesh) return
    let ownerRoom: Room | null = null
    for (const room of this.ctx.host.getRooms().values()) {
      if (room.workstations.has(agent.config.id)) { ownerRoom = room; break }
    }
    if (!ownerRoom) return

    const worldX = ownerRoom.x + ws.container.x
    const worldY = ownerRoom.y + ws.container.y + WS_SPRITE_Y

    const angle = Math.random() * Math.PI * 2
    const dist = 30 + Math.random() * 30
    const targetX = worldX + Math.cos(angle) * dist
    const targetY = worldY + Math.sin(angle) * dist

    const roomLeft = ownerRoom.x - ownerRoom.width / 2 + 14
    const roomTop = ownerRoom.y - ownerRoom.height / 2 + 14
    const roomRight = ownerRoom.x + ownerRoom.width / 2 - 14
    const roomBottom = ownerRoom.y + ownerRoom.height / 2 - 14 - ROOM_HEADER_H
    if (targetX < roomLeft || targetX > roomRight || targetY < roomTop || targetY > roomBottom) return

    const ownRoomRect = buildOwnRoomRect(ownerRoom)
    const goPath = navMesh.findPath({ x: worldX, y: worldY }, { x: targetX, y: targetY }, ownRoomRect)
    if (!goPath || goPath.length < 2) return

    const gdsLock = this.ctx.host.getOrAssignGdsDeskSlot != null
    const base = getAgentCharacterIndex(agent) * CHAR_COLS

    // idle→walking: anticipation lean
    ws.walkBreakTween = ws.tweenBag.add('walkBreakSentinel', this.scene.tweens.addCounter({ duration: 999999 }))

    const leanMs = AnimConfig.stateTransitions.idleToWalking.durationMs
    const leanAngle = AnimConfig.stateTransitions.idleToWalking.leanAngle
    this.scene.tweens.add({
      targets: ws.sprite,
      angle: leanAngle,
      duration: leanMs / 2,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => { ws.sprite.setAngle(0) },
    })

    this.scene.time.delayedCall(leanMs, () => {
      if (!ws.tweenBag.get('walkBreak')?.isPlaying()) return

      const charIdx = getAgentCharacterIndex(agent)
      const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
      const walkSprite = this.scene.add.sprite(worldX, worldY, walkSheetKey, 0)
        .setScale(CHAR_SCALE).setOrigin(0.5, 1).setDepth(9000)
      const walkShadow = this.scene.add.ellipse(worldX, worldY + 2, 16, 5, 0x000000, 0.15).setDepth(8999)

      ws.sprite.setVisible(false)

      const pathWalker = new PathWalker(this.scene, walkSprite, walkShadow, walkSheetKey)

      const returnPath = navMesh.findPath({ x: targetX, y: targetY }, { x: worldX, y: worldY }, ownRoomRect)
        ?? [...goPath].reverse()

      const finishWalk = () => {
        pathWalker.destroy()
        walkSprite.destroy()
        walkShadow.destroy()
        ws.sprite.setVisible(true)
        ws.tweenBag.kill('walkBreakSentinel')
        ws.walkBreakTween = undefined
        ws.sprite.x = 0
        ws.sprite.y = WS_SPRITE_Y
        if (!gdsLock) ws.sprite.setFrame(base + POSE_SIT)

        // walking→idle: momentum overshoot + settle
        const overshootPx = AnimConfig.stateTransitions.walkingToIdle.overshootPx
        const overshootMs = AnimConfig.stateTransitions.walkingToIdle.durationMs
        this.scene.tweens.add({
          targets: ws.sprite,
          x: overshootPx,
          duration: overshootMs * 0.4,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: ws.sprite,
              x: 0,
              duration: overshootMs * 0.6,
              ease: 'Back.easeOut',
            })
          },
        })
      }

      pathWalker.startPath(goPath, () => {
        this.scene.time.delayedCall(800 + Math.random() * 600, () => {
          if (!walkSprite.active) { finishWalk(); return }
          pathWalker.startPath(returnPath, finishWalk)
        })
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Working→idle transition effects and game system updates
  // ---------------------------------------------------------------------------

  private handleWorkingToIdleTransition(ws: WorkstationSprite, agent: AgentState): void {
    for (const room of this.ctx.host.getRooms().values()) {
      if (room.workstations.has(agent.config.id)) {
        const worldX = room.x + ws.container.x
        const worldY = room.y + ws.container.y - 16
        if (agent.sessionMode === 'error' || agent.sessionMode === 'crashed') {
          this.ctx.host.celebrations?.taskFail(worldX, worldY + 16, { agentId: agent.config.id })
        } else {
          this.ctx.host.burstConfetti(worldX, worldY)
          const sigMove = agent.config.bestiary?.signature_move?.name
          const sigColorHex = agent.config.bestiary?.colors?.primary
          if (sigMove && sigColorHex) {
            const sigColorInt = parseInt(sigColorHex.replace('#', ''), 16)
            this.scene.time.delayedCall(300, () => {
              this.ctx.host.celebrations?.signatureFlash(worldX, worldY - 12, sigMove, sigColorInt)
            })
          }
        }
        break
      }
    }

    ws.localTaskCount++
    this.ctx.refreshTaskCount(ws)

    // ── Game systems: quest complete, leaderboard, season ──
    const agentId = agent.config.id
    const agentName = agent.config.name
    const xpData = agent.xp

    let earnedXP = 0
    const activeQuest = questSystem.getAgentActiveQuests(agentId)[0]
    if (activeQuest) {
      const questDifficulty = activeQuest.difficulty
      const reward = questSystem.completeQuest(activeQuest.id)
      if (reward) {
        earnedXP = reward.xp
        creditManager.earn(reward.credits)
        seasonManager.trackCreditsEarned(reward.credits)
        seasonManager.trackQuestDifficulty(questDifficulty)
        seasonManager.trackQuestCompleted()
        EventBus.emit(
          EVENTS.QUEST_COMPLETED,
          activeQuest.id, agentId, reward.xp, reward.credits, questDifficulty,
        )
      }
    }

    const taskDuration = ws.workStartTime ? Date.now() - ws.workStartTime : 0
    leaderboardManager.recordTaskComplete(agentId, agentName, taskDuration, xpData?.currentStreak ?? 0)
    leaderboardManager.recordXP(agentId, agentName, earnedXP, xpData?.level ?? 1, xpData?.rank ?? 'Intern')

    seasonManager.trackTaskCompleted(xpData?.currentStreak ?? 0)
  }
}
