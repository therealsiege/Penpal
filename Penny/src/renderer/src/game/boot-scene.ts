import { BaseScene } from './base-scene'
import { activeTheme } from './office-theme'
import {
  SCENE_KEYS, SPRITESHEET_KEYS, ANIM_KEYS, IMAGE_KEYS, AUDIO_KEYS,
  EFFECT_ANIM_KEYS, ANIMAL_IDLE_FRAMES, ANIMAL_SPECIES,
  LAB_ANIM_KEYS, LAB_PROP_FRAMES,
} from './office-asset-keys'
import { CHAR_FRAME_W, CHAR_FRAME_H, OFFICE_TILE_SIZE, ROOM_TILE_SIZE, LAB_TILE_SIZE } from './office-constants'

// ---------------------------------------------------------------------------
// BootScene — shared asset preloader
// ---------------------------------------------------------------------------
// Loads all spritesheets, images, and audio before any gameplay scene starts.
// Registers global animations (VFX, animal pets) so they are available to
// every scene via the shared Phaser AnimationManager.
// On completion, starts OfficeScene which in turn launches UIScene.
// ---------------------------------------------------------------------------

export class BootScene extends BaseScene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  // -------------------------------------------------------------------------
  // Preload — loading screen + all asset loads
  // -------------------------------------------------------------------------

  onPreload(): void {
    const { width: camW, height: camH } = this.cameras.main

    // Full-screen dark backdrop
    const loadBg = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x080a0e).setDepth(20000)

    // Title text
    const loadTitle = this.add.text(camW / 2, camH / 2 - 60, 'LOADING OFFICE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#5a7a6a', resolution: 2,
    }).setOrigin(0.5).setDepth(20001)

    // Progress bar track + fill
    const barW = 220, barH = 6
    const barX = camW / 2 - barW / 2
    const barY = camH / 2 - 20
    const trackBg = this.add.rectangle(camW / 2, barY, barW, barH, activeTheme.roomFloor).setDepth(20001)
    const barFill = this.add.rectangle(barX, barY, 0, barH, 0x00ff88).setOrigin(0, 0.5).setDepth(20002)

    // Glow edge on progress bar fill
    const barGlow = this.add.rectangle(barX, barY, 0, barH + 4, 0x00ff88).setOrigin(0, 0.5).setDepth(20001).setAlpha(0.15)

    // Asset counter text: "0 / N assets"
    const totalAssets = Object.keys(SPRITESHEET_KEYS).length + Object.keys(ANIM_KEYS).length + Object.keys(IMAGE_KEYS).length
    let loadedCount = 0
    const counterText = this.add.text(camW / 2, barY + 20, `0 / ${totalAssets} assets`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#3a4858', resolution: 2,
    }).setOrigin(0.5).setDepth(20001)

    // Current asset name
    const assetText = this.add.text(camW / 2, barY + 38, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#2a3440', resolution: 2,
    }).setOrigin(0.5).setDepth(20001)

    // Sprite preview area — show small thumbnails of loaded spritesheets
    const previewY = barY + 70
    const previewSlots: Phaser.GameObjects.Sprite[] = []
    const previewLabels: Phaser.GameObjects.Text[] = []

    // Animated dots on title
    let dots = 0
    const dotTimer = this.time.addEvent({
      delay: 400, loop: true,
      callback: () => { dots = (dots + 1) % 4; loadTitle.setText('LOADING OFFICE' + '.'.repeat(dots)) },
    })

    // Subtle scanning line effect
    const scanLine = this.add.rectangle(camW / 2, 0, camW, 2, 0x00ff88).setAlpha(0.06).setDepth(20001)
    this.tweens.add({
      targets: scanLine, y: camH, duration: 2000, repeat: -1,
      ease: 'Linear',
    })

    // Friendly display names for each asset key
    const assetDisplayNames: Record<string, string> = {
      [SPRITESHEET_KEYS.CHARACTERS]: 'Characters',
      [SPRITESHEET_KEYS.OFFICE]: 'Lab Tiles',
      [SPRITESHEET_KEYS.ROOMS]: 'Room Tiles',
      [SPRITESHEET_KEYS.DUDER_1]: 'Duder A',
      [SPRITESHEET_KEYS.DUDER_2]: 'Duder B',
      [SPRITESHEET_KEYS.GAME_ICONS]: 'Game Icons',
      [SPRITESHEET_KEYS.GAME_ITEMS]: 'Game Items',
      [SPRITESHEET_KEYS.EFFECTS_FLASH]: 'VFX Flash',
      [SPRITESHEET_KEYS.EFFECTS_PUFF]: 'VFX Puff',
      [SPRITESHEET_KEYS.EFFECTS_EXPLOSION]: 'VFX Explosion',
      [SPRITESHEET_KEYS.EFFECTS_SMOKE]: 'VFX Smoke',
      [SPRITESHEET_KEYS.EFFECTS_FART]: 'VFX Fart',
      [SPRITESHEET_KEYS.LEGO_BAR]: 'XP Bars',
      [SPRITESHEET_KEYS.DESK_PETS]: 'Desk Pets',
      [ANIM_KEYS.WALK_1]: 'Walk Anim A',
      [ANIM_KEYS.WALK_2]: 'Walk Anim B',
      [ANIM_KEYS.IDLE_1]: 'Idle Anim A',
      [ANIM_KEYS.IDLE_2]: 'Idle Anim B',
      [ANIM_KEYS.SIT_1]: 'Sit Anim A',
      [ANIM_KEYS.SIT_2]: 'Sit Anim B',
      [IMAGE_KEYS.SLIDER_TRACK]: 'Slider Track',
      [IMAGE_KEYS.SLIDER_FILL]: 'Slider Fill',
      [IMAGE_KEYS.DIVIDER]: 'Divider',
      // Wave 7 assets
      [SPRITESHEET_KEYS.ANIMAL_PETS]: 'Animal Pets',
      [SPRITESHEET_KEYS.ANIMAL_PETS_BLINK]: 'Pet Blink',
      [SPRITESHEET_KEYS.ANIMAL_PETS_HURT]: 'Pet Hurt',
      [SPRITESHEET_KEYS.OFFICE_FURNITURE]: 'Furniture',
      [SPRITESHEET_KEYS.KENNEY_UI]: 'Kenney UI',
      [SPRITESHEET_KEYS.MONSTER_BODIES]: 'Monster Bodies',
      [SPRITESHEET_KEYS.MEDALS_HD]: 'HD Medals',
      [SPRITESHEET_KEYS.LAB_PROPS]: 'Lab Props',
      [AUDIO_KEYS.CLICK_A]: 'SFX Click',
      [AUDIO_KEYS.TAP_A]: 'SFX Tap',
      // Wave 8
      [SPRITESHEET_KEYS.LAB_MAIN_TILESET]: 'Lab Tileset',
      [SPRITESHEET_KEYS.LAB_SMOOTH]: 'Lab Smooth',
    }

    // Spritesheets worth showing a thumbnail preview for
    const loadedSheetKeys: string[] = []
    const sheetPreviewKeys = new Set<string>([
      SPRITESHEET_KEYS.CHARACTERS, SPRITESHEET_KEYS.OFFICE, SPRITESHEET_KEYS.ROOMS,
      SPRITESHEET_KEYS.DUDER_1, SPRITESHEET_KEYS.DUDER_2,
      SPRITESHEET_KEYS.GAME_ICONS, SPRITESHEET_KEYS.GAME_ITEMS, SPRITESHEET_KEYS.DESK_PETS,
      SPRITESHEET_KEYS.ANIMAL_PETS, SPRITESHEET_KEYS.OFFICE_FURNITURE, SPRITESHEET_KEYS.MEDALS_HD,
    ])

    // Progress handler — fill bar
    this.load.on('progress', (value: number) => {
      barFill.width = barW * value
      barGlow.width = barW * value
    })

    // File complete handler — update counter, asset name, and sprite preview
    this.load.on('filecomplete', (key: string) => {
      loadedCount++
      counterText.setText(`${loadedCount} / ${totalAssets} assets`)
      const displayName = assetDisplayNames[key] || key
      assetText.setText(displayName)

      // Show sprite preview for interesting spritesheets
      if (sheetPreviewKeys.has(key) && this.textures.exists(key)) {
        loadedSheetKeys.push(key)
        // Clear old previews
        previewSlots.forEach(s => s.destroy())
        previewLabels.forEach(l => l.destroy())
        previewSlots.length = 0
        previewLabels.length = 0

        // Show last 5 loaded spritesheets as small thumbnails
        const show = loadedSheetKeys.slice(-5)
        const slotW = 40
        const totalW = show.length * slotW
        const startX = camW / 2 - totalW / 2 + slotW / 2

        show.forEach((sheetKey, i) => {
          const sx = startX + i * slotW
          const sprite = this.add.sprite(sx, previewY, sheetKey, 0).setDepth(20002)
          // Scale to fit ~32px box
          const maxDim = Math.max(sprite.width, sprite.height)
          sprite.setScale(32 / maxDim)
          sprite.setAlpha(0)
          this.tweens.add({ targets: sprite, alpha: 0.7, duration: 200 })
          previewSlots.push(sprite)

          const label = this.add.text(sx, previewY + 22, assetDisplayNames[sheetKey] || sheetKey, {
            fontSize: '7px', fontFamily: 'monospace', color: '#2a3440', resolution: 2,
          }).setOrigin(0.5).setDepth(20001).setAlpha(0)
          this.tweens.add({ targets: label, alpha: 0.6, duration: 200 })
          previewLabels.push(label)
        })
      }
    })

    // Complete handler — show READY! then fade out and start OfficeScene
    this.load.on('complete', () => {
      dotTimer.destroy()
      scanLine.destroy()

      // Show READY! text
      loadTitle.setText('READY!')
      loadTitle.setColor('#00ff88')
      counterText.setText(`${totalAssets} / ${totalAssets} assets`)
      assetText.setText('')

      // Brief pause then fade out everything, then start OfficeScene
      this.time.delayedCall(400, () => {
        const allObjects: Phaser.GameObjects.GameObject[] = [
          loadBg, loadTitle, trackBg, barFill, barGlow, counterText, assetText,
          ...previewSlots, ...previewLabels,
        ]
        this.tweens.add({
          targets: allObjects,
          alpha: 0,
          duration: 350,
          ease: 'Power2',
          onComplete: () => {
            allObjects.forEach(obj => obj.destroy())
            this.scene.start(SCENE_KEYS.OFFICE)
          },
        })
      })
    })

    // -----------------------------------------------------------------------
    // Asset loading
    // -----------------------------------------------------------------------
    this.load.spritesheet(SPRITESHEET_KEYS.CHARACTERS, './sprites/characters.png', {
      frameWidth:  CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.OFFICE, './sprites/office-tiles.png', {
      frameWidth:  OFFICE_TILE_SIZE,
      frameHeight: OFFICE_TILE_SIZE,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.ROOMS, './sprites/room-tiles.png', {
      frameWidth:  ROOM_TILE_SIZE,
      frameHeight: ROOM_TILE_SIZE,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.DUDER_1, './sprites/duder-compact.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.DUDER_2, './sprites/duder-compact-2.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    // Individual animation strips (_256 PNGs, 256x512 per frame — same as main spritesheet)
    // Walk: 3072x512 = 12 frames (step-A: 8 rotations + step-B: 4 rotations)
    // Idle: 1024x512 = 4 frames (4 rotations)
    // Sit:  1024x512 = 4 frames (4 rotations)
    const ANIM_FW = 256, ANIM_FH = 512
    this.load.spritesheet(ANIM_KEYS.WALK_1, './sprites/walk-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.WALK_2, './sprites/walk-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.IDLE_1, './sprites/idle-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.IDLE_2, './sprites/idle-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.SIT_1,  './sprites/sit-1.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.SIT_2,  './sprites/sit-2.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })

    // Game icon spritesheet (stars, medals, checkmarks — 32x32 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ICONS, './sprites/game-icons.png', {
      frameWidth: 32, frameHeight: 32,
    })

    // HD game icons — 64x64 cells, frames 0-19 (double-size for LOD3 detail)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ICONS_HD, './sprites/game-icons-hd.png', {
      frameWidth: 64, frameHeight: 64,
    })

    // Game items spritesheet (desk props, cafe items — 32x32 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ITEMS, './sprites/game-items.png', {
      frameWidth: 32, frameHeight: 32,
    })

    // VFX spritesheets (128x128 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.EFFECTS_FLASH, './sprites/game-effects-flash.png', {
      frameWidth: 128, frameHeight: 128,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.EFFECTS_PUFF, './sprites/game-effects-puff.png', {
      frameWidth: 128, frameHeight: 128,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.EFFECTS_EXPLOSION, './sprites/game-effects-explosion.png', {
      frameWidth: 128, frameHeight: 128,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.EFFECTS_SMOKE, './sprites/game-effects-smoke.png', {
      frameWidth: 128, frameHeight: 128,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.EFFECTS_FART, './sprites/game-effects-fart.png', {
      frameWidth: 128, frameHeight: 128,
    })

    // Lego brick XP bar segments
    this.load.spritesheet(SPRITESHEET_KEYS.LEGO_BAR, './sprites/lego-bar.png', {
      frameWidth: 16, frameHeight: 8,
    })

    // Desk pet bodies (24x24 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.DESK_PETS, './sprites/desk-pets.png', {
      frameWidth: 24, frameHeight: 24,
    })

    // Desk pet face parts — eyes and mouths (16x8 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.DESK_PET_FACES, './sprites/desk-pet-faces.png', {
      frameWidth: 16, frameHeight: 8,
    })

    // Lego special items (24x24 cells) — coin, exclamation, crate, explosive, grade A
    this.load.spritesheet(SPRITESHEET_KEYS.LEGO_SPECIALS, './sprites/lego-specials.png', {
      frameWidth: 24, frameHeight: 24,
    })

    // Slider sprites for season HUD progress bar
    this.load.image(IMAGE_KEYS.SLIDER_TRACK, './sprites/slider-track.png')
    this.load.image(IMAGE_KEYS.SLIDER_FILL, './sprites/slider-fill.png')

    // Vertical slider sprites for workstation energy bars
    this.load.image(IMAGE_KEYS.VSLIDER_TRACK, './sprites/vslider-track.png')
    this.load.image(IMAGE_KEYS.VSLIDER_FILL, './sprites/vslider-fill.png')

    // Divider sprite for panel section dividers
    this.load.image(IMAGE_KEYS.DIVIDER, './sprites/divider.png')

    // UI panel sprites — thought bubble bg, monitor frame, HUD button
    this.load.image(IMAGE_KEYS.PANEL_BG, './sprites/panel-bg.png')
    this.load.image(IMAGE_KEYS.PANEL_OUTLINE, './sprites/panel-outline.png')
    this.load.image(IMAGE_KEYS.BUTTON_SQUARE, './sprites/button-square.png')

    // Terrain prop sprites — Lego-style 64x64 crates, stones, etc.
    this.load.image(IMAGE_KEYS.TERRAIN_CRATE, './sprites/terrain-crate.png')
    this.load.image(IMAGE_KEYS.TERRAIN_CRATE_HAZARD, './sprites/terrain-crate-hazard.png')
    this.load.image(IMAGE_KEYS.TERRAIN_STONE, './sprites/terrain-stone.png')
    this.load.image(IMAGE_KEYS.TERRAIN_DIRT, './sprites/terrain-dirt.png')
    this.load.image(IMAGE_KEYS.TERRAIN_BOX_COIN, './sprites/terrain-box-coin.png')

    // --- Wave 7: Asset Upgrade ---

    // Animated animal desk pets — 5 species x 12 idle frames, 64x64 cells
    this.load.spritesheet(SPRITESHEET_KEYS.ANIMAL_PETS, './sprites/animal-pets.png', {
      frameWidth: 64, frameHeight: 64,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.ANIMAL_PETS_BLINK, './sprites/animal-pets-blink.png', {
      frameWidth: 64, frameHeight: 64,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.ANIMAL_PETS_HURT, './sprites/animal-pets-hurt.png', {
      frameWidth: 64, frameHeight: 64,
    })

    // Modern Office furniture tiles — 48x48 cells, 20 columns
    this.load.spritesheet(SPRITESHEET_KEYS.OFFICE_FURNITURE, './sprites/office-furniture.png', {
      frameWidth: 48, frameHeight: 48,
    })

    // Kenney UI elements (Blue theme) — 32x32 cells
    this.load.spritesheet(SPRITESHEET_KEYS.KENNEY_UI, './sprites/kenney-ui.png', {
      frameWidth: 32, frameHeight: 32,
    })

    // Composable monster parts
    this.load.spritesheet(SPRITESHEET_KEYS.MONSTER_BODIES, './sprites/monster-bodies.png', {
      frameWidth: 32, frameHeight: 32,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.MONSTER_EYES, './sprites/monster-eyes.png', {
      frameWidth: 16, frameHeight: 8,
    })
    this.load.spritesheet(SPRITESHEET_KEYS.MONSTER_MOUTHS, './sprites/monster-mouths.png', {
      frameWidth: 16, frameHeight: 8,
    })

    // HD medals spritesheet — individual medal sprites at 43x82 cells
    this.load.spritesheet(SPRITESHEET_KEYS.MEDALS_HD, './sprites/medals-hd.png', {
      frameWidth: 43, frameHeight: 82,
    })

    // Lab props atlas — variable-size sprites from GDS editor (135 named frames)
    this.load.atlas(SPRITESHEET_KEYS.LAB_PROPS, './sprites/lab-props-atlas.png', './sprites/lab-props-atlas.json')

    // Lab pipes — 128x128 cells, 7 cols × 5 rows (pipe runs, connectors, valves)
    this.load.spritesheet(SPRITESHEET_KEYS.LAB_PIPES, './sprites/lab-pipes.png', {
      frameWidth: 128, frameHeight: 128,
    })

    // Lab cables — 128x128 cells, 7 cols × 9 rows (cable routing, connectors, plugs)
    this.load.spritesheet(SPRITESHEET_KEYS.LAB_CABLES, './sprites/lab-cables.png', {
      frameWidth: 128, frameHeight: 128,
    })

    // Lab main tileset — 128x128 cells, 8 cols × 9 rows (hex floors, wall edges, transitions)
    this.load.spritesheet(SPRITESHEET_KEYS.LAB_MAIN_TILESET, './sprites/lab-main-tileset.png', {
      frameWidth: 128, frameHeight: 128,
    })

    // Lab smooth corners — 48x48 cells, 8 cols × 1 row (corner/edge transition pieces)
    this.load.spritesheet(SPRITESHEET_KEYS.LAB_SMOOTH, './sprites/lab-smooth.png', {
      frameWidth: 48, frameHeight: 48,
    })

    // ── Lab tile pack — individual PNGs ──────────────────────────────────────
    const labWalls: [string, string][] = [
      ['lab-floor-a', 'floor-a'], ['lab-floor-b', 'floor-b'],
      ['lab-outer-fill', 'outer-fill'], ['lab-outside-fill', 'outside-fill'],
      ['lab-corner-tl', 'corner-tl'], ['lab-corner-tr', 'corner-tr'],
      ['lab-corner-bl', 'corner-bl'], ['lab-corner-br', 'corner-br'],
      ['lab-wall-top', 'wall-top'], ['lab-wall-bottom', 'wall-bottom'],
      ['lab-wall-left', 'wall-left'], ['lab-wall-right', 'wall-right'],
      ['lab-inner-tl', 'inner-tl'], ['lab-inner-tr', 'inner-tr'],
      ['lab-inner-bl', 'inner-bl'], ['lab-inner-br', 'inner-br'],
      ['lab-t-top', 't-top'], ['lab-t-bottom', 't-bottom'],
      ['lab-t-left', 't-left'], ['lab-t-right', 't-right'],
      ['lab-four-way', 'four-way'], ['lab-single', 'single'],
    ]
    for (const [key, file] of labWalls) this.load.image(key, `./assets/lab/walls/${file}.png`)

    const labPipes: [string, string][] = [
      ['lab-pipe-h', 'pipe-h'], ['lab-pipe-h2', 'pipe-h2'], ['lab-pipe-v', 'pipe-v'],
      ['lab-pipe-cross', 'pipe-cross'],
      ['lab-pipe-cap-top', 'pipe-cap-top'], ['lab-pipe-cap-bottom', 'pipe-cap-bottom'],
      ['lab-pipe-cap-left', 'pipe-cap-left'], ['lab-pipe-cap-right', 'pipe-cap-right'],
      ['lab-pipe-valve', 'pipe-valve'],
      ['lab-pipe-corner-tl', 'pipe-corner-tl'], ['lab-pipe-corner-tr', 'pipe-corner-tr'],
      ['lab-pipe-corner-bl', 'pipe-corner-bl'], ['lab-pipe-corner-br', 'pipe-corner-br'],
    ]
    for (const [key, file] of labPipes) this.load.image(key, `./assets/lab/pipes/${file}.png`)

    const labProps: [string, string][] = [
      ['lab-prop-console-long', 'console_example_long'],
      ['lab-prop-console-short', 'console_example_short'],
      ['lab-prop-console-corner', 'console_example_corner'],
      ['lab-prop-pod', 'pod'], ['lab-prop-generator', 'generator'],
      ['lab-prop-tank', 'large_tank'], ['lab-prop-microscope', 'microscope'],
      ['lab-prop-beaker', 'beaker'], ['lab-prop-monitor', 'monitor'],
      ['lab-prop-keyboard', 'keyboard'], ['lab-prop-stool', 'stool'],
      ['lab-prop-laser-head', 'laser_head'], ['lab-prop-warning', 'warning_stripes'],
      ['lab-prop-vent', 'vent'], ['lab-prop-shelf', 'shelf'],
      ['lab-prop-led-on', 'led_on'], ['lab-prop-led-off', 'led_off'],
      ['lab-prop-sliding-door', 'sliding_door'], ['lab-prop-desk-lamp', 'desk_lamp'],
      ['lab-prop-dome', 'dome'], ['lab-prop-sink', 'circular_sink'],
      ['lab-prop-petri-dish', 'petri_dish'], ['lab-prop-test-tubes', 'test_tube_holder'],
      ['lab-prop-screen', 'free_standing_screen'], ['lab-prop-wall-light', 'wall_light'],
      ['lab-prop-console-desk', 'console-desk'],
    ]
    for (const [key, file] of labProps) this.load.image(key, `./assets/lab/props/${file}.png`)

    // Kenney UI sound effects (OGG)
    this.load.audio(AUDIO_KEYS.CLICK_A, './sounds/click-a.ogg')
    this.load.audio(AUDIO_KEYS.CLICK_B, './sounds/click-b.ogg')
    this.load.audio(AUDIO_KEYS.SWITCH_A, './sounds/switch-a.ogg')
    this.load.audio(AUDIO_KEYS.SWITCH_B, './sounds/switch-b.ogg')
    this.load.audio(AUDIO_KEYS.TAP_A, './sounds/tap-a.ogg')
    this.load.audio(AUDIO_KEYS.TAP_B, './sounds/tap-b.ogg')
  }

  // -------------------------------------------------------------------------
  // Create — register global animations
  // -------------------------------------------------------------------------

  onCreate(): void {
    // VFX sprite animations — registered globally so all scenes can use them
    if (!this.anims.exists(EFFECT_ANIM_KEYS.FLASH)) {
      this.anims.create({
        key: EFFECT_ANIM_KEYS.FLASH,
        frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.EFFECTS_FLASH, { start: 0, end: 8 }),
        frameRate: 24,
        repeat: 0,
      })
    }
    if (!this.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
      this.anims.create({
        key: EFFECT_ANIM_KEYS.PUFF,
        frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.EFFECTS_PUFF, { start: 0, end: 24 }),
        frameRate: 30,
        repeat: 0,
      })
    }
    if (!this.anims.exists(EFFECT_ANIM_KEYS.EXPLOSION)) {
      this.anims.create({
        key: EFFECT_ANIM_KEYS.EXPLOSION,
        frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.EFFECTS_EXPLOSION, { start: 0, end: 8 }),
        frameRate: 20,
        repeat: 0,
      })
    }
    if (!this.anims.exists(EFFECT_ANIM_KEYS.SMOKE)) {
      this.anims.create({
        key: EFFECT_ANIM_KEYS.SMOKE,
        frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.EFFECTS_SMOKE, { start: 0, end: 24 }),
        frameRate: 24,
        repeat: 0,
      })
    }
    if (!this.anims.exists(EFFECT_ANIM_KEYS.FART)) {
      this.anims.create({
        key: EFFECT_ANIM_KEYS.FART,
        frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.EFFECTS_FART, { start: 0, end: 8 }),
        frameRate: 20,
        repeat: 0,
      })
    }

    // Animal pet idle animations — one per species
    if (this.textures.exists(SPRITESHEET_KEYS.ANIMAL_PETS)) {
      const species = [...ANIMAL_SPECIES]
      for (let row = 0; row < species.length; row++) {
        const key = `animal-idle-${species[row]}`
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.ANIMAL_PETS, {
              start: row * ANIMAL_IDLE_FRAMES,
              end: row * ANIMAL_IDLE_FRAMES + ANIMAL_IDLE_FRAMES - 1,
            }),
            frameRate: 8,
            repeat: -1,
          })
        }
        // Blink animation
        const blinkKey = `animal-blink-${species[row]}`
        if (this.textures.exists(SPRITESHEET_KEYS.ANIMAL_PETS_BLINK) && !this.anims.exists(blinkKey)) {
          this.anims.create({
            key: blinkKey,
            frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.ANIMAL_PETS_BLINK, {
              start: row * ANIMAL_IDLE_FRAMES,
              end: row * ANIMAL_IDLE_FRAMES + ANIMAL_IDLE_FRAMES - 1,
            }),
            frameRate: 12,
            repeat: 0,
          })
        }
      }
    }

    // Lab console screen loops (LAB_PROPS frame strips)
    if (this.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)) {
      const LP = LAB_PROP_FRAMES
      if (!this.anims.exists(LAB_ANIM_KEYS.CONSOLE_WAVE)) {
        this.anims.create({
          key: LAB_ANIM_KEYS.CONSOLE_WAVE,
          frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.LAB_PROPS, {
            start: LP.CONSOLE_SCREEN_WAVE_01,
            end: LP.CONSOLE_SCREEN_WAVE_06,
          }),
          frameRate: 8,
          repeat: -1,
        })
      }
      if (!this.anims.exists(LAB_ANIM_KEYS.CONSOLE_LINES)) {
        this.anims.create({
          key: LAB_ANIM_KEYS.CONSOLE_LINES,
          frames: this.anims.generateFrameNumbers(SPRITESHEET_KEYS.LAB_PROPS, {
            start: LP.CONSOLE_SCREEN_LINES_01,
            end: LP.CONSOLE_SCREEN_LINES_06,
          }),
          frameRate: 8,
          repeat: -1,
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // Update — no-op
  // -------------------------------------------------------------------------

  onUpdate(): void {
    // BootScene has no update logic — it exists only to preload and register anims
  }
}
