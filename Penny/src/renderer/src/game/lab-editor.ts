// ---------------------------------------------------------------------------
// lab-editor.ts
// Interactive prop placement editor for the lab tilemap.
// Toggle with 'E' key. Click palette → click world to place.
// Right-click to delete. Drag to reposition. 'S' to export JSON.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// All available prop frames from the atlas
const PROP_CATALOG = [
  // Large wall-lining
  'console_example_long', 'console_example_short', 'console_example_corner',
  'blank_console_long', 'blank_console_short', 'blank_console_corner',
  // Equipment
  'generator', 'lab_machine_01', 'large_tank', 'power_cell',
  'pod', 'broken_pod', 'dome', 'fan_unit_housing',
  'unit_example_01', 'unit_example_02', 'unit_example_03', 'unit_example_04',
  'unit_large', 'unit_small', 'unit_square',
  // Furniture
  'shelf', 'desk_top_long', 'desk_top_short', 'desk_draw', 'desk_lamp',
  'free_standing_screen', 'monitor', 'stool',
  // Science
  'microscope', 'beaker', 'conical_beaker', 'test_tube_holder',
  'petri_dish', 'small_apparatus', 'scale', 'tube',
  // Signs & floor
  'warning_biological', 'warning_power', 'warning_death', 'warning_warning', 'warning_stripes',
  'vent_slats', 'sunken_vent', 'vent', 'sunken_cell', 'sunken_nut',
  'cable_cover', 'cable_cover_with_ramp', 'cable_piece_01',
  'circular_sink', 'circular_sink_fan', 'circular_panel',
  'led_on', 'led_off', 'floor_spike_down', 'floor_spike_up',
  'puddle', 'chest_closed', 'chest_open', 'sliding_door',
  // Small controls
  'keyboard', 'computer keyboard', 'tablet', 'numb_pad',
  'console_screen', 'joystick', 'dial', 'stop_button',
  'switch_up', 'switch_down', 'gas_valve_off',
]

interface PlacedProp {
  id: number
  frame: string
  x: number
  y: number
  scale: number
  sprite: Phaser.GameObjects.Sprite
}

export class LabEditor {
  private scene: Phaser.Scene
  private active = false
  private container: Phaser.GameObjects.Container | null = null
  private paletteContainer: Phaser.GameObjects.Container | null = null
  private selectedFrame: string | null = null
  private placedProps: PlacedProp[] = []
  private nextId = 1
  private dragTarget: PlacedProp | null = null
  private cursorPreview: Phaser.GameObjects.Sprite | null = null
  private gridGraphics: Phaser.GameObjects.Graphics | null = null
  private infoText: Phaser.GameObjects.Text | null = null
  private paletteScroll = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // E key toggles editor
    scene.input.keyboard?.on('keydown-E', () => {
      if (this.active) this.deactivate()
      else this.activate()
    })

    // S key exports layout
    scene.input.keyboard?.on('keydown-S', () => {
      if (!this.active) return
      this.exportLayout()
    })
  }

  private activate(): void {
    if (this.active) return
    this.active = true

    // Container for all editor objects (world-space)
    this.container = this.scene.add.container(0, 0).setDepth(9000)

    // Grid overlay
    this.gridGraphics = this.scene.add.graphics().setDepth(8999).setAlpha(0.15)
    this.drawGrid()

    // Palette (screen-space, right side)
    this.buildPalette()

    // Info text (screen-space, top)
    this.infoText = this.scene.add.text(10, 10, 'LAB EDITOR | Click palette → click world | Right-click delete | Drag to move | S=export | E=close', {
      fontSize: scaledFontSize(12), color: '#22d3ee', fontFamily: 'monospace',
      backgroundColor: '#0f172aee', padding: { x: 8, y: 4 }, resolution: 2,
    }).setScrollFactor(0).setDepth(10000)

    // World click handler
    this.scene.input.on('pointerdown', this.onPointerDown, this)
    this.scene.input.on('pointermove', this.onPointerMove, this)
    this.scene.input.on('pointerup', this.onPointerUp, this)

    console.log('[LabEditor] Activated. Props in catalog:', PROP_CATALOG.length)
  }

  private deactivate(): void {
    if (!this.active) return
    this.active = false

    this.scene.input.off('pointerdown', this.onPointerDown, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.input.off('pointerup', this.onPointerUp, this)

    if (this.container) { this.container.destroy(); this.container = null }
    if (this.paletteContainer) { this.paletteContainer.destroy(); this.paletteContainer = null }
    if (this.gridGraphics) { this.gridGraphics.destroy(); this.gridGraphics = null }
    if (this.infoText) { this.infoText.destroy(); this.infoText = null }
    if (this.cursorPreview) { this.cursorPreview.destroy(); this.cursorPreview = null }

    // Keep placed props — they persist until scene reload
    console.log('[LabEditor] Deactivated. Placed props:', this.placedProps.length)
  }

  private drawGrid(): void {
    if (!this.gridGraphics) return
    const g = this.gridGraphics
    const cam = this.scene.cameras.main
    const CELL = 48

    // Draw grid around camera view (generous bounds)
    const startX = Math.floor((cam.scrollX - 200) / CELL) * CELL
    const startY = Math.floor((cam.scrollY - 200) / CELL) * CELL
    const endX = startX + cam.width / cam.zoom + 400
    const endY = startY + cam.height / cam.zoom + 400

    g.clear()
    g.lineStyle(1, 0x22d3ee, 0.3)
    for (let x = startX; x < endX; x += CELL) {
      g.lineBetween(x, startY, x, endY)
    }
    for (let y = startY; y < endY; y += CELL) {
      g.lineBetween(startX, y, endX, y)
    }
  }

  private buildPalette(): void {
    if (this.paletteContainer) this.paletteContainer.destroy()
    if (!this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) return

    const PALETTE_W = 180
    const THUMB_SIZE = 36
    const COLS = 4
    const PAD = 6
    const cam = this.scene.cameras.main

    this.paletteContainer = this.scene.add.container(
      cam.width - PALETTE_W - 10, 40
    ).setScrollFactor(0).setDepth(10001)

    // Background
    const bg = this.scene.add.rectangle(0, 0, PALETTE_W, cam.height - 80, 0x0f172a, 0.92)
      .setOrigin(0, 0)
    this.paletteContainer.add(bg)

    // Title
    const title = this.scene.add.text(PAD, PAD, 'PROPS', {
      fontSize: scaledFontSize(11), color: '#22d3ee', fontFamily: 'monospace', resolution: 2,
    })
    this.paletteContainer.add(title)

    // Prop thumbnails
    let col = 0, row = 0
    const startY = 24
    for (const frame of PROP_CATALOG) {
      const tx = PAD + col * (THUMB_SIZE + PAD)
      const ty = startY + row * (THUMB_SIZE + PAD) - this.paletteScroll

      if (ty > -THUMB_SIZE && ty < cam.height - 80) {
        // Thumbnail background
        const isSelected = frame === this.selectedFrame
        const thumbBg = this.scene.add.rectangle(tx, ty, THUMB_SIZE, THUMB_SIZE, isSelected ? 0x3b82f6 : 0x1e293b, isSelected ? 0.8 : 0.6)
          .setOrigin(0, 0).setInteractive({ useHandCursor: true })
        this.paletteContainer.add(thumbBg)

        // Prop sprite (fit to thumbnail)
        const spr = this.scene.add.sprite(tx + THUMB_SIZE / 2, ty + THUMB_SIZE / 2, SPRITESHEET_KEYS.LAB_PROPS, frame)
        const maxDim = Math.max(spr.width, spr.height)
        spr.setScale((THUMB_SIZE - 8) / maxDim)
        this.paletteContainer.add(spr)

        // Click handler
        thumbBg.on('pointerdown', () => {
          this.selectedFrame = frame
          this.buildPalette() // rebuild to show selection
          // Create cursor preview
          if (this.cursorPreview) this.cursorPreview.destroy()
          this.cursorPreview = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.LAB_PROPS, frame)
            .setAlpha(0.5).setDepth(9500)
          const nw = this.cursorPreview.width
          this.cursorPreview.setScale(50 / nw) // default 50px display
        })
      }

      col++
      if (col >= COLS) { col = 0; row++ }
    }

    // Scroll with mouse wheel
    bg.setInteractive()
    bg.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, _dy: number, dz: number) => {
      this.paletteScroll = Math.max(0, this.paletteScroll + dz * 0.5)
      this.buildPalette()
    })
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.active) return

    // Ignore clicks on the palette area
    const cam = this.scene.cameras.main
    if (pointer.x > cam.width - 200) return

    const wx = pointer.worldX
    const wy = pointer.worldY

    if (pointer.rightButtonDown()) {
      // Right-click = delete nearest prop within 30px
      let closest: PlacedProp | null = null
      let closestDist = 30
      for (const p of this.placedProps) {
        const d = Math.sqrt((p.x - wx) ** 2 + (p.y - wy) ** 2)
        if (d < closestDist) { closest = p; closestDist = d }
      }
      if (closest) {
        closest.sprite.destroy()
        this.placedProps = this.placedProps.filter(p => p.id !== closest!.id)
      }
      return
    }

    // Left-click: check if clicking an existing prop (for dragging)
    for (const p of this.placedProps) {
      const d = Math.sqrt((p.x - wx) ** 2 + (p.y - wy) ** 2)
      if (d < 25) {
        this.dragTarget = p
        return
      }
    }

    // Left-click on empty space with selected frame = place new prop
    if (this.selectedFrame) {
      const spr = this.scene.add.sprite(wx, wy, SPRITESHEET_KEYS.LAB_PROPS, this.selectedFrame)
      const nw = spr.width || 100
      const displaySize = 50 // default
      spr.setScale(displaySize / nw).setDepth(2)
      const prop: PlacedProp = {
        id: this.nextId++,
        frame: this.selectedFrame,
        x: wx, y: wy,
        scale: displaySize / nw,
        sprite: spr,
      }
      this.placedProps.push(prop)
      if (this.container) this.container.add(spr)
    }
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.active) return

    // Update cursor preview position
    if (this.cursorPreview && this.selectedFrame) {
      this.cursorPreview.setPosition(pointer.worldX, pointer.worldY)
    }

    // Drag
    if (this.dragTarget && pointer.isDown) {
      this.dragTarget.x = pointer.worldX
      this.dragTarget.y = pointer.worldY
      this.dragTarget.sprite.setPosition(pointer.worldX, pointer.worldY)
    }
  }

  private onPointerUp = (): void => {
    this.dragTarget = null
  }

  private exportLayout(): void {
    const data = this.placedProps.map(p => ({
      frame: p.frame,
      x: Math.round(p.x),
      y: Math.round(p.y),
      scale: Math.round(p.scale * 1000) / 1000,
    }))
    const json = JSON.stringify(data, null, 2)
    console.log('[LabEditor] Layout export:')
    console.log(json)

    // Also copy to clipboard if possible
    try {
      navigator.clipboard.writeText(json)
      console.log('[LabEditor] Copied to clipboard!')
    } catch {
      console.log('[LabEditor] (clipboard not available — use console output)')
    }

    // Flash the info text
    if (this.infoText) {
      this.infoText.setText(`EXPORTED ${data.length} props to console (and clipboard)`)
      this.scene.time.delayedCall(2000, () => {
        if (this.infoText) this.infoText.setText('LAB EDITOR | Click palette → click world | Right-click delete | Drag to move | S=export | E=close')
      })
    }
  }

  update(): void {
    if (!this.active) return
    // Refresh grid when camera moves
    this.drawGrid()
  }

  destroy(): void {
    this.deactivate()
    for (const p of this.placedProps) p.sprite.destroy()
    this.placedProps = []
  }
}
