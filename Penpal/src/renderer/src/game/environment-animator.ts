// ---------------------------------------------------------------------------
// environment-animator.ts
// Ambient animation for lab environment props: server rack LED blinks and
// cable energy flow dots. Designed as a lightweight update-loop system.
//
// Usage:
//   const animator = new EnvironmentAnimator(scene)
//   animator.registerProp('rack', x, y, { ledCount: 3 })
//   animator.registerProp('cable', 0, 0, { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] })
//   // in scene update:
//   animator.update(delta)
//   // on cleanup:
//   animator.destroy()
// ---------------------------------------------------------------------------

import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vec2 { x: number; y: number }

interface LedState {
  gfx: Phaser.GameObjects.Rectangle
  countdown: number   // ms remaining until next color change
  interval: number    // ms between changes (randomised per LED)
  colorIdx: number    // 0=green, 1=amber, 2=off
}

interface CableDot {
  circle: Phaser.GameObjects.Arc
  dist: number        // distance along path in world-px (wraps at totalLength)
}

interface CableFlow {
  points: Vec2[]
  segLengths: number[]
  totalLength: number
  dots: CableDot[]
}

export interface RackPropOpts {
  /** Number of LEDs to overlay (2-3). Defaults to 2. */
  ledCount?: number
  /** Y offset from prop centre for LED row. Defaults to -8. */
  ledYOffset?: number
  /** Depth for LED rectangles. Defaults to -1.4. */
  depth?: number
}

export interface CablePropOpts {
  /** Ordered world-space waypoints for the cable path (minimum 2). */
  points: Vec2[]
  /** Depth for flow dots. Defaults to -1.4. */
  depth?: number
}

export type PropType = 'rack' | 'cable'
export type PropOpts = RackPropOpts | CablePropOpts

// ---------------------------------------------------------------------------
// LED color table
// ---------------------------------------------------------------------------

const LED_COLORS: [number, number][] = [
  [0x22c55e, 0.90],  // 0 — green  (normal)
  [0xf59e0b, 0.85],  // 1 — amber  (busy)
  [0x111827, 0.15],  // 2 — off
]

/** Weighted random: 60% green, 25% amber, 15% off */
function randomLedColorIdx(): number {
  const r = Math.random()
  if (r < 0.60) return 0
  if (r < 0.85) return 1
  return 2
}

// ---------------------------------------------------------------------------
// EnvironmentAnimator
// ---------------------------------------------------------------------------

export class EnvironmentAnimator {
  private scene: Phaser.Scene
  private leds: LedState[] = []
  private flows: CableFlow[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Register a prop for ambient animation.
   *
   * @param type  'rack' — adds blinking LED rectangles over the prop sprite.
   *              'cable' — adds travelling cyan dots along a cable path.
   * @param x     World X of the prop centre (rack) or ignored (cable — use opts.points).
   * @param y     World Y of the prop centre (rack) or ignored (cable — use opts.points).
   * @param opts  Type-specific options.
   */
  registerProp(type: 'rack', x: number, y: number, opts?: RackPropOpts): void
  registerProp(type: 'cable', x: number, y: number, opts: CablePropOpts): void
  registerProp(type: PropType, x: number, y: number, opts?: PropOpts): void {
    if (type === 'rack') {
      this._registerRack(x, y, opts as RackPropOpts | undefined)
    } else {
      const co = opts as CablePropOpts
      if (co?.points && co.points.length >= 2) {
        this._registerCableFlow(co.points, co.depth)
      }
    }
  }

  /**
   * Call from scene update(). dt is Phaser's delta in milliseconds.
   */
  update(dt: number): void {
    this._updateLeds(dt)
    this._updateFlows(dt)
  }

  /** Destroy all created game objects. */
  destroy(): void {
    for (const led of this.leds) led.gfx.destroy()
    for (const flow of this.flows) {
      for (const dot of flow.dots) dot.circle.destroy()
    }
    this.leds = []
    this.flows = []
  }

  // -------------------------------------------------------------------------
  // Server rack LEDs
  // -------------------------------------------------------------------------

  private _registerRack(x: number, y: number, opts?: RackPropOpts): void {
    const count = Math.min(3, Math.max(2, opts?.ledCount ?? 2))
    const yOff  = opts?.ledYOffset ?? -8
    const depth = opts?.depth ?? -1.4
    const spacing = 6
    const startX = x - ((count - 1) * spacing) / 2

    for (let i = 0; i < count; i++) {
      const lx = startX + i * spacing
      const ly = y + yOff

      const colorIdx = randomLedColorIdx()
      const [fill, alpha] = LED_COLORS[colorIdx]!
      const rect = this.scene.add
        .rectangle(lx, ly, 3, 3, fill)
        .setDepth(depth)
        .setAlpha(alpha)

      const interval = 500 + Math.random() * 1500
      this.leds.push({
        gfx: rect,
        countdown: Math.random() * interval,
        interval,
        colorIdx,
      })
    }
  }

  private _updateLeds(dt: number): void {
    for (const led of this.leds) {
      led.countdown -= dt
      if (led.countdown > 0) continue

      // Transition: if off → pick an active color; otherwise random
      let next: number
      if (led.colorIdx === 2) {
        next = Math.random() < 0.7 ? 0 : 1   // bias back to green
      } else {
        next = randomLedColorIdx()
      }
      led.colorIdx = next
      const [fill, alpha] = LED_COLORS[next]!
      led.gfx.setFillStyle(fill).setAlpha(alpha)
      led.interval = 500 + Math.random() * 1500
      led.countdown = led.interval
    }
  }

  // -------------------------------------------------------------------------
  // Cable energy flow
  // -------------------------------------------------------------------------

  private _registerCableFlow(points: Vec2[], depth = -1.4): void {
    const segLengths: number[] = []
    let total = 0
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x
      const dy = points[i + 1].y - points[i].y
      const len = Math.sqrt(dx * dx + dy * dy)
      segLengths.push(len)
      total += len
    }
    if (total < 20) return

    // 2-4 dots, staggered along path
    const dotCount = Math.min(4, Math.max(2, Math.floor(total / 40)))
    const spacing = total / dotCount
    const dots: CableDot[] = []

    for (let d = 0; d < dotCount; d++) {
      const startDist = d * spacing
      const pos = this._posAtDist(points, segLengths, total, startDist)
      const circle = this.scene.add
        .circle(pos.x, pos.y, 4, 0x22d3ee)
        .setDepth(depth)
        .setAlpha(0.5)
      dots.push({ circle, dist: startDist })
    }

    this.flows.push({ points, segLengths, totalLength: total, dots })
  }

  private _updateFlows(dt: number): void {
    const dtSec = dt / 1000
    const SPEED = 30  // px/sec

    for (const flow of this.flows) {
      for (const dot of flow.dots) {
        dot.dist = (dot.dist + SPEED * dtSec) % flow.totalLength

        const pos = this._posAtDist(flow.points, flow.segLengths, flow.totalLength, dot.dist)
        dot.circle.setPosition(pos.x, pos.y)

        // Alpha pulse: 0.5 base, spikes to 0.8 mid-segment
        const segFrac = this._segFrac(flow.segLengths, dot.dist)
        const pulse = Math.sin(segFrac * Math.PI)
        dot.circle.setAlpha(0.5 + pulse * 0.3)
      }
    }
  }

  /** World position along the path at a given cumulative distance. */
  private _posAtDist(
    points: Vec2[],
    segLengths: number[],
    _totalLength: number,
    dist: number,
  ): Vec2 {
    let acc = 0
    for (let s = 0; s < segLengths.length; s++) {
      const len = segLengths[s]!
      if (dist <= acc + len || s === segLengths.length - 1) {
        const frac = len > 0 ? (dist - acc) / len : 0
        const p0 = points[s]!
        const p1 = points[s + 1]!
        return {
          x: p0.x + (p1.x - p0.x) * frac,
          y: p0.y + (p1.y - p0.y) * frac,
        }
      }
      acc += len
    }
    return points[points.length - 1]!
  }

  /** Fractional position within the current segment (0..1) — for alpha pulse. */
  private _segFrac(segLengths: number[], dist: number): number {
    let acc = 0
    for (const len of segLengths) {
      if (dist <= acc + len) {
        return len > 0 ? (dist - acc) / len : 0
      }
      acc += len
    }
    return 1
  }
}
