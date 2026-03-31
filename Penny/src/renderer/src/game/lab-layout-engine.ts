// ---------------------------------------------------------------------------
// lab-layout-engine.ts
// Grid-based layout engine for lab rooms. Pure logic — no Phaser dependency.
// Produces placement instructions consumed by office-rooms.ts.
// ---------------------------------------------------------------------------

import { LAB_PROP_FRAMES as LP } from './lab-prop-frames.generated'
import { LAB_TILE_SIZE, LAB_EQUIP_ZONE_H } from './office-constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAB_TILE_SCALE = 0.50
export const LAB_CELL_STEP = LAB_TILE_SIZE * LAB_TILE_SCALE  // 64px
export const LAB_MAX_PROPS_PER_ROOM = 24
export const LAB_GLOW_COLOR = 0x00e5ff
export const LAB_GLOW_MIN_SPACING = 2  // cells between glow lights

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellType = 'wall' | 'floor' | 'equipment' | 'desk' | 'glow'

type PlacementZone = 'top-wall' | 'bottom-wall' | 'left-wall' | 'right-wall' | 'center' | 'corner'

export type ZoneType = 'control' | 'chemical' | 'machinery' | 'pod'

const ZONE_TYPES: ZoneType[] = ['control', 'chemical', 'machinery', 'pod']

interface PropBlueprint {
  frame: number
  widthCells: number
  heightCells: number
  validZones: PlacementZone[]
  scale: number
  alpha: number
  depth: number
}

export interface SpritePlacement {
  frame: number
  x: number
  y: number
  scale: number
  alpha: number
  depth: number
  spritesheet: 'lab-props' | 'lab-main-tileset'
}

export interface GlowPlacement {
  x: number
  y: number
  outerRadius: number
  midRadius: number
  coreRadius: number
  color: number
  outerAlpha: number
  midAlpha: number
  coreAlpha: number
}

export interface LabLayoutResult {
  propPlacements: SpritePlacement[]
  glowPlacements: GlowPlacement[]
}

// ---------------------------------------------------------------------------
// CellGrid
// ---------------------------------------------------------------------------

export class CellGrid {
  readonly cols: number
  readonly rows: number
  readonly offsetX: number
  readonly offsetY: number
  readonly step: number
  private cells: CellType[][]

  constructor(cols: number, rows: number, offsetX: number, offsetY: number, step: number) {
    this.cols = cols
    this.rows = rows
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.step = step
    this.cells = Array.from({ length: rows }, () => Array(cols).fill('floor') as CellType[])
  }

  get(col: number, row: number): CellType {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 'wall'
    return this.cells[row][col]
  }

  set(col: number, row: number, type: CellType): void {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.cells[row][col] = type
    }
  }

  markWalls(): void {
    for (let c = 0; c < this.cols; c++) {
      this.cells[0][c] = 'wall'
      this.cells[this.rows - 1][c] = 'wall'
    }
    for (let r = 0; r < this.rows; r++) {
      this.cells[r][0] = 'wall'
      this.cells[r][this.cols - 1] = 'wall'
    }
  }

  markDesks(deskPositions: { x: number; y: number }[]): void {
    for (const pos of deskPositions) {
      const { col, row } = this.pixelToCell(pos.x, pos.y)
      // Workstation is ~90x77px ≈ 2x2 cells. Mark a 3x3 block (desk + buffer)
      // so props don't crowd the agent workspace.
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          this.set(col + dc, row + dr, 'desk')
        }
      }
    }
  }

  isAreaFree(col: number, row: number, w: number, h: number): boolean {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        if (this.get(c, r) !== 'floor') return false
      }
    }
    return true
  }

  markArea(col: number, row: number, w: number, h: number, type: CellType): void {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        this.set(c, r, type)
      }
    }
  }

  cellToPixel(col: number, row: number): { x: number; y: number } {
    return {
      x: this.offsetX + col * this.step + this.step / 2,
      y: this.offsetY + row * this.step + this.step / 2,
    }
  }

  pixelToCell(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor((x - this.offsetX) / this.step),
      row: Math.floor((y - this.offsetY) / this.step),
    }
  }
}

// ---------------------------------------------------------------------------
// Prop blueprints per zone type — using the FULL 135-frame prop library
// ---------------------------------------------------------------------------

// Shared small accent props that can appear in any room
const SHARED_ACCENTS: PropBlueprint[] = [
  { frame: LP.WARNING_POWER,      widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.70, alpha: 0.85, depth: -1.4 },
  { frame: LP.WARNING_BIOLOGICAL,  widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.70, alpha: 0.85, depth: -1.4 },
  { frame: LP.WARNING_STRIPES,     widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.70, alpha: 0.82, depth: -1.4 },
  { frame: LP.WALL_LIGHT,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.65, alpha: 0.85, depth: -1.3 },
  { frame: LP.CABLE_COVER,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.78, depth: -1.6 },
  { frame: LP.VENT_SLATS,          widthCells: 1, heightCells: 1, validZones: ['bottom-wall', 'top-wall'], scale: 0.70, alpha: 0.80, depth: -1.5 },
  { frame: LP.SUNKEN_VENT,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.78, depth: -1.6 },
  { frame: LP.VENT,                widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.65, alpha: 0.80, depth: -1.5 },
  { frame: LP.SPEAKER,             widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.75, depth: -1.5 },
  { frame: LP.LED_ON,              widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.50, alpha: 0.88, depth: -1.3 },
  { frame: LP.SWITCH_UP,           widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.55, alpha: 0.82, depth: -1.4 },
  { frame: LP.OCTAGONAL_PANEL,     widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.60, alpha: 0.80, depth: -1.4 },
  { frame: LP.CIRCULAR_PANEL,      widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.60, alpha: 0.80, depth: -1.4 },
  // Center-floor accents
  { frame: LP.CABLE_PIECE_01,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.65, depth: -1.7 },
  { frame: LP.CABLE_PIECE_02,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.60, depth: -1.7 },
  { frame: LP.OCTOGON_PLATE,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.55, alpha: 0.70, depth: -1.7 },
]

const ZONE_BLUEPRINTS: Record<ZoneType, PropBlueprint[]> = {
  control: [
    // Centerpiece: long console desk across equipment zone
    { frame: LP.CONSOLE_EXAMPLE_LONG,  widthCells: 3, heightCells: 1, validZones: ['top-wall'],    scale: 1.10, alpha: 0.92, depth: -1.5 },
    { frame: LP.CONSOLE_EXAMPLE_SHORT, widthCells: 2, heightCells: 1, validZones: ['top-wall'],    scale: 1.00, alpha: 0.90, depth: -1.5 },
    // Screens on/near consoles
    { frame: LP.CONSOLE_SCREEN,        widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.85, alpha: 0.88, depth: -1.4 },
    { frame: LP.FREE_STANDING_SCREEN,  widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.85, alpha: 0.85, depth: -1.4 },
    { frame: LP.MONITOR,               widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.80, alpha: 0.88, depth: -1.4 },
    // Desk accessories
    { frame: LP.COMPUTER_KEYBOARD,     widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.75, alpha: 0.82, depth: -1.3 },
    { frame: LP.KEYBOARD,              widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.70, alpha: 0.80, depth: -1.3 },
    { frame: LP.JOYSTICK,              widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.65, alpha: 0.80, depth: -1.3 },
    // Side equipment
    { frame: LP.UNIT_EXAMPLE_01,       widthCells: 1, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 0.90, alpha: 0.88, depth: -1.5 },
    { frame: LP.STOOL,                 widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.80, alpha: 0.80, depth: -1.6 },
    { frame: LP.DESK_LAMP,             widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.75, alpha: 0.82, depth: -1.3 },
    // Gauges on walls
    { frame: LP.GUAGE,                 widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.65, alpha: 0.82, depth: -1.4 },
    { frame: LP.DIAL,                  widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.60, alpha: 0.78, depth: -1.4 },
    { frame: LP.CLIPBOARD,             widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.55, alpha: 0.75, depth: -1.6 },
    // Center-floor scatter
    { frame: LP.STOOL,                 widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.75, alpha: 0.80, depth: -1.7 },
    { frame: LP.PAPER_SHEET,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.65, depth: -1.7 },
    { frame: LP.PENCIL,                widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.60, depth: -1.7 },
  ],

  chemical: [
    // Centerpiece: microscope + sink
    { frame: LP.MICROSCOPE,            widthCells: 2, heightCells: 1, validZones: ['top-wall'],    scale: 1.10, alpha: 0.92, depth: -1.5 },
    { frame: LP.CIRCULAR_SINK,         widthCells: 2, heightCells: 2, validZones: ['top-wall'],    scale: 1.00, alpha: 0.90, depth: -1.5 },
    // Lab glassware
    { frame: LP.BEAKER,                widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.90, alpha: 0.88, depth: -1.4 },
    { frame: LP.CONICAL_BEAKER,        widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.90, alpha: 0.88, depth: -1.4 },
    { frame: LP.TEST_TUBE_HOLDER,      widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.80, alpha: 0.85, depth: -1.4 },
    { frame: LP.PETRI_DISH,            widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.75, alpha: 0.82, depth: -1.4 },
    { frame: LP.TUBE,                  widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.70, alpha: 0.80, depth: -1.4 },
    { frame: LP.SCALE,                 widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.80, alpha: 0.85, depth: -1.4 },
    { frame: LP.SMALL_APPARATUS,       widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.75, alpha: 0.82, depth: -1.4 },
    // Storage
    { frame: LP.SHELF,                 widthCells: 2, heightCells: 1, validZones: ['bottom-wall', 'left-wall'], scale: 0.90, alpha: 0.85, depth: -1.5 },
    { frame: LP.DOME,                  widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.80, alpha: 0.85, depth: -1.5 },
    // Gas + clamp on walls
    { frame: LP.GAS_VALVE_ON,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.65, alpha: 0.82, depth: -1.4 },
    { frame: LP.CLAMP_DOUBLE,          widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.60, alpha: 0.78, depth: -1.4 },
    // Center-floor scatter
    { frame: LP.PETRI_DISH,            widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.65, alpha: 0.72, depth: -1.7 },
    { frame: LP.SPILT_TEST_TUBE,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.55, alpha: 0.68, depth: -1.7 },
    { frame: LP.PUDDLE,                widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.60, alpha: 0.50, depth: -1.8 },
    { frame: LP.CUP,                   widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.65, depth: -1.7 },
  ],

  machinery: [
    // Centerpiece: HUGE machinery
    { frame: LP.GENERATOR,             widthCells: 3, heightCells: 3, validZones: ['center', 'top-wall'], scale: 1.30, alpha: 0.95, depth: -1.5 },
    { frame: LP.LAB_MACHINE_01,        widthCells: 2, heightCells: 2, validZones: ['top-wall'],    scale: 1.10, alpha: 0.92, depth: -1.5 },
    { frame: LP.LARGE_TANK,            widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.00, alpha: 0.90, depth: -1.5 },
    // Power cells + units
    { frame: LP.POWER_CELL,            widthCells: 1, heightCells: 1, validZones: ['bottom-wall', 'left-wall'], scale: 0.80, alpha: 0.85, depth: -1.5 },
    { frame: LP.UNIT_LARGE,            widthCells: 2, heightCells: 1, validZones: ['right-wall'],  scale: 0.90, alpha: 0.88, depth: -1.5 },
    { frame: LP.UNIT_SMALL,            widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.80, alpha: 0.85, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_02,       widthCells: 1, heightCells: 2, validZones: ['right-wall'],  scale: 0.90, alpha: 0.88, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_03,       widthCells: 1, heightCells: 2, validZones: ['left-wall'],   scale: 0.90, alpha: 0.88, depth: -1.5 },
    // Fan, laser
    { frame: LP.FAN_UNIT_HOUSING,      widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.80, alpha: 0.85, depth: -1.4 },
    { frame: LP.LASER_HEAD,            widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.75, alpha: 0.88, depth: -1.4 },
    { frame: LP.PIPE_CONNECTOR_ARCHED, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.70, alpha: 0.82, depth: -1.4 },
    // Stop button
    { frame: LP.STOP_BUTTON,           widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.60, alpha: 0.85, depth: -1.3 },
    // Center-floor scatter
    { frame: LP.SUNKEN_CELL,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.60, alpha: 0.70, depth: -1.7 },
    { frame: LP.SUNKEN_NUT,            widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.65, depth: -1.7 },
    { frame: LP.NUT,                   widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.68, depth: -1.7 },
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.55, alpha: 0.72, depth: -1.7 },
  ],

  pod: [
    // Centerpiece: pods
    { frame: LP.POD,                   widthCells: 2, heightCells: 2, validZones: ['top-wall'],    scale: 1.10, alpha: 0.92, depth: -1.5 },
    { frame: LP.BROKEN_POD,            widthCells: 2, heightCells: 2, validZones: ['top-wall'],    scale: 1.00, alpha: 0.82, depth: -1.5 },
    { frame: LP.SLIDING_DOOR,          widthCells: 1, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 0.95, alpha: 0.88, depth: -1.5 },
    // Skylights
    { frame: LP.LARGE_SKYLIGHT,        widthCells: 2, heightCells: 1, validZones: ['center'],      scale: 0.90, alpha: 0.78, depth: -1.7 },
    { frame: LP.NARROW_SKYLIGHT,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.75, alpha: 0.75, depth: -1.7 },
    // Storage
    { frame: LP.CHEST_CLOSED,          widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.80, alpha: 0.85, depth: -1.5 },
    { frame: LP.CHEST_OPEN,            widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.80, alpha: 0.82, depth: -1.5 },
    // Monitoring desk
    { frame: LP.DESK_TOP_LONG,         widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 0.90, alpha: 0.88, depth: -1.5 },
    { frame: LP.TABLET,                widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.78, depth: -1.3 },
    // Structural blocks
    { frame: LP.BLOCK_01,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.80, alpha: 0.82, depth: -1.6 },
    { frame: LP.BLOCK_03,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.75, alpha: 0.78, depth: -1.6 },
    // Pipes + LEDs
    { frame: LP.PIPE_CONNECTOR_TO_SIDE, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.70, alpha: 0.82, depth: -1.4 },
    { frame: LP.CONSOLE_LED_ON,        widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.50, alpha: 0.88, depth: -1.3 },
    // Center-floor scatter
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.55, alpha: 0.70, depth: -1.7 },
    { frame: LP.NARROW_SKYLIGHT,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.70, alpha: 0.72, depth: -1.7 },
    { frame: LP.SMALL_SKYLIGHT,        widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.65, alpha: 0.70, depth: -1.7 },
  ],
}

// ---------------------------------------------------------------------------
// Placement logic
// ---------------------------------------------------------------------------

function findPlacement(
  grid: CellGrid,
  bp: PropBlueprint,
  hash: number,
  attempt: number,
): { col: number; row: number } | null {
  const { cols, rows } = grid

  // Buffer: props start 2 cells from edge (1 wall + 1 buffer) so they don't
  // overlap wall tiles. This matches the reference image where equipment
  // sits clearly inside the room, not on the wall border.
  const INSET = 2
  const minC = INSET
  const maxC = cols - INSET
  const minR = INSET
  const maxR = rows - INSET

  for (const zone of bp.validZones) {
    switch (zone) {
      case 'top-wall': {
        // Row just inside the top wall buffer
        const r = minR
        const rangeC = Math.max(1, maxC - minC - bp.widthCells + 1)
        const startCol = minC + ((hash + attempt * 7) % rangeC)
        for (let c = startCol; c < maxC - bp.widthCells + 1; c++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        for (let c = minC; c < startCol; c++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        break
      }
      case 'bottom-wall': {
        const r = maxR - bp.heightCells
        if (r < minR) break
        const rangeC = Math.max(1, maxC - minC - bp.widthCells + 1)
        const startCol = minC + ((hash + attempt * 11) % rangeC)
        for (let c = startCol; c < maxC - bp.widthCells + 1; c++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        for (let c = minC; c < startCol; c++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        break
      }
      case 'left-wall': {
        const c = minC
        const rangeR = Math.max(1, maxR - minR - bp.heightCells + 1)
        const startRow = minR + ((hash + attempt * 13) % rangeR)
        for (let r = startRow; r < maxR - bp.heightCells + 1; r++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        for (let r = minR; r < startRow; r++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        break
      }
      case 'right-wall': {
        const c = maxC - bp.widthCells
        if (c < minC) break
        const rangeR = Math.max(1, maxR - minR - bp.heightCells + 1)
        const startRow = minR + ((hash + attempt * 17) % rangeR)
        for (let r = startRow; r < maxR - bp.heightCells + 1; r++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        for (let r = minR; r < startRow; r++) {
          if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
        }
        break
      }
      case 'center': {
        // Scan interior, biased toward middle of the room
        const midC = Math.floor(cols / 2)
        const midR = Math.floor(rows / 2)
        const maxRadius = Math.max(cols, rows)
        for (let d = 0; d < maxRadius; d++) {
          for (let dr = -d; dr <= d; dr++) {
            for (let dc = -d; dc <= d; dc++) {
              if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue
              const c = midC + dc
              const r = midR + dr
              if (c < minC + 1 || r < minR + 1 || c + bp.widthCells > maxC - 1 || r + bp.heightCells > maxR - 1) continue
              if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
            }
          }
        }
        break
      }
      case 'corner': {
        // Inner corners — 2 cells from walls
        const corners = [
          { col: minC, row: minR },
          { col: maxC - bp.widthCells, row: minR },
          { col: minC, row: maxR - bp.heightCells },
          { col: maxC - bp.widthCells, row: maxR - bp.heightCells },
        ]
        const start = (hash + attempt) % 4
        for (let i = 0; i < 4; i++) {
          const corner = corners[(start + i) % 4]
          if (corner.col < minC || corner.row < minR) continue
          if (grid.isAreaFree(corner.col, corner.row, bp.widthCells, bp.heightCells)) return corner
        }
        break
      }
    }
  }

  return null
}

function placeProps(grid: CellGrid, zone: ZoneType, hash: number): SpritePlacement[] {
  const placements: SpritePlacement[] = []
  const blueprints = ZONE_BLUEPRINTS[zone]

  // Place zone-specific props first, then shared accents
  const allBlueprints = [...blueprints, ...SHARED_ACCENTS]

  // Shuffle shared accents deterministically based on hash
  const sharedStart = blueprints.length
  for (let i = allBlueprints.length - 1; i > sharedStart; i--) {
    const j = sharedStart + ((hash + i * 31) % (i - sharedStart + 1))
    ;[allBlueprints[i], allBlueprints[j]] = [allBlueprints[j], allBlueprints[i]]
  }

  for (let i = 0; i < allBlueprints.length && placements.length < LAB_MAX_PROPS_PER_ROOM; i++) {
    const bp = allBlueprints[i]
    const pos = findPlacement(grid, bp, hash, i)
    if (!pos) continue

    grid.markArea(pos.col, pos.row, bp.widthCells, bp.heightCells, 'equipment')

    // Convert to pixel coords — center of the multi-cell footprint
    const topLeft = grid.cellToPixel(pos.col, pos.row)
    const px = topLeft.x + (bp.widthCells - 1) * grid.step / 2
    const py = topLeft.y + (bp.heightCells - 1) * grid.step / 2

    placements.push({
      frame: bp.frame,
      x: px,
      y: py,
      scale: bp.scale,
      alpha: bp.alpha,
      depth: bp.depth,
      spritesheet: 'lab-props',
    })
  }

  return placements
}

function placeGlowLights(grid: CellGrid, hash: number): GlowPlacement[] {
  const placements: GlowPlacement[] = []
  const { cols, rows } = grid
  const INSET = 3  // well inside walls

  // Find the equipment zone boundary in grid coords
  const equipRows = Math.max(2, Math.ceil(LAB_EQUIP_ZONE_H / grid.step))

  // Place glow lights in the bottom half of the room (below equipment zone)
  const glowStartRow = Math.max(INSET, Math.min(equipRows + 2, rows - INSET - 1))
  const glowEndRow = rows - INSET

  // Target number of glows based on room size
  const targetCount = Math.max(2, Math.floor(cols / 3))
  const colSpacing = Math.max(LAB_GLOW_MIN_SPACING, Math.floor((cols - 2 * INSET) / (targetCount + 1)))

  for (let i = 0; i < targetCount && i < 6; i++) {
    const c = INSET + colSpacing * (i + 1)
    if (c >= cols - INSET) continue

    // Find a free floor cell in this column within the glow zone
    const startR = glowStartRow + ((hash + i * 7) % Math.max(1, glowEndRow - glowStartRow))
    let placed = false
    for (let r = startR; r < glowEndRow && !placed; r++) {
      if (grid.get(c, r) === 'floor') {
        grid.set(c, r, 'glow')
        const pos = grid.cellToPixel(c, r)
        placements.push({
          x: pos.x,
          y: pos.y,
          outerRadius: 16,
          midRadius: 9,
          coreRadius: 5,
          color: LAB_GLOW_COLOR,
          outerAlpha: 0.08,
          midAlpha: 0.18,
          coreAlpha: 0.35,
        })
        placed = true
      }
    }
    // Wrap around
    if (!placed) {
      for (let r = glowStartRow; r < startR; r++) {
        if (grid.get(c, r) === 'floor') {
          grid.set(c, r, 'glow')
          const pos = grid.cellToPixel(c, r)
          placements.push({
            x: pos.x, y: pos.y,
            outerRadius: 16, midRadius: 9, coreRadius: 5,
            color: LAB_GLOW_COLOR,
            outerAlpha: 0.08, midAlpha: 0.18, coreAlpha: 0.35,
          })
          break
        }
      }
    }
  }

  return placements
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeLabLayout(
  floorX: number,
  floorY: number,
  floorW: number,
  floorH: number,
  hash: number,
  deskPositions: { x: number; y: number }[],
): LabLayoutResult {
  const step = LAB_CELL_STEP
  const cols = Math.max(4, Math.floor(floorW / step))
  const rows = Math.max(4, Math.floor(floorH / step))

  // Center grid within floor area (same as tileHexFloor)
  const gridW = cols * step
  const gridH = rows * step
  const offsetX = floorX + (floorW - gridW) / 2
  const offsetY = floorY + (floorH - gridH) / 2

  const grid = new CellGrid(cols, rows, offsetX, offsetY, step)
  grid.markWalls()
  grid.markDesks(deskPositions)

  const zone = ZONE_TYPES[hash % 4]
  const propPlacements = placeProps(grid, zone, hash)
  const glowPlacements = placeGlowLights(grid, hash)

  return { propPlacements, glowPlacements }
}
