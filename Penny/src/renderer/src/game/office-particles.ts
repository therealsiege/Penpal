import Phaser from 'phaser'
import { activeTheme } from './office-theme'
import { WS_DESK_Y, AMBIENT_MOTE_POOL_SIZE } from './office-constants'

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
    sessionMode: string
    needsInteraction: boolean
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

  // Typing spark particles
  private typingParticlePool: Phaser.GameObjects.Arc[] = []
  private typingParticleTimer: Phaser.Time.TimerEvent | null = null

  // Ambient motes
  private ambientMotePool: (Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics)[] = []
  private ambientMoteTimer: Phaser.Time.TimerEvent | null = null
  private constellationGfx: Phaser.GameObjects.Graphics | null = null

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

  // Window rain effect (screen-space)
  private rainDropPool: Phaser.GameObjects.Line[] = []
  private rainActive = false

  // Window snow effect (screen-space)
  private snowPool: Phaser.GameObjects.Arc[] = []
  private snowActive = false

  // Confetti burst particle emitter
  private confettiEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  // Chime ripple pool
  private chimeRipplePool: Phaser.GameObjects.Arc[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Public API — accessor for mouseTrailPool used by OfficeScene's pointermove
  // ---------------------------------------------------------------------------

  getMouseTrailPool(): Phaser.GameObjects.Arc[] {
    return this.mouseTrailPool
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.initParticlePool()
    this.typingParticleTimer = this.scene.time.addEvent({
      delay: 200, callback: () => this.tickParticlesInternal(), loop: true,
    })
    this.initAmbientMotePool()
    this.initRainPool(viewWidth, viewHeight)
    this.initSnowPool(viewWidth, viewHeight)
    this.ambientMoteTimer = this.scene.time.addEvent({
      delay: 420,
      callback: () => this.tickAmbientMotes(),
      loop: true,
    })
    this.initCorridorParticlePool()
    this.corridorParticleTimer = this.scene.time.addEvent({
      delay: 300,
      callback: () => this.tickCorridorParticlesInternal(),
      loop: true,
    })
    this.initAlertRipplePool()
    this.initChimeRipplePool()
    this.initEmojiReactionPool()
    this.initMouseTrailPool()

    // Confetti burst emitter
    const confettiGfx = this.scene.make.graphics({ x: 0, y: 0, add: false })
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

    this.ambientMoteTimer?.destroy()
    this.ambientMoteTimer = null
    for (const m of this.ambientMotePool) { this.scene.tweens.killTweensOf(m); m.destroy() }
    this.ambientMotePool = []
    this.constellationGfx?.destroy()
    this.constellationGfx = null

    this.corridorParticleTimer?.destroy()
    this.corridorParticleTimer = null
    for (const p of this.corridorParticlePool) { this.scene.tweens.killTweensOf(p); p.destroy() }
    this.corridorParticlePool = []

    for (const d of this.rainDropPool) d.destroy()
    this.rainDropPool = []
    this.rainActive = false

    for (const f of this.snowPool) f.destroy()
    this.snowPool = []
    this.snowActive = false

    for (const c of this.alertRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.alertRipplePool = []

    for (const c of this.chimeRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.chimeRipplePool = []

    for (const t of this.emojiReactionPool) { this.scene.tweens.killTweensOf(t); t.destroy() }
    this.emojiReactionPool = []

    for (const c of this.mouseTrailPool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.mouseTrailPool = []

    if (this.confettiEmitter) {
      this.confettiEmitter.destroy()
      this.confettiEmitter = null
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
  // Rain pool (screen-space)
  // ---------------------------------------------------------------------------

  private initRainPool(viewWidth: number, viewHeight: number): void {
    const RAIN_COUNT = 40
    for (let i = 0; i < RAIN_COUNT; i++) {
      const len = 8 + Math.random() * 6
      const alpha = 0.15 + Math.random() * 0.10
      const speed = 3 + Math.random() * 2
      const x = Math.random() * viewWidth
      const y = Math.random() * viewHeight
      const drop = this.scene.add.line(0, 0, x, y, x + 1, y + len, 0x60a5fa, alpha)
      drop.setOrigin(0, 0)
      drop.setLineWidth(1)
      drop.setDepth(9990)
      drop.setScrollFactor(0)
      drop.setVisible(false)
      drop.setData('speed', speed)
      this.rainDropPool.push(drop)
    }
  }

  tickRain(viewWidth: number, viewHeight: number): void {
    for (const drop of this.rainDropPool) {
      if (!drop.visible) continue
      const speed = drop.getData('speed') as number
      drop.x += 1
      drop.y += speed
      const y1 = drop.geom.y1
      if (drop.y + y1 > viewHeight + 16) {
        drop.x = Math.random() * viewWidth
        drop.y = -16 - Math.random() * 80
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Snow pool (screen-space)
  // ---------------------------------------------------------------------------

  private initSnowPool(viewWidth: number, viewHeight: number): void {
    const SNOW_COUNT = 30
    for (let i = 0; i < SNOW_COUNT; i++) {
      const radius = 1 + Math.random() * 1.5
      const alpha = 0.2 + Math.random() * 0.2
      const flake = this.scene.add.circle(Math.random() * viewWidth, Math.random() * viewHeight, radius, 0xffffff, alpha)
      flake.setScrollFactor(0)
      flake.setDepth(9989)
      flake.setVisible(false)
      flake.setData('speed', 1 + Math.random())
      this.snowPool.push(flake)
    }
  }

  tickSnow(time: number, viewWidth: number, viewHeight: number): void {
    for (let i = 0; i < this.snowPool.length; i++) {
      const flake = this.snowPool[i]
      if (!flake.visible) continue
      const speed = flake.getData('speed') as number
      flake.y += speed
      flake.x += Math.sin(time * 0.001 + i) * 0.5
      if (flake.y > viewHeight + 4) {
        flake.x = Math.random() * viewWidth
        flake.y = -4 - Math.random() * 40
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Weather control (called from applyDayNightPhase in OfficeScene)
  // ---------------------------------------------------------------------------

  setWeather(phase: 'morning' | 'day' | 'evening' | 'night', viewWidth: number, viewHeight: number): void {
    const shouldRain = phase === 'night'
    if (shouldRain !== this.rainActive) {
      this.rainActive = shouldRain
      for (const drop of this.rainDropPool) {
        if (shouldRain) {
          drop.x = Math.random() * viewWidth
          drop.y = -16 - Math.random() * viewHeight
          drop.setVisible(true)
        } else {
          drop.setVisible(false)
        }
      }
    }

    const shouldSnow = phase === 'morning'
    if (shouldSnow !== this.snowActive) {
      this.snowActive = shouldSnow
      for (const flake of this.snowPool) {
        if (shouldSnow) {
          flake.x = Math.random() * viewWidth
          flake.y = Math.random() * viewHeight
          flake.setVisible(true)
        } else {
          flake.setVisible(false)
        }
      }
    }
  }

  isRainActive(): boolean { return this.rainActive }
  isSnowActive(): boolean { return this.snowActive }

  // ---------------------------------------------------------------------------
  // Ambient mote pool
  // ---------------------------------------------------------------------------

  private initAmbientMotePool(): void {
    this.constellationGfx = this.scene.add.graphics().setDepth(1)

    for (let i = 0; i < AMBIENT_MOTE_POOL_SIZE; i++) {
      let m: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics

      if (i % 4 === 0) {
        const gfx = this.scene.add.graphics().setDepth(2).setVisible(false)
        const s = 1.6 + Math.random() * 0.8
        gfx.fillStyle(0xe2e8f0, 1)
        gfx.fillPoints([{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }], true)
        gfx.setData('isDiamond', true)
        gfx.setData('baseSize', s)
        m = gfx
      } else {
        const r = 0.9 + Math.random() * 1.3
        const arc = this.scene.add.circle(0, 0, r, 0xe2e8f0, 0).setDepth(2).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
        arc.setData('isDiamond', false)
        m = arc
      }

      m.setData('busy', false)
      m.setData('phaseOffset', Math.random() * Math.PI * 2)
      m.setData('moteIndex', i)
      m.setData('originX', 0)
      m.setData('originY', 0)
      m.setData('driftX', 0)
      m.setData('driftY', 0)
      m.setData('lifetime', 0)
      m.setData('elapsed', 0)
      m.setData('baseAlpha', 0)

      this.ambientMotePool.push(m)
    }
  }

  private spawnAmbientMote(): void {
    const mote = this.ambientMotePool.find(m => !m.getData('busy'))
    if (!mote) return

    const view = this.scene.cameras.main.worldView
    const x = view.x + Math.random() * view.width
    const y = view.y + Math.random() * view.height

    const palette = activeTheme.particleColors
    const color = palette[Math.floor(Math.random() * palette.length)]

    if (mote.getData('isDiamond')) {
      const gfx = mote as Phaser.GameObjects.Graphics
      const s = mote.getData('baseSize') as number
      gfx.clear()
      gfx.fillStyle(color, 1)
      gfx.fillPoints([{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }], true)
    } else {
      ;(mote as Phaser.GameObjects.Arc).setFillStyle(color)
    }

    const baseAlpha = 0.18 + Math.random() * 0.18
    const lifetime = 2600 + Math.random() * 2200

    mote.setPosition(x, y)
    mote.setAlpha(baseAlpha)
    mote.setVisible(true)
    mote.setData('busy', true)
    mote.setData('originX', x)
    mote.setData('originY', y)
    mote.setData('driftX', (Math.random() - 0.5) * 16)
    mote.setData('driftY', -18 - Math.random() * 24)
    mote.setData('lifetime', lifetime)
    mote.setData('elapsed', 0)
    mote.setData('baseAlpha', baseAlpha)
  }

  tickAmbientMotes(): void {
    if (this.scene.cameras.main.zoom < 0.62) return
    if (Math.random() < 0.55) this.spawnAmbientMote()

    const time = this.scene.time.now
    const delta = this.scene.game.loop.delta

    const activePositions: { x: number; y: number }[] = []

    for (const mote of this.ambientMotePool) {
      if (!mote.getData('busy')) continue

      const elapsed: number = (mote.getData('elapsed') as number) + delta
      const lifetime: number = mote.getData('lifetime') as number
      const progress = elapsed / lifetime

      if (progress >= 1) {
        mote.setVisible(false)
        mote.setData('busy', false)
        continue
      }

      mote.setData('elapsed', elapsed)

      const originX = mote.getData('originX') as number
      const originY = mote.getData('originY') as number
      const driftX = mote.getData('driftX') as number
      const driftY = mote.getData('driftY') as number
      const phase = mote.getData('phaseOffset') as number
      const idx = mote.getData('moteIndex') as number
      const baseAlpha = mote.getData('baseAlpha') as number

      const sway = Math.sin(time * 0.001 + idx + phase) * 6
      mote.setPosition(originX + driftX * progress + sway, originY + driftY * progress)

      const fadeOut = 1 - progress * progress
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.0023 + phase * 1.7)
      mote.setAlpha(Math.min(baseAlpha, Math.max(0, (0.15 + twinkle * 0.25) * fadeOut)))

      const anyMote = mote as unknown as { getCenter?: () => { x: number; y: number } }
      const center = anyMote.getCenter ? anyMote.getCenter() : { x: mote.x, y: mote.y }
      activePositions.push({ x: center.x, y: center.y })
    }

    const cgfx = this.constellationGfx
    if (cgfx) {
      cgfx.clear()
      let connections = 0
      const maxConnections = 4
      const threshSq = 60 * 60
      outer: for (let i = 0; i < activePositions.length - 1; i++) {
        for (let j = i + 1; j < activePositions.length; j++) {
          const dx = activePositions[i].x - activePositions[j].x
          const dy = activePositions[i].y - activePositions[j].y
          if (dx * dx + dy * dy < threshSq) {
            cgfx.lineStyle(0.5, 0xffffff, 0.05 + Math.random() * 0.05)
            cgfx.beginPath()
            cgfx.moveTo(activePositions[i].x, activePositions[i].y)
            cgfx.lineTo(activePositions[j].x, activePositions[j].y)
            cgfx.strokePath()
            if (++connections >= maxConnections) break outer
          }
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
  // Chime ripple pool
  // ---------------------------------------------------------------------------

  private initChimeRipplePool(): void {
    for (let i = 0; i < 3; i++) {
      const circle = this.scene.add
        .circle(0, 0, 1, 0xfbbf24, 0)
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
      circle.setFillStyle(0xfbbf24, 0.3)
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
