// ---------------------------------------------------------------------------
// sound-engine.ts
// Procedural Web Audio API synth — retro/chiptune sound effects.
// No audio files required. All sounds are synthesized via oscillator nodes
// with gain envelopes. Routed through AudioManager channels (sfx / ui) so
// per-channel volume + mute are respected automatically.
//
// All task-lifecycle / celebration SFX are wired via wireEvents() — prefer
// EventBus events over direct method calls for game-triggered sounds.
// ---------------------------------------------------------------------------

import type Phaser from 'phaser'
import { audioManager } from './audio-manager'
import { EventBus, EVENTS } from './events'
import { AUDIO_KEYS } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Frequency constants (Hz) — note names for readability
// ---------------------------------------------------------------------------

const A4  = 440.00   // task start chime
const A5  = 880.00   // notification ping
const C5  = 523.25
const E5  = 659.25
const G5  = 783.99
const C6  = 1046.50
const B3  = 246.94
const F4  = 349.23

// ---------------------------------------------------------------------------
// Envelope helper
// ---------------------------------------------------------------------------

/** Apply a simple attack→sustain→decay envelope to a GainNode. */
function applyEnvelope(
  gain: GainNode,
  ctx: AudioContext,
  opts: { attack: number; sustain: number; decay: number; peak?: number },
): void {
  const { attack, sustain, decay, peak = 1 } = opts
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + attack)
  gain.gain.setValueAtTime(peak, now + attack + sustain)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + sustain + decay)
}

// ---------------------------------------------------------------------------
// SoundEngine
// ---------------------------------------------------------------------------

// Footstep pitch variants (Hz) — 3 frequencies to reduce repetition
const FOOTSTEP_FREQS = [180, 210, 195] as const

export class SoundEngine {
  /** Phaser scene reference — set once for OGG playback */
  private _scene: Phaser.Scene | null = null
  /** Cycles through footstep variants to avoid repetition */
  private _footstepVariant = 0

  // -------------------------------------------------------------------------
  // Channel routing — delegates to AudioManager for volume + mute
  // -------------------------------------------------------------------------

  private _ctx(): AudioContext | null {
    return audioManager.getContext()
  }

  /** SFX channel gain (game sounds: task, rank, pod, ambient SFX). */
  private _sfx(): GainNode | null {
    return audioManager.getChannel('sfx')
  }

  /** UI channel gain (clicks, toasts, typewriter, toggle). */
  private _ui(): GainNode | null {
    return audioManager.getChannel('ui')
  }

  // -------------------------------------------------------------------------
  // Internal oscillator builder
  // -------------------------------------------------------------------------

  /**
   * Create an oscillator routed through `output` (defaults to sfx channel).
   * Enveloped with attack→sustain→decay.
   */
  private _osc(
    type: OscillatorType,
    freq: number,
    startAt: number,
    stopAt: number,
    gainOpts: { attack: number; sustain: number; decay: number; peak?: number },
    output?: GainNode | null,
  ): void {
    const ctx = this._ctx()
    if (!ctx) return
    const target = output ?? this._sfx()
    if (!target) return

    const gainNode = ctx.createGain()
    gainNode.connect(target)

    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gainNode)

    applyEnvelope(gainNode, ctx, gainOpts)
    osc.start(startAt)
    osc.stop(stopAt)
  }

  // -------------------------------------------------------------------------
  // Sound effects — task lifecycle
  // -------------------------------------------------------------------------

  /**
   * Sine chime at 440 Hz — task dispatched. ~310ms, peak 0.18.
   * Routes through sfx channel.
   */
  taskStart(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sine', A4, now, now + 0.32,
      { attack: 0.005, sustain: 0.08, decay: 0.22, peak: 0.18 })
  }

  /**
   * Ascending arpeggio C5→E5→G5→C6 — task complete reward. ~500ms.
   * Routes through sfx channel.
   */
  taskComplete(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    const step = 0.10
    const env = { attack: 0.004, sustain: 0.04, decay: 0.10, peak: 0.20 }
    ;[C5, E5, G5, C6].forEach((freq, i) => {
      this._osc('sine', freq, now + step * i, now + step * (i + 1) + 0.10, env)
    })
  }

  /**
   * Dissonant tritone sawtooth buzz — task failed / agent error. ~280ms, peak 0.15.
   * Routes through sfx channel.
   */
  taskFail(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sawtooth', B3, now, now + 0.28,
      { attack: 0.004, sustain: 0.08, decay: 0.18, peak: 0.15 })
    this._osc('sawtooth', F4, now, now + 0.28,
      { attack: 0.004, sustain: 0.08, decay: 0.18, peak: 0.10 })
  }

  /**
   * Rank-up fanfare — arpeggio C5→E5→G5→C6 with sustained reverb tail. ~1.4s.
   * Routes through sfx channel.
   */
  levelUp(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    const step = 0.12
    const env = { attack: 0.006, sustain: 0.06, decay: 0.09, peak: 0.25 }
    ;[C5, E5, G5, C6].forEach((freq, i) => {
      this._osc('sine', freq, now + step * i, now + step * (i + 1) + 0.09, env)
    })
    // Reverb tail — two overlapping sines fade to ~1.4s total
    this._osc('sine', C6, now + step * 4, now + step * 4 + 0.8,
      { attack: 0.02, sustain: 0.1, decay: 0.7, peak: 0.15 })
    this._osc('sine', G5, now + step * 4 + 0.1, now + step * 4 + 0.9,
      { attack: 0.02, sustain: 0.08, decay: 0.65, peak: 0.10 })
  }

  /**
   * Noise sweep — pod workflow launched.
   * White noise through bandpass sweeping 150 Hz → 2400 Hz over 400ms.
   * Routes through sfx channel.
   */
  podLaunch(): void {
    const ctx = this._ctx()
    const sfx = this._sfx()
    if (!ctx || !sfx) return
    const now = ctx.currentTime

    const bufLen = Math.ceil(ctx.sampleRate * 0.45)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.setValueAtTime(150, now)
    bpf.frequency.exponentialRampToValueAtTime(2400, now + 0.4)
    bpf.Q.value = 2.0

    const gainNode = ctx.createGain()
    applyEnvelope(gainNode, ctx, { attack: 0.01, sustain: 0.18, decay: 0.20, peak: 0.30 })
    gainNode.connect(sfx)

    src.connect(bpf)
    bpf.connect(gainNode)
    src.start(now)
    src.stop(now + 0.45)
  }

  // -------------------------------------------------------------------------
  // Sound effects — UI
  // -------------------------------------------------------------------------

  /**
   * Noise click for UI toasts — short white noise burst through highpass at 2 kHz.
   * ~60ms. Routes through ui channel.
   */
  toastClick(): void {
    const ctx = this._ctx()
    const ui = this._ui()
    if (!ctx || !ui) return
    const now = ctx.currentTime

    const bufLen = Math.ceil(ctx.sampleRate * 0.06)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const hpf = ctx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = 2000

    const gainNode = ctx.createGain()
    applyEnvelope(gainNode, ctx, { attack: 0.001, sustain: 0.005, decay: 0.04, peak: 0.22 })
    gainNode.connect(ui)

    src.connect(hpf)
    hpf.connect(gainNode)
    src.start(now)
    src.stop(now + 0.06)
  }

  // -------------------------------------------------------------------------
  // Sound effects — ambient / misc
  // -------------------------------------------------------------------------

  /** Short buzz (square wave 200 Hz, 150ms). Routes through sfx channel. */
  agentBlocked(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('square', 200, now, now + 0.15,
      { attack: 0.002, sustain: 0.06, decay: 0.08, peak: 0.25 })
  }

  /**
   * Soft footstep click. Call every 2nd walk frame.
   * distanceFactor 0–1 attenuates volume proportional to camera distance.
   * Cycles through 3 pitch variants. Routes through sfx channel.
   */
  footstep(distanceFactor = 1.0): void {
    if (distanceFactor <= 0.01) return
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    const baseFreq = FOOTSTEP_FREQS[this._footstepVariant % 3]
    this._footstepVariant = (this._footstepVariant + 1) % 3
    const pitchVariance = 1 + (Math.random() * 0.10 - 0.05)
    const freq = baseFreq * pitchVariance
    const peak = 0.12 * Math.min(1, Math.max(0, distanceFactor))
    this._osc('square', freq, now, now + 0.045,
      { attack: 0.002, sustain: 0.008, decay: 0.035, peak })
  }

  /** Sparkle shimmer: sine sweep 2000→4000 Hz, 200ms. Routes through sfx channel. */
  achievement(): void {
    const ctx = this._ctx()
    const sfx = this._sfx()
    if (!ctx || !sfx) return
    const now = ctx.currentTime

    const gainNode = ctx.createGain()
    gainNode.connect(sfx)
    applyEnvelope(gainNode, ctx, { attack: 0.01, sustain: 0.08, decay: 0.12, peak: 0.5 })

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(2000, now)
    osc.frequency.exponentialRampToValueAtTime(4000, now + 0.2)
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + 0.22)
  }

  /** Soft ping (A5 880 Hz, 100ms decay). Routes through ui channel. */
  notification(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sine', A5, now, now + 0.3,
      { attack: 0.005, sustain: 0.02, decay: 0.27, peak: 0.4 }, this._ui())
  }

  /** Error buzz (150 Hz sawtooth, 200ms). Routes through sfx channel. */
  error(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sawtooth', 150, now, now + 0.22,
      { attack: 0.003, sustain: 0.08, decay: 0.13, peak: 0.3 })
  }

  /** Coffee pour: filtered white noise via bandpass 1200 Hz, 600ms. Routes through sfx. */
  coffeePour(): void {
    const ctx = this._ctx()
    const sfx = this._sfx()
    if (!ctx || !sfx) return
    const now = ctx.currentTime

    const bufLen = Math.ceil(ctx.sampleRate * 0.6)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 1200
    bpf.Q.value = 0.8

    const gainNode = ctx.createGain()
    gainNode.connect(sfx)
    applyEnvelope(gainNode, ctx, { attack: 0.05, sustain: 0.2, decay: 0.28, peak: 0.35 })

    source.connect(bpf)
    bpf.connect(gainNode)
    source.start(now)
    source.stop(now + 0.6)
  }

  // -------------------------------------------------------------------------
  // UI sounds
  // -------------------------------------------------------------------------

  /** Bind a Phaser scene for OGG sound playback. Call once after scene create. */
  setScene(scene: Phaser.Scene): void {
    this._scene = scene
  }

  /** Play a loaded OGG audio key via Phaser's sound manager (if available). */
  private _playOGG(key: string, volume = 0.5): boolean {
    if (!this._scene || audioManager.isMuted) return false
    try {
      if (this._scene.cache.audio.exists(key)) {
        this._scene.sound.play(key, { volume })
        return true
      }
    } catch { /* noop — fallback to procedural */ }
    return false
  }

  /** UI click — OGG if loaded, else procedural square 800 Hz. Routes through ui channel. */
  click(): void {
    const key = Math.random() > 0.5 ? AUDIO_KEYS.CLICK_A : AUDIO_KEYS.CLICK_B
    if (this._playOGG(key, 0.5)) return
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('square', 800, now, now + 0.035,
      { attack: 0.001, sustain: 0.01, decay: 0.02, peak: 0.18 }, this._ui())
  }

  /** Approval cue ("ding") 1320 Hz sine. Routes through ui channel. */
  ding(): void {
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sine', 1320, now, now + 0.12,
      { attack: 0.003, sustain: 0.02, decay: 0.08, peak: 0.22 }, this._ui())
  }

  /** Toggle/switch sound — OGG if loaded, else procedural 600 Hz sine. Routes through ui. */
  toggleSwitch(): void {
    const key = Math.random() > 0.5 ? AUDIO_KEYS.SWITCH_A : AUDIO_KEYS.SWITCH_B
    if (this._playOGG(key, 0.4)) return
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    this._osc('sine', 600, now, now + 0.05,
      { attack: 0.002, sustain: 0.015, decay: 0.03, peak: 0.2 }, this._ui())
  }

  /** Typewriter keystroke — OGG if loaded, else procedural. Routes through ui channel. */
  typewriter(): void {
    const tapKey = Math.random() > 0.5 ? AUDIO_KEYS.TAP_A : AUDIO_KEYS.TAP_B
    if (this._playOGG(tapKey, 0.25)) return
    const ctx = this._ctx()
    if (!ctx) return
    const now = ctx.currentTime
    const freq = 600 + Math.random() * 600
    this._osc('square', freq, now, now + 0.018,
      { attack: 0.001, sustain: 0.005, decay: 0.01, peak: 0.12 }, this._ui())
  }

  // -------------------------------------------------------------------------
  // Volume controls
  // SoundEngine routes through AudioManager channels — volume + mute are
  // controlled at the AudioManager level. These stubs preserve the public
  // interface so existing call sites (OfficeScene M-key handler, etc.) do not
  // break. OfficeScene should call audioManager.toggleMute() for global mute.
  // -------------------------------------------------------------------------

  /** @deprecated Use audioManager.mute() — SFX mute is now channel-level. */
  mute(): void { /* no-op: handled by audioManager channel routing */ }
  /** @deprecated Use audioManager.unmute() — SFX unmute is now channel-level. */
  unmute(): void { /* no-op: handled by audioManager channel routing */ }
  /** @deprecated Use audioManager.toggleMute(). */
  toggleMute(): void { /* no-op: handled by audioManager channel routing */ }
  /** @deprecated Use audioManager.setChannelVolume('sfx', v). */
  setVolume(_v: number): void { /* no-op */ }

  get isMuted(): boolean { return audioManager.isMuted }
  get volume(): number { return audioManager.masterVolume }

  // -------------------------------------------------------------------------
  // EventBus integration — single source of truth for game-event SFX
  //
  // Wired events:
  //   TASK_DISPATCHED → taskStart   (sine chime 440 Hz)
  //   TASK_COMPLETED  → taskComplete (ascending arpeggio)
  //   AGENT_ERROR     → taskFail    (sawtooth buzz)
  //   RANK_UP         → levelUp     (fanfare)
  //   POD_LAUNCHED    → podLaunch   (noise sweep)
  //   NOTIFICATION    → toastClick  (noise click, ui channel)
  //   DESK_CLICKED    → click       (ui click)
  //   AGENT_CLICKED   → click       (ui click)
  //
  // Call wireEvents() once after scene create (e.g. after first user gesture).
  // Call unwireEvents() on scene teardown to prevent leaks.
  // -------------------------------------------------------------------------

  private _wired = false

  // Stable refs for EventBus.off()
  private _cbTaskStart  = () => this.taskStart()
  private _cbTaskDone   = () => this.taskComplete()
  private _cbTaskFail   = () => this.taskFail()
  private _cbRankUp     = () => this.levelUp()
  private _cbPodLaunch  = () => this.podLaunch()
  private _cbToast      = () => this.toastClick()
  private _cbClick      = () => this.click()

  /** Wire all EventBus → SFX mappings. Idempotent. */
  wireEvents(): void {
    if (this._wired) return
    this._wired = true
    EventBus.on(EVENTS.TASK_DISPATCHED, this._cbTaskStart)
    EventBus.on(EVENTS.TASK_COMPLETED,  this._cbTaskDone)
    EventBus.on(EVENTS.AGENT_ERROR,     this._cbTaskFail)
    EventBus.on(EVENTS.RANK_UP,         this._cbRankUp)
    EventBus.on(EVENTS.POD_LAUNCHED,    this._cbPodLaunch)
    EventBus.on(EVENTS.NOTIFICATION,    this._cbToast)
    EventBus.on(EVENTS.DESK_CLICKED,    this._cbClick)
    EventBus.on(EVENTS.AGENT_CLICKED,   this._cbClick)
  }

  /** Remove all EventBus listeners. Call on scene teardown. */
  unwireEvents(): void {
    if (!this._wired) return
    this._wired = false
    EventBus.off(EVENTS.TASK_DISPATCHED, this._cbTaskStart)
    EventBus.off(EVENTS.TASK_COMPLETED,  this._cbTaskDone)
    EventBus.off(EVENTS.AGENT_ERROR,     this._cbTaskFail)
    EventBus.off(EVENTS.RANK_UP,         this._cbRankUp)
    EventBus.off(EVENTS.POD_LAUNCHED,    this._cbPodLaunch)
    EventBus.off(EVENTS.NOTIFICATION,    this._cbToast)
    EventBus.off(EVENTS.DESK_CLICKED,    this._cbClick)
    EventBus.off(EVENTS.AGENT_CLICKED,   this._cbClick)
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const soundEngine = new SoundEngine()
