// ---------------------------------------------------------------------------
// Shared types for strategic lab layout (JSON loader + computeStrategic*).
// ---------------------------------------------------------------------------

export interface StrategicSpritePlacement {
  frame: number
  x: number
  y: number
  scale: number
  alpha: number
  depth: number
  spritesheet: 'lab-props'
  tint?: number
  angle?: number
}

/** When set (multi-room facility), anchors must lie on real room tile — not the corridor inside the union AABB. */
export interface StrategicFloorClipRect {
  x: number
  y: number
  width: number
  height: number
}
