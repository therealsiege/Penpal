// ---------------------------------------------------------------------------
// component-system.ts
// Composition-over-inheritance component system for agent workstations.
//
// Pattern inspired by the Zelda-like tutorial's BaseGameObjectComponent but
// adapted for Penny's module architecture:
//   - Components are keyed by a static `key` string (no prototype name tricks)
//   - ComponentHost is a standalone class, mixed into workstation objects via
//     containment rather than inheritance
//   - Starter components (Status, Animation, NameTag) reference Phaser types
//     and are ready to absorb logic from WorkstationSprite as refactors land
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState, AgentStatus, SessionMode } from '../types'

// ---------------------------------------------------------------------------
// Base Component
// ---------------------------------------------------------------------------

/**
 * Abstract base for every component that can be attached to a ComponentHost.
 * Subclasses MUST declare a static `key` — this is the canonical identity used
 * for lookup and prevents multiple instances of the same component type.
 */
export abstract class Component {
  /** Unique string key for this component type. Must be overridden as a static
   *  property on every concrete subclass. */
  static readonly key: string

  /** Called every game tick. `dt` is delta time in milliseconds. */
  abstract update(dt: number): void

  /** Called when the owning workstation is destroyed. Must clean up all
   *  Phaser objects, tweens, and timer events created by this component. */
  abstract destroy(): void
}

// ---------------------------------------------------------------------------
// ComponentHost
// ---------------------------------------------------------------------------

/**
 * Manages a keyed bag of components. Designed to be embedded inside
 * WorkstationSprite (or any future host object) rather than extended.
 *
 * Usage:
 *   const host = new ComponentHost()
 *   host.addComponent(new StatusComponent(scene, agentId, initialState))
 *   host.getComponent(StatusComponent)?.setMode('working')
 *   // each game tick:
 *   host.updateComponents(delta)
 *   // on destroy:
 *   host.destroyComponents()
 */
export class ComponentHost {
  private _components = new Map<string, Component>()

  /**
   * Attaches a component. Replaces any existing component registered under
   * the same key (old component is destroyed first).
   */
  addComponent<T extends Component>(component: T): this {
    const key = (component.constructor as typeof Component).key
    const existing = this._components.get(key)
    if (existing) existing.destroy()
    this._components.set(key, component)
    return this
  }

  /**
   * Retrieves a component by its constructor (uses the static `key`).
   * Returns `undefined` if the component has not been added.
   */
  getComponent<T extends Component>(ctor: { readonly key: string; new(...args: never[]): T }): T | undefined {
    return this._components.get(ctor.key) as T | undefined
  }

  /** Returns true if a component of the given type is currently attached. */
  hasComponent(ctor: { readonly key: string }): boolean {
    return this._components.has(ctor.key)
  }

  /** Removes and destroys a component by its constructor key. */
  removeComponent(ctor: { readonly key: string }): void {
    const c = this._components.get(ctor.key)
    if (c) {
      c.destroy()
      this._components.delete(ctor.key)
    }
  }

  /** Forward tick to every attached component. Call from the host's update. */
  updateComponents(dt: number): void {
    for (const c of this._components.values()) {
      c.update(dt)
    }
  }

  /** Destroy all components. Call when the owning object is being removed. */
  destroyComponents(): void {
    for (const c of this._components.values()) {
      c.destroy()
    }
    this._components.clear()
  }
}

// ---------------------------------------------------------------------------
// WorkstationAnimMode
// ---------------------------------------------------------------------------

/** Visual animation modes that drive sprite pose selection. */
export type WorkstationAnimMode = 'idle' | 'working' | 'waiting'

/** Maps an AgentStatus + SessionMode pair to a WorkstationAnimMode. */
export function resolveAnimMode(
  status: AgentStatus,
  mode: SessionMode | undefined
): WorkstationAnimMode {
  if (status === 'sleeping') return 'idle'
  if (status === 'idle') return 'idle'
  if (mode === 'waiting' || mode === 'compressing') return 'waiting'
  return 'working'
}

// ---------------------------------------------------------------------------
// StatusComponent
// ---------------------------------------------------------------------------

/**
 * Tracks and publishes agent status transitions for a workstation.
 *
 * Owns:
 *   - Current AgentState reference
 *   - Status dot color tween management (delegates gfx object in; does not
 *     create it — the dot is still built by createWorkstation today)
 *   - AGENT_STATE_CHANGED emission on meaningful state changes
 *
 * Planned absorption from WorkstationSprite:
 *   - `state` field
 *   - `lastStateFingerprint` logic from updateWorkstation()
 *   - Status-dot color + pulse tween (dotPulseTween)
 */
export class StatusComponent extends Component {
  static readonly key = 'StatusComponent'

  private scene: Phaser.Scene
  private agentId: string
  private _state: AgentState | null
  private _fingerprint: string = ''

  /** The status dot sprite managed by this component. Wired up post-creation. */
  statusDot: Phaser.GameObjects.Sprite | null = null
  dotPulseTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, agentId: string, initialState: AgentState | null = null) {
    super()
    this.scene = scene
    this.agentId = agentId
    this._state = initialState
    if (initialState) this._fingerprint = StatusComponent.fingerprint(initialState)
  }

  /** Current cached AgentState. */
  get state(): AgentState | null {
    return this._state
  }

  /**
   * Updates state and emits AGENT_STATE_CHANGED when the fingerprint changes.
   * Returns true if the state was considered new.
   */
  setState(next: AgentState): boolean {
    const fp = StatusComponent.fingerprint(next)
    if (fp === this._fingerprint) {
      this._state = next
      return false
    }
    const prev = this._state
    this._state = next
    this._fingerprint = fp
    EventBus.emit(EVENTS.AGENT_STATE_CHANGED, this.agentId, next, prev)
    return true
  }

  /** Resolved animation mode for the current state. */
  get animMode(): WorkstationAnimMode {
    if (!this._state) return 'idle'
    return resolveAnimMode(this._state.status, this._state.sessionMode)
  }

  update(_dt: number): void {
    // Pulse tween is managed externally for now; nothing to tick here.
  }

  destroy(): void {
    if (this.dotPulseTween) {
      this.dotPulseTween.stop()
      this.dotPulseTween = null
    }
    this.statusDot = null
    this._state = null
  }

  /** Stable fingerprint for change detection — matches existing logic in
   *  office-workstation.ts so future migration stays drop-in compatible. */
  static fingerprint(s: AgentState): string {
    return `${s.status}|${s.sessionMode ?? ''}|${s.needsInteraction ?? false}`
  }
}

// ---------------------------------------------------------------------------
// AnimationComponent
// ---------------------------------------------------------------------------

/**
 * Owns the character sprite and drives its animation pose.
 *
 * Owns:
 *   - Sprite reference (created externally, injected here)
 *   - Current pose tracking (idle / working / waiting)
 *   - Breath tween, bounce tween, head-tilt tween
 *   - lastAnimMode to skip redundant pose switches
 *
 * Planned absorption from WorkstationSprite:
 *   - `breathTween`, `bounceTween`, `headTiltTween`
 *   - updateAnimation() per-agent pose logic from office-workstation.ts
 */
export class AnimationComponent extends Component {
  static readonly key = 'AnimationComponent'

  private scene: Phaser.Scene
  sprite: Phaser.GameObjects.Sprite

  private _currentMode: WorkstationAnimMode = 'idle'
  breathTween: Phaser.Tweens.Tween | null = null
  bounceTween: Phaser.Tweens.Tween | null = null
  headTiltTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
    super()
    this.scene = scene
    this.sprite = sprite
  }

  get currentMode(): WorkstationAnimMode {
    return this._currentMode
  }

  /**
   * Switches the sprite to the given animation mode. Stops conflicting tweens
   * and hands off to the appropriate pose setup method. Returns early if the
   * mode is unchanged, keeping tween continuity.
   */
  setMode(mode: WorkstationAnimMode): void {
    if (mode === this._currentMode) return
    this._currentMode = mode
    this._clearMotionTweens()

    switch (mode) {
      case 'working':
        this._startWorkingPose()
        break
      case 'waiting':
        this._startWaitingPose()
        break
      default:
        this._startIdlePose()
    }
  }

  /** Tick — nothing to drive frame-by-frame; tweens self-manage. */
  update(_dt: number): void {}

  destroy(): void {
    this._clearMotionTweens()
    // sprite itself is owned by the workstation container; do not destroy it here
  }

  private _clearMotionTweens(): void {
    if (this.breathTween) { this.breathTween.stop(); this.breathTween = null }
    if (this.bounceTween) { this.bounceTween.stop(); this.bounceTween = null }
    if (this.headTiltTween) { this.headTiltTween.stop(); this.headTiltTween = null }
    this.sprite.setScale(this.sprite.scaleX > 0 ? Math.abs(this.sprite.scaleX) : 1)
  }

  private _startIdlePose(): void {
    this.breathTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: this.sprite.scaleY, to: this.sprite.scaleY * 0.97 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private _startWorkingPose(): void {
    this.bounceTween = this.scene.tweens.add({
      targets: this.sprite,
      y: { from: this.sprite.y, to: this.sprite.y - 2 },
      duration: 340,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private _startWaitingPose(): void {
    this.headTiltTween = this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: 0, to: 4 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}

// ---------------------------------------------------------------------------
// NameTagComponent
// ---------------------------------------------------------------------------

/**
 * Manages the name label + optional role badge text above a workstation.
 *
 * Owns:
 *   - nameText Phaser.GameObjects.Text
 *   - roleBadge Phaser.GameObjects.Text | null
 *   - roleBadgePulseTween
 *
 * Planned absorption from WorkstationSprite:
 *   - `nameText`, `roleBadge`, `roleBadgePulseTween` fields
 *   - updateNameTag() / role badge logic from office-workstation.ts
 */
export class NameTagComponent extends Component {
  static readonly key = 'NameTagComponent'

  private scene: Phaser.Scene
  readonly nameText: Phaser.GameObjects.Text
  roleBadge: Phaser.GameObjects.Text | null = null
  roleBadgePulseTween: Phaser.Tweens.Tween | null = null

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    label: string,
    y: number,
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ) {
    super()
    this.scene = scene
    this.nameText = scene.add.text(0, y, label, {
      fontSize: '9px',
      color: '#c8d0d8',
      resolution: 2,
      ...style,
    }).setOrigin(0.5, 0)
    container.add(this.nameText)
  }

  /** Replace the displayed name without recreating the Text object. */
  setLabel(label: string): void {
    this.nameText.setText(label)
  }

  /**
   * Creates or updates the role badge (S / R / E pod role indicator).
   * Pass `null` to hide the badge.
   */
  setRoleBadge(
    container: Phaser.GameObjects.Container,
    role: string | null,
    color: string = '#f0c040'
  ): void {
    if (role === null) {
      if (this.roleBadge) {
        this.roleBadge.destroy()
        this.roleBadge = null
      }
      if (this.roleBadgePulseTween) {
        this.roleBadgePulseTween.stop()
        this.roleBadgePulseTween = null
      }
      return
    }

    if (!this.roleBadge) {
      this.roleBadge = this.scene.add.text(
        this.nameText.x + this.nameText.width / 2 + 5,
        this.nameText.y,
        role,
        { fontSize: '7px', color, resolution: 2, fontStyle: 'bold' }
      ).setOrigin(0, 0)
      container.add(this.roleBadge)
    } else {
      this.roleBadge.setText(role).setColor(color)
    }
  }

  /** Starts a pulse tween on the role badge to draw attention. */
  pulseRoleBadge(): void {
    if (!this.roleBadge) return
    if (this.roleBadgePulseTween) this.roleBadgePulseTween.stop()
    this.roleBadgePulseTween = this.scene.tweens.add({
      targets: this.roleBadge,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (this.roleBadge) this.roleBadge.setAlpha(1)
        this.roleBadgePulseTween = null
      },
    })
  }

  update(_dt: number): void {}

  destroy(): void {
    if (this.roleBadgePulseTween) {
      this.roleBadgePulseTween.stop()
      this.roleBadgePulseTween = null
    }
    this.nameText.destroy()
    if (this.roleBadge) {
      this.roleBadge.destroy()
      this.roleBadge = null
    }
  }
}
