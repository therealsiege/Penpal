// ---------------------------------------------------------------------------
// agent-avatar.ts
// Self-contained RPG-style agent avatar: sprite + shadow + state machine +
// PathWalker integration. Handles idle micro-variety, walking, sitting, and
// coffee-run states. Y-sort depth is updated each frame.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { NavPoint } from './nav-mesh'
import type { NavMesh } from './nav-mesh'
import { PathWalker } from './path-walker'
import { StateMachine } from './state-machine'
import { ANIM_KEYS } from './office-asset-keys'
import {
  CHAR_SCALE,
  IDLE_WALK_BREAK_MIN_MS,
  IDLE_WALK_BREAK_VAR_MS,
  IDLE_WALK_RANGE_X,
} from './office-constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WALK_SPEED = 55
const SHADOW_OFFSET_Y = 8
const SHADOW_W = 18
const SHADOW_H = 6
const SHADOW_COLOR = 0x000000
const SHADOW_ALPHA = 0.25

// Idle micro-variety timing
const LOOK_AROUND_MIN_MS = 8000
const LOOK_AROUND_VAR_MS = 7000
const STRETCH_MIN_MS = 20000
const STRETCH_VAR_MS = 10000
const YAWN_DELAY_MS = 60000

// Walk break nearby-point range
const WALK_RANGE_MIN = 30
const WALK_RANGE_MAX = 60

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AgentAvatarConfig {
  scene: Phaser.Scene
  x: number
  y: number
  navMesh: NavMesh
  /** 0 or 1 — selects walk/idle/sit sprite sheet variant */
  charIndex?: number
  speed?: number
  depth?: number
}

// ---------------------------------------------------------------------------
// AgentAvatar
// ---------------------------------------------------------------------------

export class AgentAvatar {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Ellipse

  private scene: Phaser.Scene
  private navMesh: NavMesh
  private fsm: StateMachine
  private walker: PathWalker
  private charIndex: number
  private idleTimers: Phaser.Time.TimerEvent[] = []
  private homeX: number
  private homeY: number
  private destroyed = false

  constructor(config: AgentAvatarConfig) {
    const {
      scene, x, y, navMesh,
      charIndex = 0,
      speed = DEFAULT_WALK_SPEED,
    } = config

    this.scene = scene
    this.navMesh = navMesh
    this.charIndex = charIndex
    this.homeX = x
    this.homeY = y

    // Resolve sprite sheet keys — char 1 uses _2 variants, others use _1
    const walkKey = charIndex === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1
    const sitKey = charIndex === 1 ? ANIM_KEYS.SIT_2 : ANIM_KEYS.SIT_1

    // Create shadow
    this.shadow = scene.add.ellipse(x, y + SHADOW_OFFSET_Y, SHADOW_W, SHADOW_H, SHADOW_COLOR, SHADOW_ALPHA)

    // Create sprite — walk sheet frame 0 = facing down idle
    this.sprite = scene.add.sprite(x, y, walkKey, 0)
      .setScale(CHAR_SCALE)
      .setOrigin(0.5, 1)

    if (config.depth !== undefined) {
      this.sprite.setDepth(config.depth)
      this.shadow.setDepth(config.depth - 1)
    }

    // PathWalker — handles directional walk animation, dust puffs, trail dots
    this.walker = new PathWalker(scene, this.sprite, this.shadow, walkKey, speed)

    // State machine
    this.fsm = new StateMachine('agent-avatar')

    this.fsm.addState({
      name: 'idle',
      onEnter: () => this.enterIdle(),
      onUpdate: () => this.ySortDepth(),
      onExit: () => this.clearIdleTimers(),
    })

    this.fsm.addState({
      name: 'walking',
      onEnter: () => {}, // walkTo sets up the path before transitioning
      onUpdate: () => {
        this.ySortDepth()
        // Safety: if walker finished but state is still 'walking', transition
        if (!this.walker.isWalking()) {
          this.fsm.setState('idle')
        }
      },
      onExit: () => {},
    })

    this.fsm.addState({
      name: 'sitting',
      onEnter: () => {
        this.walker.cancel()
        this.sprite.setTexture(sitKey, 0)
        this.sprite.setAngle(0)
      },
      onUpdate: () => this.ySortDepth(),
      onExit: () => {
        // Return to walk sheet idle frame
        this.sprite.setTexture(walkKey, 0)
      },
    })

    this.fsm.addState({
      name: 'coffee-run',
      onEnter: () => {}, // caller manages path via startCoffeeRun
      onUpdate: () => this.ySortDepth(),
      onExit: () => {},
    })
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Call from scene update() each frame */
  update(dt: number): void {
    if (this.destroyed) return
    this.fsm.update(dt)
  }

  /** Walk to a world position. Pathfinds via NavMesh. */
  walkTo(x: number, y: number, onComplete?: () => void): void {
    if (this.destroyed) return
    const start = { x: this.sprite.x, y: this.sprite.y }
    const end = { x, y }
    const path = this.navMesh.findPath(start, end)
    if (!path || path.length === 0) {
      onComplete?.()
      return
    }
    this.walker.startPath(path, () => {
      this.fsm.setState('idle')
      onComplete?.()
    })
    this.fsm.setState('walking')
  }

  /** Enter sitting state */
  sit(): void {
    if (this.destroyed) return
    this.fsm.setState('sitting')
  }

  /** Enter idle state (with micro-variety timers) */
  idle(): void {
    if (this.destroyed) return
    this.fsm.setState('idle')
  }

  /** Walk along waypoints without auto-returning to idle on completion */
  startCoffeeRun(waypoints: NavPoint[], onComplete?: () => void): void {
    if (this.destroyed) return
    this.fsm.setState('coffee-run')
    this.walker.startPath(waypoints, () => {
      onComplete?.()
    })
  }

  get position(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  get stateName(): string {
    return this.fsm.currentStateName ?? 'none'
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.clearIdleTimers()
    this.walker.destroy()
    this.sprite.destroy()
    this.shadow.destroy()
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private ySortDepth(): void {
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setDepth(this.sprite.y - 1)
  }

  private enterIdle(): void {
    this.sprite.setAngle(0)
    this.scheduleIdleTimers()
  }

  private clearIdleTimers(): void {
    for (const timer of this.idleTimers) {
      timer.destroy()
    }
    this.idleTimers = []
  }

  private scheduleIdleTimers(): void {
    this.clearIdleTimers()

    // Look-around: subtle angle tilt
    this.idleTimers.push(
      this.scene.time.addEvent({
        delay: LOOK_AROUND_MIN_MS + Math.random() * LOOK_AROUND_VAR_MS,
        loop: true,
        callback: () => {
          if (this.destroyed || this.fsm.currentStateName !== 'idle') return
          const dir = Math.random() < 0.5 ? -4 : 4
          this.scene.tweens.add({
            targets: this.sprite,
            angle: dir,
            duration: 400,
            ease: 'Sine.easeInOut',
            yoyo: true,
            hold: 1000,
          })
        },
      }),
    )

    // Stretch: slight scaleY increase
    this.idleTimers.push(
      this.scene.time.addEvent({
        delay: STRETCH_MIN_MS + Math.random() * STRETCH_VAR_MS,
        loop: true,
        callback: () => {
          if (this.destroyed || this.fsm.currentStateName !== 'idle') return
          this.scene.tweens.add({
            targets: this.sprite,
            scaleY: CHAR_SCALE * 1.04,
            duration: 300,
            ease: 'Sine.easeInOut',
            yoyo: true,
            hold: 200,
          })
        },
      }),
    )

    // Walk break: wander to a nearby point then return
    this.idleTimers.push(
      this.scene.time.addEvent({
        delay: IDLE_WALK_BREAK_MIN_MS + Math.random() * IDLE_WALK_BREAK_VAR_MS,
        loop: true,
        callback: () => {
          if (this.destroyed || this.fsm.currentStateName !== 'idle') return
          const rx = (Math.random() < 0.5 ? -1 : 1) * (WALK_RANGE_MIN + Math.random() * (WALK_RANGE_MAX - WALK_RANGE_MIN))
          const ry = (Math.random() < 0.5 ? -1 : 1) * (WALK_RANGE_MIN + Math.random() * (WALK_RANGE_MAX - WALK_RANGE_MIN))
          const tx = this.homeX + rx
          const ty = this.homeY + ry
          this.walkTo(tx, ty)
        },
      }),
    )
  }
}
