// ---------------------------------------------------------------------------
// lab-strategic-layout-loader.ts
// Loads lab-strategic-layout.json and produces StrategicSpritePlacement[] with
// the same gates and geometry as the previous inline TS layout.
// ---------------------------------------------------------------------------

import rawLayout from './lab-strategic-layout.json'
import { LAB_PROP_FRAMES as LP } from './lab-prop-frames.generated'
import type { StrategicFloorClipRect, StrategicSpritePlacement } from './lab-strategic-layout-types'

const SHEET = 'lab-props' as const

// ---------------------------------------------------------------------------
// JSON types (structural; validated at runtime for frame keys)
// ---------------------------------------------------------------------------

/** Declarative edge between cluster `id`s — not used for placement; authors + debug / future routing. */
export interface StrategicLayoutLinkJson {
  from: string
  to: string
  /** e.g. data | power | supervision | floor */
  kind?: string
  note?: string
}

export interface LabStrategicLayoutFile {
  version: number
  minFloorW: number
  minFloorH: number
  /** Human-readable layout intent; ignored by the loader. */
  designNotes?: string
  /** Graph of relationships between `entries[].id` (where present). Ignored by placement. */
  links?: StrategicLayoutLinkJson[]
  entries: LayoutEntryJson[]
}

/**
 * floor — clip + large desk clearance (walkable floor decor).
 * wall  — clip + smaller clearance (perimeter / wall kit).
 * light — clip + per-run desk clearance (fixtures).
 * clip  — clip only (use sparingly: guarantees placement on room tiles, ignores desks).
 */
type GateJson = 'floor' | 'wall' | 'light' | 'clip'

/** Optional on any entry — ignored by the loader, for authors. */
type LayoutAuthorNote = {
  note?: string
  mirrorForEastWing?: boolean
  /** Other cluster ids this station relates to (incremental authoring). */
  connectsTo?: string[]
  /** Short role label for the station (authoring only). */
  role?: string
}

/** Optional per-entry override for min distance to desk centers (px). */
type DeskClearanceOverride = { deskClearancePx?: number }

interface AxisFraction {
  fraction: number
}

interface AxisStepFromTop {
  stepFromTop: number
}

interface AxisFromBottomStep {
  fromBottomStep: number
}

type YAxisJson = AxisFraction | AxisStepFromTop | AxisFromBottomStep

interface AnchorJson {
  x: AxisFraction & { offsetPx?: number }
  y: YAxisJson
  /** When true or omitted with no jitter, placement uses exact grid fractions. */
  fixed?: boolean
  jitter?: [number, number]
  /** Nudge anchor in screen Y after resolving fraction / step (pixels). */
  offsetYpx?: number
}

interface RefAnchorJson {
  x: AxisFraction
  y: AxisFraction
  fixed?: boolean
}

interface PartJson {
  frame?: string
  dx?: number
  dy?: number
  scale: number
  alpha?: number
  depth?: number
  tint?: string
  angle?: number
  angleFromHash?: { base: number; mod: number }
  /** stasisPod first part only */
  frameBroken?: string
  frameWhole?: string
  alphaBroken?: number
  alphaWhole?: number
}

type LayoutEntryJson =
  | ({
      kind: 'cluster'
      id?: string
      anchor: AnchorJson
      gate: GateJson
      skipIfRefPassesWallGate?: RefAnchorJson
      parts: PartJson[]
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'bandRow'
      /** Use `fraction` so this row shares the same vertical band as clusters (avoid mixing stepFromTop px with floor fractions). */
      y: YAxisJson
      gate: GateJson
      columns: Array<{ x: AxisFraction & { offsetPx?: number }; parts: PartJson[] }>
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'laserRow'
      y: YAxisJson
      centerX: AxisFraction & { offsetPx?: number }
      spanHalfPx: number
      offsetsPx: number[]
      gate: GateJson
      clusters: PartJson[][]
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'rightWallRows'
      gate: GateJson
      /** Negative = move cluster left, away from outer right hazard wall. */
      rows: Array<{ y: AxisFraction; offsetXPx?: number; parts: PartJson[] }>
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'leftWallRows'
      gate: GateJson
      /** Positive = move cluster right, away from outer left hazard wall / zone seam. */
      rows: Array<{ y: AxisFraction; offsetXPx?: number; parts: PartJson[] }>
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'repeatX'
      xs: (AxisFraction & { offsetPx?: number })[]
      y: AxisFraction
      gate: GateJson
      parts: PartJson[]
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'perimeterCounter'
      gate: GateJson
      /** Legacy pixel inset (ignored when grid placement is used). */
      insetPx: number
      /** Legacy chamfer (maps to default perimeterMarginCells when perimeterMarginCells omitted). */
      cornerChamferPx: number
      /** Legacy spacing (maps to cellStride ≈ spacingPx / cell step when cellStride omitted). */
      spacingPx: number
      /** Snap anchors to hex cell centers (same grid as WorkspaceUnifiedFloor). Default stride/margin derived from spacing/chamfer when omitted. */
      cellStride?: number
      /** Cells to omit from each end along an edge (keeps corners clean vs E/W runs). */
      perimeterMarginCells?: number
      segment: { parts: PartJson[] }
      /** Which walls get the counter run (default: all four). Omit `south` when a single DESK_TOP_LONG covers the bottom. */
      edges?: Array<'north' | 'east' | 'south' | 'west'>
      /** Skip north-edge placements when normalized x ∈ [start,end] (0–1), e.g. reactor/stasis bands. */
      northOmitNormX?: Array<{ start: number; end: number }>
      /** Skip south-edge placements in this x band (normalized 0–1). */
      southOmitNormX?: { start: number; end: number }
      /** Skip west-wall placements when normalized y ∈ range (tank column, etc.). */
      westOmitNormY?: Array<{ start: number; end: number }>
      /** Skip east-wall placements when normalized y ∈ range. */
      eastOmitNormY?: Array<{ start: number; end: number }>
      /** Min distance between placed segment anchors in world space after resolveWorldPlacement (px). */
      minSeparationPx?: number
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'storageGrid'
      origin: AnchorJson
      cols: number
      rows: number
      cellDx: number
      cellDy: number
      gate: GateJson
      defaultFrame: string
      defaultScale: number
      defaultAlpha: number
      defaultDepth: number
      defaultTint: string
      sunkenCell: { row: number; col: number; frame: string; scale: number; alpha: number; tint: string }
      satellite?: {
        offsetDx: number
        offsetDy: number
        gate: GateJson
        parts: PartJson[]
      } & DeskClearanceOverride
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'spikeGrid'
      anchor: AnchorJson
      size: number
      spacing: number
      gate: GateJson
      frameUp: string
      frameDown: string
      scale: number
      depth: number
      alpha: number
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'ventRow'
      y: AxisFraction
      fractions: number[]
      frames: string[]
      gate: GateJson
      scale: number
      depth: number
      alpha: number
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | ({
      kind: 'cableBottom'
      y: AxisFromBottomStep
      fractions: number[]
      cover: PartJson
      midAlternating: [string, string]
      midPart: {
        dx?: number
        dy?: number
        scale?: number
        depth?: number
        alpha?: number
        tint?: string
        angle?: number
      }
      gate: GateJson
    } & LayoutAuthorNote &
      DeskClearanceOverride)
  | {
      kind: 'lights'
      runs: Array<
        | {
            y: AxisStepFromTop | AxisFromBottomStep
            fractions: number[]
            deskClearance: number
            part: PartJson
          }
        | {
            wall: 'left' | 'right'
            y: AxisFraction
            yOffsetPx?: number
            deskClearance: number
            part: PartJson
          }
      >
    }
  | ({
      kind: 'stasisPod'
      anchor: AnchorJson
      gate: GateJson
      /** Omit for always-whole pod (stable multi-room labs). */
      brokenHash?: { shift: number; mod: number }
      parts: PartJson[]
    } & LayoutAuthorNote &
      DeskClearanceOverride)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const labStrategicLayoutFile = rawLayout as LabStrategicLayoutFile

export interface LayoutApplyContext {
  floorX: number
  floorY: number
  floorW: number
  floorH: number
  hash: number
  deskPositions: { x: number; y: number }[]
  floorClipRects?: StrategicFloorClipRect[]
  wallClearancePx: number
  floorClearancePx: number
  labTileSize: number
  /** East wing of a multi-room lab: mirror west-biased anchors across the room midline (outer wall). */
  wing?: 'west' | 'east'
}

export function applyLabStrategicLayoutFromJson(ctx: LayoutApplyContext): StrategicSpritePlacement[] {
  const STEP = ctx.labTileSize * 0.5
  const right = ctx.floorX + ctx.floorW
  const bottom = ctx.floorY + ctx.floorH
  const rightWallX = right - STEP * 0.5
  const leftWallX = ctx.floorX + STEP * 0.5

  function mirrorXForEastWing(x: number, mirrorThisEntry: boolean): number {
    if (!mirrorThisEntry || ctx.wing !== 'east') return x
    const mid = ctx.floorX + ctx.floorW / 2
    return 2 * mid - x
  }

  function entryMirrors(e: { mirrorForEastWing?: boolean }): boolean {
    return e.mirrorForEastWing === true
  }

  function inAnyClip(x: number, y: number): boolean {
    const clips = ctx.floorClipRects
    if (clips == null || clips.length === 0) return true
    for (const b of clips) {
      if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) return true
    }
    return false
  }

  /** Multi-room facility: union-centered fractions often land in the inter-room gap (corridor). */
  const CLIP_INSET = 40
  const SEAM_BAND_PX = 100
  const SEAM_NUDGE_PX = 56

  function snapPointToClipInterior(x: number, y: number): { x: number; y: number } {
    const clips = ctx.floorClipRects
    if (clips == null || clips.length === 0) return { x, y }
    if (inAnyClip(x, y)) return { x, y }
    let bestX = x
    let bestY = y
    let bestD = Infinity
    for (const b of clips) {
      const ix = Math.min(Math.max(x, b.x + CLIP_INSET), b.x + b.width - CLIP_INSET)
      const iy = Math.min(Math.max(y, b.y + CLIP_INSET), b.y + b.height - CLIP_INSET)
      const dx = ix - x
      const dy = iy - y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        bestX = ix
        bestY = iy
      }
    }
    return { x: bestX, y: bestY }
  }

  function nudgeAwayFromVerticalSeams(x: number, y: number): { x: number; y: number } {
    const clips = ctx.floorClipRects
    if (clips == null || clips.length < 2) return { x, y }
    const sorted = [...clips].sort((a, b) => a.x - b.x)
    let px = x
    const py = y
    for (let i = 0; i < sorted.length - 1; i++) {
      const L = sorted[i]!
      const R = sorted[i + 1]!
      const seamL = L.x + L.width
      const seamR = R.x
      if (seamR <= seamL) continue
      if (px >= L.x && px < seamL && px >= seamL - SEAM_BAND_PX) {
        px = Math.max(L.x + CLIP_INSET, px - SEAM_NUDGE_PX)
      }
      if (px >= seamR && px < R.x + R.width && px < seamR + SEAM_BAND_PX) {
        px = Math.min(R.x + R.width - CLIP_INSET, px + SEAM_NUDGE_PX)
      }
    }
    return { x: px, y: py }
  }

  /** Snap corridor/gap coordinates into a real room, then push off the atlas/sidekick seam. */
  function resolveWorldPlacement(x: number, y: number): { x: number; y: number } {
    const s = snapPointToClipInterior(x, y)
    return nudgeAwayFromVerticalSeams(s.x, s.y)
  }

  function dist2(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx
    const dy = ay - by
    return dx * dx + dy * dy
  }

  function farFromDesks(x: number, y: number, minD: number): boolean {
    const d2 = minD * minD
    return !ctx.deskPositions.some(p => dist2(x, y, p.x, p.y) < d2)
  }

  function entryPasses(
    gated: { gate: GateJson; deskClearancePx?: number },
    x: number,
    y: number,
    lightDeskDefault?: number,
  ): boolean {
    if (gated.gate === 'clip') return inAnyClip(x, y)
    let minD: number
    if (gated.deskClearancePx != null) {
      minD = gated.deskClearancePx
    } else if (gated.gate === 'floor') {
      minD = ctx.floorClearancePx
    } else if (gated.gate === 'wall') {
      minD = ctx.wallClearancePx
    } else {
      minD = lightDeskDefault ?? 44
    }
    return inAnyClip(x, y) && farFromDesks(x, y, minD)
  }

  function resolveFrame(key: string): number | string {
    const n = (LP as Record<string, number | string>)[key]
    if (n == null) {
      throw new Error(`lab-strategic-layout.json: unknown frame "${key}"`)
    }
    return n
  }

  function parseTint(hex?: string): number | undefined {
    if (hex == null || hex === '') return undefined
    return parseInt(String(hex).replace(/^0x/i, ''), 16)
  }

  function anchorPoint(a: AnchorJson): { x: number; y: number } {
    const jx = a.fixed || a.jitter == null ? 0 : a.jitter[0]
    const jy = a.fixed || a.jitter == null ? 0 : a.jitter[1]
    const baseX = ctx.floorX + ctx.floorW * a.x.fraction + (a.x.offsetPx ?? 0)
    const baseY = resolveY(a.y) + (a.offsetYpx ?? 0)
    if (jx === 0 && jy === 0) {
      return { x: baseX, y: baseY }
    }
    return {
      x: baseX + (ctx.hash % (jx * 2 + 1)) - jx,
      y: baseY + ((ctx.hash >> 3) % (jy * 2 + 1)) - jy,
    }
  }

  function refPoint(r: RefAnchorJson): { x: number; y: number } {
    return {
      x: ctx.floorX + ctx.floorW * r.x.fraction,
      y: ctx.floorY + ctx.floorH * (r.y as AxisFraction).fraction,
    }
  }

  function resolveY(y: YAxisJson): number {
    if ('fraction' in y) return ctx.floorY + ctx.floorH * y.fraction
    if ('stepFromTop' in y) return ctx.floorY + STEP * y.stepFromTop
    return bottom - STEP * y.fromBottomStep
  }

  function pushCluster(out: StrategicSpritePlacement[], ax: number, ay: number, parts: PartJson[]): void {
    for (const p of parts) {
      if (p.frame == null) continue
      const angle = p.angleFromHash != null ? p.angleFromHash.base + (ctx.hash % p.angleFromHash.mod) : p.angle
      out.push({
        frame: resolveFrame(p.frame),
        x: ax + (p.dx ?? 0),
        y: ay + (p.dy ?? 0),
        scale: p.scale,
        alpha: p.alpha ?? 0.92,
        depth: p.depth ?? -1.45,
        spritesheet: SHEET,
        tint: parseTint(p.tint),
        angle,
      })
    }
  }

  function partToResolved(p: PartJson): StrategicSpritePlacement {
    if (p.frame == null) {
      throw new Error('lab-strategic-layout.json: part missing frame')
    }
    return {
      frame: resolveFrame(p.frame),
      x: p.dx ?? 0,
      y: p.dy ?? 0,
      scale: p.scale,
      alpha: p.alpha ?? 0.92,
      depth: p.depth ?? -1.45,
      spritesheet: SHEET,
      tint: parseTint(p.tint),
      angle: p.angleFromHash != null ? p.angleFromHash.base + (ctx.hash % p.angleFromHash.mod) : p.angle,
    }
  }

  const out: StrategicSpritePlacement[] = []

  for (const entry of labStrategicLayoutFile.entries) {
    switch (entry.kind) {
      case 'cluster': {
        if (entry.skipIfRefPassesWallGate != null) {
          const refp = refPoint(entry.skipIfRefPassesWallGate)
          if (inAnyClip(refp.x, refp.y) && farFromDesks(refp.x, refp.y, ctx.wallClearancePx)) break
        }
        const rawA = anchorPoint(entry.anchor)
        const ax = mirrorXForEastWing(rawA.x, entryMirrors(entry))
        const pt = resolveWorldPlacement(ax, rawA.y)
        if (!entryPasses(entry, pt.x, pt.y)) break
        pushCluster(out, pt.x, pt.y, entry.parts)
        break
      }
      case 'stasisPod': {
        const rawS = anchorPoint(entry.anchor)
        const sx = mirrorXForEastWing(rawS.x, entryMirrors(entry))
        const pt = resolveWorldPlacement(sx, rawS.y)
        if (!entryPasses(entry, pt.x, pt.y)) break
        const broken =
          entry.brokenHash != null &&
          (ctx.hash >> entry.brokenHash.shift) % entry.brokenHash.mod === 0
        const parts = entry.parts.map((p, i) => {
          if (i === 0 && p.frameBroken != null && p.frameWhole != null) {
            return {
              ...p,
              frame: broken ? p.frameBroken : p.frameWhole,
              alpha: broken ? (p.alphaBroken ?? p.alpha ?? 0.92) : (p.alphaWhole ?? p.alpha ?? 0.92),
            }
          }
          return p
        })
        pushCluster(out, pt.x, pt.y, parts)
        break
      }
      case 'bandRow': {
        const y0 = resolveY(entry.y)
        const m = entryMirrors(entry)
        for (const col of entry.columns) {
          const rawColX = ctx.floorX + ctx.floorW * col.x.fraction + (col.x.offsetPx ?? 0)
          const ax = mirrorXForEastWing(rawColX, m)
          const p = resolveWorldPlacement(ax, y0)
          if (entryPasses(entry, p.x, p.y)) pushCluster(out, p.x, p.y, col.parts)
        }
        break
      }
      case 'laserRow': {
        const y0 = resolveY(entry.y)
        const rawCx = ctx.floorX + ctx.floorW * entry.centerX.fraction + (entry.centerX.offsetPx ?? 0)
        const placed = resolveWorldPlacement(rawCx, y0)
        const laserCx = placed.x
        const laserRowY = placed.y
        const span = entry.spanHalfPx
        if (!entryPasses(entry, laserCx - span, laserRowY) || !entryPasses(entry, laserCx + span, laserRowY)) break
        for (let i = 0; i < entry.offsetsPx.length; i++) {
          const ox = entry.offsetsPx[i]!
          const clusters = entry.clusters[i]
          if (clusters == null) continue
          pushCluster(out, laserCx + ox, laserRowY, clusters)
        }
        break
      }
      case 'rightWallRows': {
        for (const row of entry.rows) {
          const y = ctx.floorY + ctx.floorH * row.y.fraction
          const wallX = rightWallX + (row.offsetXPx ?? 0)
          const p = resolveWorldPlacement(wallX, y)
          if (entryPasses(entry, p.x, p.y)) pushCluster(out, p.x, p.y, row.parts)
        }
        break
      }
      case 'leftWallRows': {
        for (const row of entry.rows) {
          const y = ctx.floorY + ctx.floorH * row.y.fraction
          const wallX = leftWallX + (row.offsetXPx ?? 0)
          const p = resolveWorldPlacement(wallX, y)
          if (entryPasses(entry, p.x, p.y)) pushCluster(out, p.x, p.y, row.parts)
        }
        break
      }
      case 'repeatX': {
        const y = ctx.floorY + ctx.floorH * entry.y.fraction
        const m = entryMirrors(entry)
        for (const xf of entry.xs) {
          const rawBx = ctx.floorX + ctx.floorW * xf.fraction + (xf.offsetPx ?? 0)
          const bx = mirrorXForEastWing(rawBx, m)
          const p = resolveWorldPlacement(bx, y)
          if (entryPasses(entry, p.x, p.y)) pushCluster(out, p.x, p.y, entry.parts)
        }
        break
      }
      case 'perimeterCounter': {
        const cellStep = ctx.labTileSize * 0.5
        const cols = Math.max(1, Math.round(ctx.floorW / cellStep))
        const rows = Math.max(1, Math.round(ctx.floorH / cellStep))
        if (cols < 4 || rows < 4) break

        const strideFromSpacing = Math.max(1, Math.round(entry.spacingPx / cellStep))
        const cellStride = Math.max(1, entry.cellStride ?? strideFromSpacing)
        const marginFromChamfer = Math.max(1, Math.round(entry.cornerChamferPx / cellStep))
        const marginCells = Math.max(1, entry.perimeterMarginCells ?? Math.max(2, marginFromChamfer))

        const offX = ctx.floorX
        const offY = ctx.floorY
        const cellCX = (c: number) => offX + c * cellStep + cellStep * 0.5
        const cellCY = (r: number) => offY + r * cellStep + cellStep * 0.5

        const edgeSet = new Set(entry.edges ?? (['north', 'east', 'south', 'west'] as const))
        const minSep = entry.minSeparationPx ?? 42
        const minSep2 = minSep * minSep
        const placedAnchors: { x: number; y: number }[] = []

        const normX = (x: number) => (x - ctx.floorX) / ctx.floorW
        const normY = (y: number) => (y - ctx.floorY) / ctx.floorH
        const northRanges = entry.northOmitNormX
        const southBand = entry.southOmitNormX
        const westRanges = entry.westOmitNormY
        const eastRanges = entry.eastOmitNormY

        const skipNorth = (x: number): boolean =>
          northRanges != null &&
          northRanges.some(r => {
            const n = normX(x)
            return n >= r.start && n <= r.end
          })
        const skipSouth = (x: number): boolean => {
          if (southBand == null) return false
          const n = normX(x)
          return n >= southBand.start && n <= southBand.end
        }
        const skipWest = (y: number): boolean =>
          westRanges != null &&
          westRanges.some(r => {
            const n = normY(y)
            return n >= r.start && n <= r.end
          })
        const skipEast = (y: number): boolean =>
          eastRanges != null &&
          eastRanges.some(r => {
            const n = normY(y)
            return n >= r.start && n <= r.end
          })

        const tooClose = (px: number, py: number): boolean => {
          for (const q of placedAnchors) {
            const dx = px - q.x
            const dy = py - q.y
            if (dx * dx + dy * dy < minSep2) return true
          }
          return false
        }

        const tryPlace = (wx: number, wy: number): void => {
          if (ctx.floorClipRects != null && ctx.floorClipRects.length > 0 && !inAnyClip(wx, wy)) return
          const p = resolveWorldPlacement(wx, wy)
          if (Math.abs(p.x - wx) > 2.5 || Math.abs(p.y - wy) > 2.5) return
          if (!entryPasses(entry, p.x, p.y)) return
          if (tooClose(p.x, p.y)) return
          pushCluster(out, p.x, p.y, entry.segment.parts)
          placedAnchors.push({ x: p.x, y: p.y })
        }

        const cLo = 1 + marginCells
        const cHi = cols - 2 - marginCells
        const rLo = 1 + marginCells
        const rHi = rows - 2 - marginCells
        if (cLo > cHi || rLo > rHi) break

        if (edgeSet.has('north')) {
          const r = 1
          for (let c = cLo; c <= cHi; c += cellStride) {
            const x = cellCX(c)
            if (skipNorth(x)) continue
            tryPlace(x, cellCY(r))
          }
        }
        if (edgeSet.has('south')) {
          const r = rows - 2
          for (let c = cLo; c <= cHi; c += cellStride) {
            const x = cellCX(c)
            if (skipSouth(x)) continue
            tryPlace(x, cellCY(r))
          }
        }
        if (edgeSet.has('west')) {
          const c = 1
          for (let r = rLo; r <= rHi; r += cellStride) {
            const y = cellCY(r)
            if (skipWest(y)) continue
            tryPlace(cellCX(c), y)
          }
        }
        if (edgeSet.has('east')) {
          const c = cols - 2
          for (let r = rLo; r <= rHi; r += cellStride) {
            const y = cellCY(r)
            if (skipEast(y)) continue
            tryPlace(cellCX(c), y)
          }
        }
        break
      }
      case 'storageGrid': {
        const rawO = anchorPoint(entry.origin)
        const ox = mirrorXForEastWing(rawO.x, entryMirrors(entry))
        const origin = resolveWorldPlacement(ox, rawO.y)
        if (!entryPasses(entry, origin.x, origin.y)) break
        const { cols, rows, cellDx, cellDy } = entry
        const sk = entry.sunkenCell
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const gx = origin.x + col * cellDx
            const gy = origin.y + row * cellDy
            if (!entryPasses(entry, gx, gy)) continue
            const useCell = row === sk.row && col === sk.col
            out.push({
              frame: resolveFrame(useCell ? sk.frame : entry.defaultFrame),
              x: gx,
              y: gy,
              scale: useCell ? sk.scale : entry.defaultScale,
              alpha: useCell ? sk.alpha : entry.defaultAlpha,
              depth: entry.defaultDepth,
              spritesheet: SHEET,
              tint: parseTint(useCell ? sk.tint : entry.defaultTint),
            })
          }
        }
        if (entry.satellite != null) {
          const satDx =
            entryMirrors(entry) && ctx.wing === 'east' ? -entry.satellite.offsetDx : entry.satellite.offsetDx
          const logX = origin.x + satDx
          const logY = origin.y + entry.satellite.offsetDy
          if (entryPasses(entry.satellite, logX, logY)) {
            pushCluster(out, logX, logY, entry.satellite.parts)
          }
        }
        break
      }
      case 'spikeGrid': {
        const rawSp = anchorPoint(entry.anchor)
        const spx = mirrorXForEastWing(rawSp.x, entryMirrors(entry))
        const spikeA = resolveWorldPlacement(spx, rawSp.y)
        if (!entryPasses(entry, spikeA.x, spikeA.y)) break
        const sg = entry.spacing
        const n = entry.size
        const half = (n - 1) / 2
        for (let sr = 0; sr < n; sr++) {
          for (let sc = 0; sc < n; sc++) {
            const sx = spikeA.x + (sc - half) * sg
            const sy = spikeA.y + (sr - half) * sg
            if (!entryPasses(entry, sx, sy)) continue
            const up = (sr + sc + ctx.hash) % 2 === 0
            out.push({
              frame: resolveFrame(up ? entry.frameUp : entry.frameDown),
              x: sx,
              y: sy,
              scale: entry.scale,
              depth: entry.depth,
              alpha: entry.alpha,
              spritesheet: SHEET,
            })
          }
        }
        break
      }
      case 'ventRow': {
        const ventRowY = ctx.floorY + ctx.floorH * entry.y.fraction
        const m = entryMirrors(entry)
        for (let vi = 0; vi < entry.fractions.length; vi++) {
          const rawVx = ctx.floorX + ctx.floorW * entry.fractions[vi]!
          const vx = mirrorXForEastWing(rawVx, m)
          const p = resolveWorldPlacement(vx, ventRowY)
          if (!entryPasses(entry, p.x, p.y)) continue
          const frameKey = entry.frames[vi] ?? entry.frames[0]!
          out.push({
            frame: resolveFrame(frameKey),
            x: p.x,
            y: p.y,
            scale: entry.scale,
            depth: entry.depth,
            alpha: entry.alpha,
            spritesheet: SHEET,
          })
        }
        break
      }
      case 'cableBottom': {
        const botY = resolveY(entry.y)
        const fr = entry.fractions
        const m = entryMirrors(entry)
        for (let ci = 0; ci < fr.length; ci++) {
          const rawPx = ctx.floorX + ctx.floorW * fr[ci]!
          const px = mirrorXForEastWing(rawPx, m)
          const pCover = resolveWorldPlacement(px, botY)
          if (entryPasses(entry, pCover.x, pCover.y)) {
            const c = entry.cover
            const base = partToResolved(c)
            out.push({
              ...base,
              x: pCover.x + (c.dx ?? 0),
              y: pCover.y + (c.dy ?? 0),
            })
          }
          if (ci < fr.length - 1) {
            const rawMid = ctx.floorX + ctx.floorW * ((fr[ci]! + fr[ci + 1]!) / 2)
            const midRaw = mirrorXForEastWing(rawMid, m)
            const mid = resolveWorldPlacement(midRaw, botY)
            if (entryPasses(entry, mid.x, mid.y)) {
              const midFrame = ci % 2 === 0 ? entry.midAlternating[0]! : entry.midAlternating[1]!
              const mp: PartJson = {
                ...entry.midPart,
                frame: midFrame,
                scale: entry.midPart.scale ?? 0.6,
              }
              const resolved = partToResolved(mp)
              out.push({
                ...resolved,
                x: mid.x + (entry.midPart.dx ?? 0),
                y: mid.y + (entry.midPart.dy ?? 0),
              })
            }
          }
        }
        break
      }
      case 'lights': {
        for (const run of entry.runs) {
          if ('fractions' in run) {
            const ly = 'stepFromTop' in run.y ? ctx.floorY + STEP * run.y.stepFromTop : bottom - STEP * run.y.fromBottomStep
            for (const px of run.fractions) {
              const lx = ctx.floorX + ctx.floorW * px
              const w = resolveWorldPlacement(lx, ly)
              if (!inAnyClip(w.x, w.y)) continue
              if (!farFromDesks(w.x, w.y, run.deskClearance)) continue
              const pr = run.part
              const base = partToResolved(pr)
              out.push({
                ...base,
                x: w.x + (pr.dx ?? 0),
                y: w.y + (pr.dy ?? 0),
              })
            }
          } else {
            const wallX = run.wall === 'left' ? ctx.floorX + STEP * 0.55 : right - STEP * 0.55
            const ly = ctx.floorY + ctx.floorH * run.y.fraction + (run.yOffsetPx ?? 0)
            const w = resolveWorldPlacement(wallX, ly)
            if (!inAnyClip(w.x, w.y)) continue
            if (!farFromDesks(w.x, w.y, run.deskClearance)) continue
            const pr = run.part
            const base = partToResolved(pr)
            out.push({
              ...base,
              x: w.x + (pr.dx ?? 0),
              y: w.y + (pr.dy ?? 0),
            })
          }
        }
        break
      }
      default:
        break
    }
  }

  return out
}
