// ---------------------------------------------------------------------------
// workstation-animation.ts
// WorkstationAnimator — all animation, mood, monitor-glow, blocked-indicator,
// and thought-bubble logic. Extracted from office-workstation.ts.
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
  COLOR_LED_AMBER,
  LOD_L2_MAX,
  ROOM_HEADER_H,
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
import { ANIM_KEYS, DIFFICULTY_STAR_FRAME, ICON_FRAMES, EFFECT_ANIM_KEYS, SPRITESHEET_KEYS, PET_FACE_FRAMES } from './office-asset-keys'
import { getAgentCharacterIndex } from './office-helpers'
import { MOOD_CONFIGS } from './agent-mood'
import type { Mood } from './agent-mood'
import type { WorkstationHost } from './office-workstation'
import type { NavMesh } from './nav-mesh'
import { buildOwnRoomRect } from './nav-mesh'
import { PathWalker } from './path-walker'
import { soundEngine } from './sound-engine'

// ---------------------------------------------------------------------------
// Idle personality archetype system
// ---------------------------------------------------------------------------

type IdleArchetype = 'focused' | 'creative' | 'social'

/** Map agent name → idle personality archetype.
 *  Focused: deep technical work, methodical.
 *  Creative: expressive, rhythmic, playful.
 *  Social:  communicative, relaxed, people-aware. */
const PERSONA_ARCHETYPE_MAP: Readonly<Record<string, IdleArchetype>> = {
  'Sun Wukong':           'focused',   // fullstack-dev — unstoppable problem solver
  'Guanyin':              'focused',   // backend-arch  — architectural precision
  'Bull Demon King':      'focused',   // embedded-dev  — zero-waste concentration
  'Erlang Shen':          'creative',  // nextjs-frontend — surgical creative eye
  'Red Boy':              'creative',  // videogame-dev — creative fire & VFX
  'Dragon King Ao Guang': 'creative',  // ui-designer   — aesthetics-first
  'Sha Wujing':           'social',    // electron-dev  — steady executor
  'Nezha':                'social',    // expo-mobile   — fast & social
  'Tang Sanzang':         'social',    // product-mgr   — mission-driven, team-first
  'White Dragon Horse':   'social',    // product-marketer — tireless storyteller
  'Zhu Bajie':            'social',    // exec-assistant — brute-force social
}

/** Available micro-animation keys per archetype (3 each = 9 total). */
const ARCHETYPE_ANIM_POOL: Readonly<Record<IdleArchetype, string[]>> = {
  focused:  ['chin-rest', 'screen-lean', 'note-jot'],
  creative: ['creative-stretch', 'head-bob', 'doodle'],
  social:   ['phone-check', 'lean-back', 'wave'],
}

/** Module-level stagger tracker: animKey → last played timestamp (ms).
 *  Ensures no two visible agents play the same animation within 2 seconds. */
const lastMicroAnimPlayedAt = new Map<string, number>()

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
// WorkstationAnimator
// ---------------------------------------------------------------------------

export class WorkstationAnimator {
  private scene: Phaser.Scene
  private host: WorkstationHost

  /** Callback to the parent OfficeWorkstations.restoreDeskStroke.
   *  Needed because updateAnimation calls restoreDeskStroke for idle/waiting
   *  branches, but we cannot import OfficeWorkstations here. */
  private restoreDeskStrokeCallback: (ws: WorkstationSprite) => void

  /** Callback to the parent OfficeWorkstations.refreshTaskCountDisplay.
   *  Called from the working→idle transition inside updateAnimation. */
  private refreshTaskCountCallback: (ws: WorkstationSprite) => void

  /** Cached eval success rates: agentId → successRate (null = no data) */
  private evalCache = new Map<string, number | null>()
  /**
   * Cached eval harness consecutive-success streak (0+). Only agents present in
   * evalsReportAll() have an entry; missing key means harness has no row yet for
   * that agent (flame falls back to XP streak only until the next fetch).
   */
  private evalStreakCache = new Map<string, number>()
  /** Timestamp of last eval data fetch */
  private lastEvalFetchAt = 0
  /** Guard against duplicate in-flight eval fetches */
  private evalFetchPromise: Promise<void> | null = null
  /** Workstations that need a glow refresh when the current eval fetch completes */
  private pendingEvalGlowWorkstations = new Set<WorkstationSprite>()

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
  }

  // ---------------------------------------------------------------------------
  // Eval glow data fetching
  // ---------------------------------------------------------------------------

  /** Refresh eval data from main process (throttled to EVAL_GLOW_REFRESH_MS). */
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
            // Harness streak is signed (negative if latest outcomes are failures); flame uses successes only.
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

  /**
   * Apply eval glow tint from the in-memory cache only (no IPC).
   * Canonical rate: null = missing agent in report or zero tasks; number = success rate 0–1.
   */
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

  /** Queue workstation, refresh evals on cadence, apply tint (again when fetch completes). */
  updateEvalGlow(ws: WorkstationSprite): void {
    this.pendingEvalGlowWorkstations.add(ws)
    this.refreshEvalCacheIfDue()
    this.applyEvalGlowFromCache(ws)
  }

  // ---------------------------------------------------------------------------
  // updateAnimation — the main animation state machine
  // ---------------------------------------------------------------------------

  updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWaiting = agent.needsInteraction ?? false
    const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !isWaiting

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return
    const prevMode = ws.lastAnimMode
    ws.lastAnimMode = mode

    // Tear down all animation state
    if (ws.bounceTween)      { ws.bounceTween.destroy();      ws.bounceTween      = undefined }
    if (ws.dotPulseTween)    { ws.dotPulseTween.destroy();    ws.dotPulseTween    = undefined; ws.statusDot.setAlpha(1) }
    if (ws.typingTween)      { ws.typingTween.destroy();      ws.typingTween      = undefined; ws.sprite.x = 0 }
    if (ws.monitorGlowTween) { ws.monitorGlowTween.destroy(); ws.monitorGlowTween = undefined }
    if (ws.breathTween)      { ws.breathTween.destroy();      ws.breathTween      = undefined }
    if (ws.headTiltTween)    { ws.headTiltTween.destroy();    ws.headTiltTween    = undefined }
    if (ws.pulseTween)       { ws.pulseTween.destroy();       ws.pulseTween       = undefined }
    if (ws.ledPulseTween)    { ws.ledPulseTween.destroy();    ws.ledPulseTween    = undefined }
    if (ws.kbGlowTween)     { ws.kbGlowTween.destroy();     ws.kbGlowTween     = undefined }
    if (ws.lampLightTween)   { ws.lampLightTween.destroy();   ws.lampLightTween   = undefined }
    if (ws.lampFlickerTimer) { ws.lampFlickerTimer.destroy();  ws.lampFlickerTimer = undefined }
    if (ws.walkBreakTween)   { ws.walkBreakTween.destroy();   ws.walkBreakTween   = undefined }
    if (ws.lookAroundTimer)     { ws.lookAroundTimer.destroy();     ws.lookAroundTimer     = undefined }
    if (ws.stretchTimer)        { ws.stretchTimer.destroy();        ws.stretchTimer        = undefined }
    if (ws.walkBreakTimer)      { ws.walkBreakTimer.destroy();      ws.walkBreakTimer      = undefined }
    if (ws.lookAtNeighborTimer) { ws.lookAtNeighborTimer.destroy(); ws.lookAtNeighborTimer = undefined }
    if (ws.yawnTimer)           { ws.yawnTimer.destroy();           ws.yawnTimer           = undefined }
    if (ws.microAnimTimer)      { ws.microAnimTimer.destroy();      ws.microAnimTimer      = undefined }
    // Clear ambient sound-wave indicator on every mode transition; working branch re-draws it
    if (ws.soundWaveTween) { ws.soundWaveTween.destroy(); ws.soundWaveTween = undefined }
    if (ws.soundWaveGfx)   { ws.soundWaveGfx.clear(); ws.soundWaveGfx.setAlpha(1) }
    // Clear sound wave speaker sprite
    if (ws.soundWaveSpeaker) { ws.soundWaveSpeaker.destroy(); ws.soundWaveSpeaker = undefined }
    // Clear chair rocking tween
    if (ws.chairRockTween) { ws.chairRockTween.destroy(); ws.chairRockTween = undefined }
    if (ws.chairSprite) ws.chairSprite.setAngle(0)
    // Clear typing note timer
    if (ws.typingNoteTimer) { ws.typingNoteTimer.destroy(); ws.typingNoteTimer = undefined }
    // Clear speech bubble
    if (ws.speechBubbleTween) { ws.speechBubbleTween.destroy(); ws.speechBubbleTween = undefined }
    if (ws.speechBubbleTimer) { ws.speechBubbleTimer.destroy(); ws.speechBubbleTimer = undefined }
    if (ws.speechBubble) { ws.speechBubble.setVisible(false).setAlpha(0) }
    // Fade out progress ring when leaving working mode; working branch re-starts it
    if (ws.progressRingTween) { ws.progressRingTween.destroy(); ws.progressRingTween = undefined }
    if (ws.progressRing && ws.progressRing.alpha > 0) {
      this.scene.tweens.add({ targets: ws.progressRing, alpha: 0, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => { ws.progressRing?.clear() },
      })
    }
    ws.workStartTime = undefined
    // Hide quest icon on mode transition
    if (ws.questIconTween) { ws.questIconTween.destroy(); ws.questIconTween = undefined }
    if (ws.questIconPulseTween) { ws.questIconPulseTween.destroy(); ws.questIconPulseTween = undefined }
    if (ws.questIcon && ws.questIcon.alpha > 0) {
      this.scene.tweens.add({ targets: ws.questIcon, alpha: 0, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => { ws.questIcon?.setVisible(false) },
      })
    }
    // Always stop steam when transitioning; idle branch will re-spawn it
    this.host.clearSteamParticles(ws)
    // Clean up thinking dots when leaving working mode
    if (mode !== 'working' && ws.thinkingDotsContainer) {
      this.hideThinkingDots(ws)
    }

    // Fade out mood emoji and badge on mode transition; updateMood will fade the new ones in
    if (ws.moodTween) { ws.moodTween.destroy(); ws.moodTween = undefined }
    if (ws.moodBadgeTween) { ws.moodBadgeTween.destroy(); ws.moodBadgeTween = undefined }
    if (ws.moodEmoji) {
      this.scene.tweens.add({ targets: ws.moodEmoji, alpha: 0, duration: 200, ease: 'Sine.easeOut' })
    }
    if (ws.moodBadge) {
      this.scene.tweens.add({ targets: ws.moodBadge, alpha: 0, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => { ws.moodBadge?.setVisible(false) },
      })
    }

    // ── Crossfade transition blending (Living Lab 1a) ──
    this._playTransitionBlend(ws, prevMode, mode)

    // Chair swivel on mode change — quick turn as if the agent is shifting in their seat
    if (ws.chairSprite?.visible) {
      const swivelAngle = (Math.random() - 0.5) * 8 // -4 to +4 degrees
      this.scene.tweens.add({
        targets: ws.chairSprite,
        angle: swivelAngle,
        duration: 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
      })
    }

    // GDS mode: sprite angle/frame are locked to stool rotation
    const gdsLock = this.host.getOrAssignGdsDeskSlot != null

    ws.sprite.y = WS_SPRITE_Y
    ws.sprite.x = 0
    ws.sprite.setScale(CHAR_SCALE)
    if (!gdsLock) ws.sprite.setAngle(0)

    this.updateMonitorGlow(ws, isWorking, isWaiting)

    const charIdx = this.host.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    if (isWaiting) {
      // Agent went from working → blocked/waiting: play task-fail sound
      if (prevMode === 'working') {
        soundEngine.taskFail()
      }
      if (!gdsLock) ws.sprite.setFrame(base + POSE_IDLE)
      ws.pulseTween = this.scene.tweens.add({
        targets: ws.sprite, scaleX: CHAR_SCALE * AnimConfig.waiting.pulseScaleFactor, scaleY: CHAR_SCALE * AnimConfig.waiting.pulseScaleFactor,
        duration: AnimConfig.waiting.pulseDuration, yoyo: true, repeat: -1, ease: AnimConfig.easing.scalePop,
      })
      ws.typingTween = this.scene.tweens.add({
        targets: ws.sprite, x: AnimConfig.waiting.swayAmplitude,
        duration: AnimConfig.waiting.swayDuration, yoyo: true, repeat: -1, ease: AnimConfig.easing.waitingSway,
      })
      ws.dotPulseTween = this.scene.tweens.add({
        targets: ws.statusDot, alpha: AnimConfig.waiting.dotPulseAlphaMin,
        duration: AnimConfig.waiting.dotPulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // Irregular breathing — Y-offset only (pulseTween handles scale); re-schedules itself each cycle
      const waitBreath = () => {
        if (!ws.sprite.active || ws.lastAnimMode !== 'waiting') return
        const dur = AnimConfig.waiting.breathDuration + Math.random() * AnimConfig.waiting.breathDurationVar
        ws.breathTween = this.scene.tweens.add({
          targets: ws.sprite,
          y: WS_SPRITE_Y - AnimConfig.waiting.breathYOffset,
          duration: dur,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: waitBreath,
        })
      }
      waitBreath()
      // LED: waiting — amber steady glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeWaiting, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.5, duration: 300, ease: 'Sine.easeOut' })
      }
      // Lamp light cone: dim when waiting
      if (ws.lampLight) {
        ws.lampLightTween = this.scene.tweens.add({
          targets: ws.lampLight, alpha: AnimConfig.waiting.lampDimAlpha,
          duration: AnimConfig.waiting.ledFadeDuration, ease: 'Sine.easeOut',
        })
      }
      this.restoreDeskStrokeCallback(ws)
    } else if (isWorking) {
      if (!gdsLock) ws.sprite.setFrame(base + POSE_INTERACT)
      ws.typingTween = this.scene.tweens.add({
        targets: ws.sprite, x: AnimConfig.working.typingAmplitude,
        duration: AnimConfig.working.typingDuration, yoyo: true, repeat: -1, ease: AnimConfig.easing.workingTyping,
      })
      ws.bounceTween = this.scene.tweens.add({
        targets: ws.sprite, y: WS_SPRITE_Y - AnimConfig.working.bounceOffset,
        duration: AnimConfig.working.bounceDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.headTiltTween = this.scene.tweens.add({
        targets: ws.sprite, angle: AnimConfig.working.headTiltAngle,
        duration: AnimConfig.working.headTiltDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // Working breath — scaleY only (bounceTween owns Y); faster 2s cycle
      ws.breathTween = this.scene.tweens.add({
        targets: ws.sprite,
        scaleY: CHAR_SCALE * AnimConfig.working.breathScaleFactor,
        duration: AnimConfig.working.breathDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      if (!this.host.getOrAssignGdsDeskSlot) ws.deskBody.setStrokeStyle(1, 0x34d399, 0.55)

      // Keyboard glow — subtle blue stroke shimmer while typing
      if (ws.keyboard) {
        ws.keyboard.setStrokeStyle(0.5, 0x0ea5e9, 0.4)
        if (!ws.kbGlowTween) {
          ws.kbGlowTween = this.scene.tweens.add({
            targets: ws.keyboard,
            alpha: { from: AnimConfig.working.keyboardGlowAlphaMin, to: AnimConfig.working.keyboardGlowAlphaMax },
            duration: AnimConfig.working.keyboardGlowDuration,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          })
        }
      }

      // ── Audio: task start sound on idle/waiting → working transition ──
      if (prevMode !== 'working') {
        soundEngine.taskStart()
      }

      // ── Game systems: auto-wrap into quest ──
      if (prevMode !== 'working') {
        const aid = agent.config.id
        // Only start a quest if this agent doesn't already have one active
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
        // Ensure agent is registered on the leaderboard (so they appear even before first completion)
        const xpD = agent.xp
        leaderboardManager.recordXP(aid, agent.config.name, 0, xpD?.level ?? 1, xpD?.rank ?? 'Intern')

        // Show quest difficulty star with difficulty-proportional animation
        const activeQ = questSystem.getAgentActiveQuests(aid)[0]
        if (activeQ && ws.questIcon) {
          const frame = DIFFICULTY_STAR_FRAME[activeQ.difficulty] ?? ICON_FRAMES.STAR_GREY
          ws.questIcon.setFrame(frame).setVisible(true).setAlpha(0)
          if (ws.questIconTween) { ws.questIconTween.destroy(); ws.questIconTween = undefined }
          if (ws.questIconPulseTween) { ws.questIconPulseTween.destroy(); ws.questIconPulseTween = undefined }
          this._applyQuestStarStyle(ws, activeQ.difficulty as QuestDifficulty)
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
            ws.ledPulseTween = this.scene.tweens.add({
              targets: ws.ledGlow, alpha: AnimConfig.working.ledPulseAlphaPeak,
              duration: AnimConfig.working.ledPulseDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }
      // Lamp light cone: brighten when working with a warm glow
      if (ws.lampLight) {
        ws.lampLightTween = this.scene.tweens.add({
          targets: ws.lampLight, alpha: AnimConfig.working.lampBrightAlpha,
          duration: 300, ease: 'Sine.easeOut',
        })
        // Subtle flicker every 8-15 seconds — tiny alpha dip then recovery
        ws.lampFlickerTimer = this.scene.time.addEvent({
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
        })
      }

      // Ambient sound-wave indicator — three concentric quarter-circle arcs drawn
      // to the left of the agent, suggesting keyboard/typing audio ambiance.
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
        ws.soundWaveTween = this.scene.tweens.add({
          targets: gfx, alpha: 0,
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })

        // Small PLAY_DARK "speaker" sprite at the sound wave origin
        const speaker = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.PLAY_DARK)
          .setScale(0.14).setAlpha(0.2)
        ws.container.add(speaker)
        speaker.setPosition(gfx.x, gfx.y)
        ws.soundWaveSpeaker = speaker
        // Gentle pulse matching the sound wave fade
        this.scene.tweens.add({
          targets: speaker, alpha: 0.05,
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      // Floating "typing note" sprites — tiny circles that rise like musical notes.
      // Only spawned at LOD level 3 (full detail zoom) to avoid performance issues.
      ws.typingNoteTimer = this.scene.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          // Gate on LOD 3 — skip at lower zoom levels
          if (this.scene.cameras.main.zoom <= LOD_L2_MAX) return
          // Spawn 1-2 tiny CIRCLE_BLUE sprites near the monitor area
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
      })
      // Progress ring — circular arc that fills clockwise over 60 seconds.
      if (ws.progressRing) {
        ws.workStartTime = Date.now()
        const ring = ws.progressRing
        const RING_DURATION_MS = 60_000
        const RING_R = 10
        const drawRing = (progress: number) => {
          if (!ring.active) return
          ring.clear()
          // Background track
          ring.lineStyle(1.5, activeTheme.wall, 0.3)
          ring.beginPath()
          ring.arc(0, 0, RING_R, 0, Math.PI * 2, false)
          ring.strokePath()
          // Filled arc from top (-90deg) clockwise
          const fill = Math.min(progress, 1)
          if (fill > 0) {
            const arcColor = fill < 0.8 ? 0x34d399 : 0xfbbf24
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
        // Fade in, then start counter tween 0->100 over RING_DURATION_MS
        ring.setAlpha(0)
        drawRing(0)
        this.scene.tweens.add({ targets: ring, alpha: 1, duration: 400, ease: 'Sine.easeOut' })
        ws.progressRingTween = this.scene.tweens.addCounter({
          from: 0, to: 100,
          duration: RING_DURATION_MS,
          ease: 'Linear',
          onUpdate: (tw) => {
            const pct = tw.getValue() / 100
            drawRing(pct)
          },
          onComplete: () => {
            // Ring is full — pulse alpha to signal overtime
            drawRing(1)
            ws.progressRingTween = this.scene.tweens.add({
              targets: ring, alpha: 0.35,
              duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }

      // ── Speech bubble — shows lastAssistantBlurb as typewriter text ──
      this.showSpeechBubble(ws, agent)

    } else {
      if (!gdsLock) ws.sprite.setFrame(base + POSE_SIT)
      // Enhanced idle breathing: scaleY + Y-offset (chest rise), with occasional sigh.
      // sighNext toggles every ~5 cycles on average (sighChance = 0.2).
      let sighNext = false
      ws.breathTween = this.scene.tweens.add({
        targets: ws.sprite,
        scaleY: CHAR_SCALE * AnimConfig.idle.breathScaleFactor,
        y: WS_SPRITE_Y - AnimConfig.idle.breathYOffset,
        duration: AnimConfig.idle.breathDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          const t = ws.breathTween
          if (!t) return
          if (sighNext) {
            // Reset to normal breath values after the sigh cycle
            t.updateTo('scaleY', CHAR_SCALE * AnimConfig.idle.breathScaleFactor)
            t.updateTo('y', WS_SPRITE_Y - AnimConfig.idle.breathYOffset)
            sighNext = false
          } else if (Math.random() < AnimConfig.idle.sighChance) {
            // Next cycle is a deeper sigh: larger amplitude + more Y rise
            t.updateTo('scaleY', CHAR_SCALE * AnimConfig.idle.sighScaleFactor)
            t.updateTo('y', WS_SPRITE_Y - AnimConfig.idle.sighYOffset)
            sighNext = true
          }
        },
      })

      // Idle chair rocking — very subtle lean-back oscillation
      if (ws.chairSprite?.visible) {
        ws.chairRockTween = this.scene.tweens.add({
          targets: ws.chairSprite,
          angle: { from: -AnimConfig.idle.chairRockAngle, to: AnimConfig.idle.chairRockAngle },
          duration: AnimConfig.idle.chairRockDuration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }

      // Fart VFX when entering compressing mode
      if (agent.sessionMode === 'compressing' && this.scene.anims.exists(EFFECT_ANIM_KEYS.FART)) {
        const fart = this.scene.add.sprite(0, WS_SPRITE_Y - 8, SPRITESHEET_KEYS.EFFECTS_FART)
          .setDepth(600).setScale(0.18).setAlpha(0.5)
        ws.container.add(fart)
        fart.play(EFFECT_ANIM_KEYS.FART)
        fart.once('animationcomplete', () => fart.destroy())
      }

      // Remove keyboard glow
      if (ws.kbGlowTween) { ws.kbGlowTween.destroy(); ws.kbGlowTween = undefined }
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
        ws.lampLightTween = this.scene.tweens.add({
          targets: ws.lampLight, alpha: AnimConfig.waiting.lampDimAlpha,
          duration: AnimConfig.waiting.ledFadeDuration, ease: 'Sine.easeOut',
        })
      }
      this.restoreDeskStrokeCallback(ws)

      // "Just finished" bounce + confetti when transitioning from working→idle
      if (prevMode === 'working') {
        soundEngine.taskComplete()
        this.scene.tweens.add({
          targets: ws.sprite, y: WS_SPRITE_Y - 6,
          duration: 200, yoyo: true, ease: AnimConfig.easing.celebration,
          onComplete: () => { ws.sprite.y = WS_SPRITE_Y },
        })
        // Find the room that owns this workstation to compute world position
        for (const room of this.host.getRooms().values()) {
          if (room.workstations.has(agent.config.id)) {
            const worldX = room.x + ws.container.x
            const worldY = room.y + ws.container.y - 16  // slightly above the agent head
            this.host.burstConfetti(worldX, worldY)
            break
          }
        }

        // Task completion tally — increment counter and refresh the desk badge
        ws.localTaskCount++
        this.refreshTaskCountCallback(ws)

        // ── Game systems: quest complete, leaderboard, season ──
        const agentId = agent.config.id
        const agentName = agent.config.name
        const xpData = agent.xp

        // Complete any active quest for this agent
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
            // Emit QUEST_COMPLETED so OfficeScene can trigger reward VFX
            EventBus.emit(
              EVENTS.QUEST_COMPLETED,
              activeQuest.id, agentId, reward.xp, reward.credits, questDifficulty,
            )
          }
        }

        // Track in leaderboard — pass quest XP reward so seasonXP accumulates
        const taskDuration = ws.workStartTime ? Date.now() - ws.workStartTime : 0
        leaderboardManager.recordTaskComplete(agentId, agentName, taskDuration, xpData?.currentStreak ?? 0)
        leaderboardManager.recordXP(agentId, agentName, earnedXP, xpData?.level ?? 1, xpData?.rank ?? 'Intern')

        // Track in season
        seasonManager.trackTaskCompleted(xpData?.currentStreak ?? 0)
      }

      // Stamp idleSince so later timers can detect prolonged boredom
      ws.sprite.setData('idleSince', Date.now())

      // Head tilt: tween angle -4..+4 degrees every 8-15s, hold 1s, return to 0
      // Skip in GDS mode — sprite angle is locked to stool rotation
      if (!gdsLock) {
        ws.lookAroundTimer = this.scene.time.addEvent({
          delay: 8000 + Math.random() * 7000,
          loop: true,
          callback: () => {
            if (ws.headTiltTween) ws.headTiltTween.destroy()
            const angle = (Math.random() - 0.5) * 8   // -4 to +4 degrees
            ws.headTiltTween = this.scene.tweens.add({
              targets: ws.sprite, angle,
              duration: 400, hold: 1000, yoyo: true, ease: 'Sine.easeInOut',
              onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
            })
          },
        })
      }

      // Stretch: scaleY 1→1.04 over 300ms, hold 200ms, back to 1 every 20-30s
      ws.stretchTimer = this.scene.time.addEvent({
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
      })

      // Look at neighbor: tilt -3/+3 degrees toward a working peer every 12-18s
      ws.lookAtNeighborTimer = this.scene.time.addEvent({
        delay: 12000 + Math.random() * 6000,
        loop: true,
        callback: () => {
          if (ws.walkBreakTween || ws.headTiltTween) return
          let neighborContainerX: number | null = null
          for (const room of this.host.getRooms().values()) {
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
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          ws.headTiltTween = this.scene.tweens.add({
            targets: ws.sprite, angle: tiltAngle,
            duration: 350, ease: 'Sine.easeOut',
            onComplete: () => {
              this.scene.time.delayedCall(2000, () => {
                this.scene.tweens.add({
                  targets: ws.sprite, angle: 0,
                  duration: 350, ease: 'Sine.easeIn',
                  onComplete: () => { ws.headTiltTween = undefined },
                })
              })
            },
          })
        },
      })

      // Yawn/bored pose: after 60s+ idle, briefly switch to POSE_INTERACT (fidget) for 1.5s
      ws.yawnTimer = this.scene.time.addEvent({
        delay: 65000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          const idleSince: number = ws.sprite.getData('idleSince') ?? Date.now()
          if (Date.now() - idleSince < 60000) return
          if (ws.walkBreakTween) return
          if (!gdsLock) ws.sprite.setFrame(base + POSE_INTERACT)
          this.scene.time.delayedCall(1500, () => {
            if (ws.lastAnimMode === 'idle' && !gdsLock) {
              ws.sprite.setFrame(base + POSE_SIT)
            }
          })
        },
      })

      // Look at desk pet: tilt toward pet + pet bounce every 15-25s
      if (ws.deskPet && ws.deskPet.visible) {
        this.scene.time.addEvent({
          delay: 15000 + Math.random() * 10000,
          loop: true,
          callback: () => {
            if (gdsLock) return
            if (ws.walkBreakTween || ws.headTiltTween || ws.lastAnimMode !== 'idle') return
            if (!ws.deskPet || !ws.deskPet.visible) return
            const petDir = ws.deskPet.x > 0 ? 3 : -3
            ws.headTiltTween = this.scene.tweens.add({
              targets: ws.sprite, angle: petDir,
              duration: 300, hold: 600, yoyo: true, ease: 'Sine.easeInOut',
              onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
            })
            // Pet does a tiny bounce in response
            this.scene.tweens.add({
              targets: ws.deskPet,
              y: ws.deskPet.y - 2,
              duration: 200, yoyo: true, ease: 'Sine.easeOut', delay: 200,
            })
          },
        })
      }

      // Tap signature item: item bounces every 25-40s
      if (ws.signatureItem && ws.signatureItem.visible) {
        this.scene.time.addEvent({
          delay: 25000 + Math.random() * 15000,
          loop: true,
          callback: () => {
            if (ws.walkBreakTween || ws.lastAnimMode !== 'idle') return
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
          if (ws.walkBreakTween || ws.headTiltTween || ws.lastAnimMode !== 'idle') return
          if ((ws.energyLevel ?? 1) > 0.3) return
          // Lean slightly toward the energy bar (left side of desk)
          ws.headTiltTween = this.scene.tweens.add({
            targets: ws.sprite, angle: -4,
            duration: 250, hold: 500, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
          })
        },
      })

      // Per-archetype idle micro-animation — random from personality pool every 8-15s
      ws.microAnimTimer = this.scene.time.addEvent({
        delay: 8000 + Math.random() * 7000,
        loop: true,
        callback: () => { this._playMicroAnim(ws, agent) },
      })

      ws.walkBreakTimer = this.scene.time.addEvent({
        delay: IDLE_WALK_BREAK_MIN_MS + Math.random() * IDLE_WALK_BREAK_VAR_MS,
        loop: true,
        callback: () => {
          if (!ws.state || ws.walkBreakTween || !ws.sprite.visible) return
          const stillIdle =
            !ws.state.needsInteraction &&
            ws.state.sessionMode !== 'working' &&
            ws.state.sessionMode !== 'plan' &&
            ws.state.sessionMode !== 'compressing'
          if (!stillIdle) return
          this._executeWalkBreak(ws, agent)
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Crossfade transition blending — smooth visual bridge between anim states
  // ---------------------------------------------------------------------------

  private _playTransitionBlend(
    ws: WorkstationSprite,
    prevMode: 'idle' | 'working' | 'waiting' | undefined,
    nextMode: 'idle' | 'working' | 'waiting',
  ): void {
    const tc = AnimConfig.transitions

    if (prevMode === 'idle' && nextMode === 'working') {
      // Settle-into-chair: brief scaleY compression then bounce back
      ws.sprite.setScale(CHAR_SCALE, CHAR_SCALE)
      this.scene.tweens.add({
        targets: ws.sprite,
        scaleY: CHAR_SCALE * tc.idleToWorkingScaleY,
        duration: tc.idleToWorkingCompressMs,
        ease: 'Sine.easeIn',
        yoyo: true,
        hold: 0,
        onComplete: () => {
          if (ws.sprite.active) ws.sprite.setScale(CHAR_SCALE)
        },
      })
      // Alpha crossfade: brief dip then back to full
      ws.sprite.setAlpha(0.85)
      this.scene.tweens.add({
        targets: ws.sprite,
        alpha: 1,
        duration: tc.idleToWorkingMs,
        ease: 'Sine.easeOut',
      })
    } else if (prevMode === 'working' && nextMode === 'idle') {
      // Hands lift off keyboard (y-offset up) + lean back (x-tilt) + settle
      ws.sprite.y = WS_SPRITE_Y - tc.workingToIdleLiftY
      ws.sprite.setAngle(tc.workingToIdleTiltAngle)
      this.scene.tweens.add({
        targets: ws.sprite,
        y: WS_SPRITE_Y,
        angle: 0,
        duration: tc.workingToIdleMs,
        ease: 'Cubic.easeOut',
      })
      // Alpha crossfade
      ws.sprite.setAlpha(0.88)
      this.scene.tweens.add({
        targets: ws.sprite,
        alpha: 1,
        duration: tc.workingToIdleMs,
        ease: 'Sine.easeOut',
      })
    } else if (nextMode === 'waiting') {
      // any → waiting: slow alpha crossfade into pulse/sway
      ws.sprite.setAlpha(0.7)
      this.scene.tweens.add({
        targets: ws.sprite,
        alpha: 1,
        duration: tc.anyToWaitingMs,
        ease: 'Sine.easeInOut',
      })
      // Gradual scale-up to waiting pulse start
      ws.sprite.setScale(CHAR_SCALE * 0.98)
      this.scene.tweens.add({
        targets: ws.sprite,
        scaleX: CHAR_SCALE,
        scaleY: CHAR_SCALE,
        duration: tc.anyToWaitingMs,
        ease: 'Sine.easeOut',
      })
    }
    // idle → walking and walking → idle are handled in _executeWalkBreak
  }

  // ---------------------------------------------------------------------------
  // Walk break — extracted so it can be triggered programmatically in tests
  // ---------------------------------------------------------------------------

  private _executeWalkBreak(ws: WorkstationSprite, agent: AgentState): void {
    const navMesh = this.host.getNavMesh()
    if (!navMesh) return
    let ownerRoom: Room | null = null
    for (const room of this.host.getRooms().values()) {
      if (room.workstations.has(agent.config.id)) { ownerRoom = room; break }
    }
    if (!ownerRoom) return

    const worldX = ownerRoom.x + ws.container.x
    const worldY = ownerRoom.y + ws.container.y + WS_SPRITE_Y

    // ---------------------------------------------------------------------------
    // Determine forward and return paths
    // ---------------------------------------------------------------------------

    let goPath: { x: number; y: number }[] | null = null
    let returnPath: { x: number; y: number }[] | null = null
    let pauseMs = 800 + Math.random() * 600

    // Check if the desk has a pre-authored walk track
    const trackData = this.host.getWalkTrack?.(agent.config.id)

    if (trackData && trackData.points.length > 0) {
      // Build paths from track waypoints (already in world space from GDS transform)
      const pts = trackData.points
      // Forward: desk origin → each track point in order
      goPath = [{ x: worldX, y: worldY }, ...pts]

      if (trackData.loop) {
        // loop=true: reverse through intermediate points back to desk
        // e.g. [P4] → P3 → P2 → P1 → desk
        returnPath = [...pts.slice(0, -1).reverse(), { x: worldX, y: worldY }]
      } else {
        // loop=false: walk directly from final point back to desk
        returnPath = [pts[pts.length - 1], { x: worldX, y: worldY }]
        pauseMs = 1200 + Math.random() * 800 // longer pause at track endpoint
      }
    } else {
      // Original random walk: pick a random nearby point clamped to own room
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
      goPath = navMesh.findPath({ x: worldX, y: worldY }, { x: targetX, y: targetY }, ownRoomRect)
      if (!goPath || goPath.length < 2) return
      returnPath = navMesh.findPath({ x: targetX, y: targetY }, { x: worldX, y: worldY }, ownRoomRect)
        ?? [...goPath].reverse()
    }

    if (!goPath || goPath.length < 2) return

    // Create a temporary world-space walk sprite
    const charIdx = getAgentCharacterIndex(agent)
    const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
    const walkSprite = this.scene.add.sprite(worldX, worldY, walkSheetKey, 0)
      .setScale(CHAR_SCALE).setOrigin(0.5, 1).setDepth(9000)
    const walkShadow = this.scene.add.ellipse(worldX, worldY + 2, 16, 5, 0x000000, 0.15).setDepth(8999)

    ws.sprite.setVisible(false)

    const pathWalker = new PathWalker(
      this.scene, walkSprite, walkShadow, walkSheetKey, undefined,
      (wx, wy) => {
        // Distance attenuation: full volume within 100px of camera center, silent at 400px
        const cam = this.scene.cameras.main
        const camCX = cam.scrollX + cam.width / 2
        const camCY = cam.scrollY + cam.height / 2
        const dist = Math.hypot(camCX - wx, camCY - wy)
        const factor = Math.max(0, 1 - dist / 400)
        soundEngine.footstep(factor)
      },
    )

    // Use a dummy tween as the walkBreakTween sentinel to prevent overlapping walks
    ws.walkBreakTween = this.scene.tweens.addCounter({ duration: 999999 })

    // gdsLock and base are recomputed since this method may be called outside the idle closure
    const gdsLock = this.host.getOrAssignGdsDeskSlot != null
    const base = getAgentCharacterIndex(agent) * CHAR_COLS

    const tc = AnimConfig.transitions

    const finishWalk = () => {
      pathWalker.destroy()
      walkSprite.destroy()
      walkShadow.destroy()
      ws.sprite.setVisible(true)
      if (ws.walkBreakTween) { ws.walkBreakTween.destroy(); ws.walkBreakTween = undefined }

      // Walking → idle: momentum overshoot + settle (Living Lab 1a)
      const overshootDir = goPath.length >= 2
        ? Math.sign(goPath[goPath.length - 1].x - goPath[goPath.length - 2].x)
        : 0
      ws.sprite.x = overshootDir * tc.walkingToIdleOvershootPx
      ws.sprite.y = WS_SPRITE_Y
      this.scene.tweens.add({
        targets: ws.sprite,
        x: 0,
        duration: tc.walkingToIdleSettleMs,
        ease: 'Cubic.easeOut',
      })
      if (!gdsLock) ws.sprite.setFrame(base + POSE_SIT)
    }

    // Idle → walking: anticipation lean before walk begins (Living Lab 1a)
    const leanDir = goPath.length >= 2
      ? Math.sign(goPath[1].x - goPath[0].x) || 1
      : 1
    walkSprite.setAlpha(0.85)
    walkSprite.x = worldX - leanDir * tc.idleToWalkingLeanX
    this.scene.tweens.add({
      targets: walkSprite,
      x: worldX,
      alpha: 1,
      duration: tc.idleToWalkingMs,
      ease: 'Sine.easeOut',
    })
    // Sync shadow position during lean
    walkShadow.x = walkSprite.x
    this.scene.tweens.add({
      targets: walkShadow,
      x: worldX,
      duration: tc.idleToWalkingMs,
      ease: 'Sine.easeOut',
    })

    // Delay the actual path walk until anticipation lean finishes
    this.scene.time.delayedCall(tc.idleToWalkingMs, () => {
      if (!walkSprite.active) { finishWalk(); return }

    pathWalker.startPath(goPath, () => {
      // Pause at destination, then walk back
      this.scene.time.delayedCall(pauseMs, () => {
        if (!walkSprite.active) { finishWalk(); return }
        if (!returnPath || returnPath.length < 2) { finishWalk(); return }
        pathWalker.startPath(returnPath, finishWalk)
      })
    })
    }) // end delayedCall for anticipation lean
  }

  /**
   * Programmatically trigger a walk break for the agent with the given id.
   * Returns true if the walk was started, false if the agent was not found,
   * already walking, or has no state.
   */
  triggerWalkBreak(agentId: string): boolean {
    for (const room of this.host.getRooms().values()) {
      const ws = room.workstations.get(agentId)
      if (!ws?.state || ws.walkBreakTween) continue
      this._executeWalkBreak(ws, ws.state)
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

    // Base fade-in
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

    // Bob tween (all difficulties)
    ws.questIconTween = this.scene.tweens.add({
      targets: icon, y: icon.y - 2,
      duration: bobDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    // Higher difficulties get additional scale pulse + tint
    if (difficulty === 'hard' || difficulty === 'epic' || difficulty === 'legendary') {
      const pulseScale = difficulty === 'legendary' ? 0.12 : difficulty === 'epic' ? 0.08 : 0.04
      const pulseDuration = difficulty === 'legendary' ? 600 : difficulty === 'epic' ? 900 : 1600

      ws.questIconPulseTween = this.scene.tweens.add({
        targets: icon,
        scaleX: icon.scaleX + pulseScale,
        scaleY: icon.scaleY + pulseScale,
        duration: pulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    if (difficulty === 'epic') {
      icon.setTint(0xf59e0b)
    } else if (difficulty === 'legendary') {
      icon.setTint(0xef4444)
      // Additional alpha flicker for legendary
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
    // Orchestrator tasks get stage-colored monitor glow
    const orchStage = ws.state?.isOrchestratorTask ? (ws.state.taskStage ?? 'executing') : null
    const orchColors: Record<string, number> = { planning: 0xa78bfa, executing: 0xf97316, validating: 0x06b6d4 }
    const baseColor = orchStage ? (orchColors[orchStage] ?? 0xf97316)
      : isWaiting ? 0xfbbf24 : isWorking ? 0x0ea5e9 : activeTheme.deskBody
    const baseStrength = isActive ? AnimConfig.monitor.activeBaseStrength : AnimConfig.monitor.idleBaseStrength
    const peakStrength = isActive ? AnimConfig.monitor.activePeakStrength : AnimConfig.monitor.idlePeakStrength
    const duration     = isActive ? AnimConfig.monitor.activePulseDuration : AnimConfig.monitor.idlePulseDuration
    ws.monitorGlowFx.color = baseColor
    ws.monitorGlowFx.outerStrength = baseStrength
    ws.monitorGlowTween = this.scene.tweens.add({
      targets: ws.monitorGlowFx, outerStrength: peakStrength,
      duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  // ---------------------------------------------------------------------------
  // updateBlockedIndicator
  // ---------------------------------------------------------------------------

  updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void {
    if (ws.blockedIndicatorTween) {
      ws.blockedIndicatorTween.destroy()
      ws.blockedIndicatorTween = undefined
    }

    // Phone light: stop and hide on every re-evaluation before deciding state
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
      color = 0xf97316
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

    // Phone notification light — blink the desk communicator dot in interaction-type color
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

    // Emoji changed — stop existing float tween, fade out, then swap and bounce in
    if (ws.moodTween) {
      ws.moodTween.destroy()
      ws.moodTween = undefined
    }

    const moodText = ws.moodEmoji
    moodText.setData('currentEmoji', emoji)

    // Derive the mood key so we can look up the spriteFrame for the badge
    const moodKey = this.deriveMoodKey(agent)
    const badgeFrame = MOOD_CONFIGS[moodKey].spriteFrame

    // Fade out current emoji, then swap and bounce in
    this.scene.tweens.add({
      targets: moodText,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!moodText.active) return
        moodText.setText(emoji)
        moodText.setScale(0)
        // Bounce in: 0 → 1.2 → 1
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
                // Gentle infinite float: oscillate y ±2px
                const baseY = moodText.y
                ws.moodTween = this.scene.tweens.add({
                  targets: moodText,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                })
              },
            })
          },
        })
      },
    })

    // Update the sprite-based mood badge alongside the emoji
    this.updateMoodBadge(ws, badgeFrame)

    // React the desk pet mouth to the agent's mood
    this.updatePetMouth(ws, moodKey)
  }

  /**
   * React desk pet to the agent's current mood.
   * For animal pets: play hurt animation on frustrated, then resume idle.
   * For monster pets: swap mouth sprite frame.
   */
  private updatePetMouth(ws: WorkstationSprite, mood: Mood): void {
    // Animal pet hurt reaction
    if (ws.animalSpecies && ws.deskPet?.active) {
      if (mood === 'frustrated') {
        const idleKey = `animal-idle-${ws.animalSpecies}`
        // Brief shake + tint red to show distress, then resume idle
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

    // Monster pet mouth swap
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

  /**
   * Derive a Mood key from agent state — mirrors getAgentMood logic but returns
   * the typed Mood string so we can index into MOOD_CONFIGS for the spriteFrame.
   */
  private deriveMoodKey(agent: AgentState): Mood {
    if (agent.needsInteraction && agent.interactionType === 'tool-approval') return 'frustrated'
    if (agent.needsInteraction && agent.interactionType === 'question') return 'zen'
    if (agent.sessionMode === 'working') return 'focused'
    if (agent.sessionMode === 'plan') return 'focused'
    if (agent.sessionMode === 'compressing') return 'tired'
    return 'idle'
  }

  /**
   * Animate the mood badge sprite to show the given frame.
   * Fades out, swaps frame, then bounces back in with a gentle float loop.
   */
  private updateMoodBadge(ws: WorkstationSprite, frame: number): void {
    if (!ws.moodBadge) return

    const badge = ws.moodBadge
    const currentFrame = badge.getData('currentFrame') as number | undefined
    if (currentFrame === frame) return
    badge.setData('currentFrame', frame)

    // Tear down existing badge tween
    if (ws.moodBadgeTween) {
      ws.moodBadgeTween.destroy()
      ws.moodBadgeTween = undefined
    }

    // Fade out, swap frame, bounce in
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
                // Gentle float in sync with mood emoji
                const baseY = badge.y
                ws.moodBadgeTween = this.scene.tweens.add({
                  targets: badge,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                })
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

  private showSpeechBubble(ws: WorkstationSprite, agent: AgentState): void {
    const blurb = agent.isOrchestratorTask
      ? (agent.taskTitle ? `[Task] ${agent.taskTitle}` : '').trim()
      : (agent.lastAssistantBlurb ?? '').trim()
    if (!blurb) return

    // Avoid duplicate repeat timers if this path runs again before mode teardown
    if (ws.speechBubbleTween) { ws.speechBubbleTween.destroy(); ws.speechBubbleTween = undefined }
    if (ws.speechBubbleTimer) { ws.speechBubbleTimer.destroy(); ws.speechBubbleTimer = undefined }

    const BUBBLE_Y = WS_SPRITE_Y - 40
    const MAX_CHARS = 40
    const PAD_X = 6
    const PAD_Y = 4

    // Create the container + children lazily on first use
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

      // Register as LOD level 3 so it only shows at close zoom
      ws.lodLevel3Objects.push(container)
    }

    const displayText = blurb.length > MAX_CHARS ? blurb.slice(0, MAX_CHARS) + '...' : blurb

    // Helper to draw the rounded-rect background sized to the current text
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

    // Helper to run the typewriter + fade cycle for a given string
    const typewriterCycle = (text: string) => {
      const bubble = ws.speechBubble!
      const txt = ws.speechBubbleText!
      if (!txt.active || !bubble.active || !sceneAlive()) return

      // Reset — avoid setText('') alone on some Phaser builds (frame/texture edge cases)
      txt.setText('\u200b')
      drawBg()
      bubble.setVisible(true)
      bubble.y = BUBBLE_Y

      // Fade in
      if (ws.speechBubbleTween) { ws.speechBubbleTween.destroy(); ws.speechBubbleTween = undefined }
      this.scene.tweens.add({ targets: bubble, alpha: 1, duration: 200, ease: 'Sine.easeOut' })

      // Typewriter — character by character
      const counter = { val: 0 }
      ws.speechBubbleTween = this.scene.tweens.add({
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
          // Hold for 4 seconds then fade out
          this.scene.time.delayedCall(4000, () => {
            if (!bubble.active || !sceneAlive()) return
            this.scene.tweens.add({
              targets: bubble, alpha: 0,
              duration: 300, ease: 'Sine.easeOut',
              onComplete: () => { if (bubble.active) bubble.setVisible(false) },
            })
          })
        },
      })
    }

    // Show the first blurb immediately
    typewriterCycle(displayText)

    // Repeat every 8-12 seconds with the latest blurb
    ws.speechBubbleTimer = this.scene.time.addEvent({
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
    })
  }

  // ---------------------------------------------------------------------------
  // Thought bubble — rich live-text with typing animation, auto-sizing, and fade
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

    // Sprite-based panel background — resize to match text dimensions
    if (ws.thoughtBubbleBgSprite) {
      ws.thoughtBubbleBgSprite.setDisplaySize(bw, bh)
      ws.thoughtBubbleBgSprite.setTint(activeTheme.bg)
    }

    const g = ws.thoughtBubbleBg
    g.clear()

    // Only draw Graphics bg if sprite is not available
    if (!ws.thoughtBubbleBgSprite) {
      g.fillStyle(activeTheme.bg, 0.92)
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, CORNER)
    }

    // Accent left border (always drawn — overlays both sprite and graphics bg)
    g.fillStyle(accentColor, 0.9)
    g.fillRoundedRect(-bw / 2, -bh / 2, ACCENT_W, bh, CORNER)
    if (ws.thoughtBubbleBgSprite) g.setVisible(true)

    // Downward tail
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
    if (candidateCount < 2) return // no animation for single candidate
    if (ws.thinkingDotsContainer) {
      if (ws.thinkingCandidateCount === candidateCount) return
      this.hideThinkingDots(ws)
    }

    // Phaser.GameObjects.Arc — scene.add.circle fills as a disc (radius matches issue #19)
    const container = this.scene.add.container(0, THINKING_DOT_Y)
    const dots: Phaser.GameObjects.Arc[] = []

    const totalWidth = (candidateCount - 1) * THINKING_DOT_SPACING
    const startX = -totalWidth / 2

    for (let i = 0; i < candidateCount; i++) {
      const dot = this.scene.add.circle(
        startX + i * THINKING_DOT_SPACING, 0,
        THINKING_DOT_RADIUS, activeTheme.accent, 0,
      )
      dot.setAlpha(0)
      container.add(dot)
      dots.push(dot)
    }

    ws.container.add(container)
    ws.thinkingDotsContainer = container
    ws.thinkingDots = dots
    ws.thinkingCandidateCount = candidateCount

    // Push to lodLevel3Objects so it hides at L1/L2
    ws.lodLevel3Objects.push(container)

    // Build repeating timeline: dots appear one by one, hold, fade, repeat
    this.startThinkingTimeline(ws)
  }

  private startThinkingTimeline(ws: WorkstationSprite): void {
    const dots = ws.thinkingDots
    if (!dots || dots.length === 0) return

    const stepMs = THINKING_DOT_APPEAR_MS
    const holdMs = THINKING_DOT_HOLD_MS
    const totalAppear = dots.length * stepMs
    const cycleDuration = totalAppear + holdMs + THINKING_DOT_FADE_MS

    // Use a single repeating tween on a proxy object to drive the timeline
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
            // Fading in
            dots[i].setAlpha((elapsed - dotStart) / stepMs)
            dots[i].setFillStyle(activeTheme.accent, dots[i].alpha)
          } else if (elapsed < totalAppear + holdMs) {
            // Hold phase
            dots[i].setAlpha(1)
            dots[i].setFillStyle(activeTheme.accent, 1)
          } else {
            // Fade out
            const fadeElapsed = elapsed - (totalAppear + holdMs)
            const alpha = Math.max(0, 1 - fadeElapsed / THINKING_DOT_FADE_MS)
            dots[i].setAlpha(alpha)
            dots[i].setFillStyle(activeTheme.accent, alpha)
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

    // Stop the looping timeline
    if (ws.thinkingDotsTween) {
      ws.thinkingDotsTween.destroy()
      ws.thinkingDotsTween = undefined
    }

    // Make all dots fully visible for merge
    for (const dot of dots) {
      dot.setAlpha(1)
      dot.setFillStyle(activeTheme.accent, 1)
    }

    // Tween all dots to center (x=0) simultaneously
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
          // Hide stacked satellites so only one bright dot pulses
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

  /**
   * Streak that drives the desk flame: max(Command Center XP streak, eval harness
   * consecutive-success streak when the agent appears in eval reports).
   */
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
  // Per-archetype idle micro-animations
  // ---------------------------------------------------------------------------

  /**
   * Pick and play a random micro-animation from the agent's archetype pool.
   * Enforces a 2s minimum stagger so no two agents play the same anim simultaneously.
   */
  private _playMicroAnim(ws: WorkstationSprite, agent: AgentState): void {
    if (ws.lastAnimMode !== 'idle') return
    if (ws.walkBreakTween || ws.headTiltTween) return

    const archetype = PERSONA_ARCHETYPE_MAP[agent.config.name] ?? 'social'
    const pool = ARCHETYPE_ANIM_POOL[archetype]
    const now = Date.now()

    // Filter to animations not played by any agent in the last 2s
    const available = pool.filter(key => (now - (lastMicroAnimPlayedAt.get(key) ?? 0)) >= 2000)
    if (available.length === 0) return

    const key = available[Math.floor(Math.random() * available.length)]
    lastMicroAnimPlayedAt.set(key, now)

    // GDS mode locks sprite angle — skip angle-based anims
    const gdsLock = this.host.getOrAssignGdsDeskSlot != null
    this._executeMicroAnim(ws, key, gdsLock)
  }

  /**
   * Execute a named micro-animation on the given workstation sprite.
   * All animations use only x/y/angle tweens to avoid conflicting with
   * the ongoing breathTween (which owns scaleY).
   */
  private _executeMicroAnim(ws: WorkstationSprite, key: string, gdsLock: boolean): void {
    const sprite = ws.sprite
    switch (key) {
      // ── Focused archetype ────────────────────────────────────────────────
      case 'chin-rest':
        // Head tilts down (chin resting on hand), slight lean in
        if (gdsLock) return
        ws.headTiltTween = this.scene.tweens.add({
          targets: sprite, angle: 6, y: WS_SPRITE_Y + 1,
          duration: 350, hold: 1400, yoyo: true, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.setAngle(0); sprite.y = WS_SPRITE_Y; ws.headTiltTween = undefined },
        })
        break

      case 'screen-lean':
        // Lean toward the monitor — small y offset forward
        sprite.y = WS_SPRITE_Y
        this.scene.tweens.add({
          targets: sprite, y: WS_SPRITE_Y - 3,
          duration: 400, hold: 1000, yoyo: true, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.y = WS_SPRITE_Y },
        })
        break

      case 'note-jot':
        // Rapid hand wiggle to the side — jotting a quick note
        this.scene.tweens.add({
          targets: sprite, x: 4,
          duration: 110, yoyo: true, repeat: 4, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.x = 0 },
        })
        break

      // ── Creative archetype ───────────────────────────────────────────────
      case 'creative-stretch':
        // Arms-up stretch: sprite rises slightly
        this.scene.tweens.add({
          targets: sprite, y: WS_SPRITE_Y - 5,
          duration: 400, hold: 700, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { sprite.y = WS_SPRITE_Y },
        })
        break

      case 'head-bob':
        // Rhythmic head bob — 2 cycles of gentle tilt
        if (gdsLock) return
        ws.headTiltTween = this.scene.tweens.add({
          targets: sprite, angle: 5,
          duration: 220, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.setAngle(0); ws.headTiltTween = undefined },
        })
        break

      case 'doodle':
        // Small circular hand motion — doodling in the margin
        this.scene.tweens.add({
          targets: sprite, x: 3, y: WS_SPRITE_Y + 2,
          duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.x = 0; sprite.y = WS_SPRITE_Y },
        })
        break

      // ── Social archetype ─────────────────────────────────────────────────
      case 'phone-check':
        // Hand moves to side + glance down — checking the phone
        if (gdsLock) {
          this.scene.tweens.add({
            targets: sprite, x: 5, y: WS_SPRITE_Y + 1,
            duration: 300, hold: 900, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { sprite.x = 0; sprite.y = WS_SPRITE_Y },
          })
        } else {
          ws.headTiltTween = this.scene.tweens.add({
            targets: sprite, x: 5, angle: -4, y: WS_SPRITE_Y + 1,
            duration: 300, hold: 900, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { sprite.x = 0; sprite.setAngle(0); sprite.y = WS_SPRITE_Y; ws.headTiltTween = undefined },
          })
        }
        break

      case 'lean-back':
        // Rock back in chair — casual lean away from the screen
        if (gdsLock) return
        ws.headTiltTween = this.scene.tweens.add({
          targets: sprite, angle: -5, y: WS_SPRITE_Y + 2,
          duration: 450, hold: 1200, yoyo: true, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.setAngle(0); sprite.y = WS_SPRITE_Y; ws.headTiltTween = undefined },
        })
        break

      case 'wave':
        // Quick wave toward the nearest agent or just outward
        if (gdsLock) return
        ws.headTiltTween = this.scene.tweens.add({
          targets: sprite, x: 4, angle: 7,
          duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
          onComplete: () => { sprite.x = 0; sprite.setAngle(0); ws.headTiltTween = undefined },
        })
        break
    }
  }

  // ---------------------------------------------------------------------------
  // Sleep / Wake lifecycle — pause and resume all per-workstation timers/tweens
  // ---------------------------------------------------------------------------

  pauseAll(): void {
    for (const room of this.host.getRooms().values()) {
      for (const ws of room.workstations.values()) {
        if (ws.lookAroundTimer)     ws.lookAroundTimer.paused     = true
        if (ws.stretchTimer)        ws.stretchTimer.paused        = true
        if (ws.walkBreakTimer)      ws.walkBreakTimer.paused      = true
        if (ws.lookAtNeighborTimer) ws.lookAtNeighborTimer.paused = true
        if (ws.yawnTimer)           ws.yawnTimer.paused           = true
        if (ws.microAnimTimer)      ws.microAnimTimer.paused      = true
        if (ws.lampFlickerTimer)    ws.lampFlickerTimer.paused    = true
        if (ws.typingNoteTimer)     ws.typingNoteTimer.paused     = true
        if (ws.speechBubbleTimer)   ws.speechBubbleTimer.paused   = true
        if (ws.flameTimer)          ws.flameTimer.paused          = true
        if (ws.blurbFadeTimer)      ws.blurbFadeTimer.paused      = true
        ws.walkBreakTween?.pause()
      }
    }
  }

  resumeAll(): void {
    for (const room of this.host.getRooms().values()) {
      for (const ws of room.workstations.values()) {
        if (ws.lookAroundTimer)     ws.lookAroundTimer.paused     = false
        if (ws.stretchTimer)        ws.stretchTimer.paused        = false
        if (ws.walkBreakTimer)      ws.walkBreakTimer.paused      = false
        if (ws.lookAtNeighborTimer) ws.lookAtNeighborTimer.paused = false
        if (ws.yawnTimer)           ws.yawnTimer.paused           = false
        if (ws.microAnimTimer)      ws.microAnimTimer.paused      = false
        if (ws.lampFlickerTimer)    ws.lampFlickerTimer.paused    = false
        if (ws.typingNoteTimer)     ws.typingNoteTimer.paused     = false
        if (ws.speechBubbleTimer)   ws.speechBubbleTimer.paused   = false
        if (ws.flameTimer)          ws.flameTimer.paused          = false
        if (ws.blurbFadeTimer)      ws.blurbFadeTimer.paused      = false
        ws.walkBreakTween?.resume()
      }
    }
  }
}
