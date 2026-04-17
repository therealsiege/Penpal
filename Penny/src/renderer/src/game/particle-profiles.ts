// ---------------------------------------------------------------------------
// Particle profile constants — reusable configs for particle emitter systems
// ---------------------------------------------------------------------------

/** Radial burst: 8-16 particles exploding outward in all directions with gravity */
export const BURST_RADIAL = {
  /** Number of particles to spawn */
  count: { min: 8, max: 16 },
  /** Outward velocity range (px/sec) */
  speedMin: 50,
  speedMax: 100,
  /** Downward gravity (px/sec²) */
  gravity: 50,
  /** Particle lifespan in milliseconds */
  lifespan: 600,
} as const

/** Trail fade: ghost particles following a moving target, alpha decaying from start to end */
export const TRAIL_FADE = {
  /** Number of ghost positions to maintain */
  ghostCount: { min: 5, max: 8 },
  /** Starting alpha of the nearest (most recent) ghost */
  alphaStart: 0.4,
  /** Alpha of the farthest (oldest) ghost */
  alphaEnd: 0.05,
  /** Ghost lifespan in milliseconds */
  lifespan: 300,
} as const

/** Ambient float: slow-drifting motes in corridors and room airspace */
export const FLOAT_AMBIENT = {
  /** Drift speed range (px/sec) */
  driftMin: 5,
  driftMax: 15,
  /** Gravity (0 = floating, no downward pull) */
  gravity: 0,
  /** Mote lifespan in milliseconds */
  lifespan: 3000,
  /** Base alpha */
  alpha: 0.3,
} as const
