Now I have everything I need. Here is the implementation plan:

---

## Implementation Plan — Lab Asset Pipeline (sidekick#96)

**Actual file counts (verified from disk):** Props=135, Pipes=34, Cables=61, Main=70, Smooth=47

---

### 1. Create `Penny/scripts/build-lab-props.mjs`

Copy `build-office-furniture.mjs` pattern. Key diffs:
- `SOURCE_DIR = resolve(__dirname, '../../Phaser.Resources/lab/props/PNGS')`
- `CELL = 64`, `COLS = 12`
- Sort **alphabetically** (`allFiles.sort()`) — not numerically
- Output: `public/sprites/lab-props.png` (768×768, 135 frames, last 9 cells empty)
- Log message: `Building lab-props.png...`

### 2. Create `Penny/scripts/build-lab-pipes.mjs`

- `SOURCE_DIR = resolve(__dirname, '../../Phaser.Resources/lab/pipe_tileset/PNGS')`
- `CELL = 48`, `COLS = 7`
- Alphabetical sort
- Output: `public/sprites/lab-pipes.png` (336×240, 34 frames)

### 3. Create `Penny/scripts/build-lab-cables.mjs`

- `SOURCE_DIR = resolve(__dirname, '../../Phaser.Resources/lab/cable_tiles/PNGS')`
- `CELL = 32`, `COLS = 8`
- Alphabetical sort
- Output: `public/sprites/lab-cables.png` (256×256, 61 frames, last 3 cells empty)

### 4. Create `Penny/scripts/build-lab-floor.mjs`

- `SOURCE_DIR = resolve(__dirname, '../../Phaser.Resources/lab/main_tileset/PNGS')`
- `CELL = 48`, `COLS = 10`
- Alphabetical sort
- Output: `public/sprites/lab-floor.png` (480×336, 70 frames)

### 5. Create `Penny/scripts/build-lab-panels.mjs`

- `SOURCE_DIR = resolve(__dirname, '../../Phaser.Resources/lab/smooth_tileset/separated_pngs')`
- `CELL = 48`, `COLS = 8`
- Alphabetical sort
- Output: `public/sprites/lab-panels.png` (384×288, 47 frames, last 1 cell empty)

---

### 6. Edit `Penny/scripts/build-all-sprites.mjs`

Add to `SCRIPTS` array after `'build-medals-hd.mjs'`:
```js
// Lab asset pack
'build-lab-props.mjs',
'build-lab-pipes.mjs',
'build-lab-cables.mjs',
'build-lab-floor.mjs',
'build-lab-panels.mjs',
```

---

### 7. Edit `Penny/src/renderer/src/game/office-asset-keys.ts`

**A. Add to `SPRITESHEET_KEYS`** (after `MEDALS_HD`):
```ts
/** Lab props — 64x64 cells, 12 cols, 135 frames (alphabetical) */
LAB_PROPS: 'lab-props',
/** Lab pipe tileset — 48x48 cells, 7 cols, 34 frames (alphabetical) */
LAB_PIPES: 'lab-pipes',
/** Lab cable tiles — 32x32 cells, 8 cols, 61 frames (alphabetical) */
LAB_CABLES: 'lab-cables',
/** Lab main floor tileset — 48x48 cells, 10 cols, 70 frames (alphabetical) */
LAB_FLOOR: 'lab-floor',
/** Lab smooth panel tileset — 48x48 cells, 8 cols, 47 frames (alphabetical) */
LAB_PANELS: 'lab-panels',
```

**B. Add `LAB_PROP_FRAMES`** (new export, after `MEDAL_HD_FRAMES`). All indices based on **alphabetical sort** of `props/PNGS/`:
```ts
export const LAB_PROP_FRAMES = Object.freeze({
  BEAKER:               0,   // beaker.png
  CONSOLE_CORNER:       1,   // blank_console_corner.png
  CONSOLE_LONG:         2,   // blank_console_long.png
  CONSOLE_SHORT:        3,   // blank_console_short.png
  BROKEN_POD:           9,   // broken_pod.png
  CHEST_CLOSED:        15,   // chest_closed.png
  CHEST_OPEN:          16,   // chest_open.png
  CIRCULAR_PANEL:      17,   // circular_panel.png
  CONICAL_BEAKER:      27,   // conical_beaker.png
  DESK_LAMP:           49,   // desk_lamp.png
  DESK_TOP_LONG:       50,   // desk_top_long.png
  DESK_TOP_SHORT:      51,   // desk_top_short.png
  DOME:                54,   // dome.png
  FAN_UNIT_FAN:        55,   // fan_unit_fan.png
  FAN_UNIT_HOUSING:    56,   // fan_unit_housing.png
  FREE_STANDING_SCREEN:59,   // free_standing_screen.png
  GAS_VALVE_OFF:       60,   // gas_valve_off.png
  GAS_VALVE_ON:        61,   // gas_valve_on.png
  GENERATOR:           62,   // generator.png
  JOYSTICK:            65,   // joystick.png
  KEYBOARD:            66,   // keyboard.png
  LAB_MACHINE_01:      67,   // lab_machine_01.png
  LARGE_TANK:          69,   // large_tank.png
  LASER_BEAM:          70,   // laser_beam.png
  // Animation source frames (CONSOLE_WAVE: 39-44, CONSOLE_LINES: 33-38, LASER_EFFECT: 71-74)
  CONSOLE_LINES_01:    33,   // console_screen_lines_01.png
  CONSOLE_LINES_06:    38,   // console_screen_lines_06.png
  CONSOLE_WAVE_01:     39,   // console_screen_wave_01.png
  CONSOLE_WAVE_06:     44,   // console_screen_wave_06.png
  LASER_EFFECT_01:     71,   // laser_end_start_end_effect_01.png
  LASER_EFFECT_04:     74,   // laser_end_start_end_effect_04.png
  LASER_HEAD:          75,   // laser_head.png
  LASER_OUTLET:        76,   // laser_outlet.png
  LED_OFF:             77,   // led_off.png
  LED_ON:              78,   // led_on.png
  MICROSCOPE:          79,   // microscope.png
  MONITOR:             80,   // monitor.png
  OCTAGONAL_PANEL:     84,   // octagonal_panel.png
  PAPER_SHEET:         88,   // paper_sheet.png
  PENCIL:              89,   // pencil.png
  PETRI_DISH:          90,   // petri_dish.png
  POD:                 96,   // pod.png
  POWER_CELL:          97,   // power_cell.png
  RECTANGLE_PANEL:     99,   // rectangle_panel.png
  SCALE:              100,   // scale.png
  SHELF:              101,   // shelf.png
  SLIDING_DOOR:       102,   // sliding_door.png
  SMALL_APPARATUS:    103,   // small_apparatus.png
  STOOL:              109,   // stool.png
  STOP_BUTTON:        111,   // stop_button.png
  SWITCH_DOWN:        115,   // switch_down.png
  SWITCH_UP:          116,   // switch_up.png
  TABLET:             117,   // tablet.png
  TEST_TUBE_HOLDER:   118,   // test_tube_holder.png
  VENT:               128,   // vent.png
  VENT_SLATS:         127,   // vent_slats.png
  WARNING_BIOLOGICAL: 130,   // warning_biological.png
  WARNING_DEATH:      131,   // warning_death.png
  WARNING_POWER:      132,   // warning_power.png
  WARNING_WARNING:    134,   // warning_warning.png
} as const)
```

**C. Add `LAB_PIPE_FRAMES`** (alphabetical sort of `pipe_tileset/PNGS/`):
```ts
export const LAB_PIPE_FRAMES = Object.freeze({
  BROKEN_H_LEFT:    0,   // broken_horizontal_left.png
  BROKEN_H_RIGHT:   1,   // broken_horizontal_right.png
  BROKEN_V_BOTTOM:  2,   // broken_vertical_bottom.png
  BROKEN_V_TOP:     3,   // broken_vertical_top.png
  CAP_LEFT:         4,   // cap_horizontal_left.png
  CAP_RIGHT:        5,   // cap_horizontal_right.png
  CAP_BOTTOM:       6,   // cap_vertical_bottom.png
  CAP_TOP:          7,   // cap_vertical_top.png
  CROSS:            8,   // cross.png
  HORIZONTAL:      10,   // horizontal.png
  CORNER_BL:       11,   // outer_bottom_left.png
  CORNER_BR:       12,   // outer_bottom_right.png
  CORNER_TL:       14,   // outer_top_left.png
  CORNER_TR:       15,   // outer_top_right.png
  T_BOTTOM:        22,   // t_connector_bottom.png
  T_LEFT:          23,   // t_connector_left.png
  T_RIGHT:         24,   // t_connector_right.png
  T_TOP:           25,   // t_connector_top.png
  VALVE:           26,   // valve.png
  VERTICAL:        29,   // vertical.png
  WALL_H_LEFT:     30,   // wall_connection_horizontal_left.png
  WALL_H_RIGHT:    31,   // wall_connection_horizontal_right.png
  WALL_V_BOTTOM:   32,   // wall_connection_vertical_bottom.png
  WALL_V_TOP:      33,   // wall_connection_vertical_top.png
} as const)
```

**D. Add `LAB_CABLE_FRAMES`** (alphabetical sort of `cable_tiles/PNGS/`, 61 files):
```ts
export const LAB_CABLE_FRAMES = Object.freeze({
  ADJACENTS_LEFT:         0,
  ADJACENTS_RIGHT:        1,
  FOUR_CORNERS:          18,
  HORIZONTAL_CENTER:     19,
  HORIZONTAL_LEFT:       20,
  INNER_CORNER_BL:       25,
  INNER_CORNER_BR:       26,
  INNER_CORNER_TL:       27,
  INNER_CORNER_TR:       28,
  LOOP_BOTTOM:           29,
  LOOP_LEFT:             30,
  LOOP_RIGHT:            31,
  LOOP_TOP:              32,
  OUTER_BOTTOM_LEFT:     33,
  OUTER_BOTTOM_RIGHT:    34,
  OUTER_BOTTOM:          35,
  OUTER_LEFT:            36,
  OUTER_RIGHT:           37,
  OUTER_TOP_LEFT:        46,
  OUTER_TOP_RIGHT:       47,
  OUTER_TOP:             48,
  VERTICAL_BOTTOM:       53,
  VERTICAL_CENTER:       54,
  VERTICAL_TOP:          60,
} as const)
```

**E. Add `LAB_FLOOR_FRAMES`** (alphabetical sort of `main_tileset/PNGS/`, 70 files):
```ts
export const LAB_FLOOR_FRAMES = Object.freeze({
  FILL:                    13,   // fill.png
  FILL_02:                 12,   // fill_02.png
  FOUR_WAY_NO_OUTSIDE:     28,   // four_way_no_outside.png
  OUTER_FILL:              35,   // outer_fill.png
  OUTER_NO_OUTSIDE_BOTTOM: 38,
  OUTER_NO_OUTSIDE_LEFT:   39,
  OUTER_NO_OUTSIDE_RIGHT:  40,
  OUTER_NO_OUTSIDE_TOP:    43,
  SINGLE:                  53,   // single.png
} as const)
```

**F. Add `LAB_PANEL_FRAMES`** (alphabetical sort of `smooth_tileset/separated_pngs/`, 47 files):
```ts
export const LAB_PANEL_FRAMES = Object.freeze({
  ADJACENT_TL:     0,   // adjacent_top_left.png
  ADJACENT_TR:     1,   // adjacent_top_right.png
  FILL:            2,   // fill.png
  INNER_BL:        3,
  INNER_BR:        4,
  INNER_TL:        5,
  INNER_TR:        6,
  OUTER_EDGE_BL:   7,
  OUTER_EDGE_BR:   8,
  OUTER_EDGE_BOT:  9,
  OUTER_EDGE_LEFT: 10,
  OUTER_EDGE_RIGHT:11,
  OUTER_EDGE_TL:   12,
  OUTER_EDGE_TR:   13,
  OUTER_EDGE_TOP:  14,
  SINGLE:          38,  // single.png
} as const)
```

**G. Add `LAB_ANIM_KEYS`** (after `EFFECT_ANIM_KEYS`):
```ts
export const LAB_ANIM_KEYS = Object.freeze({
  CONSOLE_WAVE:  'lab-console-wave',
  CONSOLE_LINES: 'lab-console-lines',
  LASER_EFFECT:  'lab-laser-effect',
} as const)
```

---

### 8. Edit `Penny/src/renderer/src/game/boot-scene.ts`

**A. Import new keys** — add to the existing destructured import from `./office-asset-keys`:
```ts
LAB_ANIM_KEYS, LAB_PROP_FRAMES,
```

**B. Add display names** — add inside `assetDisplayNames` map (after the Wave 7 entries):
```ts
// Lab asset pack
[SPRITESHEET_KEYS.LAB_PROPS]:   'Lab Props',
[SPRITESHEET_KEYS.LAB_PIPES]:   'Lab Pipes',
[SPRITESHEET_KEYS.LAB_CABLES]:  'Lab Cables',
[SPRITESHEET_KEYS.LAB_FLOOR]:   'Lab Floor',
[SPRITESHEET_KEYS.LAB_PANELS]:  'Lab Panels',
```

**C. Add to `sheetPreviewKeys`** — add `SPRITESHEET_KEYS.LAB_PROPS` to the preview set.

**D. Load spritesheets** — add after the `MEDALS_HD` load call:
```ts
// --- Lab Asset Pack ---
this.load.spritesheet(SPRITESHEET_KEYS.LAB_PROPS, './sprites/lab-props.png', {
  frameWidth: 64, frameHeight: 64,
})
this.load.spritesheet(SPRITESHEET_KEYS.LAB_PIPES, './sprites/lab-pipes.png', {
  frameWidth: 48, frameHeight: 48,
})
this.load.spritesheet(SPRITESHEET_KEYS.LAB_CABLES, './sprites/lab-cables.png', {
  frameWidth: 32, frameHeight: 32,
})
this.load.spritesheet(SPRITESHEET_KEYS.LAB_FLOOR, './sprites/lab-floor.png', {
  frameWidth: 48, frameHeight: 48,
})
this.load.spritesheet(SPRITESHEET_KEYS.LAB_PANELS, './sprites/lab-panels.png', {
  frameWidth: 48, frameHeight: 48,
})
```

**E. Register animations** — add inside `onCreate()` after the animal pet anims block:
```ts
// Lab animated sequences
if (this.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) {
  if (!this.anims.exists(LAB_ANIM_KEYS.CONSOLE_WAVE)) {
    this.anims.create({
      key: LAB_ANIM_KEYS.CONSOLE_WAVE,
      frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.LAB_PROPS, {
        start: LAB_PROP_FRAMES.CONSOLE_WAVE_01, end: LAB_PROP_FRAMES.CONSOLE_WAVE_06,
      }),
      frameRate: 8, repeat: -1,
    })
  }
  if (!this.anims.exists(LAB_ANIM_KEYS.CONSOLE_LINES)) {
    this.anims.create({
      key: LAB_ANIM_KEYS.CONSOLE_LINES,
      frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.LAB_PROPS, {
        start: LAB_PROP_FRAMES.CONSOLE_LINES_01, end: LAB_PROP_FRAMES.CONSOLE_LINES_06,
      }),
      frameRate: 8, repeat: -1,
    })
  }
  if (!this.anims.exists(LAB_ANIM_KEYS.LASER_EFFECT)) {
    this.anims.create({
      key: LAB_ANIM_KEYS.LASER_EFFECT,
      frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.LAB_PROPS, {
        start: LAB_PROP_FRAMES.LASER_EFFECT_01, end: LAB_PROP_FRAMES.LASER_EFFECT_04,
      }),
      frameRate: 12, repeat: 0,
    })
  }
}
```

---

### Notes for executor

- **Frame index discrepancy**: The issue states 115/58/62/39 files but actual counts are 135/61/70/47. All grid math above uses the real counts.
- **Alphabetical sort is critical**: Scripts must use `allFiles.sort()` (lexicographic), not numeric — the frame constants above depend on this exact order.
- **`computer keyboard.png`** has a space — `sharp` will handle it fine via the resolved path; no special treatment needed.
- **`build-lab-props.mjs` note**: One prop filename has a space (`computer keyboard.png`). Ensure `resolve(SOURCE_DIR, filename)` is used (not string concatenation).
- All 5 build scripts are structurally identical to `build-office-furniture.mjs` with the 4 changed variables: `SOURCE_DIR`, `CELL`, `COLS`, output filename.