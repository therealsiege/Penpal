// ---------------------------------------------------------------------------
// audio-manager.ts
// AudioManager singleton — ambient soundscape engine for the lab.
//
// Provides a channel-based Web Audio API wrapper with:
//   - Lazy AudioContext init (triggers on first user interaction)
//   - 4 named channels: ambient / sfx / ui / music
//   - Master volume + per-channel volumes
//   - M key mute toggle with localStorage persistence
//   - Fade helpers (fadeIn / fadeOut / crossfade)
//   - Procedural ambient soundscape:
//     - Lab hum loop (low-frequency drone)
//     - Keyboard clatter (scales with working agent count)
//     - Equipment chirps (random, ~30s interval)
//     - Day/night audio shift (phase affects hum frequency + ambient gain)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelName = 'ambient' | 'sfx' | 'ui' | 'music'
export type TimePhase = 'morning' | 'day' | 'evening' | 'night'

interface AudioState {
  masterVolume: number
  muted: boolean
  channelVolumes: Record<ChannelName, number>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penny-audio-state'

const CHANNEL_DEFAULTS: Record<ChannelName, number> = {
  ambient: 0.35,
  sfx:     0.80,
  ui:      0.60,
  music:   0.25,
}

// Hum base frequency per phase (Hz)
const PHASE_HUM_FREQ: Record<TimePhase, number> = {
  morning: 55,   // brighter, higher hum
  day:     48,   // standard lab drone
  evening: 42,   // slightly mellower
  night:   36,   // low, quiet rumble
}

// Ambient gain multiplier per phase (multiplied on top of channel volume)
const PHASE_AMBIENT_GAIN: Record<TimePhase, number> = {
  morning: 0.90,
  day:     1.00,
  evening: 0.80,
  night:   0.55,
}

// Keyboard clatter interval range ms — scales by working agent count
const KB_MIN_INTERVAL = 180
const KB_MAX_INTERVAL = 800

// Equipment chirp interval range ms
const CHIRP_MIN_INTERVAL = 18_000
const CHIRP_MAX_INTERVAL = 45_000

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private _ctx: AudioContext | null = null
  private _masterGain: GainNode | null = null

  // Per-channel gain nodes (connected to master)
  private _channelGains: Record<ChannelName, GainNode | null> = {
    ambient: null,
    sfx:     null,
    ui:      null,
    music:   null,
  }

  // State
  private _muted = false
  private _masterVolume = 0.7
  private _channelVolumes: Record<ChannelName, number> = { ...CHANNEL_DEFAULTS }

  // Ambient soundscape nodes
  private _labHumOsc: OscillatorNode | null = null
  private _labHumGain: GainNode | null = null
  private _labNoiseSource: AudioBufferSourceNode | null = null
  private _labNoiseGain: GainNode | null = null
  private _ambientRunning = false

  // Timing handles
  private _kbClatterTimeout: ReturnType<typeof setTimeout> | null = null
  private _chirpTimeout: ReturnType<typeof setTimeout> | null = null

  // Reactive state
  private _workingAgentCount = 0
  private _timePhase: TimePhase = 'day'

  // Set to true if AudioContext is permanently unavailable (policy block, old browser, etc.)
  private _disabled = false

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  private static _instance: AudioManager | null = null
  static getInstance(): AudioManager {
    if (!AudioManager._instance) AudioManager._instance = new AudioManager()
    return AudioManager._instance
  }

  private constructor() {
    this._loadState()
  }

  // -------------------------------------------------------------------------
  // AudioContext — lazy init after user gesture
  // -------------------------------------------------------------------------

  private _ensureContext(): AudioContext | null {
    if (this._disabled) return null
    if (!this._ctx) {
      try {
        this._ctx = new AudioContext()
      } catch (err) {
        // AudioContext can be blocked by browser autoplay policy, sandboxed iframes,
        // or missing platform support. Degrade gracefully — silence all audio.
        console.warn('[AudioManager] AudioContext init failed — audio disabled:', err)
        this._disabled = true
        return null
      }

      this._masterGain = this._ctx.createGain()
      this._masterGain.gain.value = this._muted ? 0 : this._masterVolume
      this._masterGain.connect(this._ctx.destination)

      // Create channel gains
      for (const name of ['ambient', 'sfx', 'ui', 'music'] as ChannelName[]) {
        const g = this._ctx.createGain()
        g.gain.value = this._channelVolumes[name]
        g.connect(this._masterGain)
        this._channelGains[name] = g
      }
    }
    if (this._ctx.state === 'suspended') void this._ctx.resume()
    return this._ctx
  }

  /** Returns the GainNode for the given channel, or null if audio is unavailable. */
  getChannel(name: ChannelName): GainNode | null {
    this._ensureContext()
    return this._channelGains[name]
  }

  /** True if AudioContext failed to initialize (policy block, unsupported platform, etc.). */
  get isDisabled(): boolean { return this._disabled }

  // -------------------------------------------------------------------------
  // Volume & mute
  // -------------------------------------------------------------------------

  setMasterVolume(v: number): void {
    this._masterVolume = Math.max(0, Math.min(1, v))
    if (this._masterGain && this._ctx && !this._muted) {
      this._masterGain.gain.setTargetAtTime(this._masterVolume, this._ctx.currentTime, 0.05)
    }
    this._saveState()
  }

  setChannelVolume(name: ChannelName, v: number): void {
    this._channelVolumes[name] = Math.max(0, Math.min(1, v))
    const g = this._channelGains[name]
    if (g && this._ctx) {
      g.gain.setTargetAtTime(this._channelVolumes[name], this._ctx.currentTime, 0.05)
    }
    this._saveState()
  }

  mute(): void {
    this._muted = true
    if (this._masterGain && this._ctx) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05)
    }
    this._saveState()
  }

  unmute(): void {
    this._muted = false
    if (this._masterGain && this._ctx) {
      this._masterGain.gain.setTargetAtTime(this._masterVolume, this._ctx.currentTime, 0.05)
    }
    this._saveState()
  }

  toggleMute(): void {
    this._muted ? this.unmute() : this.mute()
  }

  get isMuted(): boolean { return this._muted }
  get masterVolume(): number { return this._masterVolume }

  // -------------------------------------------------------------------------
  // Fade helpers
  // -------------------------------------------------------------------------

  /** Fade a channel from 0 → its stored volume over `ms` milliseconds. */
  fadeChannelIn(name: ChannelName, ms = 1000): void {
    const g = this._channelGains[name]
    if (!g || !this._ctx) return
    const now = this._ctx.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(this._channelVolumes[name], now + ms / 1000)
  }

  /** Fade a channel to 0 over `ms` milliseconds. */
  fadeChannelOut(name: ChannelName, ms = 1000): void {
    const g = this._channelGains[name]
    if (!g || !this._ctx) return
    const now = this._ctx.currentTime
    g.gain.setValueAtTime(g.gain.value, now)
    g.gain.linearRampToValueAtTime(0, now + ms / 1000)
  }

  /**
   * Cross-fade from channelA → channelB over `ms` milliseconds.
   * Restores channelA's stored volume after fade.
   */
  crossfade(from: ChannelName, to: ChannelName, ms = 1500): void {
    this.fadeChannelOut(from, ms)
    setTimeout(() => {
      const g = this._channelGains[from]
      if (g) g.gain.value = this._channelVolumes[from]
    }, ms + 50)
    this.fadeChannelIn(to, ms)
  }

  // -------------------------------------------------------------------------
  // Time phase — day/night audio shift
  // -------------------------------------------------------------------------

  setTimePhase(phase: TimePhase): void {
    if (this._timePhase === phase) return
    this._timePhase = phase
    this._applyPhaseAudio()
  }

  /**
   * Day/night audio shift — called whenever `_timePhase` changes.
   *
   * Two parameters transition smoothly via Web Audio `setTargetAtTime`:
   *   - Hum oscillator frequency: lower at night (36 Hz rumble) → higher at morning (55 Hz).
   *     `setTargetAtTime(target, now, 1.2)` reaches ~95% of target in ~3.6 s (time-constant × 3).
   *   - Ambient gain: night is at 55% of day level; transitions over ~6 s (time-constant 2.0).
   *     Both the primary hum gain and the HVAC noise gain track the same scale factor.
   *
   * PHASE_HUM_FREQ and PHASE_AMBIENT_GAIN tables at the top of this file define each phase's
   * target values — edit those to tune the soundscape without touching this method.
   */
  private _applyPhaseAudio(): void {
    if (!this._ctx || !this._labHumOsc || !this._labHumGain) return

    const targetFreq = PHASE_HUM_FREQ[this._timePhase]
    const ambientScale = PHASE_AMBIENT_GAIN[this._timePhase]
    const now = this._ctx.currentTime

    // Smooth pitch shift: time-constant 1.2 s → ~95% of target in ~3.6 s
    this._labHumOsc.frequency.setTargetAtTime(targetFreq, now, 1.2)

    // Smooth gain shift: time-constant 2.0 s → ~95% of target in ~6 s
    const targetGain = this._channelVolumes.ambient * ambientScale
    this._labHumGain.gain.setTargetAtTime(targetGain * 0.45, now, 2.0)

    if (this._labNoiseGain) {
      this._labNoiseGain.gain.setTargetAtTime(targetGain * 0.12, now, 2.0)
    }
  }

  // -------------------------------------------------------------------------
  // Working agent count — scales keyboard clatter intensity
  // -------------------------------------------------------------------------

  setWorkingAgentCount(count: number): void {
    const prev = this._workingAgentCount
    this._workingAgentCount = Math.max(0, count)
    // Re-schedule clatter if count changed meaningfully
    if (Math.abs(prev - this._workingAgentCount) >= 1 && this._ambientRunning) {
      this._scheduleKbClatter()
    }
  }

  // -------------------------------------------------------------------------
  // Ambient soundscape — start / stop
  // -------------------------------------------------------------------------

  /** Start ambient soundscape. Call after first user interaction. No-op if audio is disabled. */
  startAmbient(): void {
    if (this._ambientRunning || this._disabled) return
    const ctx = this._ensureContext()
    if (!ctx) return  // AudioContext unavailable — silent degradation
    this._ambientRunning = true

    this._startLabHum(ctx)
    this._startLabNoise(ctx)
    this._scheduleKbClatter()
    this._scheduleChirp()
  }

  /** Stop and release all ambient nodes. */
  stopAmbient(): void {
    this._ambientRunning = false

    if (this._labHumOsc) {
      try { this._labHumOsc.stop() } catch { /* already stopped */ }
      this._labHumOsc = null
      this._labHumGain = null
    }
    if (this._labNoiseSource) {
      try { this._labNoiseSource.stop() } catch { /* already stopped */ }
      this._labNoiseSource = null
      this._labNoiseGain = null
    }
    if (this._kbClatterTimeout) { clearTimeout(this._kbClatterTimeout); this._kbClatterTimeout = null }
    if (this._chirpTimeout) { clearTimeout(this._chirpTimeout); this._chirpTimeout = null }
  }

  // -------------------------------------------------------------------------
  // Ambient internals
  // -------------------------------------------------------------------------

  /** Low-frequency lab drone: dual oscillators (fundamental + 5th above). */
  private _startLabHum(ctx: AudioContext): void {
    const ambientGain = this._channelGains.ambient
    if (!ambientGain) return
    const phaseScale = PHASE_AMBIENT_GAIN[this._timePhase]
    const baseFreq = PHASE_HUM_FREQ[this._timePhase]

    // Primary drone
    const humGain = ctx.createGain()
    humGain.gain.value = this._channelVolumes.ambient * phaseScale * 0.45
    humGain.connect(ambientGain)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = baseFreq

    // Sub-harmonic layer (octave below, adds body)
    const subOsc = ctx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = baseFreq / 2

    // Light wavering (0.08 Hz LFO → ±2 Hz pitch wobble)
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 2
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)

    osc.connect(humGain)
    subOsc.connect(humGain)

    osc.start()
    subOsc.start()
    lfo.start()

    this._labHumOsc = osc
    this._labHumGain = humGain
  }

  /** Continuous shaped noise: bandpass-filtered texture for HVAC / room tone. */
  private _startLabNoise(ctx: AudioContext): void {
    const ambientGain = this._channelGains.ambient
    if (!ambientGain) return
    const phaseScale = PHASE_AMBIENT_GAIN[this._timePhase]

    // 3-second looping noise buffer
    const bufLen = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    // Bandpass around 200 Hz — HVAC / ventilation rumble
    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 200
    bpf.Q.value = 1.5

    // High-shelf cut above 500 Hz — keeps it dark/muffled
    const shelf = ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 500
    shelf.gain.value = -18

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = this._channelVolumes.ambient * phaseScale * 0.12

    src.connect(bpf)
    bpf.connect(shelf)
    shelf.connect(noiseGain)
    noiseGain.connect(ambientGain)
    src.start()

    this._labNoiseSource = src
    this._labNoiseGain = noiseGain
  }

  /** Schedule a keyboard clatter burst. Interval scales with working agent count. */
  private _scheduleKbClatter(): void {
    if (this._kbClatterTimeout) clearTimeout(this._kbClatterTimeout)
    if (!this._ambientRunning) return

    const agentWeight = Math.min(this._workingAgentCount, 8) / 8  // 0..1
    const interval = KB_MAX_INTERVAL - agentWeight * (KB_MAX_INTERVAL - KB_MIN_INTERVAL)
    const jitter = (Math.random() - 0.5) * interval * 0.4

    this._kbClatterTimeout = setTimeout(() => {
      if (!this._ambientRunning) return
      this._playKbBurst()
      this._scheduleKbClatter()
    }, Math.max(80, interval + jitter))
  }

  /** Play a short burst of keyboard typing (2-8 keystrokes). */
  private _playKbBurst(): void {
    if (!this._ctx || this._muted) return
    const ctx = this._ctx
    const sfxGain = this._channelGains.sfx
    if (!sfxGain) return
    const burstLen = 2 + Math.floor(Math.random() * 7)  // 2..8 keys
    const keyInterval = 0.04 + Math.random() * 0.06

    for (let i = 0; i < burstLen; i++) {
      const delay = i * keyInterval
      const freq = 500 + Math.random() * 700
      const now = ctx.currentTime + delay

      const g = ctx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.07, now + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018)
      g.connect(sfxGain)

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = freq
      osc.connect(g)
      osc.start(now)
      osc.stop(now + 0.025)
    }
  }

  /** Schedule a random equipment chirp. */
  private _scheduleChirp(): void {
    if (this._chirpTimeout) clearTimeout(this._chirpTimeout)
    if (!this._ambientRunning) return

    const interval = CHIRP_MIN_INTERVAL + Math.random() * (CHIRP_MAX_INTERVAL - CHIRP_MIN_INTERVAL)

    this._chirpTimeout = setTimeout(() => {
      if (!this._ambientRunning) return
      this._playEquipmentChirp()
      this._scheduleChirp()
    }, interval)
  }

  /** A short equipment beep — scope chirp, server ping, etc. */
  private _playEquipmentChirp(): void {
    if (!this._ctx || this._muted) return
    const ctx = this._ctx
    const sfxGain = this._channelGains.sfx
    if (!sfxGain) return
    const now = ctx.currentTime

    // Two-tone chirp (rising or steady)
    const type = Math.random() > 0.5 ? 'rising' : 'steady'
    const baseFreq = 2200 + Math.random() * 1600  // 2.2–3.8 kHz

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.06, now + 0.008)
    g.gain.setValueAtTime(0.06, now + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    g.connect(sfxGain)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, now)
    if (type === 'rising') {
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.35, now + 0.08)
    }
    osc.connect(g)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // -------------------------------------------------------------------------
  // localStorage persistence
  // -------------------------------------------------------------------------

  private _saveState(): void {
    try {
      const state: AudioState = {
        masterVolume: this._masterVolume,
        muted: this._muted,
        channelVolumes: { ...this._channelVolumes },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* localStorage unavailable — electron sandboxed context */ }
  }

  private _loadState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      // JSON.parse can throw on corrupted data; the outer catch handles that.
      const state = JSON.parse(raw) as Partial<AudioState>

      // Validate masterVolume: must be a finite number in [0, 1]
      if (typeof state.masterVolume === 'number' && isFinite(state.masterVolume)) {
        this._masterVolume = Math.max(0, Math.min(1, state.masterVolume))
      }

      // Validate muted: strict boolean check
      if (state.muted === true || state.muted === false) {
        this._muted = state.muted
      }

      // Validate per-channel volumes: each must be a finite number in [0, 1]
      if (state.channelVolumes && typeof state.channelVolumes === 'object') {
        for (const key of Object.keys(CHANNEL_DEFAULTS) as ChannelName[]) {
          const v = state.channelVolumes[key]
          if (typeof v === 'number' && isFinite(v)) {
            this._channelVolumes[key] = Math.max(0, Math.min(1, v))
          }
          // If v is missing/invalid the CHANNEL_DEFAULTS value remains (set in field initializer)
        }
      }
    } catch {
      // JSON parse failure or localStorage access error — silently use defaults.
      // This covers: malformed JSON, quota exceeded, sandboxed context.
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audioManager = AudioManager.getInstance()
