// ---------------------------------------------------------------------------
// camera-cinematics.ts
// Event-driven auto-pan with a priority queue.
//
// Listens on EventBus for key game events (task dispatch/complete, pod launch,
// rank-up, agent error) and triggers scripted camera sequences. A priority
// queue prevents lower-priority events from interrupting higher-priority ones.
// Any user input (click, key, scroll) immediately cancels the active cinematic.
//
// Priority (highest first):
//   rank-up (5) > pod-launch (4) > agent-error (3) > task-complete (2) > task-dispatch (1)
//
// Debounce: same event type within 3 s is dropped.
// Queue overflow: task-dispatch is dropped when > 3 items pending.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { OfficeCamera } from './office-camera'
import { getWorkstationWorldPos } from './office-camera'
import type { Room } from './office-types'
import { ZOOM_MAX } from './office-constants'

const LETTERBOX_HEIGHT_RATIO = 0.08  // 8% of screen height
const LETTERBOX_ANIM_MS      = 200   // slide duration in ms
const LETTERBOX_DEPTH        = 9998  // screen-space overlay depth

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoPanEventType =
  | 'task-dispatch'
  | 'task-complete'
  | 'pod-launch'
  | 'rank-up'
  | 'agent-error'

const PRIORITY: Record<AutoPanEventType, number> = {
  'rank-up':       5,
  'pod-launch':    4,
  'agent-error':   3,
  'task-complete': 2,
  'task-dispatch': 1,
}

const DEBOUNCE_MS = 3000
const MAX_QUEUE_FOR_TASK_DISPATCH = 3

interface QueuedEvent {
  type: AutoPanEventType
  /** Primary agent is [0]; pod launch has solver[0], reviewer[1], executor[2]. */
  agentIds: string[]
  priority: number
}

export interface CinematicsHostScene {
  getRooms(): Map<string, Room>
  getOfficeCamera(): OfficeCamera
  lockCinematicInput(): void
  unlockCinematicInput(): void
  cameras: Phaser.Cameras.Scene2D.CameraManager
  tweens: Phaser.Tweens.TweenManager
  time: Phaser.Time.Clock
  input: Phaser.Input.InputPlugin
  add: Phaser.GameObjects.GameObjectFactory
}

// ---------------------------------------------------------------------------
// CameraCinematics
// ---------------------------------------------------------------------------

export class CameraCinematics {
  private scene: Phaser.Scene
  private host: CinematicsHostScene

  private queue: QueuedEvent[] = []
  private activePriority = -1
  private running = false

  /** Last emission time per event type — used for debounce. */
  private lastTrigger: Partial<Record<AutoPanEventType, number>> = {}

  // ---------------------------------------------------------------------------
  // Letterbox state
  // ---------------------------------------------------------------------------

  private _letterboxTop: Phaser.GameObjects.Rectangle | null = null
  private _letterboxBottom: Phaser.GameObjects.Rectangle | null = null
  private _letterboxActive = false

  // EventBus listener refs (stored for cleanup)
  private readonly _onTaskDispatched = (...args: unknown[]) => {
    this._enqueue('task-dispatch', [args[0] as string])
  }
  private readonly _onTaskCompleted = (...args: unknown[]) => {
    this._enqueue('task-complete', [args[0] as string])
  }
  private readonly _onPodLaunched = (...args: unknown[]) => {
    this._enqueue('pod-launch', args[0] as string[])
  }
  private readonly _onRankUp = (...args: unknown[]) => {
    this._enqueue('rank-up', [args[0] as string])
  }
  private readonly _onAgentError = (...args: unknown[]) => {
    this._enqueue('agent-error', [args[0] as string])
  }

  // Season ceremony listeners — letterbox wraps the full ceremony duration
  private readonly _onSeasonStarted = () => { this.enterLetterbox() }
  private readonly _onSeasonEnded   = () => { this.exitLetterbox() }

  // User-input cancel listeners
  private readonly _onPointerDown = (_p: Phaser.Input.Pointer) => { this._cancelActive() }
  private readonly _onKeyDown = (_e: KeyboardEvent) => { this._cancelActive() }
  private readonly _onWheel = () => { this._cancelActive() }

  constructor(scene: Phaser.Scene, host: CinematicsHostScene) {
    this.scene = scene
    this.host = host
  }

  init(): void {
    EventBus.on(EVENTS.TASK_DISPATCHED, this._onTaskDispatched)
    EventBus.on(EVENTS.TASK_COMPLETED, this._onTaskCompleted)
    EventBus.on(EVENTS.POD_LAUNCHED, this._onPodLaunched)
    EventBus.on(EVENTS.RANK_UP, this._onRankUp)
    EventBus.on(EVENTS.AGENT_ERROR, this._onAgentError)
    EventBus.on(EVENTS.SEASON_STARTED, this._onSeasonStarted)
    EventBus.on(EVENTS.SEASON_ENDED, this._onSeasonEnded)

    this.scene.input.on('pointerdown', this._onPointerDown)
    this.scene.input.keyboard?.on('keydown', this._onKeyDown)
    this.scene.input.on('wheel', this._onWheel)
  }

  destroy(): void {
    EventBus.off(EVENTS.TASK_DISPATCHED, this._onTaskDispatched)
    EventBus.off(EVENTS.TASK_COMPLETED, this._onTaskCompleted)
    EventBus.off(EVENTS.POD_LAUNCHED, this._onPodLaunched)
    EventBus.off(EVENTS.RANK_UP, this._onRankUp)
    EventBus.off(EVENTS.AGENT_ERROR, this._onAgentError)
    EventBus.off(EVENTS.SEASON_STARTED, this._onSeasonStarted)
    EventBus.off(EVENTS.SEASON_ENDED, this._onSeasonEnded)

    this.scene.input.off('pointerdown', this._onPointerDown)
    this.scene.input.keyboard?.off('keydown', this._onKeyDown)
    this.scene.input.off('wheel', this._onWheel)

    // Clean up any visible letterbox bars
    this._letterboxTop?.destroy()
    this._letterboxBottom?.destroy()
    this._letterboxTop = null
    this._letterboxBottom = null
  }

  // ---------------------------------------------------------------------------
  // Queue management
  // ---------------------------------------------------------------------------

  private _enqueue(type: AutoPanEventType, agentIds: string[]): void {
    const now = this.scene.time.now

    // Debounce: same type within 3 s gets dropped
    const last = this.lastTrigger[type] ?? 0
    if (now - last < DEBOUNCE_MS) return

    // Overflow: skip task-dispatch when queue is already large
    if (type === 'task-dispatch' && this.queue.length >= MAX_QUEUE_FOR_TASK_DISPATCH) return

    const priority = PRIORITY[type]

    // Don't interrupt an active higher-priority sequence
    if (this.running && priority < this.activePriority) return

    // Cancel lower-priority active sequence if a higher-priority event arrives
    if (this.running && priority > this.activePriority) {
      this._cancelActive()
    }

    this.lastTrigger[type] = now

    this.queue.push({ type, agentIds, priority })
    // Highest priority at front
    this.queue.sort((a, b) => b.priority - a.priority)

    if (!this.running) {
      this._processNext()
    }
  }

  private _cancelActive(): void {
    if (!this.running) return

    // Kill any camera tweens
    const cam = this.host.cameras.main
    this.host.tweens.killTweensOf(cam)

    // Release zoom lock
    this.host.getOfficeCamera().setCinematicZoomLock(false)
    this.host.unlockCinematicInput()

    // Force-remove letterbox bars without animation
    if (this._letterboxActive) {
      this._letterboxActive = false
      if (this._letterboxTop) {
        this.host.tweens.killTweensOf(this._letterboxTop)
        this._letterboxTop.destroy()
        this._letterboxTop = null
      }
      if (this._letterboxBottom) {
        this.host.tweens.killTweensOf(this._letterboxBottom)
        this._letterboxBottom.destroy()
        this._letterboxBottom = null
      }
    }

    this.running = false
    this.activePriority = -1
    this.queue = []
  }

  private _processNext(): void {
    if (this.queue.length === 0) {
      this.running = false
      this.activePriority = -1
      return
    }

    const evt = this.queue.shift()!
    this.running = true
    this.activePriority = evt.priority

    this._playSequence(evt, () => {
      this.running = false
      this.activePriority = -1
      if (this.queue.length > 0) {
        // Small gap between consecutive sequences
        this.scene.time.delayedCall(200, () => this._processNext())
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Sequence dispatcher
  // ---------------------------------------------------------------------------

  private _playSequence(evt: QueuedEvent, onComplete: () => void): void {
    const rooms = this.host.getRooms()
    const cam = this.host.getOfficeCamera()

    switch (evt.type) {
      case 'task-dispatch': this._seqTaskDispatch(evt.agentIds[0], rooms, cam, onComplete); break
      case 'task-complete': this._seqTaskComplete(evt.agentIds[0], rooms, cam, onComplete); break
      case 'pod-launch':    this._seqPodLaunch(evt.agentIds, rooms, cam, onComplete);       break
      case 'rank-up':       this._seqRankUp(evt.agentIds[0], rooms, cam, onComplete);       break
      case 'agent-error':   this._seqAgentError(evt.agentIds[0], rooms, cam, onComplete);   break
    }
  }

  // ---------------------------------------------------------------------------
  // Letterbox bars (public — may also be called from OfficeScene ceremony hooks)
  // ---------------------------------------------------------------------------

  /**
   * Slide black bars in from top and bottom edges (8% screen height each).
   * No-op if letterbox is already active.
   */
  enterLetterbox(onComplete?: () => void): void {
    if (this._letterboxActive) { onComplete?.(); return }
    this._letterboxActive = true

    const cam = this.host.cameras.main
    const barH = Math.round(cam.height * LETTERBOX_HEIGHT_RATIO)
    const w = cam.width

    // Destroy any stale bars left from a force-cancel
    this._letterboxTop?.destroy()
    this._letterboxBottom?.destroy()

    this._letterboxTop = this.scene.add
      .rectangle(0, -barH, w, barH, 0x000000)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(LETTERBOX_DEPTH)

    this._letterboxBottom = this.scene.add
      .rectangle(0, cam.height, w, barH, 0x000000)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(LETTERBOX_DEPTH)

    let doneCount = 0
    const onBarDone = () => { if (++doneCount === 2) onComplete?.() }

    this.host.tweens.add({
      targets: this._letterboxTop,
      y: 0,
      duration: LETTERBOX_ANIM_MS,
      ease: 'Sine.easeOut',
      onComplete: onBarDone,
    })
    this.host.tweens.add({
      targets: this._letterboxBottom,
      y: cam.height - barH,
      duration: LETTERBOX_ANIM_MS,
      ease: 'Sine.easeOut',
      onComplete: onBarDone,
    })
  }

  /**
   * Slide the letterbox bars back out. No-op if not active.
   */
  exitLetterbox(onComplete?: () => void): void {
    if (!this._letterboxActive) { onComplete?.(); return }
    this._letterboxActive = false

    const cam = this.host.cameras.main
    const barH = Math.round(cam.height * LETTERBOX_HEIGHT_RATIO)

    let doneCount = 0
    const onBarDone = () => {
      if (++doneCount === 2) {
        this._letterboxTop?.destroy()
        this._letterboxBottom?.destroy()
        this._letterboxTop = null
        this._letterboxBottom = null
        onComplete?.()
      }
    }

    if (this._letterboxTop) {
      this.host.tweens.add({
        targets: this._letterboxTop,
        y: -barH,
        duration: LETTERBOX_ANIM_MS,
        ease: 'Sine.easeIn',
        onComplete: onBarDone,
      })
    } else {
      onBarDone()
    }

    if (this._letterboxBottom) {
      this.host.tweens.add({
        targets: this._letterboxBottom,
        y: cam.height,
        duration: LETTERBOX_ANIM_MS,
        ease: 'Sine.easeIn',
        onComplete: onBarDone,
      })
    } else {
      onBarDone()
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _pos(agentId: string, rooms: Map<string, Room>): { x: number; y: number } | null {
    return getWorkstationWorldPos(agentId, rooms)
  }

  /**
   * Tween the camera's zoom property directly, with the cinematicZoomLock
   * preventing the targetZoom lerp from fighting the tween.
   */
  private _zoomTo(
    toZoom: number,
    duration: number,
    ease: string,
    onComplete: () => void,
  ): void {
    const mainCam = this.host.cameras.main
    const offCam = this.host.getOfficeCamera()
    offCam.setCinematicZoomLock(true)
    this.host.lockCinematicInput()

    this.host.tweens.add({
      targets: mainCam,
      zoom: Phaser.Math.Clamp(toZoom, 0.2, ZOOM_MAX),
      duration,
      ease,
      onComplete: () => {
        offCam.targetZoom = mainCam.zoom
        offCam.setCinematicZoomLock(false)
        this.host.unlockCinematicInput()
        onComplete()
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Sequence implementations
  // ---------------------------------------------------------------------------

  /**
   * Task Dispatched: pan (800 ms) → zoom 1.2× (400 ms) → zoom back (400 ms)
   */
  private _seqTaskDispatch(
    agentId: string,
    rooms: Map<string, Room>,
    cam: OfficeCamera,
    onComplete: () => void,
  ): void {
    const pos = this._pos(agentId, rooms)
    if (!pos) { onComplete(); return }

    const baseZoom = this.host.cameras.main.zoom
    cam.smoothPanTo(pos.x, pos.y, 800, () => {
      const peakZoom = Math.min(baseZoom * 1.2, ZOOM_MAX)
      this._zoomTo(peakZoom, 400, 'Sine.easeOut', () => {
        this._zoomTo(baseZoom, 400, 'Sine.easeIn', onComplete)
      })
    })
  }

  /**
   * Task Completed: pan (600 ms) → hold 1 s → return (600 ms zoom-to-fit)
   */
  private _seqTaskComplete(
    agentId: string,
    rooms: Map<string, Room>,
    cam: OfficeCamera,
    onComplete: () => void,
  ): void {
    const pos = this._pos(agentId, rooms)
    if (!pos) { onComplete(); return }

    cam.smoothPanTo(pos.x, pos.y, 600, () => {
      this.scene.time.delayedCall(1000, onComplete)
    })
  }

  /**
   * Pod Launched:
   *   pan agent1 (500 ms) → zip agent2 (300 ms) → zip agent3 (300 ms) →
   *   zoom out show-all (400 ms) → hold 1 s → zoom back (600 ms)
   */
  private _seqPodLaunch(
    agentIds: string[],
    rooms: Map<string, Room>,
    cam: OfficeCamera,
    onComplete: () => void,
  ): void {
    const positions = agentIds
      .slice(0, 3)
      .map(id => this._pos(id, rooms))
      .filter((p): p is { x: number; y: number } => p !== null)

    if (positions.length === 0) { onComplete(); return }

    const mainCam = this.host.cameras.main
    const baseZoom = mainCam.zoom

    const visitAgent = (idx: number) => {
      if (idx >= positions.length) {
        // All agents visited — zoom out to show all
        const xs = positions.map(p => p.x)
        const ys = positions.map(p => p.y)
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2
        const zoomOut = Math.max(baseZoom * 0.65, 0.3)

        cam.smoothPanTo(cx, cy, 400, () => {
          this._zoomTo(zoomOut, 400, 'Sine.easeOut', () => {
            this.scene.time.delayedCall(1000, () => {
              this._zoomTo(baseZoom, 600, 'Sine.easeInOut', onComplete)
            })
          })
        })
        return
      }

      const dur = idx === 0 ? 500 : 300
      cam.smoothPanTo(positions[idx].x, positions[idx].y, dur, () => visitAgent(idx + 1))
    }

    visitAgent(0)
  }

  /**
   * Rank Up: letterbox in (200 ms) → pan (500 ms) → zoom 1.5× (400 ms) →
   *          hold 2 s → zoom back (500 ms) → letterbox out (200 ms)
   */
  private _seqRankUp(
    agentId: string,
    rooms: Map<string, Room>,
    cam: OfficeCamera,
    onComplete: () => void,
  ): void {
    const pos = this._pos(agentId, rooms)
    if (!pos) { onComplete(); return }

    const baseZoom = this.host.cameras.main.zoom
    const peakZoom = Math.min(baseZoom * 1.5, ZOOM_MAX)

    this.enterLetterbox(() => {
      cam.smoothPanTo(pos.x, pos.y, 500, () => {
        this._zoomTo(peakZoom, 400, 'Sine.easeOut', () => {
          this.scene.time.delayedCall(2000, () => {
            this._zoomTo(baseZoom, 500, 'Sine.easeInOut', () => {
              this.exitLetterbox(onComplete)
            })
          })
        })
      })
    })
  }

  /**
   * Agent Error: quick pan (400 ms, Back.easeOut for jerk) → red flash → hold 1 s → done
   */
  private _seqAgentError(
    agentId: string,
    rooms: Map<string, Room>,
    cam: OfficeCamera,
    onComplete: () => void,
  ): void {
    const pos = this._pos(agentId, rooms)
    if (!pos) { onComplete(); return }

    const mainCam = this.host.cameras.main

    // Jerky ease via Back.easeOut (slight overshoot)
    cam.smoothPanTo(pos.x, pos.y, 400, () => {
      // Brief red overlay flash
      const overlay = this.host.add
        .rectangle(0, 0, mainCam.width * 4, mainCam.height * 4, 0xff2222, 0.2)
        .setScrollFactor(0)
        .setDepth(9998)
      this.host.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 450,
        ease: 'Sine.easeOut',
        onComplete: () => overlay.destroy(),
      })
      this.scene.time.delayedCall(1000, onComplete)
    }, 'Back.easeOut')
  }
}
