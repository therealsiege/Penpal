// ---------------------------------------------------------------------------
// sound-engine.ts
// Procedural Web Audio API synth — retro/chiptune sound effects.
// No audio files required. All sounds are generated from oscillator nodes
// with gain envelopes. Use the exported `soundEngine` singleton.
// ---------------------------------------------------------------------------

import type Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { AUDIO_KEYS } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Frequency constants (Hz) — note names for readability
// ---------------------------------------------------------------------------

const A5  = 880.00
const C5  = 523.25
const E5  = 659.25
const G5  = 783.99
const C6  = 1046.50

// ---------------------------------------------------------------------------
// Envelope helpers
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

export class SoundEngine {
  private _ctx: AudioContext | null = null
  private _masterGain: GainNode | null = null
  private _muted = false
  private _volume = 0.3
  /** Phaser scene reference — set once for OGG playback */
  private _scene: Phaser.Scene | null = null

  // -------------------------------------------------------------------------
  // Lazy AudioContext init — must be triggered after a user gesture.
  // -------------------------------------------------------------------------

  private _ensureContext(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext()
      this._masterGain = this._ctx.createGain()
      this._masterGain.gain.value = this._muted ? 0 : this._volume
      this._masterGain.connect(this._ctx.destination)
    }
    if (this._ctx.state === 'suspended') {
      void this._ctx.resume()
    }
    return this._ctx
  }

  /** Internal: create an oscillator routed through the master gain. */
  private _osc(
    type: OscillatorType,
    freq: number,
    startAt: number,
    stopAt: number,
    gainOpts: { attack: number; sustain: number; decay: number; peak?: number },
  ): void {
    const ctx = this._ensureContext()
    const gainNode = ctx.createGain()
    gainNode.connect(this._masterGain!)

    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gainNode)

    applyEnvelope(gainNode, ctx, gainOpts)
    osc.start(startAt)
    osc.stop(stopAt)
  }

  // -------------------------------------------------------------------------
  // Sound effects
  // -------------------------------------------------------------------------

  /** Short buzz (square wave 200 Hz, 150ms, sharp cutoff). */
  agentBlocked(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('square', 200, now, now + 0.15,
      { attack: 0.002, sustain: 0.06, decay: 0.08, peak: 0.25 })
  }

  /** Triumphant arpeggio (C5→E5→G5→C6), 60ms each, sine. */
  levelUp(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const step = 0.07
    const env = { attack: 0.004, sustain: 0.03, decay: 0.06, peak: 0.65 }
    const notes = [C5, E5, G5, C6]
    notes.forEach((freq, i) => {
      this._osc('sine', freq, now + step * i, now + step * (i + 1) + 0.06, env)
    })
    // Reverb tail — soft sine at C5 fading out
    this._osc('sine', C5, now + step * 4, now + step * 4 + 0.4,
      { attack: 0.01, sustain: 0.05, decay: 0.35, peak: 0.2 })
  }

  /** Sparkle shimmer: sine sweep from 2000 Hz to 4000 Hz over 200ms. */
  achievement(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const gainNode = ctx.createGain()
    gainNode.connect(this._masterGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.01, sustain: 0.08, decay: 0.12, peak: 0.5 })
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(2000, now)
    osc.frequency.exponentialRampToValueAtTime(4000, now + 0.2)
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + 0.22)
  }

  /** Soft ping (A5, sine, 100ms gentle decay). */
  notification(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('sine', A5, now, now + 0.3,
      { attack: 0.005, sustain: 0.02, decay: 0.27, peak: 0.4 })
  }

  /** Bind a Phaser scene for OGG sound playback. Call once after scene create. */
  setScene(scene: Phaser.Scene): void {
    this._scene = scene
  }

  /** Play a loaded OGG audio key via Phaser's sound manager (if available). */
  private _playOGG(key: string, volume = 0.5): boolean {
    if (!this._scene || this._muted) return false
    try {
      if (this._scene.cache.audio.exists(key)) {
        this._scene.sound.play(key, { volume: volume * this._volume })
        return true
      }
    } catch { /* noop — fallback to procedural */ }
    return false
  }

  /** UI click — uses OGG click if loaded, else procedural. */
  click(): void {
    const key = Math.random() > 0.5 ? AUDIO_KEYS.CLICK_A : AUDIO_KEYS.CLICK_B
    if (this._playOGG(key, 0.5)) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('square', 800, now, now + 0.035,
      { attack: 0.001, sustain: 0.01, decay: 0.02, peak: 0.18 })
  }

  /** Subtle approval cue ("ding"), gated by mute/volume via master gain. */
  ding(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('sine', 1320, now, now + 0.12,
      { attack: 0.003, sustain: 0.02, decay: 0.08, peak: 0.22 })
  }

  /** Toggle/switch sound — uses OGG switch if loaded, else procedural. */
  toggleSwitch(): void {
    const key = Math.random() > 0.5 ? AUDIO_KEYS.SWITCH_A : AUDIO_KEYS.SWITCH_B
    if (this._playOGG(key, 0.4)) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('sine', 600, now, now + 0.05,
      { attack: 0.002, sustain: 0.015, decay: 0.03, peak: 0.2 })
  }

  /** Error buzz (150 Hz sawtooth, 200ms). */
  error(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('sawtooth', 150, now, now + 0.22,
      { attack: 0.003, sustain: 0.08, decay: 0.13, peak: 0.3 })
  }

  /** Coffee pour: filtered white noise via bandpass, 500ms fade. */
  coffeePour(): void {
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const bufferSize = ctx.sampleRate * 0.6
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 1200
    bpf.Q.value = 0.8

    const gainNode = ctx.createGain()
    gainNode.connect(this._masterGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.05, sustain: 0.2, decay: 0.28, peak: 0.35 })

    source.connect(bpf)
    bpf.connect(gainNode)
    source.start(now)
    source.stop(now + 0.6)
  }

  /**
   * Typewriter keystroke — uses OGG tap if loaded, else procedural.
   * Call once per character typed.
   */
  typewriter(): void {
    const tapKey = Math.random() > 0.5 ? AUDIO_KEYS.TAP_A : AUDIO_KEYS.TAP_B
    if (this._playOGG(tapKey, 0.25)) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const freq = 600 + Math.random() * 600
    this._osc('square', freq, now, now + 0.018,
      { attack: 0.001, sustain: 0.005, decay: 0.01, peak: 0.12 })
  }

  // -------------------------------------------------------------------------
  // Volume controls
  // -------------------------------------------------------------------------

  mute(): void {
    this._muted = true
    if (this._masterGain) this._masterGain.gain.value = 0
  }

  unmute(): void {
    this._muted = false
    if (this._masterGain) this._masterGain.gain.value = this._volume
  }

  toggleMute(): void {
    this._muted ? this.unmute() : this.mute()
  }

  /** Set master volume. Clamped to [0, 1]. */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this._masterGain && !this._muted) {
      this._masterGain.gain.value = this._volume
    }
  }

  get isMuted(): boolean {
    return this._muted
  }

  get volume(): number {
    return this._volume
  }

  // -------------------------------------------------------------------------
  // EventBus integration
  // Lightweight hooks (toasts, clicks). Celebrations use soundEngine directly.
  // Call once at app startup (e.g. OfficeScene after first user interaction).
  // -------------------------------------------------------------------------

  /**
   * Wire EventBus sounds: NOTIFICATION, DESK_CLICKED, AGENT_CLICKED.
   * Safe to call multiple times — stores refs for cleanup.
   */
  private _wired = false
  private _cbNotif      = () => this.notification()
  private _cbClick      = () => this.click()

  wireEvents(): void {
    if (this._wired) return
    this._wired = true
    EventBus.on(EVENTS.NOTIFICATION,   this._cbNotif)
    EventBus.on(EVENTS.DESK_CLICKED,   this._cbClick)
    EventBus.on(EVENTS.AGENT_CLICKED,  this._cbClick)
  }

  /** Remove all EventBus listeners (call on scene teardown). */
  unwireEvents(): void {
    if (!this._wired) return
    this._wired = false
    EventBus.off(EVENTS.NOTIFICATION,   this._cbNotif)
    EventBus.off(EVENTS.DESK_CLICKED,   this._cbClick)
    EventBus.off(EVENTS.AGENT_CLICKED,  this._cbClick)
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const soundEngine = new SoundEngine()
