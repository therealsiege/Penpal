import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState, OpencodeSession } from '../types'
import { XP_RANKS, getXPForLevel } from '../types'
import { activeTheme, setActiveTheme, lerpColor, THEMES, type ThemeName } from './office-theme'
import { NavMesh, type NavPoint } from './nav-mesh'
import { getRoomType, getTemplate } from './room-renderer'
import { PennyCafe, type CafeHostScene } from './penny-cafe'
import { OfficeParticles } from './office-particles'
import { OfficeAtmosphere } from './office-atmosphere'
import type { WorkstationSprite, Room, TeamAreaLayout, MinimapProjection, TripletLineInfo, OfficeDebugSnapshot } from './office-types'

import {
  KB_ZOOM_STEP, KB_ZOOM_DURATION, KB_PAN_DURATION, KB_AUTO_PAN_INTERVAL,
  CHAR_FRAME_W, CHAR_FRAME_H, CHAR_COLS, NUM_CHARS,
  POSE_IDLE, POSE_INTERACT, POSE_SIT, POSE_SURPRISE, POSE_HURT, POSE_WALK,
  COMPACT_COLS, COMPACT_IDLE_START, COMPACT_WALK_START, COMPACT_SIT_START,
  WALK_A_FRONT, WALK_A_FRONT_R, WALK_A_SIDE_R, WALK_A_BACK_R,
  WALK_A_BACK, WALK_A_BACK_L, WALK_A_SIDE_L, WALK_A_FRONT_L,
  WALK_B_FRONT, WALK_B_FRONT_R, WALK_B_SIDE_R, WALK_B_BACK_R,
  OFFICE_TILE_SIZE, FRAME_CHAIR_DARK, FRAME_MONITOR, ROOM_TILE_SIZE,
  OFFICE_FRAME_PLANT, OFFICE_FRAME_PLANT_SM, OFFICE_FRAME_PICTURE,
  OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3, OFFICE_FRAME_BOOKSHELF,
  OFFICE_FRAME_PLANT_TALL, OFFICE_FRAME_CACTUS, OFFICE_FRAME_HANGING_PLANT,
  OFFICE_FRAME_FERN, OFFICE_FRAME_MONSTERA, OFFICE_FRAME_CLOCK,
  OFFICE_FRAME_LAMP, OFFICE_FRAME_TRASH, OFFICE_FRAME_STORAGE,
  OFFICE_FRAME_FILE_CABINET, OFFICE_FRAME_WATER_COOLER, OFFICE_FRAME_WHITEBOARD,
  OFFICE_FRAME_MONITOR, OFFICE_FRAME_SOFA, OFFICE_FRAME_PRINTER,
  CHAR_SCALE, WORKSTATION_W, WORKSTATION_H, ROOM_PADDING, ROOM_TOP_EXTRA,
  ROOM_HEADER_H, ROOM_GAP, MAX_AGENTS_PER_ROW,
  TEAM_AREA_PAD_X, TEAM_AREA_PAD_Y, TEAM_AREA_GAP_X, TEAM_AREA_GAP_Y, TEAM_LABEL_H,
  WS_CHAIR_Y, WS_SPRITE_Y, WS_DESK_Y, WS_MONITOR_Y, WS_NAME_Y, WS_DOT_GAP,
  IDLE_WALK_BREAK_MIN_MS, IDLE_WALK_BREAK_VAR_MS, IDLE_WALK_RANGE_X,
  COLOR_BG, COLOR_ROOM_FLOOR, COLOR_ROOM_FLOOR2, COLOR_WALL, COLOR_WALL_INNER,
  COLOR_DESK_BODY, COLOR_DESK_TOP, COLOR_HEADER_BG, COLOR_DOOR_FRAME,
  COLOR_POD_EDGE, COLOR_POD_GROOVE, COLOR_DOOR_FILL, COLOR_DOOR_ACCENT,
  COLOR_LED_GREEN, COLOR_LED_AMBER, COLOR_LED_GRAY,
  WORLD_MARGIN, ZOOM_MIN, ZOOM_MAX, ZOOM_FIT_MAX, ZOOM_LERP_SPEED, FOLLOW_LERP_SPEED,
  LOD_L1_MAX, LOD_L2_MAX,
  MINIMAP_W, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_BG, MINIMAP_ROOM_COLOR,
  MINIMAP_VIEWPORT_COLOR, MINIMAP_REFRESH_MS,
  TRIPLET_REFRESH_MS, AMBIENT_MOTE_POOL_SIZE,
} from './office-constants'


// ---------------------------------------------------------------------------
// OfficeScene — Interfaces extracted to office-types.ts
// ---------------------------------------------------------------------------

// (WorkstationSprite, Room, TeamAreaLayout, MinimapProjection, TripletLineInfo,
//  OfficeDebugSnapshot are imported from ./office-types)

// WorkstationSprite — moved to ./office-types
// (WorkstationSprite body deleted — see office-types.ts)
// (WorkstationSprite moved to office-types.ts)

// Room — moved to ./office-types

// ---------------------------------------------------------------------------
// OfficeScene
// ---------------------------------------------------------------------------

// TripletLineInfo, TeamAreaLayout, MinimapProjection — moved to ./office-types

// OfficeDebugSnapshot — moved to ./office-types

export class OfficeScene extends Phaser.Scene {
  private pendingAgents: AgentState[] | null = null
  private isReady = false

  private rooms = new Map<string, Room>()
  private agents: AgentState[] = []
  private worldWidth  = 2400
  private worldHeight = 1200
  private viewWidth   = 800
  private viewHeight  = 600

  private officeTilesLoaded = false
  private roomTilesLoaded   = false

  private isDraggingAgent = false

  // Fix 11: Triplet connecting lines
  private tripletLines: TripletLineInfo[] = []
  private tripletGraphics: Phaser.GameObjects.Graphics | null = null

  // Chat connection animations between agents
  private chatLineGraphics: Phaser.GameObjects.Graphics | null = null
  private chatAnimations: Array<{
    fromPos: { x: number; y: number }
    toPos: { x: number; y: number }
    controlPt: { x: number; y: number }
    dot: Phaser.GameObjects.Arc
    startTime: number
    travelDuration: number
    fadeDuration: number
    fadeStart: number
    lineAlpha: number
    expired: boolean
  }> = []

  // Office background (standalone, not a container)
  private officeGraphics: Phaser.GameObjects.Graphics | null = null
  private teamAreaGraphics: Phaser.GameObjects.Graphics | null = null
  private corridorGraphics: Phaser.GameObjects.Graphics | null = null
  private hallwayIndicatorGraphics: Phaser.GameObjects.Graphics | null = null
  // Floor arrow lighting — emergency-exit-style chevrons pulsing toward active rooms
  private floorArrowGfx: Phaser.GameObjects.Graphics | null = null
  private lastFloorArrowAt = 0
  private officeDecoSprites: Phaser.GameObjects.Sprite[] = []
  private seasonalDecos: Phaser.GameObjects.GameObject[] = []
  private cafe!: PennyCafe
  private cafeFloorMask: Phaser.GameObjects.Graphics | null = null
  private navMesh = new NavMesh()
  private decoTweens: Phaser.Tweens.Tween[] = []
  private waterCoolerBubbleTimer: Phaser.Time.TimerEvent | null = null
  private whiteboardContainer: Phaser.GameObjects.Container | null = null
  private whiteboardTexts: Phaser.GameObjects.Text[] = []
  private flagContainer: Phaser.GameObjects.Container | null = null
  private lastWhiteboardUpdateAt = 0
  private teamAreaLabels: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = []
  private corridorSegments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> = []
  private corridorSignTexts: Phaser.GameObjects.Text[] = []
  private lastOfficeBgW = 0
  private lastOfficeBgH = 0
  // Window animation
  private windowGlintGfx: Phaser.GameObjects.Graphics | null = null
  private windowPositions: { x: number; y: number; w: number; h: number }[] = []
  private windowTintColor = 0x7dd3fc
  private windowTintAlpha = 0.16
  private lastGlintAt = 0
  private glintActiveWindow = -1
  private glintStartTime = 0
  private readonly GLINT_INTERVAL = 3000
  private readonly GLINT_DURATION = 600

  // Particle / effect pool systems — managed by OfficeParticles
  private particles!: OfficeParticles

  // Atmosphere — day/night, sky, clouds, stars, clock, ceiling lights
  private atmosphere!: OfficeAtmosphere

  // Starfield — subtle background stars behind the building
  private starPool: Phaser.GameObjects.Arc[] = []
  private lastTwinkleAt = 0

  // Cloud layer — slow-moving hazy shapes drifting across the sky area
  private cloudPool: Phaser.GameObjects.Graphics[] = []
  private cloudTimer: Phaser.Time.TimerEvent | null = null

  // Rich hover tooltip (screen-space, animated)
  private tooltipContainer: Phaser.GameObjects.Container | null = null
  private tooltipGraphics: Phaser.GameObjects.Graphics | null = null
  private tooltipFadeTween: Phaser.Tweens.Tween | null = null
  // World-space highlight ring around hovered desk
  private hoverRingGraphics: Phaser.GameObjects.Graphics | null = null

  // Theme transition
  private bgTransitionTween: Phaser.Tweens.Tween | null = null

  // Day/night cycle
  private dayNightOverlay: Phaser.GameObjects.Rectangle | null = null
  private skyGradient: Phaser.GameObjects.Graphics | null = null
  private dayNightTimer: Phaser.Time.TimerEvent | null = null
  private currentTimePhase: 'morning' | 'day' | 'evening' | 'night' = 'day'
  private shadowAngle = 0
  private lastShadowUpdateAt = 0
  // Subtle screen-space edge shading to frame the office.
  private vignetteFx: Phaser.FX.Vignette | null = null

  // Keyboard selection state
  private selectedAgentIndex = -1
  private selectionRing: Phaser.GameObjects.Graphics | null = null
  private selectionRingOuter: Phaser.GameObjects.Graphics | null = null
  private selectionRingTween: Phaser.Tweens.Tween | null = null
  private selectionRingRotateTween: Phaser.Tweens.Tween | null = null
  private selectionRingBreatheTween: Phaser.Tweens.Tween | null = null
  private selectionRingPosTween: Phaser.Tweens.Tween | null = null
  private selectionRingCurrentPos: { x: number; y: number } | null = null

  // Auto-pan (Space to cycle camera across agents)
  private autoPanEnabled = false
  private autoPanTimer: Phaser.Time.TimerEvent | null = null
  private autoPanIndex = 0

  // Default camera snapshot (for R reset)
  private defaultCameraX = 0
  private defaultCameraY = 0
  private defaultCameraZoom = 1
  private hasInitialZoomToFit = false

  // Notification toasts (screen-space)
  private toastContainer: Phaser.GameObjects.Container | null = null
  private activeToasts: { container: Phaser.GameObjects.Container; createdAt: number }[] = []

  // Camera & navigation state
  private targetZoom = 1
  private followTarget: { x: number; y: number } | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  /** Current LOD level: 1=overview, 2=room, 3=full detail. Initialized to 3 so first frame always applies the correct state. */
  private lastLodLevel = 3
  /** Screen-space label shown briefly on LOD transitions */
  private lodLabelContainer: Phaser.GameObjects.Container | null = null
  private lodLabelFadeTween: Phaser.Tweens.Tween | null = null
  private minimapContainer: Phaser.GameObjects.Container | null = null
  private minimapGraphics: Phaser.GameObjects.Graphics | null = null
  private minimapViewport: Phaser.GameObjects.Graphics | null = null
  private minimapHitZone: Phaser.GameObjects.Rectangle | null = null
  private minimapProjection: MinimapProjection | null = null
  private minimapPanning = false
  private minimapDirty = true
  private minimapRoomFlashes = new Map<string, { until: number; color: number }>()
  private minimapHoverLabel: Phaser.GameObjects.Text | null = null
  private minimapHoverBg: Phaser.GameObjects.Graphics | null = null
  private minimapHoverLine: Phaser.GameObjects.Graphics | null = null
  private lastMinimapDrawAt = 0
  private lastCamScrollX = 0
  private lastCamScrollY = 0
  private lastCamZoom = 1
  private tripletDirty = true
  private lastTripletDrawAt = 0
  private lastHallwayPulseAt = 0
  private pendingCameraRecoveryUntil = 0

  // Animated ceiling light fixtures
  private ceilingLights: Phaser.GameObjects.Container[] = []
  private lastLightCheckAt = 0
  private lightActivityMode: 'active' | 'idle' = 'idle'

  // Exterior building lights (entrance + wall sconces), respond to day/night cycle
  private exteriorLights: Phaser.GameObjects.Container | null = null

  // Animated analog wall clock
  private wallClockContainer: Phaser.GameObjects.Container | null = null
  private clockHourHand: Phaser.GameObjects.Graphics | null = null
  private clockMinuteHand: Phaser.GameObjects.Graphics | null = null
  private clockSecondHand: Phaser.GameObjects.Graphics | null = null
  private lastClockTick = 0
  private lastChimeHour = -1

  // Keyboard shortcut help overlay
  private helpOverlay: Phaser.GameObjects.Container | null = null
  private helpVisible = false

  // Debug overlay (backtick toggle)
  private debugOverlayVisible = false
  private debugOverlayContainer: Phaser.GameObjects.Container | null = null
  private debugFpsText: Phaser.GameObjects.Text | null = null
  private debugObjectCountText: Phaser.GameObjects.Text | null = null
  private debugNavMeshGfx: Phaser.GameObjects.Graphics | null = null
  private debugPathGfx: Phaser.GameObjects.Graphics | null = null
  private lastDebugRefreshAt = 0

  // Focus mode — cinematic deep-zoom on a single agent's workstation
  private focusedAgentId: string | null = null
  private focusDimOverlay: Phaser.GameObjects.Graphics | null = null
  private focusDimTween: Phaser.Tweens.Tween | null = null
  private focusedWorkstationPrevDepth: number | null = null

  // Screen-space status bar (top of viewport)
  private statusBarContainer: Phaser.GameObjects.Container | null = null
  private statusBarBg: Phaser.GameObjects.Rectangle | null = null
  private statusBarAgentText: Phaser.GameObjects.Text | null = null
  private statusBarActiveText: Phaser.GameObjects.Text | null = null
  private statusBarRoomText: Phaser.GameObjects.Text | null = null
  private statusBarTimeText: Phaser.GameObjects.Text | null = null
  private lastStatusBarUpdateAt = 0

  // Notification bell (screen-space, top-right near minimap)
  // Log panel toggled by clicking the bell
  private bellLogPanel: Phaser.GameObjects.Container | null = null
  private bellLogVisible = false
  private lastStatusBarTimeUpdateAt = 0

  // Ambient office-life activity timer (paper airplanes, coffee refills, phone rings, etc.)
  private ambientActivityTimer: Phaser.Time.TimerEvent | null = null

  // PA system broadcast banner (screen-space, below status bar)
  private broadcastBannerContainer: Phaser.GameObjects.Container | null = null
  private broadcastBannerBg: Phaser.GameObjects.Rectangle | null = null
  private broadcastBannerText: Phaser.GameObjects.Text | null = null
  private broadcastScrollTween: Phaser.Tweens.Tween | null = null
  private broadcastFadeTimer: Phaser.Time.TimerEvent | null = null
  private broadcastLedTimer: Phaser.Time.TimerEvent | null = null
  private broadcastHandler: ((msg: unknown) => void) | null = null

  constructor() {
    super({ key: 'OfficeScene' })
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  preload(): void {
    this.load.spritesheet('characters', '/sprites/characters.png', {
      frameWidth:  CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet('office', '/sprites/office-tiles.png', {
      frameWidth:  OFFICE_TILE_SIZE,
      frameHeight: OFFICE_TILE_SIZE,
    })
    this.load.spritesheet('rooms', '/sprites/room-tiles.png', {
      frameWidth:  ROOM_TILE_SIZE,
      frameHeight: ROOM_TILE_SIZE,
    })
    this.load.spritesheet('duder1', '/sprites/duder-compact.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet('duder2', '/sprites/duder-compact-2.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    // Individual animation strips (_256 PNGs, 256×512 per frame — same as main spritesheet)
    // Walk: 3072×512 = 12 frames (step-A: 8 rotations + step-B: 4 rotations)
    // Idle: 1024×512 = 4 frames (4 rotations)
    // Sit:  1024×512 = 4 frames (4 rotations)
    const ANIM_FW = 256, ANIM_FH = 512
    this.load.spritesheet('anim-walk-1', '/sprites/walk-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-walk-2', '/sprites/walk-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-idle-1', '/sprites/idle-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-idle-2', '/sprites/idle-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-sit-1',  '/sprites/sit-1.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-sit-2',  '/sprites/sit-2.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.on('filecomplete-spritesheet-office', () => { this.officeTilesLoaded = true })
    this.load.on('filecomplete-spritesheet-rooms',  () => { this.roomTilesLoaded   = true })
  }

  create(): void {
    this.cafe = new PennyCafe(this as unknown as CafeHostScene)

    const cam = this.cameras.main
    cam.setBackgroundColor(COLOR_BG)
    this.lastCamScrollX = cam.scrollX
    this.lastCamScrollY = cam.scrollY
    this.lastCamZoom = cam.zoom

    this.viewWidth  = this.scale.width
    this.viewHeight = this.scale.height

    // Office background (drawn behind rooms, updated in layoutRooms)
    this.officeGraphics = this.add.graphics()
    this.teamAreaGraphics = this.add.graphics()
    // Corridor overlays sit above the building floor, below room containers.
    this.corridorGraphics = this.add.graphics()
    this.hallwayIndicatorGraphics = this.add.graphics()
    this.officeGraphics.setDepth(-4)
    this.teamAreaGraphics.setDepth(-3)
    this.corridorGraphics.setDepth(-2)
    // Floor arrows: depth -1.5 — between corridors (-2) and hallway indicators (-1)
    this.floorArrowGfx = this.add.graphics().setDepth(-1.5)
    this.chatLineGraphics = this.add.graphics().setDepth(200)
    this.hallwayIndicatorGraphics.setDepth(-1)

    // Sky gradient — deepest background layer, behind stars and clouds
    const skyGradient = this.add.graphics().setDepth(-11)
    this.skyGradient = skyGradient

    // Day/night cycle overlay (must be created before atmosphere.init)
    this.dayNightOverlay = this.add
      .rectangle(0, 0, 8000, 8000, 0x000000, 0)
      .setOrigin(0, 0)
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
      invalidateOfficeBgCache: () => { this.lastOfficeBgW = 0 },
      showToast: (msg, type) => this.showToast(msg, type),
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
    this.particles.setCorridorData(this.corridorSegments, false)

    // Camera pan -- cancel follow on manual drag
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.isDraggingAgent) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
        this.followTarget = null
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
    this.targetZoom = cam.zoom
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, _gz: unknown, deltaY: number) => {
        this.targetZoom = Phaser.Math.Clamp(this.targetZoom - deltaY * 0.001, this.getMinZoom(), ZOOM_MAX)
        this.followTarget = null
      },
    )

    // Double-click on empty space resets camera (zoom-to-fit).
    // Single-click anywhere while in focus mode exits focus mode.
    let lastSceneClickTime = 0
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const now = Date.now()
      // Exit focus mode on any click when active
      if (this.focusedAgentId !== null) {
        this.exitFocusMode()
        lastSceneClickTime = now
        return
      }
      if (now - lastSceneClickTime < 350) {
        const wp = cam.getWorldPoint(p.x, p.y)
        if (!this.getAgentAtWorldPoint(wp.x, wp.y)) {
          this.zoomToFit(true)
        }
      }
      lastSceneClickTime = now
    })

    // Resize — re-layout rooms when viewport changes (debounced)
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.viewWidth  = gameSize.width
      this.viewHeight = gameSize.height

      // Cheap UI repositioning — do immediately
      this.repositionMinimap()
      this.repositionStatusBar()
      this.minimapDirty = true

      // Expensive layout recomputation — debounce 100ms
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null
        this.lastOfficeBgW = 0
        this.lastOfficeBgH = 0
        if (this.rooms.size > 0) {
          this.layoutRooms()
          this.updateCameraBounds()
          this.zoomToFit(true)
        }
      }, 100)
    })

    // Save default camera position for R reset
    this.defaultCameraX = cam.scrollX
    this.defaultCameraY = cam.scrollY
    this.defaultCameraZoom = cam.zoom

    // Selection ring graphics (drawn in world space, repositioned on select)
    // Inner ring: solid, theme-colored
    this.selectionRing = this.add.graphics().setDepth(9999)
    // Outer ring: dashed appearance via arc segments, slowly rotates
    this.selectionRingOuter = this.add.graphics().setDepth(9998)

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
        this.cycleSelectedAgent(e.shiftKey ? -1 : 1)
      })

      this.input.keyboard.on('keydown-ENTER', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.confirmSelectedAgent()
      })

      this.input.keyboard.on('keydown-ESC', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.helpVisible) { this.hideHelpOverlay(); return }
        if (this.focusedAgentId !== null) { this.exitFocusMode(); return }
        this.deselectAgent()
        this.stopAutoPan()
      })

      this.input.keyboard.on('keydown-F', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.zoomToFitAll()
      })
      this.input.keyboard.on('keydown-R', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.resetCamera()
      })
      this.input.keyboard.on('keydown-SPACE', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.toggleAutoPan()
      })

      // +/= and - for zoom
      this.input.keyboard.on('keydown-PLUS', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.kbSmoothZoom(KB_ZOOM_STEP)
      })
      this.input.keyboard.on('keydown-MINUS', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        this.kbSmoothZoom(-KB_ZOOM_STEP)
      })

      // Number keys 1-9: jump to agent by index
      for (let n = 1; n <= 9; n++) {
        this.input.keyboard.on(`keydown-${n}`, (e: KeyboardEvent) => {
          if (shouldIgnoreKeyboardShortcuts(e)) return
          this.selectAgentByIndex(n - 1)
        })
      }

      // H / ? — toggle keyboard shortcut help overlay
      const toggleHelp = (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.helpVisible) {
          this.hideHelpOverlay()
        } else {
          this.showHelpOverlay()
        }
      }
      this.input.keyboard.on('keydown-H', toggleHelp)
      this.input.keyboard.on('keydown-QUESTION_MARK', toggleHelp)

      // Backtick — toggle debug overlay (dev only)
      this.input.keyboard.on('keydown-BACKTICK', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.toggleDebugOverlay()
      })
    }

    // Create minimap overlay
    this.initMinimap()
    this.minimapDirty = true

    // Vignette: subtle screen-space edge shading
    this.vignetteFx = this.cameras.main.postFX.addVignette(0.5, 0.5, 0.85, 0.35)

    // Notification toast container (screen-space, top-right)
    this.toastContainer = this.add.container(0, 0).setDepth(9998).setScrollFactor(0)

    // Notification bell (top-right corner, above minimap)

    // Screen-space status bar (pinned to top of viewport)
    this.buildStatusBar()

    // Ambient office-life activity — fires every 8-15 seconds with a random incidental event
    this.scheduleNextAmbientActivity()

    // PA system broadcast — listen for cross-component broadcast events
    this.broadcastHandler = (msg: unknown) => this.showBroadcastEffect(String(msg))
    EventBus.on(EVENTS.BROADCAST, this.broadcastHandler)

    this.isReady = true
    this.cafe.startCoffeeRunTimer()
    if (this.pendingAgents) {
      this.setAgents(this.pendingAgents)
      this.pendingAgents = null
    }
  }

  // ---------------------------------------------------------------------------
  // Update loop (smooth zoom, follow, LOD, minimap)
  // ---------------------------------------------------------------------------

  update(time: number, _delta: number): void {
    const cam = this.cameras.main

    // Smooth zoom lerp
    const zoomDiff = this.targetZoom - cam.zoom
    if (Math.abs(zoomDiff) > 0.001) {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + zoomDiff * ZOOM_LERP_SPEED, this.getMinZoom(), ZOOM_MAX))
    } else if (Math.abs(zoomDiff) > 0) {
      cam.setZoom(this.targetZoom)
    }

    // Smooth camera follow
    if (this.followTarget) {
      const cx = cam.scrollX + cam.width / (2 * cam.zoom)
      const cy = cam.scrollY + cam.height / (2 * cam.zoom)
      const dx = this.followTarget.x - cx
      const dy = this.followTarget.y - cy
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        cam.scrollX += dx * FOLLOW_LERP_SPEED
        cam.scrollY += dy * FOLLOW_LERP_SPEED
      } else {
        cam.scrollX += dx
        cam.scrollY += dy
        this.followTarget = null
      }
    }

    // Short safety window after layout/data changes to ensure agents stay discoverable.
    if (this.pendingCameraRecoveryUntil > 0 && this.rooms.size > 0) {
      if (!this.isAnyRoomVisible()) {
        this.followTarget = null
        this.zoomToFit(false)
      } else {
        this.pendingCameraRecoveryUntil = 0
      }
      if (time >= this.pendingCameraRecoveryUntil) {
        this.pendingCameraRecoveryUntil = 0
      }
    }

    // Zoom-dependent multi-level LOD
    const lodLevel = cam.zoom < LOD_L1_MAX ? 1 : cam.zoom <= LOD_L2_MAX ? 2 : 3
    if (lodLevel !== this.lastLodLevel) {
      this.lastLodLevel = lodLevel
      this.applyLod(lodLevel)
    }

    const hasAnimatedTriplets = this.tripletLines.some(t => this.isTripletAnimatedStatus(t.status))
    if (this.tripletLines.length > 0 && (this.tripletDirty || hasAnimatedTriplets) && time - this.lastTripletDrawAt >= TRIPLET_REFRESH_MS) {
      this.drawTripletLines(time)
      this.lastTripletDrawAt = time
      this.tripletDirty = false
    }
    if (this.corridorSegments.length > 0 && time - this.lastHallwayPulseAt >= 90) {
      this.drawHallwayIndicators(time)
      this.lastHallwayPulseAt = time
    }
    // Keep particle system informed about active agent state for corridor particles
    if (this.particles) {
      const hasActiveAgent = this.agents.some(
        a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
      )
      this.particles.setCorridorData(this.corridorSegments, hasActiveAgent)
    }
    // Floor arrows — only at room/full-detail zoom, throttled to 200ms
    if (cam.zoom > LOD_L1_MAX && this.rooms.size > 0 && time - this.lastFloorArrowAt >= 200) {
      this.drawFloorArrows(time)
      this.lastFloorArrowAt = time
    } else if (cam.zoom <= LOD_L1_MAX && this.floorArrowGfx) {
      this.floorArrowGfx.clear()
    }

    // Minimap refresh (throttled + dirty on camera/data movement)
    const cameraChanged =
      Math.abs(cam.scrollX - this.lastCamScrollX) > 0.5 ||
      Math.abs(cam.scrollY - this.lastCamScrollY) > 0.5 ||
      Math.abs(cam.zoom - this.lastCamZoom) > 0.001
    if (cameraChanged) {
      this.lastCamScrollX = cam.scrollX
      this.lastCamScrollY = cam.scrollY
      this.lastCamZoom = cam.zoom
      this.minimapDirty = true
    }
    this.tickMinimapRoomFlashes(time)
    if (this.minimapDirty && time - this.lastMinimapDrawAt >= MINIMAP_REFRESH_MS) {
      this.drawMinimap()
      this.lastMinimapDrawAt = time
      this.minimapDirty = false
    }

    // Debug overlay refresh (throttled to 250ms)
    if (this.debugOverlayVisible && time - this.lastDebugRefreshAt >= 250) {
      this.refreshDebugOverlay(time, _delta)
      this.lastDebugRefreshAt = time
    }

    if (this.particles.isRainActive()) this.particles.tickRain(this.viewWidth, this.viewHeight)
    if (this.particles.isSnowActive()) this.particles.tickSnow(time, this.viewWidth, this.viewHeight)
    this.atmosphere.tickWindowGlint(time)
    this.atmosphere.tick(time, this.particles.isRainActive(), this.particles.isSnowActive())
    this.atmosphere.tickCeilingLightActivity(time, this.rooms)
    if (this.atmosphere.wallClockContainer && time - this.lastClockTick >= 1000) {
      this.lastClockTick = time
      this.atmosphere.tickWallClock()
    }
    if (this.whiteboardContainer && time - this.lastWhiteboardUpdateAt >= 5000) {
      this.lastWhiteboardUpdateAt = time
      this.updateWhiteboardStats()
    }
    if (time - this.lastShadowUpdateAt >= 5000) {
      this.lastShadowUpdateAt = time
      this.atmosphere.updateShadows(this.rooms)
    }

    // Status bar: agent stats every 3s, clock label every 60s
    if (this.statusBarContainer && time - this.lastStatusBarUpdateAt >= 3000) {
      this.lastStatusBarUpdateAt = time
      this.updateStatusBar()
    }
    if (this.statusBarTimeText && time - this.lastStatusBarTimeUpdateAt >= 60_000) {
      this.lastStatusBarTimeUpdateAt = time
      this.refreshStatusBarTime()
    }

    // Chat animations — advance traveling dots and fade expired lines
    if (this.chatAnimations.length > 0) {
      this.tickChatAnimations(time)
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

    const allAgents = [...agents]
    
    // Convert external CLI sessions to agent states and merge.
    if (opencodeSessions && opencodeSessions.length > 0) {
      for (const session of opencodeSessions) {
        const runtime = session.runtime ?? 'opencode'
        const runtimeTitle =
          runtime === 'openclaw' ? 'OpenClaw' :
          runtime === 'nemoclaw' ? 'NemoClaw' :
          'OpenCode'
        const cpuVal = parseFloat(session.cpu || '0')
        allAgents.push({
          config: {
            id: `${runtime}-${session.pid}`,
            name: runtime,
            title: runtimeTitle,
            tripletRole: 'solver',
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
          sessionMode: (cpuVal >= 1 ? 'working' : 'idle') as const,
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
        this.destroyRoom(room)
        this.rooms.delete(cwd)
      }
    }

    // Create or update
    for (const [cwd, roomAgents] of grouped) {
      const { key: teamKey, label: teamLabel } = this.getTeamInfo(cwd)
      const existing = this.rooms.get(cwd)
      if (existing) {
        existing.teamKey = teamKey
        existing.teamLabel = teamLabel
        this.updateRoom(existing, roomAgents)
      } else {
        const label = this.cwdToLabel(cwd)
        const room = this.createRoom(cwd, label, teamKey, teamLabel, roomAgents)
        this.rooms.set(cwd, room)
      }
    }

    this.layoutRooms()
    this.updateCameraBounds()
    this.minimapDirty = true
    this.updateWhiteboardStats()

    // Keep live agents visible on each refresh.
    if (this.rooms.size > 0) {
      this.hasInitialZoomToFit = true
      this.followTarget = null
      this.zoomToFit(false)
      this.pendingCameraRecoveryUntil = this.time.now + 1500
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

  /** Update active triplet workflows for connecting lines (Fix 11) */
  setTripletWorkflows(workflows: TripletLineInfo[]): void {
    this.tripletLines = workflows
    this.tripletDirty = true
    this.drawTripletLines(this.time.now)
    this.lastTripletDrawAt = this.time.now
  }

  /** Highlight a workstation for drag-over feedback */
  highlightAgentDesk(agentId: string, highlight: boolean): void {
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        if (highlight) {
          ws.deskBody.setStrokeStyle(3, 0x3b82f6, 1)
        } else {
          this.restoreDeskStroke(ws)
        }
        return
      }
    }
  }

  /** Public: smooth-pan camera to center on a specific agent */
  panToAgent(agentId: string): void {
    const pos = this.getWorkstationWorldPos(agentId)
    if (pos) {
      this.followTarget = { x: pos.x, y: pos.y }
      if (this.targetZoom < 0.8) this.targetZoom = 0.9
    }
  }

  // ---------------------------------------------------------------------------
  // PA system broadcast effect
  // ---------------------------------------------------------------------------

  /**
   * Displays a marquee banner below the status bar and pulses all room LEDs
   * amber — triggered whenever the user broadcasts a message to all agents.
   */
  public showBroadcastEffect(message: string): void {
    const viewW = this.scale.width
    const BANNER_Y = 28
    const BANNER_H = 30
    const BANNER_COLOR = 0x0f172a
    const BANNER_ALPHA = 0.9
    const TEXT_COLOR = '#fbbf24'
    const DURATION_MS = 5000
    const FADE_MS = 400

    // Tear down any existing broadcast banner before creating a new one
    this._destroyBroadcastBanner()

    // Container pinned to screen space (ignores camera scroll)
    this.broadcastBannerContainer = this.add.container(0, BANNER_Y)
      .setDepth(9999)
      .setScrollFactor(0)

    // Dark background strip
    this.broadcastBannerBg = this.add.rectangle(0, 0, viewW, BANNER_H, BANNER_COLOR, BANNER_ALPHA)
      .setOrigin(0, 0)
    this.broadcastBannerContainer.add(this.broadcastBannerBg)

    // Amber accent line at the top edge of the banner
    const accentLine = this.add.rectangle(0, 0, viewW, 2, 0xfbbf24, 0.7).setOrigin(0, 0)
    this.broadcastBannerContainer.add(accentLine)

    // Scrolling text — starts just off the right edge, scrolls to past the left edge
    const label = '\u{1F4E2}  BROADCAST:  ' + message
    this.broadcastBannerText = this.add.text(viewW + 10, BANNER_H / 2, label, {
      fontSize: '10px',
      fontFamily: 'ui-monospace, monospace',
      color: TEXT_COLOR,
      resolution: 2,
    }).setOrigin(0, 0.5)
    this.broadcastBannerContainer.add(this.broadcastBannerText)

    // Marquee: scroll the text from right to left over the active duration
    const textW = this.broadcastBannerText.width
    this.broadcastScrollTween = this.tweens.add({
      targets: this.broadcastBannerText,
      x: -(textW + 10),
      duration: DURATION_MS - FADE_MS,
      ease: 'Linear',
    })

    // Pulse all room status LEDs amber 3 times (6 timer ticks: on/off x3)
    let pulseCount = 0
    this.broadcastLedTimer = this.time.addEvent({
      delay: 500,
      repeat: 5,
      callback: () => {
        pulseCount++
        const isOn = pulseCount % 2 === 1
        for (const room of this.rooms.values()) {
          if (isOn) {
            room.statusLed.setFillStyle(COLOR_LED_AMBER, 1)
            room.statusLedGlow?.setFillStyle(COLOR_LED_AMBER, 0.4)
          } else {
            const restoreColor =
              room.ledMode === 'active'  ? COLOR_LED_GREEN :
              room.ledMode === 'waiting' ? COLOR_LED_AMBER : COLOR_LED_GRAY
            room.statusLed.setFillStyle(restoreColor, 1)
            room.statusLedGlow?.setFillStyle(restoreColor, 0.25)
          }
        }
      },
    })

    // After the scroll completes, fade the banner out then destroy it
    this.broadcastFadeTimer = this.time.delayedCall(DURATION_MS - FADE_MS, () => {
      if (!this.broadcastBannerContainer) return
      this.tweens.add({
        targets: this.broadcastBannerContainer,
        alpha: 0,
        duration: FADE_MS,
        ease: 'Sine.easeIn',
        onComplete: () => this._destroyBroadcastBanner(),
      })
    })
  }

  private _destroyBroadcastBanner(): void {
    if (this.broadcastScrollTween) { this.broadcastScrollTween.destroy(); this.broadcastScrollTween = null }
    if (this.broadcastFadeTimer)   { this.broadcastFadeTimer.destroy();   this.broadcastFadeTimer   = null }
    if (this.broadcastLedTimer)    { this.broadcastLedTimer.destroy();    this.broadcastLedTimer    = null }
    if (this.broadcastBannerContainer) {
      this.tweens.killTweensOf(this.broadcastBannerContainer)
      this.broadcastBannerContainer.destroy(true)
      this.broadcastBannerContainer = null
    }
    this.broadcastBannerBg   = null
    this.broadcastBannerText = null
  }

  /** Switch theme with smooth 500ms background color transition */
  setTheme(theme: ThemeName): void {
    const { oldBg, newBg } = setActiveTheme(theme)
    if (oldBg === newBg) return
    if (this.bgTransitionTween) { this.bgTransitionTween.destroy(); this.bgTransitionTween = null }
    const cam = this.cameras.main
    this.bgTransitionTween = this.tweens.addCounter({
      from: 0, to: 100, duration: 500, ease: 'Sine.easeInOut',
      onUpdate: (tw) => { cam.setBackgroundColor(lerpColor(oldBg, newBg, tw.getValue() / 100)) },
      onComplete: () => { cam.setBackgroundColor(newBg) },
    })
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
    const t = activeTheme
    for (const room of this.rooms.values()) {
      this.drawRoomBackground(room)
      for (const ws of room.workstations.values()) {
        ws.deskBody.setFillStyle(t.deskBody)
        ws.deskTop.setFillStyle(t.deskTop)
        this.restoreDeskStroke(ws)
        if (ws.monitorGlowFx) {
          const isWorking = ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction
          const isWaiting = ws.state?.needsInteraction
          ws.monitorGlowFx.color = isWaiting ? t.deskStrokeWaiting : isWorking ? t.monitorGlowActive : t.monitorGlowIdle
        }
        ws.lastAnimMode = undefined
        if (ws.state) this.updateWorkstation(ws, ws.state)
      }
    }
    if (this.officeGraphics) {
      let maxX = 0, maxY = 0
      for (const room of this.rooms.values()) {
        maxX = Math.max(maxX, room.x + room.width / 2)
        maxY = Math.max(maxY, room.y + room.height / 2)
      }
      // Background is drawn by layoutRooms which has café bounds for L-shape
    }
    this.tripletDirty = true
    this.drawTripletLines(this.time.now)
    this.lastTripletDrawAt = this.time.now
  }

  // ---------------------------------------------------------------------------
  // Room creation
  // ---------------------------------------------------------------------------

  private createRoom(cwd: string, label: string, teamKey: string, teamLabel: string, agents: AgentState[]): Room {
    const { width, height } = this.calcRoomSize(agents.length)
    const container = this.add.container(0, 0)
    const floorGraphics = this.add.graphics()
    container.add(floorGraphics)

    const activityBar = this.add.rectangle(-width / 2, height / 2 + 2, 0, 2, 0x34d399, 1).setOrigin(0, 0)
    container.add(activityBar)
    const waitingBar = this.add.rectangle(-width / 2, height / 2 - 1, 0, 2, 0xfbbf24, 0.95).setOrigin(0, 0)
    container.add(waitingBar)

    // Status LED indicator (top-left of header, next to room name)
    const ledWallT = 6
    const ledWallI = 2
    const ledX = -width / 2 + ledWallT + ledWallI + 10
    const ledY = -height / 2 + ledWallT + ledWallI + ROOM_HEADER_H / 2
    const statusLedGlow = this.add.circle(ledX, ledY, 6, COLOR_LED_GRAY, 0.15)
    container.add(statusLedGlow)
    const statusLed = this.add.circle(ledX, ledY, 3, COLOR_LED_GRAY, 1)
    container.add(statusLed)

    // Door graphics — separate objects so they can be animated independently.
    // doorFrameGraphics holds the accent frame (alpha-pulsed when room is active).
    // doorGraphics holds the door panel itself (scaleX-animated on headcount change).
    const doorFrameGraphics = this.add.graphics()
    container.add(doorFrameGraphics)
    const doorGraphics = this.add.graphics()
    container.add(doorGraphics)

    // Heat overlay — warm amber rectangle over the floor area.
    // Alpha starts at 0; tweened toward heat * 0.06 in updateRoomActivity
    // for a barely-perceptible thermal camera warmth on busy rooms.
    const heatOverlay = this.add.rectangle(0, 0, width, height, 0xfbbf24, 0)
    heatOverlay.setDepth(0.5) // above floor graphics, below workstation containers
    container.add(heatOverlay)

    const room: Room = {
      cwd, label, teamKey, teamLabel, agents,
      x: 0, y: 0, width, height,
      container,
      workstations: new Map(),
      floorGraphics,
      activityBar, activityBarTween: null,
      waitingBar, waitingBarTween: null,
      statusLed, statusLedGlow, statusLedTween: null,
      ledMode: 'idle',
      doorGraphics, doorFrameGraphics, doorPulseTween: null,
      prevAgentCount: agents.length,
      statusStrip: null, statusStripTween: null,
      badgeDotTween: null,
      heatOverlay,
      heatTween: undefined,
      doorSide: 'bottom',
    }

    this.drawRoomBackground(room)
    this.syncWorkstations(room, agents)
    this.updateRoomActivity(room)
    this.updateDoorGlow(room)
    return room
  }

  private updateRoom(room: Room, agents: AgentState[]): void {
    room.agents = agents
    const { width, height } = this.calcRoomSize(agents.length)
    const sizeChanged = width !== room.width || height !== room.height
    room.width  = width
    room.height = height
    if (sizeChanged) this.drawRoomBackground(room)
    this.syncWorkstations(room, agents)
    this.updateRoomActivity(room)
    this.updateDoorGlow(room)
  }

  private destroyRoom(room: Room): void {
    if (room.activityBarTween) room.activityBarTween.destroy()
    if (room.waitingBarTween) room.waitingBarTween.destroy()
    if (room.statusLedTween) room.statusLedTween.destroy()
    if (room.doorPulseTween) room.doorPulseTween.destroy()
    if (room.statusStripTween) room.statusStripTween.destroy()
    if (room.badgeDotTween) room.badgeDotTween.destroy()
    if (room.heatTween) room.heatTween.destroy()
    if (room.heatOverlay) room.heatOverlay.destroy()
    if (room.floorTileSprites) {
      for (const s of room.floorTileSprites) s.destroy()
      room.floorTileSprites = []
    }
    if (room.miniWhiteboard) {
      room.miniWhiteboard.destroy()
      room.miniWhiteboard = undefined
    }
    if (room.miniWhiteboardTexts) {
      for (const t of room.miniWhiteboardTexts) t.destroy()
      room.miniWhiteboardTexts = []
    }
    for (const ws of room.workstations.values()) {
      this.destroyWorkstation(ws)
    }
    room.workstations.clear()
    room.container.destroy()
  }

  // ---------------------------------------------------------------------------
  // Room background drawing
  // ---------------------------------------------------------------------------

  private drawRoomBackground(room: Room): void {
    const g = room.floorGraphics
    g.clear()

    const w = room.width
    const h = room.height

    // Keep heat overlay sized to match the room floor when dimensions change.
    if (room.heatOverlay) {
      room.heatOverlay.setSize(w, h)
    }

    const WALL_T = 3          // thinner than outer building walls (5)
    const WALL_I = 1
    // Directory-based theming — deterministic colors per room type
    const template = getTemplate(getRoomType(room.cwd))
    const roomStyle = {
      wallOuter: 0x475569,
      wallInner: 0x64748b,
      floor: template.floorColor,
      floorGrid: template.rugColor,
      header: COLOR_HEADER_BG,
      accent: template.accentColor,
      rug: template.rugColor,
    }

    // Subtle drop shadow
    g.fillStyle(0x000000, 0.15)
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 6)

    // Outer wall
    g.fillStyle(roomStyle.wallOuter)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 5)

    // Inner wall highlight
    g.fillStyle(roomStyle.wallInner)
    g.fillRoundedRect(-w / 2 + WALL_T, -h / 2 + WALL_T, w - WALL_T * 2, h - WALL_T * 2, 3)

    // Floor
    const floorX = -w / 2 + WALL_T + WALL_I
    const floorY = -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H
    const floorW = w - (WALL_T + WALL_I) * 2
    const floorH = h - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H

    g.fillStyle(roomStyle.floor)
    g.fillRect(floorX, floorY, floorW, floorH)

    // Herringbone / parquet floor pattern — alternating rows of parallelogram planks
    const PLANK_W = 8
    const PLANK_H = 3
    const PLANK_SKEW = 3
    g.fillStyle(roomStyle.floorGrid, 0.15)
    const rowCount = Math.ceil(floorH / PLANK_H)
    const colCount = Math.ceil(floorW / PLANK_W) + 2
    for (let row = 0; row < rowCount; row++) {
      const py = floorY + row * PLANK_H
      if (py > floorY + floorH) break
      const skew = row % 2 === 0 ? PLANK_SKEW : -PLANK_SKEW
      for (let col = row % 2 === 0 ? 0 : 1; col < colCount; col += 2) {
        const px = floorX + col * PLANK_W
        if (px > floorX + floorW) break
        g.fillPoints(
          [
            { x: px + skew, y: py },
            { x: px + PLANK_W + skew, y: py },
            { x: px + PLANK_W - skew, y: py + PLANK_H },
            { x: px - skew, y: py + PLANK_H },
          ],
          true,
        )
      }
    }

    // Rug — themed by directory type
    const rugInsetX = 8
    const rugInsetY = 10
    g.fillStyle(roomStyle.rug, 0.12)
    g.fillRoundedRect(
      floorX + rugInsetX,
      floorY + rugInsetY,
      Math.max(floorW - rugInsetX * 2, 12),
      Math.max(floorH - rugInsetY * 2, 12),
      6,
    )

    // Rug interior pattern — varies by template type for visual variety
    const rugX = floorX + rugInsetX
    const rugY = floorY + rugInsetY
    const rugW = Math.max(floorW - rugInsetX * 2, 12)
    const rugH = Math.max(floorH - rugInsetY * 2, 12)
    const rugStyle = this.hashToken(template.type) % 3
    if (rugStyle === 0) {
      // Diamond lattice
      g.lineStyle(1, roomStyle.rug, 0.15)
      g.strokeRect(rugX + 2, rugY + 2, rugW - 4, rugH - 4)
      for (let dr = 0; dr < Math.ceil(rugH / 6); dr++) {
        for (let dc = 0; dc < Math.ceil(rugW / 6); dc++) {
          const a = (dr + dc) % 2 === 0 ? 0.08 : 0.12
          g.fillStyle(roomStyle.rug, a)
          const dx = rugX + dc * 6, dy = rugY + dr * 6
          g.fillPoints([{x:dx,y:dy-3},{x:dx+3,y:dy},{x:dx,y:dy+3},{x:dx-3,y:dy}], true)
        }
      }
    } else if (rugStyle === 1) {
      // Horizontal stripe
      for (let s = 0; s < Math.ceil(rugH / 4); s++) {
        g.fillStyle(roomStyle.rug, s % 2 === 0 ? 0.08 : 0.14)
        g.fillRect(rugX, rugY + s * 4, rugW, Math.min(4, rugH - s * 4))
      }
      g.lineStyle(1, roomStyle.rug, 0.1)
      for (let fx = 0; fx < Math.floor(rugW / 4); fx++) {
        const lx = rugX + fx * 4
        g.lineBetween(lx, rugY, lx, rugY + 3)
        g.lineBetween(lx, rugY + rugH - 3, lx, rugY + rugH)
      }
    } else {
      // Concentric medallion with corner brackets
      const mcx = rugX + rugW / 2, mcy = rugY + rugH / 2
      const or2 = Math.min(rugW, rugH) * 0.3
      g.fillStyle(roomStyle.rug, 0.1); g.fillCircle(mcx, mcy, or2)
      g.fillStyle(roomStyle.rug, 0.06); g.fillCircle(mcx, mcy, or2 * 0.6)
      g.lineStyle(1, roomStyle.rug, 0.2)
      g.lineBetween(rugX+2,rugY+7,rugX+2,rugY+2); g.lineBetween(rugX+2,rugY+2,rugX+7,rugY+2)
      g.lineBetween(rugX+rugW-7,rugY+2,rugX+rugW-2,rugY+2); g.lineBetween(rugX+rugW-2,rugY+2,rugX+rugW-2,rugY+7)
      g.lineBetween(rugX+2,rugY+rugH-7,rugX+2,rugY+rugH-2); g.lineBetween(rugX+2,rugY+rugH-2,rugX+7,rugY+rugH-2)
      g.lineBetween(rugX+rugW-7,rugY+rugH-2,rugX+rugW-2,rugY+rugH-2); g.lineBetween(rugX+rugW-2,rugY+rugH-2,rugX+rugW-2,rugY+rugH-7)
    }

    // Drop-ceiling grid in the header zone (subtle lines before the solid header paints over)
    g.lineStyle(0.5, roomStyle.wallInner, 0.15)
    const CEIL_GRID = 16
    const headerAreaY = -h / 2 + WALL_T + WALL_I
    const headerAreaBottom = headerAreaY + ROOM_HEADER_H
    for (let cy = headerAreaY; cy <= headerAreaBottom; cy += CEIL_GRID) {
      g.lineBetween(floorX, cy, floorX + floorW, cy)
    }
    for (let cx = floorX; cx <= floorX + floorW; cx += CEIL_GRID) {
      g.lineBetween(cx, headerAreaY, cx, headerAreaBottom)
    }

    // Header bar — gradient simulation via 3 overlapping rects (dark base to lighter top)
    const hBarX = -w / 2 + WALL_T + WALL_I
    const hBarY = -h / 2 + WALL_T + WALL_I
    g.fillStyle(roomStyle.header, 1)
    g.fillRect(hBarX, hBarY, floorW, ROOM_HEADER_H)
    g.fillStyle(roomStyle.wallOuter, 0.12)
    g.fillRect(hBarX, hBarY + Math.floor(ROOM_HEADER_H * 0.4), floorW, Math.ceil(ROOM_HEADER_H * 0.6))
    g.fillStyle(0xffffff, 0.06)
    g.fillRect(hBarX, hBarY, floorW, 2)

    // Room icon — line-drawn icon left of the room label, slot driven by label hash
    const iconSlot = this.hashToken(room.teamKey || room.label) % 3
    const iconX = hBarX + 6
    const iconY = hBarY + Math.floor(ROOM_HEADER_H / 2)
    g.lineStyle(1.5, roomStyle.accent, 0.5)
    if (iconSlot === 0) {
      // Code brackets < >
      g.lineBetween(iconX,     iconY - 3, iconX - 3, iconY)
      g.lineBetween(iconX - 3, iconY,     iconX,     iconY + 3)
      g.lineBetween(iconX + 5, iconY - 3, iconX + 8, iconY)
      g.lineBetween(iconX + 8, iconY,     iconX + 5, iconY + 3)
    } else if (iconSlot === 1) {
      // Terminal prompt > _
      g.lineBetween(iconX,     iconY - 3, iconX + 3, iconY)
      g.lineBetween(iconX + 3, iconY,     iconX,     iconY + 3)
      g.lineBetween(iconX + 5, iconY + 3, iconX + 9, iconY + 3)
    } else {
      // Folder icon
      g.lineBetween(iconX,     iconY + 3, iconX,     iconY - 1)
      g.lineBetween(iconX,     iconY - 1, iconX + 3, iconY - 1)
      g.lineBetween(iconX + 3, iconY - 1, iconX + 4, iconY - 3)
      g.lineBetween(iconX + 4, iconY - 3, iconX + 9, iconY - 3)
      g.lineBetween(iconX + 9, iconY - 3, iconX + 9, iconY + 3)
      g.lineBetween(iconX + 9, iconY + 3, iconX,     iconY + 3)
    }

    // Room number plate on the left side of the header bar
    const roomIndex = this.hashToken(room.teamKey || room.cwd || room.label) % 99
    const plateW = 16
    const plateH = 10
    const plateX = -w / 2 + WALL_T + WALL_I + 4
    const plateY = -h / 2 + WALL_T + WALL_I + (ROOM_HEADER_H - plateH) / 2
    g.fillStyle(roomStyle.wallOuter, 0.5)
    g.fillRoundedRect(plateX, plateY, plateW, plateH, 2)
    g.lineStyle(1, roomStyle.accent, 0.4)
    g.strokeRoundedRect(plateX, plateY, plateW, plateH, 2)

    // Accent line beneath the header
    g.lineStyle(2, roomStyle.accent, 0.72)
    g.lineBetween(
      -w / 2 + WALL_T + WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
      w / 2 - WALL_T - WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
    )

    // Status strip — separate Graphics object just below the accent line.
    // Recreated here so drawRoomBackground is idempotent on resize.
    // updateRoomActivity drives tweened width and color.
    if (room.statusStrip) {
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
      room.statusStrip.destroy()
      room.statusStrip = null
    }
    {
      const sg = this.add.graphics()
      sg.fillStyle(0x64748b, 0.4)
      sg.fillRect(hBarX, hBarY + ROOM_HEADER_H + 1, floorW, 2)
      room.container.add(sg)
      room.statusStrip = sg
    }

    // Baseboard molding — 2px strip along all 4 edges of the floor area
    const baseH = 2
    g.fillStyle(roomStyle.wallOuter, 0.3)
    g.fillRect(floorX, floorY, floorW, baseH)
    g.fillRect(floorX, floorY + floorH - baseH, floorW, baseH)
    g.fillRect(floorX, floorY, baseH, floorH)
    g.fillRect(floorX + floorW - baseH, floorY, baseH, floorH)

    // Inner shadow strips along the top and left walls (0.08 to 0.02 alpha gradient)
    g.fillStyle(0x000000, 0.08)
    g.fillRect(floorX, floorY, floorW, 3)
    g.fillRect(floorX, floorY, 3, floorH)
    g.fillStyle(0x000000, 0.05)
    g.fillRect(floorX, floorY + 1, floorW, 2)
    g.fillRect(floorX + 1, floorY, 2, floorH)
    g.fillStyle(0x000000, 0.02)
    g.fillRect(floorX, floorY + 2, floorW, 1)
    g.fillRect(floorX + 2, floorY, 1, floorH)

    // Back-wall window (only for rooms with sufficient vertical space)
    if (floorH > 140) {
      const winW = 20
      const winH = 8
      const winX = floorX + (floorW - winW) / 2
      const winY = floorY + 8
      g.fillStyle(this.atmosphere.windowTintColor, this.atmosphere.windowTintAlpha * 1.5)
      g.fillRect(winX, winY, winW, winH)

      // ── Tiny scenic view through the window ──────────────────────────────
      // Layers drawn bottom-to-top inside the window bounds so they composite
      // naturally before the frame, mullions, and curtains are painted over.
      if (this.atmosphere.currentTimePhase === 'day' || this.atmosphere.currentTimePhase === 'morning') {
        // Pale blue sky wash across the full pane
        g.fillStyle(0x7dd3fc, 0.06)
        g.fillRect(winX, winY, winW, winH)
        // Green hill — squat ellipse sitting just below the sill
        g.fillStyle(0x166534, 0.08)
        g.fillEllipse(winX + winW / 2, winY + winH + 1, winW * 0.9, 6)
        // Tiny sun dot in the upper-right quadrant
        g.fillStyle(0xfde68a, 0.10)
        g.fillCircle(winX + winW - 3, winY + 2, 1)
      } else if (this.atmosphere.currentTimePhase === 'night') {
        // Dark sky wash
        g.fillStyle(0x0f172a, 0.08)
        g.fillRect(winX, winY, winW, winH)
        // Three scattered star dots
        g.fillStyle(0xffffff, 0.08)
        g.fillCircle(winX + 4, winY + 2, 0.5)
        g.fillCircle(winX + 11, winY + 1, 0.5)
        g.fillCircle(winX + 16, winY + 3, 0.5)
        // Tiny crescent moon — bright circle with a dark bite taken out
        g.fillStyle(0xfef3c7, 0.08)
        g.fillCircle(winX + 15, winY + 2, 1.5)
        g.fillStyle(0x0f172a, 0.08)
        g.fillCircle(winX + 16, winY + 2, 1.2)
      } else {
        // Evening — warm orange sky tint
        g.fillStyle(0xf97316, 0.05)
        g.fillRect(winX, winY, winW, winH)
        // Dark silhouette hill at the base
        g.fillStyle(0x1e293b, 0.06)
        g.fillEllipse(winX + winW / 2, winY + winH + 1, winW * 0.9, 6)
      }
      // ─────────────────────────────────────────────────────────────────────

      g.lineStyle(1, 0x475569, 0.8)
      g.strokeRect(winX, winY, winW, winH)
      g.lineStyle(1, 0x475569, 0.5)
      g.lineBetween(winX + winW / 2, winY, winX + winW / 2, winY + winH)
      g.lineBetween(winX, winY + winH / 2, winX + winW, winY + winH / 2)
      g.fillStyle(this.atmosphere.windowTintColor, 0.04)
      g.fillRect(winX - 4, winY + winH, winW + 8, 10)

      // Curtain rod above window
      g.lineStyle(1, 0x64748b, 0.3)
      g.lineBetween(winX - 2, winY - 1, winX + winW + 2, winY - 1)

      // Left curtain panel
      g.fillStyle(0x475569, 0.4)
      g.fillRect(winX, winY, 3, winH)

      // Right curtain panel
      g.fillRect(winX + winW - 3, winY, 3, winH)

      // Venetian blind lines (very subtle horizontal lines across the window)
      g.lineStyle(1, 0x475569, 0.1)
      for (let bl = 0; bl < 3; bl++) {
        const blindY = winY + 2 + bl * 2.5
        g.lineBetween(winX, blindY, winX + winW, blindY)
      }
    }

    // Door is now drawn in separate graphics objects so it can be animated.
    this.drawDoorPanel(room, floorW, roomStyle.accent)

    // Stash room index for downstream use
    ;(room as unknown as Record<string, unknown>)._roomIndex = roomIndex

    this.refreshRoomHeaderText(room)
  }

  // ---------------------------------------------------------------------------
  // Door panel drawing and animation
  // ---------------------------------------------------------------------------

  private drawDoorPanel(room: Room, floorW: number, accentColor: number): void {
    const h = room.height
    const WALL_T = 3
    const WALL_I = 1
    const doorW = Math.max(20, Math.min(34, floorW * 0.22))
    const doorH = 12
    const doorLeftX = -doorW / 2
    // Bottom door: near bottom wall. Top door: near top wall (below header).
    const doorY = room.doorSide === 'top'
      ? -h / 2 + WALL_T + WALL_I + 16  // below header area
      : h / 2 - WALL_T - WALL_I - doorH

    // Frame drawn in container space — static, does not scale with swing.
    const fg = room.doorFrameGraphics
    fg.clear()
    fg.setPosition(0, 0)
    fg.fillStyle(accentColor, 0.75)
    fg.fillRoundedRect(doorLeftX - 2, doorY - 2, doorW + 4, doorH + 4, 3)

    // Panel: positioned with local x=0 at the hinge (left) edge so that
    // tweening scaleX shrinks/expands the door from the hinge outward.
    const dg = room.doorGraphics
    dg.clear()
    dg.setPosition(doorLeftX, 0)
    dg.fillStyle(COLOR_DOOR_FILL, 1)
    dg.fillRoundedRect(0, doorY, doorW, doorH, 2)
    dg.fillStyle(accentColor, 0.45)
    dg.fillRect(4, doorY + 2, Math.max(doorW - 8, 4), 2)
    dg.lineStyle(1, accentColor, 0.3)
    dg.lineBetween(doorW / 2, doorY + 1, doorW / 2, doorY + doorH - 1)
    // Gold handle near latch side
    dg.fillStyle(0xfbbf24, 1)
    dg.fillCircle(doorW - 4, doorY + doorH / 2, 1.5)
    // Reset scale in case a previous swing left it at 0.3
    dg.setScale(1, 1)
  }

  private triggerDoorAnimation(room: Room): void {
    const dg = room.doorGraphics
    if (!dg || !dg.active) return
    this.tweens.killTweensOf(dg)
    dg.setScale(1, 1)
    this.tweens.add({
      targets: dg,
      scaleX: 0.3,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: dg,
          scaleX: 1,
          delay: 500,
          duration: 300,
          ease: 'Quad.easeIn',
        })
      },
    })
  }

  private updateDoorGlow(room: Room): void {
    if (!room.doorFrameGraphics || !room.doorFrameGraphics.active) return
    const hasAgents = room.agents.length > 0
    if (hasAgents) {
      if (room.doorPulseTween) return
      room.doorFrameGraphics.setAlpha(0.75)
      room.doorPulseTween = this.tweens.add({
        targets: room.doorFrameGraphics,
        alpha: { from: 0.5, to: 0.9 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      if (room.doorPulseTween) {
        room.doorPulseTween.destroy()
        room.doorPulseTween = null
      }
      room.doorFrameGraphics.setAlpha(0.75)
    }
  }

  private refreshRoomHeaderText(room: Room): void {
    const existing = room.container.getByName('headerText') as Phaser.GameObjects.Text | null
    if (existing) existing.destroy()

    const WALL_T = 8
    const WALL_I = 4
    const headerY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H / 2

    const headerText = this.add.text(
      0,
      headerY,
      this.formatLabel(room.label),
      {
        fontSize: '12px', color: '#e2e8f0',
        fontFamily: 'system-ui, monospace', fontStyle: 'bold', align: 'center',
        resolution: 2,
      },
    ).setOrigin(0.5, 0.5).setName('headerText')
    room.container.add(headerText)

    // Destroy existing badge, dot, and dot tween before rebuilding
    const badgeExisting = room.container.getByName('agentBadge') as Phaser.GameObjects.Text | null
    if (badgeExisting) badgeExisting.destroy()
    const dotExisting = room.container.getByName('badgeDot') as Phaser.GameObjects.Arc | null
    if (dotExisting) dotExisting.destroy()
    if (room.badgeDotTween) { room.badgeDotTween.destroy(); room.badgeDotTween = null }

    // Determine activity state for dot color
    const workingCount = room.agents.filter(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    ).length
    const waitingCount = room.agents.filter(a => a.needsInteraction).length
    const isActive = workingCount > 0
    const isWaiting = waitingCount > 0
    const dotColor = isWaiting ? 0xfbbf24 : isActive ? 0x34d399 : 0x475569

    // Small filled circle left of the count number
    const badgeRightX = room.width / 2 - WALL_T - WALL_I - 8
    const dot = this.add.circle(badgeRightX - 18, headerY, 2.5, dotColor, isActive || isWaiting ? 0.9 : 0.5)
    dot.setName('badgeDot')
    room.container.add(dot)

    // Pulse the dot when agents are active or waiting
    if (isActive || isWaiting) {
      room.badgeDotTween = this.tweens.add({
        targets: dot,
        alpha: { from: 0.4, to: 0.95 },
        duration: isWaiting ? 500 : 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Agent count badge — text color reflects activity state
    const badge = this.add.text(
      badgeRightX,
      headerY,
      `${room.agents.length}`,
      {
        fontSize: '10px',
        color: isActive ? '#34d399' : isWaiting ? '#fbbf24' : '#94a3b8',
        fontFamily: 'system-ui, monospace',
        backgroundColor: '#1e293b',
        padding: { x: 4, y: 2 },
        resolution: 2,
      },
    ).setOrigin(1, 0.5).setName('agentBadge')
    room.container.add(badge)
  }

  // ---------------------------------------------------------------------------
  // Workstation management
  // ---------------------------------------------------------------------------

  private syncWorkstations(room: Room, agents: AgentState[]): void {
    const currentIds = new Set(agents.map(a => a.config.id))

    for (const [id, ws] of room.workstations) {
      if (!currentIds.has(id)) {
        this.destroyWorkstation(ws)
        room.workstations.delete(id)
      }
    }

    for (const agent of agents) {
      const existing = room.workstations.get(agent.config.id)
      if (existing) {
        this.updateWorkstation(existing, agent)
      } else {
        const ws = this.createWorkstation(room, agent)
        room.workstations.set(agent.config.id, ws)
      }
    }

    // Trigger door animation when agent count changes (someone enters or leaves).
    if (agents.length !== room.prevAgentCount) {
      this.triggerDoorAnimation(room)
      room.prevAgentCount = agents.length
    }

    this.layoutWorkstations(room)
  }

  private createWorkstation(room: Room, agent: AgentState): WorkstationSprite {
    const wsContainer = this.add.container(0, 0)
    room.container.add(wsContainer)

    let chairSprite: Phaser.GameObjects.Sprite | null = null
    if (this.officeTilesLoaded) {
      chairSprite = this.add.sprite(0, WS_CHAIR_Y + 4, 'office', FRAME_CHAIR_DARK)
      chairSprite.setScale(0.44).setAlpha(0.85)
      wsContainer.add(chairSprite)
    } else {
      wsContainer.add(this.add.rectangle(0, WS_CHAIR_Y, 18, 13, 0x2d3748).setStrokeStyle(1, 0x4a5568, 0.6))
    }

    const isCursor = this.isCursorAgent(agent)
    const deskBody = this.add.rectangle(0, WS_DESK_Y, 64, 21, COLOR_DESK_BODY).setStrokeStyle(1, 0x64748b, 0.5)
    wsContainer.add(deskBody)

    const deskTop = this.add.rectangle(0, WS_DESK_Y - 8, 61, 3, COLOR_DESK_TOP)
    wsContainer.add(deskTop)

    let monitorSprite: Phaser.GameObjects.Sprite | null = null
    let monitorGlowFx: Phaser.FX.Glow | undefined
    let screenLines: Phaser.GameObjects.Graphics | undefined
    let screenTween: Phaser.Tweens.Tween | undefined
    if (this.officeTilesLoaded) {
      monitorSprite = this.add.sprite(0, WS_MONITOR_Y, 'office', FRAME_MONITOR).setScale(0.42)
      wsContainer.add(monitorSprite)
      monitorGlowFx = monitorSprite.postFX.addGlow(0x0ea5e9, 0, 0, false, 0.1, 16)
      // Scrolling screen content lines
      screenLines = this.add.graphics().setVisible(false)
      wsContainer.add(screenLines)
      const LINE_COLORS = [0x0ea5e9, 0x34d399]
      const lineWidths = Array.from({ length: 4 }, () => 6 + Math.random() * 6)
      const lineColors = lineWidths.map(() => LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)])
      screenTween = this.tweens.addCounter({
        from: 0, to: 1, duration: 1200 + Math.random() * 600, repeat: -1, ease: 'Linear',
        onUpdate: (tw) => {
          if (!screenLines?.active) return
          screenLines.clear()
          const v = tw.getValue()
          for (let i = 0; i < 4; i++) {
            const y = WS_MONITOR_Y + ((v * 13 + i * 3.25) % 13) - 6.5
            screenLines.fillStyle(lineColors[i], 0.5)
            screenLines.fillRect(-lineWidths[i] / 2, y, lineWidths[i], 1)
          }
        },
      })
      screenTween.pause()
    } else {
      wsContainer.add(this.add.rectangle(0, WS_MONITOR_Y, 16, 13, 0x1a1a2e).setStrokeStyle(1, 0x4a5568, 0.8))
    }

    // Monitor blurb text — tiny live text overlaid on the monitor screen
    const monitorText = this.add.text(0, WS_MONITOR_Y - 1, '', {
      fontSize: '4px',
      fontFamily: 'monospace',
      color: '#64748b',
      wordWrap: { width: 14, useAdvancedWrap: false },
      resolution: 3,
    }).setOrigin(0.5, 0).setAlpha(0.7).setVisible(false)
    wsContainer.add(monitorText)

    // Coffee mug
    const mugBody = this.add.rectangle(22, WS_DESK_Y - 3, 5, 6, 0x8b5cf6).setStrokeStyle(0.5, 0x6d28d9, 0.8)
    wsContainer.add(mugBody)
    const mugHandle = this.add.arc(25, WS_DESK_Y - 3, 2.5, 0, 180, false, 0x000000, 0).setStrokeStyle(1, 0x8b5cf6, 0.8)
    wsContainer.add(mugHandle)

    // Coffee steam — particles spawned dynamically only while agent is idle
    // (see spawnSteamParticles / clearSteamParticles)
    const steamContainer = this.add.container(22, WS_DESK_Y - 7)
    wsContainer.add(steamContainer)
    const steamTweens: Phaser.Tweens.Tween[] = []

    // Desk lamp
    const lampBase = this.add.rectangle(-24, WS_DESK_Y - 2, 6, 3, 0x94a3b8)
    wsContainer.add(lampBase)
    const lampArm = this.add.rectangle(-24, WS_DESK_Y - 8, 1.5, 10, 0x94a3b8)
    wsContainer.add(lampArm)
    const lampShade = this.add.triangle(-24, WS_DESK_Y - 14, -5, 6, 0, -2, 5, 6, 0xfbbf24, 0.8)
    wsContainer.add(lampShade)
    const lampLight = this.add.triangle(-24, WS_DESK_Y - 4, -10, 18, 0, 0, 10, 18, 0xfbbf24, 0.04)
    wsContainer.add(lampLight)

    // Desk accessories (deterministic per agent name)
    let nameHash = 0
    for (let i = 0; i < agent.config.name.length; i++) {
      nameHash = ((nameHash << 5) - nameHash) + agent.config.name.charCodeAt(i); nameHash |= 0
    }
    nameHash = Math.abs(nameHash)

    // Keyboard
    const keyboard = this.add.rectangle(0, WS_DESK_Y + 2, 18, 5, 0x1e293b).setAlpha(0.8)
    wsContainer.add(keyboard)
    const kbLines = this.add.graphics()
    kbLines.lineStyle(0.5, 0x334155, 0.6)
    for (let r = 0; r < 3; r++) kbLines.lineBetween(-7, WS_DESK_Y + r * 1.5, 7, WS_DESK_Y + r * 1.5)
    wsContainer.add(kbLines)

    // Desk communicator / phone — left side of desk
    const phoneBody = this.add.rectangle(-20, WS_DESK_Y - 2, 4, 6, 0x334155)
    wsContainer.add(phoneBody)
    const phoneScreen = this.add.rectangle(-20, WS_DESK_Y - 5, 3, 2, 0x1e293b)
    wsContainer.add(phoneScreen)
    const phoneLight = this.add.arc(-18, WS_DESK_Y - 6, 1.5, 0, 360, false, 0xfbbf24, 0)
    wsContainer.add(phoneLight)

    // Sticky note (color varies)
    const stickyColors = [0x38bdf8, 0x818cf8, 0x34d399, 0xfbbf24, 0xf472b6]
    const stickyX = nameHash % 2 === 0 ? 14 : -14
    const sticky = this.add.rectangle(stickyX, WS_DESK_Y - 6, 7, 6, stickyColors[nameHash % 5], 0.7)
    wsContainer.add(sticky)

    // Pencil holder (~60% of desks)
    const extraDecos: Phaser.GameObjects.GameObject[] = []
    if (nameHash % 5 >= 2) {
      const phX = nameHash % 2 === 0 ? -14 : 14
      const cup = this.add.rectangle(phX, WS_DESK_Y - 5, 5, 7, 0x475569, 0.7)
      wsContainer.add(cup); extraDecos.push(cup)
      const p1 = this.add.rectangle(phX - 1, WS_DESK_Y - 10, 1, 6, 0xfbbf24, 0.6).setAngle(-5)
      wsContainer.add(p1); extraDecos.push(p1)
      const p2 = this.add.rectangle(phX + 1, WS_DESK_Y - 10, 1, 6, 0xef4444, 0.5).setAngle(7)
      wsContainer.add(p2); extraDecos.push(p2)
    }

    // Desk plant (~40% of desks)
    let deskPlantLeaf: Phaser.GameObjects.Arc | null = null
    if (nameHash % 5 < 2) {
      const plX = nameHash % 2 === 0 ? -16 : 16
      const pot = this.add.rectangle(plX, WS_DESK_Y - 2, 5, 4, 0x475569, 0.7)
      wsContainer.add(pot); extraDecos.push(pot)
      const leaf = this.add.circle(plX, WS_DESK_Y - 6, 3, 0x34d399, 0.6)
      wsContainer.add(leaf); extraDecos.push(leaf)
      deskPlantLeaf = leaf
    }

    // LED underglow strip — drawn just beneath the desk body
    const ledGlow = this.add.graphics()
    ledGlow.fillStyle(activeTheme.deskStrokeIdle, 0.3)
    ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
    wsContainer.add(ledGlow)

    // Task completion counter — 14×8px pill at top-right of the desk surface.
    // bg rect at (26, WS_DESK_Y - 12); text centered inside at (33, WS_DESK_Y - 8).
    // Color tiers: 0 = hidden, 1-4 = gray, 5-9 = blue, 10+ = gold.
    const taskCountBg = this.add.graphics()
    taskCountBg.fillStyle(0x0f172a, 0.6)
    taskCountBg.fillRoundedRect(0, 0, 14, 8, 2)
    taskCountBg.setPosition(26, WS_DESK_Y - 12)
    taskCountBg.setAlpha(0)        // hidden until first task completes
    wsContainer.add(taskCountBg)

    const taskCountText = this.add.text(33, WS_DESK_Y - 8, '0', {
      fontSize: '5px',
      fontFamily: 'system-ui, monospace',
      color: '#64748b',
      resolution: 3,
    }).setOrigin(0.5).setAlpha(0)  // hidden until first task completes
    wsContainer.add(taskCountText)

    // LOD level 2+: shown at room-level zoom (sprite, desk body/top, monitor, chair are always visible at L2+;
    // these extras add context at the room-view scale without requiring full detail)
    const lodLevel2Objects: Phaser.GameObjects.GameObject[] = [
      keyboard, kbLines, sticky,
    ]
    // LOD level 3 only: micro-accessories only visible at full detail zoom
    const lodLevel3Objects: Phaser.GameObjects.GameObject[] = [
      mugBody, mugHandle, steamContainer, lampBase, lampArm, lampShade, lampLight,
      ...extraDecos, ledGlow, monitorText,
      phoneBody, phoneScreen, phoneLight,
      taskCountBg, taskCountText,
    ]

    // Ambient sound-wave indicator — concentric arcs to the left of the agent.
    // Drawn/cleared dynamically in updateAnimation; registered here so it
    // participates in the LOD system from the start (LOD 3 only).
    const soundWaveGfx = this.add.graphics()
    soundWaveGfx.x = -28
    soundWaveGfx.y = WS_SPRITE_Y - 8
    wsContainer.add(soundWaveGfx)
    lodLevel3Objects.push(soundWaveGfx)

    // Productivity sparkline — tiny area graph on the right side of the desk surface
    // showing the agent's recent activity pattern (last 20 ticks).
    // Redrawn in updateWorkstation whenever the activity value changes.
    const sparklineGfx = this.add.graphics()
    sparklineGfx.setPosition(18, WS_DESK_Y - 12)
    wsContainer.add(sparklineGfx)
    lodLevel3Objects.push(sparklineGfx)

    // Circular progress ring — drawn above the agent's head while they are working.
    // The arc fills clockwise over 60 seconds giving a visual sense of task duration.
    // Registered in lodLevel2Objects so it is visible at room-level zoom and above.
    const progressRing = this.add.graphics()
    progressRing.setPosition(0, WS_SPRITE_Y - 12)
    progressRing.setAlpha(0)
    wsContainer.add(progressRing)
    lodLevel2Objects.push(progressRing)

    // Character shadow
    const shadow = this.add.ellipse(0, WS_SPRITE_Y + 2, 20, 6, 0x000000, 0.2)
    wsContainer.add(shadow)

    const charIdx = this.getAgentCharacterIndex(agent)
    const frame   = this.getPoseFrame(charIdx, agent)
    const sprite  = this.add.sprite(0, WS_SPRITE_Y, 'characters', frame)
    sprite.setScale(CHAR_SCALE).setOrigin(0.5, 1)
    wsContainer.add(sprite)

    // Thought bubble — dark card with accent border and live blurb text
    const thoughtBubbleBg = this.add.graphics()
    const thoughtBubbleText = this.add.text(0, 0, '', {
      fontSize: '9px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
      wordWrap: { width: 90, useAdvancedWrap: false },
      align: 'left', resolution: 2, lineSpacing: 1,
    }).setOrigin(0.5)
    const thoughtBubble = this.add.container(4, WS_SPRITE_Y - 60, [thoughtBubbleBg, thoughtBubbleText]).setVisible(false)
    wsContainer.add(thoughtBubble)

    // Show persona name (e.g. "Marcus Chen") instead of title
    const nameText = this.add.text(0, WS_NAME_Y, '', {
      fontSize: '11px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0f172acc', padding: { x: 4, y: 2 }, align: 'center',
      resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(nameText)

    const dotColor  = this.getStatusColor(agent)
    const statusDot = this.add.circle(nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y, 3.5, dotColor).setVisible(false)
    wsContainer.add(statusDot)

    // Role badge (S / R / E) — shown when agent has a triplet role assigned.
    // Sits to the left of the name tag; revealed/hidden in updateWorkstation.
    const roleBadge = this.add.text(-28, WS_NAME_Y, '', {
      fontSize: '7px', color: '#0f172a', fontFamily: 'system-ui, monospace',
      fontStyle: 'bold', backgroundColor: '#3b82f6',
      padding: { x: 3, y: 1 }, resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(roleBadge)
    lodLevel3Objects.push(roleBadge)

    // Uptime indicator — tiny dim counter just below the name tag
    const uptimeText = this.add.text(0, WS_NAME_Y + 12, '', {
      fontSize: '6px', color: '#475569', fontFamily: 'system-ui, monospace',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setAlpha(0.7).setVisible(false)
    wsContainer.add(uptimeText)
    lodLevel3Objects.push(uptimeText)

    // XP progress bar — thin strip below the name tag
    const XP_BAR_W  = 30
    const XP_BAR_H  = 3
    const XP_BAR_Y  = WS_NAME_Y + 14
    const XP_TEXT_Y = XP_BAR_Y + 6

    const xpBarBg = this.add.rectangle(0, XP_BAR_Y, XP_BAR_W, XP_BAR_H, 0x1e293b)
      .setOrigin(0.5).setAlpha(0.6).setVisible(false)
    wsContainer.add(xpBarBg)

    const xpBarFill = this.add.rectangle(-XP_BAR_W / 2, XP_BAR_Y, 0, XP_BAR_H, 0x3b82f6)
      .setOrigin(0, 0.5).setVisible(false)
    wsContainer.add(xpBarFill)

    const xpBarText = this.add.text(0, XP_TEXT_Y, '', {
      fontSize: '5px', color: '#64748b', fontFamily: 'system-ui, sans-serif',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(xpBarText)

    lodLevel3Objects.push(xpBarBg, xpBarFill, xpBarText)

    // "Blocked" clarity marker for needsInteraction agents.
    const blockedIndicatorPulse = this.add.circle(0, 0, 10, 0xfbbf24, 0.16)
    const blockedIndicatorStem = this.add.rectangle(0, 8, 1.5, 7, 0xfbbf24, 0.55)
    const blockedIndicatorBadge = this.add.circle(0, 0, 6.5, 0xfbbf24, 0.95)
    const blockedIndicatorText = this.add.text(0, -0.5, '!', {
      fontSize: '10px',
      color: '#0f172a',
      fontFamily: 'system-ui, monospace',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0.5)
    const blockedIndicator = this.add
      .container(27, WS_SPRITE_Y - 34, [blockedIndicatorPulse, blockedIndicatorStem, blockedIndicatorBadge, blockedIndicatorText])
      .setVisible(false)
    wsContainer.add(blockedIndicator)

    // Mood emoji indicator — shown top-left above the agent, fades in/out on state change
    const moodEmoji = this.add.text(
      -WORKSTATION_W / 2 + 4,
      WS_SPRITE_Y - 20,
      '',
      { fontSize: '8px', fontFamily: 'system-ui, sans-serif', resolution: 2 },
    ).setOrigin(0, 1).setAlpha(0)
    wsContainer.add(moodEmoji)
    lodLevel3Objects.push(moodEmoji)

    const hitArea = this.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge,
      deskBody, deskTop, monitorSprite, chairSprite,
      monitorGlowFx, screenLines, screenTween,
      monitorText,
      blockedIndicator, blockedIndicatorPulse, blockedIndicatorBadge, blockedIndicatorStem, blockedIndicatorText,
      thoughtBubble, thoughtBubbleText, thoughtBubbleBg, state: agent,
      steamTweens, steamContainer,
      ledGlow,
      moodEmoji,
      soundWaveGfx,
      sparklineGfx,
      shadow,
      activityHistory: [],
      phoneLight,
      progressRing,
      lodLevel2Objects,
      lodLevel3Objects,
      xpBarBg,
      xpBarFill,
      xpBarText,
      uptimeText,
      taskCountBg,
      taskCountText,
      localTaskCount: 0,
    }

    // Desk plant micro-sway — subtle y-oscillation on the leaf circle
    if (deskPlantLeaf) {
      const leafBaseY = deskPlantLeaf.y
      ws.deskPlantTween = this.tweens.add({
        targets: deskPlantLeaf,
        y: { from: leafBaseY - 1, to: leafBaseY + 1 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1500,
      })
    }

    // Apply current LOD state immediately to the newly created workstation.
    // Level 1: hide everything inside the workstation container; level 2: show L2 but not L3; level 3: show all.
    this.applyLodToWorkstation(ws, this.lastLodLevel, false)

    let lastClickTime = 0
    hitArea.on('pointerdown', () => {
      const now = Date.now()
      if (now - lastClickTime < 350) {
        EventBus.emit(EVENTS.AGENT_DOUBLE_CLICKED, agent.config.id, ws.state)
        this.enterFocusMode(agent.config.id)
      } else {
        EventBus.emit(EVENTS.AGENT_CLICKED, agent.config.id, ws.state)
      }
      lastClickTime = now
    })

    hitArea.on('pointerover', () => {
      this.tweens.killTweensOf(wsContainer)
      this.tweens.add({ targets: wsContainer, scaleX: 1.07, scaleY: 1.07, duration: 140, ease: 'Back.easeOut' })
      ws.deskBody.setStrokeStyle(2, 0x3b82f6, 0.9)
      // Highlight ring around desk in world-space
      const rWx = room.container.x + wsContainer.x
      const rWy = room.container.y + wsContainer.y
      this.drawHoverRing(rWx, rWy)
      // Rich tooltip near pointer in screen-space
      const ptr = this.input.activePointer
      this.showRichTooltip(ws.state ?? agent, ptr.x, ptr.y)
    })

    hitArea.on('pointerout', () => {
      this.tweens.killTweensOf(wsContainer)
      this.tweens.add({ targets: wsContainer, scaleX: 1, scaleY: 1, duration: 140, ease: 'Power2' })
      this.restoreDeskStroke(ws)
      this.clearHoverRing()
      this.hideTooltip()
    })

    this.updateWorkstation(ws, agent)

    // --- Entrance animation ---
    // Quick pop-in: start slightly small and transparent, snap to full in 250ms.
    // Kept short to avoid conflicts with hover handlers that killTweensOf(container).
    wsContainer.setAlpha(0.3).setScale(0.85)
    this.tweens.add({
      targets: wsContainer,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 250, ease: 'Back.easeOut',
      onComplete: () => {
        // Safety: ensure container is fully visible after animation
        if (wsContainer.active) { wsContainer.setAlpha(1).setScale(1) }
      },
    })
    this.queueMinimapRoomFlash(room.cwd, 0x34d399, 1500)

    return ws
  }

  private updateWorkstation(ws: WorkstationSprite, agent: AgentState): void {
    // If agent is on a coffee run, keep desk sprite hidden and skip all visual updates
    if (this.cafe.isOnCoffeeRun(agent.config.id)) {
      const m = agent.sessionMode
      if (m === 'working' || m === 'plan' || agent.needsInteraction) {
        this.cafe.cancelCoffeeRun(agent.config.id)
        ws.sprite.setVisible(true)
      } else {
        ws.sprite.setVisible(false)
        ws.state = agent
        return
      }
    }
    if (ws.container.alpha < 0.9) ws.container.setAlpha(1)
    if (ws.container.scaleX < 0.9) ws.container.setScale(1)

    // Skip redundant updates — fingerprint the fields that affect visuals
    const blurbSnippet = agent.lastAssistantBlurb?.slice(0, 20) ?? ''
    const fp = `${agent.status}|${agent.sessionMode}|${agent.needsInteraction}|${agent.interactionType}|${agent.config.name}|${blurbSnippet}|${agent.uptime ?? ''}`
    if (ws.lastStateFingerprint === fp) {
      ws.state = agent
      return
    }
    // Fire toasts on meaningful state transitions
    const prevState = ws.state
    ws.lastStateFingerprint = fp
    ws.state = agent

    if (prevState) {
      const name = agent.config.name.split(' ')[0]
      const wasWorking = (prevState.sessionMode === 'working' || prevState.sessionMode === 'plan') && !prevState.needsInteraction
      const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !agent.needsInteraction
      const roomKey = agent.cwd ?? '__unassigned__'
      if (agent.needsInteraction && !prevState.needsInteraction) {
        this.queueMinimapRoomFlash(roomKey, COLOR_LED_AMBER, 1600)
        if (agent.interactionType === 'accept-edits') {
          this.showToast(`${name} has edits to review`, 'info')
        } else if (agent.interactionType === 'question') {
          this.showToast(`${name} asked a question`, 'warning')
        } else if (agent.interactionType === 'tool-approval') {
          this.showToast(`${name} needs approval`, 'warning')
        }
        // Spawn a sound-wave ripple at the workstation world position (once per blocked state entry)
        if (!ws.rippleFired) {
          ws.rippleFired = true
          const room = this.rooms.get(roomKey)
          if (room) {
            const wx = room.x + ws.container.x
            const wy = room.y + ws.container.y
            let rippleColor = 0xfbbf24 // default amber
            if (agent.interactionType === 'tool-approval') rippleColor = 0xf97316
            else if (agent.interactionType === 'question') rippleColor = 0x60a5fa
            else if (agent.interactionType === 'accept-edits') rippleColor = 0x3b82f6
            this.particles.spawnAlertRipple(wx, wy, rippleColor)
            this.particles.spawnEmojiReaction(wx, wy, '\uD83D\uDD14') // blocked: 🔔
          }
        }
      } else if (!agent.needsInteraction && prevState.needsInteraction) {
        // Reset ripple guard so the next blocked event fires a fresh ripple
        ws.rippleFired = false
        const roomU = this.rooms.get(roomKey)
        if (roomU) this.particles.spawnEmojiReaction(roomU.x + ws.container.x, roomU.y + ws.container.y, '\uD83D\uDC4D') // unblocked: 👍
      }

      if (wasWorking && !isWorking && !agent.needsInteraction) {
        this.queueMinimapRoomFlash(roomKey, COLOR_LED_GREEN, 1200)
        this.showToast(`${name} finished task`, 'success')
        const roomC = this.rooms.get(roomKey)
        if (roomC) this.particles.spawnEmojiReaction(roomC.x + ws.container.x, roomC.y + ws.container.y, '\u2705') // completed: ✅
      } else if (!wasWorking && isWorking) {
        this.queueMinimapRoomFlash(roomKey, COLOR_DOOR_FRAME, 900)
        this.showToast(`${name} started working`, 'info')
        const roomS = this.rooms.get(roomKey)
        if (roomS) this.particles.spawnEmojiReaction(roomS.x + ws.container.x, roomS.y + ws.container.y, '\u26A1') // started: ⚡
      }

      // Plan mode entry
      if (agent.sessionMode === 'plan' && prevState.sessionMode !== 'plan') {
        const roomP = this.rooms.get(roomKey)
        if (roomP) this.particles.spawnEmojiReaction(roomP.x + ws.container.x, roomP.y + ws.container.y, '\uD83D\uDCCB') // plan: 📋
      }

      // Compressing entry
      if (agent.sessionMode === 'compressing' && prevState.sessionMode !== 'compressing') {
        const roomZ = this.rooms.get(roomKey)
        if (roomZ) this.particles.spawnEmojiReaction(roomZ.x + ws.container.x, roomZ.y + ws.container.y, '\uD83D\uDCA8') // compressing: 💨
      }
    }

    const charIdx = this.getAgentCharacterIndex(agent)
    ws.sprite.setFrame(this.getPoseFrame(charIdx, agent))

    const dotColor = this.getStatusColor(agent)
    ws.statusDot.setFillStyle(dotColor)
    ws.statusDot.setPosition(ws.nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y)

    ws.nameText.setVisible(true)
    ws.statusDot.setVisible(true)

    const isWaiting = agent.needsInteraction
    const isPlan = agent.sessionMode === 'plan'
    const isAcceptEdits = agent.interactionType === 'accept-edits' && isWaiting
    const isWorking = (agent.sessionMode === 'working' || isPlan) && !isWaiting

    // ── Name tag color + background tint based on state ──────────────────────
    const nameColor = isWorking ? '#34d399' : isWaiting ? '#fbbf24' : isPlan ? '#a78bfa' : '#94a3b8'
    const nameBg    = isWorking ? '#071a0f' : isWaiting ? '#1a1500' : '#0f172acc'
    ws.nameText.setColor(nameColor).setBackgroundColor(nameBg)

    // ── Role badge (S / R / E) ────────────────────────────────────────────────
    if (ws.roleBadge) {
      const tripletRole = agent.config.tripletRole
      if (tripletRole) {
        const roleLabel = tripletRole === 'solver' ? 'S' : tripletRole === 'reviewer' ? 'R' : 'E'
        const roleBgColor: Record<string, string> = { solver: '#3b82f6', reviewer: '#8b5cf6', executor: '#22c55e' }
        ws.roleBadge.setText(roleLabel).setBackgroundColor(roleBgColor[tripletRole] ?? '#475569').setVisible(true)

        // Pulse the badge when this agent is actively part of a running triplet
        const isInActiveTriplet = this.tripletLines.some(t => {
          const isActive = t.status === 'solving' || t.status === 'reviewing' || t.status === 'executing' || t.status === 'feedback'
          const agentId = agent.config.id
          return isActive && (t.solverAgentId === agentId || t.reviewerAgentId === agentId || t.executorAgentId === agentId)
        })
        if (isInActiveTriplet) {
          if (!ws.roleBadgePulseTween || !ws.roleBadgePulseTween.isPlaying()) {
            ws.roleBadgePulseTween?.destroy()
            ws.roleBadgePulseTween = this.tweens.add({
              targets: ws.roleBadge,
              alpha: { from: 1, to: 0.35 },
              duration: 600,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        } else {
          ws.roleBadgePulseTween?.destroy()
          ws.roleBadgePulseTween = undefined
          ws.roleBadge.setAlpha(0.75)
        }
      } else {
        ws.roleBadgePulseTween?.destroy()
        ws.roleBadgePulseTween = undefined
        ws.roleBadge.setVisible(false).setAlpha(1)
      }
    }

    // ── Uptime counter ────────────────────────────────────────────────────────
    if (ws.uptimeText) {
      if (agent.uptime) {
        ws.uptimeText.setText(agent.uptime).setVisible(true)
      } else {
        ws.uptimeText.setVisible(false)
      }
    }

    // Screen content
    if (isWorking && ws.screenLines && ws.screenTween) {
      ws.screenLines.setVisible(true); ws.screenTween.resume()
    } else if (ws.screenLines) {
      ws.screenLines.setVisible(false); ws.screenTween?.pause()
    }

    if (ws.monitorSprite) {
      ws.monitorSprite.setTint(isWorking ? 0x0ea5e9 : isWaiting ? 0xf59e0b : 0xffffff)
      ws.monitorSprite.setAlpha(isWorking ? 0.95 : isWaiting ? 0.9 : 0.7)
    }

    // Monitor blurb text — show a snippet of the agent's last assistant message
    if (ws.monitorText) {
      // Kill any existing scroll tween on this text
      if (ws.monitorTextTween) {
        ws.monitorTextTween.destroy()
        ws.monitorTextTween = undefined
      }

      if (isWorking && agent.lastAssistantBlurb) {
        const snippet = agent.lastAssistantBlurb.slice(0, 20)
        ws.monitorText
          .setText(snippet)
          .setColor('#0ea5e9')
          .setAlpha(0.7)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
        // Scroll text upward and reset in a repeating loop to simulate activity
        ws.monitorTextTween = this.tweens.add({
          targets: ws.monitorText,
          y: WS_MONITOR_Y - 4,
          duration: 3000,
          ease: 'Linear',
          repeat: -1,
          onRepeat: () => { if (ws.monitorText?.active) ws.monitorText.setY(WS_MONITOR_Y - 1) },
        })
      } else if (isWaiting) {
        ws.monitorText
          .setText('!')
          .setColor('#fbbf24')
          .setAlpha(0.9)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
        // Pulse alpha for waiting state
        ws.monitorTextTween = this.tweens.add({
          targets: ws.monitorText,
          alpha: 0.3,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else {
        // Idle — show first word of last blurb dimly, or "idle"
        const idleText = agent.lastAssistantBlurb
          ? agent.lastAssistantBlurb.split(/\s+/)[0].slice(0, 8)
          : 'idle'
        ws.monitorText
          .setText(idleText)
          .setColor('#64748b')
          .setAlpha(0.5)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
      }
    }

    this.updateBlockedIndicator(ws, agent)

    // Thought bubble — delegate to rich update method
    let accentColor = 0x475569
    
    let shouldShow = false

    if (isAcceptEdits) {
      accentColor = 0x60a5fa; shouldShow = true
    } else if (agent.sessionMode === 'compressing') {
      accentColor = 0xf87171; shouldShow = true
    } else if (isPlan) {
      accentColor = 0xa78bfa; shouldShow = true
    } else if (isWorking) {
      accentColor = 0x059669; shouldShow = true
    } else if (agent.needsInteraction) {
      accentColor = 0xfbbf24; shouldShow = true
    } else if (agent.sessionMode === 'waiting') {
      accentColor = 0xfbbf24; shouldShow = true
    } else if (!agent.sessionMode) {
      accentColor = 0x059669; shouldShow = true
    } else {
      accentColor = 0x475569; shouldShow = true
    }

    // Thought bubbles disabled — too small to read at game scale, adds visual noise
    // this.updateThoughtBubble(ws, agent, shouldShow, accentColor, isWorking)
    if (ws.thoughtBubble) ws.thoughtBubble.setVisible(false)

    this.updateAnimation(ws, agent)
    this.updateMood(ws, agent)

    // XP progress bar — update fill width and rank label
    if (ws.xpBarBg && ws.xpBarFill && ws.xpBarText && agent.xp) {
      const xp = agent.xp
      const currentRankIdx = XP_RANKS.findIndex(r => r.level === xp.level)
      const currentMin = getXPForLevel(xp.level)
      const nextMin =
        currentRankIdx >= 0 && currentRankIdx < XP_RANKS.length - 1
          ? XP_RANKS[currentRankIdx + 1].minXP
          : currentMin + 500
      const pct =
        nextMin > currentMin
          ? Math.min(1, Math.max(0, (xp.totalXP - currentMin) / (nextMin - currentMin)))
          : 1
      const XP_BAR_W = 30
      const targetW  = Math.max(0, Math.floor(XP_BAR_W * pct))
      const fillColor = xp.level >= 8 ? 0xf59e0b : xp.level >= 5 ? 0xa855f7 : 0x3b82f6

      ws.xpBarBg.setVisible(true)
      ws.xpBarFill.setFillStyle(fillColor).setVisible(true)
      ws.xpBarText.setText(xp.rank).setVisible(true)

      if (ws.xpBarTween) { ws.xpBarTween.destroy(); ws.xpBarTween = undefined }
      ws.xpBarTween = this.tweens.add({
        targets: ws.xpBarFill,
        displayWidth: targetW,
        duration: 300,
        ease: 'Power2',
      })
    } else if (ws.xpBarBg) {
      ws.xpBarBg.setVisible(false)
      ws.xpBarFill?.setVisible(false)
      ws.xpBarText?.setVisible(false)
    }

    // Productivity sparkline — track activity and redraw only when value changes
    if (ws.sparklineGfx) {
      const newValue = isWorking ? 1 : isWaiting ? 0.5 : 0
      const history  = ws.activityHistory ?? []
      const lastVal  = history.length > 0 ? history[history.length - 1] : undefined

      if (lastVal !== newValue) {
        history.push(newValue)
        if (history.length > 20) history.shift()
        ws.activityHistory = history

        const gfx  = ws.sparklineGfx
        const W    = 20
        const H    = 8
        const n    = history.length
        const toY  = (v: number) => H - v * H

        gfx.clear()

        if (n >= 2) {
          // Axis lines at 0.15 alpha
          gfx.lineStyle(0.5, 0x475569, 0.15)
          gfx.beginPath()
          gfx.moveTo(0, H); gfx.lineTo(W, H)
          gfx.moveTo(0, H / 2); gfx.lineTo(W, H / 2)
          gfx.strokePath()

          for (let i = 1; i < n; i++) {
            const x0 = ((i - 1) / (n - 1)) * W
            const x1 = (i       / (n - 1)) * W
            const y0 = toY(history[i - 1])
            const y1 = toY(history[i])
            const v1 = history[i]
            const col = v1 >= 1 ? 0x34d399 : v1 >= 0.5 ? 0xfbbf24 : 0x475569

            // Polyline segment
            gfx.lineStyle(1, col, 0.85)
            gfx.beginPath()
            gfx.moveTo(x0, y0)
            gfx.lineTo(x1, y1)
            gfx.strokePath()

            // Area fill below at 0.05 alpha
            gfx.fillStyle(col, 0.05)
            gfx.beginPath()
            gfx.moveTo(x0, H)
            gfx.lineTo(x0, y0)
            gfx.lineTo(x1, y1)
            gfx.lineTo(x1, H)
            gfx.closePath()
            gfx.fillPath()
          }
        }
      }
    }
  }

  private layoutWorkstations(room: Room): void {
    const agents = Array.from(room.workstations.values())
    const count  = agents.length
    if (count === 0) return

    const cols = Math.min(count, MAX_AGENTS_PER_ROW)
    const rows = Math.ceil(count / cols)

    const WALL_T = 8
    const WALL_I = 4
    const floorStartX = -room.width  / 2 + WALL_T + WALL_I + ROOM_PADDING
    const floorStartY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H + ROOM_PADDING + ROOM_TOP_EXTRA

    const usableW = room.width  - (WALL_T + WALL_I + ROOM_PADDING) * 2
    const usableH = room.height - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H - ROOM_PADDING * 2 - ROOM_TOP_EXTRA

    const cellW = usableW / cols
    const cellH = usableH / rows

    agents.forEach((ws, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx  = floorStartX + col * cellW + cellW / 2
      const cy  = floorStartY + row * cellH + cellH / 2

      this.tweens.killTweensOf(ws.container)
      this.tweens.add({ targets: ws.container, x: cx, y: cy, duration: 280, ease: 'Power2' })
      ws.container.setDepth(cy + room.y)
    })
  }

  private destroyCeilingLights(): void {
    this.atmosphere.destroyCeilingLights()
  }

  private destroyWorkstation(ws: WorkstationSprite): void {
    if (ws.breathTween)      ws.breathTween.destroy()
    if (ws.bounceTween)      ws.bounceTween.destroy()
    if (ws.dotPulseTween)    ws.dotPulseTween.destroy()
    if (ws.blockedIndicatorTween) ws.blockedIndicatorTween.destroy()
    if (ws.walkBreakTween)   ws.walkBreakTween.destroy()
    if (ws.typingTween)      ws.typingTween.destroy()
    if (ws.headTiltTween)    ws.headTiltTween.destroy()
    if (ws.monitorGlowTween) ws.monitorGlowTween.destroy()
    if (ws.screenTween)      ws.screenTween.destroy()
    if (ws.monitorTextTween) ws.monitorTextTween.destroy()
    if (ws.pulseTween)       ws.pulseTween.destroy()
    if (ws.ledPulseTween)    ws.ledPulseTween.destroy()
    if (ws.lookAroundTimer)     ws.lookAroundTimer.destroy()
    if (ws.stretchTimer)        ws.stretchTimer.destroy()
    if (ws.walkBreakTimer)      ws.walkBreakTimer.destroy()
    if (ws.lookAtNeighborTimer) ws.lookAtNeighborTimer.destroy()
    if (ws.yawnTimer)           ws.yawnTimer.destroy()
    this.particles.clearSteamParticles(ws)
    this.tweens.killTweensOf(ws.thoughtBubble)
    if (ws.blurbFadeTimer)          ws.blurbFadeTimer.destroy()
    if (ws.blurbTypingTween)        ws.blurbTypingTween.destroy()
    if (ws.thoughtBubbleFloatTween) ws.thoughtBubbleFloatTween.destroy()
    if (ws.moodTween) ws.moodTween.destroy()
    if (ws.moodEmoji) this.tweens.killTweensOf(ws.moodEmoji)
    if (ws.deskPlantTween)   ws.deskPlantTween.destroy()
    if (ws.xpBarTween)       ws.xpBarTween.destroy()
    if (ws.soundWaveTween)   ws.soundWaveTween.destroy()
    if (ws.soundWaveGfx)     ws.soundWaveGfx.destroy()
    if (ws.shadow)           ws.shadow.destroy()
    if (ws.sparklineGfx)     { ws.sparklineGfx.clear(); ws.sparklineGfx.destroy() }
    if (ws.phoneLightTween)      ws.phoneLightTween.destroy()
    if (ws.progressRingTween)    ws.progressRingTween.destroy()
    if (ws.progressRing)         { ws.progressRing.clear(); ws.progressRing.destroy() }
    if (ws.roleBadgePulseTween)  ws.roleBadgePulseTween.destroy()
    if (ws.taskCountFlashTween)  ws.taskCountFlashTween.destroy()
    if (ws.taskCountBg)          { ws.taskCountBg.clear(); ws.taskCountBg.destroy() }
    if (ws.taskCountText)        ws.taskCountText.destroy()
    ws.activityHistory = []

    // Exit animation: shrink + fade, then destroy.
    // Detach from room container first so deferred destroy can't interfere with layout.
    try {
      const agentName = ws.state?.config.name || 'Agent'
      if (ws.container.active && this.scene.isActive()) {
        const parent = ws.container.parentContainer
        if (parent) parent.remove(ws.container)
        this.showToast(`${agentName} left`, 'info')
        this.tweens.add({
          targets: ws.container,
          alpha: 0, scaleX: 0.3, scaleY: 0.3,
          duration: 300, ease: 'Quad.easeIn',
          onComplete: () => { try { ws.container.destroy() } catch { /* already gone */ } },
        })
      } else {
        ws.container.destroy()
      }
    } catch {
      try { ws.container.destroy() } catch { /* noop */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Task count badge
  // ---------------------------------------------------------------------------

  /**
   * Redraws the task-completion counter badge on a workstation.
   *
   * Color tiers:
   *   0       — badge hidden (initial state before any task finishes)
   *   1-4     — gray  (#64748b) — "getting started"
   *   5-9     — blue  (#3b82f6) — productive
   *   10+     — gold  (#fbbf24) — productivity champion
   *
   * On every increment a brief green flash animates the bg alpha 0.6→1→0.6
   * and the text color briefly switches to green (#34d399) then returns to
   * the tier color over 500ms.
   */
  private refreshTaskCountDisplay(ws: WorkstationSprite): void {
    const { taskCountBg, taskCountText, localTaskCount: count } = ws
    if (!taskCountBg || !taskCountText) return

    // Determine tier color
    let tierColor: string
    if (count >= 10) {
      tierColor = '#fbbf24'  // gold — champion
    } else if (count >= 5) {
      tierColor = '#3b82f6'  // blue — productive
    } else {
      tierColor = '#64748b'  // gray — getting started
    }

    // Make visible if this is the first completion
    if (count === 1) {
      taskCountBg.setAlpha(0.6)
      taskCountText.setAlpha(1)
    }

    // Update label text with the current count
    taskCountText.setText(String(count))

    // Kill any in-progress flash tween
    if (ws.taskCountFlashTween) {
      ws.taskCountFlashTween.destroy()
      ws.taskCountFlashTween = undefined
    }

    // Green flash on the bg, then restore; text briefly green then tier color
    taskCountText.setColor('#34d399')
    taskCountBg.setAlpha(1)

    ws.taskCountFlashTween = this.tweens.add({
      targets: taskCountBg,
      alpha: { from: 1, to: 0.6 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        ws.taskCountFlashTween = undefined
        // Restore text to tier color after flash settles
        if (taskCountText.active) taskCountText.setColor(tierColor)
      },
    })

    // After a short delay, snap text color to tier color if flash completed early
    this.time.delayedCall(500, () => {
      if (taskCountText.active) taskCountText.setColor(tierColor)
    })
  }

  // ---------------------------------------------------------------------------
  // Room layout
  // ---------------------------------------------------------------------------

  private calcRoomSize(agentCount: number): { width: number; height: number } {
    const n    = Math.max(1, agentCount)
    const cols = Math.min(n, MAX_AGENTS_PER_ROW)
    const rows = Math.ceil(n / cols)
    const WALL_T = 8
    const WALL_I = 4
    return {
      width:  (WALL_T + WALL_I + ROOM_PADDING) * 2 + cols * WORKSTATION_W,
      height: (WALL_T + WALL_I) * 2 + ROOM_HEADER_H + ROOM_PADDING * 2 + ROOM_TOP_EXTRA + rows * WORKSTATION_H,
    }
  }

  private layoutRooms(): void {
    const roomList = Array.from(this.rooms.values())

    if (roomList.length === 0) {
      this.worldWidth  = 800
      this.worldHeight = 600
      this.officeGraphics?.clear()
      for (const t of this.decoTweens) { try { t.destroy() } catch { /* gone */ } }
      this.decoTweens = []
      if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
      for (const s of this.officeDecoSprites) s.destroy()
      this.officeDecoSprites = []
      this.lastOfficeBgW = 0
      this.lastOfficeBgH = 0
      this.corridorGraphics?.clear()
      this.hallwayIndicatorGraphics?.clear()
      this.corridorSegments = []
      for (const t of this.corridorSignTexts) t.destroy()
      this.corridorSignTexts = []
      this.drawTeamAreas([])
      this.updateCameraBounds()
      return
    }

    // Team zoning: parent-folder teams get dedicated areas with compact packing
    // to reduce scrolling while keeping team separation clear.
    const availableW = Math.max(this.viewWidth - WORLD_MARGIN * 2, 340)
    const areaPadX = TEAM_AREA_PAD_X
    const areaPadY = TEAM_AREA_PAD_Y
    const areaGapX = TEAM_AREA_GAP_X
    const areaGapY = TEAM_AREA_GAP_Y
    const teamLabelH = TEAM_LABEL_H
    const teams = new Map<string, Room[]>()
    for (const room of roomList) {
      const key = room.teamKey || room.cwd
      if (!teams.has(key)) teams.set(key, [])
      teams.get(key)!.push(room)
    }
    const teamKeys = Array.from(teams.keys()).sort((a, b) => {
      if (a === '__unassigned__') return 1
      if (b === '__unassigned__') return -1
      return a.localeCompare(b)
    })

    const teamCount = teamKeys.length
    const maxRoomWidth = Math.max(...roomList.map(r => r.width))
    const minTeamWidth = maxRoomWidth + areaPadX * 2
    const colsByWidth =
      availableW >= minTeamWidth * 3 + areaGapX * 2 ? 3 :
      availableW >= minTeamWidth * 2 + areaGapX ? 2 : 1
    const desiredCols = teamCount >= 6 ? 3 : teamCount >= 3 ? 2 : 1
    const teamColumns = Math.max(1, Math.min(colsByWidth, desiredCols))
    const preferredTeamWidth = Math.max(
      minTeamWidth,
      Math.floor((availableW - areaGapX * (teamColumns - 1)) / teamColumns),
    )

    const teamLayouts: TeamAreaLayout[] = []
    const teamDrafts: Array<{
      teamKey: string
      teamLabel: string
      rooms: Room[]
      roomLocalPos: Map<Room, { x: number; y: number }>
      width: number
      height: number
    }> = []
    for (const teamKey of teamKeys) {
      const teamRooms = teams.get(teamKey) ?? []
      teamRooms.sort((a, b) => a.label.localeCompare(b.label))
      const roomLocalPos = new Map<Room, { x: number; y: number }>()
      // Size each team area from its own content so single-agent offices
      // don't inherit oversized width from unrelated larger rooms.
      const widestRoomInTeam = teamRooms.reduce((max, room) => Math.max(max, room.width), 0)
      const teamMinWidth = Math.max(150, widestRoomInTeam + areaPadX * 2)

      let cursorX = 0
      let cursorY = 0
      let rowHeight = 0
      let maxUsedWidth = 0

      for (const room of teamRooms) {
        const maxTeamWidth = Math.max(180, preferredTeamWidth - areaPadX * 2)
        if (cursorX > 0 && cursorX + room.width > maxTeamWidth) {
          cursorX = 0
          cursorY += rowHeight + ROOM_GAP
          rowHeight = 0
        }
        roomLocalPos.set(room, {
          x: areaPadX + cursorX + room.width / 2,
          y: areaPadY + teamLabelH + cursorY + room.height / 2,
        })

        cursorX += room.width + ROOM_GAP
        rowHeight = Math.max(rowHeight, room.height)
        maxUsedWidth = Math.max(maxUsedWidth, Math.max(0, cursorX - ROOM_GAP))
      }

      const contentH = teamRooms.length > 0 ? cursorY + rowHeight : 0
      const contentW = areaPadX * 2 + maxUsedWidth
      const teamWidth = Math.max(
        teamMinWidth,
        Math.min(preferredTeamWidth, Math.max(contentW, teamMinWidth)),
      )
      const teamHeight = Math.max(115, areaPadY * 2 + teamLabelH + Math.max(contentH, 62))
      const teamLabel = teamRooms[0]?.teamLabel ?? this.formatLabel(teamKey)
      teamDrafts.push({
        teamKey,
        teamLabel,
        rooms: teamRooms,
        roomLocalPos,
        width: teamWidth,
        height: teamHeight,
      })
    }

    type TeamDraft = typeof teamDrafts[number]
    const rows: Array<{ drafts: TeamDraft[]; width: number; height: number }> = []
    let rowDrafts: TeamDraft[] = []
    let rowWidth = 0
    let rowHeight = 0
    for (const draft of teamDrafts) {
      const nextWidth = rowDrafts.length === 0 ? draft.width : rowWidth + areaGapX + draft.width
      if (rowDrafts.length > 0 && nextWidth > availableW) {
        rows.push({ drafts: rowDrafts, width: rowWidth, height: rowHeight })
        rowDrafts = []
        rowWidth = 0
        rowHeight = 0
      }
      rowDrafts.push(draft)
      rowWidth = rowDrafts.length === 1 ? draft.width : rowWidth + areaGapX + draft.width
      rowHeight = Math.max(rowHeight, draft.height)
    }
    if (rowDrafts.length > 0) {
      rows.push({ drafts: rowDrafts, width: rowWidth, height: rowHeight })
    }

    // Anchor layout from the top-left corner.
    let areaCursorY = 0

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      // Even rows (0, 2, 4…) have doors on bottom, odd rows (1, 3, 5…) on top
      // This way pairs of rows share a hallway between them
      const doorSide: 'top' | 'bottom' = rowIdx % 2 === 0 ? 'bottom' : 'top'
      let areaCursorX = 0
      for (const draft of row.drafts) {
        const areaX = WORLD_MARGIN + areaCursorX
        const areaY = WORLD_MARGIN + areaCursorY

        for (const room of draft.rooms) {
          const local = draft.roomLocalPos.get(room)
          if (!local) continue
          room.x = areaX + local.x
          room.y = areaY + local.y
          room.doorSide = doorSide
          this.tweens.killTweensOf(room.container)
          room.container.setPosition(room.x, room.y)
        }

        teamLayouts.push({
          teamKey: draft.teamKey,
          teamLabel: draft.teamLabel,
          x: areaX,
          y: areaY,
          width: draft.width,
          height: draft.height,
          agentCount: draft.rooms.reduce((sum, r) => sum + r.agents.length, 0),
        })
        areaCursorX += draft.width + areaGapX
      }
      areaCursorY += row.height + areaGapY
    }

    for (const room of roomList) {
      if (!room.cwd.startsWith('__')) {
        this.refreshRoomHeaderText(room)
      }
      // Redraw door panel to match assigned doorSide
      const accentColor = this.getTeamColor(room.teamKey)
      const floorW = room.width - 12
      this.drawDoorPanel(room, floorW, accentColor)
    }

    let maxX = 0, maxY = 0
    for (const room of roomList) {
      maxX = Math.max(maxX, room.x + room.width  / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    for (const area of teamLayouts) {
      maxX = Math.max(maxX, area.x + area.width)
      maxY = Math.max(maxY, area.y + area.height)
    }
    // Position café inline — to the right of rooms, top-aligned with first row
    const cafeX = maxX + this.cafe.width / 2 + 40
    let minAreaTopY = Infinity
    for (const area of teamLayouts) {
      minAreaTopY = Math.min(minAreaTopY, area.y)
    }
    const cafeTopY = minAreaTopY === Infinity ? WORLD_MARGIN : minAreaTopY
    const cafeBottomY = cafeTopY + this.cafe.height

    // World bounds include both rooms and café
    const totalMaxX = cafeX + this.cafe.width / 2
    const totalMaxY = Math.max(maxY, cafeBottomY)
    this.worldWidth  = totalMaxX + WORLD_MARGIN
    this.worldHeight = totalMaxY + WORLD_MARGIN
    this.tripletDirty = true

    // Draw office background — includes café
    if (this.officeGraphics) {
      const bgW = totalMaxX + WORLD_MARGIN
      const bgH = Math.max(maxY, cafeBottomY) + WORLD_MARGIN
      this.drawOfficeBackground(bgW, bgH)
    }

    // Build Penny Café
    if (this.rooms.size > 0) {
      this.cafe.build(cafeX, cafeTopY)
    }

    // Erase building floor below the café so no dark rectangle shows.
    // Must match drawOfficeBackground's building rect exactly.
    if (this.cafeFloorMask) { this.cafeFloorMask.destroy(); this.cafeFloorMask = null }
    if (this.rooms.size > 0) {
      const BG_PAD = 30
      const BG_WALL = 5
      const bgContentW = totalMaxX + WORLD_MARGIN
      const bgContentH = Math.max(maxY, cafeBottomY) + WORLD_MARGIN
      const bx = WORLD_MARGIN - BG_PAD
      const by = WORLD_MARGIN - BG_PAD
      const bw = bgContentW - WORLD_MARGIN + BG_PAD * 2
      const bh = bgContentH - WORLD_MARGIN + BG_PAD * 2
      const floorRight = bx + bw - BG_WALL
      const floorBottom = by + bh - BG_WALL

      const maskX = cafeX - this.cafe.width / 2
      const maskY = cafeBottomY
      if (floorRight > maskX && floorBottom > maskY) {
        const mask = this.add.graphics().setDepth(-3)
        mask.fillStyle(COLOR_BG)
        mask.fillRect(maskX, maskY, floorRight - maskX, floorBottom - maskY)
        this.cafeFloorMask = mask
      }
    }

    this.rebuildNavMesh()
    this.drawTeamAreas(teamLayouts)
    this.drawCorridors(roomList)
    this.drawHallwayIndicators(this.time.now)

    this.updateCameraBounds()
  }

  private drawTeamAreas(layouts: TeamAreaLayout[]): void {
    const g = this.teamAreaGraphics
    if (!g) return
    g.clear()
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    if (layouts.length === 0) return

    const BANNER_H = 22
    const CORNER_LEN = 8
    const ICON_TYPES = ['code', 'gear', 'chart', 'folder'] as const
    type IconType = typeof ICON_TYPES[number]

    for (const area of layouts) {
      const color = this.getTeamColor(area.teamKey)
      const { x, y, width, height } = area

      // --- 1. Gradient-style background (3 layered rects, increasing alpha inward) ---
      g.fillStyle(color, 0.04)
      g.fillRoundedRect(x, y, width, height, 10)
      g.fillStyle(color, 0.06)
      g.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 8)
      g.fillStyle(color, 0.08)
      g.fillRoundedRect(x + 8, y + 8, width - 16, height - 16, 6)

      // --- 2. Department banner ---
      g.fillStyle(color, 0.15)
      g.fillRoundedRect(x, y, width, BANNER_H, { tl: 10, tr: 10, bl: 0, br: 0 })
      // Accent line below banner
      g.lineStyle(1, color, 0.4)
      g.lineBetween(x, y + BANNER_H, x + width, y + BANNER_H)

      // --- 3. Dashed border ---
      g.lineStyle(1, color, 0.2)
      this.drawDashedLine(g, x, y, x + width, y, 6, 4)
      this.drawDashedLine(g, x + width, y, x + width, y + height, 6, 4)
      this.drawDashedLine(g, x + width, y + height, x, y + height, 6, 4)
      this.drawDashedLine(g, x, y + height, x, y, 6, 4)

      // --- 4. Corner accent brackets ---
      g.lineStyle(1.5, color, 0.3)
      // top-left
      g.beginPath()
      g.moveTo(x + CORNER_LEN, y + 2); g.lineTo(x + 2, y + 2); g.lineTo(x + 2, y + CORNER_LEN)
      g.strokePath()
      // top-right
      g.beginPath()
      g.moveTo(x + width - CORNER_LEN, y + 2); g.lineTo(x + width - 2, y + 2); g.lineTo(x + width - 2, y + CORNER_LEN)
      g.strokePath()
      // bottom-left
      g.beginPath()
      g.moveTo(x + 2, y + height - CORNER_LEN); g.lineTo(x + 2, y + height - 2); g.lineTo(x + CORNER_LEN, y + height - 2)
      g.strokePath()
      // bottom-right
      g.beginPath()
      g.moveTo(x + width - CORNER_LEN, y + height - 2); g.lineTo(x + width - 2, y + height - 2); g.lineTo(x + width - 2, y + height - CORNER_LEN)
      g.strokePath()

      // --- 5. Team icon (deterministic from teamLabel hash) ---
      const iconType: IconType = ICON_TYPES[this.hashToken(area.teamLabel) % ICON_TYPES.length]
      const iconX = x + 12
      const iconY = y + BANNER_H / 2
      g.lineStyle(1.2, color, 0.5)
      if (iconType === 'code') {
        // </> left bracket
        g.beginPath()
        g.moveTo(iconX - 1, iconY - 3); g.lineTo(iconX - 4, iconY); g.lineTo(iconX - 1, iconY + 3)
        g.strokePath()
        // </> right bracket
        g.beginPath()
        g.moveTo(iconX + 1, iconY - 3); g.lineTo(iconX + 4, iconY); g.lineTo(iconX + 1, iconY + 3)
        g.strokePath()
        g.fillStyle(color, 0.5)
        g.fillRect(iconX - 0.5, iconY - 0.5, 1, 1)
      } else if (iconType === 'gear') {
        // 4-spoke asterisk + center circle
        g.beginPath(); g.moveTo(iconX - 4, iconY); g.lineTo(iconX + 4, iconY); g.strokePath()
        g.beginPath(); g.moveTo(iconX, iconY - 4); g.lineTo(iconX, iconY + 4); g.strokePath()
        g.beginPath(); g.moveTo(iconX - 3, iconY - 3); g.lineTo(iconX + 3, iconY + 3); g.strokePath()
        g.beginPath(); g.moveTo(iconX + 3, iconY - 3); g.lineTo(iconX - 3, iconY + 3); g.strokePath()
        g.lineStyle(1, color, 0.5)
        g.strokeCircle(iconX, iconY, 2)
      } else if (iconType === 'chart') {
        // 3-bar bar chart with baseline
        g.fillStyle(color, 0.5)
        g.fillRect(iconX - 5, iconY, 2, 3)
        g.fillRect(iconX - 1, iconY - 2, 2, 5)
        g.fillRect(iconX + 3, iconY - 4, 2, 7)
        g.lineStyle(1, color, 0.5)
        g.lineBetween(iconX - 6, iconY + 3, iconX + 6, iconY + 3)
      } else {
        // folder shape — body + tab
        g.beginPath()
        g.moveTo(iconX - 5, iconY - 1); g.lineTo(iconX - 5, iconY + 3); g.lineTo(iconX + 5, iconY + 3); g.lineTo(iconX + 5, iconY - 1)
        g.strokePath()
        g.beginPath()
        g.moveTo(iconX - 5, iconY - 1); g.lineTo(iconX - 5, iconY - 3); g.lineTo(iconX - 1, iconY - 3); g.lineTo(iconX - 1, iconY - 1)
        g.strokePath()
      }

      // --- 6. Team label centered in banner ---
      const labelText = this.add.text(x + width / 2 + 4, y + BANNER_H / 2, area.teamLabel, {
        fontSize: '12px',
        color: '#e2e8f0',
        fontFamily: 'system-ui, monospace',
        fontStyle: 'bold',
        resolution: 2,
      })
      labelText.setOrigin(0.5, 0.5)
      labelText.setDepth(-1)
      this.teamAreaLabels.push(labelText)

      // --- 6b. Animated underline beneath the team label ---
      // Starts at scaleX=0, sweeps right over 500ms, then alpha-pulses indefinitely.
      const underlineGfx = this.add.graphics()
      const ulY = y + BANNER_H - 3
      const ulX = x + width / 2 + 4 - labelText.width / 2
      underlineGfx.lineStyle(2, color, 0.5)
      underlineGfx.lineBetween(0, 0, labelText.width, 0)
      underlineGfx.setPosition(ulX, ulY)
      underlineGfx.setDepth(-1)
      underlineGfx.setScale(0, 1)
      this.tweens.add({
        targets: underlineGfx,
        scaleX: 1,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: underlineGfx,
            alpha: { from: 0.45, to: 0.85 },
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
          })
        },
      })
      this.teamAreaLabels.push(underlineGfx)

      // --- 7. Agent count badge (top-right of banner) ---
      const badgeLabel = `${area.agentCount} agent${area.agentCount !== 1 ? 's' : ''}`
      const badgePadX = 5
      const badgePadY = 3
      const badgeTextObj = this.add.text(0, 0, badgeLabel, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'system-ui, monospace',
        resolution: 2,
      })
      badgeTextObj.setDepth(-1)
      const badgeW = badgeTextObj.width + badgePadX * 2
      const badgeH = badgeTextObj.height + badgePadY * 2
      const badgeX = x + width - badgeW - 8
      const badgeY = y + (BANNER_H - badgeH) / 2
      g.fillStyle(color, 0.2)
      g.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 4)
      g.lineStyle(1, color, 0.3)
      g.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 4)
      badgeTextObj.setPosition(badgeX + badgePadX, badgeY + badgePadY)
      this.teamAreaLabels.push(badgeTextObj)
    }
  }

  private drawCorridors(roomList: Room[]): void {
    const g = this.corridorGraphics
    if (!g) return
    g.clear()
    this.corridorSegments = []

    // Destroy sign texts created during the previous layout pass.
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []

    if (roomList.length < 2) {
      this.hallwayIndicatorGraphics?.clear()
      return
    }

    // Group rooms by team + row so corridors stay inside team zones.
    const rows = new Map<string, { teamKey: string; rowTop: number; rooms: Room[] }>()
    for (const room of roomList) {
      const rowTop = Math.round(room.y - room.height / 2)
      const rowKey = `${room.teamKey}|${rowTop}`
      if (!rows.has(rowKey)) rows.set(rowKey, { teamKey: room.teamKey, rowTop, rooms: [] })
      rows.get(rowKey)!.rooms.push(room)
    }

    const sortedRows = Array.from(rows.values()).sort((a, b) => {
      if (a.rowTop !== b.rowTop) return a.rowTop - b.rowTop
      return a.teamKey.localeCompare(b.teamKey)
    })
    for (const row of sortedRows) {
      const rowRooms = row.rooms
      if (rowRooms.length < 2) continue
      rowRooms.sort((a, b) => a.x - b.x)

      // Place hallway near the doors — use the first room's door side to decide
      const doorSide = rowRooms[0].doorSide
      const maxBottom = Math.max(...rowRooms.map(r => r.y + r.height / 2))
      const minTop = Math.min(...rowRooms.map(r => r.y - r.height / 2))
      let hallY = doorSide === 'top'
        ? minTop - ROOM_GAP * 0.45
        : maxBottom + ROOM_GAP * 0.45

      const minX = rowRooms[0].x
      const maxX = rowRooms[rowRooms.length - 1].x
      const lineColor = this.getTeamColor(row.teamKey)
      const hallWidth = maxX - minX

      // Keep horizontal corridor segment in the particle system.
      this.corridorSegments.push({ x1: minX, y1: hallY, x2: maxX, y2: hallY, color: lineColor })

      // Hallway body — filled rect (floor + carpet stripe + edge lines)
      const HALL_H = 12
      const HALL_FLOOR = 0x0f1520
      const HALL_STRIPE = 0x1a2535
      const HALL_EDGE = 0x1e293b
      const LEG_W = 6
      const JUNC_W = 8
      const CHEVRON_GAP = 40

      g.fillStyle(HALL_FLOOR, 0.72)
      g.fillRect(minX - LEG_W / 2, hallY - HALL_H / 2, hallWidth + LEG_W, HALL_H)

      // Center carpet-runner stripe (2 px tall)
      g.fillStyle(HALL_STRIPE, 0.85)
      g.fillRect(minX - LEG_W / 2, hallY - 1, hallWidth + LEG_W, 2)

      // Top and bottom edge lines (1 px each)
      g.fillStyle(HALL_EDGE, 0.9)
      g.fillRect(minX - LEG_W / 2, hallY - HALL_H / 2, hallWidth + LEG_W, 1)
      g.fillRect(minX - LEG_W / 2, hallY + HALL_H / 2 - 1, hallWidth + LEG_W, 1)

      // Directional chevron arrows every CHEVRON_GAP px.
      // Upper chevrons point right (>), lower chevrons point left (<).
      const chevronSize = 3
      g.lineStyle(1, lineColor, 0.12)
      const numChevrons = Math.floor(hallWidth / CHEVRON_GAP)
      for (let ci = 0; ci <= numChevrons; ci++) {
        const cx = minX + ci * CHEVRON_GAP

        // Upper chevron — points right (>), above the stripe
        const uyMid = hallY - 3.5
        g.beginPath()
        g.moveTo(cx - chevronSize, uyMid - chevronSize)
        g.lineTo(cx, uyMid)
        g.lineTo(cx - chevronSize, uyMid + chevronSize)
        g.strokePath()

        // Lower chevron — points left (<), below the stripe
        const lyMid = hallY + 3.5
        g.beginPath()
        g.moveTo(cx + chevronSize, lyMid - chevronSize)
        g.lineTo(cx, lyMid)
        g.lineTo(cx + chevronSize, lyMid + chevronSize)
        g.strokePath()
      }

      // Room connection legs + T-junctions + name plates
      for (const room of rowRooms) {
        const doorY = this.getRoomDoorY(room) - 4
        const legTop = Math.min(doorY, hallY - HALL_H / 2)
        const legBot = Math.max(doorY, hallY + HALL_H / 2)

        // Vertical leg: filled rect (LEG_W wide)
        if (legBot > legTop) {
          g.fillStyle(HALL_FLOOR, 0.72)
          g.fillRect(room.x - LEG_W / 2, legTop, LEG_W, legBot - legTop)
          // Edge lines on both sides of the leg
          g.fillStyle(HALL_EDGE, 0.9)
          g.fillRect(room.x - LEG_W / 2, legTop, 1, legBot - legTop)
          g.fillRect(room.x + LEG_W / 2 - 1, legTop, 1, legBot - legTop)
        }

        // T-junction cap (JUNC_W x HALL_H centered on junction)
        g.fillStyle(HALL_FLOOR, 0.88)
        g.fillRect(room.x - JUNC_W / 2, hallY - HALL_H / 2, JUNC_W, HALL_H)
        // Top and bottom edge accents on the junction cap
        g.fillStyle(HALL_EDGE, 0.9)
        g.fillRect(room.x - JUNC_W / 2, hallY - HALL_H / 2, JUNC_W, 1)
        g.fillRect(room.x - JUNC_W / 2, hallY + HALL_H / 2 - 1, JUNC_W, 1)

        // Overhead light suggestion — warm amber glow dot at junction centre
        g.fillStyle(0xfbbf24, 0.1)
        g.fillCircle(room.x, hallY, 3)

        // Particle segment for the vertical leg
        this.corridorSegments.push({ x1: room.x, y1: doorY, x2: room.x, y2: hallY, color: lineColor })

        // Room name plate — compact sign just above the T-junction
        const rawLabel = room.label || room.cwd.split('/').pop() || '?'
        const signLabel = rawLabel.length > 6 ? rawLabel.slice(0, 5) + '.' : rawLabel
        const signCharW = 4
        const signW = signLabel.length * signCharW + 6
        const signH = 8
        const signX = room.x - signW / 2
        const signY = hallY - HALL_H / 2 - signH - 2

        // Sign backing rect on corridorGraphics — cleared automatically on next redraw
        g.fillStyle(0x0f172a, 0.82)
        g.fillRect(signX, signY, signW, signH)
        g.lineStyle(1, lineColor, 0.28)
        g.strokeRect(signX, signY, signW, signH)

        // Sign text as a Phaser Text object for crisp glyph rendering
        const signText = this.add.text(room.x, signY + signH / 2, signLabel, {
          fontSize: '5px',
          fontFamily: 'monospace',
          color: '#94a3b8',
          resolution: 2,
        })
        signText.setOrigin(0.5, 0.5)
        signText.setDepth(-1)
        this.corridorSignTexts.push(signText)
      }
    }
    // Sync updated corridor segments to the particle system
    if (this.particles) {
      this.particles.setCorridorData(this.corridorSegments, false)
    }
  }

  private drawHallwayIndicators(timeMs: number): void {
    const g = this.hallwayIndicatorGraphics
    if (!g) return
    g.clear()
    if (this.corridorSegments.length === 0) return

    for (let i = 0; i < this.corridorSegments.length; i++) {
      const seg = this.corridorSegments[i]
      const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
      if (len < 1) continue
      const speed = 0.00042
      const t = (timeMs * speed + i * 0.173) % 1
      const px = Phaser.Math.Linear(seg.x1, seg.x2, t)
      const py = Phaser.Math.Linear(seg.y1, seg.y2, t)
      g.fillStyle(seg.color, 0.2)
      g.fillCircle(px, py, 4.2)
      g.fillStyle(0xe2e8f0, 0.72)
      g.fillCircle(px, py, 1.6)
    }
  }

  // ---------------------------------------------------------------------------
  // Floor arrow lighting — emergency-exit-style chevrons toward active rooms
  // ---------------------------------------------------------------------------

  private drawFloorArrows(time: number): void {
    const g = this.floorArrowGfx
    if (!g) return
    g.clear()

    const activeRooms: Room[] = []
    for (const room of this.rooms.values()) {
      const hasWorking = room.agents.some(
        (a) => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
      )
      if (hasWorking) activeRooms.push(room)
    }
    if (activeRooms.length === 0) return

    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const room of this.rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    const entranceX = (minX + maxX) / 2
    const entranceY = maxY + 20

    const ARROW_SPACING = 20
    const CHEVRON_W = 3
    const CHEVRON_L = 5
    const arrowColor = activeTheme.doorFrame

    for (const room of activeRooms) {
      const doorX = room.x
      const doorY = this.getRoomDoorY(room)
      const ddx = doorX - entranceX
      const ddy = doorY - entranceY
      const totalDist = Math.hypot(ddx, ddy)
      if (totalDist < 1) continue
      const nx = ddx / totalDist
      const ny = ddy / totalDist
      const perpX = -ny
      const perpY = nx
      const stopDist = totalDist - room.height / 2 - 4
      if (stopDist < ARROW_SPACING) continue

      for (let d = ARROW_SPACING; d <= stopDist; d += ARROW_SPACING) {
        const tipX = entranceX + nx * d
        const tipY = entranceY + ny * d
        const baseX = tipX - nx * CHEVRON_L
        const baseY = tipY - ny * CHEVRON_L
        const lx = baseX - perpX * CHEVRON_W
        const ly = baseY - perpY * CHEVRON_W
        const rx = baseX + perpX * CHEVRON_W
        const ry = baseY + perpY * CHEVRON_W
        const distFromRoom = totalDist - d
        const alpha = 0.04 + 0.06 * Math.sin(time * 0.003 + distFromRoom * 0.05)
        if (alpha <= 0) continue
        g.lineStyle(0.8, arrowColor, alpha)
        g.beginPath()
        g.moveTo(lx, ly)
        g.lineTo(tipX, tipY)
        g.lineTo(rx, ry)
        g.strokePath()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Seasonal decoration config — returns palette + season tag based on real month
  // ---------------------------------------------------------------------------

  private getSeasonalConfig(): {
    color: number
    accent: number
    extraDecorType: 'winter' | 'spring' | 'summer' | 'autumn'
  } {
    const month = new Date().getMonth() // 0 = Jan … 11 = Dec
    if (month === 11 || month <= 1) return { color: 0x93c5fd, accent: 0xef4444, extraDecorType: 'winter' }
    if (month >= 2 && month <= 4) return { color: 0x86efac, accent: 0xfbbf24, extraDecorType: 'spring' }
    if (month >= 5 && month <= 7) return { color: 0xfde68a, accent: 0x0ea5e9, extraDecorType: 'summer' }
    return { color: 0xfbbf24, accent: 0xea580c, extraDecorType: 'autumn' }
  }

  // ---------------------------------------------------------------------------
  // Office background (standalone graphics, NOT a container)
  // ---------------------------------------------------------------------------

  private drawOfficeBackground(contentW: number, contentH: number): void {
    if (contentW === this.lastOfficeBgW && contentH === this.lastOfficeBgH) return
    this.lastOfficeBgW = contentW
    this.lastOfficeBgH = contentH

    const g = this.officeGraphics
    if (!g) return
    g.clear()

    for (const t of this.decoTweens) { try { t.destroy() } catch { /* already gone */ } }
    this.decoTweens = []
    if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    for (const d of this.seasonalDecos) { try { (d as { destroy(): void }).destroy() } catch { /* already gone */ } }
    this.seasonalDecos = []

    const WALL_T = 5
    const WALL_I = 2
    const PAD = 30

    const bx = WORLD_MARGIN - PAD
    const by = WORLD_MARGIN - PAD
    const bw = contentW - WORLD_MARGIN + PAD * 2
    const bh = contentH - WORLD_MARGIN + PAD * 2

    // Floor is inset from the wall
    const fx = bx + WALL_T
    const fy = by + WALL_T
    const fw = bw - WALL_T * 2
    const fh = bh - WALL_T * 2

    // Outer wall
    g.fillStyle(COLOR_WALL)
    g.fillRoundedRect(bx, by, bw, bh, 5)

    // Floor (inset from wall)
    g.fillStyle(0x0f172a)
    g.fillRoundedRect(fx, fy, fw, fh, 2)

    this.atmosphere.windowPositions = []
    this.destroyCeilingLights()
    if (this.flagContainer) { this.tweens.killTweensOf(this.flagContainer); this.flagContainer.destroy(true); this.flagContainer = null }

    // All building decorations removed — clean building
    if (this.atmosphere.wallClockContainer) { this.atmosphere.wallClockContainer.destroy(); this.atmosphere.wallClockContainer = null }
    if (this.whiteboardContainer) { this.whiteboardContainer.destroy(); this.whiteboardContainer = null; this.whiteboardTexts = [] }
    if (this.atmosphere.exteriorLights) { this.atmosphere.exteriorLights.destroy(); this.atmosphere.exteriorLights = null }
    if (false) {
      // Dead code kept for reference — everything below is skipped
      const DECO_SCALE = 0.65; const decos: Phaser.GameObjects.Sprite[] = []; void DECO_SCALE; void decos

      // Animated analog wall clock
      if (fw > 300) {
        const clockX = fx + fw / 2
        const clockY = by + 12
        if (this.atmosphere.wallClockContainer) {
          this.atmosphere.wallClockContainer.destroy()
          this.atmosphere.wallClockContainer = null
          this.atmosphere.clockHourHand = null
          this.atmosphere.clockMinuteHand = null
          this.atmosphere.clockSecondHand = null
        }
        const clockFace = this.add.graphics()
        clockFace.fillStyle(0x1e293b, 0.8)
        clockFace.fillCircle(0, 0, 12)
        clockFace.lineStyle(1, 0x475569, 1)
        clockFace.strokeCircle(0, 0, 12)
        clockFace.lineStyle(1, 0x64748b, 0.8)
        for (let t = 0; t < 12; t++) {
          const ang = Phaser.Math.DegToRad(t * 30 - 90)
          clockFace.lineBetween(Math.cos(ang) * 10, Math.sin(ang) * 10, Math.cos(ang) * 12, Math.sin(ang) * 12)
        }
        clockFace.fillStyle(0xffffff, 1)
        clockFace.fillCircle(0, 0, 1)
        const hourHand = this.add.graphics()
        const minuteHand = this.add.graphics()
        const secondHand = this.add.graphics()
        this.atmosphere.wallClockContainer = this.add.container(clockX, clockY, [clockFace, hourHand, minuteHand, secondHand])
        this.atmosphere.wallClockContainer.setDepth(-0.5)
        this.atmosphere.wallClockContainer.setAlpha(0.88)
        this.atmosphere.clockHourHand = hourHand
        this.atmosphere.clockMinuteHand = minuteHand
        this.atmosphere.clockSecondHand = secondHand
        this.atmosphere.tickWallClock()
      }

      // Picture frames along top wall
      const picFrames = [OFFICE_FRAME_PICTURE, OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3]
      const picCount = Math.min(6, Math.floor(fw / 80))
      const picSpacing = fw / (picCount + 1)
      for (let i = 0; i < picCount; i++) {
        decos.push(this.add.sprite(fx + picSpacing * (i + 1), by + 8, 'office', picFrames[i % picFrames.length])
          .setScale(DECO_SCALE * 0.85).setAlpha(0.65).setDepth(-1))
      }

      // Bookshelf on left side
      if (fh > 140) {
        decos.push(this.add.sprite(fx + 14, fy + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.65).setDepth(-1))
      }

      // Filing cabinet on right side
      if (fh > 160 && fw > 250) {
        decos.push(this.add.sprite(fx + fw - 20, fy + fh - 50, 'office', OFFICE_FRAME_FILE_CABINET).setScale(DECO_SCALE * 0.9).setAlpha(0.7).setDepth(-1))
      }

      // Water cooler (if room is big enough)
      if (fw > 350) {
        decos.push(this.add.sprite(fx + fw / 2 - 60, fy + fh - 30, 'office', OFFICE_FRAME_WATER_COOLER).setScale(DECO_SCALE * 0.85).setAlpha(0.6).setDepth(-1))
      }

      // Hanging plant in top corner (subtle)
      if (fw > 200) {
        decos.push(this.add.sprite(fx + 30, fy + 5, 'office', OFFICE_FRAME_HANGING_PLANT).setScale(DECO_SCALE * 0.8).setAlpha(0.55).setDepth(-1))
      }

      // Monstera plant on floor
      if (fh > 180) {
        decos.push(this.add.sprite(fx + 40, fy + fh - 25, 'office', OFFICE_FRAME_MONSTERA).setScale(DECO_SCALE * 0.9).setAlpha(0.7).setDepth(-1))
      }

      // Sofa/couch pair in lobby area — lower-left quadrant
      if (fw > 300 && fh > 160) {
        decos.push(this.add.sprite(fx + 80, fy + fh - 50, 'office', OFFICE_FRAME_SOFA).setScale(0.35).setAlpha(0.7).setDepth(-1))
      }

      // Printer/copier near right wall mid-height
      if (fw > 280 && fh > 140) {
        decos.push(this.add.sprite(fx + fw - 22, fy + fh / 2, 'office', OFFICE_FRAME_PRINTER).setScale(DECO_SCALE * 0.9).setAlpha(0.65).setDepth(-1))
      }

      // Trash cans near exit corners (top-left and top-right)
      decos.push(this.add.sprite(fx + 8, fy + 14, 'office', OFFICE_FRAME_TRASH).setScale(DECO_SCALE * 0.9).setAlpha(0.6).setDepth(-1))
      if (fw > 200) {
        decos.push(this.add.sprite(fx + fw - 10, fy + 14, 'office', OFFICE_FRAME_TRASH).setScale(DECO_SCALE * 0.9).setAlpha(0.6).setDepth(-1))
      }

      // Second bookshelf on right wall if room is tall enough
      if (fh > 180 && fw > 200) {
        decos.push(this.add.sprite(fx + fw - 16, fy + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.62).setDepth(-1))
      }

      // Storage cabinet near break room area (bottom-center-right)
      if (fw > 320 && fh > 150) {
        decos.push(this.add.sprite(fx + fw * 0.65, fy + fh - 28, 'office', OFFICE_FRAME_STORAGE).setScale(DECO_SCALE * 0.9).setAlpha(0.65).setDepth(-1))
      }

      // Alternating fern / small-plant / monstera pattern along the bottom wall
      if (fw > 400) {
        const bottomPlantFrames = [OFFICE_FRAME_FERN, OFFICE_FRAME_PLANT_SM, OFFICE_FRAME_MONSTERA, OFFICE_FRAME_FERN]
        const bottomPlantCount = Math.min(4, Math.floor((fw - 120) / 90))
        const bottomPlantSpacing = (fw - 120) / (bottomPlantCount + 1)
        for (let i = 0; i < bottomPlantCount; i++) {
          decos.push(
            this.add
              .sprite(fx + 60 + bottomPlantSpacing * (i + 1), fy + fh - 16, 'office', bottomPlantFrames[i % bottomPlantFrames.length])
              .setScale(DECO_SCALE * 0.8)
              .setAlpha(0.42)
              .setDepth(-1)
          )
        }
      }

      // Additional picture frames along the left side wall if building is tall enough
      if (fh > 200) {
        const sidePicFrames = [OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3, OFFICE_FRAME_PICTURE]
        const sidePicCount = Math.min(3, Math.floor((fh - 80) / 65))
        const sidePicSpacing = (fh - 80) / (sidePicCount + 1)
        for (let i = 0; i < sidePicCount; i++) {
          decos.push(
            this.add
              .sprite(fx + 8, fy + 40 + sidePicSpacing * (i + 1), 'office', sidePicFrames[i % sidePicFrames.length])
              .setScale(DECO_SCALE * 0.8)
              .setAlpha(0.38)
              .setDepth(-1)
          )
        }
      }

      // Monitor near upper-right interior (desk surface implied)
      if (fw > 350 && fh > 160) {
        decos.push(this.add.sprite(fx + fw - 55, fy + 35, 'office', OFFICE_FRAME_MONITOR).setScale(DECO_SCALE * 0.85).setAlpha(0.68).setDepth(-1))
      }

      this.officeDecoSprites = decos
      this.animateDecorations()
    }

    // Live stats whiteboard — lobby center, near top wall
    if (this.whiteboardContainer) {
      this.whiteboardContainer.destroy()
      this.whiteboardContainer = null
      this.whiteboardTexts = []
    }
    if (fw > 400) {
      const wbX = fx + fw / 2
      const wbY = by + 24
      const wbBg = this.add.graphics()
      wbBg.fillStyle(0xf8fafc, 0.12)
      wbBg.fillRoundedRect(-30, -18, 60, 36, 4)
      wbBg.setDepth(-0.5)
      const wbSprite = this.officeTilesLoaded
        ? this.add.sprite(0, 0, 'office', OFFICE_FRAME_WHITEBOARD).setScale(0.32).setAlpha(0.55).setDepth(-0.5)
        : null
      const titleText = this.add.text(0, -11, 'TEAM STATUS', {
        fontSize: '5px', fontFamily: 'monospace', color: '#94a3b8', fontStyle: 'bold', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.9).setDepth(0)
      const agentLine = this.add.text(0, -3, 'Agents: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#64748b', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const activeLine = this.add.text(0, 4, 'Active: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#64748b', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const roomLine = this.add.text(0, 11, 'Rooms: 0', {
        fontSize: '4px', fontFamily: 'monospace', color: '#64748b', resolution: 2,
      }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(0)
      const wbChildren: Phaser.GameObjects.GameObject[] = [wbBg, titleText, agentLine, activeLine, roomLine]
      if (wbSprite) wbChildren.unshift(wbSprite)
      this.whiteboardContainer = this.add.container(wbX, wbY, wbChildren)
      this.whiteboardContainer.setDepth(-1)
      this.whiteboardTexts = [agentLine, activeLine, roomLine]
      if (this.lastLodLevel < 3) this.whiteboardContainer.setVisible(false)
    }

    // -------------------------------------------------------------------------
    // EXTERIOR LIGHTS — entrance ground floods + wall sconces
    // Built once per layout; alpha is driven live by applyDayNightCycle.
    // -------------------------------------------------------------------------
    if (this.atmosphere.exteriorLights) {
      this.atmosphere.exteriorLights.destroy()
      this.atmosphere.exteriorLights = null
    }
    {
      const lightChildren: Phaser.GameObjects.GameObject[] = []

      // Initial alpha for the current phase (set before tweening can run)
      const phaseAlphaMap: Record<string, number> = {
        morning: 0.02,
        day: 0.0,
        evening: 0.06,
        night: 0.12,
      }
      const initAlpha = phaseAlphaMap[this.atmosphere.currentTimePhase] ?? 0.0

      // --- Entrance flood lights — 4 lights spread along the bottom building edge ---
      const floodCount = 4
      const floodSpacing = bw / (floodCount + 1)
      const floodY = by + bh // sits exactly on the bottom wall edge

      for (let fi = 0; fi < floodCount; fi++) {
        const flx = bx + floodSpacing * (fi + 1)

        // Downward cone pool (wide triangle below the fixture)
        const pool = this.add.graphics()
        pool.fillStyle(0xfbbf24, 1)
        pool.fillTriangle(-14, 0, 14, 0, 22, 32)
        pool.fillTriangle(-14, 0, -22, 32, 22, 32)
        pool.setPosition(flx, floodY)
        pool.setAlpha(initAlpha * 0.35)
        lightChildren.push(pool)

        // Outer halo
        const halo = this.add.arc(flx, floodY - 2, 10, 0, 360, false, 0xfbbf24, 1)
        halo.setAlpha(initAlpha * 0.25)
        lightChildren.push(halo)

        // Bulb core
        const bulb = this.add.arc(flx, floodY - 2, 4, 0, 360, false, 0xfbbf24, 1)
        bulb.setAlpha(initAlpha)
        lightChildren.push(bulb)
      }

      // --- Wall sconces — one on each side wall, lower-third height ---
      const sconceY = by + bh * 0.72

      for (const wallX of [bx, bx + bw]) {
        const side = wallX === bx ? 1 : -1 // +1 shines right, -1 shines left

        // Glow fan pointing away from the wall
        const wallPool = this.add.graphics()
        wallPool.fillStyle(0xfbbf24, 1)
        wallPool.fillTriangle(0, -10, 0, 10, side * 24, 0)
        wallPool.setPosition(wallX, sconceY)
        wallPool.setAlpha(initAlpha * 0.3)
        lightChildren.push(wallPool)

        // Sconce body — small semi-circle flush on the wall face
        const sconce = this.add.arc(wallX, sconceY, 4, 270, 90, false, 0xfbbf24, 1)
        sconce.setAlpha(initAlpha)
        lightChildren.push(sconce)
      }

      this.atmosphere.exteriorLights = this.add.container(0, 0, lightChildren)
      this.atmosphere.exteriorLights.setDepth(-3.8)
    }

    // -------------------------------------------------------------------------
    // SEASONAL DECORATIONS — subtle details that change by real-world month.
    // All primitives are drawn onto the shared g (officeGraphics) and are
    // therefore cleared automatically when g.clear() runs on the next rebuild.
    // -------------------------------------------------------------------------
    {
      const seasonal = this.getSeasonalConfig()

      if (seasonal.extraDecorType === 'winter') {
        // Holiday light string along the top parapet: alternating red/green/blue
        const lightColors = [0xef4444, 0x22c55e, 0x3b82f6]
        const lightY = by + 1.5
        g.lineStyle(1, 0x475569, 0.1)
        g.lineBetween(bx + 4, lightY, bx + bw - 4, lightY)
        let colorIdx = 0
        for (let lx = bx + 4; lx < bx + bw - 4; lx += 8) {
          g.fillStyle(lightColors[colorIdx % lightColors.length], 0.55)
          g.fillCircle(lx, lightY, 1.5)
          colorIdx++
        }
        // Small wreath near the entrance
        const wreathX = bx + bw / 2
        const wreathY = by + bh - 38
        g.lineStyle(3, 0x166534, 0.3)
        g.strokeCircle(wreathX, wreathY, 6)
        g.fillStyle(0xef4444, 0.45)
        g.fillCircle(wreathX, wreathY - 6, 1.5)
      } else if (seasonal.extraDecorType === 'spring') {
        // Tiny flower dots scattered near plant corners
        const flowerClusters = [
          { cx: fx + 14, cy: fy + fh - 14 },
          { cx: fx + fw - 14, cy: fy + fh - 14 },
          { cx: fx + 40, cy: fy + fh - 25 },
        ]
        const flowerColors = [0xf9a8d4, 0xfbbf24, 0xfafafa]
        let seed = 7
        const rand = (): number => {
          seed = (seed * 16807) % 2147483647
          return (seed % 1000) / 1000
        }
        for (const cluster of flowerClusters) {
          for (let fi = 0; fi < 6; fi++) {
            g.fillStyle(flowerColors[fi % flowerColors.length], 0.35)
            g.fillCircle(cluster.cx + rand() * 20 - 10, cluster.cy + rand() * 10 - 5, 1)
          }
        }
      } else if (seasonal.extraDecorType === 'summer') {
        // Tiny sun icon in the sky zone above the building
        const sunX = bx + bw - 55
        const sunY = by - 22
        g.fillStyle(0xfde68a, 0.06)
        g.fillCircle(sunX, sunY, 9)
        g.fillStyle(0xfde68a, 0.15)
        g.fillCircle(sunX, sunY, 5)
        g.lineStyle(1, 0xfde68a, 0.2)
        const rayLen = 5
        for (let ri = 0; ri < 4; ri++) {
          const ang = Phaser.Math.DegToRad(ri * 90)
          const cosA = Math.cos(ang)
          const sinA = Math.sin(ang)
          g.lineBetween(sunX + cosA * 6, sunY + sinA * 6, sunX + cosA * (6 + rayLen), sunY + sinA * (6 + rayLen))
        }
      } else if (seasonal.extraDecorType === 'autumn') {
        // Tiny fallen-leaf rectangles scattered on the sidewalk
        const leafColors = [0xea580c, 0xef4444, 0x78350f]
        const leafBaseY = by + bh + 2
        let lseed = 13
        const lrand = (): number => {
          lseed = (lseed * 16807) % 2147483647
          return (lseed % 1000) / 1000
        }
        const leafCount = Math.min(18, Math.floor(bw / 20))
        for (let li = 0; li < leafCount; li++) {
          g.fillStyle(leafColors[li % leafColors.length], 0.15)
          g.fillRect(bx + lrand() * bw, leafBaseY + lrand() * 6, 2, 1)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Decoration ambient animations
  // ---------------------------------------------------------------------------

  private animateDecorations(): void {
    const PLANT_FRAMES = new Set([
      OFFICE_FRAME_PLANT,
      OFFICE_FRAME_PLANT_TALL,
      OFFICE_FRAME_CACTUS,
      OFFICE_FRAME_HANGING_PLANT,
      OFFICE_FRAME_FERN,
      OFFICE_FRAME_MONSTERA,
    ])

    let waterCoolerSprite: Phaser.GameObjects.Sprite | null = null
    let bookcaseSprite: Phaser.GameObjects.Sprite | null = null

    for (const sprite of this.officeDecoSprites) {
      // Phaser spritesheet frames store the index in frame.name (as a string or number)
      const frameNum: number = parseInt(String(sprite.frame.name), 10)

      if (PLANT_FRAMES.has(frameNum)) {
        // Gentle sway: random duration 2500-3500ms, random start delay 0-2000ms
        const duration = 2500 + Math.random() * 1000
        const delay = Math.random() * 2000
        const tween = this.tweens.add({
          targets: sprite,
          angle: { from: -2, to: 2 },
          duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay,
        })
        this.decoTweens.push(tween)
      } else if (frameNum === OFFICE_FRAME_BOOKSHELF) {
        bookcaseSprite = sprite
      } else if (frameNum === OFFICE_FRAME_WATER_COOLER) {
        waterCoolerSprite = sprite
      } else if (frameNum === OFFICE_FRAME_CLOCK) {
        // Clock pendulum tick: ±1 degree, 1s period
        const tween = this.tweens.add({
          targets: sprite,
          angle: { from: -1, to: 1 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        this.decoTweens.push(tween)
      }
    }

    // Bookshelf shimmer — subtle alpha pulse suggesting someone browsed it
    if (bookcaseSprite) {
      const shelf = bookcaseSprite
      const baseAlpha = shelf.alpha
      const tween = this.tweens.add({
        targets: shelf,
        alpha: { from: baseAlpha, to: baseAlpha + 0.08 },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 1500 + Math.random() * 2000,
      })
      this.decoTweens.push(tween)
    }

    // Water cooler bubbles — occasional tiny circles that rise and fade
    if (waterCoolerSprite) {
      const cooler = waterCoolerSprite
      const spawnBubbles = (): void => {
        if (!cooler.active) return
        const count = Math.random() < 0.5 ? 1 : 2
        for (let i = 0; i < count; i++) {
          // Position near top of the water cooler sprite (slightly randomised)
          const bx = cooler.x + (Math.random() * 6 - 3)
          const by = cooler.y - (cooler.displayHeight * 0.35) - Math.random() * 2
          const bubble = this.add.circle(bx, by, 1, 0x7dd3fc, 0.3).setDepth(-0.8)
          this.tweens.add({
            targets: bubble,
            y: by - 8,
            alpha: 0,
            duration: 800,
            ease: 'Sine.easeOut',
            onComplete: () => { try { bubble.destroy() } catch { /* gone */ } },
          })
        }
        // Schedule next burst: 4000-6000ms
        const nextDelay = 4000 + Math.random() * 2000
        this.waterCoolerBubbleTimer = this.time.delayedCall(nextDelay, spawnBubbles)
      }
      // Start the first burst after a random initial delay
      this.waterCoolerBubbleTimer = this.time.delayedCall(2000 + Math.random() * 3000, spawnBubbles)
    }
  }

  private updateWhiteboardStats(): void {
    if (!this.whiteboardContainer || this.whiteboardTexts.length < 3) return
    const [agentLine, activeLine, roomLine] = this.whiteboardTexts
    const totalAgents = this.agents.length
    const activeAgents = this.agents.filter(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    ).length
    const totalRooms = this.rooms.size

    const flashChanged = (text: Phaser.GameObjects.Text, newVal: string) => {
      if (text.text === newVal) return
      text.setText(newVal)
      this.tweens.killTweensOf(text)
      this.tweens.add({
        targets: text, alpha: 1, duration: 150, ease: 'Sine.easeOut',
        onComplete: () => {
          if (text.active) this.tweens.add({ targets: text, alpha: 0.7, duration: 400, ease: 'Sine.easeIn' })
        },
      })
    }

    flashChanged(agentLine, `Agents: ${totalAgents}`)
    flashChanged(roomLine, `Rooms: ${totalRooms}`)

    const newActiveText = `Active: ${activeAgents}`
    if (activeLine.text !== newActiveText) {
      activeLine.setText(newActiveText)
      activeLine.setColor(activeAgents > 0 ? '#34d399' : '#64748b')
      this.tweens.killTweensOf(activeLine)
      this.tweens.add({
        targets: activeLine, alpha: 1, duration: 150, ease: 'Sine.easeOut',
        onComplete: () => {
          if (activeLine.active) this.tweens.add({ targets: activeLine, alpha: 0.7, duration: 400, ease: 'Sine.easeIn' })
        },
      })
    }
  }


    private rebuildNavMesh(): void {
    const rooms: Array<{ x: number; y: number; width: number; height: number; doorX: number; doorY: number }> = []
    for (const room of this.rooms.values()) {
      rooms.push({
        x: room.x, y: room.y,
        width: room.width, height: room.height,
        doorX: room.x,
        doorY: this.getRoomDoorY(room),
      })
    }

    let buildingBounds: { x: number; y: number; w: number; h: number } | null = null
    if (this.lastOfficeBgW > 0) {
      buildingBounds = {
        x: WORLD_MARGIN - 30, y: WORLD_MARGIN - 30,
        w: this.lastOfficeBgW + 60, h: this.lastOfficeBgH + 60,
      }
    }

    const cafeBounds = this.cafe.getBounds()

    this.navMesh.rebuild({
      buildingBounds,
      rooms,
      corridorSegments: this.corridorSegments,
      cafeBounds,
    })
  }

    private updateCameraBounds(): void {
    const cam = this.cameras.main
    let maxX = 0
    let maxY = 0
    for (const room of this.rooms.values()) {
      maxX = Math.max(maxX, room.x + room.width / 2 + WORLD_MARGIN)
      maxY = Math.max(maxY, room.y + room.height / 2 + WORLD_MARGIN)
    }
    // Use current content only so bounds can shrink after layout changes.
    // Include drawn background extents while rooms are present.
    // Wall is inset — building rect is (0,0,bgW+30,bgH+30), no overshoot.
    const hasRooms = this.rooms.size > 0
    const contentW = Math.max(maxX, hasRooms ? this.lastOfficeBgW + 30 : 0)
    const contentH = Math.max(maxY, hasRooms ? this.lastOfficeBgH + 30 : 0)
    this.worldWidth = Math.max(contentW, this.viewWidth)
    this.worldHeight = Math.max(contentH, this.viewHeight)
    cam.setBounds(-WORLD_MARGIN, -WORLD_MARGIN, this.worldWidth + WORLD_MARGIN * 2, this.worldHeight + WORLD_MARGIN * 2)
  }

  // ---------------------------------------------------------------------------
  // Typing spark particles
  // ---------------------------------------------------------------------------

  // [Starfield, cloud layer, wall clock, day/night, ceiling lights — extracted to OfficeAtmosphere]


  // ---------------------------------------------------------------------------
  // Room activity bar
  // ---------------------------------------------------------------------------

  private updateRoomActivity(room: Room): void {
    const agents = room.agents
    if (agents.length === 0) return
    const waitingCount = agents.filter(a => a.needsInteraction).length
    const hasWaiting = agents.some(a => a.needsInteraction)
    const activeCount = agents.filter(a => a.needsInteraction || a.sessionMode === 'working' || a.sessionMode === 'plan').length

    const activeWidth = (activeCount / agents.length) * room.width
    const waitingWidth = (waitingCount / agents.length) * room.width
    room.activityBar.setFillStyle(0x34d399, hasWaiting ? 0.65 : 0.95)
    room.activityBar.setPosition(-room.width / 2, room.height / 2 + 1)
    room.waitingBar.setFillStyle(0xfbbf24, 0.95)
    room.waitingBar.setPosition(-room.width / 2, room.height / 2 - 1)
    if (room.activityBarTween) room.activityBarTween.destroy()
    if (room.waitingBarTween) room.waitingBarTween.destroy()
    room.activityBarTween = this.tweens.add({ targets: room.activityBar, width: activeWidth, duration: 280, ease: 'Power2' })
    room.waitingBarTween = this.tweens.add({ targets: room.waitingBar, width: waitingWidth, duration: 280, ease: 'Power2' })
    room.waitingBar.setAlpha(waitingCount > 0 ? 0.95 : 0.15)

    const ledMode: Room['ledMode'] = hasWaiting ? 'waiting' : activeCount > 0 ? 'active' : 'idle'
    if (room.ledMode !== ledMode) {
      room.ledMode = ledMode
      if (room.statusLedTween) {
        room.statusLedTween.destroy()
        room.statusLedTween = null
      }

      const ledColor = ledMode === 'waiting' ? COLOR_LED_AMBER : ledMode === 'active' ? COLOR_LED_GREEN : COLOR_LED_GRAY
      room.statusLed.setFillStyle(ledColor, 1)
      room.statusLedGlow.setFillStyle(ledColor, 1)

      if (ledMode === 'waiting') {
        room.statusLedGlow.setAlpha(0.18)
        room.statusLedTween = this.tweens.add({
          targets: [room.statusLed, room.statusLedGlow],
          alpha: { from: 0.45, to: 1 },
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else if (ledMode === 'active') {
        room.statusLed.setAlpha(1)
        room.statusLedGlow.setAlpha(0.22)
      } else {
        room.statusLed.setAlpha(0.8)
        room.statusLedGlow.setAlpha(0.12)
      }
    }

    // Status strip — tween width proportional to active+waiting agents; color matches ledMode.
    if (room.statusStrip && room.statusStrip.active) {
      const WALL_T = 3
      const WALL_I = 1
      const floorW = room.width - (WALL_T + WALL_I) * 2
      const stripColor = hasWaiting ? 0xfbbf24 : activeCount > 0 ? 0x34d399 : 0x64748b
      const stripAlpha = hasWaiting ? 0.75 : activeCount > 0 ? 0.7 : 0.35
      const targetW = agents.length > 0
        ? Math.max(2, (activeCount / agents.length) * floorW)
        : 2
      const hBarX = -room.width / 2 + WALL_T + WALL_I
      const hBarY = -room.height / 2 + WALL_T + WALL_I
      const stripY = hBarY + ROOM_HEADER_H + 1
      if (room.statusStripTween) { room.statusStripTween.destroy(); room.statusStripTween = null }
      // Redraw strip at target color; tween a proxy width property for animation.
      const stripProxy = { w: 0 }
      const sg = room.statusStrip
      room.statusStripTween = this.tweens.add({
        targets: stripProxy,
        w: targetW,
        duration: 400,
        ease: 'Power2',
        onUpdate: () => {
          if (!sg || !sg.active) return
          sg.clear()
          sg.fillStyle(stripColor, stripAlpha)
          sg.fillRect(hBarX, stripY, stripProxy.w, 2)
        },
      })
    }

    // Heat overlay — thermal glow proportional to active agent count.
    // heat=0 (all idle): alpha tweens to 0 (invisible).
    // heat=1 (all active): alpha tweens to 0.06 (barely perceptible warm amber).
    // At heat > 0.5, color shifts from amber (0xfbbf24) toward red (0xef4444).
    if (room.heatOverlay) {
      const heat = agents.length > 0 ? activeCount / agents.length : 0
      const targetAlpha = heat * 0.06

      // Shift color toward red as heat crosses 50%
      const heatColor = heat > 0.5
        ? lerpColor(0xfbbf24, 0xef4444, (heat - 0.5) * 2)
        : 0xfbbf24
      room.heatOverlay.setFillStyle(heatColor, room.heatOverlay.fillAlpha)

      if (room.heatTween) {
        room.heatTween.destroy()
        room.heatTween = undefined
      }
      room.heatTween = this.tweens.add({
        targets: room.heatOverlay,
        fillAlpha: targetAlpha,
        duration: 500,
        ease: 'Sine.easeInOut',
      })
    }
  }


  // ---------------------------------------------------------------------------
  // Coffee steam particles (idle-only)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Mood indicator
  // ---------------------------------------------------------------------------

  private getAgentMood(agent: AgentState): { emoji: string; color: string } {
    if (agent.needsInteraction && agent.interactionType === 'tool-approval') {
      return { emoji: '😤', color: '#f97316' }
    }
    if (agent.needsInteraction && agent.interactionType === 'question') {
      return { emoji: '🤔', color: '#60a5fa' }
    }
    if (agent.sessionMode === 'working') {
      return { emoji: '💻', color: '#34d399' }
    }
    if (agent.sessionMode === 'plan') {
      return { emoji: '🧠', color: '#a78bfa' }
    }
    if (agent.sessionMode === 'compressing') {
      return { emoji: '😵', color: '#f87171' }
    }
    return { emoji: '☕', color: '#64748b' }
  }

  private updateMood(ws: WorkstationSprite, agent: AgentState): void {
    if (!ws.moodEmoji) return
    const { emoji } = this.getAgentMood(agent)
    const currentEmoji = ws.moodEmoji.getData('currentEmoji') as string | undefined

    if (currentEmoji === emoji) return

    // Emoji changed — stop existing float tween, fade out, then swap and bounce in
    if (ws.moodTween) {
      ws.moodTween.destroy()
      ws.moodTween = undefined
    }

    const moodText = ws.moodEmoji
    moodText.setData('currentEmoji', emoji)

    // Fade out current emoji, then swap and bounce in
    this.tweens.add({
      targets: moodText,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!moodText.active) return
        moodText.setText(emoji)
        moodText.setScale(0)
        // Bounce in: 0 → 1.2 → 1
        this.tweens.add({
          targets: moodText,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 1,
          duration: 180,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!moodText.active) return
            this.tweens.add({
              targets: moodText,
              scaleX: 1,
              scaleY: 1,
              duration: 120,
              ease: 'Sine.easeOut',
              onComplete: () => {
                if (!moodText.active) return
                // Gentle infinite float: oscillate y ±2px
                const baseY = moodText.y
                ws.moodTween = this.tweens.add({
                  targets: moodText,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                })
              },
            })
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Thought bubble — rich live-text with typing animation, auto-sizing, and fade
  // ---------------------------------------------------------------------------

  private drawThoughtBubbleBg(ws: WorkstationSprite, accentColor: number): void {
    const PAD_X = 8
    const PAD_Y = 5
    const ACCENT_W = 3
    const CORNER = 5

    const tw = ws.thoughtBubbleText.width
    const th = ws.thoughtBubbleText.height
    const bw = tw + PAD_X * 2 + ACCENT_W
    const bh = th + PAD_Y * 2

    ws.thoughtBubbleText.setPosition(ACCENT_W / 2 + PAD_X / 2, 0)

    const g = ws.thoughtBubbleBg
    g.clear()

    // Dark background card
    g.fillStyle(0x0f172a, 0.92)
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, CORNER)

    // Accent left border
    g.fillStyle(accentColor, 0.9)
    g.fillRoundedRect(-bw / 2, -bh / 2, ACCENT_W, bh, CORNER)

    // Downward tail
    const tailW = 6
    const tailH = 6
    const tailY = bh / 2
    g.fillStyle(0x0f172a, 0.92)
    g.fillTriangle(-tailW / 2, tailY, tailW / 2, tailY, 0, tailY + tailH)
  }

  private updateThoughtBubble(
    ws: WorkstationSprite,
    agent: AgentState,
    shouldShow: boolean,
    accentColor: number,
    isWorking: boolean,
  ): void {
    if (!shouldShow) {
      this.tweens.killTweensOf(ws.thoughtBubble)
      ws.thoughtBubble.setVisible(false)
      return
    }

    const rawBlurb = (agent.lastAssistantBlurb ?? '').trim()
    const MAX_CHARS = 60
    let displayText: string

    if (rawBlurb) {
      displayText = rawBlurb.length > MAX_CHARS ? rawBlurb.slice(0, MAX_CHARS) + '...' : rawBlurb
    } else if (agent.sessionMode === 'compressing') {
      displayText = 'compressing...'
    } else if (agent.sessionMode === 'plan') {
      displayText = 'planning...'
    } else if (agent.needsInteraction) {
      displayText = 'waiting for input'
    } else if (agent.sessionMode === 'working' || !agent.sessionMode) {
      displayText = 'working...'
    } else {
      displayText = '\u2615 idle'
    }

    const blurbChanged = ws.lastShownBlurb !== displayText
    ws.lastShownBlurb = displayText

    if (ws.blurbFadeTimer) {
      ws.blurbFadeTimer.destroy()
      ws.blurbFadeTimer = undefined
    }

    ws.thoughtBubble.setVisible(true)
    this.tweens.killTweensOf(ws.thoughtBubble)
    ws.thoughtBubble.setAlpha(1)

    const baseY = WS_SPRITE_Y - 62

    if (blurbChanged && rawBlurb) {
      if (ws.blurbTypingTween) {
        ws.blurbTypingTween.destroy()
        ws.blurbTypingTween = undefined
      }
      ws.thoughtBubbleText.setText('')
      ws.thoughtBubble.y = baseY
      this.drawThoughtBubbleBg(ws, accentColor)

      const counter = { val: 0 }
      ws.blurbTypingTween = this.tweens.add({
        targets: counter,
        val: displayText.length,
        duration: Math.min(500, displayText.length * 18),
        ease: 'Linear',
        onUpdate: () => {
          ws.thoughtBubbleText.setText(displayText.slice(0, Math.floor(counter.val)))
          this.drawThoughtBubbleBg(ws, accentColor)
        },
        onComplete: () => {
          ws.thoughtBubbleText.setText(displayText)
          this.drawThoughtBubbleBg(ws, accentColor)
          ws.blurbTypingTween = undefined
        },
      })
    } else {
      ws.thoughtBubbleText.setText(displayText)
      this.drawThoughtBubbleBg(ws, accentColor)
      ws.thoughtBubble.y = baseY
    }

    if (ws.thoughtBubbleFloatTween) {
      ws.thoughtBubbleFloatTween.destroy()
    }
    ws.thoughtBubbleFloatTween = this.tweens.add({
      targets: ws.thoughtBubble,
      y: baseY - 3,
      duration: isWorking ? 1200 : 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (rawBlurb) {
      ws.blurbFadeTimer = this.time.delayedCall(5000, () => {
        if (!ws.thoughtBubble.active) return
        this.tweens.add({
          targets: ws.thoughtBubble,
          alpha: 0,
          duration: 300,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (ws.thoughtBubble.active) ws.thoughtBubble.setVisible(false)
          },
        })
        ws.blurbFadeTimer = undefined
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWaiting = agent.needsInteraction
    const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !isWaiting

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return
    const prevMode = ws.lastAnimMode
    ws.lastAnimMode = mode

    // Tear down all animation state
    if (ws.bounceTween)      { ws.bounceTween.destroy();      ws.bounceTween      = undefined }
    if (ws.dotPulseTween)    { ws.dotPulseTween.destroy();    ws.dotPulseTween    = undefined; ws.statusDot.setAlpha(1) }
    if (ws.typingTween)      { ws.typingTween.destroy();      ws.typingTween      = undefined; ws.sprite.x = 0 }
    if (ws.monitorGlowTween) { ws.monitorGlowTween.destroy(); ws.monitorGlowTween = undefined }
    if (ws.breathTween)      { ws.breathTween.destroy();      ws.breathTween      = undefined }
    if (ws.headTiltTween)    { ws.headTiltTween.destroy();    ws.headTiltTween    = undefined }
    if (ws.pulseTween)       { ws.pulseTween.destroy();       ws.pulseTween       = undefined }
    if (ws.ledPulseTween)    { ws.ledPulseTween.destroy();    ws.ledPulseTween    = undefined }
    if (ws.walkBreakTween)   { ws.walkBreakTween.destroy();   ws.walkBreakTween   = undefined }
    if (ws.lookAroundTimer)     { ws.lookAroundTimer.destroy();     ws.lookAroundTimer     = undefined }
    if (ws.stretchTimer)        { ws.stretchTimer.destroy();        ws.stretchTimer        = undefined }
    if (ws.walkBreakTimer)      { ws.walkBreakTimer.destroy();      ws.walkBreakTimer      = undefined }
    if (ws.lookAtNeighborTimer) { ws.lookAtNeighborTimer.destroy(); ws.lookAtNeighborTimer = undefined }
    if (ws.yawnTimer)           { ws.yawnTimer.destroy();           ws.yawnTimer           = undefined }
    // Clear ambient sound-wave indicator on every mode transition; working branch re-draws it
    if (ws.soundWaveTween) { ws.soundWaveTween.destroy(); ws.soundWaveTween = undefined }
    if (ws.soundWaveGfx)   { ws.soundWaveGfx.clear(); ws.soundWaveGfx.setAlpha(1) }
    // Fade out progress ring when leaving working mode; working branch re-starts it
    if (ws.progressRingTween) { ws.progressRingTween.destroy(); ws.progressRingTween = undefined }
    if (ws.progressRing && ws.progressRing.alpha > 0) {
      this.tweens.add({ targets: ws.progressRing, alpha: 0, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => { ws.progressRing?.clear() },
      })
    }
    ws.workStartTime = undefined
    // Always stop steam when transitioning; idle branch will re-spawn it
    this.particles.clearSteamParticles(ws)

    // Fade out mood emoji on mode transition; updateMood will fade the new one in
    if (ws.moodTween) { ws.moodTween.destroy(); ws.moodTween = undefined }
    if (ws.moodEmoji) {
      this.tweens.add({ targets: ws.moodEmoji, alpha: 0, duration: 200, ease: 'Sine.easeOut' })
    }

    ws.sprite.y = WS_SPRITE_Y
    ws.sprite.x = 0
    ws.sprite.setScale(CHAR_SCALE)
    ws.sprite.setAngle(0)

    this.updateMonitorGlow(ws, isWorking, isWaiting)

    const charIdx = this.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    if (isWaiting) {
      ws.sprite.setFrame(base + POSE_IDLE)
      ws.pulseTween = this.tweens.add({
        targets: ws.sprite, scaleX: CHAR_SCALE * 1.06, scaleY: CHAR_SCALE * 1.06,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.typingTween = this.tweens.add({
        targets: ws.sprite, x: 1.2,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.dotPulseTween = this.tweens.add({
        targets: ws.statusDot, alpha: 0.3,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // LED: waiting — amber steady glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeWaiting, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.tweens.add({ targets: ws.ledGlow, alpha: 0.5, duration: 300, ease: 'Sine.easeOut' })
      }
      this.restoreDeskStroke(ws)
    } else if (isWorking) {
      ws.sprite.setFrame(base + POSE_INTERACT)
      ws.typingTween = this.tweens.add({
        targets: ws.sprite, x: 0.8,
        duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.bounceTween = this.tweens.add({
        targets: ws.sprite, y: WS_SPRITE_Y - 2,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.headTiltTween = this.tweens.add({
        targets: ws.sprite, angle: 1.5,
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.55)
      // LED: working — green pulsing glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeWorking, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.tweens.add({ targets: ws.ledGlow, alpha: 0.6, duration: 300, ease: 'Sine.easeOut',
          onComplete: () => {
            if (!ws.ledGlow) return
            ws.ledGlow.setAlpha(0.4)
            ws.ledPulseTween = this.tweens.add({
              targets: ws.ledGlow, alpha: 0.7,
              duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }
      // Ambient sound-wave indicator — three concentric quarter-circle arcs drawn
      // to the left of the agent, suggesting keyboard/typing audio ambiance.
      // Only visible at LOD 3 (full detail zoom) because gfx is in lodLevel3Objects.
      if (ws.soundWaveGfx) {
        const gfx = ws.soundWaveGfx
        gfx.clear()
        gfx.lineStyle(1, 0x94a3b8, 0.15)
        gfx.beginPath()
        gfx.arc(0, 0, 3, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.lineStyle(1, 0x94a3b8, 0.10)
        gfx.beginPath()
        gfx.arc(0, 0, 5, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.lineStyle(1, 0x94a3b8, 0.05)
        gfx.beginPath()
        gfx.arc(0, 0, 7, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.setAlpha(1)
        ws.soundWaveTween = this.tweens.add({
          targets: gfx, alpha: 0,
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }
      // Progress ring — circular arc that fills clockwise over 60 seconds.
      // Color transitions from green (0x34d399) to amber (0xfbbf24) past 80%.
      // After 100% the ring stays full and pulses alpha to indicate overtime.
      if (ws.progressRing) {
        ws.workStartTime = Date.now()
        const ring = ws.progressRing
        const RING_DURATION_MS = 60_000
        const RING_R = 10
        const drawRing = (progress: number) => {
          if (!ring.active) return
          ring.clear()
          // Background track
          ring.lineStyle(1.5, 0x334155, 0.3)
          ring.beginPath()
          ring.arc(0, 0, RING_R, 0, Math.PI * 2, false)
          ring.strokePath()
          // Filled arc from top (-90deg) clockwise
          const fill = Math.min(progress, 1)
          if (fill > 0) {
            const arcColor = fill < 0.8 ? 0x34d399 : 0xfbbf24
            ring.lineStyle(1.5, arcColor, 0.5)
            ring.beginPath()
            ring.arc(0, 0, RING_R,
              Phaser.Math.DegToRad(-90),
              Phaser.Math.DegToRad(fill * 360 - 90),
              false,
            )
            ring.strokePath()
          }
        }
        // Fade in, then start counter tween 0->100 over RING_DURATION_MS
        ring.setAlpha(0)
        drawRing(0)
        this.tweens.add({ targets: ring, alpha: 1, duration: 400, ease: 'Sine.easeOut' })
        ws.progressRingTween = this.tweens.addCounter({
          from: 0, to: 100,
          duration: RING_DURATION_MS,
          ease: 'Linear',
          onUpdate: (tw) => {
            const pct = tw.getValue() / 100
            drawRing(pct)
          },
          onComplete: () => {
            // Ring is full — pulse alpha to signal overtime
            drawRing(1)
            ws.progressRingTween = this.tweens.add({
              targets: ring, alpha: 0.35,
              duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }
    } else {
      ws.sprite.setFrame(base + POSE_SIT)
      ws.breathTween = this.tweens.add({
        targets: ws.sprite, scaleY: CHAR_SCALE * 0.97,
        duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // LED: idle — muted dim glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeIdle, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.tweens.add({ targets: ws.ledGlow, alpha: 0.1, duration: 600, ease: 'Sine.easeOut' })
      }
      this.restoreDeskStroke(ws)

      // Spawn coffee steam — agent is relaxing, mug is hot
      this.particles.spawnSteamParticles(ws)

      // "Just finished" bounce + confetti when transitioning from working→idle
      if (prevMode === 'working') {
        this.tweens.add({
          targets: ws.sprite, y: WS_SPRITE_Y - 6,
          duration: 200, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { ws.sprite.y = WS_SPRITE_Y },
        })
        // Find the room that owns this workstation to compute world position
        for (const room of this.rooms.values()) {
          if (room.workstations.has(agent.config.id)) {
            const worldX = room.x + ws.container.x
            const worldY = room.y + ws.container.y - 16  // slightly above the agent head
            this.particles.burstConfetti(worldX, worldY)
            break
          }
        }

        // Task completion tally — increment counter and refresh the desk badge
        ws.localTaskCount++
        this.refreshTaskCountDisplay(ws)
      }

      // Stamp idleSince so later timers can detect prolonged boredom
      ws.sprite.setData('idleSince', Date.now())

      // Head tilt: tween angle -4..+4 degrees every 8-15s, hold 1s, return to 0
      ws.lookAroundTimer = this.time.addEvent({
        delay: 8000 + Math.random() * 7000,
        loop: true,
        callback: () => {
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          const angle = (Math.random() - 0.5) * 8   // -4 to +4 degrees
          ws.headTiltTween = this.tweens.add({
            targets: ws.sprite, angle,
            duration: 400, hold: 1000, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
          })
        },
      })

      // Stretch: scaleY 1→1.04 over 300ms, hold 200ms, back to 1 every 20-30s
      ws.stretchTimer = this.time.addEvent({
        delay: 20000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          this.tweens.add({
            targets: ws.sprite,
            scaleY: CHAR_SCALE * 1.04,
            duration: 300, ease: 'Sine.easeOut',
            onComplete: () => {
              this.time.delayedCall(200, () => {
                this.tweens.add({
                  targets: ws.sprite,
                  scaleY: CHAR_SCALE,
                  duration: 300, ease: 'Sine.easeIn',
                })
              })
            },
          })
        },
      })

      // Look at neighbor: tilt -3/+3 degrees toward a working peer every 12-18s
      ws.lookAtNeighborTimer = this.time.addEvent({
        delay: 12000 + Math.random() * 6000,
        loop: true,
        callback: () => {
          if (ws.walkBreakTween || ws.headTiltTween) return
          let neighborContainerX: number | null = null
          for (const room of this.rooms.values()) {
            if (!room.workstations.has(agent.config.id)) continue
            for (const [otherId, otherWs] of room.workstations) {
              if (otherId === agent.config.id) continue
              const otherMode = otherWs.state?.sessionMode
              const isOtherWorking =
                (otherMode === 'working' || otherMode === 'plan') &&
                !otherWs.state?.needsInteraction
              if (isOtherWorking) {
                neighborContainerX = otherWs.container.x
                break
              }
            }
            break
          }
          if (neighborContainerX === null) return
          const tiltAngle = neighborContainerX < ws.container.x ? -3 : 3
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          ws.headTiltTween = this.tweens.add({
            targets: ws.sprite, angle: tiltAngle,
            duration: 350, ease: 'Sine.easeOut',
            onComplete: () => {
              this.time.delayedCall(2000, () => {
                this.tweens.add({
                  targets: ws.sprite, angle: 0,
                  duration: 350, ease: 'Sine.easeIn',
                  onComplete: () => { ws.headTiltTween = undefined },
                })
              })
            },
          })
        },
      })

      // Yawn/bored pose: after 60s+ idle, briefly switch to POSE_INTERACT (fidget) for 1.5s
      ws.yawnTimer = this.time.addEvent({
        delay: 65000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          const idleSince: number = ws.sprite.getData('idleSince') ?? Date.now()
          if (Date.now() - idleSince < 60000) return
          if (ws.walkBreakTween) return
          ws.sprite.setFrame(base + POSE_INTERACT)
          this.time.delayedCall(1500, () => {
            if (ws.lastAnimMode === 'idle') {
              ws.sprite.setFrame(base + POSE_SIT)
            }
          })
        },
      })

      // Agents are not visually "locked" to the desk; they can stand up and move
      // around their office while the desk remains the reliable interaction target.
      ws.walkBreakTimer = this.time.addEvent({
        delay: IDLE_WALK_BREAK_MIN_MS + Math.random() * IDLE_WALK_BREAK_VAR_MS,
        loop: true,
        callback: () => {
          if (!ws.state || ws.walkBreakTween) return
          const stillIdle =
            !ws.state.needsInteraction &&
            ws.state.sessionMode !== 'working' &&
            ws.state.sessionMode !== 'plan' &&
            ws.state.sessionMode !== 'compressing'
          if (!stillIdle) return

          const walkTargetX = Phaser.Math.Between(-IDLE_WALK_RANGE_X, IDLE_WALK_RANGE_X)
          const walkTargetY = WS_SPRITE_Y + Phaser.Math.Between(2, 8)
          ws.sprite.setFrame(base + POSE_WALK)
          ws.walkBreakTween = this.tweens.add({
            targets: ws.sprite,
            x: walkTargetX,
            y: walkTargetY,
            duration: 520 + Math.random() * 240,
            yoyo: true,
            hold: 280 + Math.random() * 240,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              ws.walkBreakTween = undefined
              ws.sprite.x = 0
              ws.sprite.y = WS_SPRITE_Y
              ws.sprite.setFrame(base + POSE_SIT)
            },
          })
        },
      })
    }
  }

  private updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void {
    if (ws.blockedIndicatorTween) {
      ws.blockedIndicatorTween.destroy()
      ws.blockedIndicatorTween = undefined
    }

    // Phone light: stop and hide on every re-evaluation before deciding state
    if (ws.phoneLightTween) {
      ws.phoneLightTween.destroy()
      ws.phoneLightTween = undefined
    }
    if (ws.phoneLight) {
      ws.phoneLight.setAlpha(0)
    }

    if (!agent.needsInteraction) {
      ws.blockedIndicator.setVisible(false)
      ws.blockedIndicator.setAlpha(1)
      ws.blockedIndicator.setScale(1)
      return
    }

    let color = COLOR_LED_AMBER
    let glyph = '!'
    if (agent.interactionType === 'question') {
      color = 0x60a5fa
      glyph = '?'
    } else if (agent.interactionType === 'accept-edits') {
      color = 0x3b82f6
      glyph = '~'
    } else if (agent.interactionType === 'tool-approval') {
      color = 0xf97316
      glyph = '!'
    }

    ws.blockedIndicatorBadge.setFillStyle(color, 0.95)
    ws.blockedIndicatorPulse.setFillStyle(color, 0.16)
    ws.blockedIndicatorStem.setFillStyle(color, 0.55)
    ws.blockedIndicatorText.setText(glyph)
    ws.blockedIndicator.setVisible(true)

    ws.blockedIndicatorTween = this.tweens.add({
      targets: ws.blockedIndicator,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.78,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Phone notification light — blink the desk communicator dot in interaction-type color
    if (ws.phoneLight) {
      ws.phoneLight.setFillStyle(color, 1)
      ws.phoneLight.setAlpha(0)
      ws.phoneLightTween = this.tweens.add({
        targets: ws.phoneLight,
        alpha: { from: 0, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void {
    if (!ws.monitorGlowFx) return
    const isActive = isWorking || isWaiting
    const baseColor = isWaiting ? 0xfbbf24 : isWorking ? 0x0ea5e9 : 0x94a3b8
    const baseStrength = isActive ? 3 : 1
    const peakStrength = isActive ? 6 : 2
    const duration     = isActive ? 800 : 2400
    ws.monitorGlowFx.color = baseColor
    ws.monitorGlowFx.outerStrength = baseStrength
    ws.monitorGlowTween = this.tweens.add({
      targets: ws.monitorGlowFx, outerStrength: peakStrength,
      duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  private restoreDeskStroke(ws: WorkstationSprite): void {
    const s = ws.state
    if (s?.needsInteraction) {
      ws.deskBody.setStrokeStyle(2, 0xfbbf24, 0.7)
    } else if (s?.sessionMode === 'working' || s?.sessionMode === 'plan') {
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.5)
    } else {
      ws.deskBody.setStrokeStyle(1, 0x64748b, 0.5)
    }
  }

  // ---------------------------------------------------------------------------
  // Notification toasts
  // ---------------------------------------------------------------------------

  private showToast(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.toastContainer) return

    const TOAST_W = 220
    const TOAST_H = 28
    const TOAST_MARGIN = 8
    const MAX_TOASTS = 4
    const SLIDE_OFFSET = 200

    // Background and icon colors keyed by toast type
    const BG_COLORS: Record<string, number> = {
      info:    0x1e40af,
      success: 0x065f46,
      warning: 0x78350f,
      error:   0x7f1d1d,
    }
    const ICON_COLORS: Record<string, number> = {
      info:    0x3b82f6,
      success: 0x34d399,
      warning: 0xfbbf24,
      error:   0xef4444,
    }

    const bgColor   = BG_COLORS[type]   ?? BG_COLORS.info
    const iconColor = ICON_COLORS[type] ?? ICON_COLORS.info

    // Remove oldest if at capacity (instant destroy — already off-screen or timed out)
    while (this.activeToasts.length >= MAX_TOASTS) {
      const old = this.activeToasts.shift()
      old?.container.destroy()
    }

    // Smoothly tween existing toasts upward to make room for the new slot
    this.activeToasts.forEach((t, i) => {
      this.tweens.add({
        targets: t.container,
        y: 16 + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Power2',
      })
    })

    const slotIndex = this.activeToasts.length
    const startX    = this.viewWidth - TOAST_W - 16
    const startY    = 16 + slotIndex * (TOAST_H + TOAST_MARGIN)

    // Background panel
    const bg = this.add.graphics()
    bg.fillStyle(bgColor, 0.92)
    bg.fillRoundedRect(0, 0, TOAST_W, TOAST_H, 6)

    // Type-indicator dot — small circle on the left edge, vertically centred
    const dot = this.add.graphics()
    dot.fillStyle(iconColor, 1)
    dot.fillCircle(16, TOAST_H / 2, 3)

    // Label — offset right to clear the dot
    const label = this.add.text(26, 6, text, {
      fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0',
      wordWrap: { width: TOAST_W - 34 },
    })

    // Start off-screen to the right; slide in on entry
    const toast = this.add.container(startX + SLIDE_OFFSET, startY, [bg, dot, label])
    toast.setAlpha(0).setScrollFactor(0).setDepth(9998)
    this.toastContainer!.add(toast)

    const entry = { container: toast, createdAt: Date.now() }
    this.activeToasts.push(entry)

    // Slide in from right with a slight overshoot bounce
    this.tweens.add({
      targets: toast,
      x: startX,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })

    // Auto-dismiss: slide back out to the right and fade
    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: toast,
        x: startX + SLIDE_OFFSET,
        alpha: 0,
        duration: 250,
        ease: 'Power2',
        onComplete: () => {
          const idx = this.activeToasts.indexOf(entry)
          if (idx >= 0) this.activeToasts.splice(idx, 1)
          toast.destroy()
          this.reflowToasts()
        },
      })
    })
  }

  private reflowToasts(): void {
    const TOAST_H = 28
    const TOAST_MARGIN = 8
    this.activeToasts.forEach((t, i) => {
      this.tweens.add({
        targets: t.container,
        y: 16 + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Back.easeOut',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getPoseFrame(charIdx: number, agent: AgentState): number {
    const base = charIdx * CHAR_COLS
    
    // Priority: interaction needs > error/compress > working > idle/default
    if (agent.needsInteraction) {
      // Surprise for questions or edits pending
      if (agent.interactionType === 'question' || agent.interactionType === 'accept-edits') {
        return base + POSE_SURPRISE
      }
      // Hurt/panic animation for tool approvals that need attention
      if (agent.interactionType === 'tool-approval') {
        return base + POSE_HURT
      }
      // Default wait state
      return base + POSE_WALK
    }
    
    // Working states
    if (agent.sessionMode === 'working' || agent.sessionMode === 'plan') {
      return base + POSE_INTERACT
    }
    
    // Special states
    if (agent.sessionMode === 'compressing') {
      return base + POSE_HURT  // Struggle animation for compression
    }
    
    if (agent.sessionMode === 'accept-edits') {
      return base + POSE_SURPRISE  // Alert about pending edits
    }
    
    if (agent.sessionMode === 'waiting') {
      return base + POSE_WALK  // Waiting/moving animation
    }
    
    // Idle or default
    if (agent.sessionMode === 'idle' || !agent.sessionMode) {
      return base + POSE_SIT
    }
    
    return base + POSE_IDLE
  }

  /** World-space Y of the room's door opening. */
  private getRoomDoorY(room: Room): number {
    return room.doorSide === 'top'
      ? room.y - room.height / 2 + 20
      : room.y + room.height / 2
  }

  private getStatusColor(agent: AgentState): number {
    if (agent.needsInteraction) {
      if (agent.interactionType === 'tool-approval') return 0xf87171  // Red for approval needed
      return 0xfbbf24  // Yellow for other interactions
    }
    if (agent.sessionMode === 'working')       return 0x34d399  // Green for working
    if (agent.sessionMode === 'plan')          return 0xa78bfa  // Purple for planning
    if (agent.sessionMode === 'accept-edits')  return 0x60a5fa  // Blue for pending edits
    if (agent.sessionMode === 'compressing')    return 0xf87171  // Red for compressing
    if (agent.sessionMode === 'waiting')        return 0xfbbf24  // Yellow for waiting
    return 0x64748b  // Gray for idle
  }

  private isCursorAgent(agent: AgentState): boolean {
    return agent.config.model === 'cursor-agent'
  }

  private isOpencodeAgent(agent: AgentState): boolean {
    const model = agent.config.model
    return model === 'opencode' ||
      model === 'openclaw' ||
      model === 'nemoclaw' ||
      agent.config.id.startsWith('opencode-') ||
      agent.config.id.startsWith('openclaw-') ||
      agent.config.id.startsWith('nemoclaw-')
  }

  private hashToken(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  private getCharacterIndex(name: string): number {
    return this.hashToken(name) % NUM_CHARS
  }

  private getAgentCharacterIndex(agent: AgentState): number {
    if (this.isCursorAgent(agent)) return 1
    if (this.isOpencodeAgent(agent)) return 2  // Tinted character sprite
    return this.getCharacterIndex(agent.config.name)
  }

  private getTeamInfo(cwd: string): { key: string; label: string } {
    if (cwd === '__unassigned__') return { key: '__unassigned__', label: 'Unassigned' }
    const parts = cwd.replace(/\/$/, '').split('/').filter(Boolean)
    const leaf = parts[parts.length - 1] || cwd
    const parent = parts.length >= 3 ? parts[parts.length - 2] : leaf
    return { key: parent, label: parent }
  }

  private getTeamColor(teamKey: string): number {
    if (teamKey === '__unassigned__') return 0x94a3b8
    const palette = [0x3b82f6, 0x14b8a6, 0x8b5cf6, 0xf59e0b, 0x22c55e, 0xec4899]
    return palette[this.hashToken(teamKey) % palette.length]
  }

  private cwdToLabel(cwd: string): string {
    if (cwd === '__unassigned__') return 'Unassigned'
    const parts = cwd.replace(/\/$/, '').split('/')
    return parts[parts.length - 1] || cwd
  }

  private formatLabel(label: string): string {
    return label
  }

  private truncName(name: string): string {
    return name.length > 14 ? name.slice(0, 12) + '..' : name
  }

  // ---------------------------------------------------------------------------
  // Triplet connecting lines (Fix 11)
  // ---------------------------------------------------------------------------

  private drawTripletLines(timeMs: number = this.time.now): void {
    if (!this.tripletGraphics) {
      this.tripletGraphics = this.add.graphics()
      this.tripletGraphics.setDepth(9999)
    }
    this.tripletGraphics.clear()

    for (const triplet of this.tripletLines) {
      const agentIds = [triplet.solverAgentId, triplet.reviewerAgentId, triplet.executorAgentId]
      const positions: { x: number; y: number }[] = []

      for (const agentId of agentIds) {
        const pos = this.getWorkstationWorldPos(agentId)
        if (pos) positions.push(pos)
      }

      if (positions.length < 2) continue

      // Color based on workflow status
      let lineColor = 0x64748b
      let lineAlpha = 0.4
      if (triplet.status === 'solving' || triplet.status === 'reviewing' || triplet.status === 'executing') {
        lineColor = 0x3b82f6
        lineAlpha = 0.6
      } else if (triplet.status === 'feedback') {
        lineColor = 0xfbbf24
        lineAlpha = 0.5
      }

      this.tripletGraphics.lineStyle(2, lineColor, lineAlpha)

      // Draw dashed lines between each pair
      for (let i = 0; i < positions.length - 1; i++) {
        this.drawDashedLine(
          this.tripletGraphics,
          positions[i].x, positions[i].y,
          positions[i + 1].x, positions[i + 1].y,
          4, 4,
        )
      }

      if (this.isTripletAnimatedStatus(triplet.status)) {
        const pulseSegments = this.getTripletPulseSegments(triplet.status, positions.length)
        const pulseColor = triplet.status === 'feedback' ? COLOR_LED_AMBER : 0x60a5fa
        const seed = this.hashToken(triplet.workflowId) % 1000
        pulseSegments.forEach((seg, i) => {
          if (seg.from < 0 || seg.to < 0 || seg.from >= positions.length || seg.to >= positions.length) return
          const speed = 0.00058
          const base = (timeMs * speed + seed * 0.001 + i * 0.21) % 1
          const t = seg.from <= seg.to ? base : 1 - base
          this.drawTripletPulse(this.tripletGraphics!, positions[seg.from], positions[seg.to], t, pulseColor)
        })
      }
    }
  }

  private isTripletAnimatedStatus(status: string): boolean {
    return status === 'solving' || status === 'reviewing' || status === 'executing' || status === 'feedback'
  }

  private getTripletPulseSegments(status: string, pointCount: number): Array<{ from: number; to: number }> {
    if (pointCount < 2) return []
    if (status === 'feedback') return [{ from: Math.min(1, pointCount - 1), to: 0 }]
    if (status === 'reviewing' || status === 'executing') {
      if (pointCount >= 3) return [{ from: 1, to: 2 }]
      return [{ from: 0, to: 1 }]
    }
    if (status === 'solving') return [{ from: 0, to: 1 }]
    return []
  }

  private drawTripletPulse(
    g: Phaser.GameObjects.Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    t: number,
    color: number,
  ): void {
    const px = Phaser.Math.Linear(start.x, end.x, t)
    const py = Phaser.Math.Linear(start.y, end.y, t)
    g.fillStyle(color, 0.2)
    g.fillCircle(px, py, 6.5)
    g.fillStyle(color, 0.85)
    g.fillCircle(px, py, 2.6)
  }

  private drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.001) return
    const ux = dx / len
    const uy = dy / len
    let d = 0
    let drawing = true
    g.beginPath()
    g.moveTo(x1, y1)
    while (d < len) {
      const step = drawing ? dashLen : gapLen
      d = Math.min(d + step, len)
      const px = x1 + ux * d
      const py = y1 + uy * d
      if (drawing) g.lineTo(px, py)
      else g.moveTo(px, py)
      drawing = !drawing
    }
    g.strokePath()
  }

  private getWorkstationWorldPos(agentId: string): { x: number; y: number } | null {
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        return { x: room.x + ws.container.x, y: room.y + ws.container.y }
      }
    }
    return null
  }

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
    if (!this.chatLineGraphics || !this.isReady) return

    const fromPos = this.getWorkstationWorldPos(fromAgentId)
    const toPos   = this.getWorkstationWorldPos(toAgentId)
    if (!fromPos || !toPos) return

    const midX = (fromPos.x + toPos.x) / 2
    const midY = (fromPos.y + toPos.y) / 2
    const dist  = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y)
    const controlPt = { x: midX, y: midY - dist * 0.4 }

    const dot = this.add.circle(fromPos.x, fromPos.y, 2, 0x3b82f6, 1)
    dot.setDepth(210).setVisible(false)

    this.chatAnimations.push({
      fromPos:       { ...fromPos },
      toPos:         { ...toPos },
      controlPt,
      dot,
      startTime:     this.time.now,
      travelDuration: 800,
      fadeDuration:   300,
      fadeStart:     -1,
      lineAlpha:      0.4,
      expired:        false,
    })

    this.time.delayedCall(duration, () => {
      for (const anim of this.chatAnimations) {
        if (anim.dot === dot && !anim.expired && anim.fadeStart < 0) {
          anim.fadeStart = this.time.now
        }
      }
    })
  }

  /**
   * Compute position on a quadratic bezier at parameter t and draw a traveling
   * dot at that position.
   * B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
   */
  private drawBezierDot(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    controlPt: { x: number; y: number },
    t: number,
    color: number,
  ): void {
    const mt = 1 - t
    const px = mt * mt * from.x + 2 * mt * t * controlPt.x + t * t * to.x
    const py = mt * mt * from.y + 2 * mt * t * controlPt.y + t * t * to.y
    g.fillStyle(color, 0.2)
    g.fillCircle(px, py, 5)
    g.fillStyle(color, 0.85)
    g.fillCircle(px, py, 2.5)
  }

  private tickChatAnimations(timeMs: number): void {
    if (!this.chatLineGraphics) return
    const g = this.chatLineGraphics
    g.clear()

    let hasExpired = false

    for (const anim of this.chatAnimations) {
      if (anim.expired) continue

      const elapsed = timeMs - anim.startTime

      let lineAlpha = 0.4
      if (anim.fadeStart >= 0) {
        const fadePct = Math.min((timeMs - anim.fadeStart) / anim.fadeDuration, 1)
        lineAlpha = 0.4 * (1 - fadePct)
        if (fadePct >= 1) {
          anim.expired = true
          hasExpired   = true
          try { anim.dot.destroy() } catch { /* already gone */ }
          continue
        }
      }

      // Draw bezier curve as connected line segments
      const SEGMENTS = 20
      g.lineStyle(1.5, 0x60a5fa, lineAlpha)
      g.beginPath()
      for (let i = 0; i <= SEGMENTS; i++) {
        const ts  = i / SEGMENTS
        const mts = 1 - ts
        const px = mts * mts * anim.fromPos.x + 2 * mts * ts * anim.controlPt.x + ts * ts * anim.toPos.x
        const py = mts * mts * anim.fromPos.y + 2 * mts * ts * anim.controlPt.y + ts * ts * anim.toPos.y
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.strokePath()

      // Animate traveling dot along the bezier
      if (anim.fadeStart < 0) {
        const tDot = Math.min(elapsed / anim.travelDuration, 1)
        this.drawBezierDot(g, anim.fromPos, anim.toPos, anim.controlPt, tDot, 0x3b82f6)
        if (tDot >= 1) {
          anim.fadeStart = timeMs
        }
      }
    }

    if (hasExpired) {
      this.chatAnimations = this.chatAnimations.filter(a => !a.expired)
    }
  }

  // ---------------------------------------------------------------------------
  // Rich hover tooltip + hover ring
  // ---------------------------------------------------------------------------

  private showRichTooltip(agent: AgentState, screenX: number, screenY: number): void {
    if (this.tooltipFadeTween) { this.tooltipFadeTween.destroy(); this.tooltipFadeTween = null }
    if (this.tooltipContainer) { this.tooltipContainer.destroy(); this.tooltipContainer = null }
    if (this.tooltipGraphics)  { this.tooltipGraphics.destroy();  this.tooltipGraphics  = null }
    const name   = agent.config.name  ?? 'Agent'
    const title  = agent.config.title ?? ''
    const role   = agent.config.tripletRole ? agent.config.tripletRole.toUpperCase() : ''
    const uptime = agent.uptime ?? ''
    const resources = [agent.cpu ? `CPU ${agent.cpu}` : '', agent.memoryMB ? `${Math.round(agent.memoryMB)}MB` : ''].filter(Boolean).join('  ')
    let statusLabel = 'idle', statusHex = '#64748b'
    if (agent.needsInteraction) { statusLabel = agent.interactionType === 'tool-approval' ? 'needs approval' : agent.interactionType === 'question' ? 'question' : agent.interactionType === 'accept-edits' ? 'accept edits' : 'waiting'; statusHex = '#fbbf24' }
    else if (agent.sessionMode === 'working') { statusLabel = 'working'; statusHex = '#34d399' }
    else if (agent.sessionMode === 'plan') { statusLabel = 'planning'; statusHex = '#a78bfa' }
    else if (agent.sessionMode === 'compressing') { statusLabel = 'compressing'; statusHex = '#60a5fa' }
    const raw = (agent.lastAssistantBlurb ?? agent.lastUserMessage ?? '').trim()
    const blurb = raw.length > 110 ? raw.slice(0, 108) + '..' : raw
    const bs = agent.config.persona?.backstory ?? ''
    const sub = blurb || (bs.length > 80 ? bs.slice(0, 78) + '..' : bs)
    const TW = 220, PX = 10, PY = 8, LH = 16, AH = 7
    const hasR = resources.length > 0, hasS = sub.length > 0
    const subL = hasS ? Math.max(1, Math.ceil(sub.length / 26)) : 0
    const tH = PY + LH + (title ? LH : 0) + 4 + LH + (hasR ? LH : 0) + (hasS ? 6 + subL * LH : 0) + PY, tW = TW + PX * 2
    const flip = screenY < tH + AH + 20
    const aY = flip ? screenY + AH + 2 : screenY - AH - 2 - tH
    const cX = Math.max(8, Math.min(screenX - tW / 2, this.viewWidth - tW - 8))
    const g = this.add.graphics(); g.setScrollFactor(0).setDepth(10000); this.tooltipGraphics = g
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(cX + 3, aY + 3, tW, tH, 7)
    g.fillStyle(0x0f172a, 0.97); g.fillRoundedRect(cX, aY, tW, tH, 7)
    g.lineStyle(1, 0x475569, 0.8); g.strokeRoundedRect(cX, aY, tW, tH, 7)
    const aInt = parseInt(statusHex.replace('#', ''), 16), arX = Math.min(Math.max(screenX, cX + 14), cX + tW - 14)
    g.fillStyle(0x0f172a, 0.97)
    if (!flip) { g.fillTriangle(arX - 6, aY + tH, arX, aY + tH + AH, arX + 6, aY + tH); g.lineStyle(1, 0x0f172a, 1); g.lineBetween(arX - 5, aY + tH, arX + 5, aY + tH) }
    else { g.fillTriangle(arX - 6, aY, arX, aY - AH, arX + 6, aY); g.lineStyle(1, 0x0f172a, 1); g.lineBetween(arX - 5, aY, arX + 5, aY) }
    g.lineStyle(2, aInt, 0.6); g.lineBetween(cX + 7, aY, cX + tW - 7, aY)
    const ct = this.add.container(0, 0); ct.setScrollFactor(0).setDepth(10001); this.tooltipContainer = ct
    const tx = cX + PX; let ty = aY + PY
    ct.add(this.add.text(tx, ty, name, { fontSize: '12px', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', resolution: 2 }))
    if (role) { const rc: Record<string, string> = { SOLVER: '#3b82f6', REVIEWER: '#8b5cf6', EXECUTOR: '#22c55e' }; ct.add(this.add.text(cX + tW - PX, ty + 1, role, { fontSize: '9px', color: '#ffffff', fontFamily: 'system-ui, monospace', fontStyle: 'bold', backgroundColor: rc[role] ?? '#475569', padding: { x: 4, y: 2 }, resolution: 2 }).setOrigin(1, 0)) }
    ty += LH
    if (title) { ct.add(this.add.text(tx, ty, title, { fontSize: '10px', color: '#94a3b8', fontFamily: 'system-ui, sans-serif', resolution: 2 })); ty += LH }
    ty += 4
    ct.add(this.add.circle(tx + 3.5, ty + LH / 2, 3.5, aInt, 1)); ct.add(this.add.text(tx + 12, ty, statusLabel, { fontSize: '10px', color: statusHex, fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', resolution: 2 }))
    if (uptime) ct.add(this.add.text(cX + tW - PX, ty, uptime, { fontSize: '10px', color: '#64748b', fontFamily: 'system-ui, monospace', resolution: 2 }).setOrigin(1, 0))
    ty += LH
    if (hasR) { ct.add(this.add.text(tx + 12, ty, resources, { fontSize: '9px', color: '#64748b', fontFamily: 'system-ui, monospace', resolution: 2 })); ty += LH }
    if (hasS) { ty += 2; const dg = this.add.graphics(); dg.setScrollFactor(0); dg.lineStyle(1, 0x334155, 0.6); dg.lineBetween(tx, ty, cX + tW - PX, ty); ct.add(dg); ty += 4; ct.add(this.add.text(tx, ty, sub, { fontSize: '10px', color: '#94a3b8', fontFamily: 'system-ui, sans-serif', wordWrap: { width: TW }, resolution: 2 })) }
    ct.setAlpha(0); g.setAlpha(0)
    this.tooltipFadeTween = this.tweens.add({ targets: [ct, g], alpha: 1, duration: 150, ease: 'Quad.easeOut' })
  }

  private hideTooltip(): void {
    if (this.tooltipFadeTween) { this.tooltipFadeTween.destroy(); this.tooltipFadeTween = null }
    if (this.tooltipContainer) {
      const c = this.tooltipContainer, gfx = this.tooltipGraphics
      this.tooltipContainer = null; this.tooltipGraphics = null
      this.tweens.add({ targets: [c, gfx].filter(Boolean), alpha: 0, duration: 120, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); gfx?.destroy() } })
    }
  }

  private drawHoverRing(worldX: number, worldY: number): void {
    if (!this.hoverRingGraphics) { this.hoverRingGraphics = this.add.graphics(); this.hoverRingGraphics.setDepth(500) }
    const g = this.hoverRingGraphics, cy = worldY + WS_DESK_Y
    g.clear()
    g.lineStyle(5, 0x60a5fa, 0.12); g.strokeEllipse(worldX, cy, 82, 46)
    g.lineStyle(2.5, 0x3b82f6, 0.32); g.strokeEllipse(worldX, cy, 74, 38)
    g.lineStyle(1.5, 0x3b82f6, 0.72); g.strokeEllipse(worldX, cy, 68, 32)
  }

  private clearHoverRing(): void { this.hoverRingGraphics?.clear() }

  // ---------------------------------------------------------------------------
  // Camera & navigation helpers
  // ---------------------------------------------------------------------------

  private isAnyRoomVisible(padding = 24): boolean {
    if (this.rooms.size === 0) return false
    const view = this.cameras.main.worldView
    const vx1 = view.x - padding
    const vy1 = view.y - padding
    const vx2 = view.right + padding
    const vy2 = view.bottom + padding
    for (const room of this.rooms.values()) {
      const rx1 = room.x - room.width / 2
      const ry1 = room.y - room.height / 2
      const rx2 = room.x + room.width / 2
      const ry2 = room.y + room.height / 2
      if (rx2 >= vx1 && rx1 <= vx2 && ry2 >= vy1 && ry1 <= vy2) return true
    }
    return false
  }

  private getMinZoom(): number {
    return ZOOM_MIN
  }

  private zoomToFit(animated: boolean): void {
    if (this.rooms.size === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of this.rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    // Expand bounds to include the building rect drawn by drawOfficeBackground.
    // Wall is now inset (no overshoot). Building rect: (0, 0) to (bgW+30, bgH+30).
    if (this.lastOfficeBgW > 0) {
      minX = Math.min(minX, 0)
      minY = Math.min(minY, 0)
      maxX = Math.max(maxX, this.lastOfficeBgW + 30)
      maxY = Math.max(maxY, this.lastOfficeBgH + 30)
    }
    const padFactor = 1.08
    // Prevent auto-fit from over-zooming small room sets (looks like "2x agents").
    const fitZoom = Phaser.Math.Clamp(
      Math.min(this.viewWidth / ((maxX - minX) * padFactor), this.viewHeight / ((maxY - minY) * padFactor)),
      this.getMinZoom(), Math.min(ZOOM_MAX, ZOOM_FIT_MAX),
    )
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    if (animated) {
      this.targetZoom = fitZoom
      this.followTarget = { x: cx, y: cy }
    } else {
      this.targetZoom = fitZoom
      this.followTarget = null
      this.cameras.main.setZoom(fitZoom)
      this.cameras.main.centerOn(cx, cy)
    }
  }

  private queueMinimapRoomFlash(cwd: string, color: number, durationMs: number): void {
    this.minimapRoomFlashes.set(cwd, { until: this.time.now + durationMs, color })
    this.minimapDirty = true
  }

  private tickMinimapRoomFlashes(now: number): void {
    if (this.minimapRoomFlashes.size === 0) return
    let expired = false
    for (const [cwd, flash] of this.minimapRoomFlashes) {
      if (flash.until <= now) {
        this.minimapRoomFlashes.delete(cwd)
        expired = true
      }
    }
    if (expired || this.minimapRoomFlashes.size > 0) this.minimapDirty = true
  }

  private initMinimap(): void {
    this.minimapContainer = this.add.container(0, 0).setDepth(10010).setScrollFactor(0)
    this.minimapGraphics = this.add.graphics().setScrollFactor(0)
    this.minimapViewport = this.add.graphics().setScrollFactor(0)
    this.minimapHitZone = this.add
      .rectangle(0, 0, MINIMAP_W, MINIMAP_H, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    this.minimapHitZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.minimapPanning = true
      this.panCameraFromMinimapPointer(p)
    })
    this.minimapHitZone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.minimapPanning && p.isDown) {
        this.panCameraFromMinimapPointer(p)
      }
      this.updateMinimapHoverLabel(p)
    })
    this.minimapHitZone.on('pointerup', () => {
      this.minimapPanning = false
    })
    this.minimapHitZone.on('pointerout', () => {
      this.minimapPanning = false
      this.hideMinimapHoverLabel()
    })
    this.minimapContainer.add([this.minimapGraphics, this.minimapViewport, this.minimapHitZone])

    // Hover label elements — screen-space, depth above minimap container
    this.minimapHoverBg = this.add.graphics().setScrollFactor(0).setDepth(10020).setVisible(false)
    this.minimapHoverLine = this.add.graphics().setScrollFactor(0).setDepth(10019).setVisible(false)
    this.minimapHoverLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setScrollFactor(0)
      .setDepth(10021)
      .setVisible(false)

    this.repositionMinimap()
  }

  private updateMinimapHoverLabel(pointer: Phaser.Input.Pointer): void {
    if (!this.minimapContainer || !this.minimapProjection) {
      this.hideMinimapHoverLabel()
      return
    }
    const { pad, minX, minY, scale } = this.minimapProjection
    const localX = pointer.x - this.minimapContainer.x
    const localY = pointer.y - this.minimapContainer.y

    // Hit-test each room rectangle in minimap-local space
    let hoveredRoom: Room | null = null
    let roomMidMX = 0
    let roomMidMY = 0
    for (const room of this.rooms.values()) {
      const rx = pad + (room.x - room.width / 2 - minX) * scale
      const ry = pad + (room.y - room.height / 2 - minY) * scale
      const rw = room.width * scale
      const rh = room.height * scale
      if (localX >= rx && localX <= rx + rw && localY >= ry && localY <= ry + rh) {
        hoveredRoom = room
        roomMidMX = rx + rw / 2
        roomMidMY = ry + rh / 2
        break
      }
    }

    if (!hoveredRoom) {
      this.hideMinimapHoverLabel()
      return
    }

    // Short display name — truncate at 18 chars
    const rawLabel = hoveredRoom.label || hoveredRoom.cwd.split('/').pop() || '?'
    const shortName = rawLabel.length > 18 ? rawLabel.slice(0, 16) + '..' : rawLabel

    if (!this.minimapHoverLabel || !this.minimapHoverBg || !this.minimapHoverLine) return

    this.minimapHoverLabel.setText(shortName)
    this.minimapHoverLabel.setVisible(true)

    const textW = this.minimapHoverLabel.width
    const textH = this.minimapHoverLabel.height
    const pillPadX = 6
    const pillPadY = 3
    const pillW = textW + pillPadX * 2
    const pillH = textH + pillPadY * 2
    const pillR = 4

    // Pill floats above the minimap panel, centered over the hovered room
    const mmScreenX = this.minimapContainer.x
    const mmScreenY = this.minimapContainer.y
    const roomScreenMX = mmScreenX + roomMidMX
    const pillY = mmScreenY - pillH - 6
    const pillX = Phaser.Math.Clamp(roomScreenMX - pillW / 2, 4, this.viewWidth - pillW - 4)

    // Draw dark pill background
    this.minimapHoverBg.clear()
    this.minimapHoverBg.fillStyle(0x0f172a, 0.92)
    this.minimapHoverBg.fillRoundedRect(pillX, pillY, pillW, pillH, pillR)
    this.minimapHoverBg.lineStyle(1, 0x334155, 0.8)
    this.minimapHoverBg.strokeRoundedRect(pillX, pillY, pillW, pillH, pillR)
    this.minimapHoverBg.setVisible(true)

    // Label text inside pill
    this.minimapHoverLabel.setPosition(pillX + pillPadX, pillY + pillPadY)

    // Vertical connector from pill bottom to room midpoint on the minimap
    const lineX = Phaser.Math.Clamp(roomScreenMX, mmScreenX + 4, mmScreenX + MINIMAP_W - 4)
    const lineTopY = pillY + pillH
    const lineBottomY = mmScreenY + roomMidMY
    this.minimapHoverLine.clear()
    this.minimapHoverLine.lineStyle(1, 0x94a3b8, 0.5)
    this.minimapHoverLine.lineBetween(lineX, lineTopY, lineX, lineBottomY)
    this.minimapHoverLine.setVisible(true)
  }

  private hideMinimapHoverLabel(): void {
    this.minimapHoverLabel?.setVisible(false)
    this.minimapHoverBg?.setVisible(false)
    this.minimapHoverLine?.setVisible(false)
  }

  private panCameraFromMinimapPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.minimapContainer || !this.minimapProjection) return
    const { pad, drawW, drawH, minX, minY, scale } = this.minimapProjection
    const localX = pointer.x - this.minimapContainer.x
    const localY = pointer.y - this.minimapContainer.y
    const clampedX = Phaser.Math.Clamp(localX, pad, pad + drawW)
    const clampedY = Phaser.Math.Clamp(localY, pad, pad + drawH)
    const safeScale = Math.max(scale, 0.0001)
    const worldX = minX + (clampedX - pad) / safeScale
    const worldY = minY + (clampedY - pad) / safeScale
    this.followTarget = { x: worldX, y: worldY }
    this.minimapDirty = true
  }

  private repositionMinimap(): void {
    if (!this.minimapContainer) return
    this.minimapContainer.setPosition(
      this.viewWidth - MINIMAP_W - MINIMAP_MARGIN,
      this.viewHeight - MINIMAP_H - MINIMAP_MARGIN,
    )
  }

  // ---------------------------------------------------------------------------
  // Status bar (screen-space, top of viewport)
  // ---------------------------------------------------------------------------

  private buildStatusBar(): void {
    const BAR_H = 24;
    const vw = this.viewWidth;
    const vh = this.viewHeight;
    this.statusBarContainer = this.add.container(0, vh - BAR_H).setDepth(9995).setScrollFactor(0);
    this.statusBarBg = this.add.rectangle(0, 0, vw, BAR_H, 0x0f172a, 0.85).setOrigin(0, 0);
    this.statusBarContainer.add(this.statusBarBg);
    const ts = { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: '#94a3b8' };
    const midY = BAR_H / 2;
    const brandText = this.add.text(10, midY, 'PENNY OFFICE', ts).setOrigin(0, 0.5);
    this.statusBarContainer.add(brandText);
    const cx = vw / 2;
    this.statusBarAgentText = this.add.text(cx - 80, midY, 'AGENTS 0', ts).setOrigin(0.5, 0.5);
    this.statusBarActiveText = this.add.text(cx, midY, 'ACTIVE 0', ts).setOrigin(0.5, 0.5);
    this.statusBarRoomText = this.add.text(cx + 80, midY, 'ROOMS 0', ts).setOrigin(0.5, 0.5);
    this.statusBarContainer.add([this.statusBarAgentText, this.statusBarActiveText, this.statusBarRoomText]);
    this.statusBarTimeText = this.add.text(vw - 10, midY, this.getStatusBarTime(), ts).setOrigin(1, 0.5);
    this.statusBarContainer.add(this.statusBarTimeText);
    const sep = this.add.rectangle(0, BAR_H - 1, vw, 1, 0x1e293b, 1).setOrigin(0, 0);
    this.statusBarContainer.add(sep);
  }

  private repositionStatusBar(): void {
    if (!this.statusBarContainer) return;
    const vw = this.viewWidth;
    const vh = this.viewHeight;
    this.statusBarContainer.setY(vh - 24);
    if (this.statusBarBg) this.statusBarBg.setSize(vw, 24);
    if (this.statusBarAgentText) this.statusBarAgentText.setX(vw / 2 - 80);
    if (this.statusBarActiveText) this.statusBarActiveText.setX(vw / 2);
    if (this.statusBarRoomText) this.statusBarRoomText.setX(vw / 2 + 80);
    if (this.statusBarTimeText) this.statusBarTimeText.setX(vw - 10);
  }

  private updateStatusBar(): void {
    if (!this.statusBarAgentText || !this.statusBarActiveText || !this.statusBarRoomText) return;
    const totalAgents = this.agents.length;
    const activeAgents = this.agents.filter((a) => a.status === 'active').length;
    const roomCount = this.rooms.size;
    this.statusBarAgentText.setText('AGENTS ' + totalAgents);
    this.statusBarActiveText.setText('ACTIVE ' + activeAgents);
    this.statusBarActiveText.setColor(activeAgents > 0 ? '#34d399' : '#94a3b8');
    this.statusBarRoomText.setText('ROOMS ' + roomCount);
  }

  private refreshStatusBarTime(): void {
    if (this.statusBarTimeText) this.statusBarTimeText.setText(this.getStatusBarTime());
  }

  private getStatusBarTime(): string {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  }

  private drawMinimap(): void {
    if (!this.minimapGraphics || !this.minimapViewport) return
    const mg = this.minimapGraphics, vg = this.minimapViewport
    mg.clear(); vg.clear()
    if (this.rooms.size === 0) {
      this.minimapProjection = null
      return
    }
    mg.fillStyle(MINIMAP_BG, 0.85)
    mg.fillRoundedRect(0, 0, MINIMAP_W, MINIMAP_H, 4)
    mg.lineStyle(1, 0x334155, 0.8)
    mg.strokeRoundedRect(0, 0, MINIMAP_W, MINIMAP_H, 4)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of this.rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2); minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2); maxY = Math.max(maxY, room.y + room.height / 2)
    }
    const pad = 8, drawW = MINIMAP_W - pad * 2, drawH = MINIMAP_H - pad * 2
    const s = Math.min(drawW / Math.max(maxX - minX, 1), drawH / Math.max(maxY - minY, 1))
    this.minimapProjection = { minX, minY, drawW, drawH, scale: s, pad }
    
    for (const room of this.rooms.values()) {
      const rx = pad + (room.x - room.width / 2 - minX) * s
      const ry = pad + (room.y - room.height / 2 - minY) * s
      const hasWorking = room.agents.some(a => a.sessionMode === 'working' || a.sessionMode === 'plan')
      const hasWaiting = room.agents.some(a => a.needsInteraction)
      mg.fillStyle(hasWaiting ? 0xfbbf24 : hasWorking ? 0x34d399 : MINIMAP_ROOM_COLOR, hasWaiting || hasWorking ? 0.6 : 0.4)
      mg.fillRect(rx, ry, room.width * s, room.height * s)

      // Activity pulse ring for rooms with working agents
      if (hasWorking) {
        const pulseAlpha = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(this.time.now * 0.003))
        mg.lineStyle(1.5, 0x34d399, pulseAlpha)
        mg.strokeRect(rx - 2, ry - 2, room.width * s + 4, room.height * s + 4)
      }

      const flash = this.minimapRoomFlashes.get(room.cwd)
      if (flash) {
        const pulse = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(this.time.now * 0.015))
        mg.lineStyle(2, flash.color, pulse)
        mg.strokeRect(rx - 1.5, ry - 1.5, room.width * s + 3, room.height * s + 3)
      }

      // Draw active agent dots in a small row along the bottom of the room rect
      const workstationList = Array.from(room.workstations.values())
      if (workstationList.length === 0) continue
      const dotRadius = 1.5
      const dotSpacing = dotRadius * 2 + 1.5
      const totalDotsW = workstationList.length * dotSpacing - 1.5
      const roomW = room.width * s
      const roomH = room.height * s
      const dotStartX = rx + Math.max(0, (roomW - totalDotsW) / 2) + dotRadius
      const dotY = ry + roomH - dotRadius - 1.5
      workstationList.forEach((ws, i) => {
        if (!ws.state) return
        const dotColor = ws.state.needsInteraction ? 0xfbbf24
          : ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan' ? 0x34d399
          : 0x64748b
        mg.fillStyle(dotColor, 0.9)
        mg.fillCircle(dotStartX + i * dotSpacing, dotY, dotRadius)
      })
    }
    const cam = this.cameras.main
    const vpX = Phaser.Math.Clamp(pad + (cam.scrollX - minX) * s, pad, pad + drawW)
    const vpY = Phaser.Math.Clamp(pad + (cam.scrollY - minY) * s, pad, pad + drawH)
    const vpW = Math.min((cam.width / cam.zoom) * s, drawW)
    const vpH = Math.min((cam.height / cam.zoom) * s, drawH)

    // Viewport glow — draw a slightly larger rect behind at low alpha, pulsing subtly
    const glowAlpha = 0.1 + 0.05 * (0.5 + 0.5 * Math.sin(this.time.now * 0.002))
    vg.lineStyle(3, MINIMAP_VIEWPORT_COLOR, glowAlpha)
    vg.strokeRect(vpX - 1, vpY - 1, vpW + 2, vpH + 2)

    // Normal viewport rect on top
    vg.lineStyle(1.5, MINIMAP_VIEWPORT_COLOR, 0.9)
    vg.strokeRect(vpX, vpY, vpW, vpH)
  }

  // Multi-level LOD system (3 levels):
  //   Level 1 (overview, zoom < LOD_L1_MAX):  rooms show as colored rects only — internals hidden
  //   Level 2 (room, LOD_L1_MAX..LOD_L2_MAX): agents + desks visible, micro-accessories hidden
  //   Level 3 (detail, zoom > LOD_L2_MAX):    full detail including accessories, monitor content

  private applyLod(level: number): void {
    this.showLodLabel(level)

    const showRoomInterior = level >= 2
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        this.applyLodToWorkstation(ws, level, true)
      }
      room.activityBar.setVisible(showRoomInterior)
      room.waitingBar.setVisible(showRoomInterior)
      room.statusLed.setVisible(showRoomInterior)
      room.statusLedGlow.setVisible(showRoomInterior)
      if (room.doorGraphics) room.doorGraphics.setVisible(showRoomInterior)
      if (room.doorFrameGraphics) room.doorFrameGraphics.setVisible(showRoomInterior)
      if (room.miniWhiteboard) room.miniWhiteboard.setVisible(level >= 3)
    }

    if (this.whiteboardContainer) this.whiteboardContainer.setVisible(level >= 3)
    for (const t of this.corridorSignTexts) t.setVisible(level >= 2)
    for (const t of this.teamAreaLabels) t.setVisible(level >= 2)
  }

  private applyLodToWorkstation(ws: WorkstationSprite, level: number, useFadeIn: boolean): void {
    const showRoom = level >= 2
    const showFull = level >= 3

    ws.container.setVisible(showRoom)
    if (!showRoom) return

    type VisObj = Phaser.GameObjects.Components.Visible & { setAlpha?: (a: number) => void }

    const applyVisibility = (obj: Phaser.GameObjects.GameObject, show: boolean) => {
      const v = obj as unknown as VisObj
      if (show) {
        if (!v.visible && useFadeIn && v.setAlpha) {
          v.setVisible(true)
          v.setAlpha(0)
          this.tweens.add({ targets: obj, alpha: 1, duration: 200, ease: 'Sine.easeOut' })
        } else {
          v.setVisible(true)
        }
      } else {
        v.setVisible(false)
      }
    }

    for (const obj of ws.lodLevel2Objects) {
      if (obj && 'setVisible' in obj) applyVisibility(obj, showRoom)
    }

    for (const obj of ws.lodLevel3Objects) {
      if (obj && 'setVisible' in obj) applyVisibility(obj, showFull)
    }

    // These are managed by animation state but suppressed below L3
    if (ws.screenLines) ws.screenLines.setVisible(showFull)
    if (ws.monitorGlowFx) {
      if (showFull) {
        if (ws.monitorGlowTween) ws.monitorGlowTween.resume()
      } else {
        if (ws.monitorGlowTween) ws.monitorGlowTween.pause()
        ws.monitorGlowFx.outerStrength = 0
      }
    }
  }

  private showLodLabel(level: number): void {
    const labels: Record<number, string> = { 1: 'Overview', 2: 'Rooms', 3: 'Detail' }
    const label = labels[level]
    if (!label) return

    if (this.lodLabelFadeTween) { this.lodLabelFadeTween.destroy(); this.lodLabelFadeTween = null }
    if (this.lodLabelContainer) { this.lodLabelContainer.destroy(); this.lodLabelContainer = null }

    const x = this.viewWidth - 14
    const y = this.viewHeight - 14 - 28

    const bg = this.add.graphics()
    bg.fillStyle(0x0f172a, 0.72)
    bg.fillRoundedRect(-72, -11, 72, 22, 4)

    const text = this.add.text(-36, 0, label, {
      fontSize: '10px',
      color: '#94a3b8',
      fontFamily: 'system-ui, sans-serif',
      resolution: 2,
    }).setOrigin(0.5)

    this.lodLabelContainer = this.add.container(x, y, [bg, text])
      .setDepth(9995)
      .setScrollFactor(0)
      .setAlpha(1)

    this.lodLabelFadeTween = this.tweens.add({
      targets: this.lodLabelContainer,
      alpha: 0,
      delay: 900,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.lodLabelContainer?.destroy()
        this.lodLabelContainer = null
        this.lodLabelFadeTween = null
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Keyboard navigation helpers
  // ---------------------------------------------------------------------------

  /** Get a flat, deterministic list of all agent IDs in room->workstation order */
  private getFlatAgentIds(): string[] {
    const ids: string[] = []
    for (const room of this.rooms.values()) {
      for (const id of room.workstations.keys()) {
        ids.push(id)
      }
    }
    return ids
  }

  /** Cycle selection forward (+1) or backward (-1) through agents */
  private cycleSelectedAgent(dir: 1 | -1): void {
    const ids = this.getFlatAgentIds()
    if (ids.length === 0) return
    if (this.selectedAgentIndex < 0 || this.selectedAgentIndex >= ids.length) {
      this.selectedAgentIndex = dir === 1 ? 0 : ids.length - 1
    } else {
      this.selectedAgentIndex = (this.selectedAgentIndex + dir + ids.length) % ids.length
    }
    this.applySelection(ids)
  }

  /** Jump directly to agent at index (0-based) */
  private selectAgentByIndex(index: number): void {
    const ids = this.getFlatAgentIds()
    if (index < 0 || index >= ids.length) return
    this.selectedAgentIndex = index
    this.applySelection(ids)
  }

  /** Apply the current selectedAgentIndex: draw ring + pan camera */
  private applySelection(ids?: string[]): void {
    const agentIds = ids ?? this.getFlatAgentIds()
    if (this.selectedAgentIndex < 0 || this.selectedAgentIndex >= agentIds.length) {
      this.clearSelectionRing()
      return
    }

    const agentId = agentIds[this.selectedAgentIndex]
    const pos = this.getWorkstationWorldPos(agentId)
    if (!pos) { this.clearSelectionRing(); return }

    this.drawSelectionRing(pos.x, pos.y)
    this.kbPanCameraTo(pos.x, pos.y)
  }

  /** Emit AGENT_CLICKED for the currently selected agent */
  private confirmSelectedAgent(): void {
    const ids = this.getFlatAgentIds()
    if (this.selectedAgentIndex < 0 || this.selectedAgentIndex >= ids.length) return
    const agentId = ids[this.selectedAgentIndex]

    // Find the agent state
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws?.state) {
        EventBus.emit(EVENTS.AGENT_CLICKED, agentId, ws.state)
        return
      }
    }
  }

  /** Clear selection state */
  private deselectAgent(): void {
    this.selectedAgentIndex = -1
    this.clearSelectionRing()
    EventBus.emit(EVENTS.AGENT_DESELECTED)
  }

  /** Draw a glowing animated targeting ring at world coordinates */
  private drawSelectionRing(wx: number, wy: number): void {
    if (!this.selectionRing || !this.selectionRingOuter) return

    const primaryColor = activeTheme.doorFrame
    // Lighter variant: blend doorFrame toward white by ~30%
    const lightColor = lerpColor(primaryColor, 0xffffff, 0.3)

    // --- Determine whether to tween position or jump ---
    const hasPrev = this.selectionRingCurrentPos !== null
    const prevX = this.selectionRingCurrentPos?.x ?? wx
    const prevY = this.selectionRingCurrentPos?.y ?? wy

    // Kill any existing position tween before repositioning
    if (this.selectionRingPosTween) {
      this.selectionRingPosTween.destroy()
      this.selectionRingPosTween = null
    }

    // If we already have a previous position, tween smoothly; otherwise snap
    if (hasPrev) {
      this.selectionRing.setPosition(prevX, prevY)
      this.selectionRingOuter.setPosition(prevX, prevY)

      // Tween a shared proxy object and sync both graphics each step
      const proxy = { x: prevX, y: prevY }
      this.selectionRingPosTween = this.tweens.add({
        targets: proxy,
        x: wx,
        y: wy,
        duration: 200,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          this.selectionRing?.setPosition(proxy.x, proxy.y)
          this.selectionRingOuter?.setPosition(proxy.x, proxy.y)
        },
        onComplete: () => {
          this.selectionRingCurrentPos = { x: wx, y: wy }
          this.selectionRingPosTween = null
        },
      })
    } else {
      this.selectionRing.setPosition(wx, wy)
      this.selectionRingOuter.setPosition(wx, wy)
      this.selectionRingCurrentPos = { x: wx, y: wy }
    }

    // -----------------------------------------------------------------------
    // Inner ring: solid circle + corner brackets
    // -----------------------------------------------------------------------
    const innerG = this.selectionRing
    innerG.clear()
    innerG.setVisible(true)
    innerG.setAlpha(1)
    innerG.setScale(1)

    // Inner solid ring
    innerG.lineStyle(2.5, primaryColor, 0.9)
    innerG.strokeCircle(0, 0, 36)

    // Corner brackets (L-shapes) at the bounding box corners — "targeting" feel
    const bx = 32  // half-width of bounding box
    const by = 32  // half-height
    const bl = 10  // bracket arm length
    const bw = 2   // bracket line width

    const brackets: Array<[[number, number, number, number], [number, number, number, number]]> = [
      [[-bx, -by + bl, -bx, -by], [-bx, -by, -bx + bl, -by]],   // top-left
      [[bx - bl, -by, bx, -by],   [bx, -by, bx, -by + bl]],      // top-right
      [[bx, by - bl, bx, by],     [bx, by, bx - bl, by]],        // bottom-right
      [[-bx + bl, by, -bx, by],   [-bx, by, -bx, by - bl]],      // bottom-left
    ]

    innerG.lineStyle(bw, primaryColor, 1)
    for (const [seg1, seg2] of brackets) {
      innerG.beginPath()
      innerG.moveTo(seg1[0], seg1[1])
      innerG.lineTo(seg1[2], seg1[3])
      innerG.strokePath()
      innerG.beginPath()
      innerG.moveTo(seg2[0], seg2[1])
      innerG.lineTo(seg2[2], seg2[3])
      innerG.strokePath()
    }

    // -----------------------------------------------------------------------
    // Outer ring: dashed appearance via arc segments (rotates via tween)
    // -----------------------------------------------------------------------
    const outerG = this.selectionRingOuter
    outerG.clear()
    outerG.setVisible(true)
    outerG.setAlpha(0.55)
    outerG.setScale(1)
    outerG.setAngle(0)

    // Draw 8 arc segments to simulate a dashed circle
    const outerRadius = 46
    const segments = 8
    const gapFraction = 0.35  // fraction of each segment that is a gap
    const arcPerSeg = (Math.PI * 2) / segments
    const drawArc = arcPerSeg * (1 - gapFraction)

    outerG.lineStyle(1.5, lightColor, 1)
    for (let i = 0; i < segments; i++) {
      const startAngle = i * arcPerSeg
      outerG.beginPath()
      outerG.arc(0, 0, outerRadius, startAngle, startAngle + drawArc, false)
      outerG.strokePath()
    }

    // -----------------------------------------------------------------------
    // Kill all existing animation tweens before creating fresh ones
    // -----------------------------------------------------------------------
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    if (this.selectionRingRotateTween) { this.selectionRingRotateTween.destroy(); this.selectionRingRotateTween = null }
    if (this.selectionRingBreatheTween) { this.selectionRingBreatheTween.destroy(); this.selectionRingBreatheTween = null }

    // Alpha pulse on inner ring
    this.selectionRingTween = this.tweens.add({
      targets: innerG,
      alpha: 0.5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Slow rotation on outer dashed ring
    this.selectionRingRotateTween = this.tweens.add({
      targets: outerG,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
    })

    // Breathing scale pulse on both rings together
    this.selectionRingBreatheTween = this.tweens.add({
      targets: [innerG, outerG],
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Remove the selection ring and stop all its animations */
  private clearSelectionRing(): void {
    if (this.selectionRingPosTween) { this.selectionRingPosTween.destroy(); this.selectionRingPosTween = null }
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    if (this.selectionRingRotateTween) { this.selectionRingRotateTween.destroy(); this.selectionRingRotateTween = null }
    if (this.selectionRingBreatheTween) { this.selectionRingBreatheTween.destroy(); this.selectionRingBreatheTween = null }
    this.selectionRingCurrentPos = null
    this.selectionRing?.clear()
    this.selectionRing?.setVisible(false)
    this.selectionRingOuter?.clear()
    this.selectionRingOuter?.setVisible(false)
  }

  /** Smoothly pan the camera to center on world coords (uses lerp follow) */
  private kbPanCameraTo(wx: number, wy: number): void {
    this.followTarget = { x: wx, y: wy }
  }

  /** Smoothly adjust zoom level (syncs with lerp-based targetZoom) */
  private kbSmoothZoom(delta: number): void {
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, this.getMinZoom(), ZOOM_MAX)
    this.followTarget = null
  }

  /** Zoom camera to fit all rooms (delegates to smooth zoomToFit) */
  private zoomToFitAll(): void {
    this.zoomToFit(true)
  }

  /** Reset camera to the default position/zoom (uses lerp system) */
  private resetCamera(): void {
    this.targetZoom = this.defaultCameraZoom
    this.followTarget = {
      x: this.defaultCameraX + this.viewWidth / (2 * this.defaultCameraZoom),
      y: this.defaultCameraY + this.viewHeight / (2 * this.defaultCameraZoom),
    }
    this.deselectAgent()
    this.stopAutoPan()
  }

  /** Toggle slow auto-pan that cycles the camera across all agents */
  private toggleAutoPan(): void {
    if (this.autoPanEnabled) {
      this.stopAutoPan()
    } else {
      this.startAutoPan()
    }
  }

  private startAutoPan(): void {
    const ids = this.getFlatAgentIds()
    if (ids.length === 0) return

    this.autoPanEnabled = true
    this.autoPanIndex = this.selectedAgentIndex >= 0 ? this.selectedAgentIndex : 0

    // Immediately show first agent
    this.selectedAgentIndex = this.autoPanIndex
    this.applySelection(ids)

    this.autoPanTimer = this.time.addEvent({
      delay: KB_AUTO_PAN_INTERVAL,
      loop: true,
      callback: () => {
        const currentIds = this.getFlatAgentIds()
        if (currentIds.length === 0) { this.stopAutoPan(); return }
        this.autoPanIndex = (this.autoPanIndex + 1) % currentIds.length
        this.selectedAgentIndex = this.autoPanIndex
        this.applySelection(currentIds)
      },
    })
  }

  private stopAutoPan(): void {
    this.autoPanEnabled = false
    if (this.autoPanTimer) {
      this.autoPanTimer.destroy()
      this.autoPanTimer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Help overlay
  // ---------------------------------------------------------------------------

  private showHelpOverlay(): void {
    if (this.helpOverlay) return
    this.helpVisible = true

    const { width, height } = this.scale
    const PW = 280
    const PH = 310

    const container = this.add.container(0, 0)
    container.setDepth(9999)
    container.setScrollFactor(0)

    // Backdrop: full-viewport semi-transparent dark rect, screen-space
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0)
    container.add(backdrop)

    // Panel background with rounded corners and border
    const panelX = width / 2
    const panelY = height / 2
    const panelGfx = this.add.graphics()
    panelGfx.fillStyle(0x0f172a, 1)
    panelGfx.fillRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 10)
    panelGfx.lineStyle(1, 0x334155, 1)
    panelGfx.strokeRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 10)
    container.add(panelGfx)

    // Title
    container.add(
      this.add
        .text(panelX, panelY - PH / 2 + 18, 'Keyboard Shortcuts', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f1f5f9',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0),
    )

    // Divider line beneath title
    const divider = this.add.graphics()
    divider.lineStyle(1, 0x334155, 0.6)
    divider.lineBetween(panelX - PW / 2 + 16, panelY - PH / 2 + 36, panelX + PW / 2 - 16, panelY - PH / 2 + 36)
    container.add(divider)

    // Shortcut rows: [key label, description]
    const shortcuts: [string, string][] = [
      ['TAB',     'Cycle agents'],
      ['ENTER',   'Open agent'],
      ['ESC',     'Deselect'],
      ['F',       'Zoom to fit'],
      ['R',       'Reset camera'],
      ['SPACE',   'Auto-pan'],
      ['+  /  -', 'Zoom in / out'],
      ['1 - 9',   'Jump to agent'],
      ['H  /  ?', 'This help'],
      ['`',       'Debug overlay'],
    ]

    const rowH   = 22
    const startY = panelY - PH / 2 + 46
    const keyX   = panelX - PW / 2 + 20
    const descX  = panelX - PW / 2 + 110

    for (let i = 0; i < shortcuts.length; i++) {
      const [key, desc] = shortcuts[i]
      const rowY = startY + i * rowH
      container.add(
        this.add.text(keyX, rowY, key, { fontSize: '10px', color: '#64748b', fontFamily: 'monospace', fontStyle: 'bold' }).setScrollFactor(0),
      )
      container.add(
        this.add.text(descX, rowY, desc, { fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }).setScrollFactor(0),
      )
    }

    // Dismiss hint at bottom of panel
    container.add(
      this.add
        .text(panelX, panelY + PH / 2 - 12, 'Press H or ESC to dismiss', {
          fontSize: '9px',
          color: '#475569',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 1)
        .setScrollFactor(0),
    )

    container.setAlpha(0)
    this.helpOverlay = container

    // Fade in over 200ms
    this.tweens.add({ targets: container, alpha: 1, duration: 200, ease: 'Quad.easeOut' })
  }

  private hideHelpOverlay(): void {
    if (!this.helpOverlay) return
    this.helpVisible = false
    const overlay = this.helpOverlay
    this.helpOverlay = null
    // Fade out then destroy
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => { try { overlay.destroy() } catch { /* already gone */ } },
    })
  }

  // ---------------------------------------------------------------------------
  // Debug overlay (backtick toggle)
  // ---------------------------------------------------------------------------

  private toggleDebugOverlay(): void {
    if (this.debugOverlayVisible) {
      this.hideDebugOverlay()
    } else {
      this.showDebugOverlay()
    }
  }

  private showDebugOverlay(): void {
    this.debugOverlayVisible = true

    // HUD text panel (screen-space)
    const container = this.add.container(0, 0).setDepth(11000).setScrollFactor(0)
    this.debugOverlayContainer = container

    const panelGfx = this.add.graphics()
    panelGfx.fillStyle(0x000000, 0.75)
    panelGfx.fillRoundedRect(8, this.viewHeight - 88, 210, 80, 6)
    panelGfx.lineStyle(1, 0x3b82f6, 0.5)
    panelGfx.strokeRoundedRect(8, this.viewHeight - 88, 210, 80, 6)
    container.add(panelGfx)

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '10px', fontFamily: 'monospace', color: '#34d399', resolution: 2,
    }
    this.debugFpsText = this.add.text(16, this.viewHeight - 82, 'FPS: --', textStyle).setScrollFactor(0)
    this.debugObjectCountText = this.add.text(16, this.viewHeight - 68, 'Objects: --', textStyle).setScrollFactor(0)
    const navStats = this.navMesh.getStats()
    const navText = this.add.text(16, this.viewHeight - 54, `NavMesh: ${navStats.walkable}/${navStats.total} walkable`, { ...textStyle, color: '#60a5fa' }).setScrollFactor(0)
    const roomText = this.add.text(16, this.viewHeight - 40, `Rooms: ${this.rooms.size}  Agents: ${this.agents.length}`, { ...textStyle, color: '#94a3b8' }).setScrollFactor(0)
    const hintText = this.add.text(16, this.viewHeight - 26, 'Press ` to dismiss', { ...textStyle, color: '#475569', fontSize: '9px' }).setScrollFactor(0)
    container.add([this.debugFpsText, this.debugObjectCountText, navText, roomText, hintText])

    // Nav mesh world-space overlays
    this.debugNavMeshGfx = this.add.graphics().setDepth(50).setAlpha(0.3)
    this.debugPathGfx = this.add.graphics().setDepth(51)
    this.drawNavMeshDebug()

    // Dump scene graph to console
    this.dumpSceneGraph()

    this.showToast('Debug overlay ON', 'info')
  }

  private hideDebugOverlay(): void {
    this.debugOverlayVisible = false
    if (this.debugOverlayContainer) { this.debugOverlayContainer.destroy(); this.debugOverlayContainer = null }
    this.debugFpsText = null
    this.debugObjectCountText = null
    if (this.debugNavMeshGfx) { this.debugNavMeshGfx.destroy(); this.debugNavMeshGfx = null }
    if (this.debugPathGfx) { this.debugPathGfx.destroy(); this.debugPathGfx = null }
    this.showToast('Debug overlay OFF', 'info')
  }

  private refreshDebugOverlay(_time: number, delta: number): void {
    const fps = Math.round(1000 / Math.max(delta, 1))
    if (this.debugFpsText) this.debugFpsText.setText(`FPS: ${fps}  (${delta.toFixed(1)}ms)`)

    // Count all display list objects across the scene
    let objectCount = 0
    try { objectCount = this.children.length } catch { /* noop */ }
    if (this.debugObjectCountText) this.debugObjectCountText.setText(`Objects: ${objectCount}`)

    // Redraw active paths on nav mesh debug layer
    if (this.debugPathGfx) {
      this.debugPathGfx.clear()
      this.debugPathGfx.lineStyle(2, 0xfbbf24, 0.8)
      for (const room of this.rooms.values()) {
        for (const ws of room.workstations.values()) {
          if (ws.onCoffeeRun && ws.sprite) {
            // Draw the agent's current world position as a small marker
            const wx = room.x + ws.container.x
            const wy = room.y + ws.container.y
            this.debugPathGfx.fillStyle(0xfbbf24, 0.9)
            this.debugPathGfx.fillCircle(wx, wy, 3)
          }
        }
      }
    }
  }

  private drawNavMeshDebug(): void {
    if (!this.debugNavMeshGfx) return
    const g = this.debugNavMeshGfx
    g.clear()

    const stats = this.navMesh.getStats()
    if (stats.total === 0) return

    // Use the navMesh's public API to check walkability cell-by-cell
    // We reconstruct the grid bounds from the navMesh stats and known origin
    // Since NavMesh doesn't expose origin directly, sample the walkable area
    // by iterating over the world bounds we know about
    const cellSize = 12 // matches CELL_SIZE in nav-mesh.ts
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of this.rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2 - 60)
      minY = Math.min(minY, room.y - room.height / 2 - 60)
      maxX = Math.max(maxX, room.x + room.width / 2 + 60)
      maxY = Math.max(maxY, room.y + room.height / 2 + 60)
    }
    if (this.cafe) {
      const cb = this.cafe.getBounds()
      if (cb) {
        minX = Math.min(minX, cb.x - 40)
        minY = Math.min(minY, cb.y - 40)
        maxX = Math.max(maxX, cb.x + cb.w + 40)
        maxY = Math.max(maxY, cb.y + cb.h + 40)
      }
    }

    // Draw walkable cells as green, sample every cellSize
    for (let wy = minY; wy <= maxY; wy += cellSize) {
      for (let wx = minX; wx <= maxX; wx += cellSize) {
        if (this.navMesh.isPointWalkable(wx, wy)) {
          g.fillStyle(0x22c55e, 0.25)
          g.fillRect(wx - cellSize / 2, wy - cellSize / 2, cellSize, cellSize)
        }
      }
    }
  }

  private dumpSceneGraph(): void {
    const summary: Record<string, number> = {}
    this.children.each((child: Phaser.GameObjects.GameObject) => {
      const type = child.type || (child.constructor as { name?: string }).name || 'Unknown'
      summary[type] = (summary[type] || 0) + 1
    })
    console.group('%c[OfficeScene Debug] Scene Graph', 'color: #34d399; font-weight: bold')
    console.log('Total objects:', this.children.length)
    console.table(summary)
    console.log('Rooms:', this.rooms.size)
    console.log('Agents:', this.agents.length)
    console.log('NavMesh:', this.navMesh.getStats())
    console.log('Camera:', {
      scrollX: this.cameras.main.scrollX.toFixed(1),
      scrollY: this.cameras.main.scrollY.toFixed(1),
      zoom: this.cameras.main.zoom.toFixed(3),
    })
    console.groupEnd()
  }

  // ---------------------------------------------------------------------------
  // Focus mode
  // ---------------------------------------------------------------------------

  public enterFocusMode(agentId: string): void {
    if (this.focusedAgentId === agentId) return
    if (this.focusedAgentId !== null) this.exitFocusMode()
    this.focusedAgentId = agentId
    let targetWs: WorkstationSprite | null = null
    let worldPos: { x: number; y: number } | null = null
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) { targetWs = ws; worldPos = { x: room.x + ws.container.x, y: room.y + ws.container.y }; break }
    }
    if (!targetWs || !worldPos) { this.focusedAgentId = null; return }
    this.focusedWorkstationPrevDepth = targetWs.container.depth
    targetWs.container.setDepth(100)
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 1)
    overlay.fillRect(-4000, -4000, 8000, 8000)
    overlay.setAlpha(0).setDepth(50)
    this.focusDimOverlay = overlay
    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }
    this.focusDimTween = this.tweens.add({ targets: overlay, alpha: 0.4, duration: 300, ease: 'Quad.easeOut' })
    this.targetZoom = 1.8
    this.followTarget = { x: worldPos.x, y: worldPos.y }
  }

  public exitFocusMode(): void {
    if (this.focusedAgentId === null) return
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(this.focusedAgentId)
      if (ws) { ws.container.setDepth(this.focusedWorkstationPrevDepth ?? 0); break }
    }
    this.focusedWorkstationPrevDepth = null
    this.focusedAgentId = null
    const overlay = this.focusDimOverlay
    this.focusDimOverlay = null
    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }
    if (overlay) {
      this.tweens.add({
        targets: overlay, alpha: 0, duration: 250, ease: 'Quad.easeIn',
        onComplete: () => { try { overlay.destroy() } catch { /* gone */ } },
      })
    }
    this.zoomToFit(true)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (this.resizeTimer) { clearTimeout(this.resizeTimer); this.resizeTimer = null }

    // PA system broadcast banner cleanup
    this._destroyBroadcastBanner()
    if (this.broadcastHandler) {
      EventBus.off(EVENTS.BROADCAST, this.broadcastHandler)
      this.broadcastHandler = null
    }

    // Focus mode cleanup
    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }
    if (this.focusDimOverlay) { this.focusDimOverlay.destroy(); this.focusDimOverlay = null }
    this.focusedAgentId = null
    this.focusedWorkstationPrevDepth = null

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

    // Minimap cleanup
    this.minimapHitZone?.destroy()
    this.minimapGraphics?.destroy()
    this.minimapViewport?.destroy()
    this.minimapContainer?.destroy()
    this.minimapHitZone = null
    this.minimapGraphics = null
    this.minimapViewport = null
    this.minimapContainer = null
    this.minimapProjection = null
    this.minimapPanning = false
    this.minimapRoomFlashes.clear()
    this.minimapHoverLabel?.destroy()
    this.minimapHoverLabel = null
    this.minimapHoverBg?.destroy()
    this.minimapHoverBg = null
    this.minimapHoverLine?.destroy()
    this.minimapHoverLine = null

    // Keyboard selection cleanup
    this.stopAutoPan()
    if (this.selectionRingPosTween) { this.selectionRingPosTween.destroy(); this.selectionRingPosTween = null }
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    if (this.selectionRingRotateTween) { this.selectionRingRotateTween.destroy(); this.selectionRingRotateTween = null }
    if (this.selectionRingBreatheTween) { this.selectionRingBreatheTween.destroy(); this.selectionRingBreatheTween = null }
    this.selectionRingCurrentPos = null
    this.selectionRing?.destroy()
    this.selectionRing = null
    this.selectionRingOuter?.destroy()
    this.selectionRingOuter = null

    // atmosphere.destroy() already handled ceiling lights, exterior lights,
    // wall clock, window glint, starfield, clouds, day/night overlay

    for (const t of this.decoTweens) { try { t.destroy() } catch { /* gone */ } }
    this.decoTweens = []
    if (this.waterCoolerBubbleTimer) { this.waterCoolerBubbleTimer.destroy(); this.waterCoolerBubbleTimer = null }
    if (this.ambientActivityTimer) { this.ambientActivityTimer.destroy(); this.ambientActivityTimer = null }
    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    if (this.whiteboardContainer) {
      this.whiteboardContainer.destroy()
      this.whiteboardContainer = null
      this.whiteboardTexts = []
    }
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    this.teamAreaGraphics?.destroy()
    this.teamAreaGraphics = null
    this.corridorGraphics?.destroy()
    this.corridorGraphics = null
    this.hallwayIndicatorGraphics?.destroy()
    this.hallwayIndicatorGraphics = null
    this.floorArrowGfx?.destroy()
    this.floorArrowGfx = null
    this.corridorSegments = []
    for (const t of this.corridorSignTexts) t.destroy()
    this.corridorSignTexts = []
    this.officeGraphics?.destroy()
    this.officeGraphics = null
    this.tripletGraphics?.destroy()
    this.tripletGraphics = null
    if (this.flagContainer) {
      this.tweens.killTweensOf(this.flagContainer)
      this.flagContainer.destroy(true)
      this.flagContainer = null
    }

    // Chat animation cleanup
    for (const anim of this.chatAnimations) {
      try { anim.dot.destroy() } catch { /* already gone */ }
    }
    this.chatAnimations = []
    this.chatLineGraphics?.destroy()
    this.chatLineGraphics = null

    // Help overlay cleanup
    if (this.helpOverlay) { this.tweens.killTweensOf(this.helpOverlay); this.helpOverlay.destroy(); this.helpOverlay = null }
    this.helpVisible = false

    for (const room of this.rooms.values()) {
      this.destroyRoom(room)
    }
    this.rooms.clear()
  }

  // ---------------------------------------------------------------------------
  // Ambient office-life activity effects
  // ---------------------------------------------------------------------------

  private scheduleNextAmbientActivity(): void {
    // Pick a random delay between 8 and 15 seconds
    const delay = 8000 + Math.random() * 7000
    this.ambientActivityTimer = this.time.delayedCall(delay, () => {
      this.tickAmbientActivity()
      this.scheduleNextAmbientActivity()
    })
  }

  private tickAmbientActivity(): void {
    if (this.cameras.main.zoom <= LOD_L1_MAX) return
    if (this.rooms.size === 0) return

    const allWorkstations: { ws: WorkstationSprite; room: Room }[] = []
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        allWorkstations.push({ ws, room })
      }
    }
    if (allWorkstations.length === 0) return

    const pick = (arr: { ws: WorkstationSprite; room: Room }[]) =>
      arr[Math.floor(Math.random() * arr.length)]
    const allRooms = Array.from(this.rooms.values())

    const eventType = Math.floor(Math.random() * 5)

    switch (eventType) {
      case 0: this.ambientPaperAirplane(allWorkstations, pick); break
      case 1: this.ambientCoffeeRefill(allWorkstations, pick); break
      case 2: this.ambientPhoneRing(allWorkstations, pick); break
      case 3: this.ambientPrinterNoise(); break
      case 4: this.ambientDoorPeek(allRooms); break
    }
  }

  // (a) Paper airplane — tiny triangle glides in a parabolic arc between two workstations
  private ambientPaperAirplane(
    allWorkstations: { ws: WorkstationSprite; room: Room }[],
    pick: (arr: { ws: WorkstationSprite; room: Room }[]) => { ws: WorkstationSprite; room: Room },
  ): void {
    if (allWorkstations.length < 2) return
    const fromEntry = pick(allWorkstations)
    let toEntry = pick(allWorkstations)
    let attempts = 0
    while (toEntry.ws === fromEntry.ws && attempts++ < 6) {
      toEntry = pick(allWorkstations)
    }
    if (toEntry.ws === fromEntry.ws) return

    const fromX = fromEntry.room.x + fromEntry.ws.container.x
    const fromY = fromEntry.room.y + fromEntry.ws.container.y - 10
    const toX   = toEntry.room.x + toEntry.ws.container.x
    const toY   = toEntry.room.y + toEntry.ws.container.y - 10

    const plane = this.add.graphics()
    plane.fillStyle(0xf8fafc, 0.2)
    plane.fillTriangle(0, -3, 5, 3, -5, 3)
    plane.setPosition(fromX, fromY)
    plane.setDepth(50)

    // Control point for the quadratic Bezier arc — raised above the midpoint
    const midX = (fromX + toX) / 2
    const midY = Math.min(fromY, toY) - 40 - Math.random() * 20

    this.tweens.add({
      targets: plane,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.progress
        const inv = 1 - t
        plane.x = inv * inv * fromX + 2 * inv * t * midX + t * t * toX
        plane.y = inv * inv * fromY + 2 * inv * t * midY + t * t * toY
        if (t > 0.01) {
          const dx = 2 * inv * (midX - fromX) + 2 * t * (toX - midX)
          const dy = 2 * inv * (midY - fromY) + 2 * t * (toY - midY)
          plane.setRotation(Math.atan2(dy, dx) - Math.PI / 2)
        }
      },
      onComplete: () => {
        try { plane.destroy() } catch { /* already gone */ }
      },
    })
  }

  // (b) Coffee refill — faster burst of steam puffs at a random idle desk
  private ambientCoffeeRefill(
    allWorkstations: { ws: WorkstationSprite; room: Room }[],
    pick: (arr: { ws: WorkstationSprite; room: Room }[]) => { ws: WorkstationSprite; room: Room },
  ): void {
    const idleEntries = allWorkstations.filter(e => e.ws.lastAnimMode === 'idle' && e.ws.steamContainer)
    const pool = idleEntries.length > 0 ? idleEntries : allWorkstations
    const { ws } = pick(pool)
    if (!ws.steamContainer) return

    const container = ws.steamContainer
    for (let i = 0; i < 3; i++) {
      const xOff = (i - 1) * 2.5 + (Math.random() - 0.5)
      const particle = this.add.circle(xOff, 0, 1.5, 0xffffff, 0.5)
      container.add(particle)
      this.tweens.add({
        targets: particle,
        y: -10 - Math.random() * 5,
        alpha: 0,
        duration: 600,
        delay: i * 120,
        ease: 'Sine.easeOut',
        onComplete: () => {
          try { container.remove(particle, true) } catch { /* already gone */ }
        },
      })
    }
  }

  // (c) Phone ring — rapid 3-blink animation on a random desk phone light
  private ambientPhoneRing(
    allWorkstations: { ws: WorkstationSprite; room: Room }[],
    pick: (arr: { ws: WorkstationSprite; room: Room }[]) => { ws: WorkstationSprite; room: Room },
  ): void {
    const withPhone = allWorkstations.filter(e => e.ws.phoneLight)
    if (withPhone.length === 0) return
    const { ws } = pick(withPhone)
    const light = ws.phoneLight!
    const origAlpha = light.alpha
    const origColor = light.fillColor

    let blinks = 0
    const doBlink = () => {
      if (blinks >= 6) {
        light.setAlpha(origAlpha)
        light.setFillStyle(origColor)
        return
      }
      const on = blinks % 2 === 0
      light.setAlpha(on ? 0.95 : 0.1)
      light.setFillStyle(on ? 0x60a5fa : origColor)
      blinks++
      this.time.delayedCall(100, doBlink)
    }
    doBlink()
  }

  // (d) Printer noise — a tiny paper strip slides out of the printer sprite location
  private ambientPrinterNoise(): void {
    const PAD    = 30
    const WALL_T = 5
    const bx = WORLD_MARGIN - PAD
    const by = WORLD_MARGIN - PAD
    const bw = this.worldWidth  - WORLD_MARGIN + PAD * 2
    const bh = this.worldHeight - WORLD_MARGIN + PAD * 2
    const fx = bx + WALL_T
    const fy = by + WALL_T
    const fw = bw - WALL_T * 2
    const fh = bh - WALL_T * 2

    if (fw <= 280 || fh <= 140) return

    const printerX = fx + fw - 22
    const printerY = fy + fh / 2

    const paper = this.add.rectangle(printerX, printerY, 4, 1, 0xf8fafc)
    paper.setAlpha(0.6)
    paper.setDepth(10)

    this.tweens.add({
      targets: paper,
      x: printerX - 18,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: paper,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            try { paper.destroy() } catch { /* already gone */ }
          },
        })
      },
    })
  }

  // (e) Door peek — briefly squish a random room door suggesting someone peeked in
  private ambientDoorPeek(allRooms: Room[]): void {
    if (allRooms.length === 0) return
    const room = allRooms[Math.floor(Math.random() * allRooms.length)]
    const door = room.doorGraphics
    if (!door) return

    this.tweens.add({
      targets: door,
      scaleX: 0.7,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.tweens.add({
          targets: door,
          scaleX: 1,
          duration: 220,
          ease: 'Sine.easeOut',
        })
      },
    })
  }
}
