import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { WorkstationSprite } from './office-types'

// ---------------------------------------------------------------------------
// NpcInteractionManager — RPG Layer 3a
// Shows an "E" interaction prompt when the player stands near an agent desk.
// ---------------------------------------------------------------------------

export class NpcInteractionManager {
  static readonly INTERACTION_RADIUS = 80

  private readonly scene: Phaser.Scene

  /** World-space container holding the prompt (bg + text). */
  private promptContainer: Phaser.GameObjects.Container
  /** Dark rounded-rect background for the prompt. */
  private promptBg: Phaser.GameObjects.Graphics
  /** "E" label displayed inside the prompt. */
  private promptText: Phaser.GameObjects.Text
  /** Bob animation tween — runs while prompt is visible. */
  private bobTween: Phaser.Tweens.Tween | null = null

  /** agentId of the nearest in-range workstation, or null. */
  private nearestAgentId: string | null = null

  private eKey: Phaser.Input.Keyboard.Key | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // -----------------------------------------------------------------------
    // Build the prompt (hidden by default)
    // -----------------------------------------------------------------------
    const BG_W = 22
    const BG_H = 22
    const RADIUS = 5

    this.promptBg = scene.add.graphics()
    this.promptBg.fillStyle(0x111111, 0.82)
    this.promptBg.fillRoundedRect(-BG_W / 2, -BG_H / 2, BG_W, BG_H, RADIUS)

    this.promptText = scene.add.text(0, 0, 'E', {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: '9px',
      color: '#ffffff',
      resolution: 2,
    }).setOrigin(0.5, 0.5)

    this.promptContainer = scene.add.container(0, 0, [this.promptBg, this.promptText])
    this.promptContainer.setDepth(9000)
    this.promptContainer.setVisible(false)

    // -----------------------------------------------------------------------
    // Keyboard binding
    // -----------------------------------------------------------------------
    if (scene.input.keyboard) {
      this.eKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Call every frame from the scene's update() loop.
   *
   * playerX/playerY are world-space coordinates of the controllable avatar
   * (or camera centre as a proxy until a real player sprite exists).
   */
  update(playerX: number, playerY: number, workstations: WorkstationSprite[]): void {
    let nearest: WorkstationSprite | null = null
    let nearestDist = NpcInteractionManager.INTERACTION_RADIUS

    for (const ws of workstations) {
      // Skip desks with no assigned agent.
      if (!ws.state) continue

      const mat = ws.container.getWorldTransformMatrix()
      const dist = Phaser.Math.Distance.Between(playerX, playerY, mat.tx, mat.ty)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = ws
      }
    }

    if (nearest) {
      const agentId = nearest.state!.config.id
      this.nearestAgentId = agentId

      // Position prompt above the agent sprite (40px above container centre).
      const mat = nearest.container.getWorldTransformMatrix()
      this.promptContainer.setPosition(mat.tx, mat.ty - 40)
      this._showPrompt()
    } else {
      this.nearestAgentId = null
      this._hidePrompt()
    }

    // Fire interaction on E key down.
    if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey) && this.nearestAgentId) {
      EventBus.emit(EVENTS.AGENT_INTERACT, this.nearestAgentId)
    }
  }

  /** Returns the agentId of the nearest agent within interaction radius, or null. */
  getInteractableAgent(): string | null {
    return this.nearestAgentId
  }

  destroy(): void {
    this.bobTween?.destroy()
    this.promptContainer.destroy()
    if (this.eKey && this.scene.input.keyboard) {
      this.scene.input.keyboard.removeKey(this.eKey)
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _showPrompt(): void {
    if (this.promptContainer.visible) return
    this.promptContainer.setVisible(true)
    this.promptContainer.setAlpha(0)

    this.scene.tweens.add({
      targets: this.promptContainer,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    })

    this._startBob()
  }

  private _hidePrompt(): void {
    if (!this.promptContainer.visible) return
    this.bobTween?.stop()
    this.bobTween = null

    this.scene.tweens.add({
      targets: this.promptContainer,
      alpha: 0,
      duration: 80,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.promptContainer.setVisible(false)
        this.promptContainer.y = this.promptContainer.y  // reset any y drift
      },
    })
  }

  private _startBob(): void {
    if (this.bobTween) return
    const baseY = this.promptContainer.y
    this.bobTween = this.scene.tweens.add({
      targets: this.promptContainer,
      y: baseY - 5,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }
}
