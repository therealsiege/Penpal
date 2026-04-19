// ---------------------------------------------------------------------------
// player-controller.ts
// RPG Layer 2: Player character with WASD / arrow-key movement.
//
// Creates a standalone player sprite (CHARACTERS sheet, frame 2) that can
// be moved with WASD or arrow keys at 120 px/sec.  Emits EVENTS.PLAYER_MOVED
// on EventBus each frame the player moves.  OfficeScene integrates this in
// create() and drives it via update().
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { SPRITESHEET_KEYS } from './office-asset-keys'
import { CHAR_SCALE } from './office-constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_SPEED_PX_SEC = 120  // world pixels per second

// Direction frame indices within the CHARACTERS spritesheet (character 0).
// POSE layout: 0=IDLE(down), 1=INTERACT(right), 2=SIT(spawn), 3=SURPRISE(up), 4=HURT, 5=WALK
const FRAME_SPAWN = 2   // initial / standing-still frame (as per issue spec)
const FRAME_DOWN  = 0   // facing down  (POSE_IDLE)
const FRAME_RIGHT = 1   // facing right (POSE_INTERACT)
const FRAME_UP    = 3   // facing up    (POSE_SURPRISE)
// Facing left = FRAME_RIGHT with flipX = true

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Axis-aligned bounding rectangle used for movement clamping. */
export interface NavigableBounds {
  x: number
  y: number
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// PlayerController
// ---------------------------------------------------------------------------

export class PlayerController {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyA!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  /**
   * Callback invoked each frame to obtain the navigable region.
   * Returns the union of room rects or a fallback world rect.
   * If null/undefined is returned, no clamping is applied.
   */
  private getBounds: () => NavigableBounds | null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    getBounds: () => NavigableBounds | null = () => null,
  ) {
    this.scene = scene
    this.getBounds = getBounds

    // Create sprite from character spritesheet, frame 2
    this.sprite = scene.add.sprite(x, y, SPRITESHEET_KEYS.CHARACTERS, FRAME_SPAWN)
    this.sprite.setScale(CHAR_SCALE)
    // Place player above workstation containers but below screen-space overlays
    this.sprite.setDepth(200)

    // Register keyboard inputs
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys()
      this.keyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
      this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      this.keyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
      this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    }
  }

  // ---------------------------------------------------------------------------
  // update — called every frame by OfficeScene.update()
  // @param dt  delta-time in milliseconds (Phaser's _delta argument)
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    if (!this.scene.input.keyboard) return

    const speedPerMs = PLAYER_SPEED_PX_SEC / 1000
    let vx = 0
    let vy = 0

    const goLeft  = this.cursors.left.isDown  || this.keyA.isDown
    const goRight = this.cursors.right.isDown || this.keyD.isDown
    const goUp    = this.cursors.up.isDown    || this.keyW.isDown
    const goDown  = this.cursors.down.isDown  || this.keyS.isDown

    if (goLeft)  vx -= 1
    if (goRight) vx += 1
    if (goUp)    vy -= 1
    if (goDown)  vy += 1

    // Normalize diagonal so diagonal speed == straight speed
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2
      vy *= Math.SQRT1_2
    }

    const dx = vx * speedPerMs * dt
    const dy = vy * speedPerMs * dt

    if (dx !== 0 || dy !== 0) {
      this.sprite.x += dx
      this.sprite.y += dy

      // --- Clamp to navigable bounds (room union or world rect) ---
      const bounds = this.getBounds()
      if (bounds) {
        // Use half the display size as the collision margin so the sprite
        // never overlaps the room wall by more than its own radius.
        const halfW = (this.sprite.displayWidth  || 16) * 0.5
        const halfH = (this.sprite.displayHeight || 16) * 0.5
        this.sprite.x = Phaser.Math.Clamp(
          this.sprite.x,
          bounds.x + halfW,
          bounds.x + bounds.width  - halfW,
        )
        this.sprite.y = Phaser.Math.Clamp(
          this.sprite.y,
          bounds.y + halfH,
          bounds.y + bounds.height - halfH,
        )
      }

      // --- 4-direction sprite facing ---
      this.sprite.setFlipX(false)

      if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal movement dominant
        if (dx > 0) {
          this.sprite.setFrame(FRAME_RIGHT)
        } else {
          this.sprite.setFrame(FRAME_RIGHT)
          this.sprite.setFlipX(true)
        }
      } else {
        // Vertical movement dominant
        if (dy < 0) {
          this.sprite.setFrame(FRAME_UP)
        } else {
          this.sprite.setFrame(FRAME_DOWN)
        }
      }

      EventBus.emit(EVENTS.PLAYER_MOVED, this.sprite.x, this.sprite.y)
    } else {
      // Standing still — return to neutral spawn frame
      this.sprite.setFrame(FRAME_SPAWN)
      this.sprite.setFlipX(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y)
  }

  destroy(): void {
    this.sprite.destroy()
  }
}
