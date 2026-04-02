// ---------------------------------------------------------------------------
// Lab decoration — how JSON, the facility layer, per-room code, and PH fit together
// ---------------------------------------------------------------------------
//
// ## Three separate systems (avoid conflating them)
//
// 1. **PennyHarness (`window.PH`)** — DevTools API: mock agents, fixtures, replay, atmosphere,
//    scenarios. It does **not** place lab props or edit `lab-strategic-layout.json`. Lab layout
//    is unchanged by PH except indirectly when something triggers a full room rebuild
//    (e.g. refresh after agent churn).
//
// 2. **`lab-strategic-layout.json` + `lab-layout-engine`** — Authoritative **content** for the
//    reference lab: one JSON describes a single notional room; the loader applies clips, desk
//    clearance, and (for multi-room PENPAL) `strategicWing: 'east'` + `mirrorForEastWing` on
//    west-biased entries. Root **`links`** + per-cluster **`id` / `connectsTo` / `role`** are for
//    incremental authoring (meaningful connections); they do not affect placement. `computeLabLayout`
//    = JSON strategic sprites + `placeProps` zone pass (wall-hugging scatter from `lab-layout-engine`
//    hashes) + optional glows.
//
// 3. **Where sprites attach** — `WorkspaceUnifiedFloor` draws facility-scale tiles + soft inner
//    hazard tape. Each **room** container still gets floor/wall hex tiles. When `LAB_PROPS` is
//    loaded, **all** JSON+grid strategic art is merged into **one** scene container
//    (`labFacilityPropsLayer`) via `OfficeScene.rebuildLabFacilityProps` (one `computeLabLayout`
//    per room, merged). `OfficeRooms.placeLabEquipment` calls `computeLabLayout` with
//    `strategicMode: 'none'`, which **short-circuits to empty** so we never duplicate strategic
//    props in per-room containers — only the facility layer holds that art.
//
// ## Playwright / visual tests
// Use the same built app as production; they validate pixels, not PH. See `tests/lab-layout-visual.spec.ts`.
//
// ---------------------------------------------------------------------------

export { LAB_STRATEGIC_LAYOUT_VERSION, LAB_STRATEGIC_LAYOUT_LINKS } from './lab-strategic-layout'
export type { StrategicLayoutLinkJson } from './lab-strategic-layout'

/** Pipeline id for `getLabDecorationDebugInfo` / `PH.labDecoration()`. */
export const LAB_DECORATION_PIPELINE_ID = 'facility-json-per-room-v1' as const
