// ---------------------------------------------------------------------------
// workstation-animation.ts
// WorkstationAnimator — orchestrator for animation, mood, monitor-glow,
// blocked-indicator, and thought-bubble logic.
//
// The monolithic updateAnimation method has been decomposed into discrete
// state handler classes (WaitingState, WorkingState, IdleState) in
// animation-states.ts.  This file retains the orchestrator role: mode
// detection, blend-guard serialisation, the common teardown that runs on
// every mode transition, and delegation to the active state's enter().
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import type { WorkstationSprite, Room } from './office-types'
import { activeTheme } from './office-theme'
import { AnimConfig } from './animation-config'
import {
  CHAR_COLS,
  CHAR_SCALE,
  WS_DESK_Y,
  WS_SPRITE_Y,
  COLOR_LED_AMBER,
  LOD_L2_MAX,
  THINKING_DOT_RADIUS,
  THINKING_DOT_SPACING,
  THINKING_DOT_Y,
  THINKING_DOT_APPEAR_MS,
  THINKING_DOT_FADE_MS,
  THINKING_DOT_HOLD_MS,
  EVAL_GLOW_GREEN,
  EVAL_GLOW_AMBER,
  EVAL_GLOW_RED,
  EVAL_GLOW_GREY,
  EVAL_GLOW_REFRESH_MS,
  scaledFontSize,
} from './office-constants'
import { DIFFICULTY_STAR_FRAME, ICON_FRAMES, EFFECT_ANIM_KEYS, SPRITESHEET_KEYS, PET_FACE_FRAMES } from './office-asset-keys'
import { MOOD_CONFIGS, type Mood } from './agent-mood'
import type { WorkstationHost } from './office-workstation'
import { StateMachine } from './state-machine'
import type { QuestDifficulty } from './quest-system'
import {
  WaitingState,
  WorkingState,
  IdleState,
  type AnimationStateContext,
  type AnimationState,
} from './animation-states'

// ---------------------------------------------------------------------------
// Eval glow color helper
// ---------------------------------------------------------------------------

function evalGlowColor(rate: number | null | undefined): number {
  if (rate == null) return EVAL_GLOW_GREY
  if (rate > 0.8) return EVAL_GLOW_GREEN
  if (rate >= 0.6) return EVAL_GLOW_AMBER
  return EVAL_GLOW_RED
}

// ---------------------------------------------------------------------------
// WorkstationAnimator — orchestrator
// ---------------------------------------------------------------------------

export class WorkstationAnimator implements AnimationStateContext {
  readonly scene: Phaser.Scene
  readonly host: WorkstationHost

  /** Callback to the parent OfficeWorkstations.restoreDeskStroke. */
  private restoreDeskStrokeCallback: (ws: WorkstationSprite) => void

  /** Callback to the parent OfficeWorkstations.refreshTaskCountDisplay. */
  private refreshTaskCountCallback: (ws: WorkstationSprite) => void

  /** Cached eval success rates: agentId → successRate (null = no data) */
  private evalCache = new Map<string, number | null>()
  private evalStreakCache = new Map<string, number>()
  private lastEvalFetchAt = 0
  private evalFetchPromise: Promise<void> | null = null
  private pendingEvalGlowWorkstations = new Set<WorkstationSprite>()

  private blendSMs = new Map<string, StateMachine>()
  private pendingAnimUpdate = new Map<string, { ws: WorkstationSprite; agent: AgentState }>()

  // ── State handler instances ──
  private readonly waitingState: WaitingState
  private readonly workingState: WorkingState
  private readonly idleState: IdleState

  constructor(
    scene: Phaser.Scene,
    host: WorkstationHost,
    restoreDeskStrokeCallback: (ws: WorkstationSprite) => void,
    refreshTaskCountCallback: (ws: WorkstationSprite) => void,
  ) {
    this.scene = scene
    this.host = host
    this.restoreDeskStrokeCallback = restoreDeskStrokeCallback
    this.refreshTaskCountCallback = refreshTaskCountCallback

    // Create state handler instances — each follows the module pattern
    // (receives Phaser.Scene in constructor) and gets a reference to this
    // orchestrator as context for shared methods.
    this.waitingState = new WaitingState(scene, this)
    this.workingState = new WorkingState(scene, this)
    this.idleState = new IdleState(scene, this)
  }

  // ---------------------------------------------------------------------------
  // AnimationStateContext implementation — shared methods for state classes
  // ---------------------------------------------------------------------------

  restoreDeskStroke(ws: WorkstationSprite): void {
    this.restoreDeskStrokeCallback(ws)
  }

  refreshTaskCount(ws: WorkstationSprite): void {
    this.refreshTaskCountCallback(ws)
  }

  showSpeechBubble(ws: WorkstationSprite, agent: AgentState): void {
    this._showSpeechBubble(ws, agent)
  }

  applyQuestStarStyle(ws: WorkstationSprite, difficulty: QuestDifficulty): void {
    this._applyQuestStarStyle(ws, difficulty)
  }

  finishBlend(agentId: string, sm: StateMachine): void {
    this._finishBlend(agentId, sm)
  }

  // ---------------------------------------------------------------------------
  // Eval glow data fetching
  // ---------------------------------------------------------------------------

  private refreshEvalCacheIfDue(): void {
    const now = Date.now()
    if (this.evalFetchPromise) return
    if (now - this.lastEvalFetchAt < EVAL_GLOW_REFRESH_MS) return
    this.lastEvalFetchAt = now
    this.evalFetchPromise = window.api.evalsReportAll()
      .then((reports) => {
        this.evalCache.clear()
        this.evalStreakCache.clear()
        for (const r of reports) {
          this.evalCache.set(r.agentId, r.totalTasks > 0 ? r.successRate : null)
          if (r.totalTasks > 0) {
            this.evalStreakCache.set(r.agentId, Math.max(0, r.streak ?? 0))
          }
        }
        const pending = [...this.pendingEvalGlowWorkstations]
        for (const w of pending) {
          this.applyEvalGlowFromCache(w)
        }
      })
      .catch(() => { /* silently ignore — grey glow on failure */ })
      .finally(() => { this.evalFetchPromise = null })
  }

  applyEvalGlowFromCache(ws: WorkstationSprite): void {
    if (!ws.evalGlow) return
    const agentId = ws.state?.config.id
    if (!agentId) return
    const canonical: number | null = this.evalCache.has(agentId)
      ? this.evalCache.get(agentId)!
      : null
    if (canonical === ws.evalSuccessRate) return
    ws.evalSuccessRate = canonical
    ws.evalGlow.setFillStyle(evalGlowColor(canonical))
  }

  updateEvalGlow(ws: WorkstationSprite): void {
    this.pendingEvalGlowWorkstations.add(ws)
    this.refreshEvalCacheIfDue()
    this.applyEvalGlowFromCache(ws)
  }

  // ---------------------------------------------------------------------------
  // Blend-guard helpers
  // ---------------------------------------------------------------------------

  private getBlendSM(agentId: string): StateMachine {
    let sm = this.blendSMs.get(agentId)
    if (!sm) {
      sm = new StateMachine(`${agentId}-blend`)
      sm.addState({ name: 'ready' })
      sm.addState({ name: 'blending' })
      sm.setState('ready')
      this.blendSMs.set(agentId, sm)
    }
    return sm
  }

  private _finishBlend(agentId: string, sm: StateMachine): void {
    sm.setState('ready')
    const pending = this.pendingAnimUpdate.get(agentId)
    if (pending) {
      this.pendingAnimUpdate.delete(agentId)
      pending.ws.lastAnimMode = undefined
      this.updateAnimation(pending.ws, pending.agent)
    }
  }

  // ---------------------------------------------------------------------------
  // updateAnimation — mode detection, common teardown, then delegate to state
  // ---------------------------------------------------------------------------

  updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWaiting = agent.needsInteraction ?? false
    const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !isWaiting

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return

    // Blend-guard: if a crossfade tween is already in flight, queue the latest
    // request and return.
    const agentId = agent.config.id
    const blendSM = this.getBlendSM(agentId)
    if (blendSM.currentStateName === 'blending') {
      this.pendingAnimUpdate.set(agentId, { ws, agent })
      return
    }

    const prevMode = ws.lastAnimMode
    ws.lastAnimMode = mode

    // ── Common teardown ──
    // TweenBag destroys every registered tween/timer in one call
    ws.tweenBag.killAll()

    // Guard refs: null the ones used as truthiness guards
    ws.walkBreakTween = undefined
    ws.headTiltTween  = undefined
    ws.kbGlowTween    = undefined

    // Sprite / layout resets
    ws.statusDot.setAlpha(1)
    ws.sprite.x = 0

    // Non-tween ambient objects cleared on every mode transition
    if (ws.soundWaveGfx) { ws.soundWaveGfx.clear(); ws.soundWaveGfx.setAlpha(1) }
    ws.soundWaveSpeaker?.destroy()
    ws.soundWaveSpeaker = undefined
    ws.chairSprite?.setAngle(0)

    ws.taskReviewRing?.destroy()
    ws.taskReviewRing = undefined

    ws.speechBubble?.setVisible(false).setAlpha(0)

    // Fade out progress ring
    if (ws.progressRing && ws.progressRing.alpha > 0) {
      this.scene.tweens.add({ targets: ws.progressRing, alpha: 0, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => { ws.progressRing?.clear() },
      })
    }
    ws.workStartTime = undefined

    // Fade out quest icon
    if (ws.questIcon && ws.questIcon.alpha > 0) {
      this.scene.tweens.add({ targets: ws.questIcon, alpha: 0, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => { ws.questIcon?.setVisible(false) },
      })
    }

    // Always stop steam when transitioning
    this.host.clearSteamParticles(ws)

    // Restore monitor to neutral state
    if (ws.monitorSprite?.active) { ws.monitorSprite.clearTint(); ws.monitorSprite.setAlpha(1) }

    // Clean up thinking dots when leaving working mode
    if (mode !== 'working' && ws.thinkingDotsContainer) {
      this.hideThinkingDots(ws)
    }

    // Fade out mood emoji and badge
    if (ws.moodEmoji) {
      this.scene.tweens.add({ targets: ws.moodEmoji, alpha: 0, duration: 200, ease: 'Sine.easeOut' })
    }
    if (ws.moodBadge) {
      this.scene.tweens.add({ targets: ws.moodBadge, alpha: 0, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => { ws.moodBadge?.setVisible(false) },
      })
    }

    // Chair swivel on mode change
    if (ws.chairSprite?.visible) {
      const swivelAngle = (Math.random() - 0.5) * 8
      this.scene.tweens.add({
        targets: ws.chairSprite,
        angle: swivelAngle,
        duration: 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
      })
    }

    const gdsLock = this.host.getOrAssignGdsDeskSlot != null

    ws.sprite.y = WS_SPRITE_Y
    ws.sprite.x = 0
    ws.sprite.setScale(CHAR_SCALE)
    if (!gdsLock) ws.sprite.setAngle(0)

    this.updateMonitorGlow(ws, isWorking, isWaiting)

    // ── Delegate to the active state's enter() ──
    const state = this.getStateHandler(mode)
    state.enter(ws, agent, prevMode, blendSM, agentId)
  }

  /** Map a mode name to its state handler instance. */
  private getStateHandler(mode: 'idle' | 'working' | 'waiting'): AnimationState {
    switch (mode) {
      case 'waiting': return this.waitingState
      case 'working': return this.workingState
      case 'idle':    return this.idleState
    }
  }

  // ---------------------------------------------------------------------------
  // Walk break — public API delegates to IdleState
  // ---------------------------------------------------------------------------

  triggerWalkBreak(agentId: string): boolean {
    for (const room of this.host.getRooms().values()) {
      const ws = room.workstations.get(agentId)
      if (!ws?.state || ws.tweenBag.has('walkBreak')) continue
      this.idleState.executeWalkBreak(ws, ws.state)
      return true
    }
    return false
  }

  // ---------------------------------------------------------------------------
  // Quest star difficulty-proportional styling
  // ---------------------------------------------------------------------------

  private _applyQuestStarStyle(ws: WorkstationSprite, difficulty: QuestDifficulty): void {
    const icon = ws.questIcon
    if (!icon) return

    const targetAlpha = difficulty === 'hard' ? 0.95 : 1.0
    const bobDuration =
      difficulty === 'legendary' ? 500
        : difficulty === 'epic' ? 700
          : difficulty === 'hard' ? 900
            : 1200

    this.scene.tweens.add({
      targets: icon, alpha: difficulty === 'trivial' || difficulty === 'normal' ? 0.9 : targetAlpha,
      duration: 300, ease: 'Back.easeOut',
    })

    ws.questIconTween = ws.tweenBag.add('questIcon', this.scene.tweens.add({
      targets: icon, y: icon.y - 2,
      duration: bobDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }))

    if (difficulty === 'hard' || difficulty === 'epic' || difficulty === 'legendary') {
      const pulseScale = difficulty === 'legendary' ? 0.12 : difficulty === 'epic' ? 0.08 : 0.04
      const pulseDuration = difficulty === 'legendary' ? 600 : difficulty === 'epic' ? 900 : 1600

      ws.questIconPulseTween = ws.tweenBag.add('questIconPulse', this.scene.tweens.add({
        targets: icon,
        scaleX: icon.scaleX + pulseScale,
        scaleY: icon.scaleY + pulseScale,
        duration: pulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }))
    }

    if (difficulty === 'epic') {
      icon.setTint(0xf59e0b)
    } else if (difficulty === 'legendary') {
      icon.setTint(0xef4444)
      this.scene.tweens.add({
        targets: icon,
        alpha: { from: 1.0, to: 0.8 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // ---------------------------------------------------------------------------
  // updateMonitorGlow
  // ---------------------------------------------------------------------------

  updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void {
    if (!ws.monitorGlowFx) return
    const isActive = isWorking || isWaiting
    const orchStage = ws.state?.isOrchestratorTask ? (ws.state.taskStage ?? 'executing') : null
    const orchColors: Record<string, number> = { planning: activeTheme.thoughtPlan, executing: activeTheme.stageExecuting, validating: activeTheme.stageValidating }
    const baseColor = orchStage ? (orchColors[orchStage] ?? activeTheme.stageExecuting)
      : isWaiting ? activeTheme.statusWaiting : isWorking ? activeTheme.monitorGlowActive : activeTheme.deskBody
    const baseStrength = isActive ? AnimConfig.monitor.activeBaseStrength : AnimConfig.monitor.idleBaseStrength
    const peakStrength = isActive ? AnimConfig.monitor.activePeakStrength : AnimConfig.monitor.idlePeakStrength
    const duration     = isActive ? AnimConfig.monitor.activePulseDuration : AnimConfig.monitor.idlePulseDuration
    ws.monitorGlowFx.color = baseColor
    ws.monitorGlowFx.outerStrength = baseStrength
    ws.monitorGlowTween = ws.tweenBag.add('monitorGlow', this.scene.tweens.add({
      targets: ws.monitorGlowFx, outerStrength: peakStrength,
      duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }))
  }

  // ---------------------------------------------------------------------------
  // updateBlockedIndicator
  // ---------------------------------------------------------------------------

  updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void {
    if (ws.blockedIndicatorTween) {
      ws.blockedIndicatorTween.destroy()
      ws.blockedIndicatorTween = undefined
    }

    if (ws.phoneLightTween) {
      ws.phoneLightTween.destroy()
      ws.phoneLightTween = undefined
    }
    if (ws.phoneLight) {
      ws.phoneLight.setAlpha(0)
    }

    if (!agent.needsInteraction) {
      ws.blockedIndicator.setVisible(false)
      ws.blockedIndicator.setAlpha(1)
      ws.blockedIndicator.setScale(1)
      return
    }

    let color = COLOR_LED_AMBER
    let glyph = '!'
    let badgeFrame: number = ICON_FRAMES.CIRCLE_YELLOW
    if (agent.interactionType === 'question') {
      color = 0x60a5fa
      glyph = '?'
      badgeFrame = ICON_FRAMES.CIRCLE_BLUE
    } else if (agent.interactionType === 'accept-edits') {
      color = 0x3b82f6
      glyph = '~'
      badgeFrame = ICON_FRAMES.CIRCLE_BLUE
    } else if (agent.interactionType === 'tool-approval') {
      color = activeTheme.stageExecuting
      glyph = '!'
      badgeFrame = ICON_FRAMES.CIRCLE_RED
    }

    ws.blockedIndicatorBadge.setFrame(badgeFrame)
    ws.blockedIndicatorPulse.setFillStyle(color, 0.16)
    ws.blockedIndicatorStem.setFillStyle(color, 0.55)
    ws.blockedIndicatorText.setText(glyph)
    ws.blockedIndicator.setVisible(true)

    ws.blockedIndicatorTween = this.scene.tweens.add({
      targets: ws.blockedIndicator,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.78,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (ws.phoneLight) {
      ws.phoneLight.setFillStyle(color, 1)
      ws.phoneLight.setAlpha(0)
      ws.phoneLightTween = this.scene.tweens.add({
        targets: ws.phoneLight,
        alpha: { from: 0, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Mood indicator
  // ---------------------------------------------------------------------------

  getAgentMood(agent: AgentState): { emoji: string; color: string } {
    if (agent.needsInteraction && agent.interactionType === 'tool-approval') {
      return { emoji: '😤', color: '#f97316' }
    }
    if (agent.needsInteraction && agent.interactionType === 'question') {
      return { emoji: '🤔', color: '#60a5fa' }
    }
    if (agent.sessionMode === 'working') {
      return { emoji: '💻', color: '#34d399' }
    }
    if (agent.sessionMode === 'plan') {
      return { emoji: '🧠', color: '#a78bfa' }
    }
    if (agent.sessionMode === 'compressing') {
      return { emoji: '😵', color: '#f87171' }
    }
    return { emoji: '☕', color: '#5a6a7a' }
  }

  updateMood(ws: WorkstationSprite, agent: AgentState): void {
    if (!ws.moodEmoji) return
    const { emoji } = this.getAgentMood(agent)
    const currentEmoji = ws.moodEmoji.getData('currentEmoji') as string | undefined

    if (currentEmoji === emoji) return

    ws.tweenBag.kill('mood')

    const moodText = ws.moodEmoji
    moodText.setData('currentEmoji', emoji)

    const moodKey = this.deriveMoodKey(agent)
    const badgeFrame = MOOD_CONFIGS[moodKey].spriteFrame

    this.scene.tweens.add({
      targets: moodText,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!moodText.active) return
        moodText.setText(emoji)
        moodText.setScale(0)
        this.scene.tweens.add({
          targets: moodText,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 1,
          duration: 180,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!moodText.active) return
            this.scene.tweens.add({
              targets: moodText,
              scaleX: 1,
              scaleY: 1,
              duration: 120,
              ease: 'Sine.easeOut',
              onComplete: () => {
                if (!moodText.active) return
                const baseY = moodText.y
                ws.moodTween = ws.tweenBag.add('mood', this.scene.tweens.add({
                  targets: moodText,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                }))
              },
            })
          },
        })
      },
    })

    this.updateMoodBadge(ws, badgeFrame)
    this.updatePetMouth(ws, moodKey)
  }

  private updatePetMouth(ws: WorkstationSprite, mood: Mood): void {
    if (ws.animalSpecies && ws.deskPet?.active) {
      if (mood === 'frustrated') {
        const idleKey = `animal-idle-${ws.animalSpecies}`
        const baseX = ws.deskPet.x
        this.scene.tweens.add({
          targets: ws.deskPet,
          x: baseX + 2, duration: 50, yoyo: true, repeat: 3,
          onComplete: () => {
            if (ws.deskPet?.active) {
              ws.deskPet.x = baseX
              if (this.scene.anims.exists(idleKey)) ws.deskPet.play(idleKey)
            }
          },
        })
        ws.deskPet.setTint(0xff6666)
        this.scene.time.delayedCall(400, () => {
          if (ws.deskPet?.active) ws.deskPet.clearTint()
        })
      }
      return
    }

    if (!ws.petMouth || !ws.petMouth.active) return

    let mouthFrame: number
    switch (mood) {
      case 'frustrated':
        mouthFrame = PET_FACE_FRAMES.MOUTH_GRIN
        break
      case 'happy':
      case 'celebrating':
      case 'caffeinated':
        mouthFrame = PET_FACE_FRAMES.MOUTH_HAPPY
        break
      case 'tired':
        mouthFrame = PET_FACE_FRAMES.MOUTH_FLAT
        break
      case 'focused':
        mouthFrame = PET_FACE_FRAMES.MOUTH_O
        break
      default:
        mouthFrame = PET_FACE_FRAMES.MOUTH_HAPPY
        break
    }

    ws.petMouth.setFrame(mouthFrame)
  }

  private deriveMoodKey(agent: AgentState): Mood {
    if (agent.needsInteraction && agent.interactionType === 'tool-approval') return 'frustrated'
    if (agent.needsInteraction && agent.interactionType === 'question') return 'zen'
    if (agent.sessionMode === 'working') return 'focused'
    if (agent.sessionMode === 'plan') return 'focused'
    if (agent.sessionMode === 'compressing') return 'tired'
    return 'idle'
  }

  private updateMoodBadge(ws: WorkstationSprite, frame: number): void {
    if (!ws.moodBadge) return

    const badge = ws.moodBadge
    const currentFrame = badge.getData('currentFrame') as number | undefined
    if (currentFrame === frame) return
    badge.setData('currentFrame', frame)

    ws.tweenBag.kill('moodBadge')

    this.scene.tweens.add({
      targets: badge,
      alpha: 0,
      duration: 150,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!badge.active) return
        badge.setFrame(frame).setVisible(true).setScale(0)
        this.scene.tweens.add({
          targets: badge,
          scaleX: 0.28,
          scaleY: 0.28,
          alpha: 0.9,
          duration: 200,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!badge.active) return
            this.scene.tweens.add({
              targets: badge,
              scaleX: 0.22,
              scaleY: 0.22,
              duration: 120,
              ease: 'Sine.easeOut',
              onComplete: () => {
                if (!badge.active) return
                const baseY = badge.y
                ws.moodBadgeTween = ws.tweenBag.add('moodBadge', this.scene.tweens.add({
                  targets: badge,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                }))
              },
            })
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Speech bubble — small blurb above workstation during working mode
  // ---------------------------------------------------------------------------

  private _showSpeechBubble(ws: WorkstationSprite, agent: AgentState): void {
    const blurb = agent.isOrchestratorTask
      ? (agent.taskTitle ? `[Task] ${agent.taskTitle}` : '').trim()
      : (agent.lastAssistantBlurb ?? '').trim()
    if (!blurb) return

    ws.tweenBag.kill('speechBubble')
    ws.tweenBag.kill('speechBubbleTimer')

    const BUBBLE_Y = WS_SPRITE_Y - 40
    const MAX_CHARS = 40
    const PAD_X = 6
    const PAD_Y = 4

    if (!ws.speechBubble) {
      const bg = this.scene.add.graphics()
      const txt = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: scaledFontSize(8),
        color: activeTheme.headerText,
        resolution: 2,
      }).setOrigin(0.5)

      const container = this.scene.add.container(0, BUBBLE_Y, [bg, txt])
        .setAlpha(0).setVisible(false)
      ws.container.add(container)

      ws.speechBubble = container
      ws.speechBubbleText = txt
      ws.speechBubbleBg = bg

      ws.lodLevel3Objects.push(container)
    }

    const displayText = blurb.length > MAX_CHARS ? blurb.slice(0, MAX_CHARS) + '...' : blurb

    const drawBg = () => {
      const g = ws.speechBubbleBg!
      const t = ws.speechBubbleText!
      const bw = t.width + PAD_X * 2
      const bh = t.height + PAD_Y * 2
      g.clear()
      g.fillStyle(activeTheme.panelBg, 0.9)
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 3)
      g.lineStyle(0.5, activeTheme.panelStroke, 0.6)
      g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 3)
    }

    const sceneAlive = () => {
      try {
        return this.scene.scene.isActive() === true
      } catch {
        return false
      }
    }

    const typewriterCycle = (text: string) => {
      const bubble = ws.speechBubble!
      const txt = ws.speechBubbleText!
      if (!txt.active || !bubble.active || !sceneAlive()) return

      txt.setText('\u200b')
      drawBg()
      bubble.setVisible(true)
      bubble.y = BUBBLE_Y

      ws.tweenBag.kill('speechBubble')
      this.scene.tweens.add({ targets: bubble, alpha: 1, duration: 200, ease: 'Sine.easeOut' })

      const counter = { val: 0 }
      ws.speechBubbleTween = ws.tweenBag.add('speechBubble', this.scene.tweens.add({
        targets: counter,
        val: text.length,
        duration: Math.min(600, text.length * 20),
        ease: 'Linear',
        onUpdate: () => {
          if (!txt.active || !bubble.active || !sceneAlive()) return
          const slice = text.slice(0, Math.floor(counter.val))
          txt.setText(slice.length === 0 ? '\u200b' : slice)
          drawBg()
        },
        onComplete: () => {
          if (!txt.active || !bubble.active || !sceneAlive()) return
          txt.setText(text)
          drawBg()
          this.scene.time.delayedCall(4000, () => {
            if (!bubble.active || !sceneAlive()) return
            this.scene.tweens.add({
              targets: bubble, alpha: 0,
              duration: 300, ease: 'Sine.easeOut',
              onComplete: () => { if (bubble.active) bubble.setVisible(false) },
            })
          })
        },
      }))
    }

    typewriterCycle(displayText)

    ws.speechBubbleTimer = ws.tweenBag.add('speechBubbleTimer', this.scene.time.addEvent({
      delay: 8000 + Math.random() * 4000,
      loop: true,
      callback: () => {
        if (!sceneAlive()) return
        if (ws.lastAnimMode !== 'working') return
        if (!ws.speechBubbleText?.active || !ws.speechBubble?.active) return
        const currentBlurb = ws.state?.isOrchestratorTask
          ? (ws.state.taskTitle ? `[Task] ${ws.state.taskTitle}` : '').trim()
          : (ws.state?.lastAssistantBlurb ?? '').trim()
        if (!currentBlurb) return
        const truncated = currentBlurb.length > MAX_CHARS ? currentBlurb.slice(0, MAX_CHARS) + '...' : currentBlurb
        typewriterCycle(truncated)
      },
    }))
  }

  // ---------------------------------------------------------------------------
  // Thought bubble
  // ---------------------------------------------------------------------------

  drawThoughtBubbleBg(ws: WorkstationSprite, accentColor: number): void {
    const PAD_X = 8
    const PAD_Y = 5
    const ACCENT_W = 3
    const CORNER = 5

    const tw = ws.thoughtBubbleText.width
    const th = ws.thoughtBubbleText.height
    const bw = tw + PAD_X * 2 + ACCENT_W
    const bh = th + PAD_Y * 2

    ws.thoughtBubbleText.setPosition(ACCENT_W / 2 + PAD_X / 2, 0)

    if (ws.thoughtBubbleBgSprite) {
      ws.thoughtBubbleBgSprite.setDisplaySize(bw, bh)
      ws.thoughtBubbleBgSprite.setTint(activeTheme.bg)
    }

    const g = ws.thoughtBubbleBg
    g.clear()

    if (!ws.thoughtBubbleBgSprite) {
      g.fillStyle(activeTheme.bg, 0.92)
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, CORNER)
    }

    g.fillStyle(accentColor, 0.9)
    g.fillRoundedRect(-bw / 2, -bh / 2, ACCENT_W, bh, CORNER)
    if (ws.thoughtBubbleBgSprite) g.setVisible(true)

    const tailW = 6
    const tailH = 6
    const tailY = bh / 2
    g.fillStyle(activeTheme.bg, 0.92)
    g.fillTriangle(-tailW / 2, tailY, tailW / 2, tailY, 0, tailY + tailH)
  }

  updateThoughtBubble(
    ws: WorkstationSprite,
    agent: AgentState,
    shouldShow: boolean,
    accentColor: number,
    isWorking: boolean,
  ): void {
    if (!shouldShow) {
      this.scene.tweens.killTweensOf(ws.thoughtBubble)
      ws.thoughtBubble.setVisible(false)
      return
    }

    const rawBlurb = (agent.lastAssistantBlurb ?? '').trim()
    const MAX_CHARS = 60
    let displayText: string

    if (rawBlurb) {
      displayText = rawBlurb.length > MAX_CHARS ? rawBlurb.slice(0, MAX_CHARS) + '...' : rawBlurb
    } else if (agent.sessionMode === 'compressing') {
      displayText = 'compressing...'
    } else if (agent.sessionMode === 'plan') {
      displayText = 'planning...'
    } else if (agent.needsInteraction) {
      displayText = 'waiting for input'
    } else if (agent.sessionMode === 'working' || !agent.sessionMode) {
      displayText = 'working...'
    } else {
      displayText = '\u2615 idle'
    }

    const blurbChanged = ws.lastShownBlurb !== displayText
    ws.lastShownBlurb = displayText

    if (ws.blurbFadeTimer) {
      ws.blurbFadeTimer.destroy()
      ws.blurbFadeTimer = undefined
    }

    ws.thoughtBubble.setVisible(true)
    this.scene.tweens.killTweensOf(ws.thoughtBubble)
    ws.thoughtBubble.setAlpha(1)

    const baseY = WS_SPRITE_Y - 62

    if (blurbChanged && rawBlurb) {
      if (ws.blurbTypingTween) {
        ws.blurbTypingTween.destroy()
        ws.blurbTypingTween = undefined
      }
      ws.thoughtBubbleText.setText('')
      ws.thoughtBubble.y = baseY
      this.drawThoughtBubbleBg(ws, accentColor)

      const counter = { val: 0 }
      ws.blurbTypingTween = this.scene.tweens.add({
        targets: counter,
        val: displayText.length,
        duration: Math.min(500, displayText.length * 18),
        ease: 'Linear',
        onUpdate: () => {
          ws.thoughtBubbleText.setText(displayText.slice(0, Math.floor(counter.val)))
          this.drawThoughtBubbleBg(ws, accentColor)
        },
        onComplete: () => {
          ws.thoughtBubbleText.setText(displayText)
          this.drawThoughtBubbleBg(ws, accentColor)
          ws.blurbTypingTween = undefined
        },
      })
    } else {
      ws.thoughtBubbleText.setText(displayText)
      this.drawThoughtBubbleBg(ws, accentColor)
      ws.thoughtBubble.y = baseY
    }

    if (ws.thoughtBubbleFloatTween) {
      ws.thoughtBubbleFloatTween.destroy()
    }
    ws.thoughtBubbleFloatTween = this.scene.tweens.add({
      targets: ws.thoughtBubble,
      y: baseY - 3,
      duration: isWorking ? 1200 : 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (rawBlurb) {
      ws.blurbFadeTimer = this.scene.time.delayedCall(5000, () => {
        if (!ws.thoughtBubble.active) return
        this.scene.tweens.add({
          targets: ws.thoughtBubble,
          alpha: 0,
          duration: 300,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (ws.thoughtBubble.active) ws.thoughtBubble.setVisible(false)
          },
        })
        ws.blurbFadeTimer = undefined
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Thinking dots — best-of-N reasoning animation
  // ---------------------------------------------------------------------------

  showThinkingDots(ws: WorkstationSprite, candidateCount: number): void {
    if (candidateCount < 2) return
    if (ws.thinkingDotsContainer) {
      if (ws.thinkingCandidateCount === candidateCount) return
      this.hideThinkingDots(ws)
    }

    const container = this.scene.add.container(0, THINKING_DOT_Y)
    const dots: Phaser.GameObjects.Arc[] = []

    const totalWidth = (candidateCount - 1) * THINKING_DOT_SPACING
    const startX = -totalWidth / 2

    for (let i = 0; i < candidateCount; i++) {
      const dot = this.scene.add.circle(
        startX + i * THINKING_DOT_SPACING, 0,
        THINKING_DOT_RADIUS, activeTheme.monitorGlowActive, 0,
      )
      dot.setAlpha(0)
      container.add(dot)
      dots.push(dot)
    }

    ws.container.add(container)
    ws.thinkingDotsContainer = container
    ws.thinkingDots = dots
    ws.thinkingCandidateCount = candidateCount

    ws.lodLevel3Objects.push(container)

    this.startThinkingTimeline(ws)
  }

  private startThinkingTimeline(ws: WorkstationSprite): void {
    const dots = ws.thinkingDots
    if (!dots || dots.length === 0) return

    const stepMs = THINKING_DOT_APPEAR_MS
    const holdMs = THINKING_DOT_HOLD_MS
    const totalAppear = dots.length * stepMs
    const cycleDuration = totalAppear + holdMs + THINKING_DOT_FADE_MS

    const proxy = { progress: 0 }
    ws.thinkingDotsTween = this.scene.tweens.add({
      targets: proxy,
      progress: 1,
      duration: cycleDuration,
      repeat: -1,
      onUpdate: () => {
        const elapsed = proxy.progress * cycleDuration
        for (let i = 0; i < dots.length; i++) {
          const dotStart = i * stepMs
          if (elapsed < dotStart) {
            dots[i].setAlpha(0)
          } else if (elapsed < dotStart + stepMs) {
            dots[i].setAlpha((elapsed - dotStart) / stepMs)
            dots[i].setFillStyle(activeTheme.monitorGlowActive, dots[i].alpha)
          } else if (elapsed < totalAppear + holdMs) {
            dots[i].setAlpha(1)
            dots[i].setFillStyle(activeTheme.monitorGlowActive, 1)
          } else {
            const fadeElapsed = elapsed - (totalAppear + holdMs)
            const alpha = Math.max(0, 1 - fadeElapsed / THINKING_DOT_FADE_MS)
            dots[i].setAlpha(alpha)
            dots[i].setFillStyle(activeTheme.monitorGlowActive, alpha)
          }
        }
      },
    })
  }

  playThinkingMerge(ws: WorkstationSprite): void {
    const dots = ws.thinkingDots
    if (!dots || dots.length === 0) {
      this.hideThinkingDots(ws)
      return
    }

    if (ws.thinkingDotsTween) {
      ws.thinkingDotsTween.destroy()
      ws.thinkingDotsTween = undefined
    }

    for (const dot of dots) {
      dot.setAlpha(1)
      dot.setFillStyle(activeTheme.monitorGlowActive, 1)
    }

    const mergeTargets = dots.map(d => ({ ref: d }))
    let completedCount = 0
    for (const mt of mergeTargets) {
      this.scene.tweens.add({
        targets: mt.ref,
        x: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          completedCount++
          if (completedCount !== mergeTargets.length) return
          for (let i = 1; i < dots.length; i++) {
            this.scene.tweens.killTweensOf(dots[i])
            dots[i].setVisible(false)
          }
          const centerDot = dots[0]
          centerDot.setFillStyle(0xffffff, 1).setAlpha(1)
          ws.thinkingMergeTween = this.scene.tweens.add({
            targets: centerDot,
            scaleX: { from: 1, to: 1.8 },
            scaleY: { from: 1, to: 1.8 },
            duration: 300,
            yoyo: true,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: centerDot,
                alpha: 0,
                duration: 300,
                ease: 'Sine.easeOut',
                onComplete: () => this.hideThinkingDots(ws),
              })
            },
          })
        },
      })
    }
  }

  hideThinkingDots(ws: WorkstationSprite): void {
    if (ws.thinkingDotsTween) {
      ws.thinkingDotsTween.destroy()
      ws.thinkingDotsTween = undefined
    }
    if (ws.thinkingMergeTween) {
      ws.thinkingMergeTween.destroy()
      ws.thinkingMergeTween = undefined
    }
    if (ws.thinkingDots?.length) {
      for (const dot of ws.thinkingDots) {
        if (dot?.active) this.scene.tweens.killTweensOf(dot)
      }
    }
    if (ws.thinkingDotsContainer) {
      this.scene.tweens.killTweensOf(ws.thinkingDotsContainer)
      const idx = ws.lodLevel3Objects.indexOf(ws.thinkingDotsContainer)
      if (idx >= 0) ws.lodLevel3Objects.splice(idx, 1)
      ws.thinkingDotsContainer.destroy()
      ws.thinkingDotsContainer = undefined
    }
    ws.thinkingDots = undefined
    ws.thinkingCandidateCount = undefined
  }

  // ---------------------------------------------------------------------------
  // Quality streak flame effect
  // ---------------------------------------------------------------------------

  private qualityStreakForFlame(agentId: string, xpStreak: number): number {
    const harness = this.evalStreakCache.get(agentId)
    if (harness === undefined) return xpStreak
    return Math.max(xpStreak, harness)
  }

  private getFlameTier(streak: number): 'small' | 'medium' | 'large' {
    if (streak >= 15) return 'large'
    if (streak >= 10) return 'medium'
    return 'small'
  }

  private getFlameParticlesPerTick(streak: number): number {
    const totalParticleCount = Math.min(30, Math.max(0, streak * 2))
    const perSecond = Math.max(1, Math.ceil(totalParticleCount / 3))
    return Math.max(1, Math.ceil(perSecond / 8))
  }

  startStreakFlame(ws: WorkstationSprite, streak: number, room: Room): void {
    if (ws.lastFlameStreak === streak && ws.flameTimer) return
    this.stopStreakFlame(ws, false)

    ws.lastFlameStreak = streak
    if (!ws.flameContainer) return
    if ((ws.currentLodLevel ?? 3) < 3) return
    ws.flameContainer.setVisible(true)

    const tier = this.getFlameTier(streak)
    const spawnPerTick = this.getFlameParticlesPerTick(streak)
    const spawnChance = tier === 'large' ? 0.95 : tier === 'medium' ? 0.8 : 0.65

    ws.flameTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!ws.flameContainer?.visible || (ws.currentLodLevel ?? 3) < 3) return
        const worldX = room.x + ws.container.x
        const worldY = room.y + ws.container.y + WS_DESK_Y - 4
        for (let i = 0; i < spawnPerTick; i++) {
          if (Math.random() < spawnChance) {
            this.host.spawnFlameParticle(worldX, worldY, streak)
          }
        }
      },
    })
  }

  stopStreakFlame(ws: WorkstationSprite, withSmoke: boolean): void {
    if (ws.flameTimer) { ws.flameTimer.destroy(); ws.flameTimer = undefined }
    if (ws.flameTweens) {
      for (const t of ws.flameTweens) { if (t.isPlaying()) t.stop(); t.destroy() }
      ws.flameTweens = []
    }
    if (ws.flameContainer) {
      ws.flameContainer.removeAll(true)
      ws.flameContainer.setVisible(false)
    }

    if (withSmoke && ws.container?.active) {
      if (this.scene.anims.exists(EFFECT_ANIM_KEYS.SMOKE)) {
        const smoke = this.scene.add.sprite(0, WS_DESK_Y - 8, SPRITESHEET_KEYS.EFFECTS_SMOKE)
          .setDepth(600).setScale(0.14).setAlpha(0.5)
        ws.container.add(smoke)
        smoke.play(EFFECT_ANIM_KEYS.SMOKE)
        smoke.once('animationcomplete', () => smoke.destroy())
      }
    }

    ws.lastFlameStreak = undefined
  }

  updateStreakFlame(ws: WorkstationSprite, agent: AgentState): void {
    const agentId = agent.config.id
    const xpStreak = agent.xp?.currentStreak ?? 0
    const streak = this.qualityStreakForFlame(agentId, xpStreak)
    const prevStreak = ws.lastFlameStreak ?? 0
    const isDetailLod = (ws.currentLodLevel ?? this.host.getLastLodLevel()) >= 3

    let ownerRoom: Room | undefined
    for (const room of this.host.getRooms().values()) {
      if (room.workstations.has(agentId)) {
        ownerRoom = room
        break
      }
    }
    if (!ownerRoom) return

    if (!isDetailLod) {
      if (ws.flameTimer || ws.flameContainer?.visible) this.stopStreakFlame(ws, false)
      ws.lastFlameStreak = streak >= 5 ? streak : undefined
      return
    }

    if (streak >= 5) {
      this.startStreakFlame(ws, streak, ownerRoom)
    } else if (prevStreak >= 5 && streak < 5) {
      this.stopStreakFlame(ws, true)
    }
  }

  // ---------------------------------------------------------------------------
  // Sleep / Wake lifecycle
  // ---------------------------------------------------------------------------

  pauseAll(): void {
    for (const room of this.host.getRooms().values()) {
      for (const ws of room.workstations.values()) {
        ws.tweenBag.setTimerPaused('lookAround',    true)
        ws.tweenBag.setTimerPaused('stretch',        true)
        ws.tweenBag.setTimerPaused('walkBreakTimer', true)
        ws.tweenBag.setTimerPaused('lookAtNeighbor', true)
        ws.tweenBag.setTimerPaused('yawn',           true)
        ws.tweenBag.setTimerPaused('lampFlicker',    true)
        ws.tweenBag.setTimerPaused('typingNote',     true)
        ws.tweenBag.setTimerPaused('speechBubbleTimer', true)
        if (ws.flameTimer)     ws.flameTimer.paused     = true
        if (ws.blurbFadeTimer) ws.blurbFadeTimer.paused = true
        ws.tweenBag.get('walkBreak')?.pause()
      }
    }
  }

  resumeAll(): void {
    for (const room of this.host.getRooms().values()) {
      for (const ws of room.workstations.values()) {
        ws.tweenBag.setTimerPaused('lookAround',    false)
        ws.tweenBag.setTimerPaused('stretch',        false)
        ws.tweenBag.setTimerPaused('walkBreakTimer', false)
        ws.tweenBag.setTimerPaused('lookAtNeighbor', false)
        ws.tweenBag.setTimerPaused('yawn',           false)
        ws.tweenBag.setTimerPaused('lampFlicker',    false)
        ws.tweenBag.setTimerPaused('typingNote',     false)
        ws.tweenBag.setTimerPaused('speechBubbleTimer', false)
        if (ws.flameTimer)     ws.flameTimer.paused     = false
        if (ws.blurbFadeTimer) ws.blurbFadeTimer.paused = false
        ws.tweenBag.get('walkBreak')?.resume()
      }
    }
  }
}
