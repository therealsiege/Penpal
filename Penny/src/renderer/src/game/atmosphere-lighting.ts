import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// AtmosphereLighting
// Manages: window glint, ceiling light activity, chime ripple pool.
// Created by OfficeAtmosphere.
// ---------------------------------------------------------------------------

export class AtmosphereLighting {
  private scene: Phaser.Scene

  // Window glint state (gfx + positions are owned by OfficeAtmosphere / OfficeScene,
  // passed in each tick call; timing state lives here)
  private lastGlintAt = 0
  private glintActiveWindow = -1
  private glintStartTime = 0
  private glintNextInterval = 14000 // randomized per cycle: 12-20s
  private readonly GLINT_DURATION = 400

  // Ceiling lights activity
  private lastLightCheckAt = 0
  private lightActivityMode: 'active' | 'idle' = 'idle'

  // Chime ripple pool
  private chimeRipplePool: Phaser.GameObjects.Arc[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Chime ripple pool
  // ---------------------------------------------------------------------------

  initChimeRipplePool(): void {
    for (let i = 0; i < 3; i++) {
      const circle = this.scene.add
        .circle(0, 0, 1, 0x00e5ff, 0)
        .setDepth(-0.4)
        .setVisible(false)
      circle.setData('busy', false)
      this.chimeRipplePool.push(circle)
    }
  }

  triggerChimeRipple(clockX: number, clockY: number): void {
    const delays = [0, 200, 400]
    for (let i = 0; i < this.chimeRipplePool.length; i++) {
      const circle = this.chimeRipplePool[i]
      if (circle.getData('busy')) continue
      circle.setPosition(clockX, clockY)
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

  // ---------------------------------------------------------------------------
  // Window glint
  // ---------------------------------------------------------------------------

  tickWindowGlint(
    time: number,
    gfx: Phaser.GameObjects.Graphics | null,
    windowPositions: { x: number; y: number; w: number; h: number }[],
  ): void {
    if (!gfx || windowPositions.length === 0) return

    // Start a new glint sweep every 12-20s (randomized per cycle)
    if (this.glintActiveWindow === -1 && time - this.lastGlintAt >= this.glintNextInterval) {
      this.glintActiveWindow = Math.floor(Math.random() * windowPositions.length)
      this.glintStartTime = time
      this.lastGlintAt = time
      // Randomize the next interval for organic feel
      this.glintNextInterval = 12000 + Math.random() * 8000
    }

    gfx.clear()
    if (this.glintActiveWindow === -1) return

    const win = windowPositions[this.glintActiveWindow]
    if (!win) { this.glintActiveWindow = -1; return }
    const elapsed = time - this.glintStartTime
    const t = Math.min(elapsed / this.GLINT_DURATION, 1)

    if (t >= 1) {
      this.glintActiveWindow = -1
      return
    }

    // Thin diagonal bar sweeping left to right across the window
    const barW = 2
    const barX = win.x + t * (win.w - barW)
    // Slight diagonal offset — the bar shifts 2px down as it sweeps across
    const diagonalOffset = t * 2
    const alpha = 0.15 * Math.sin(t * Math.PI) // fade in and out for softness
    gfx.fillStyle(0xffffff, alpha)
    gfx.fillRect(barX, win.y + diagonalOffset, barW, win.h)
  }

  // ---------------------------------------------------------------------------
  // Ceiling lights activity
  // ---------------------------------------------------------------------------

  tickCeilingLightActivity(
    time: number,
    ceilingLights: Phaser.GameObjects.Container[],
    rooms: Map<string, { workstations: Map<string, { state: { sessionMode?: string; needsInteraction?: boolean } | null }> }>,
  ): void {
    if (ceilingLights.length === 0 || time - this.lastLightCheckAt < 5000) return
    this.lastLightCheckAt = time
    let activeCount = 0
    for (const room of rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction) {
          activeCount++
        }
      }
    }
    const nextMode: 'active' | 'idle' = activeCount > 0 ? 'active' : 'idle'
    if (nextMode === this.lightActivityMode) return
    this.lightActivityMode = nextMode
    const lo = nextMode === 'active' ? 0.2 : 0.1
    const hi = nextMode === 'active' ? 0.35 : 0.2
    for (const lightContainer of ceilingLights) {
      const children = lightContainer.getAll()
      const innerCore = children[2] as Phaser.GameObjects.Arc | undefined
      if (innerCore) {
        this.scene.tweens.killTweensOf(innerCore)
        this.scene.tweens.add({ targets: innerCore, alpha: { from: lo, to: hi }, duration: 2000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
      }
    }
  }

  destroyCeilingLights(ceilingLights: Phaser.GameObjects.Container[]): void {
    for (const c of ceilingLights) {
      for (const child of c.getAll()) {
        this.scene.tweens.killTweensOf(child)
      }
      c.destroy(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const c of this.chimeRipplePool) { this.scene.tweens.killTweensOf(c); c.destroy() }
    this.chimeRipplePool = []
  }
}
