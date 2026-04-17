// ---------------------------------------------------------------------------
// audio-manager.ts
// Procedural Web Audio API synth for UI feedback sounds.
// Exposes a dedicated `ui` channel (GainNode) at low volume so game sounds
// and UI sounds can be controlled independently.
// Use the exported `audioManager` singleton.
// ---------------------------------------------------------------------------

import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Envelope helper
// ---------------------------------------------------------------------------

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
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private _ctx: AudioContext | null = null
  /** Master output node — all channels route here */
  private _masterGain: GainNode | null = null
  /** Dedicated UI channel gain — lower volume, separate from game sfx */
  private _uiGain: GainNode | null = null

  private _muted = false
  private _masterVolume = 0.35
  private _uiVolume = 0.25   // ui channel is quieter than game sfx

  // -------------------------------------------------------------------------
  // Lazy AudioContext init — must be triggered after a user gesture.
  // -------------------------------------------------------------------------

  private _ensureContext(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext()

      this._masterGain = this._ctx.createGain()
      this._masterGain.gain.value = this._muted ? 0 : this._masterVolume
      this._masterGain.connect(this._ctx.destination)

      this._uiGain = this._ctx.createGain()
      this._uiGain.gain.value = this._uiVolume
      this._uiGain.connect(this._masterGain)
    }
    if (this._ctx.state === 'suspended') {
      void this._ctx.resume()
    }
    return this._ctx
  }

  // -------------------------------------------------------------------------
  // Low-level oscillator builder (routes through ui channel)
  // -------------------------------------------------------------------------

  private _osc(
    type: OscillatorType,
    freq: number,
    startAt: number,
    stopAt: number,
    gainOpts: { attack: number; sustain: number; decay: number; peak?: number },
  ): void {
    const ctx = this._ensureContext()
    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, gainOpts)

    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gainNode)
    osc.start(startAt)
    osc.stop(stopAt)
  }

  /** Create a noise buffer source routed through a bandpass filter into the ui channel. */
  private _noise(
    durationSec: number,
    filterFreq: number,
    filterQ: number,
    gainOpts: { attack: number; sustain: number; decay: number; peak?: number },
  ): void {
    const ctx = this._ensureContext()
    const sampleRate = ctx.sampleRate
    const bufSize = Math.ceil(sampleRate * durationSec)
    const buf = ctx.createBuffer(1, bufSize, sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = filterFreq
    bpf.Q.value = filterQ

    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, gainOpts)

    src.connect(bpf)
    bpf.connect(gainNode)
    src.start(ctx.currentTime)
    src.stop(ctx.currentTime + durationSec)
  }

  // -------------------------------------------------------------------------
  // Toast notification sounds (by severity)
  // -------------------------------------------------------------------------

  /** Soft chime — info toast. Two-note ascending sine (D5→A5). */
  toastInfo(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const env = { attack: 0.008, sustain: 0.04, decay: 0.18, peak: 0.55 }
    this._osc('sine', 587.33, now,        now + 0.24, env)  // D5
    this._osc('sine', 880.00, now + 0.1,  now + 0.34, env)  // A5
  }

  /** Alert tone — warning toast. Short sawtooth chord (E4+B4) with quick decay. */
  toastWarn(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const env = { attack: 0.004, sustain: 0.06, decay: 0.14, peak: 0.45 }
    this._osc('sawtooth', 329.63, now,       now + 0.22, env)  // E4
    this._osc('sawtooth', 493.88, now + 0.02, now + 0.22, env)  // B4
  }

  /** Error buzz — error toast. Low sawtooth + downward pitch sweep. */
  toastError(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.004, sustain: 0.05, decay: 0.18, peak: 0.5 })

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22)
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  /** Success ding — success toast. Fast C5→E5→G5 arpeggio, sine. */
  toastSuccess(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const step = 0.06
    const env = { attack: 0.004, sustain: 0.025, decay: 0.08, peak: 0.55 }
    this._osc('sine', 523.25, now,          now + 0.16, env)  // C5
    this._osc('sine', 659.25, now + step,   now + 0.22, env)  // E5
    this._osc('sine', 783.99, now + step*2, now + 0.28, env)  // G5
    // Soft tail
    this._osc('sine', 523.25, now + step*3, now + 0.45,
      { attack: 0.01, sustain: 0.04, decay: 0.22, peak: 0.22 })
  }

  /**
   * Play a toast sound matched to the toast severity type.
   * Call once per `showToast()` invocation.
   */
  toastSound(type: 'info' | 'success' | 'warning' | 'error'): void {
    switch (type) {
      case 'info':    this.toastInfo();    break
      case 'success': this.toastSuccess(); break
      case 'warning': this.toastWarn();    break
      case 'error':   this.toastError();   break
    }
  }

  // -------------------------------------------------------------------------
  // Panel interaction sounds
  // -------------------------------------------------------------------------

  /**
   * Panel open whoosh — ascending bandpass noise sweep (150ms).
   * Low-volume, subtle — announces that a panel appeared.
   */
  panelOpen(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const dur = 0.18
    const bufSize = Math.ceil(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.setValueAtTime(800, now)
    bpf.frequency.exponentialRampToValueAtTime(2400, now + dur)
    bpf.Q.value = 1.2

    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.01, sustain: 0.06, decay: 0.1, peak: 0.4 })

    src.connect(bpf)
    bpf.connect(gainNode)
    src.start(now)
    src.stop(now + dur + 0.02)
  }

  /**
   * Panel close whoosh — descending bandpass noise sweep (150ms).
   * Mirror of panelOpen but pitch descends.
   */
  panelClose(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const dur = 0.15
    const bufSize = Math.ceil(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.setValueAtTime(2000, now)
    bpf.frequency.exponentialRampToValueAtTime(600, now + dur)
    bpf.Q.value = 1.2

    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.005, sustain: 0.05, decay: 0.09, peak: 0.35 })

    src.connect(bpf)
    bpf.connect(gainNode)
    src.start(now)
    src.stop(now + dur + 0.02)
  }

  // -------------------------------------------------------------------------
  // Button sounds
  // -------------------------------------------------------------------------

  /**
   * Button hover tick — very soft, short square pulse (volume ~0.05 effective).
   * Called on pointerover of interactive workstation hit areas.
   */
  buttonHover(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    // Very low peak (0.05 / _uiVolume channels down further)
    applyEnvelope(gainNode, ctx, { attack: 0.001, sustain: 0.004, decay: 0.008, peak: 0.2 })

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 1400
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + 0.015)
  }

  /**
   * Button click — crisp short click (volume ~0.1 effective).
   * Called on pointerdown of interactive workstation hit areas.
   */
  buttonClick(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    const gainNode = ctx.createGain()
    gainNode.connect(this._uiGain!)
    applyEnvelope(gainNode, ctx, { attack: 0.001, sustain: 0.008, decay: 0.02, peak: 0.4 })

    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 900
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + 0.032)
  }

  /**
   * Tab / selection change — soft switch sound (sine at 660Hz, 80ms).
   * Called when keyboard agent selection cycles via Tab key.
   */
  tabSwitch(): void {
    if (this._muted) return
    const ctx = this._ensureContext()
    const now = ctx.currentTime
    this._osc('sine', 660, now, now + 0.09,
      { attack: 0.004, sustain: 0.02, decay: 0.065, peak: 0.35 })
  }

  // -------------------------------------------------------------------------
  // Volume / mute controls
  // -------------------------------------------------------------------------

  mute(): void {
    this._muted = true
    if (this._masterGain) this._masterGain.gain.value = 0
  }

  unmute(): void {
    this._muted = false
    if (this._masterGain) this._masterGain.gain.value = this._masterVolume
  }

  toggleMute(): void {
    this._muted ? this.unmute() : this.mute()
  }

  setMasterVolume(v: number): void {
    this._masterVolume = Math.max(0, Math.min(1, v))
    if (this._masterGain && !this._muted) {
      this._masterGain.gain.value = this._masterVolume
    }
  }

  setUiVolume(v: number): void {
    this._uiVolume = Math.max(0, Math.min(1, v))
    if (this._uiGain) this._uiGain.gain.value = this._uiVolume
  }

  get isMuted(): boolean { return this._muted }

  // -------------------------------------------------------------------------
  // EventBus integration
  // -------------------------------------------------------------------------

  private _wired = false
  private _cbSelectionChanged = () => this.tabSwitch()

  /**
   * Wire EventBus listeners for UI sounds.
   * Call once after the game is ready (e.g. first user interaction).
   * Safe to call multiple times — guards against double-wiring.
   */
  wireEvents(): void {
    if (this._wired) return
    this._wired = true
    EventBus.on(EVENTS.SELECTION_CHANGED, this._cbSelectionChanged)
  }

  /** Remove all EventBus listeners (call on scene teardown). */
  unwireEvents(): void {
    if (!this._wired) return
    this._wired = false
    EventBus.off(EVENTS.SELECTION_CHANGED, this._cbSelectionChanged)
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audioManager = new AudioManager()
