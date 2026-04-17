// ---------------------------------------------------------------------------
// animation-config.ts
// Centralized, mutable animation parameter registry for WorkstationAnimator.
//
// All tween durations, scale factors, alpha ranges, and timing values that
// were previously hardcoded in workstation-animation.ts are collected here.
// Consumers read from AnimConfig at tween-creation time so runtime patches
// (e.g. from a debug panel or test harness) take effect immediately on the
// next animation cycle without requiring a scene restart.
//
// Particle atmosphere (wind, spiral bursts, drag): see `particles` section.
// Consumers: office-particles.ts (typing sparks, flames, emitter), celebrations.ts.
//
// Usage:
//   import { AnimConfig, patchAnimConfig, resetAnimConfig, getAnimConfig } from './animation-config'
//
//   // Read at tween creation time:
//   this.scene.tweens.add({ duration: AnimConfig.working.typingDuration, ... })
//
//   // Patch at runtime (debug panel, test override, PH.config):
//   patchAnimConfig({ working: { typingAmplitude: 2.0 } })
//   patchAnimConfig({ monitor: { l2ActiveBaseStrength: 0.12 }, evalGlow: { radius: 12 } })
//
//   // Restore factory defaults:
//   resetAnimConfig()
//
//   // Read-only snapshot (e.g. for serialisation):
//   const snap = getAnimConfig()
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnimationConfig {
  /** Parameters for the 'waiting' (needsInteraction) animation state. */
  waiting: {
    /** Scale multiplier applied on top of CHAR_SCALE for the pulse tween (e.g. 1.06 → scaleX/Y * 1.06). */
    pulseScaleFactor: number
    /** Duration (ms) of one half-cycle of the waiting pulse tween. */
    pulseDuration: number
    /** X shift amplitude (px) for the waiting sway tween. */
    swayAmplitude: number
    /** Duration (ms) of one half-cycle of the waiting sway tween. */
    swayDuration: number
    /** Minimum alpha for the status-dot pulse tween (yoyo: true, so this is the trough). */
    dotPulseAlphaMin: number
    /** Duration (ms) of one half-cycle of the status-dot pulse tween. */
    dotPulseDuration: number
    /** Target alpha for the lamp light cone while waiting. */
    lampDimAlpha: number
    /** Duration (ms) of the lamp fade-to-dim tween. */
    ledFadeDuration: number
    /** Base half-cycle duration (ms) for the irregular waiting breath (randomised each cycle). */
    breathDuration: number
    /** Random range (ms) added to breathDuration each cycle (total cycle = breathDuration + rand * breathDurationVar). */
    breathDurationVar: number
    /** Upward Y shift (px) during each waiting breath cycle. */
    breathYOffset: number
  }

  /** Parameters for the 'working' animation state. */
  working: {
    /** X shift amplitude (px) for the typing shake tween. */
    typingAmplitude: number
    /** Duration (ms) of one half-cycle of the typing shake tween. */
    typingDuration: number
    /** Y offset (px, subtracted from WS_SPRITE_Y) for the bounce tween. */
    bounceOffset: number
    /** Duration (ms) of one half-cycle of the bounce tween. */
    bounceDuration: number
    /** Angle (degrees) for the working head-tilt tween. */
    headTiltAngle: number
    /** Duration (ms) of one half-cycle of the working head-tilt tween. */
    headTiltDuration: number
    /** Alpha floor for the keyboard glow tween (from: value). */
    keyboardGlowAlphaMin: number
    /** Alpha peak for the keyboard glow tween (to: value). */
    keyboardGlowAlphaMax: number
    /** Duration (ms) of one half-cycle of the keyboard glow tween. */
    keyboardGlowDuration: number
    /** Initial alpha that the LED fades to before the pulse loop starts (working). */
    ledPulseAlphaBase: number
    /** Peak alpha of the LED pulse tween (working). */
    ledPulseAlphaPeak: number
    /** Duration (ms) of one half-cycle of the LED pulse tween (working). */
    ledPulseDuration: number
    /** Target alpha for the lamp light cone while working. */
    lampBrightAlpha: number
    /** Minimum flicker interval (ms) for the working-lamp subtle flicker timer. */
    lampFlickerIntervalMin: number
    /** Variable range (ms) added to lampFlickerIntervalMin via Math.random(). */
    lampFlickerIntervalVar: number
    /** Duration (ms) for the sound-wave fade tween (half-cycle, yoyo). */
    soundWaveFadeDuration: number
    /** Interval (ms) between typing-note sprite spawns. */
    typingNoteSpawnInterval: number
    /** Rise distance (px) for the typing-note fly-up tween. */
    typingNoteRiseDuration: number
    /** Total duration (ms) for the progress ring counter to reach 100. */
    progressRingDuration: number
    /** Duration (ms) of one half-cycle of the subtle working breath tween (2s full cycle → 1000ms half). */
    breathDuration: number
    /** ScaleY multiplier for the subtle working-state breath tween. */
    breathScaleFactor: number
  }

  /** Parameters for the 'idle' animation state. */
  idle: {
    /** ScaleY multiplier applied on top of CHAR_SCALE for the breath tween. */
    breathScaleFactor: number
    /** Duration (ms) of one half-cycle of the breath tween (idle = 3s full cycle → 1500ms half). */
    breathDuration: number
    /** Upward Y shift (px) applied during each breath cycle (chest rise). */
    breathYOffset: number
    /** Probability per cycle (0–1) that the agent will emit a sigh. */
    sighChance: number
    /** ScaleY multiplier for the deeper sigh breath (larger excursion than normal breath). */
    sighScaleFactor: number
    /** Upward Y shift (px) during a sigh cycle (larger than breathYOffset). */
    sighYOffset: number
    /** Angle (degrees) for each end of the chair-rock oscillation. */
    chairRockAngle: number
    /** Duration (ms) of one half-cycle of the chair-rock tween. */
    chairRockDuration: number
    /** Minimum delay (ms) for the look-around timer. */
    lookAroundIntervalMin: number
    /** Variable range (ms) added to lookAroundIntervalMin via Math.random(). */
    lookAroundIntervalVar: number
    /** Minimum delay (ms) for the stretch timer. */
    stretchIntervalMin: number
    /** Variable range (ms) added to stretchIntervalMin via Math.random(). */
    stretchIntervalVar: number
    /**
     * Minimum idle time (ms) before walk-break triggers.
     * Mirrors IDLE_WALK_BREAK_MIN_MS from office-constants.ts.
     * That constant is the canonical value; this config entry exists so
     * runtime patching (debug/test) can override the walk cadence without
     * editing the constants file.
     */
    walkBreakMin: number
    /**
     * Variable range (ms) added to walkBreakMin via Math.random().
     * Mirrors IDLE_WALK_BREAK_VAR_MS from office-constants.ts.
     */
    walkBreakVar: number
    /** Minimum delay (ms) for the yawn/bored-fidget timer. */
    yawnIntervalMin: number
    /** Variable range (ms) added to yawnIntervalMin via Math.random(). */
    yawnIntervalVar: number
  }

  /** Durations used during mode-transition cleanup / setup. */
  transitions: {
    /** Duration (ms) for the mood emoji fade-out on mode transition. */
    moodFadeOutDuration: number
    /** Duration (ms) for the progress ring fade-out tween when leaving working mode. */
    progressRingFadeMs: number
    /** Duration (ms) for the quest icon fade-out on mode transition. */
    questIconFadeMs: number

    // ── Crossfade blending (Living Lab 1a) ──

    /** idle → working: total blend duration (ms). */
    idleToWorkingMs: number
    /** idle → working: scaleY compression factor during settle (e.g. 0.95). */
    idleToWorkingScaleY: number
    /** idle → working: duration (ms) of the compression half before bounce-back. */
    idleToWorkingCompressMs: number

    /** working → idle: total blend duration (ms). */
    workingToIdleMs: number
    /** working → idle: y-offset (px) for "hands lift off keyboard" motion. */
    workingToIdleLiftY: number
    /** working → idle: x-tilt angle (degrees) for "lean back" motion. */
    workingToIdleTiltAngle: number

    /** idle → walking: anticipation lean duration (ms) before walk begins. */
    idleToWalkingMs: number
    /** idle → walking: lean distance (px) in the movement direction. */
    idleToWalkingLeanX: number

    /** walking → idle: overshoot distance (px) past the stop point. */
    walkingToIdleOvershootPx: number
    /** walking → idle: settle tween duration (ms) after overshoot. */
    walkingToIdleSettleMs: number

    /** any → waiting: slow crossfade duration (ms). */
    anyToWaitingMs: number
  }

  /** Parameters for the monitor glow post-processing effect. */
  monitor: {
    /** Glow outerStrength when the agent is active (working or waiting). */
    activeBaseStrength: number
    /** Peak glow outerStrength for the active pulse tween. */
    activePeakStrength: number
    /** Glow outerStrength when the agent is idle (trough of the idle pulse). */
    idleBaseStrength: number
    /** Peak glow outerStrength for the idle pulse tween. */
    idlePeakStrength: number
    /** Duration (ms) of one half-cycle of the active glow pulse tween. */
    activePulseDuration: number
    /** Duration (ms) of one half-cycle of the idle glow pulse tween. */
    idlePulseDuration: number
    /** Pixel distance of the Phaser FX glow effect. */
    glowDistance: number
    /** Quality parameter of the Phaser FX glow effect (0–1). */
    glowQuality: number
  }

  /**
   * Celebration queue, combo streaks, and per-type cooldowns ({@link CelebrationManager}).
   * Tweak here instead of scattering magic numbers in celebrations.ts.
   */
  celebrations: {
    /** Minimum time (ms) between *starting* consecutive queued celebration effects. */
    queueGapMs: number
    /** Rolling window (ms) for counting rapid task completions toward combo tiers. */
    comboWindowMs: number
    /**
     * Alias for the combo rolling window (ms); same default as comboWindowMs.
     * Kept for parity with issue wording ("combo cooldown" / 10s window).
     */
    comboCooldownMs: number
    /** If two queue items of the same kind arrive within this window, merge into one amplified play. */
    sameTypeMergeWindowMs: number
    /** Cooldown (ms) before the same agent can trigger another rank-up celebration. */
    rankUpCooldownMs: number
    /** Cooldown (ms) before the same agent can trigger another task-complete celebration. */
    taskCompleteCooldownMs: number
    /** Cooldown (ms) before the same agent can trigger another error celebration. */
    errorCooldownMs: number
    /** Task completions in the combo window at or above this count get a larger burst. */
    comboTier2Min: number
    /** At or above: screen flash + floating combo text. */
    comboTier3Min: number
    /** At or above: "on fire" particle tint (orange/red). */
    comboTierFireMin: number
  }

  /**
   * Squash & stretch — the classic animation principle applied to character tweens.
   * All parameters here are hot-patchable at runtime via patchAnimConfig().
   */
  squashStretch: {
    /** scaleY applied to sprite on each walk footfall (< 1 = compression). */
    walkFootfallScaleY: number
    /** scaleX applied to sprite on each walk footfall (> 1 = widening). */
    walkFootfallScaleX: number
    /** Duration (ms) of one footfall squash half-cycle (yoyo back to original). */
    walkFootfallDuration: number

    /** scaleY during celebration wind-up crouch (< 1). */
    celebWindupScaleY: number
    /** Duration (ms) of the wind-up crouch tween. */
    celebWindupDuration: number
    /** scaleY during celebration stretch pop (> 1). */
    celebStretchScaleY: number
    /** Duration (ms) of the stretch pop tween. */
    celebStretchDuration: number
    /** Number of decaying oscillations after the stretch pop. */
    celebSettleCount: number
    /** Starting scale deviation amplitude for the first settle oscillation. */
    celebSettleAmplitude: number
    /** Duration (ms) of each settle oscillation half-cycle. */
    celebSettleDuration: number
    /** Multiplier applied to amplitude each successive oscillation (0–1). */
    celebSettleDecay: number

    /** scaleY squash applied when character sits down on contact (< 1). */
    sitCompressScaleY: number
    /** Duration (ms) of the sitting compression tween (yoyo back to original). */
    sitCompressDuration: number

    /** Y offset (px, negative = upward) of the task complete hop. */
    taskHopY: number
    /** scaleY squash just before the hop (pre-launch compression). */
    taskHopScaleSquash: number
    /** scaleY stretch at the apex of the hop. */
    taskHopScaleStretch: number
    /** Total duration (ms) of the full task complete hop sequence. */
    taskHopDuration: number
  }

  /** Camera juice: zoom pulses, scripted pans, slow zoom-to-fit (sidekick#79). */
  camera: {
    pulse: Record<
      'taskComplete' | 'rankUp' | 'errorZoomOut' | 'agentLeave' | 'epicQuest',
      { delta: number; durationMs: number }
    >
    pan: {
      minWorldDist: number
      maxWorldDist: number
      minMs: number
      maxMs: number
      ease: string
    }
    crossRoomPanMinWorldDist: number
    fitSlowDurationMs: number
    epicQuestHoldMs: number
    workstationRefitThreshold: number
    workstationRefitDebounceMs: number
  }

  /**
   * Expressive ease-curve registry.  All tween `ease` strings are stored here so
   * runtime patches and debug panels can swap curves without touching rendering code.
   */
  easing: {
    /** Ease for walk-start motion — slight overshoot at the first step. */
    walkStart: string
    /** Ease for walk-stop motion — natural deceleration into the destination. */
    walkStop: string
    /** Ease for the working typing-shake tween (rhythmic). */
    workingTyping: string
    /** Ease for celebration / reward bounce tweens (bouncy landing). */
    celebration: string
    /** Ease for the waiting sway tween (rhythmic). */
    waitingSway: string
    /** Ease applied to all scale-pop tweens (slight overshoot pop). */
    scalePop: string
  }
}

// ---------------------------------------------------------------------------
// Deep-partial helper
// ---------------------------------------------------------------------------

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

// ---------------------------------------------------------------------------
// Factory defaults — extracted verbatim from workstation-animation.ts
// ---------------------------------------------------------------------------

function makeDefaults(): AnimationConfig {
  return {
    // -----------------------------------------------------------------------
    // Waiting state (lines ~260-288 of workstation-animation.ts)
    // -----------------------------------------------------------------------
    waiting: {
      pulseScaleFactor:    1.06,  // scaleX/Y = CHAR_SCALE * 1.06
      pulseDuration:       900,
      swayAmplitude:       1.2,   // x: 1.2 px
      swayDuration:        600,
      dotPulseAlphaMin:    0.3,   // alpha: 0.3 (trough)
      dotPulseDuration:    600,
      lampDimAlpha:        0.02,
      ledFadeDuration:     500,
      breathDuration:      1000,  // base half-cycle (2–4s full cycle when var added)
      breathDurationVar:   1000,  // random range added each cycle
      breathYOffset:       1,     // chest rises 1 px during breath
    },

    // -----------------------------------------------------------------------
    // Working state (lines ~289-509 of workstation-animation.ts)
    // -----------------------------------------------------------------------
    working: {
      typingAmplitude:         0.8,   // x: 0.8 px
      typingDuration:          400,
      bounceOffset:            2,     // y: WS_SPRITE_Y - 2
      bounceDuration:          800,
      headTiltAngle:           1.5,   // degrees
      headTiltDuration:        1600,
      keyboardGlowAlphaMin:    0.7,   // from: 0.7
      keyboardGlowAlphaMax:    0.9,   // to: 0.9
      keyboardGlowDuration:    800,
      ledPulseAlphaBase:       0.4,   // setAlpha before pulse starts
      ledPulseAlphaPeak:       0.7,   // tween to: 0.7
      ledPulseDuration:        1000,
      lampBrightAlpha:         0.12,
      lampFlickerIntervalMin:  8000,
      lampFlickerIntervalVar:  7000,  // delay: 8000 + Math.random() * 7000
      soundWaveFadeDuration:   1500,
      typingNoteSpawnInterval: 500,
      typingNoteRiseDuration:  800,   // duration of the note fly-up tween
      progressRingDuration:    60_000,
      breathDuration:          1000,  // half-cycle for working breath (2s full cycle)
      breathScaleFactor:       0.98,  // subtle scaleY compression during working breath
    },

    // -----------------------------------------------------------------------
    // Idle state (lines ~510-846 of workstation-animation.ts)
    // -----------------------------------------------------------------------
    idle: {
      breathScaleFactor:      0.97,  // scaleY = CHAR_SCALE * 0.97
      breathDuration:         1500,  // half-cycle for idle breath (3s full cycle)
      breathYOffset:          1,     // chest rises 1 px on each inhale
      sighChance:             0.2,   // probability per cycle (1-in-5) of a sigh
      sighScaleFactor:        0.94,  // deeper scaleY compression during a sigh
      sighYOffset:            2,     // larger Y rise during a sigh (px)
      chairRockAngle:         1.5,   // from: -1.5 to: 1.5 degrees
      chairRockDuration:      4000,
      lookAroundIntervalMin:  8000,
      lookAroundIntervalVar:  7000,  // delay: 8000 + Math.random() * 7000
      stretchIntervalMin:     20000,
      stretchIntervalVar:     10000, // delay: 20000 + Math.random() * 10000
      // Mirrors IDLE_WALK_BREAK_MIN_MS / IDLE_WALK_BREAK_VAR_MS from office-constants.ts.
      // Edit that file for persistent changes; patch here only for runtime overrides.
      walkBreakMin:           9000,
      walkBreakVar:           7000,
      yawnIntervalMin:        65000,
      yawnIntervalVar:        10000, // delay: 65000 + Math.random() * 10000
    },

    // -----------------------------------------------------------------------
    // Transitions (cleanup/setup code in updateAnimation)
    // -----------------------------------------------------------------------
    transitions: {
      moodFadeOutDuration:    200,
      progressRingFadeMs:     300,
      questIconFadeMs:        200,

      // Crossfade blending (Living Lab 1a)
      idleToWorkingMs:            200,
      idleToWorkingScaleY:        0.95,
      idleToWorkingCompressMs:    100,

      workingToIdleMs:            300,
      workingToIdleLiftY:         4,
      workingToIdleTiltAngle:     3,

      idleToWalkingMs:            150,
      idleToWalkingLeanX:         3,

      walkingToIdleOvershootPx:   2,
      walkingToIdleSettleMs:      200,

      anyToWaitingMs:             400,
    },

    // -----------------------------------------------------------------------
    // Monitor glow (lines ~854-870 of workstation-animation.ts)
    // -----------------------------------------------------------------------
    monitor: {
      activeBaseStrength:  1.5,
      activePeakStrength:  3,
      idleBaseStrength:    0.5,
      idlePeakStrength:    1,
      activePulseDuration: 800,
      idlePulseDuration:   2400,
      glowDistance:        6,
      glowQuality:         0.25,
    },

    celebrations: {
      queueGapMs:              400,
      comboWindowMs:           10_000,
      comboCooldownMs:         10_000,
      sameTypeMergeWindowMs:   2000,
      rankUpCooldownMs:        5000,
      taskCompleteCooldownMs:  1000,
      errorCooldownMs:         3000,
      comboTier2Min:           2,
      comboTier3Min:           3,
      comboTierFireMin:        5,
    },

    // -----------------------------------------------------------------------
    // Squash & stretch (Living Lab 1b)
    // -----------------------------------------------------------------------
    squashStretch: {
      walkFootfallScaleY:      0.97,  // subtle Y compression on each footfall
      walkFootfallScaleX:      1.03,  // matching X widening (volume conservation)
      walkFootfallDuration:    80,    // ms per half-cycle (yoyo)

      celebWindupScaleY:       0.85,  // wind-up crouch before big pop
      celebWindupDuration:     120,
      celebStretchScaleY:      1.15,  // upward stretch at peak
      celebStretchDuration:    100,
      celebSettleCount:        3,     // decaying oscillations after pop
      celebSettleAmplitude:    0.06,  // first oscillation scale deviation
      celebSettleDuration:     80,    // ms per settle half-cycle
      celebSettleDecay:        0.5,   // amplitude multiplier per oscillation

      sitCompressScaleY:       0.93,  // compression on chair contact
      sitCompressDuration:     60,    // ms per half-cycle (yoyo)

      taskHopY:               -4,     // px upward at hop apex
      taskHopScaleSquash:      0.9,   // pre-launch squash
      taskHopScaleStretch:     1.1,   // apex stretch
      taskHopDuration:         150,   // ms total for full 3-phase sequence
    },

    camera: {
      pulse: {
        taskComplete:  { delta: 0.02, durationMs: 200 },
        rankUp:        { delta: 0.05, durationMs: 320 },
        errorZoomOut:  { delta: -0.01, durationMs: 280 },
        agentLeave:    { delta: -0.01, durationMs: 200 },
        epicQuest:     { delta: 0.09, durationMs: 400 },
      },
      pan: {
        minWorldDist: 120,
        maxWorldDist: 2200,
        minMs: 400,
        maxMs: 800,
        ease: 'Power2.easeInOut',
      },
      crossRoomPanMinWorldDist: 380,
      fitSlowDurationMs: 1000,
      epicQuestHoldMs: 500,
      workstationRefitThreshold: 3,
      workstationRefitDebounceMs: 400,
    },

    // -----------------------------------------------------------------------
    // Expressive ease curves — used throughout workstation-animation.ts
    // -----------------------------------------------------------------------
    easing: {
      walkStart:      'Back.easeOut',    // slight overshoot at first step
      walkStop:       'Cubic.easeOut',   // natural deceleration to desk
      workingTyping:  'Sine.easeInOut',  // rhythmic typing shake
      celebration:    'Bounce.easeOut',  // reward/task-complete landing
      waitingSway:    'Sine.easeInOut',  // gentle waiting oscillation
      scalePop:       'Back.easeOut',    // all scale tweens — slight pop
    },
  }
}

// ---------------------------------------------------------------------------
// The mutable runtime config — consumers read directly from this object
// ---------------------------------------------------------------------------

export const AnimConfig: AnimationConfig = makeDefaults()

// ---------------------------------------------------------------------------
// Deep-merge a partial patch into AnimConfig
// ---------------------------------------------------------------------------

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    if (sv === undefined) continue
    const tv = target[key]
    if (tv != null && typeof tv === 'object' && !Array.isArray(tv) &&
        sv != null && typeof sv === 'object' && !Array.isArray(sv)) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      target[key] = sv
    }
  }
}

export function patchAnimConfig(patch: DeepPartial<AnimationConfig>): void {
  for (const sectionKey of Object.keys(patch) as Array<keyof AnimationConfig>) {
    const sectionPatch = patch[sectionKey]
    if (sectionPatch == null) continue
    deepMerge(
      AnimConfig[sectionKey] as Record<string, unknown>,
      sectionPatch as Record<string, unknown>,
    )
  }
}

// ---------------------------------------------------------------------------
// Restore all values to factory defaults
// ---------------------------------------------------------------------------

export function resetAnimConfig(): void {
  const defaults = makeDefaults()
  for (const sectionKey of Object.keys(defaults) as Array<keyof AnimationConfig>) {
    const target = AnimConfig[sectionKey] as Record<string, unknown>
    const source = defaults[sectionKey] as Record<string, unknown>
    for (const key of Object.keys(source)) {
      target[key] = source[key]
    }
  }
}

// ---------------------------------------------------------------------------
// Read-only snapshot (useful for serialisation or diff comparisons)
// ---------------------------------------------------------------------------

export function getAnimConfig(): Readonly<AnimationConfig> {
  return AnimConfig
}
