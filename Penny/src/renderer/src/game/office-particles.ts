import Phaser from 'phaser'
import { activeTheme } from './office-theme'
import { WS_DESK_Y, scaledFontSize } from './office-constants'
import { SPRITESHEET_KEYS } from './office-asset-keys'
import { WeatherParticles } from './particles-weather'
import { AmbientParticles } from './particles-ambient'
import { EventBus, EVENTS } from './events'
import { FLOAT_AMBIENT, TRAIL_FADE, BURST_RADIAL } from './particle-profiles'

// ---------------------------------------------------------------------------
// Minimal interface for workstation steam particle host
// ---------------------------------------------------------------------------

export interface SteamHost {
  steamContainer?: Phaser.GameObjects.Container
  steamTweens?: Phaser.Tweens.Tween[]
  lastAnimMode?: string
}

// ---------------------------------------------------------------------------
// Minimal interface for a workstation tick entry (used by tickParticles)
// ---------------------------------------------------------------------------

export interface ParticleWorkstation {
  state: {
    sessionMode?: string
    needsInteraction?: boolean
  } | null
  container: { x: number; y: number }
}

export interface ParticleRoom {
  x: number
  y: number
  workstations: Map<string, ParticleWorkstation>
}

// ---------------------------------------------------------------------------
// Corridor segment type
// ---------------------------------------------------------------------------

export interface CorridorSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

// ---------------------------------------------------------------------------
// OfficeParticles — owns all particle/effect pool systems extracted from OfficeScene
// ---------------------------------------------------------------------------

export class OfficeParticles {
  private scene: Phaser.Scene
  private _reducedMode = false
  private _sleeping = false

  /** Maximum simultaneously active particles across all Arc pools. Oldest is recycled when exceeded. */
  private static readonly PARTICLE_BUDGET = 200

  // Sub-modules
  private weather: WeatherParticles
  private ambient: AmbientParticles

  // Typing spark particles
  private typingParticlePool: Phaser.GameObjects.Arc[] = []
  private typingParticleTimer: Phaser.Time.TimerEvent | null = null

  // Corridor data-flow particle trail
  private corridorParticlePool: Phaser.GameObjects.Arc[] = []
  private corridorParticleTimer: Phaser.Time.TimerEvent | null = null

  // Alert ripple pool
  private alertRipplePool: Phaser.GameObjects.Arc[] = []

  // Mouse cursor sparkle trail
  private mouseTrailPool: Phaser.GameObjects.Arc[] = []
  lastTrailSpawnAt = 0

  // Emoji reaction bubble pool
  private emojiReactionPool: Phaser.GameObjects.Text[] = []

  // Sprite-based reaction pool (game-icons spritesheet)
  private spriteReactionPool: Phaser.GameObjects.Sprite[] = []

  // Confetti burst particle emitter
  private confettiEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  // Chime ripple pool
  private chimeRipplePool: Phaser.GameObjects.Arc[] = []

  // Streak flame particle pool
  private streakFlamePool: Phaser.GameObjects.Arc[] = []

  // Ambient data flow mote pool — cyan dots drifting between workstations per room
  private dataMotePool: Phaser.GameObjects.Arc[] = []
  private dataMoteTimer: Phaser.Time.TimerEvent | null = null

  // Task assignment trail — dot + ghost trail spawned on task-dispatched event
  private taskTrailDotPool: Phaser.GameObjects.Arc[] = []
  private taskTrailGhostPool: Phaser.GameObjects.Arc[] = []
  private taskDispatchListener: ((...args: unknown[]) => void) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.weather = new WeatherParticles(scene)
    this.ambient = new AmbientParticles(scene)
  }

  // ---------------------------------------------------------------------------
  // Public API — accessor for mouseTrailPool used by OfficeScene's pointermove
  // ---------------------------------------------------------------------------

  getMouseTrailPool(): Phaser.GameObjects.Arc[] {
    return this.mouseTrailPool
  }

  /** Enable/disable reduced particle mode for low-FPS situations. */
  setReducedMode(reduced: boolean): void {
    this._reducedMode = reduced
  }

  /** Whether reduced mode is active — used by spawn methods to skip particles. */
  isReducedMode(): boolean {
    return this._reducedMode
  }

  /** Pause all particle timers and block new spawns (scene sleep). */
  pause(): void {
    this._sleeping = true
    if (this.typingParticleTimer) this.typingParticleTimer.paused = true
    if (this.corridorParticleTimer) this.corridorParticleTimer.paused = true
    if (this.dataMoteTimer) this.dataMoteTimer.paused = true
    this.weather.pause()
    this.ambient.pause()
  }

  /** Resume particle timers and allow spawns (scene wake). */
  resume(): void {
    this._sleeping = false
    if (this.typingParticleTimer) this.typingParticleTimer.paused = false
    if (this.corridorParticleTimer) this.corridorParticleTimer.paused = false
    if (this.dataMoteTimer) this.dataMoteTimer.paused = false
    this.weather.resume()
    this.ambient.resume()
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.initParticlePool()
    this.typingParticleTimer = this.scene.time.addEvent({
      delay: 200, callback: () => this.tickParticlesInternal(), loop: true,
    })
    this.ambient.init()
    this.weather.init(viewWidth, viewHeight)
    this.initCorridorParticlePool()
    this.corridorParticleTimer = this.scene.time.addEvent({
      delay: 300,
      callback: () => this.tickCorridorParticlesInternal(),
      loop: true,
    })
    this.initAlertRipplePool()
    this.initChimeRipplePool()
    this.initStreakFlamePool()
    this.initEmojiReactionPool()
    this.initSpriteReactionPool()
    this.initMouseTrailPool()

    this.initDataMotePools()
    this.initTaskTrailPools()
    this.startAmbientMoteTimer()
    this.subscribeTaskDispatched()

    // Confetti burst emitter
    const confettiGfx = this.scene.make.graphics({ x: 0, y: 0, add: false } as Phaser.Types.GameObjects.Graphics.Options)
    confettiGfx.fillStyle(0xffffff)
    confettiGfx.fillRect(0, 0, 4, 4)
    confettiGfx.generateTexture('confetti_particle', 4, 4)
    confettiGfx.destroy()
    this.confettiEmitter = this.scene.add.particles(0, 0, 'confetti_particle', {
      speed: { min: 40, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 600, max: 900 },
      gravityY: 80,
      rotate: { min: -360, max: 360 },
      emitting: false,
    })
    this.confettiEmitter.setDepth(500)
  }

  // ---------------------------------------------------------------------------
  // Destroy / cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.typingParticleTimer?.destroy()
    this.typingParticleTimer = null
    for (const p of this.typingParticlePool) { this.scene.tweens.killTweensOf(p); p.destroy() }
    this.typingParticlePool = []

    this.ambient.destroy()

    this.corridorParticleTimer?.destroy()
    this.corridorParticleTimer = null
    for (const p of this.corridorParticlePool) { this.scene.tweens.killTweensOf(p); p.destroy() }
    this.corridorParticlePool = []

    this.weather.destroy()

    for (const c of this.alertRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.alertRipplePool = []

    for (const c of this.chimeRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.chimeRipplePool = []

    for (const c of this.streakFlamePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.streakFlamePool = []

    for (const t of this.emojiReactionPool) { this.scene.tweens.killTweensOf(t); t.destroy() }
    this.emojiReactionPool = []

    for (const s of this.spriteReactionPool) { this.scene.tweens.killTweensOf(s); s.destroy() }
    this.spriteReactionPool = []

    for (const c of this.mouseTrailPool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.mouseTrailPool = []

    if (this.confettiEmitter) {
      this.confettiEmitter.destroy()
      this.confettiEmitter = null
    }

    this.dataMoteTimer?.destroy()
    this.dataMoteTimer = null
    for (const m of this.dataMotePool) { this.scene.tweens.killTweensOf(m); m.destroy() }
    this.dataMotePool = []

    for (const d of this.taskTrailDotPool) { this.scene.tweens.killTweensOf(d); d.destroy() }
    this.taskTrailDotPool = []
    for (const g of this.taskTrailGhostPool) { this.scene.tweens.killTweensOf(g); g.destroy() }
    this.taskTrailGhostPool = []

    if (this.taskDispatchListener) {
      EventBus.off(EVENTS.TASK_DISPATCHED, this.taskDispatchListener)
      this.taskDispatchListener = null
    }
  }

  // ---------------------------------------------------------------------------
  // Weather delegation
  // ---------------------------------------------------------------------------

  setWeather(phase: 'morning' | 'day' | 'evening' | 'night', viewWidth: number, viewHeight: number): void {
    this.weather.setWeather(phase, viewWidth, viewHeight)
  }

  isRainActive(): boolean { return this.weather.isRainActive() }
  isSnowActive(): boolean { return this.weather.isSnowActive() }

  tickRain(viewWidth: number, viewHeight: number): void {
    this.weather.tickRain(viewWidth, viewHeight)
  }

  tickSnow(time: number, viewWidth: number, viewHeight: number): void {
    this.weather.tickSnow(time, viewWidth, viewHeight)
  }

  // ---------------------------------------------------------------------------
  // Ambient delegation
  // ---------------------------------------------------------------------------

  tickMakoMotes(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    this.ambient.tickMakoMotes(camX, camY, camW, camH, zoom)
  }

  tickSparks(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    this.ambient.tickSparks(camX, camY, camW, camH, zoom)
  }

  tickSteam(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    this.ambient.tickSteam(camX, camY, camW, camH, zoom)
  }

  // ---------------------------------------------------------------------------
  // Particle budget system — max PARTICLE_BUDGET active Arc particles
  // ---------------------------------------------------------------------------

  /** All Arc pools included in the global budget. */
  private _getAllArcPools(): Phaser.GameObjects.Arc[][] {
    return [
      this.typingParticlePool,
      this.corridorParticlePool,
      this.alertRipplePool,
      this.mouseTrailPool,
      this.chimeRipplePool,
      this.streakFlamePool,
    ]
  }

  /**
   * If the global particle count is at budget, force-recycle the oldest busy
   * particle so the next spawn can proceed.
   */
  private _enforceParticleBudget(): void {
    const allPools = this._getAllArcPools()
    let count = 0
    for (const pool of allPools) {
      for (const p of pool) {
        if (p.getData('busy')) count++
      }
    }
    if (count < OfficeParticles.PARTICLE_BUDGET) return

    // Find oldest active particle by startedAt timestamp
    let oldest: Phaser.GameObjects.Arc | null = null
    let oldestTime = Infinity
    for (const pool of allPools) {
      for (const p of pool) {
        if (p.getData('busy')) {
          const t = (p.getData('startedAt') as number) ?? 0
          if (t < oldestTime) {
            oldestTime = t
            oldest = p
          }
        }
      }
    }
    if (oldest) {
      this.scene.tweens.killTweensOf(oldest)
      oldest.setVisible(false).setAlpha(0).setData('busy', false)
    }
  }

  // ---------------------------------------------------------------------------
  // Typing spark particles
  // ---------------------------------------------------------------------------

  private initParticlePool(): void {
    for (let i = 0; i < 80; i++) {
      const radius = 1 + Math.random() * 2
      const p = this.scene.add.circle(0, 0, radius, 0xffffff, 0).setDepth(9998).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this.typingParticlePool.push(p)
    }
  }

  spawnTypingParticle(worldX: number, worldY: number, isWaiting = false, isCompressing = false): void {
    if (this._sleeping) return
    this._enforceParticleBudget()
    const p = this.typingParticlePool.find(c => !c.getData('busy'))
    if (!p) return
    const colors = isCompressing
      ? [0xf87171, 0xef4444, 0xfca5a5]
      : isWaiting
        ? [0xfbbf24, 0xf59e0b, 0xfcd34d]
        : activeTheme.particleColors.length > 0
          ? activeTheme.particleColors
          : [0x0ea5e9, 0x34d399, 0x22d3ee]
    const radius = 0.8 + Math.random() * 1.4
    p.setPosition(worldX + (Math.random() - 0.5) * 24, worldY)
    p.setFillStyle(colors[Math.floor(Math.random() * colors.length)])
    p.setRadius(radius)
    p.setAlpha(0.9).setVisible(true).setData('busy', true).setData('startedAt', this.scene.time.now)
    const driftY = -8 - Math.random() * 18
    const driftX = (Math.random() - 0.5) * 24
    this.scene.tweens.add({
      targets: p,
      y: worldY + driftY,
      x: p.x + driftX,
      alpha: 0,
      duration: 500 + Math.random() * 500,
      ease: 'Quad.easeOut',
      onComplete: () => { p.setVisible(false).setData('busy', false) },
    })
  }

  /**
   * Called by the internal timer. Accepts rooms snapshot passed from scene at
   * timer-creation time via closure — instead we use the bound reference set
   * by setRooms() so the class stays decoupled from OfficeScene internals.
   */
  private roomsRef: Map<string, ParticleRoom> | null = null

  setRooms(rooms: Map<string, ParticleRoom>): void {
    this.roomsRef = rooms
  }

  private tickParticlesInternal(): void {
    if (!this.roomsRef) return
    for (const room of this.roomsRef.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        const m = ws.state.sessionMode
        const isWorking = m === 'working' || m === 'plan'
        const isCompressing = m === 'compressing'
        const isWaiting = ws.state.needsInteraction
        if (!isWorking && !isWaiting && !isCompressing) continue
        const wx = room.x + ws.container.x
        const wy = room.y + ws.container.y + WS_DESK_Y + 2
        const spawnCount = isCompressing ? 3 : m === 'plan' ? 2 : 1
        const spawnChance = isCompressing ? 0.25 : m === 'plan' ? 0.18 : 0.12
        for (let s = 0; s < spawnCount; s++) {
          if (Math.random() < spawnChance) this.spawnTypingParticle(wx, wy, isWaiting, isCompressing)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Corridor data-flow particle trail
  // ---------------------------------------------------------------------------

  private initCorridorParticlePool(): void {
    for (let i = 0; i < 20; i++) {
      const arc = this.scene.add.circle(0, 0, 1.5, 0xffffff, 0).setDepth(-1).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      arc.setData('busy', false)
      this.corridorParticlePool.push(arc)
    }
  }

  // Refs injected by scene so the timer callback can read current state
  private corridorSegmentsRef: CorridorSegment[] = []
  private hasActiveAgentRef = false

  setCorridorData(segments: CorridorSegment[], hasActiveAgent: boolean): void {
    this.corridorSegmentsRef = segments
    this.hasActiveAgentRef = hasActiveAgent
  }

  private tickCorridorParticlesInternal(): void {
    this.tickCorridorParticles(this.corridorSegmentsRef, this.hasActiveAgentRef)
  }

  tickCorridorParticles(corridorSegments: CorridorSegment[], hasActiveAgent: boolean): void {
    if (corridorSegments.length === 0) return
    if (!hasActiveAgent) return

    this._enforceParticleBudget()
    const free = this.corridorParticlePool.find(p => !p.getData('busy'))
    if (!free) return

    const seg = corridorSegments[Math.floor(Math.random() * corridorSegments.length)]
    const palette = activeTheme.particleColors
    const color = palette[Math.floor(Math.random() * palette.length)]
    const targetAlpha = 0.2 + Math.random() * 0.2
    const travelDuration = 800 + Math.random() * 400

    free.setFillStyle(color)
    free.setPosition(seg.x1, seg.y1)
    free.setAlpha(0)
    free.setVisible(true)
    free.setData('busy', true).setData('startedAt', this.scene.time.now)

    this.scene.tweens.add({
      targets: free,
      alpha: targetAlpha,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        this.scene.tweens.add({
          targets: free,
          x: seg.x2,
          y: seg.y2,
          duration: travelDuration,
          ease: 'Sine.easeInOut',
          onUpdate: (_tween: Phaser.Tweens.Tween, _target: unknown, _key: string, _value: number, _start: number, progress: number) => {
            if (progress > 0.85) {
              free.setAlpha(targetAlpha * (1 - (progress - 0.85) / 0.15))
            }
          },
          onComplete: () => {
            free.setVisible(false)
            free.setAlpha(0)
            free.setData('busy', false)
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Alert ripple pool
  // ---------------------------------------------------------------------------

  private initAlertRipplePool(): void {
    for (let i = 0; i < 10; i++) {
      const circle = this.scene.add.circle(0, 0, 1, 0xffffff, 0).setDepth(100).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      circle.setData('busy', false)
      this.alertRipplePool.push(circle)
    }
  }

  spawnAlertRipple(worldX: number, worldY: number, color: number): void {
    if (this._sleeping) return
    this._enforceParticleBudget()
    const circle = this.alertRipplePool.find(c => !c.getData('busy'))
    if (!circle) return

    circle.setPosition(worldX, worldY)
    circle.setRadius(4)
    circle.setFillStyle(color, 0)
    circle.setStrokeStyle(1.5, color, 0.4)
    circle.setAlpha(0.4)
    circle.setScale(1)
    circle.setVisible(true)
    circle.setData('busy', true).setData('startedAt', this.scene.time.now)

    this.scene.tweens.add({
      targets: circle,
      scaleX: 7.5,
      scaleY: 7.5,
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => {
        circle.setVisible(false)
        circle.setScale(1)
        circle.setData('busy', false)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Coffee steam particles
  // ---------------------------------------------------------------------------

  spawnSteamParticles(ws: SteamHost): void {
    if (this._sleeping) return
    if (!ws.steamContainer) return
    this.clearSteamParticles(ws)

    const container = ws.steamContainer
    const tweens: Phaser.Tweens.Tween[] = []

    for (let i = 0; i < 3; i++) {
      const xOff = (i - 1) * 2.5 + (Math.random() - 0.5)
      const initAlpha = 0.3 + Math.random() * 0.2
      const riseY    = -12 - Math.random() * 6
      const duration = 1200 + Math.random() * 600
      const swayAmp  = 2 + Math.random()

      const particle = this.scene.add.circle(xOff, 0, 1.5, 0xffffff, initAlpha)
      container.add(particle)

      const tween = this.scene.tweens.add({
        targets: particle,
        y: riseY,
        alpha: 0,
        duration,
        delay: i * 400,
        ease: 'Sine.easeOut',
        onUpdate: (tw: Phaser.Tweens.Tween) => {
          const progress = tw.progress
          particle.x = xOff + Math.sin(progress * Math.PI * 2) * swayAmp
        },
        onComplete: () => {
          container.remove(particle, true)
        },
      })
      tweens.push(tween)
    }

    ws.steamTweens = tweens

    const respawnDelay = 1800 + 3 * 400 + 200
    const respawnTimer = this.scene.time.delayedCall(respawnDelay, () => {
      if (ws.lastAnimMode === 'idle' && ws.steamContainer) {
        this.spawnSteamParticles(ws)
      }
    })
    ;(ws as unknown as { _steamRespawnTimer?: Phaser.Time.TimerEvent })._steamRespawnTimer = respawnTimer
  }

  clearSteamParticles(ws: SteamHost): void {
    const typed = ws as unknown as { _steamRespawnTimer?: Phaser.Time.TimerEvent }
    if (typed._steamRespawnTimer) {
      typed._steamRespawnTimer.destroy()
      typed._steamRespawnTimer = undefined
    }
    if (ws.steamTweens) {
      for (const t of ws.steamTweens) {
        if (t && t.isPlaying()) t.stop()
        t.destroy()
      }
      ws.steamTweens = []
    }
    if (ws.steamContainer) {
      ws.steamContainer.removeAll(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Confetti burst
  // ---------------------------------------------------------------------------

  burstConfetti(x: number, y: number): void {
    if (this._sleeping) return
    if (this._reducedMode && Math.random() > 0.3) return
    if (!this.confettiEmitter) return
    const colors = activeTheme.particleColors
    this.confettiEmitter.setPosition(x, y)
    this.confettiEmitter.setParticleTint(colors[Math.floor(Math.random() * colors.length)])
    this.confettiEmitter.explode(14)
  }

  // ---------------------------------------------------------------------------
  // Emoji reaction bubble pool
  // ---------------------------------------------------------------------------

  private initEmojiReactionPool(): void {
    for (let i = 0; i < 10; i++) {
      const label = this.scene.add
        .text(0, 0, '', { fontSize: scaledFontSize(12), resolution: 2 })
        .setDepth(500)
        .setAlpha(0)
        .setData('busy', false)
      this.emojiReactionPool.push(label)
    }
  }

  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void {
    if (this._sleeping) return
    if (this._reducedMode && Math.random() > 0.3) return
    const label = this.emojiReactionPool.find(t => !t.getData('busy'))
    if (!label) return
    const sway = (Math.random() - 0.5) * 16
    label.setText(emoji)
    label.setPosition(worldX + sway, worldY - 20)
    label.setAlpha(0)
    label.setData('busy', true)
    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          y: label.y - 30,
          alpha: 0,
          duration: 1200,
          ease: 'Sine.easeOut',
          onComplete: () => {
            label.setAlpha(0)
            label.setData('busy', false)
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Sprite-based reaction pool (game-icons spritesheet)
  // ---------------------------------------------------------------------------

  private initSpriteReactionPool(): void {
    for (let i = 0; i < 12; i++) {
      const spr = this.scene.add
        .sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, 0)
        .setDepth(500)
        .setAlpha(0)
        .setScale(0.5)
        .setVisible(false)
      spr.setData('busy', false)
      this.spriteReactionPool.push(spr)
    }
  }

  spawnSpriteReaction(worldX: number, worldY: number, frame: number): void {
    if (this._sleeping) return
    if (this._reducedMode && Math.random() > 0.3) return
    const spr = this.spriteReactionPool.find(s => !s.getData('busy'))
    if (!spr) return

    const sway = (Math.random() - 0.5) * 16
    spr.setFrame(frame)
    spr.setPosition(worldX + sway, worldY - 20)
    spr.setAlpha(0)
    spr.setScale(0.3)
    spr.setVisible(true)
    spr.setData('busy', true)

    // Phase 1: fade in + scale bounce
    this.scene.tweens.add({
      targets: spr,
      alpha: 1,
      scaleX: 0.65,
      scaleY: 0.65,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Phase 2: settle scale + rise upward + fade out
        this.scene.tweens.add({
          targets: spr,
          y: spr.y - 30,
          scaleX: 0.5,
          scaleY: 0.5,
          alpha: 0,
          duration: 1000,
          ease: 'Sine.easeOut',
          onComplete: () => {
            spr.setVisible(false)
            spr.setAlpha(0)
            spr.setData('busy', false)
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Mouse trail pool (created here; spawning logic stays in OfficeScene
  // pointermove handler which has access to camera & input)
  // ---------------------------------------------------------------------------

  private initMouseTrailPool(): void {
    const palette = activeTheme.particleColors
    for (let i = 0; i < 15; i++) {
      const color = palette[i % palette.length]
      const circle = this.scene.add
        .circle(0, 0, 1, color, 0)
        .setDepth(9990)
        .setAlpha(0)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      circle.setData('busy', false)
      this.mouseTrailPool.push(circle)
    }
  }

  // ---------------------------------------------------------------------------
  // Streak flame particle pool
  // ---------------------------------------------------------------------------

  private initStreakFlamePool(): void {
    for (let i = 0; i < 30; i++) {
      const p = this.scene.add.circle(0, 0, 1.5, 0xf97316, 0)
        .setDepth(599).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
      p.setData('busy', false)
      this.streakFlamePool.push(p)
    }
  }

  /**
   * Spawn a single flame particle drifting upward from (worldX, worldY).
   * Color shifts based on streak intensity:
   * 5-9 (small): orange-dominant, 10-14 (medium): warmer yellow, 15+ (large): hot white accents.
   */
  spawnFlameParticle(worldX: number, worldY: number, streak: number): void {
    if (this._sleeping) return
    if (this._reducedMode && Math.random() > 0.3) return
    this._enforceParticleBudget()
    const p = this.streakFlamePool.find(c => !c.getData('busy'))
    if (!p) return

    const hotness = streak >= 15 ? 3 : streak >= 10 ? 2 : streak >= 5 ? 1 : 0
    if (hotness === 0) return
    const roll = Math.random()
    let color = 0xf97316
    if (hotness === 1) {
      color = roll < 0.7 ? 0xf97316 : roll < 0.95 ? 0xfbbf24 : 0xfefce8
    } else if (hotness === 2) {
      color = roll < 0.5 ? 0xf97316 : roll < 0.85 ? 0xfbbf24 : 0xfefce8
    } else {
      color = roll < 0.3 ? 0xf97316 : roll < 0.7 ? 0xfbbf24 : 0xfefce8
    }

    const radiusBias = hotness === 3 ? 0.45 : hotness === 2 ? 0.25 : 0.1
    const alphaBias = hotness === 3 ? 0.25 : hotness === 2 ? 0.15 : 0.08
    const radius = 0.8 + Math.random() * 1.4 + radiusBias
    const xOff = (Math.random() - 0.5) * 12
    const startX = worldX + xOff

    p.setPosition(startX, worldY)
    p.setFillStyle(color)
    p.setRadius(radius)
    p.setAlpha(Math.min(0.98, 0.72 + alphaBias)).setVisible(true).setData('busy', true).setData('startedAt', this.scene.time.now)

    const driftY = -10 - Math.random() * 12
    const swayAmp = 2 + Math.random()
    const duration = 300 + Math.random() * 300
    const startXPos = startX

    this.scene.tweens.add({
      targets: p,
      y: worldY + driftY,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const progress = tw.progress
        p.x = startXPos + Math.sin(progress * Math.PI * 2) * swayAmp
      },
      onComplete: () => { p.setVisible(false).setData('busy', false) },
    })
  }

  // ---------------------------------------------------------------------------
  // Chime ripple pool
  // ---------------------------------------------------------------------------

  private initChimeRipplePool(): void {
    for (let i = 0; i < 3; i++) {
      const circle = this.scene.add
        .circle(0, 0, 1, activeTheme.monitorGlowActive, 0)
        .setDepth(-0.4)
        .setVisible(false)
      circle.setData('busy', false)
      this.chimeRipplePool.push(circle)
    }
  }

  // ---------------------------------------------------------------------------
  // Ambient data flow motes — cyan dots drifting between workstation desks
  // ---------------------------------------------------------------------------

  private initDataMotePools(): void {
    for (let i = 0; i < 20; i++) {
      const radius = 2 + Math.random()
      const arc = this.scene.add.circle(0, 0, radius, 0x22d3ee, 0)
        .setDepth(20)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      arc.setData('busy', false)
      this.dataMotePool.push(arc)
    }
  }

  private startAmbientMoteTimer(): void {
    this.dataMoteTimer = this.scene.time.addEvent({
      delay: 2200,
      callback: () => this.tickAmbientDataMotes(),
      loop: true,
    })
  }

  private tickAmbientDataMotes(): void {
    if (this._sleeping || this._reducedMode) return
    if (!this.roomsRef) return

    for (const room of this.roomsRef.values()) {
      const wsArray = Array.from(room.workstations.values())
      if (wsArray.length < 2) continue
      // 1-2 motes per room, with some random skipping for variety
      const moteCount = Math.random() < 0.55 ? 1 : 2
      for (let i = 0; i < moteCount; i++) {
        if (Math.random() < 0.35) continue
        this.spawnDataFlowMote(room, wsArray)
      }
    }
  }

  private spawnDataFlowMote(room: ParticleRoom, workstations: ParticleWorkstation[]): void {
    const mote = this.dataMotePool.find(m => !m.getData('busy'))
    if (!mote) return

    // Pick two distinct random desks as source + destination
    const shuffled = workstations.slice().sort(() => Math.random() - 0.5)
    const srcWs = shuffled[0]
    const dstWs = shuffled[1]

    const startX = room.x + srcWs.container.x
    const startY = room.y + srcWs.container.y
    const endX   = room.x + dstWs.container.x
    const endY   = room.y + dstWs.container.y

    // Randomize bezier control point perpendicular to the travel axis
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2
    const perpScale = 0.25 + Math.random() * 0.3
    const sign = Math.random() > 0.5 ? 1 : -1
    const ctrlX = midX - (endY - startY) * perpScale * sign
    const ctrlY = midY + (endX - startX) * perpScale * sign

    const dist = Math.hypot(endX - startX, endY - startY)
    const speed = FLOAT_AMBIENT.driftMin + Math.random() * (FLOAT_AMBIENT.driftMax - FLOAT_AMBIENT.driftMin)
    // At 15-25px/sec over a typical inter-desk distance of 80-200px: 3-13 seconds
    const duration = Math.max(1500, (dist / speed) * 1000)

    mote.setRadius(2 + Math.random())
    mote.setPosition(startX, startY)
    mote.setFillStyle(0x22d3ee)
    mote.setAlpha(FLOAT_AMBIENT.alpha)
    mote.setVisible(true)
    mote.setData('busy', true)

    const bezierState = { t: 0 }
    this.scene.tweens.add({
      targets: bezierState,
      t: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = bezierState.t
        const mt = 1 - t
        mote.x = mt * mt * startX + 2 * mt * t * ctrlX + t * t * endX
        mote.y = mt * mt * startY + 2 * mt * t * ctrlY + t * t * endY
        // Fade out in the final 20% of the journey
        if (t > 0.8) {
          mote.setAlpha(FLOAT_AMBIENT.alpha * (1 - (t - 0.8) / 0.2))
        }
      },
      onComplete: () => {
        mote.setVisible(false)
        mote.setAlpha(FLOAT_AMBIENT.alpha)
        mote.setData('busy', false)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Task assignment trail — triggered by TASK_DISPATCHED event on EventBus
  // ---------------------------------------------------------------------------

  private initTaskTrailPools(): void {
    // Head dots traveling from room center to target desk
    for (let i = 0; i < 5; i++) {
      const dot = this.scene.add.circle(0, 0, 3, 0xffffff, 0)
        .setDepth(501)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      dot.setData('busy', false)
      this.taskTrailDotPool.push(dot)
    }
    // Ghost + burst particles shared pool
    for (let i = 0; i < 80; i++) {
      const ghost = this.scene.add.circle(0, 0, 2, 0xffffff, 0)
        .setDepth(500)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD)
      ghost.setData('busy', false)
      this.taskTrailGhostPool.push(ghost)
    }
  }

  private subscribeTaskDispatched(): void {
    this.taskDispatchListener = (...args: unknown[]) => {
      const [_agentId, roomCenterX, roomCenterY, deskX, deskY, rankLevel] =
        args as [string, number, number, number, number, number]
      this.spawnTaskAssignmentTrail(roomCenterX, roomCenterY, deskX, deskY, rankLevel)
    }
    EventBus.on(EVENTS.TASK_DISPATCHED, this.taskDispatchListener)
  }

  /** Animate a glowing dot from room center to the target agent's desk with a fading ghost trail. */
  spawnTaskAssignmentTrail(fromX: number, fromY: number, toX: number, toY: number, rankLevel: number): void {
    if (this._sleeping) return

    const dot = this.taskTrailDotPool.find(d => !d.getData('busy'))
    if (!dot) return

    // Pick rank tier color: gold (Expert+), blue (Agent+), slate (below)
    const rankColor = rankLevel >= 7 ? 0xfbbf24 : rankLevel >= 4 ? 0x3b82f6 : 0x64748b

    // Randomize bezier control point
    const midX = (fromX + toX) / 2
    const midY = (fromY + toY) / 2
    const sign = Math.random() > 0.5 ? 1 : -1
    const ctrlX = midX - (toY - fromY) * 0.4 * sign
    const ctrlY = midY + (toX - fromX) * 0.4 * sign

    dot.setRadius(3)
    dot.setPosition(fromX, fromY)
    dot.setFillStyle(rankColor)
    dot.setAlpha(0.9)
    dot.setVisible(true)
    dot.setData('busy', true)

    const TRAVEL_MS = 800
    const ghostCount = TRAIL_FADE.ghostCount.min + Math.floor(Math.random() * (TRAIL_FADE.ghostCount.max - TRAIL_FADE.ghostCount.min + 1))
    const ghostInterval = TRAVEL_MS / ghostCount

    // Schedule ghost spawns at regular intervals while the dot travels
    const ghostTimer = this.scene.time.addEvent({
      delay: ghostInterval,
      repeat: ghostCount - 1,
      callback: () => {
        this.spawnTrailGhost(dot.x, dot.y, rankColor)
      },
    })

    const bezierState = { t: 0 }
    this.scene.tweens.add({
      targets: bezierState,
      t: 1,
      duration: TRAVEL_MS,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const t = bezierState.t
        const mt = 1 - t
        dot.x = mt * mt * fromX + 2 * mt * t * ctrlX + t * t * toX
        dot.y = mt * mt * fromY + 2 * mt * t * ctrlY + t * t * toY
        if (t > 0.8) dot.setAlpha(0.9 * (1 - (t - 0.8) / 0.2))
      },
      onComplete: () => {
        ghostTimer.remove()
        dot.setVisible(false)
        dot.setAlpha(0.9)
        dot.setData('busy', false)
        this.spawnArrivalBurst(toX, toY, rankColor)
      },
    })
  }

  private spawnTrailGhost(x: number, y: number, color: number): void {
    const ghost = this.taskTrailGhostPool.find(g => !g.getData('busy'))
    if (!ghost) return

    ghost.setRadius(2)
    ghost.setPosition(x, y)
    ghost.setFillStyle(color)
    ghost.setAlpha(TRAIL_FADE.alphaStart)
    ghost.setVisible(true)
    ghost.setData('busy', true)

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: TRAIL_FADE.lifespan,
      ease: 'Linear',
      onComplete: () => {
        ghost.setVisible(false)
        ghost.setData('busy', false)
      },
    })
  }

  private spawnArrivalBurst(x: number, y: number, color: number): void {
    const count = BURST_RADIAL.count.min
    for (let i = 0; i < count; i++) {
      const p = this.taskTrailGhostPool.find(g => !g.getData('busy'))
      if (!p) break

      const angle = (i / count) * Math.PI * 2
      const speed = BURST_RADIAL.speedMin + Math.random() * (BURST_RADIAL.speedMax - BURST_RADIAL.speedMin)
      // Distance traveled = speed (px/sec) * duration (sec)
      const travelDuration = BURST_RADIAL.lifespan
      const dx = Math.cos(angle) * speed * (travelDuration / 1000)
      const dy = Math.sin(angle) * speed * (travelDuration / 1000)

      p.setRadius(2)
      p.setPosition(x, y)
      p.setFillStyle(color)
      p.setAlpha(0.8)
      p.setVisible(true)
      p.setData('busy', true)

      this.scene.tweens.add({
        targets: p,
        x: x + dx,
        y: y + dy + (BURST_RADIAL.gravity * (travelDuration / 1000) * (travelDuration / 1000)) / 2,
        alpha: 0,
        duration: travelDuration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          p.setVisible(false)
          p.setData('busy', false)
        },
      })
    }
  }

  triggerChimeRipple(wallClockContainer: Phaser.GameObjects.Container | null): void {
    if (!wallClockContainer) return

    const wx = wallClockContainer.x
    const wy = wallClockContainer.y

    const delays = [0, 200, 400]
    for (let i = 0; i < this.chimeRipplePool.length; i++) {
      const circle = this.chimeRipplePool[i]
      if (circle.getData('busy')) continue
      circle.setPosition(wx, wy)
      circle.setRadius(4)
      circle.setFillStyle(activeTheme.monitorGlowActive, 0.3)
      circle.setScale(1)
      circle.setAlpha(0.3)
      circle.setVisible(true)
      circle.setData('busy', true).setData('startedAt', this.scene.time.now)

      this.scene.time.delayedCall(delays[i], () => {
        this.scene.tweens.add({
          targets: circle,
          scaleX: 10,
          scaleY: 10,
          alpha: 0,
          duration: 1000,
          ease: 'Sine.easeOut',
          onComplete: () => {
            circle.setVisible(false)
            circle.setScale(1)
            circle.setAlpha(0.3)
            circle.setData('busy', false)
          },
        })
      })
    }
  }
}
