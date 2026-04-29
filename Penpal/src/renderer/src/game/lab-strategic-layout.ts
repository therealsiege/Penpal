// ---------------------------------------------------------------------------
// Strategic lab layout — JSON-authored kit (see version + root designNotes): keep zones separate
// (north wall row, optional single center focal, south operator). Stack parts in one cluster only when
// they belong together (e.g. screen + button on a desk).
// Facility scene skips merged floor glow (OfficeScene).
//
// **Incremental authoring (one prop group at a time)** — add a `cluster` with a stable `id`, optional
// `role` + `connectsTo: ['otherId']`, then append a row to root `links` { from, to, kind, note }.
// Prefer one cluster per logical station (not a single bandRow) so relationships stay explicit.
// When adding floor cables/pipes later, reference the same ids in `note` or extend `links` with kind
// `floor` so routing stays traceable. Loader ignores `links` / `connectsTo` / `role` for placement.
//
// Edit placements in lab-strategic-layout.json: anchors (fraction + offsetPx /
// offsetYpx / jitter), parts (dx/dy/scale/…), gates (floor | wall | clip | light),
// optional deskClearancePx, per-entry `note`, and `mirrorForEastWing`. Prefer explicit clusters.
// For one north wall line, use **fraction** Y on laserRow + bandRow + anchors — do not mix `stepFromTop` (px)
// with `fraction` (of floor height); that scatters props vertically. Root `designNotes` is human-only.
// This module
// applies clip + desk clearance using the same hex-grid rect as WorkspaceUnifiedFloor.
//
// Kit note (GDS lab pack — gamedeveloperstudio.itch.io/top-down-laboratory-mega-game-asset-pack):
//   • Reference rooms run **terminals on counters around the perimeter** (L along outer top-left, etc.),
//     not floating in the walkable floor — see pack screenshots / itch.io listing art.
//   • Match `CONSOLE_STATIONS` / `KEYBOARD_STATIONS` in lab-layout-engine for composed desks (north blanks+overlays; south long desk may pair two small screens like KEYBOARD_STATIONS[0]).
//   • Prefer pipes/tubes/cables to bridge anchors instead of heaping decor at one XY.
//   • Multi-room: loader snaps anchors out of the inter-room corridor and nudges off vertical seams.
//   • East wing (right room): entries with mirrorForEastWing flip anchor X across room midline; storageGrid satellite negates offsetDx so satellites stay inside the floor.
// ---------------------------------------------------------------------------

import {
  applyLabStrategicLayoutFromJson,
  labStrategicLayoutFile,
  type StrategicLayoutLinkJson,
} from './lab-strategic-layout-loader'
import type { StrategicFloorClipRect, StrategicSpritePlacement } from './lab-strategic-layout-types'
import { LAB_TILE_SIZE } from './office-constants'

export type { StrategicFloorClipRect, StrategicSpritePlacement } from './lab-strategic-layout-types'

/** Version from `lab-strategic-layout.json` — surfaced in `PH.labDecoration()` for debugging. */
export const LAB_STRATEGIC_LAYOUT_VERSION = labStrategicLayoutFile.version

/** Declarative edges between cluster ids — same as JSON `links`; for PH / tooling. */
export const LAB_STRATEGIC_LAYOUT_LINKS: readonly StrategicLayoutLinkJson[] = labStrategicLayoutFile.links ?? []

export type { StrategicLayoutLinkJson }

export function computeStrategicReferencePlacements(
  floorX: number,
  floorY: number,
  floorW: number,
  floorH: number,
  deskPositions: { x: number; y: number }[],
  hash: number,
  _deskWorkspace?: { x: number; y: number; width: number; height: number },
  floorClipRects?: StrategicFloorClipRect[],
  wing?: 'west' | 'east',
): StrategicSpritePlacement[] {
  if (floorW < labStrategicLayoutFile.minFloorW || floorH < labStrategicLayoutFile.minFloorH) {
    return []
  }
  return applyLabStrategicLayoutFromJson({
    floorX,
    floorY,
    floorW,
    floorH,
    hash,
    deskPositions,
    floorClipRects,
    wallClearancePx: 64,
    floorClearancePx: 112,
    labTileSize: LAB_TILE_SIZE,
    wing: wing ?? 'west',
  })
}
