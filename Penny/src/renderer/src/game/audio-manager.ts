// ---------------------------------------------------------------------------
// audio-manager.ts
// Singleton audio manager with channel system + procedural ambient soundscape.
// All ambient sounds are synthesized via Web Audio API — no audio files required.
// Respects browser autoplay policy: AudioContext is created on first user gesture.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AudioChannel = 'ambient' | 'sfx' | 'ui' | 'music'

type TimePhase = 'morning' | 'day' | 'evening' | 'night'

const STORAGE_KEY = 'penny_audio_volumes'

const CHANNEL_DEFAULTS: Record<AudioChannel, number> = {
  ambient: 0.3,
  sfx:     0.4,
  ui:      0.5,
  music:   0.3,
}

const MASTER_DEFAULT = 0.5

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private _ctx: AudioContext | null = null
  private _masterGain: GainNode | null = null

  // Per-channel gain nodes (created after AudioContext init)
  private _channelGains: Partial<Record<AudioChannel, GainNode>> = {}
  private _channelVolumes: Record<AudioChannel, number> = { ...CHANNEL_DEFAULTS }
  private _masterVolume = MASTER_DEFAULT
  private _muted = false

  // Ambient state
  private _labHumOsc: OscillatorNode | null = null
  private _labHumGain: GainNode | null = null
  private _labHumNoiseSource: AudioBufferSourceNode | null = null
  private _labHumNoiseGain: GainNode | null = null
  private _labHumPitchTimer: ReturnType<typeof setInterval> | null = null

  private _nightLayerOsc: OscillatorNode | null = null
  private _nightLayerGain: GainNode | null = null

  private _keyboardIntervalId: ReturnType<typeof setInterval> | null = null
  private _chirpTimerId: ReturnType<typeof setTimeout> | null = null

  private _workingAgentCount = 0
  private _currentPhase: TimePhase = 'day'

  private _initialized = false

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  private static _instance: AudioManager | null = null
  static get(): AudioManager {
    if (!AudioManager._instance) AudioManager._instance = new AudioManager()
    return AudioManager._instance
  }

  private constructor() {
    this._loadFromStorage()
  }

  // ---------------------------------------------------------------------------
  // Init — call once after first user interaction (click/keypress)
  // ---------------------------------------------------------------------------

  /** Must be called after a user gesture to satisfy browser autoplay policy. */
  init(): void {
    if (this._initialized) {
      if (this._ctx?.state === 'suspended') void this._ctx.resume()
      return
    }
    this._initialized = true
    try {
      this._ctx = new AudioContext()
      this._masterGain = this._ctx.createGain()
      this._masterGain.gain.value = this._muted ? 0 : this._masterVolume
      this._masterGain.connect(this._ctx.destination)

      // Create per-channel gain nodes
      const channels: AudioChannel[] = ['ambient', 'sfx', 'ui', 'music']
      for (const ch of channels) {
        const g = this._ctx.createGain()
        g.gain.value = this._channelVolumes[ch]
        g.connect(this._masterGain)
        this._channelGains[ch] = g
      }

      if (this._ctx.state === 'suspended') void this._ctx.resume()

      this._startLabHum()
      this._scheduleNextChirp()
    } catch (e) {
      console.warn('[AudioManager] AudioContext init failed:', e)
    }
  }

  // ---------------------------------------------------------------------------
  // Channel volume API
  // ---------------------------------------------------------------------------

  setVolume(channel: AudioChannel, value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    this._channelVolumes[channel] = clamped
    const gainNode = this._channelGains[channel]
    if (gainNode) gainNode.gain.value = this._muted ? 0 : clamped
    this._saveToStorage()
  }

  getVolume(channel: AudioChannel): number {
    return this._channelVolumes[channel]
  }

  setMasterVolume(value: number): void {
    this._masterVolume = Math.max(0, Math.min(1, value))
    if (this._masterGain && !this._muted) {
      this._masterGain.gain.value = this._masterVolume
    }
    this._saveToStorage()
  }

  get masterVolume(): number { return this._masterVolume }

  // ---------------------------------------------------------------------------
  // Mute / unmute
  // ---------------------------------------------------------------------------

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

  get isMuted(): boolean { return this._muted }

  // ---------------------------------------------------------------------------
  // Fade helpers
  // ---------------------------------------------------------------------------

  /** Fade a GainNode from 0 to its current value over `duration` ms. */
  fadeIn(gainNode: GainNode, duration: number): void {
    if (!this._ctx) return
    const now = this._ctx.currentTime
    const target = gainNode.gain.value
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(target, now + duration / 1000)
  }

  /** Fade a GainNode to 0 over `duration` ms. */
  fadeOut(gainNode: GainNode, duration: number): void {
    if (!this._ctx) return
    const now = this._ctx.currentTime
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000)
  }

  // ---------------------------------------------------------------------------
  // Day/night phase
  // ---------------------------------------------------------------------------

  setTimePhase(phase: TimePhase): void {
    if (this._currentPhase === phase) return
    this._currentPhase = phase
    this._applyPhaseAmbient()
  }

  // ---------------------------------------------------------------------------
  // Working agent count — drives keyboard clatter rate
  // ---------------------------------------------------------------------------

  setWorkingAgentCount(count: number): void {
    this._workingAgentCount = count
    this._restartKeyboardClatter()
  }

  // ---------------------------------------------------------------------------
  // Lab Hum — HVAC/server room drone, always playing after init
  // ---------------------------------------------------------------------------

  private _startLabHum(): void {
    const ctx = this._ctx
    const ambientGain = this._channelGains.ambient
    if (!ctx || !ambientGain) return

    // Oscillator drone at 60 Hz (fundamental) — sine + small detuned triangle layer
    const hum = ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 60

    const subHum = ctx.createOscillator()
    subHum.type = 'triangle'
    subHum.frequency.value = 120
    subHum.detune.value = 8

    const humGain = ctx.createGain()
    humGain.gain.value = 0.15

    // LFO for subtle tremolo
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.3
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.015

    lfo.connect(lfoGain)
    lfoGain.connect(humGain.gain)

    hum.connect(humGain)
    subHum.connect(humGain)
    humGain.connect(ambientGain)

    hum.start()
    subHum.start()
    lfo.start()

    this._labHumOsc = hum
    this._labHumGain = humGain

    // Noise floor: filtered white noise for HVAC texture
    const bufSize = ctx.sampleRate * 2
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true

    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 200
    bpf.Q.value = 0.5

    const lpf = ctx.createBiquadFilter()
    lpf.type = 'lowpass'
    lpf.frequency.value = 400

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.04

    noise.connect(bpf)
    bpf.connect(lpf)
    lpf.connect(noiseGain)
    noiseGain.connect(ambientGain)
    noise.start()

    this._labHumNoiseSource = noise
    this._labHumNoiseGain = noiseGain

    // Random pitch micro-variation every 30s (rate 0.98–1.02)
    this._labHumPitchTimer = setInterval(() => {
      if (!this._labHumOsc) return
      const drift = 0.98 + Math.random() * 0.04  // 0.98–1.02
      this._labHumOsc.frequency.linearRampToValueAtTime(60 * drift, ctx.currentTime + 2)
    }, 30_000)
  }

  // ---------------------------------------------------------------------------
  // Keyboard Clatter — rate scales with working agent count
  // ---------------------------------------------------------------------------

  private _getKeyboardIntervalMs(): number {
    // Night phase: half rate
    const nightMult = this._currentPhase === 'night' ? 2 : 1
    if (this._workingAgentCount <= 0) return 0
    if (this._workingAgentCount <= 2) return 1000 * nightMult   // 1/sec
    if (this._workingAgentCount <= 5) return 350 * nightMult    // ~2–3/sec
    return 250 * nightMult                                       // 4/sec cap
  }

  private _playKeystroke(): void {
    const ctx = this._ctx
    const sfxGain = this._channelGains.sfx
    if (!ctx || !sfxGain) return

    // Short broadband click + filtered noise burst
    const gainNode = ctx.createGain()
    gainNode.connect(sfxGain)

    const freq = 2500 + Math.random() * 1500   // 4 variants via random freq band
    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = freq
    bpf.Q.value = 3 + Math.random() * 4
    bpf.connect(gainNode)

    // Tiny noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.02)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(bpf)

    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0.08, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.025)
    src.start(now)
    src.stop(now + 0.025)
  }

  private _restartKeyboardClatter(): void {
    if (this._keyboardIntervalId !== null) {
      clearInterval(this._keyboardIntervalId)
      this._keyboardIntervalId = null
    }
    const ms = this._getKeyboardIntervalMs()
    if (ms <= 0 || !this._initialized) return
    this._keyboardIntervalId = setInterval(() => {
      this._playKeystroke()
    }, ms)
  }

  // ---------------------------------------------------------------------------
  // Equipment Chirp — random beep every 15–30s
  // ---------------------------------------------------------------------------

  private _scheduleNextChirp(): void {
    if (this._chirpTimerId !== null) {
      clearTimeout(this._chirpTimerId)
      this._chirpTimerId = null
    }
    // Evening: slow down (25–50s)
    const [minMs, maxMs] = this._currentPhase === 'evening'
      ? [25_000, 50_000]
      : [15_000, 30_000]
    const delay = minMs + Math.random() * (maxMs - minMs)
    this._chirpTimerId = setTimeout(() => {
      this._playChirp()
      this._scheduleNextChirp()
    }, delay)
  }

  private _playChirp(): void {
    const ctx = this._ctx
    const ambientGain = this._channelGains.ambient
    if (!ctx || !ambientGain) return

    // 3 variants: low beep, mid ping, short trill
    const variant = Math.floor(Math.random() * 3)
    const gainNode = ctx.createGain()
    gainNode.connect(ambientGain)

    const now = ctx.currentTime

    if (variant === 0) {
      // Short beep at 880 Hz
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gainNode)
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.05, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      osc.start(now)
      osc.stop(now + 0.2)
    } else if (variant === 1) {
      // Double-beep at 1200 Hz
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 1200
        osc.connect(gainNode)
        const t = now + i * 0.12
        gainNode.gain.setValueAtTime(0.05, t)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
        osc.start(t)
        osc.stop(t + 0.09)
      }
    } else {
      // Rising chirp sweep 600 → 1800 Hz
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12)
      osc.connect(gainNode)
      gainNode.gain.setValueAtTime(0.05, now)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)
      osc.start(now)
      osc.stop(now + 0.14)
    }
  }

  // ---------------------------------------------------------------------------
  // Night ambience layer
  // ---------------------------------------------------------------------------

  private _startNightLayer(): void {
    const ctx = this._ctx
    const ambientGain = this._channelGains.ambient
    if (!ctx || !ambientGain || this._nightLayerGain) return

    // Very soft high-frequency hiss (server fan / silence)
    const bufSize = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    const hpf = ctx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = 4000
    hpf.Q.value = 0.5

    const nightGain = ctx.createGain()
    nightGain.gain.value = 0
    src.connect(hpf)
    hpf.connect(nightGain)
    nightGain.connect(ambientGain)
    src.start()

    // Fade in
    nightGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 3)

    this._nightLayerOsc = src as unknown as OscillatorNode   // reuse field type
    this._nightLayerGain = nightGain
  }

  private _stopNightLayer(): void {
    if (this._nightLayerGain && this._ctx) {
      this._nightLayerGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 2)
      setTimeout(() => {
        try { (this._nightLayerOsc as unknown as AudioBufferSourceNode)?.stop() } catch { /* ok */ }
        this._nightLayerOsc = null
        this._nightLayerGain = null
      }, 2500)
    }
  }

  // ---------------------------------------------------------------------------
  // Phase transitions
  // ---------------------------------------------------------------------------

  private _applyPhaseAmbient(): void {
    // Keyboard clatter — restart with new rate
    this._restartKeyboardClatter()

    // Night layer on/off
    if (this._currentPhase === 'night') {
      this._startNightLayer()
    } else {
      this._stopNightLayer()
    }

    // Chirp scheduler — restart so it picks up new timing
    this._scheduleNextChirp()
  }

  // ---------------------------------------------------------------------------
  // Internal: channel gain node for external use (e.g. Phaser sound through channel)
  // ---------------------------------------------------------------------------

  /** Returns the GainNode for a channel — allows routing external sounds through it. */
  getChannelGain(channel: AudioChannel): GainNode | null {
    return this._channelGains[channel] ?? null
  }

  /** Returns the AudioContext if initialized. */
  getContext(): AudioContext | null {
    return this._ctx
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private _saveToStorage(): void {
    try {
      const data = {
        master: this._masterVolume,
        channels: this._channelVolumes,
        muted: this._muted,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* storage unavailable */ }
  }

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as {
        master?: number
        channels?: Partial<Record<AudioChannel, number>>
        muted?: boolean
      }
      if (typeof data.master === 'number') this._masterVolume = data.master
      if (data.channels) {
        const channels: AudioChannel[] = ['ambient', 'sfx', 'ui', 'music']
        for (const ch of channels) {
          if (typeof data.channels[ch] === 'number') this._channelVolumes[ch] = data.channels[ch]!
        }
      }
      if (typeof data.muted === 'boolean') this._muted = data.muted
    } catch { /* parse error — use defaults */ }
  }

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (this._labHumPitchTimer !== null) clearInterval(this._labHumPitchTimer)
    if (this._keyboardIntervalId !== null) clearInterval(this._keyboardIntervalId)
    if (this._chirpTimerId !== null) clearTimeout(this._chirpTimerId)
    try { this._labHumOsc?.stop() } catch { /* ok */ }
    try { this._labHumNoiseSource?.stop() } catch { /* ok */ }
    try { (this._nightLayerOsc as unknown as AudioBufferSourceNode)?.stop() } catch { /* ok */ }
    void this._ctx?.close()
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audioManager = AudioManager.get()
