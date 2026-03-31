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
export const LAB_MAX_PROPS_PER_ROOM = 80
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
  tint?: number  // optional color tint
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
  base: { frame: number; scale: number; tint?: number }
  overlays: Array<{ frame: number; scale: number; dx: number; dy: number; depth: number; tint?: number }>
  widthCells: number
  heightCells: number
  validZones: PlacementZone[]
  depth: number
}

// Scales are derived from original PNG dimensions so props look their intended
// size relative to the 128px (rendered 64px) tile grid.
// Formula: originalMaxDimension * 0.5 / 64. This restores natural proportions.
// console_example_long (436px) → 3.0, large_tank (365px) → 2.5, generator (243px) → 2.0, etc.

// Console station: blank desk + screen overlay + small items on top
const CONSOLE_STATIONS: StationGroup[] = [
  // Long console with screens and controls — 436px original → scale 3.0
  {
    base: { frame: LP.BLANK_CONSOLE_LONG, scale: 3.0 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_WAVE_01, scale: 1.2, dx: -40, dy: -12, depth: -1.3 },
      { frame: LP.CONSOLE_SCREEN_LINES_01, scale: 1.1, dx: 25, dy: -12, depth: -1.3 },
      { frame: LP.NUMB_PAD, scale: 0.8, dx: 55, dy: 8, depth: -1.3 },
      { frame: LP.STOP_BUTTON, scale: 0.7, dx: -60, dy: 8, depth: -1.3 },
    ],
    widthCells: 4, heightCells: 2, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
  // Short console with wave screen — ~250px original → scale 2.0
  {
    base: { frame: LP.BLANK_CONSOLE_SHORT, scale: 2.0 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_WAVE_03, scale: 1.0, dx: 0, dy: -6, depth: -1.3 },
      { frame: LP.DIAL, scale: 0.7, dx: -16, dy: 12, depth: -1.3 },
      { frame: LP.LED_ON, scale: 0.5, dx: 16, dy: 12, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['top-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
  // Corner console — ~200px original → scale 2.0
  {
    base: { frame: LP.BLANK_CONSOLE_CORNER, scale: 2.0 },
    overlays: [
      { frame: LP.CONSOLE_SCREEN_LINES_03, scale: 0.9, dx: 0, dy: -5, depth: -1.3 },
      { frame: LP.JOYSTICK, scale: 0.7, dx: -10, dy: 14, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['corner'], depth: -1.5,
  },
]

// Lab bench station: desk surface + glassware on top
const LAB_BENCH_STATIONS: StationGroup[] = [
  // Long desk (266px original) → scale 2.5, with beakers ON TOP
  {
    base: { frame: LP.DESK_TOP_LONG, scale: 2.5 },
    overlays: [
      { frame: LP.BEAKER, scale: 0.8, dx: -30, dy: -8, depth: -1.3 },
      { frame: LP.CONICAL_BEAKER, scale: 0.8, dx: 5, dy: -8, depth: -1.3 },
      { frame: LP.TEST_TUBE_HOLDER, scale: 0.8, dx: 35, dy: -8, depth: -1.3 },
      { frame: LP.MICROSCOPE, scale: 1.0, dx: -55, dy: -10, depth: -1.3 },
    ],
    widthCells: 4, heightCells: 2, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
  // Short desk — scale 1.8
  {
    base: { frame: LP.DESK_TOP_SHORT, scale: 1.8 },
    overlays: [
      { frame: LP.CUP, scale: 0.7, dx: -10, dy: -5, depth: -1.3 },
      { frame: LP.TUBE, scale: 0.6, dx: 10, dy: -5, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 1, validZones: ['top-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
]

// Keyboard workstation — desk + keyboard + screen + pencil
const KEYBOARD_STATIONS: StationGroup[] = [
  {
    base: { frame: LP.DESK_TOP_LONG, scale: 2.5 },
    overlays: [
      { frame: LP.KEYBOARD, scale: 1.0, dx: 0, dy: 5, depth: -1.3 },
      { frame: LP.CONSOLE_SCREEN_WAVE_02, scale: 1.0, dx: -20, dy: -10, depth: -1.3 },
      { frame: LP.CONSOLE_SCREEN_LINES_02, scale: 0.9, dx: 25, dy: -10, depth: -1.3 },
      { frame: LP.PENCIL, scale: 0.5, dx: 45, dy: 5, depth: -1.3 },
    ],
    widthCells: 4, heightCells: 2, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
  {
    base: { frame: LP.DESK_TOP_SHORT, scale: 1.8 },
    overlays: [
      { frame: LP.KEYBOARD, scale: 0.8, dx: 0, dy: 4, depth: -1.3 },
      { frame: LP.CONSOLE_SCREEN_WAVE_04, scale: 0.8, dx: 0, dy: -6, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['top-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
]

// Fan + housing combo
const FAN_STATIONS: StationGroup[] = [
  {
    base: { frame: LP.FAN_UNIT_HOUSING, scale: 1.8 },
    overlays: [
      { frame: LP.FAN_UNIT_FAN, scale: 1.4, dx: 0, dy: 0, depth: -1.3 },
      { frame: LP.GUAGE_NEEDLE, scale: 0.6, dx: 25, dy: -15, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall', 'bottom-wall'], depth: -1.5,
  },
]

// Chemical bench with petri dishes and detailed glassware
const CHEM_BENCH_STATIONS: StationGroup[] = [
  {
    base: { frame: LP.DESK_TOP_LONG, scale: 2.5 },
    overlays: [
      { frame: LP.PETRI_DISH, scale: 0.8, dx: -30, dy: -5, depth: -1.3 },
      { frame: LP.CONICAL_BEAKER, scale: 0.8, dx: 0, dy: -8, depth: -1.3 },
      { frame: LP.CUP_02, scale: 0.7, dx: 25, dy: -5, depth: -1.3 },
      { frame: LP.CLIPBOARD_02, scale: 0.6, dx: 45, dy: 2, depth: -1.3 },
    ],
    widthCells: 4, heightCells: 2, validZones: ['top-wall', 'bottom-wall'], depth: -1.5,
  },
]

// Laser emitter station
const LASER_STATIONS: StationGroup[] = [
  {
    base: { frame: LP.LASER_HEAD, scale: 1.8 },
    overlays: [
      { frame: LP.LASER_OUTLET, scale: 1.2, dx: 30, dy: 0, depth: -1.3 },
      { frame: LP.CONSOLE_LED_ON, scale: 0.7, dx: -20, dy: -10, depth: -1.3 },
    ],
    widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'], depth: -1.5,
  },
]

// Tank/containment row — green-tinted tanks along walls
const TANK_ROW_STATIONS: StationGroup[] = [
  // Row of 3 tanks — large_tank (365px) → scale 2.5
  {
    base: { frame: LP.LARGE_TANK, scale: 2.5, tint: 0x44dd88 },
    overlays: [
      { frame: LP.LARGE_TANK, scale: 2.5, dx: 100, dy: 0, depth: -1.4, tint: 0x33cc77 },
      { frame: LP.LARGE_TANK, scale: 2.5, dx: -100, dy: 0, depth: -1.4, tint: 0x55ee99 },
      { frame: LP.GUAGE, scale: 0.8, dx: 50, dy: -40, depth: -1.3 },
    ],
    widthCells: 5, heightCells: 3, validZones: ['bottom-wall', 'left-wall', 'right-wall'], depth: -1.5,
  },
  // Power cells with dome — scale 1.8
  {
    base: { frame: LP.POWER_CELL, scale: 1.8, tint: 0x44ddaa },
    overlays: [
      { frame: LP.POWER_CELL, scale: 1.8, dx: 70, dy: 0, depth: -1.4, tint: 0x44ddaa },
      { frame: LP.DOME, scale: 1.5, dx: -50, dy: -6, depth: -1.3, tint: 0x33cc88 },
    ],
    widthCells: 3, heightCells: 2, validZones: ['bottom-wall', 'right-wall'], depth: -1.5,
  },
]

// Shared wall accent props — scaled up to be visible
const SHARED_ACCENTS: PropBlueprint[] = [
  // Warning signs — visible on walls
  { frame: LP.WARNING_POWER,      widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.0, alpha: 0.92, depth: -1.4 },
  { frame: LP.WARNING_BIOLOGICAL,  widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.0, alpha: 0.92, depth: -1.4 },
  { frame: LP.WARNING_STRIPES,     widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.0, alpha: 0.90, depth: -1.4 },
  { frame: LP.WARNING_DEATH,       widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.0, alpha: 0.90, depth: -1.4 },
  { frame: LP.WARNING_WARNING,     widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.0, alpha: 0.90, depth: -1.4 },
  // Wall fittings — properly sized
  { frame: LP.WALL_LIGHT,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.8, alpha: 0.92, depth: -1.3 },
  { frame: LP.VENT_SLATS,          widthCells: 1, heightCells: 1, validZones: ['bottom-wall', 'top-wall'], scale: 1.0, alpha: 0.88, depth: -1.5 },
  { frame: LP.VENT,                widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.9, alpha: 0.88, depth: -1.5 },
  { frame: LP.SPEAKER,             widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.7, alpha: 0.85, depth: -1.5 },
  { frame: LP.SPEAKER_02,          widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 0.7, alpha: 0.85, depth: -1.5 },
  { frame: LP.RECTANGLE_PANEL,     widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.9, alpha: 0.88, depth: -1.4 },
  { frame: LP.SMALL_RECTANGLE_PANEL, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.7, alpha: 0.88, depth: -1.4 },
  { frame: LP.OCTAGONAL_PANEL,     widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.9, alpha: 0.88, depth: -1.4 },
  { frame: LP.CIRCULAR_PANEL,      widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.9, alpha: 0.88, depth: -1.4 },
  // Floor detail
  { frame: LP.CABLE_PIECE_01,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.8, alpha: 0.80, depth: -1.7 },
  { frame: LP.CABLE_PIECE_02,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.75, depth: -1.7 },
  { frame: LP.CABLE_PIECE_03,     widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.75, depth: -1.7 },
  { frame: LP.CABLE_COVER,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.85, depth: -1.6 },
  { frame: LP.CABLE_COVER_WITH_RAMP, widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.85, depth: -1.6 },
  { frame: LP.OCTOGON_PLATE,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.9, alpha: 0.85, depth: -1.7 },
  { frame: LP.OCTOGON_PLATE_SMALL, widthCells: 1, heightCells: 1, validZones: ['center'],     scale: 0.6, alpha: 0.82, depth: -1.7 },
  { frame: LP.SUNKEN_VENT,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.85, depth: -1.6 },
]

// Zone blueprints — scales derived from original PNG dimensions.
// Large items (consoles 436px, tanks 365px, generators 243px) → scale 2.0-3.0
// Medium items (screens 191px, sinks, units) → scale 1.5-2.0
// Small items (beaker 122px, stool, microscope) → scale 0.8-1.3
// Tiny items (LEDs, buttons, clips) → scale 0.5-0.7
const ZONE_BLUEPRINTS: Record<ZoneType, PropBlueprint[]> = {
  control: [
    // Pre-composed console panels — console_example_long is 436px original
    { frame: LP.CONSOLE_EXAMPLE_LONG,  widthCells: 4, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 3.0, alpha: 0.95, depth: -1.5 },
    { frame: LP.CONSOLE_EXAMPLE_SHORT, widthCells: 2, heightCells: 2, validZones: ['top-wall'],    scale: 2.0, alpha: 0.95, depth: -1.5 },
    { frame: LP.CONSOLE_EXAMPLE_CORNER, widthCells: 2, heightCells: 2, validZones: ['corner'],     scale: 2.0, alpha: 0.95, depth: -1.5 },
    // Screens — free_standing_screen 191px → 1.5
    { frame: LP.FREE_STANDING_SCREEN,  widthCells: 2, heightCells: 2, validZones: ['right-wall', 'left-wall'],  scale: 1.8, alpha: 0.92, depth: -1.4 },
    { frame: LP.MONITOR,               widthCells: 2, heightCells: 1, validZones: ['top-wall'],    scale: 1.5, alpha: 0.92, depth: -1.4 },
    // Equipment units — unit_example_01 230px → 1.8
    { frame: LP.UNIT_EXAMPLE_01,       widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.8, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_04,       widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.8, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_SQUARE,           widthCells: 2, heightCells: 2, validZones: ['left-wall', 'right-wall'], scale: 1.6, alpha: 0.90, depth: -1.5 },
    // Keyboard + desk items
    { frame: LP.KEYBOARD,              widthCells: 1, heightCells: 1, validZones: ['top-wall', 'center'], scale: 1.2, alpha: 0.90, depth: -1.3 },
    { frame: LP.DESK_DRAW,             widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.5, alpha: 0.88, depth: -1.5 },
    { frame: LP.STOOL,                 widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 1.3, alpha: 0.85, depth: -1.6 },
    { frame: LP.DESK_LAMP,             widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 1.0, alpha: 0.88, depth: -1.3 },
    { frame: LP.CLIPBOARD,             widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.82, depth: -1.6 },
    { frame: LP.PAPER_SHEET,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.80, depth: -1.7 },
    { frame: LP.DIAL_02,               widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.8, alpha: 0.88, depth: -1.3 },
    { frame: LP.SWITCH_DOWN,           widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.7, alpha: 0.88, depth: -1.3 },
  ],

  chemical: [
    // Centerpieces — microscope 108px → 1.3, circular_sink → 2.0
    { frame: LP.MICROSCOPE,            widthCells: 1, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 1.3, alpha: 0.95, depth: -1.5 },
    { frame: LP.CIRCULAR_SINK,         widthCells: 2, heightCells: 2, validZones: ['top-wall', 'center'],    scale: 2.0, alpha: 0.95, depth: -1.5 },
    // Sink accessories
    { frame: LP.CIRCULAR_SINK_FAN,     widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 1.0, alpha: 0.90, depth: -1.3 },
    { frame: LP.CIRCULAR_SINK_ITEM,    widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.9, alpha: 0.90, depth: -1.3 },
    { frame: LP.CIRCULAR_SINK_LEVER,   widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.8, alpha: 0.90, depth: -1.3 },
    // Storage — shelf 232px → 1.8
    { frame: LP.SHELF,                 widthCells: 2, heightCells: 2, validZones: ['bottom-wall', 'left-wall'], scale: 1.8, alpha: 0.90, depth: -1.5 },
    { frame: LP.DOME,                  widthCells: 2, heightCells: 2, validZones: ['left-wall', 'center'],   scale: 1.5, alpha: 0.90, depth: -1.5 },
    // Wall instruments
    { frame: LP.SCALE,                 widthCells: 1, heightCells: 2, validZones: ['right-wall'],  scale: 1.5, alpha: 0.90, depth: -1.4 },
    { frame: LP.SMALL_APPARATUS,       widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 1.3, alpha: 0.88, depth: -1.4 },
    { frame: LP.GAS_VALVE_ON,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.0, alpha: 0.90, depth: -1.4 },
    { frame: LP.CLAMP_DOUBLE,          widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.8, alpha: 0.88, depth: -1.4 },
    { frame: LP.CLAMP_SINGLE,          widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.8, alpha: 0.88, depth: -1.4 },
    // Additional lab equipment
    { frame: LP.PETRI_DISH,            widthCells: 1, heightCells: 1, validZones: ['top-wall', 'center'], scale: 1.0, alpha: 0.88, depth: -1.4 },
    { frame: LP.CUP_02,               widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 0.8, alpha: 0.85, depth: -1.3 },
    { frame: LP.CLIPBOARD_02,         widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.82, depth: -1.6 },
    // Floor scatter
    { frame: LP.SPILT_TEST_TUBE,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.82, depth: -1.7 },
    { frame: LP.PUDDLE,                widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.9, alpha: 0.65, depth: -1.8 },
  ],

  machinery: [
    // Centerpieces — generator 243px → 2.5, lab_machine → 2.5
    { frame: LP.GENERATOR,             widthCells: 3, heightCells: 3, validZones: ['center', 'top-wall'],    scale: 2.5, alpha: 0.95, depth: -1.5 },
    { frame: LP.LAB_MACHINE_01,        widthCells: 3, heightCells: 3, validZones: ['top-wall', 'center'],    scale: 2.5, alpha: 0.95, depth: -1.5 },
    { frame: LP.LARGE_TANK,            widthCells: 2, heightCells: 3, validZones: ['left-wall', 'right-wall', 'center'], scale: 2.5, alpha: 0.92, depth: -1.5 },
    // Equipment units — 230px → 1.8-2.0
    { frame: LP.UNIT_EXAMPLE_02,       widthCells: 2, heightCells: 2, validZones: ['right-wall'],  scale: 1.8, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_EXAMPLE_03,       widthCells: 3, heightCells: 3, validZones: ['left-wall', 'top-wall'], scale: 2.0, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_LARGE,            widthCells: 2, heightCells: 2, validZones: ['right-wall', 'bottom-wall'], scale: 1.8, alpha: 0.92, depth: -1.5 },
    { frame: LP.UNIT_SMALL,            widthCells: 2, heightCells: 1, validZones: ['left-wall'],   scale: 1.5, alpha: 0.90, depth: -1.5 },
    { frame: LP.FAN_UNIT_HOUSING,      widthCells: 2, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.5, alpha: 0.90, depth: -1.4 },
    { frame: LP.POWER_CELL,            widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.5, alpha: 0.90, depth: -1.5 },
    // Pipe connectors
    { frame: LP.PIPE_CONNECTOR_ARCHED, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.0, alpha: 0.88, depth: -1.4 },
    { frame: LP.PIPE_CONNECTOR_TO_SIDE, widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.0, alpha: 0.88, depth: -1.4 },
    { frame: LP.PIPE_CONNECTOR_ANGLED_TO_SIDE, widthCells: 1, heightCells: 1, validZones: ['corner'], scale: 1.0, alpha: 0.88, depth: -1.4 },
    // Controls
    { frame: LP.STOP_BUTTON,           widthCells: 1, heightCells: 1, validZones: ['right-wall'],  scale: 0.8, alpha: 0.92, depth: -1.3 },
    { frame: LP.STOP_BUTTON_02,        widthCells: 1, heightCells: 1, validZones: ['left-wall'],   scale: 0.8, alpha: 0.92, depth: -1.3 },
    // Fan units — composed (housing + fan blade)
    { frame: LP.FAN_UNIT_HOUSING,      widthCells: 2, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.5, alpha: 0.90, depth: -1.4 },
    { frame: LP.GUAGE_NEEDLE,          widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.8, alpha: 0.88, depth: -1.3 },
    { frame: LP.LASER_HEAD,            widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 1.3, alpha: 0.92, depth: -1.4 },
    { frame: LP.LASER_OUTLET,          widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 1.0, alpha: 0.88, depth: -1.4 },
    // Floor scatter
    { frame: LP.SUNKEN_CELL,           widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 1.0, alpha: 0.85, depth: -1.7 },
    { frame: LP.NUT,                   widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.6, alpha: 0.85, depth: -1.7 },
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.9, alpha: 0.88, depth: -1.7 },
    { frame: LP.FLOOR_SPIKE_UP,        widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.9, alpha: 0.85, depth: -1.7 },
    { frame: LP.SUNKEN_NUT,            widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.82, depth: -1.7 },
  ],

  pod: [
    // Pods — pod 248px → 2.0
    { frame: LP.POD,                   widthCells: 2, heightCells: 3, validZones: ['top-wall', 'center'],    scale: 2.0, alpha: 0.95, depth: -1.5 },
    { frame: LP.BROKEN_POD,            widthCells: 2, heightCells: 3, validZones: ['top-wall', 'center'],    scale: 2.0, alpha: 0.88, depth: -1.5 },
    { frame: LP.SLIDING_DOOR,          widthCells: 2, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 1.5, alpha: 0.90, depth: -1.5 },
    // Skylights
    { frame: LP.LARGE_SKYLIGHT,        widthCells: 2, heightCells: 2, validZones: ['center'],      scale: 1.8, alpha: 0.82, depth: -1.7 },
    { frame: LP.SMALL_SKYLIGHT,        widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 1.3, alpha: 0.82, depth: -1.7 },
    // Storage — chest ~150px → 1.3
    { frame: LP.CHEST_CLOSED,          widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.5, alpha: 0.90, depth: -1.5 },
    { frame: LP.CHEST_OPEN,            widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.5, alpha: 0.88, depth: -1.5 },
    { frame: LP.DESK_TOP_LONG,         widthCells: 3, heightCells: 1, validZones: ['bottom-wall'], scale: 2.0, alpha: 0.92, depth: -1.5 },
    // Blocks
    { frame: LP.BLOCK_01,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.3, alpha: 0.88, depth: -1.6 },
    { frame: LP.BLOCK_02,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.3, alpha: 0.85, depth: -1.6 },
    { frame: LP.BLOCK_04,              widthCells: 1, heightCells: 1, validZones: ['corner'],      scale: 1.3, alpha: 0.85, depth: -1.6 },
    // Wall fittings
    { frame: LP.CONSOLE_LED_ON,        widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.8, alpha: 0.92, depth: -1.3 },
    { frame: LP.CONSOLE_LED_OFF,       widthCells: 1, heightCells: 1, validZones: ['left-wall', 'right-wall'], scale: 0.8, alpha: 0.70, depth: -1.3 },
    { frame: LP.TABLET,                widthCells: 1, heightCells: 1, validZones: ['bottom-wall'], scale: 0.8, alpha: 0.85, depth: -1.3 },
    { frame: LP.NARROW_SKYLIGHT,       widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 1.3, alpha: 0.80, depth: -1.7 },
    { frame: LP.DESK_DRAW,             widthCells: 2, heightCells: 1, validZones: ['bottom-wall'], scale: 1.3, alpha: 0.85, depth: -1.5 },
    { frame: LP.KEYBOARD,              widthCells: 1, heightCells: 1, validZones: ['top-wall'],    scale: 1.0, alpha: 0.88, depth: -1.3 },
    { frame: LP.PAPER_SHEET_02,        widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.7, alpha: 0.75, depth: -1.7 },
    // Floor scatter
    { frame: LP.FLOOR_SPIKE_DOWN,      widthCells: 1, heightCells: 1, validZones: ['center'],      scale: 0.9, alpha: 0.85, depth: -1.7 },
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

  // Props start 1 cell from edge — hug walls like the reference
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
  // Pick station groups based on zone type — use MORE prop variety
  const stations: StationGroup[] = []
  if (zone === 'control') {
    stations.push(...CONSOLE_STATIONS)
    stations.push(...KEYBOARD_STATIONS)  // keyboard workstations
    stations.push(FAN_STATIONS[0])       // fan unit
  }
  if (zone === 'pod') {
    stations.push(...CONSOLE_STATIONS)
    stations.push(KEYBOARD_STATIONS[1])  // short keyboard desk
    stations.push(...LASER_STATIONS)     // laser emitter
  }
  if (zone === 'chemical') {
    stations.push(...LAB_BENCH_STATIONS)
    stations.push(...CHEM_BENCH_STATIONS)  // petri dishes, cups
    stations.push(CONSOLE_STATIONS[1])
    stations.push(TANK_ROW_STATIONS[1])
  }
  if (zone === 'machinery') {
    stations.push(CONSOLE_STATIONS[0])
    stations.push(KEYBOARD_STATIONS[0])    // keyboard workstation
    stations.push(...TANK_ROW_STATIONS) // tanks along walls
  }
  if (zone === 'pod') {
    stations.push(TANK_ROW_STATIONS[0]) // tank row in pod bay
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
      tint: station.base.tint,
    })

    // Place overlays on top of base
    for (const ov of station.overlays) {
      placements.push({
        frame: ov.frame, x: px + ov.dx, y: py + ov.dy,
        scale: ov.scale, alpha: 0.92, depth: ov.depth,
        spritesheet: 'lab-props',
        tint: ov.tint,
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

// Wall-run frames — items that look good lining walls
const WALL_RUN_FRAMES = [
  LP.CONSOLE_SCREEN,
  LP.MONITOR,
  LP.GUAGE,
  LP.DIAL,
  LP.DIAL_02,
  LP.SWITCH_UP,
  LP.SWITCH_DOWN,
  LP.GAS_VALVE_ON,
  LP.GAS_VALVE_OFF,
  LP.OCTAGONAL_PANEL,
  LP.WALL_LIGHT,
  LP.LED_ON,
  LP.LED_OFF,
  LP.GUAGE_NEEDLE,
  LP.CONSOLE_SCREEN_WAVE_05,
  LP.CONSOLE_SCREEN_LINES_04,
]

function fillWallRuns(grid: CellGrid, hash: number, placements: SpritePlacement[]): void {
  const { cols, rows } = grid
  let frameIdx = hash % WALL_RUN_FRAMES.length

  const addWallItem = (c: number, r: number, scale: number, alpha: number, depth: number) => {
    if (placements.length >= LAB_MAX_PROPS_PER_ROOM) return
    if (grid.get(c, r) !== 'floor') return
    grid.set(c, r, 'equipment')
    const pos = grid.cellToPixel(c, r)
    placements.push({
      frame: WALL_RUN_FRAMES[frameIdx % WALL_RUN_FRAMES.length],
      x: pos.x,
      y: pos.y,
      scale,
      alpha,
      depth,
      spritesheet: 'lab-props',
    })
    frameIdx++
  }

  // Fill ALL 4 inner wall edges with equipment — every cell (step=1)
  // Top wall run (row 1)
  for (let c = 1; c < cols - 1; c++) addWallItem(c, 1, 1.2, 0.90, -1.4)
  // Bottom wall run (row rows-2)
  if (rows > 4) {
    for (let c = 1; c < cols - 1; c++) addWallItem(c, rows - 2, 1.1, 0.88, -1.5)
  }
  // Left wall run (col 1)
  for (let r = 2; r < rows - 2; r++) addWallItem(1, r, 1.0, 0.85, -1.4)
  // Right wall run (col cols-2)
  if (cols > 4) {
    for (let r = 2; r < rows - 2; r++) addWallItem(cols - 2, r, 1.0, 0.85, -1.4)
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
          outerRadius: 32,
          midRadius: 18,
          coreRadius: 9,
          color: LAB_GLOW_COLOR,
          outerAlpha: 0.20,
          midAlpha: 0.45,
          coreAlpha: 0.70,
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
            outerRadius: 32, midRadius: 18, coreRadius: 9,
            color: LAB_GLOW_COLOR,
            outerAlpha: 0.20, midAlpha: 0.45, coreAlpha: 0.70,
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
