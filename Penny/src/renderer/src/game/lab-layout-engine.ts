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
export const LAB_MAX_PROPS_PER_ROOM = 40
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
      // Workstation is ~90x77px ≈ 2x2 cells. Mark a 3x3 block around the desk.
      // Props are large but the collision grid keeps them from overlapping.
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

// ---------------------------------------------------------------------------
// Composed station groups — props that form logical clusters
// Each group places a BASE item + OVERLAY items at offsets from the base position
// ---------------------------------------------------------------------------

interface StationGroup {
  base: { frame: number; scale: number }
  overlays: Array<{ frame: number; scale: number; dx: number; dy: number; depth: number }>
  widthCells: number
  heightCells: number
  validZones: PlacementZone[]
  depth: number
}

// Console station: blank desk + screen overlay + small items
const CONSOLE_STATIONS: StationGroup[] = [
  // Long console with screens and controls
  {
    base: { frame: LP.BLANK_CONSOLE_LONG, scale: 1.80 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_WAVE_01, scale: 0.40, dx: -20, dy: -8, depth: -1.3 },
      { frame: LP.CONSOLE_SCREEN_LINES_01, scale: 0.35, dx: 15, dy: -8, depth: -1.3 },
      { frame: LP.NUMB_PAD, scale: 0.30, dx: 30, dy: 5, depth: -1.3 },
      { frame: LP.STOP_BUTTON, scale: 0.30, dx: -35, dy: 5, depth: -1.3 },
    ],
    widthCells: 3, heightCells: 1, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
  // Short console with wave screen
  {
    base: { frame: LP.BLANK_CONSOLE_SHORT, scale: 1.50 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_WAVE_03, scale: 0.35, dx: 0, dy: -5, depth: -1.3 },
      { frame: LP.DIAL, scale: 0.25, dx: -12, dy: 8, depth: -1.3 },
      { frame: LP.LED_ON, scale: 0.20, dx: 12, dy: 8, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 1, validZones: ['top-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
  // Corner console
  {
    base: { frame: LP.BLANK_CONSOLE_CORNER, scale: 1.50 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_LINES_03, scale: 0.30, dx: 0, dy: -3, depth: -1.3 },
      { frame: LP.JOYSTICK, scale: 0.25, dx: -8, dy: 10, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['corner'], depth: -1.5,
  },
]

// Lab bench station: desk surface + glassware on top
const LAB_BENCH_STATIONS: StationGroup[] = [
  // Long bench with beakers and microscope
  {
    base: { frame: LP.DESK_TOP_LONG, scale: 1.50 },
    overlays: [
      { frame: LP.BEAKER, scale: 0.30, dx: -18, dy: -3, depth: -1.3 },
      { frame: LP.CONICAL_BEAKER, scale: 0.30, dx: -5, dy: -3, depth: -1.3 },
      { frame: LP.TEST_TUBE_HOLDER, scale: 0.30, dx: 12, dy: -3, depth: -1.3 },
      { frame: LP.PETRI_DISH, scale: 0.25, dx: 25, dy: 0, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 1, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
  // Short bench with sink items
  {
    base: { frame: LP.DESK_TOP_SHORT, scale: 1.20 },
    overlays: [
      { frame: LP.CUP, scale: 0.25, dx: -8, dy: -2, depth: -1.3 },
      { frame: LP.TUBE, scale: 0.25, dx: 8, dy: -2, depth: -1.3 },
    ],
    widthCells: 1, heightCells: 1, validZones: ['top-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
]

// Shared wall accent props — small fittings and indicators
const SHARED_ACCENTS: PropBlueprint[] = [
  // Warning signs
  { frame: LP.WARNING_POWER,      widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.92, depth: -1.4 },
  { frame: LP.WARNING_BIOLOGICAL,  widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.92, depth: -1.4 },
  { frame: LP.WARNING_STRIPES,     widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.90, depth: -1.4 },
  { frame: LP.WARNING_DEATH,       widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.90, depth: -1.4 },
  { frame: LP.WARNING_WARNING,     widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.90, depth: -1.4 },
  // Wall fittings
  { frame: LP.WALL_LIGHT,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.45, alpha: 0.92, depth: -1.3 },
  { frame: LP.VENT_SLATS,          widthCells: 1, heightCells: 1, validZones: ['bottom-wall', 'top-wall'], scale: 0.55, alpha: 0.88, depth: -1.5 },
  { frame: LP.VENT,                widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.50, alpha: 0.88, depth: -1.5 },
  { frame: LP.SPEAKER,             widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.40, alpha: 0.85, depth: -1.5 },
  { frame: LP.SPEAKER_02,          widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.40, alpha: 0.85, depth: -1.5 },
  { frame: LP.RECTANGLE_PANEL,     widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.50, alpha: 0.88, depth: -1.4 },
  { frame: LP.SMALL_RECTANGLE_PANEL, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.40, alpha: 0.88, depth: -1.4 },
  { frame: LP.OCTAGONAL_PANEL,     widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.50, alpha: 0.88, depth: -1.4 },
  { frame: LP.CIRCULAR_PANEL,      widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.50, alpha: 0.88, depth: -1.4 },
  // Floor detail
  { frame: LP.CABLE_PIECE_01,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.80, depth: -1.7 },
  { frame: LP.CABLE_PIECE_02,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.40, alpha: 0.75, depth: -1.7 },
  { frame: LP.CABLE_PIECE_03,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.40, alpha: 0.75, depth: -1.7 },
  { frame: LP.CABLE_COVER,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.45, alpha: 0.85, depth: -1.6 },
  { frame: LP.CABLE_COVER_WITH_RAMP, widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.45, alpha: 0.85, depth: -1.6 },
  { frame: LP.OCTOGON_PLATE,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.85, depth: -1.7 },
  { frame: LP.OCTOGON_PLATE_SMALL, widthCells: 1, heightCells: 1, validZones: ['center'],     scale: 0.35, alpha: 0.82, depth: -1.7 },
  { frame: LP.SUNKEN_VENT,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.45, alpha: 0.85, depth: -1.6 },
]

// Zone blueprints — large standalone props placed individually
const ZONE_BLUEPRINTS: Record<ZoneType, PropBlueprint[]> = {
  control: [
    // Composed console_example pieces as standalone fallback
    { frame: LP.CONSOLE_EXAMPLE_LONG,  widthCells: 3, heightCells: 1, validZones: ['top-wall', 'center'],    scale: 1.80, alpha: 0.95, depth: -1.5 },
    { frame: LP.CONSOLE_EXAMPLE_SHORT, widthCells: 2, heightCells: 1, validZones: ['top-wall'],    scale: 1.40, alpha: 0.92, depth: -1.5 },
    { frame: LP.CONSOLE_EXAMPLE_CORNER, widthCells: 2, heightCells: 2, validZones: ['corner'],     scale: 1.40, alpha: 0.92, depth: -1.5 },
    // Screens
    { frame: LP.FREE_STANDING_SCREEN,  widthCells: 1, heightCells: 1, validZones: ['right-wall', 'left-wall'],  scale: 0.90, alpha: 0.92, depth: -1.4 },
    { frame: LP.MONITOR,               widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.70, alpha: 0.92, depth: -1.4 },
    // Equipment units on walls
    { frame: LP.UNIT_EXAMPLE_01,       widthCells: 1, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.20, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_04,       widthCells: 1, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.20, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_SQUARE,           widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.80, alpha: 0.90, depth: -1.5 },
    // Small desk items
    { frame: LP.STOOL,                 widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.55, alpha: 0.85, depth: -1.6 },
    { frame: LP.DESK_LAMP,             widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.45, alpha: 0.88, depth: -1.3 },
    { frame: LP.CLIPBOARD,             widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.30, alpha: 0.82, depth: -1.6 },
    { frame: LP.PAPER_SHEET,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.30, alpha: 0.80, depth: -1.7 },
  ],

  chemical: [
    // Large centerpieces
    { frame: LP.MICROSCOPE,            widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.60, alpha: 0.95, depth: -1.5 },
    { frame: LP.CIRCULAR_SINK,         widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.50, alpha: 0.92, depth: -1.5 },
    // Sink accessories (overlay-like but standalone)
    { frame: LP.CIRCULAR_SINK_FAN,     widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.50, alpha: 0.88, depth: -1.3 },
    { frame: LP.CIRCULAR_SINK_ITEM,    widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.45, alpha: 0.88, depth: -1.3 },
    { frame: LP.CIRCULAR_SINK_LEVER,   widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.40, alpha: 0.88, depth: -1.3 },
    // Storage
    { frame: LP.SHELF,                 widthCells: 2, heightCells: 1, validZones: ['bottom-wall', 'left-wall'], scale: 1.20, alpha: 0.90, depth: -1.5 },
    { frame: LP.DOME,                  widthCells: 2, heightCells: 2, validZones: ['left-wall', 'center'],   scale: 1.20, alpha: 0.90, depth: -1.5 },
    // Wall instruments
    { frame: LP.SCALE,                 widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.70, alpha: 0.90, depth: -1.4 },
    { frame: LP.SMALL_APPARATUS,       widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.60, alpha: 0.88, depth: -1.4 },
    { frame: LP.GAS_VALVE_ON,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.40, alpha: 0.90, depth: -1.4 },
    { frame: LP.CLAMP_DOUBLE,          widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.35, alpha: 0.88, depth: -1.4 },
    { frame: LP.CLAMP_SINGLE,          widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.35, alpha: 0.88, depth: -1.4 },
    // Floor scatter
    { frame: LP.SPILT_TEST_TUBE,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.30, alpha: 0.82, depth: -1.7 },
    { frame: LP.PUDDLE,                widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.65, depth: -1.8 },
  ],

  machinery: [
    // Large centerpieces
    { frame: LP.GENERATOR,             widthCells: 3, heightCells: 3, validZones: ['center', 'top-wall'],    scale: 2.20, alpha: 0.95, depth: -1.5 },
    { frame: LP.LAB_MACHINE_01,        widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.80, alpha: 0.95, depth: -1.5 },
    { frame: LP.LARGE_TANK,            widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall', 'center'], scale: 1.60, alpha: 0.92, depth: -1.5 },
    // Equipment units — wall-mounted machinery
    { frame: LP.UNIT_EXAMPLE_02,       widthCells: 1, heightCells: 2, validZones: ['right-wall'],  scale: 1.20, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_03,       widthCells: 2, heightCells: 2, validZones: ['left-wall', 'top-wall'], scale: 1.40, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_LARGE,            widthCells: 2, heightCells: 1, validZones: ['right-wall', 'bottom-wall'], scale: 1.20, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_SMALL,            widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.85, alpha: 0.90, depth: -1.5 },
    { frame: LP.FAN_UNIT_HOUSING,      widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.75, alpha: 0.90, depth: -1.4 },
    { frame: LP.POWER_CELL,            widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.90, depth: -1.5 },
    // Pipe connectors
    { frame: LP.PIPE_CONNECTOR_ARCHED, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.45, alpha: 0.88, depth: -1.4 },
    { frame: LP.PIPE_CONNECTOR_TO_SIDE, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.45, alpha: 0.88, depth: -1.4 },
    { frame: LP.PIPE_CONNECTOR_ANGLED_TO_SIDE, widthCells: 1, heightCells: 1, validZones: ['corner'], scale: 0.45, alpha: 0.88, depth: -1.4 },
    // Controls
    { frame: LP.STOP_BUTTON,           widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.35, alpha: 0.92, depth: -1.3 },
    { frame: LP.STOP_BUTTON_02,        widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.35, alpha: 0.92, depth: -1.3 },
    // Floor scatter
    { frame: LP.SUNKEN_CELL,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.50, alpha: 0.85, depth: -1.7 },
    { frame: LP.NUT,                   widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.30, alpha: 0.85, depth: -1.7 },
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.88, depth: -1.7 },
  ],

  pod: [
    // Large pod structures
    { frame: LP.POD,                   widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.60, alpha: 0.95, depth: -1.5 },
    { frame: LP.BROKEN_POD,            widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.40, alpha: 0.88, depth: -1.5 },
    { frame: LP.SLIDING_DOOR,          widthCells: 1, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.00, alpha: 0.90, depth: -1.5 },
    // Skylights
    { frame: LP.LARGE_SKYLIGHT,        widthCells: 2, heightCells: 1, validZones: ['center'],      scale: 1.00, alpha: 0.82, depth: -1.7 },
    { frame: LP.SMALL_SKYLIGHT,        widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.65, alpha: 0.82, depth: -1.7 },
    // Storage and furniture
    { frame: LP.CHEST_CLOSED,          widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.90, depth: -1.5 },
    { frame: LP.CHEST_OPEN,            widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.60, alpha: 0.88, depth: -1.5 },
    { frame: LP.DESK_TOP_LONG,         widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.20, alpha: 0.92, depth: -1.5 },
    // Blocks for structure
    { frame: LP.BLOCK_01,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.60, alpha: 0.88, depth: -1.6 },
    { frame: LP.BLOCK_02,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.85, depth: -1.6 },
    { frame: LP.BLOCK_04,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.55, alpha: 0.85, depth: -1.6 },
    // Wall fittings
    { frame: LP.CONSOLE_LED_ON,        widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.30, alpha: 0.92, depth: -1.3 },
    { frame: LP.CONSOLE_LED_OFF,       widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.30, alpha: 0.70, depth: -1.3 },
    { frame: LP.TABLET,                widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.35, alpha: 0.85, depth: -1.3 },
    // Floor scatter
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.45, alpha: 0.85, depth: -1.7 },
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

  // Props start 1 cell from edge — equipment hugs walls like the reference image
  const INSET = 1
  const minC = INSET
  const maxC = cols - INSET
  const minR = INSET
  const maxR = rows - INSET

  for (const zone of bp.validZones) {
    switch (zone) {
      case 'top-wall': {
        // Scan rows near top wall (up to 3 rows deep) for available space
        for (let r = minR; r < Math.min(minR + 3, maxR - bp.heightCells + 1); r++) {
          const rangeC = Math.max(1, maxC - minC - bp.widthCells + 1)
          const startCol = minC + ((hash + attempt * 7) % rangeC)
          for (let c = startCol; c < maxC - bp.widthCells + 1; c++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
          for (let c = minC; c < startCol; c++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
        }
        break
      }
      case 'bottom-wall': {
        // Scan rows near bottom wall (up to 3 rows deep)
        for (let r = maxR - bp.heightCells; r > Math.max(minR, maxR - bp.heightCells - 3); r--) {
          if (r < minR) break
          const rangeC = Math.max(1, maxC - minC - bp.widthCells + 1)
          const startCol = minC + ((hash + attempt * 11) % rangeC)
          for (let c = startCol; c < maxC - bp.widthCells + 1; c++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
          for (let c = minC; c < startCol; c++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
        }
        break
      }
      case 'left-wall': {
        // Scan columns near left wall (up to 3 cols deep)
        for (let c = minC; c < Math.min(minC + 3, maxC - bp.widthCells + 1); c++) {
          const rangeR = Math.max(1, maxR - minR - bp.heightCells + 1)
          const startRow = minR + ((hash + attempt * 13) % rangeR)
          for (let r = startRow; r < maxR - bp.heightCells + 1; r++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
          for (let r = minR; r < startRow; r++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
        }
        break
      }
      case 'right-wall': {
        // Scan columns near right wall (up to 3 cols deep)
        for (let c = maxC - bp.widthCells; c > Math.max(minC, maxC - bp.widthCells - 3); c--) {
          if (c < minC) break
          const rangeR = Math.max(1, maxR - minR - bp.heightCells + 1)
          const startRow = minR + ((hash + attempt * 17) % rangeR)
          for (let r = startRow; r < maxR - bp.heightCells + 1; r++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
          for (let r = minR; r < startRow; r++) {
            if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
          }
        }
        break
      }
      case 'center': {
        // Scan interior, biased toward middle — spiral outward
        const midC = Math.floor(cols / 2)
        const midR = Math.floor(rows / 2)
        const maxRadius = Math.max(cols, rows)
        for (let d = 0; d < maxRadius; d++) {
          for (let dr = -d; dr <= d; dr++) {
            for (let dc = -d; dc <= d; dc++) {
              if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue
              const c = midC + dc
              const r = midR + dr
              if (c < minC || r < minR || c + bp.widthCells > maxC || r + bp.heightCells > maxR) continue
              if (grid.isAreaFree(c, r, bp.widthCells, bp.heightCells)) return { col: c, row: r }
            }
          }
        }
        break
      }
      case 'corner': {
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

// ---------------------------------------------------------------------------
// Place composed station groups — each places a base + overlays as a unit
// ---------------------------------------------------------------------------

function placeStationGroups(
  grid: CellGrid,
  zone: ZoneType,
  hash: number,
  placements: SpritePlacement[],
): void {
  // Pick station groups based on zone type
  const stations: StationGroup[] = []
  if (zone === 'control' || zone === 'pod') {
    stations.push(...CONSOLE_STATIONS)
  }
  if (zone === 'chemical') {
    stations.push(...LAB_BENCH_STATIONS)
    stations.push(CONSOLE_STATIONS[1]) // add a short console too
  }
  if (zone === 'machinery') {
    stations.push(CONSOLE_STATIONS[0]) // control console in machinery room
  }

  for (let i = 0; i < stations.length && placements.length < LAB_MAX_PROPS_PER_ROOM - 3; i++) {
    const station = stations[i]
    // Use findPlacement with a virtual blueprint
    const virtualBp: PropBlueprint = {
      frame: 0, widthCells: station.widthCells, heightCells: station.heightCells,
      validZones: station.validZones, scale: 1, alpha: 1, depth: station.depth,
    }
    const pos = findPlacement(grid, virtualBp, hash, i + 100)
    if (!pos) continue

    grid.markArea(pos.col, pos.row, station.widthCells, station.heightCells, 'equipment')
    const topLeft = grid.cellToPixel(pos.col, pos.row)
    const px = topLeft.x + (station.widthCells - 1) * grid.step / 2
    const py = topLeft.y + (station.heightCells - 1) * grid.step / 2

    // Place base
    placements.push({
      frame: station.base.frame, x: px, y: py,
      scale: station.base.scale, alpha: 0.95, depth: station.depth,
      spritesheet: 'lab-props',
    })

    // Place overlays on top of base
    for (const ov of station.overlays) {
      placements.push({
        frame: ov.frame, x: px + ov.dx, y: py + ov.dy,
        scale: ov.scale, alpha: 0.92, depth: ov.depth,
        spritesheet: 'lab-props',
      })
    }
  }
}

function placeProps(grid: CellGrid, zone: ZoneType, hash: number): SpritePlacement[] {
  const placements: SpritePlacement[] = []

  // 1. Place composed station groups FIRST (consoles, lab benches)
  placeStationGroups(grid, zone, hash, placements)

  // 2. Then place individual zone props + shared accents
  const blueprints = ZONE_BLUEPRINTS[zone]
  const allBlueprints = [...blueprints, ...SHARED_ACCENTS]

  // Shuffle shared accents deterministically
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
    const topLeft = grid.cellToPixel(pos.col, pos.row)
    const px = topLeft.x + (bp.widthCells - 1) * grid.step / 2
    const py = topLeft.y + (bp.heightCells - 1) * grid.step / 2

    placements.push({
      frame: bp.frame, x: px, y: py,
      scale: bp.scale, alpha: bp.alpha, depth: bp.depth,
      spritesheet: 'lab-props',
    })
  }

  return placements
}

// ---------------------------------------------------------------------------
// Wall-run fill — pack remaining wall cells with consecutive console sprites
// Creates the "control panels spanning full wall" look from the reference.
// ---------------------------------------------------------------------------

// Wall-run frames — items that look good lining walls at small scale
const WALL_RUN_FRAMES = [
  LP.CONSOLE_SCREEN,
  LP.MONITOR,
  LP.GUAGE,
  LP.DIAL,
  LP.SWITCH_UP,
  LP.GAS_VALVE_ON,
  LP.OCTAGONAL_PANEL,
  LP.WALL_LIGHT,
]

function fillWallRuns(grid: CellGrid, hash: number, placements: SpritePlacement[]): void {
  const { cols, rows } = grid

  // Fill every OTHER remaining floor cell along top wall — leave gaps for breathing room
  const topRow = 1
  let frameIdx = hash % WALL_RUN_FRAMES.length
  for (let c = 1; c < cols - 1; c += 2) {  // skip every other cell
    if (placements.length >= LAB_MAX_PROPS_PER_ROOM) break
    if (grid.get(c, topRow) !== 'floor') continue

    grid.set(c, topRow, 'equipment')
    const pos = grid.cellToPixel(c, topRow)
    placements.push({
      frame: WALL_RUN_FRAMES[frameIdx % WALL_RUN_FRAMES.length],
      x: pos.x,
      y: pos.y,
      scale: 0.55,
      alpha: 0.88,
      depth: -1.4,
      spritesheet: 'lab-props',
    })
    frameIdx++
  }

  // Fill every other cell along bottom wall
  const botRow = rows - 2
  if (botRow > topRow + 2) {
    for (let c = 1; c < cols - 1; c += 2) {
      if (placements.length >= LAB_MAX_PROPS_PER_ROOM) break
      if (grid.get(c, botRow) !== 'floor') continue

      grid.set(c, botRow, 'equipment')
      const pos = grid.cellToPixel(c, botRow)
      placements.push({
        frame: WALL_RUN_FRAMES[frameIdx % WALL_RUN_FRAMES.length],
        x: pos.x,
        y: pos.y,
        scale: 0.50,
        alpha: 0.85,
        depth: -1.5,
        spritesheet: 'lab-props',
      })
      frameIdx++
    }
  }
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
  const targetCount = Math.max(2, Math.floor(cols / 2))
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
          outerRadius: 22,
          midRadius: 13,
          coreRadius: 7,
          color: LAB_GLOW_COLOR,
          outerAlpha: 0.15,
          midAlpha: 0.32,
          coreAlpha: 0.55,
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
            outerRadius: 22, midRadius: 13, coreRadius: 7,
            color: LAB_GLOW_COLOR,
            outerAlpha: 0.15, midAlpha: 0.32, coreAlpha: 0.55,
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
  fillWallRuns(grid, hash, propPlacements)
  const glowPlacements = placeGlowLights(grid, hash)

  return { propPlacements, glowPlacements }
}
