import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState, OpencodeSession } from '../types'
import { activeTheme, setActiveTheme, lerpColor, THEMES, type ThemeName } from './office-theme'
import { NavMesh } from './nav-mesh'
import { PennyCafe, type CafeHostScene } from './penny-cafe'
import { OfficeParticles } from './office-particles'
import { OfficeAtmosphere } from './office-atmosphere'
import { OfficeUI } from './office-ui'
import { OfficeAmbient } from './office-ambient'
import { OfficePods } from './office-pods'
import { OfficeMcp } from './office-mcp'
import { OfficeSelection } from './office-selection'
import { OfficeRooms } from './office-rooms'
import { OfficeWorkstations } from './office-workstation'
import { OfficeBackground } from './office-background'
import { OfficeBroadcast } from './office-broadcast'
import { OfficeCamera } from './office-camera'
import type { WorkstationSprite, Room, PodLineInfo, OfficeDebugSnapshot, OrchestratorTaskOfficeInfo } from './office-types'
import {
  getPoseFrame, getRoomDoorY, getStatusColor,
  hashToken, getAgentCharacterIndex, getTeamInfo, getTeamColor,
  cwdToLabel, formatLabel,
} from './office-helpers'

import { SPRITESHEET_KEYS, ANIM_KEYS, SCENE_KEYS, EFFECT_ANIM_KEYS, IMAGE_KEYS, AUDIO_KEYS, ANIMAL_IDLE_FRAMES, ANIMAL_SPECIES } from './office-asset-keys'
import { RoomVisibilityManager } from './room-visibility'
import { soundEngine } from './sound-engine'
import { achievements } from './achievements'
import { CelebrationManager } from './celebrations'
import { AgentMoodManager } from './agent-mood'
import { InteractivePropsManager } from './interactive-props'
import { SeasonHUD } from './season-hud'
import { questSystem } from './quest-system'
import { creditManager } from './credits'
import { leaderboardManager } from './leaderboard'
import { seasonManager } from './seasons'

import {
  KB_ZOOM_STEP,
  CHAR_FRAME_W, CHAR_FRAME_H,
  OFFICE_TILE_SIZE, ROOM_TILE_SIZE,
  WORKSTATION_W, WORKSTATION_H,
  COLOR_BG, ZOOM_MAX,
  LOD_L1_MAX, LOD_L2_MAX,
  POD_REFRESH_MS,
  MCP_REFRESH_MS,
} from './office-constants'


// ---------------------------------------------------------------------------
// OfficeScene
// ---------------------------------------------------------------------------

export class OfficeScene extends Phaser.Scene {
  private pendingAgents: AgentState[] | null = null
  private isReady = false

  /** Orchestrator queue tasks assigned to agents — shown on desks via OfficeWorkstations */
  private orchestratorTasksByAgent = new Map<string, OrchestratorTaskOfficeInfo>()

  private rooms = new Map<string, Room>()
  private agents: AgentState[] = []
  private worldWidth  = 2400
  private worldHeight = 1200
  private viewWidth   = 800
  private viewHeight  = 600

  private officeTilesLoaded = false

  private isDraggingAgent = false

  // Pod connecting lines and chat animations (extracted to OfficePods)
  private pods!: OfficePods
  // MCP server connection lines (workstation → tool icon clusters)
  private mcp!: OfficeMcp

  // Office background — extracted to OfficeBackground
  private background!: OfficeBackground


  private cafe!: PennyCafe
  private cafeFloorMask: Phaser.GameObjects.Graphics | null = null
  private navMesh = new NavMesh()
  // Window glint graphics passed to atmosphere.init()
  private windowGlintGfx: Phaser.GameObjects.Graphics | null = null

  // Particle / effect pool systems — managed by OfficeParticles
  private particles!: OfficeParticles

  // Atmosphere — day/night, sky, clouds, stars, clock, ceiling lights
  private atmosphere!: OfficeAtmosphere

  // Theme transition
  private bgTransitionTween: Phaser.Tweens.Tween | null = null

  // Day/night cycle overlay (passed to atmosphere.init)
  private dayNightOverlay: Phaser.GameObjects.Rectangle | null = null
  private skyGradient: Phaser.GameObjects.Graphics | null = null
  private lastShadowUpdateAt = 0
  // Subtle screen-space edge shading to frame the office.
  private vignetteFx: Phaser.FX.Vignette | null = null

  // Keyboard selection — managed by OfficeSelection
  private selection!: OfficeSelection

  // Camera & navigation — extracted to OfficeCamera
  private officeCamera!: OfficeCamera
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  /** Current LOD level: 1=overview, 2=room, 3=full detail. Initialized to 3 so first frame always applies the correct state. */
  private lastLodLevel = 3
  // Room rendering subsystem (extracted to OfficeRooms)
  private roomRenderer!: OfficeRooms
  // Workstation lifecycle subsystem (extracted to OfficeWorkstations)
  private wsManager!: OfficeWorkstations
  private lastHallwayPulseAt = 0

  // Room-based object culling — managed by RoomVisibilityManager
  private _roomVisibility = new RoomVisibilityManager()
  private lastRoomCheckAt = 0

  // Performance auto-reducer
  private _perfFrameCount = 0
  private _perfLastCheckAt = 0
  private _perfReducedMode = false

  // Game systems
  private celebrations!: CelebrationManager
  private moodManager!: AgentMoodManager
  private propsManager!: InteractivePropsManager
  private seasonHud!: SeasonHUD
  private lastMoodUpdateAt = 0
  private lastSeasonHudUpdateAt = 0


  // Screen-space UI overlays (toasts, tooltip, hover ring, help, debug, LOD label, status bar)
  private ui!: OfficeUI
  private lastDebugRefreshAt = 0
  private lastStatusBarUpdateAt = 0
  private lastStatusBarTimeUpdateAt = 0

  // Ambient office-life activity subsystem (paper airplanes, coffee refills, phone rings, etc.)
  private ambient!: OfficeAmbient

  // PA system broadcast banner — extracted to OfficeBroadcast
  private broadcast!: OfficeBroadcast
  private broadcastHandler: ((msg: unknown) => void) | null = null
  private agentClickedHandler: ((agentId: string) => void) | null = null

  constructor() {
    super({ key: SCENE_KEYS.OFFICE })
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  preload(): void {
    // -----------------------------------------------------------------------
    // Loading screen — dark Midgar-themed overlay with progress bar & sprite preview
    // -----------------------------------------------------------------------
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
      [SPRITESHEET_KEYS.OFFICE]: 'Office Tiles',
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
      [AUDIO_KEYS.CLICK_A]: 'SFX Click',
      [AUDIO_KEYS.TAP_A]: 'SFX Tap',
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

    // Complete handler — show READY! then fade out
    this.load.on('complete', () => {
      dotTimer.destroy()
      scanLine.destroy()

      // Show READY! text
      loadTitle.setText('READY!')
      loadTitle.setColor('#00ff88')
      counterText.setText(`${totalAssets} / ${totalAssets} assets`)
      assetText.setText('')

      // Brief pause then fade out everything
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
          onComplete: () => { allObjects.forEach(obj => obj.destroy()) },
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
    // Individual animation strips (_256 PNGs, 256×512 per frame — same as main spritesheet)
    // Walk: 3072×512 = 12 frames (step-A: 8 rotations + step-B: 4 rotations)
    // Idle: 1024×512 = 4 frames (4 rotations)
    // Sit:  1024×512 = 4 frames (4 rotations)
    const ANIM_FW = 256, ANIM_FH = 512
    this.load.spritesheet(ANIM_KEYS.WALK_1, './sprites/walk-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.WALK_2, './sprites/walk-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.IDLE_1, './sprites/idle-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.IDLE_2, './sprites/idle-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.SIT_1,  './sprites/sit-1.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet(ANIM_KEYS.SIT_2,  './sprites/sit-2.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.on('filecomplete-spritesheet-office', () => { this.officeTilesLoaded = true })

    // Game icon spritesheet (stars, medals, checkmarks — 32×32 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ICONS, './sprites/game-icons.png', {
      frameWidth: 32, frameHeight: 32,
    })

    // HD game icons — 64×64 cells, frames 0-19 (double-size for LOD3 detail)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ICONS_HD, './sprites/game-icons-hd.png', {
      frameWidth: 64, frameHeight: 64,
    })

    // Game items spritesheet (desk props, cafe items — 32×32 cells)
    this.load.spritesheet(SPRITESHEET_KEYS.GAME_ITEMS, './sprites/game-items.png', {
      frameWidth: 32, frameHeight: 32,
    })

    // VFX spritesheets (128×128 cells)
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

    // Kenney UI sound effects (OGG)
    this.load.audio(AUDIO_KEYS.CLICK_A, './sounds/click-a.ogg')
    this.load.audio(AUDIO_KEYS.CLICK_B, './sounds/click-b.ogg')
    this.load.audio(AUDIO_KEYS.SWITCH_A, './sounds/switch-a.ogg')
    this.load.audio(AUDIO_KEYS.SWITCH_B, './sounds/switch-b.ogg')
    this.load.audio(AUDIO_KEYS.TAP_A, './sounds/tap-a.ogg')
    this.load.audio(AUDIO_KEYS.TAP_B, './sounds/tap-b.ogg')
  }

  create(): void {
    this.cafe = new PennyCafe(this as unknown as CafeHostScene)

    const cam = this.cameras.main
    // Don't set a camera background color — the canvas is transparent (config)
    // so the HTML background image behind it bleeds through the ground plane.

    this.viewWidth  = this.scale.width
    this.viewHeight = this.scale.height

    // Camera navigation — extracted to OfficeCamera
    this.officeCamera = new OfficeCamera(this, {
      getRooms: () => this.rooms,
      getBackground: () => this.background,
      getCafe: () => this.cafe,
      getViewSize: () => ({ viewWidth: this.viewWidth, viewHeight: this.viewHeight }),
      getWorldSize: () => ({ worldWidth: this.worldWidth, worldHeight: this.worldHeight }),
      setWorldSize: (w, h) => { this.worldWidth = w; this.worldHeight = h },
    })
    this.officeCamera.init()

    // Office background — extracted to OfficeBackground
    this.background = new OfficeBackground(this, {
      getRooms: () => this.rooms,
      getAgents: () => this.agents,
      getViewWidth: () => this.viewWidth,
      isOfficeTilesLoaded: () => this.officeTilesLoaded,
      getLastLodLevel: () => this.lastLodLevel,
      getWorldSize: () => ({ worldWidth: this.worldWidth, worldHeight: this.worldHeight }),
      getTeamColor: (k) => getTeamColor(k),
      hashToken: (v) => hashToken(v),
      formatLabel: (l) => formatLabel(l),
      getRoomDoorY: (r) => getRoomDoorY(r),
      refreshRoomHeaderText: (r) => { this.ensureRoomRenderer(); this.roomRenderer.refreshRoomHeaderText(r) },
      drawDoorPanel: (r, fw, ac) => { this.ensureRoomRenderer(); this.roomRenderer.drawDoorPanel(r, fw, ac) },
      getTeamInfo: (cwd) => getTeamInfo(cwd),
      rebuildNavMesh: () => this.rebuildNavMesh(),
      updateCameraBounds: () => this.officeCamera.updateCameraBounds(),
      setWorldSize: (w, h) => { this.worldWidth = w; this.worldHeight = h },
      markPodsDirty: () => { if (this.pods) this.pods.markDirty() },
      setCorridorData: (segs, active) => { if (this.particles) this.particles.setCorridorData(segs, active) },
      getAtmosphere: () => this.atmosphere,
      getCafe: () => this.cafe,
      getCafeFloorMask: () => this.cafeFloorMask,
      setCafeFloorMask: (g) => { this.cafeFloorMask = g },
    })
    this.background.init()

    // Pod connecting lines and chat animations
    this.pods = new OfficePods(this)
    this.pods.init()

    // MCP server connection lines
    this.mcp = new OfficeMcp(this)
    this.mcp.init()

    // Ground plane — semi-transparent so the HTML background image bleeds through.
    this.add.rectangle(0, 0, 16000, 16000, COLOR_BG, 0.92)
      .setOrigin(0.5, 0.5).setDepth(-12).setScrollFactor(0)

    // Sky gradient — deepest visible layer, behind stars and clouds
    const skyGradient = this.add.graphics().setDepth(-11).setScrollFactor(0)
    this.skyGradient = skyGradient

    // Day/night cycle overlay (must be created before atmosphere.init)
    this.dayNightOverlay = this.add
      .rectangle(0, 0, 8000, 8000, 0x000000, 0)
      .setOrigin(0.5, 0.5)
      .setDepth(9997)
      .setScrollFactor(0)

    // Window glint graphics created here so atmosphere can own it
    this.windowGlintGfx = this.add.graphics().setDepth(-3.5)

    // Atmosphere: day/night, sky gradient, stars, clouds, clock, ceiling lights
    this.atmosphere = new OfficeAtmosphere(this, {
      onPhaseChange: (phase, _animate, _rainDropPool, _snowPool, _vw, _vh) => {
        // Guard: particles may not yet be initialized during create() (called from atmosphere.init)
        if (this.particles) this.particles.setWeather(phase, this.viewWidth, this.viewHeight)
      },
      invalidateOfficeBgCache: () => { this.background.invalidateBgCache() },
      showToast: (msg, type) => this.showToast(msg, type === 'warn' ? 'warning' : type),
      getCamera: () => this.cameras.main,
    })
    this.atmosphere.init(
      this.dayNightOverlay,
      skyGradient,
      this.windowGlintGfx,
      this.worldWidth,
      this.worldHeight,
      null,
    )

    // Particle / effect pool systems
    this.particles = new OfficeParticles(this)
    this.particles.init(this.viewWidth, this.viewHeight)
    this.particles.setRooms(this.rooms)
    this.particles.setCorridorData(this.background.getCorridorSegments(), false)

    // Camera pan -- cancel follow on manual drag
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.isDraggingAgent) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
        this.officeCamera.followTarget = null
      }

      // Sparkle trail — only when not panning, throttled to 25/sec max
      if (!p.isDown) {
        const time = this.time.now
        if (time - this.particles.lastTrailSpawnAt > 40) {
          this.particles.lastTrailSpawnAt = time
          const wp = cam.getWorldPoint(p.x, p.y)
          const pool = this.particles.getMouseTrailPool()
          const particle = pool.find(c => !c.getData('busy'))
          if (particle) {
            const palette = activeTheme.particleColors
            const color = palette[Math.floor(Math.random() * palette.length)]
            const ox = (Math.random() - 0.5) * 8
            const oy = (Math.random() - 0.5) * 8
            particle.setPosition(wp.x + ox, wp.y + oy)
            particle.setRadius(1 + Math.random())
            particle.setFillStyle(color, 1)
            particle.setAlpha(0.4)
            particle.setScale(1)
            particle.setVisible(true)
            particle.setData('busy', true)
            this.tweens.add({
              targets: particle,
              alpha: 0,
              scaleX: 0.3,
              scaleY: 0.3,
              y: particle.y - 3,
              duration: 400,
              ease: 'Sine.easeOut',
              onComplete: () => {
                particle.setVisible(false)
                particle.setData('busy', false)
              },
            })
          }
        }
      }
    })

    // Smooth zoom -- sets target for lerp in update()
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, _gz: unknown, deltaY: number) => {
        this.officeCamera.targetZoom = Phaser.Math.Clamp(this.officeCamera.targetZoom - deltaY * 0.001, this.officeCamera.getMinZoom(), ZOOM_MAX)
        this.officeCamera.followTarget = null
      },
    )

    // Double-click on empty space resets camera (zoom-to-fit).
    // Single-click anywhere while in focus mode exits focus mode.
    let lastSceneClickTime = 0
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const now = Date.now()
      // Exit focus mode on any click when active
      if (this.selection.isFocused) {
        this.selection.exitFocusMode()
        lastSceneClickTime = now
        return
      }
      if (now - lastSceneClickTime < 350) {
        const wp = cam.getWorldPoint(p.x, p.y)
        if (!this.getAgentAtWorldPoint(wp.x, wp.y)) {
          this.officeCamera.zoomToFit(true)
        }
      }
      lastSceneClickTime = now
    })

    // Resize handler. gameSize values can bounce (Phaser ↔ flex feedback).
    // Use gameSize for Phaser coordinate space, reposition overlays here.
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.viewWidth  = gameSize.width
      this.viewHeight = gameSize.height
      cam.setViewport(0, 0, gameSize.width, gameSize.height)
      cam.setSize(gameSize.width, gameSize.height)

      if (this.ui) { this.ui.setViewSize(gameSize.width, gameSize.height) }
      if (this.seasonHud) { this.seasonHud.setViewSize(gameSize.width, gameSize.height) }

      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null
        this.background.invalidateBgCache()
        this.background.layoutRooms()
        this.officeCamera.updateCameraBounds()
        if (this.rooms.size > 0) this.officeCamera.zoomToFit(true)
      }, 100)
    })

    // OfficeSelection: manages keyboard selection, selection ring, auto-pan, focus mode
    this.selection = new OfficeSelection(this as unknown as import('./office-selection').SelectionHostScene)
    this.selection.initGraphics()

    // -----------------------------------------------------------------------
    // Keyboard shortcuts -- use Phaser keyboard events so they don't leak to React
    // -----------------------------------------------------------------------
    if (this.input.keyboard) {
      const shouldIgnoreKeyboardShortcuts = (evt?: KeyboardEvent) => {
        // Modal surfaces (e.g. Tasks/Veritas creator) can opt out of office hotkeys.
        if (document.querySelector('[data-disable-office-hotkeys="true"]')) {
          return true
        }

        const target = (evt?.target as HTMLElement | null) || (document.activeElement as HTMLElement | null)
        if (!target) return false

        const editableEl = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
        return Boolean(editableEl)
      }

      this.input.keyboard.on('keydown-TAB', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.selection.cycleSelectedAgent(e.shiftKey ? -1 : 1)
      })

      this.input.keyboard.on('keydown-ENTER', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.selection.confirmSelectedAgent()
      })

      this.input.keyboard.on('keydown-ESC', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.ui.helpVisible) { this.ui.hideHelpOverlay(); return }
        if (this.selection.isFocused) { this.selection.exitFocusMode(); return }
        this.selection.deselectAgent()
        this.selection.stopAutoPan()
      })

      this.input.keyboard.on('keydown-F', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.selection.zoomToFitAll()
      })
      this.input.keyboard.on('keydown-R', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.selection.resetCamera()
      })
      this.input.keyboard.on('keydown-SPACE', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.selection.toggleAutoPan()
      })

      // +/= and - for zoom
      this.input.keyboard.on('keydown-PLUS', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.selection.kbSmoothZoom(KB_ZOOM_STEP)
      })
      this.input.keyboard.on('keydown-MINUS', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.selection.kbSmoothZoom(-KB_ZOOM_STEP)
      })

      // Number keys 1-9: jump to agent by index
      for (let n = 1; n <= 9; n++) {
        this.input.keyboard.on(`keydown-${n}`, (e: KeyboardEvent) => {
          if (shouldIgnoreKeyboardShortcuts(e)) return
          this.selection.selectAgentByIndex(n - 1)
        })
      }

      // H / ? — toggle keyboard shortcut help overlay
      const toggleHelp = (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.ui.helpVisible) {
          this.ui.hideHelpOverlay()
        } else {
          this.ui.showHelpOverlay()
        }
      }
      this.input.keyboard.on('keydown-H', toggleHelp)
      this.input.keyboard.on('keydown-QUESTION_MARK', toggleHelp)

      // L — toggle leaderboard overlay
      this.input.keyboard.on('keydown-L', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.seasonHud.toggleLeaderboard()
      })

      // C — toggle season challenges overlay
      this.input.keyboard.on('keydown-C', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.seasonHud.toggleChallenges()
      })

      // B — toggle shop overlay
      this.input.keyboard.on('keydown-B', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.seasonHud.toggleShop()
      })

      // Backtick — toggle debug overlay (dev only)
      this.input.keyboard.on('keydown-BACKTICK', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.ui.toggleDebugOverlay(this.navMesh, this.rooms, this.agents, this.cafe)
      })

      // M — toggle sound mute
      this.input.keyboard.on('keydown-M', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        soundEngine.toggleMute()
        this.showToast(soundEngine.isMuted ? 'Sound OFF' : 'Sound ON', 'info')
      })

      // N — cycle atmosphere phase manually
      this.input.keyboard.on('keydown-N', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        const phases: Array<'morning' | 'day' | 'evening' | 'night'> = ['morning', 'day', 'evening', 'night']
        const currentIdx = phases.indexOf(this.atmosphere.currentTimePhase)
        const nextPhase = phases[(currentIdx + 1) % phases.length]
        this.atmosphere.currentTimePhase = nextPhase as any
        this.atmosphere.applyDayNightCycle(true)
        this.showToast(`Phase: ${nextPhase}`, 'info')
      })

      // T — toggle color theme (dark ↔ light)
      this.input.keyboard.on('keydown-T', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        const nextName: ThemeName = activeTheme === THEMES.dark ? 'light' : 'dark'
        const { newBg } = setActiveTheme(nextName)
        // Redraw everything with new theme colors
        // Ground plane handles visual bg — don't set camera bg (keeps canvas transparent)
        this.background.invalidateBgCache()
        this.background.layoutRooms()
        this.officeCamera.updateCameraBounds()
        // Re-sync workstations to pick up new theme colors
        for (const room of this.rooms.values()) {
          this.roomRenderer.drawRoomBackground(room)
          this.roomRenderer.refreshRoomHeaderText(room)
        }
        this.showToast(`Theme: ${nextName}`, 'info')
      })
    }

    // Vignette: subtle screen-space edge shading
    this.vignetteFx = this.cameras.main.postFX.addVignette(0.5, 0.5, 0.85, 0.35)

    // Screen-space UI overlays: toasts, tooltip, hover ring, help, debug, LOD label, status bar
    this.ui = new OfficeUI(this)
    this.ui.init(this.viewWidth, this.viewHeight)

    // Ambient office-life activity — fires every 8-15 seconds with a random incidental event
    this.ambient = new OfficeAmbient(this)
    this.ambient.start(
      () => this.rooms,
      () => ({ worldWidth: this.worldWidth, worldHeight: this.worldHeight }),
    )

    // PA system broadcast — extracted to OfficeBroadcast
    this.broadcast = new OfficeBroadcast(this)
    this.broadcastHandler = (msg: unknown) => this.broadcast.showBroadcastEffect(String(msg), () => this.rooms)
    EventBus.on(EVENTS.BROADCAST, this.broadcastHandler)

    // Desk click recall — if agent is at cafe, cancel their coffee run so they walk back
    this.agentClickedHandler = ((...args: unknown[]) => {
      const agentId = args[0] as string
      if (this.cafe.isOnCoffeeRun(agentId)) {
        this.cafe.cancelCoffeeRun(agentId)
      }
    }) as (msg: unknown) => void
    EventBus.on(EVENTS.AGENT_CLICKED, this.agentClickedHandler)

    // Game systems — celebrations, mood, achievements, sound, props, season HUD
    this.celebrations = new CelebrationManager(this)

    // VFX sprite animations (loaded in preload)
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

    this.moodManager = new AgentMoodManager(this)
    this.propsManager = new InteractivePropsManager(this)
    this.seasonHud = new SeasonHUD(this)
    this.seasonHud.init(this.viewWidth, this.viewHeight)
    soundEngine.setScene(this)
    soundEngine.wireEvents()
    achievements.load()

    // Wire achievement unlock to visual celebration
    EventBus.on(EVENTS.ACHIEVEMENT_UNLOCKED, (...args: unknown[]) => {
      const [, title, iconFrame] = args as [string, string, number]
      // Show badge at screen center (scroll-factor 0 position)
      const cam = this.cameras.main
      this.celebrations.achievementUnlocked(cam.width / 2, cam.height / 2, title, iconFrame)
      soundEngine.achievement()
    })

    // Wire season end to dramatic ceremony
    EventBus.on(EVENTS.SEASON_ENDED, (...args: unknown[]) => {
      const [, seasonName, score] = args as [string, string, number]
      this.celebrations.seasonEnd(seasonName, score)
    })

    // Wire season start to announcement
    EventBus.on(EVENTS.SEASON_STARTED, (...args: unknown[]) => {
      const [, seasonName] = args as [string, string]
      this.celebrations.seasonStart(seasonName)
    })

    // Wire challenge completion to mini-celebration
    EventBus.on(EVENTS.CHALLENGE_COMPLETED, (...args: unknown[]) => {
      const [, description] = args as [string, string]
      this.celebrations.challengeCompleted(description)
    })

    // Wire quest completion to reward popup VFX
    EventBus.on(EVENTS.QUEST_COMPLETED, (...args: unknown[]) => {
      const [, agentId, xpReward, creditReward, difficulty] = args as [string, string, number, number, string]
      // Find the workstation for this agent and show quest reward VFX
      for (const room of this.rooms.values()) {
        const ws = room.workstations.get(agentId)
        if (ws) {
          const wx = room.x + ws.container.x
          const wy = room.y + ws.container.y
          this.celebrations.questComplete(
            wx, wy,
            difficulty as 'trivial' | 'normal' | 'hard' | 'epic' | 'legendary',
          )
          this.celebrations.questReward(
            wx, wy,
            difficulty as 'trivial' | 'normal' | 'hard' | 'epic' | 'legendary',
            xpReward, creditReward,
          )
          soundEngine.levelUp()
          break
        }
      }
    })

    // Wire quest failure to error VFX
    EventBus.on(EVENTS.QUEST_FAILED, (...args: unknown[]) => {
      const [, agentId] = args as [string, string]
      // Find the workstation for this agent and show error VFX
      for (const room of this.rooms.values()) {
        const ws = room.workstations.get(agentId)
        if (ws) {
          const wx = room.x + ws.container.x
          const wy = room.y + ws.container.y
          this.celebrations.error(wx, wy)
          break
        }
      }
    })

    // Launch UIScene as a parallel overlay — owns all screen-space HUD elements
    this.scene.launch(SCENE_KEYS.UI_SCENE)

    this.isReady = true
    this.cafe.startCoffeeRunTimer()
    if (this.pendingAgents) {
      this.setAgents(this.pendingAgents)
      this.pendingAgents = null
    } else {
      // Build service buildings immediately even with no agents
      this.background.layoutRooms()
      this.officeCamera.updateCameraBounds()
    }

    // Debug: inspect all large visible objects in workstation containers
    ;(window as any).__inspectWorkstations = () => {
      const results: any[] = []
      for (const [roomKey, room] of this.rooms) {
        for (const [wsKey, ws] of room.workstations) {
          const children = ws.container.getAll()
          children.forEach((gc: any, i: number) => {
            if (!gc.visible || gc.alpha <= 0) return
            const w = gc.displayWidth || gc.width || 0
            const h = gc.displayHeight || gc.height || 0
            if (w > 15 || h > 15) {
              results.push({
                room: roomKey, agent: wsKey, idx: i,
                type: gc.type, w: Math.round(w), h: Math.round(h),
                x: Math.round(gc.x), y: Math.round(gc.y),
                scaleX: gc.scaleX?.toFixed(2), scaleY: gc.scaleY?.toFixed(2),
                alpha: gc.alpha?.toFixed(2),
                texture: gc.texture?.key || '',
                frame: gc.frame?.name ?? '',
                fillColor: gc.fillColor !== undefined ? '0x' + gc.fillColor.toString(16) : '',
                depth: gc.depth,
                name: gc.name || '',
              })
            }
          })
        }
      }
      console.table(results)
      return results
    }

    // Debug: hide a specific child by index across all workstations
    ;(window as any).__hideWsChild = (idx: number) => {
      let count = 0
      for (const room of this.rooms.values()) {
        for (const ws of room.workstations.values()) {
          const child = ws.container.getAt(idx)
          if (child) { (child as any).setVisible(false); count++ }
        }
      }
      console.log(`Hidden child at index ${idx} across ${count} workstations`)
    }

    // Debug: show a specific child by index across all workstations
    ;(window as any).__showWsChild = (idx: number) => {
      let count = 0
      for (const room of this.rooms.values()) {
        for (const ws of room.workstations.values()) {
          const child = ws.container.getAt(idx)
          if (child) { (child as any).setVisible(true); count++ }
        }
      }
      console.log(`Shown child at index ${idx} across ${count} workstations`)
    }

    // Debug: set alpha for a specific child index across all workstations
    ;(window as any).__setWsChildAlpha = (idx: number, alpha: number) => {
      let count = 0
      for (const room of this.rooms.values()) {
        for (const ws of room.workstations.values()) {
          const child = ws.container.getAt(idx)
          if (child) { (child as any).setAlpha(alpha); count++ }
        }
      }
      console.log(`Set alpha ${alpha} on child at index ${idx} across ${count} workstations`)
    }

    // Debug: set scale for a specific child index across all workstations
    ;(window as any).__setWsChildScale = (idx: number, scale: number) => {
      let count = 0
      for (const room of this.rooms.values()) {
        for (const ws of room.workstations.values()) {
          const child = ws.container.getAt(idx)
          if (child) { (child as any).setScale(scale); count++ }
        }
      }
      console.log(`Set scale ${scale} on child at index ${idx} across ${count} workstations`)
    }
  }

  // ---------------------------------------------------------------------------
  // roomRenderer lazy initializer guard (fallback for timing edge cases)
  // ---------------------------------------------------------------------------

  private ensureRoomRenderer(): void {
    if (!this.roomRenderer) {
      this.roomRenderer = new OfficeRooms(this, {
        atmosphere: this.atmosphere,
        calcRoomSize: (n, cwd?) => this.background.calcRoomSize(n, cwd),
        syncWorkstations: (room, agents) => {
          this.ensureWsManager()
          this.wsManager.syncWorkstations(room, agents, (r) => this.roomRenderer.triggerDoorAnimation(r))
        },
        updateRoomActivity: (room) => this.background.updateRoomActivity(room),
        destroyWorkstation: (ws) => { this.ensureWsManager(); this.wsManager.destroyWorkstation(ws) },
        formatLabel: (label) => formatLabel(label),
      })
    }
  }

  // wsManager lazy initializer — workstation lifecycle subsystem
  private ensureWsManager(): void {
    if (!this.wsManager) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const scene = this
      this.wsManager = new OfficeWorkstations(this, {
        showToast: (t, type) => scene.showToast(t, type),
        spawnEmojiReaction: (x, y, e) => scene.particles.spawnEmojiReaction(x, y, e),
        spawnSpriteReaction: (x, y, f) => scene.particles.spawnSpriteReaction(x, y, f),
        spawnAlertRipple: (x, y, c) => scene.particles.spawnAlertRipple(x, y, c),
        burstConfetti: (x, y) => scene.particles.burstConfetti(x, y),
        spawnSteamParticles: (ws) => scene.particles.spawnSteamParticles(ws),
        clearSteamParticles: (ws) => scene.particles.clearSteamParticles(ws),
        spawnFlameParticle: (x, y, streak) => scene.particles.spawnFlameParticle(x, y, streak),
        getAgentCharacterIndex: (agent) => getAgentCharacterIndex(agent),
        getPoseFrame: (idx, agent) => getPoseFrame(idx, agent),
        getStatusColor: (agent) => getStatusColor(agent),
        getPodLines: () => scene.pods?.podLines ?? [],
        applyLodToWorkstation: (ws, level, fade) => scene.applyLodToWorkstation(ws, level, fade),
        getLastLodLevel: () => scene.lastLodLevel,
        enterFocusMode: (id) => scene.selection.enterFocusMode(id),
        drawHoverRing: (x, y) => scene.ui.drawHoverRing(x, y),
        clearHoverRing: () => scene.ui.clearHoverRing(),
        showRichTooltip: (agent, sx, sy) => scene.ui.showRichTooltip(agent, sx, sy),
        hideTooltip: () => scene.ui.hideTooltip(),
        get officeTilesLoaded() { return scene.officeTilesLoaded },
        getRooms: () => scene.rooms,
        isCoffeeRunActive: (id) => scene.cafe.isOnCoffeeRun(id),
        cancelCoffeeRun: (id) => scene.cafe.cancelCoffeeRun(id),
        celebrations: scene.celebrations,
        propsManager: scene.propsManager,
        getNavMesh: () => scene.navMesh,
        getOrchestratorTaskForAgent: (id) => scene.orchestratorTasksByAgent.get(id),
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Update loop (smooth zoom, follow, LOD, minimap)
  // ---------------------------------------------------------------------------

  update(time: number, _delta: number): void {
    const cam = this.cameras.main

    // Camera smooth zoom + follow + recovery
    this.officeCamera.updateZoomAndFollow(time)

    // Zoom-dependent multi-level LOD
    const lodLevel = cam.zoom < LOD_L1_MAX ? 1 : cam.zoom <= LOD_L2_MAX ? 2 : 3
    if (lodLevel !== this.lastLodLevel) {
      this.lastLodLevel = lodLevel
      this.background.applyLodToWhiteboard(lodLevel)
      this.ui.applyLod(lodLevel, this.rooms, null, [], [])
    }

    if (this.pods.podLines.length > 0 && (this.pods.isDirty() || this.pods.hasAnimatedPods()) && time - this.pods.getLastDrawAt() >= POD_REFRESH_MS) {
      this.pods.drawPodLines(time, this.rooms)
      this.pods.setLastDrawAt(time)
      this.pods.clearDirty()
    }
    // MCP server connection lines — dashed lines from workstations to tool icon clusters
    if (lodLevel >= 2 && (this.mcp.isDirty() || this.mcp.hasActiveConnections(this.rooms)) && time - this.mcp.getLastDrawAt() >= MCP_REFRESH_MS) {
      this.mcp.drawMcpLines(time, this.rooms)
      this.mcp.setLastDrawAt(time)
      this.mcp.clearDirty()
    }
    // Hide MCP lines at L1 overview zoom
    if (lodLevel < 2 && this.mcp) this.mcp.setVisible(false)
    else if (lodLevel >= 2 && this.mcp) this.mcp.setVisible(true)
    // Rivalry connecting lines — electric blue dashes between rival agents (every 2.5s)
    if (this.pods.hasRivalries() && time - this.pods.getLastRivalryDrawAt() >= 2500) {
      this.pods.drawRivalryLines(time, this.rooms)
    }
    if (this.background.getCorridorSegments().length > 0 && time - this.lastHallwayPulseAt >= 90) {
      this.background.drawHallwayIndicators(time)
      this.lastHallwayPulseAt = time
    }
    // Reactor glow + ambient pulse VFX (both internally throttled)
    this.background.tickReactorGlow(time)
    // Keep particle system informed about active agent state for corridor particles
    if (this.particles) {
      const hasActiveAgent = this.agents.some(
        a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
      )
      this.particles.setCorridorData(this.background.getCorridorSegments(), hasActiveAgent)
    }
    // Floor arrows — only at room/full-detail zoom, throttled to 200ms
    if (cam.zoom > LOD_L1_MAX && this.rooms.size > 0 && time - this.background.getLastFloorArrowAt() >= 200) {
      this.background.drawFloorArrows(time)
      this.background.setLastFloorArrowAt(time)
    } else if (cam.zoom <= LOD_L1_MAX) {
      this.background.clearFloorArrows()
    }

    // Debug overlay refresh (throttled to 250ms)
    if (this.ui.debugOverlayVisible && time - this.lastDebugRefreshAt >= 250) {
      this.ui.refreshDebugOverlay(time, _delta, this.rooms)
      this.lastDebugRefreshAt = time
    }

    if (this.particles.isRainActive()) this.particles.tickRain(this.viewWidth, this.viewHeight)
    if (this.particles.isSnowActive()) this.particles.tickSnow(time, this.viewWidth, this.viewHeight)
    const camWWorld = cam.width / cam.zoom
    const camHWorld = cam.height / cam.zoom
    this.particles.tickMakoMotes(cam.scrollX, cam.scrollY, camWWorld, camHWorld, cam.zoom)
    this.particles.tickSparks(cam.scrollX, cam.scrollY, camWWorld, camHWorld, cam.zoom)
    this.particles.tickSteam(cam.scrollX, cam.scrollY, camWWorld, camHWorld, cam.zoom)
    this.atmosphere.tick(time, this.particles.isRainActive(), this.particles.isSnowActive())
    this.atmosphere.tickCeilingLightActivity(time, this.rooms)
    // Room ambient haze — subtle productivity puffs in busy rooms
    if (this.roomRenderer && this.rooms.size > 0) {
      this.roomRenderer.tickRoomHaze(time, this.rooms)
    }
    if (this.background.hasWhiteboardContainer() && time - this.background.getLastWhiteboardUpdateAt() >= 5000) {
      this.background.setLastWhiteboardUpdateAt(time)
      this.background.updateWhiteboardStats()
    }
    if (time - this.lastShadowUpdateAt >= 5000) {
      this.lastShadowUpdateAt = time
      this.atmosphere.updateShadows(this.rooms)
    }

    // Status bar: agent stats every 3s, clock label every 60s
    if (this.ui.hasStatusBar && time - this.lastStatusBarUpdateAt >= 3000) {
      this.lastStatusBarUpdateAt = time
      this.ui.updateStatusBar(this.agents, this.rooms.size)
    }
    if (this.ui.hasStatusBarTime && time - this.lastStatusBarTimeUpdateAt >= 60_000) {
      this.lastStatusBarTimeUpdateAt = time
      this.ui.refreshStatusBarTime()
    }

    // Chat animations — advance traveling dots and fade expired lines
    if (this.pods.hasChatAnimations()) {
      this.pods.tickChatAnimations(time)
    }

    // Room-based object culling — throttled to 200ms, matching floor-arrow cadence
    if (this.rooms.size > 0 && time - this.lastRoomCheckAt >= 200) {
      this.lastRoomCheckAt = time
      this._roomVisibility.update(this.cameras.main)
    }

    // Agent mood bubbles — throttled to 2s
    if (this.moodManager && time - this.lastMoodUpdateAt >= 2000) {
      this.lastMoodUpdateAt = time
      const agentMap = new Map<string, { x: number; y: number; status: string; blocked: boolean; uptime: number }>()
      for (const room of this.rooms.values()) {
        for (const [id, ws] of room.workstations) {
          if (!ws.state) continue
          agentMap.set(id, {
            x: room.x + ws.container.x,
            y: room.y + ws.container.y,
            status: ws.state.status ?? 'idle',
            blocked: ws.state.needsInteraction ?? false,
            uptime: typeof ws.state.uptime === 'string' ? parseInt(ws.state.uptime, 10) * 1000 : 0,
          })
        }
      }
      this.moodManager.update(agentMap)
    }

    // Season HUD — update every 3s
    if (this.seasonHud && time - this.lastSeasonHudUpdateAt >= 3000) {
      this.lastSeasonHudUpdateAt = time
      this.seasonHud.update()
    }

    // Performance auto-reducer — check avg FPS every 3s
    this._perfFrameCount++
    if (time - this._perfLastCheckAt >= 3000) {
      const avgFps = this._perfFrameCount / 3
      this._perfFrameCount = 0
      this._perfLastCheckAt = time
      if (avgFps < 28 && !this._perfReducedMode) {
        this._perfReducedMode = true
        this.particles.setReducedMode(true)
        this.showToast('Performance mode ON', 'info')
      } else if (avgFps > 45 && this._perfReducedMode) {
        this._perfReducedMode = false
        this.particles.setReducedMode(false)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setAgents(agents: AgentState[], opencodeSessions?: OpencodeSession[]): void {
    if (!this.isReady) {
      this.pendingAgents = agents
      return
    }
    this.ensureRoomRenderer()

    const allAgents = [...agents]
    
    // Convert external CLI sessions to agent states and merge.
    if (opencodeSessions && opencodeSessions.length > 0) {
      for (const session of opencodeSessions) {
        const runtime = session.runtime ?? 'opencode'
        const runtimeTitle =
          runtime === 'openclaw' ? 'OpenClaw' :
          runtime === 'nemoclaw' ? 'Gus (NemoClaw)' :
          'OpenCode'
        const cpuVal = parseFloat(session.cpu || '0')
        allAgents.push({
          config: {
            id: `${runtime}-${session.pid}`,
            name: runtime,
            title: runtimeTitle,
            podRole: 'solver',
            systemPrompt: '',
            model: runtime,
            mcpProfile: '',
            skills: [],
            allowedTools: [],
            subAgents: {},
            defaultRepos: [session.cwd],
            avatar: runtime,
            desk: { row: 0, col: 0 },
            autonomy: 'default',
          },
          status: cpuVal >= 1 ? 'active' : 'idle',
          cwd: session.cwd,
          pid: session.pid,
          tty: session.tty,
          cpu: session.cpu,
          memoryMB: session.memoryMB,
          uptime: session.uptime,
          sessionMode: (cpuVal >= 1 ? 'working' : 'idle') as 'working' | 'idle',
          needsInteraction: false,
        })
      }
    }

    this.agents = allAgents

    const grouped = new Map<string, AgentState[]>()
    for (const agent of allAgents) {
      const key = agent.cwd ?? '__unassigned__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(agent)
    }

    // Remove rooms whose cwd is no longer present
    for (const [cwd, room] of this.rooms) {
      if (!grouped.has(cwd)) {
        this.roomRenderer.destroyRoom(room)
        this.rooms.delete(cwd)
      }
    }

    // Create or update
    for (const [cwd, roomAgents] of grouped) {
      const { key: teamKey, label: teamLabel } = getTeamInfo(cwd)
      const existing = this.rooms.get(cwd)
      if (existing) {
        existing.teamKey = teamKey
        existing.teamLabel = teamLabel
        this.roomRenderer.updateRoom(existing, roomAgents)
      } else {
        const label = cwdToLabel(cwd)
        const room = this.roomRenderer.createRoom(cwd, label, teamKey, teamLabel, roomAgents)
        this.rooms.set(cwd, room)
      }
    }

    const prevWorldW = this.worldWidth
    const prevWorldH = this.worldHeight
    this.background.layoutRooms()
    this.officeCamera.updateCameraBounds()
    this.background.updateWhiteboardStats()

    // Brief camera zoom-out when world expands to show new rooms
    if (this.officeCamera.hasInitialFit &&
        (this.worldWidth > prevWorldW + 50 || this.worldHeight > prevWorldH + 50)) {
      const cam = this.cameras.main
      const origZoom = cam.zoom
      const pullBackZoom = origZoom * 0.88
      this.tweens.add({
        targets: cam,
        zoom: pullBackZoom,
        duration: 400,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: cam,
            zoom: origZoom,
            duration: 500,
            ease: 'Sine.easeInOut',
          })
        },
      })
    }

    // Re-register all rooms with the visibility manager after layout finalises positions.
    // Registration replaces any previous entry for the same id, so this is safe to call on
    // every sync cycle.  Workstation containers are the primary managed objects; the room
    // container itself is also included so header/floor graphics cull with the room.
    for (const [cwd, room] of this.rooms) {
      const objects: Phaser.GameObjects.GameObject[] = [room.container]
      for (const ws of room.workstations.values()) {
        objects.push(ws.container)
      }
      this._roomVisibility.registerRoom({
        id: cwd,
        bounds: {
          x: room.x - room.width / 2,
          y: room.y - room.height / 2,
          width: room.width,
          height: room.height,
        },
        objects,
      })
    }
    // Unregister rooms that were removed this cycle.
    for (const id of this._roomVisibility.getActiveRooms()) {
      if (!this.rooms.has(id)) this._roomVisibility.unregisterRoom(id)
    }

    // Achievement tracking
    achievements.trackAgentCount(allAgents.length)

    // Mark MCP connection lines as dirty after agent state update
    if (this.mcp) this.mcp.markDirty()

    this.ensureWsManager()
    this.wsManager.syncOrchestratorTaskLabels()

    // Fit camera on first layout only — don't hijack user's pan on every poll.
    if (this.rooms.size > 0 && !this.officeCamera.hasInitialFit) {
      this.officeCamera.hasInitialFit = true
      this.officeCamera.followTarget = null
      this.officeCamera.zoomToFit(false)
      this.officeCamera.pendingCameraRecoveryUntil = this.time.now + 1500
    }
  }

  /** Called from React to check if a world point is over a workstation */
  getAgentAtWorldPoint(wx: number, wy: number): AgentState | null {
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        const wsWorldX = room.x + ws.container.x
        const wsWorldY = room.y + ws.container.y
        const dx = Math.abs(wx - wsWorldX)
        const dy = Math.abs(wy - wsWorldY)
        if (dx < WORKSTATION_W / 2 && dy < WORKSTATION_H / 2) {
          return ws.state
        }
      }
    }
    return null
  }

  /** Update active pod workflows for connecting lines (Fix 11) */
  setPodWorkflows(workflows: PodLineInfo[]): void {
    if (!this.pods) return
    this.pods.setPodLines(workflows)
    this.pods.drawPodLines(this.time.now, this.rooms)
    this.pods.setLastDrawAt(this.time.now)
    this.pods.clearDirty()
  }

  /** Active orchestrator tasks — shows `[stage] title` below each assigned agent's name */
  setOrchestratorTasks(tasks: OrchestratorTaskOfficeInfo[]): void {
    this.orchestratorTasksByAgent.clear()
    for (const t of tasks) {
      this.orchestratorTasksByAgent.set(t.agentId, t)
    }
    this.ensureWsManager()
    this.wsManager.syncOrchestratorTaskLabels()
  }

  /** Highlight a workstation for drag-over feedback */
  highlightAgentDesk(agentId: string, highlight: boolean): void {
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        if (highlight) {
          ws.deskBody.setStrokeStyle(3, 0x3b82f6, 1)
        } else {
          this.ensureWsManager()
          this.wsManager.restoreDeskStroke(ws)
        }
        return
      }
    }
  }

  /** Public: smooth-pan camera to center on a specific agent */
  panToAgent(agentId: string): void {
    this.officeCamera.panToAgent(agentId, this.rooms)
  }

  /** Delegate for CafeHostScene — cafe calls scene.spawnEmojiReaction() */
  public spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void {
    this.particles.spawnEmojiReaction(worldX, worldY, emoji)
  }

  /** Switch theme with smooth 500ms background color transition */
  setTheme(theme: ThemeName): void {
    const { oldBg, newBg } = setActiveTheme(theme)
    if (oldBg === newBg) return
    if (this.bgTransitionTween) { this.bgTransitionTween.destroy(); this.bgTransitionTween = null }
    const cam = this.cameras.main
    // No camera bg color — canvas stays transparent for HTML bg image bleed-through.
    // The ground plane rectangle at depth -12 handles the visual background.
    this.bgTransitionTween = null
    this._applyThemeToAll()
  }

  /** Returns the current theme name */
  getTheme(): ThemeName {
    return (activeTheme === THEMES.dark ? 'dark' : activeTheme === THEMES.light ? 'light' : 'neon') as ThemeName
  }

  /** Lightweight snapshot for smoke checks and diagnostics. */
  getDebugSnapshot(): OfficeDebugSnapshot {
    let workstationCount = 0
    for (const room of this.rooms.values()) {
      workstationCount += room.workstations.size
    }
    const cam = this.cameras.main
    return {
      ready: this.isReady,
      roomCount: this.rooms.size,
      workstationCount,
      camera: {
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
      },
      world: {
        width: this.worldWidth,
        height: this.worldHeight,
      },
    }
  }

  /** Redraw all scene elements with the current activeTheme colors */
  private _applyThemeToAll(): void {
    this.ensureRoomRenderer()
    this.ensureWsManager()
    const t = activeTheme
    for (const room of this.rooms.values()) {
      this.roomRenderer.drawRoomBackground(room)
      for (const ws of room.workstations.values()) {
        ws.deskBody.setFillStyle(t.deskBody)
        ws.deskTop.setFillStyle(t.deskTop)
        this.wsManager.restoreDeskStroke(ws)
        if (ws.monitorGlowFx) {
          const isWorking = ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction
          const isWaiting = ws.state?.needsInteraction
          ws.monitorGlowFx.color = isWaiting ? t.deskStrokeWaiting : isWorking ? t.monitorGlowActive : t.monitorGlowIdle
        }
        ws.lastAnimMode = undefined
        if (ws.state) this.wsManager.updateWorkstation(ws, ws.state)
      }
    }
    this.pods.markDirty()
    this.pods.drawPodLines(this.time.now, this.rooms)
    this.pods.setLastDrawAt(this.time.now)
    this.pods.clearDirty()
    this.mcp.markDirty()
  }


  // ---------------------------------------------------------------------------
  // Room layout — delegated to OfficeBackground
  // ---------------------------------------------------------------------------

  /** Expose NavMesh for CoffeRunHostScene and other consumers. */
  getNavMesh(): NavMesh { return this.navMesh }

  private rebuildNavMesh(): void {
    // Build bounds from all room positions
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
    for (const room of this.rooms.values()) {
      bMinX = Math.min(bMinX, room.x - room.width / 2)
      bMinY = Math.min(bMinY, room.y - room.height / 2)
      bMaxX = Math.max(bMaxX, room.x + room.width / 2)
      bMaxY = Math.max(bMaxY, room.y + room.height / 2)
    }
    let buildingBounds: { x: number; y: number; w: number; h: number } | null = null
    if (this.rooms.size > 0) {
      buildingBounds = {
        x: bMinX - 40, y: bMinY - 40,
        w: bMaxX - bMinX + 80, h: bMaxY - bMinY + 80,
      }
    }

    this.navMesh.rebuild({
      buildingBounds,
      corridorSegments: this.background.getCorridorSegments(),
      cafeBounds: this.cafe.getBounds(),
    })
  }


  // ---------------------------------------------------------------------------
  // Notification toasts
  // ---------------------------------------------------------------------------

  private showToast(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    // Route all toasts to UIScene (zoom-independent camera) via EventBus.
    // OfficeScene's office-ui.ts toasts were broken by camera zoom, so we
    // only use the UIScene toast system now.
    const level = type === 'warning' ? 'warn' : (type === 'success' ? 'info' : type) as 'info' | 'warn' | 'error'
    EventBus.emit(EVENTS.NOTIFICATION, text, level)
  }


  // ---------------------------------------------------------------------------
  // Pod lines and chat animations: extracted to OfficePods module
  // ---------------------------------------------------------------------------


  // ---------------------------------------------------------------------------
  // Agent chat connection animations
  // ---------------------------------------------------------------------------

  /**
   * Animate a data-sharing arc from one agent to another.
   * Draws a curved bezier line and animates a dot traveling from source to target.
   *
   * Usage example:
   *   scene.showAgentChat('marcus-chen', 'lena-park')
   *   scene.showAgentChat('solver-id', 'reviewer-id', 3000)
   */
  public showAgentChat(fromAgentId: string, toAgentId: string, duration = 2000): void {
    if (!this.isReady) return
    this.pods.showAgentChat(fromAgentId, toAgentId, duration, this.rooms)
  }




  // ---------------------------------------------------------------------------
  // LOD system — applyLodToWorkstation is used by OfficeWorkstations host
  // ---------------------------------------------------------------------------

  // Multi-level LOD system (3 levels):
  //   Level 1 (overview, zoom < LOD_L1_MAX):  rooms show as colored rects only — internals hidden
  //   Level 2 (room, LOD_L1_MAX..LOD_L2_MAX): agents + desks visible, micro-accessories hidden
  //   Level 3 (detail, zoom > LOD_L2_MAX):    full detail including accessories, monitor content


  private applyLodToWorkstation(ws: WorkstationSprite, level: number, _useFadeIn: boolean): void {
    // Guard: skip if LOD level hasn't changed for this workstation
    if (ws.currentLodLevel === level) return
    const prevLevel = ws.currentLodLevel ?? 1
    ws.currentLodLevel = level

    const showRoom = level >= 2
    const showFull = level >= 3
    const wasRoom = prevLevel >= 2
    const wasFull = prevLevel >= 3

    // Container visibility — fade the whole container when entering/leaving L2
    if (showRoom && !wasRoom) {
      ws.container.setVisible(true).setAlpha(0)
      this.tweens.add({ targets: ws.container, alpha: 1, duration: 200, ease: 'Power2' })
    } else if (!showRoom && wasRoom) {
      this.tweens.add({
        targets: ws.container, alpha: 0, duration: 150, ease: 'Power2',
        onComplete: () => { ws.container.setVisible(false) },
      })
      return
    } else if (!showRoom) {
      ws.container.setVisible(false)
      return
    }

    type AlphaObj = Phaser.GameObjects.Components.Visible &
      Phaser.GameObjects.Components.AlphaSingle

    const fadeIn = (obj: Phaser.GameObjects.GameObject, targetAlpha = 1) => {
      const v = obj as unknown as AlphaObj
      this.tweens.killTweensOf(obj)
      v.setVisible(true)
      if (v.alpha > 0 && v.alpha < targetAlpha) {
        this.tweens.add({ targets: obj, alpha: targetAlpha, duration: 200, ease: 'Power2' })
      } else {
        v.setAlpha(0)
        this.tweens.add({ targets: obj, alpha: targetAlpha, duration: 200, ease: 'Power2' })
      }
    }

    const fadeOut = (obj: Phaser.GameObjects.GameObject) => {
      const v = obj as unknown as AlphaObj
      if (!v.visible) return
      this.tweens.killTweensOf(obj)
      this.tweens.add({
        targets: obj, alpha: 0, duration: 150, ease: 'Power2',
        onComplete: () => { (obj as unknown as AlphaObj).setVisible(false) },
      })
    }

    const l2Entering = showRoom && !wasRoom
    for (const obj of ws.lodLevel2Objects) {
      if (!obj || !('setVisible' in obj)) continue
      if (showRoom) {
        if (l2Entering) fadeIn(obj)
        else (obj as unknown as AlphaObj).setVisible(true)
      } else {
        fadeOut(obj)
      }
    }

    const l3Entering = showFull && !wasFull
    const l3Leaving = !showFull && wasFull
    for (const obj of ws.lodLevel3Objects) {
      if (!obj || !('setVisible' in obj)) continue
      if (showFull) {
        if (l3Entering) fadeIn(obj)
        else (obj as unknown as AlphaObj).setVisible(true)
      } else if (l3Leaving) {
        fadeOut(obj)
      } else {
        (obj as unknown as AlphaObj).setVisible(false)
      }
    }

    if (ws.screenLines) {
      if (showFull && !wasFull) {
        ws.screenLines.setVisible(true).setAlpha(0)
        this.tweens.add({ targets: ws.screenLines, alpha: 1, duration: 200, ease: 'Power2' })
      } else if (!showFull && wasFull) {
        this.tweens.add({
          targets: ws.screenLines, alpha: 0, duration: 150, ease: 'Power2',
          onComplete: () => { ws.screenLines?.setVisible(false) },
        })
      } else {
        ws.screenLines.setVisible(showFull)
      }
    }
    if (ws.monitorGlowFx) {
      if (showFull) {
        if (ws.monitorGlowTween) ws.monitorGlowTween.resume()
      } else {
        if (ws.monitorGlowTween) ws.monitorGlowTween.pause()
        ws.monitorGlowFx.outerStrength = 0
      }
    }

    // HD icon swap — use 64x64 GAME_ICONS_HD at L3 for crisp status dots
    const hdAvailable = this.textures.exists(SPRITESHEET_KEYS.GAME_ICONS_HD)
    if (hdAvailable && ws.statusDot) {
      if (showFull && !wasFull) {
        // Swap to HD sheet (64x64) at half scale for sharper rendering
        ws.statusDot.setTexture(SPRITESHEET_KEYS.GAME_ICONS_HD)
        ws.statusDot.setScale(0.11)
      } else if (!showFull && wasFull) {
        // Swap back to standard sheet (32x32)
        ws.statusDot.setTexture(SPRITESHEET_KEYS.GAME_ICONS)
        ws.statusDot.setScale(0.22)
      }
    }
  }




  public enterFocusMode(agentId: string): void {
    this.selection.enterFocusMode(agentId)
  }

  public exitFocusMode(): void {
    this.selection.exitFocusMode()
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (this.resizeTimer) { clearTimeout(this.resizeTimer); this.resizeTimer = null }

    // PA system broadcast banner cleanup
    this.broadcast.destroy()
    if (this.agentClickedHandler) {
      EventBus.off(EVENTS.AGENT_CLICKED, this.agentClickedHandler)
      this.agentClickedHandler = null
    }
    if (this.broadcastHandler) {
      EventBus.off(EVENTS.BROADCAST, this.broadcastHandler)
      this.broadcastHandler = null
    }

    // Keyboard selection + focus mode cleanup — delegates to OfficeSelection
    this.selection.destroy()

    if (this.vignetteFx) {
      this.cameras.main.postFX.remove(this.vignetteFx)
      this.vignetteFx = null
    }
    this.dayNightOverlay = null
    this.skyGradient = null

    this.atmosphere.destroy()
    this.particles.destroy()

    // Café cleanup
    this.cafe.destroy()

    // atmosphere.destroy() already handled ceiling lights, exterior lights,
    // wall clock, window glint, starfield, clouds, day/night overlay

    // Background subsystem cleanup (decoTweens, officeDecoSprites, whiteboard,
    // teamAreaLabels, corridorGraphics, floorArrowGfx, officeGraphics, flagContainer)
    this.background.destroy()

    this.ambient.destroy()
    this.pods.destroy()
    this.mcp.destroy()

    // UI subsystem cleanup (helpOverlay, debugOverlay, tooltips, hover ring, notifications)
    this.ui.destroy()
    this.seasonHud.destroy()

    if (this.roomRenderer) {
      for (const room of this.rooms.values()) {
        this.roomRenderer.destroyRoom(room)
      }
    }
    this.rooms.clear()
  }
}
