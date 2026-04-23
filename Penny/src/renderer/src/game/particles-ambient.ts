import Phaser from 'phaser'
import { activeTheme } from './office-theme'
import { AMBIENT_MOTE_POOL_SIZE, MAKO_MOTE_POOL_SIZE, SPARK_POOL_SIZE, STEAM_WISP_POOL_SIZE, MAX_AMBIENT_MOTE_POOL, MAX_MAKO_MOTE_POOL, MAX_SPARK_POOL, MAX_STEAM_WISP_POOL } from './office-constants'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// AmbientParticles — atmospheric background effects
// Extracted from OfficeParticles (office-particles.ts)
// Includes: ambient motes, mako energy motes, spark bursts, steam wisps
// ---------------------------------------------------------------------------

export class AmbientParticles {
  private scene: Phaser.Scene

  // Ambient motes (Arc circles, Graphics diamonds, or Sprite stars)
  private ambientMotePool: (Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite)[] = []
  private ambientMoteTimer: Phaser.Time.TimerEvent | null = null
  private constellationGfx: Phaser.GameObjects.Graphics | null = null

  // Mako energy motes
  private makoMotePool: Phaser.GameObjects.Arc[] = []
  private lastMakoSpawnAt = 0

  // Spark burst particles
  private sparkPool: Phaser.GameObjects.Arc[] = []
  private lastSparkBurstAt = 0

  // Steam wisps
  private steamWispPool: Phaser.GameObjects.Graphics[] = []
  private lastSteamSpawnAt = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  init(): void {
    this.initAmbientMotePool()
    this.ambientMoteTimer = this.scene.time.addEvent({
      delay: 420,
      callback: () => this.tickAmbientMotes(),
      loop: true,
    })
    this.initMakoMotePool()
    this.initSparkPool()
    this.initSteamWispPool()
  }

  // ---------------------------------------------------------------------------
  // Ambient mote pool
  // ---------------------------------------------------------------------------

  private initAmbientMotePool(): void {
    this.constellationGfx = this.scene.add.graphics().setDepth(1)

    // Check if the game-icons spritesheet is loaded for star sprites
    const hasIcons = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)

    for (let i = 0; i < AMBIENT_MOTE_POOL_SIZE; i++) {
      let m: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics | Phaser.GameObjects.Sprite

      if (i % 16 === 0 && hasIcons) {
        // Every 16th mote is a tiny star sprite for sparkle variety
        const star = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_YELLOW)
          .setDepth(2)
          .setVisible(false)
          .setScale(0.10)
          .setBlendMode(Phaser.BlendModes.ADD)
        star.setData('isDiamond', false)
        star.setData('isStar', true)
        m = star
      } else if (i % 4 === 0) {
        const gfx = this.scene.add.graphics().setDepth(2).setVisible(false)
        const s = 1.6 + Math.random() * 0.8
        gfx.fillStyle(0xe2e8f0, 1)
        gfx.fillPoints([{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }], true)
        gfx.setData('isDiamond', true)
        gfx.setData('isStar', false)
        gfx.setData('baseSize', s)
        m = gfx
      } else {
        const r = 0.9 + Math.random() * 1.3
        const arc = this.scene.add.circle(0, 0, r, 0xe2e8f0, 0).setDepth(2).setVisible(false).setBlendMode(Phaser.BlendModes.ADD)
        arc.setData('isDiamond', false)
        arc.setData('isStar', false)
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
    if (this.ambientMotePool.filter(m => m.getData('busy')).length >= MAX_AMBIENT_MOTE_POOL) return
    const mote = this.ambientMotePool.find(m => !m.getData('busy'))
    if (!mote) return

    const view = this.scene.cameras.main.worldView
    const x = view.x + Math.random() * view.width
    const y = view.y + Math.random() * view.height

    const palette = activeTheme.particleColors
    const color = palette[Math.floor(Math.random() * palette.length)]

    if (mote.getData('isStar')) {
      // Star sprites use tint for coloring
      ;(mote as Phaser.GameObjects.Sprite).setTint(color)
    } else if (mote.getData('isDiamond')) {
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

      // Star sprites get a subtle scale pulse for sparkle effect
      if (mote.getData('isStar')) {
        const scalePulse = 0.08 + 0.04 * Math.sin(time * 0.003 + phase * 2.1)
        mote.setScale(scalePulse)
      }

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
  // Floating Mako motes — green energy drifting upward
  // ---------------------------------------------------------------------------

  private initMakoMotePool(): void {
    for (let i = 0; i < MAKO_MOTE_POOL_SIZE; i++) {
      const radius = 3 + Math.random() * 3
      const arc = this.scene.add.circle(0, 0, radius, activeTheme.doorFrame, 0)
        .setDepth(2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
      arc.setData('busy', false)
      this.makoMotePool.push(arc)
    }
  }

  tickMakoMotes(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    const now = this.scene.time.now
    if (now - this.lastMakoSpawnAt < 300) return
    if (zoom < 0.3) return
    this.lastMakoSpawnAt = now

    if (this.makoMotePool.filter(m => m.getData('busy')).length >= MAX_MAKO_MOTE_POOL) return
    const mote = this.makoMotePool.find(m => !m.getData('busy'))
    if (!mote) return

    const worldX = camX + Math.random() * camW
    const worldY = camY + Math.random() * camH
    const color = Math.random() < 0.5 ? activeTheme.doorFrame : activeTheme.monitorGlowActive
    const duration = 3000 + Math.random() * 2000
    const riseY = 60 + Math.random() * 60

    mote.setPosition(worldX, worldY)
    mote.setFillStyle(color)
    mote.setAlpha(0.25)
    mote.setVisible(true)
    mote.setData('busy', true)

    const startX = worldX
    const phaseOffset = Math.random() * Math.PI * 2

    this.scene.tweens.add({
      targets: mote,
      y: worldY - riseY,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const progress = tween.progress
        mote.x = startX + Math.sin(progress * Math.PI * 2 + phaseOffset) * 25
      },
      onComplete: () => {
        mote.setVisible(false)
        mote.setData('busy', false)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Spark bursts from pipe joints
  // ---------------------------------------------------------------------------

  private initSparkPool(): void {
    const sparkColors = [activeTheme.lampShade, 0xff8c00, 0xffffff]
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const radius = 1.5 + Math.random() * 2.0
      const color = sparkColors[i % sparkColors.length]
      const arc = this.scene.add.circle(0, 0, radius, color, 0)
        .setDepth(3)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
      arc.setData('busy', false)
      this.sparkPool.push(arc)
    }
  }

  tickSparks(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    const now = this.scene.time.now
    if (now - this.lastSparkBurstAt < 2000) return
    if (zoom < 0.5) return
    if (this.sparkPool.filter(s => s.getData('busy')).length >= MAX_SPARKS_POOL) return
    this.lastSparkBurstAt = now

    const centerX = camX + camW * 0.5
    const centerY = camY + camH * 0.5
    const burstX = centerX + (Math.random() - 0.5) * 400
    const burstY = centerY + (Math.random() - 0.5) * 400
    const sparkCount = 3 + Math.floor(Math.random() * 2)
    const sparkColors = [activeTheme.lampShade, 0xff8c00, 0xffffff]

    if (this.sparkPool.filter(s => s.getData('busy')).length >= MAX_SPARK_POOL) return
    for (let i = 0; i < sparkCount; i++) {
      const spark = this.sparkPool.find(s => !s.getData('busy'))
      if (!spark) break

      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)]
      const driftX = (Math.random() - 0.5) * 36
      const driftY = 12 + Math.random() * 12
      const duration = 200 + Math.random() * 300

      spark.setPosition(burstX, burstY)
      spark.setFillStyle(color)
      spark.setAlpha(1.0)
      spark.setScale(2.5)
      spark.setVisible(true)
      spark.setData('busy', true)

      this.scene.time.delayedCall(50, () => {
        spark.setScale(1.0)
      })

      this.scene.tweens.add({
        targets: spark,
        x: burstX + driftX,
        y: burstY + driftY,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          spark.setVisible(false)
          spark.setScale(1)
          spark.setData('busy', false)
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Steam wisps rising from vents
  // ---------------------------------------------------------------------------

  private initSteamWispPool(): void {
    for (let i = 0; i < STEAM_WISP_POOL_SIZE; i++) {
      const gfx = this.scene.add.graphics().setDepth(1).setVisible(false)
      gfx.setData('busy', false)
      this.steamWispPool.push(gfx)
    }
  }

  tickSteam(camX: number, camY: number, camW: number, camH: number, zoom: number): void {
    const now = this.scene.time.now
    if (now - this.lastSteamSpawnAt < 1500) return
    if (zoom < 0.3) return
    if (this.steamWispPool.filter(g => g.getData('busy')).length >= MAX_STEAM_POOL) return
    this.lastSteamSpawnAt = now

    if (this.steamWispPool.filter(g => g.getData('busy')).length >= MAX_STEAM_WISP_POOL) return
    const gfx = this.steamWispPool.find(g => !g.getData('busy'))
    if (!gfx) return

    const centerX = camX + camW * 0.5
    const centerY = camY + camH * 0.5
    const worldX = centerX + (Math.random() - 0.5) * 300
    const worldY = centerY + (Math.random() * 0.3 + 0.35) * camH

    gfx.clear()
    const alpha = 0.06 + Math.random() * 0.06
    gfx.fillStyle(activeTheme.metallicAlt, alpha)
    gfx.fillCircle(0, 0, 6 + Math.random() * 4)
    gfx.fillCircle(4, -2.5, 5 + Math.random() * 3)
    gfx.fillCircle(-3.5, -3.5, 4 + Math.random() * 3)

    gfx.setPosition(worldX, worldY)
    gfx.setAlpha(1)
    gfx.setScale(1)
    gfx.setVisible(true)
    gfx.setData('busy', true)

    const riseY = 35 + Math.random() * 20
    const duration = 2000 + Math.random() * 1000

    this.scene.tweens.add({
      targets: gfx,
      y: worldY - riseY,
      alpha: 0,
      scaleX: 2.0,
      scaleY: 2.0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => {
        gfx.setVisible(false)
        gfx.setData('busy', false)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Particle pool stats — used by debug overlay
  // ---------------------------------------------------------------------------

  getPoolStats(): Record<string, { active: number; max: number }> {
    return {
      ambientMotes: { active: this.ambientMotePool.filter(m => m.getData('busy')).length, max: MAX_AMBIENT_MOTE_POOL },
      makoMotes:    { active: this.makoMotePool.filter(m => m.getData('busy')).length,    max: MAX_MAKO_MOTE_POOL },
      sparks:       { active: this.sparkPool.filter(s => s.getData('busy')).length,        max: MAX_SPARK_POOL },
      steamWisps:   { active: this.steamWispPool.filter(g => g.getData('busy')).length,   max: MAX_STEAM_WISP_POOL },
    }
  }

  // ---------------------------------------------------------------------------
  // Sleep / Wake lifecycle
  // ---------------------------------------------------------------------------

  pause(): void {
    if (this.ambientMoteTimer) this.ambientMoteTimer.paused = true
  }

  resume(): void {
    if (this.ambientMoteTimer) this.ambientMoteTimer.paused = false
  }

  // ---------------------------------------------------------------------------
  // Destroy / cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.ambientMoteTimer?.destroy()
    this.ambientMoteTimer = null
    for (const m of this.ambientMotePool) { this.scene.tweens.killTweensOf(m); m.destroy() }
    this.ambientMotePool = []
    this.constellationGfx?.destroy()
    this.constellationGfx = null

    for (const m of this.makoMotePool) { this.scene.tweens.killTweensOf(m); m.destroy() }
    this.makoMotePool = []

    for (const s of this.sparkPool) { this.scene.tweens.killTweensOf(s); s.destroy() }
    this.sparkPool = []

    for (const g of this.steamWispPool) { this.scene.tweens.killTweensOf(g); g.destroy() }
    this.steamWispPool = []
  }
}
