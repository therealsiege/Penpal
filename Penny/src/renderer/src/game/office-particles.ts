import Phaser from 'phaser'
import { activeTheme } from './office-theme'
import { WS_DESK_Y } from './office-constants'
import { SPRITESHEET_KEYS } from './office-asset-keys'
import { WeatherParticles } from './particles-weather'
import { AmbientParticles } from './particles-ambient'

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
    p.setAlpha(0.9).setVisible(true).setData('busy', true)
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
    free.setData('busy', true)

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
    const circle = this.alertRipplePool.find(c => !c.getData('busy'))
    if (!circle) return

    circle.setPosition(worldX, worldY)
    circle.setRadius(4)
    circle.setFillStyle(color, 0)
    circle.setStrokeStyle(1.5, color, 0.4)
    circle.setAlpha(0.4)
    circle.setScale(1)
    circle.setVisible(true)
    circle.setData('busy', true)

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
        .text(0, 0, '', { fontSize: '12px', resolution: 2 })
        .setDepth(500)
        .setAlpha(0)
        .setData('busy', false)
      this.emojiReactionPool.push(label)
    }
  }

  spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void {
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
    if (this._reducedMode && Math.random() > 0.3) return
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
    p.setAlpha(Math.min(0.98, 0.72 + alphaBias)).setVisible(true).setData('busy', true)

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
        .circle(0, 0, 1, 0x00e5ff, 0)
        .setDepth(-0.4)
        .setVisible(false)
      circle.setData('busy', false)
      this.chimeRipplePool.push(circle)
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
      circle.setFillStyle(0x00e5ff, 0.3)
      circle.setScale(1)
      circle.setAlpha(0.3)
      circle.setVisible(true)
      circle.setData('busy', true)

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
