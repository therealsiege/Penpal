import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState, OpencodeSession } from '../types'
import { XP_RANKS, getXPForLevel } from '../types'
import { activeTheme, setActiveTheme, lerpColor, THEMES, type ThemeName } from './office-theme'
import { NavMesh, type NavPoint } from './nav-mesh'

// Keyboard shortcut constants
const KB_ZOOM_STEP = 0.15
const KB_ZOOM_DURATION = 200
const KB_PAN_DURATION = 400
const KB_AUTO_PAN_INTERVAL = 3000

// ---------------------------------------------------------------------------
// Spritesheet constants
// ---------------------------------------------------------------------------

const CHAR_FRAME_W = 256
const CHAR_FRAME_H = 512
const CHAR_COLS    = 6
const NUM_CHARS    = 3  // Character 1, Character 2, Character 1 tinted

const POSE_IDLE     = 0
const POSE_INTERACT = 1
const POSE_SIT      = 2
const POSE_SURPRISE = 3
const POSE_HURT     = 4
const POSE_WALK     = 5

// Compact spritesheet frame map (duder-compact / duder-compact-2)
// Row 1: idle(4 rotations) + walk(12 rotations) + sit(1) = 17 frames
// Rotation order: front, 3/4-right, side-right, back-right, back, back-left, side-left, 3/4-left, ...
const COMPACT_COLS = 17
const COMPACT_IDLE_START    = 0   // 4 frames: front, 3/4, side, back
const COMPACT_WALK_START    = 4   // 12 frames: full rotation walk cycle
const COMPACT_SIT_START     = 16  // 1 frame
// Walk rotation indices (offset from COMPACT_WALK_START)
// Step A (first walk pose): 8 directions
const WALK_A_FRONT     = 0
const WALK_A_FRONT_R   = 1
const WALK_A_SIDE_R    = 2
const WALK_A_BACK_R    = 3
const WALK_A_BACK      = 4
const WALK_A_BACK_L    = 5
const WALK_A_SIDE_L    = 6
const WALK_A_FRONT_L   = 7
// Step B (alternate walk pose): 4 key directions
const WALK_B_FRONT     = 8
const WALK_B_FRONT_R   = 9
const WALK_B_SIDE_R    = 10
const WALK_B_BACK_R    = 11

const OFFICE_TILE_SIZE = 48
const FRAME_CHAIR_DARK   = 112
const FRAME_MONITOR      = 122

const ROOM_TILE_SIZE = 48

// Office decoration frame indices
const OFFICE_FRAME_PLANT      = 68
const OFFICE_FRAME_PLANT_SM  = 53
const OFFICE_FRAME_PICTURE    = 64
const OFFICE_FRAME_PICTURE2   = 65
const OFFICE_FRAME_PICTURE3   = 66
const OFFICE_FRAME_BOOKSHELF  = 96
// Additional decorations
const OFFICE_FRAME_PLANT_TALL    = 54
const OFFICE_FRAME_CACTUS       = 55
const OFFICE_FRAME_HANGING_PLANT = 67
const OFFICE_FRAME_FERN         = 69
const OFFICE_FRAME_MONSTERA     = 70
const OFFICE_FRAME_CLOCK        = 63
const OFFICE_FRAME_LAMP         = 115
const OFFICE_FRAME_TRASH        = 119
const OFFICE_FRAME_STORAGE      = 97
const OFFICE_FRAME_FILE_CABINET = 98
const OFFICE_FRAME_WATER_COOLER = 120
const OFFICE_FRAME_WHITEBOARD   = 94
const OFFICE_FRAME_MONITOR      = 122
const OFFICE_FRAME_SOFA         = 102
const OFFICE_FRAME_PRINTER      = 126

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHAR_SCALE      = 0.134
const WORKSTATION_W   = 70 // ~20% tighter office footprint
const WORKSTATION_H   = 77 // ~20% tighter office footprint
const ROOM_PADDING    = 12
const ROOM_TOP_EXTRA  = 30   // extra top padding so thought bubbles clear room headers
const ROOM_HEADER_H   = 20
const ROOM_GAP        = 18
const MAX_AGENTS_PER_ROW = 4
const TEAM_AREA_PAD_X = 18
const TEAM_AREA_PAD_Y = 18
const TEAM_AREA_GAP_X = 28
const TEAM_AREA_GAP_Y = 40
const TEAM_LABEL_H = 16

const WS_CHAIR_Y    = 6
const WS_SPRITE_Y   = -5
const WS_DESK_Y     = 18
const WS_MONITOR_Y  = 5
const WS_NAME_Y     = 40
const WS_DOT_GAP    = 4
const IDLE_WALK_BREAK_MIN_MS = 9000
const IDLE_WALK_BREAK_VAR_MS = 7000
const IDLE_WALK_RANGE_X = 20

// Colors
const COLOR_BG          = 0x111827
const COLOR_ROOM_FLOOR  = 0x1e293b
const COLOR_ROOM_FLOOR2 = 0x334155
const COLOR_WALL        = 0x334155
const COLOR_WALL_INNER  = 0x475569
const COLOR_DESK_BODY   = 0x475569
const COLOR_DESK_TOP    = 0x64748b
const COLOR_HEADER_BG   = 0x0f172a
const COLOR_DOOR_FRAME  = 0x3b82f6
const COLOR_POD_EDGE    = 0x64748b
const COLOR_POD_GROOVE  = 0x0f172a
const COLOR_VIGNETTE    = 0x000000
const COLOR_DOOR_FILL   = 0x0f172a
const COLOR_DOOR_ACCENT = 0x3b82f6
const COLOR_LED_GREEN   = 0x34d399
const COLOR_LED_AMBER   = 0xfbbf24
const COLOR_LED_GRAY    = 0x64748b

const WORLD_MARGIN   = 30

// Camera & navigation constants
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.0
const ZOOM_FIT_MAX = 1.14
const ZOOM_LERP_SPEED = 0.08
const FOLLOW_LERP_SPEED = 0.06
// LOD thresholds — zoom boundaries between 3 detail levels
// Level 1 (zoom < LOD_L1_MAX): building overview — rooms as colored rects only
// Level 2 (LOD_L1_MAX..LOD_L2_MAX): room view — agents + desks, no micro-accessories
// Level 3 (zoom > LOD_L2_MAX): full detail — all accessories, particles, monitor content
const LOD_L1_MAX = 0.5
const LOD_L2_MAX = 0.85
const MINIMAP_W = 160
const MINIMAP_H = 100
const MINIMAP_MARGIN = 12
const MINIMAP_BG = 0x0f172a
const MINIMAP_ROOM_COLOR = 0x334155
const MINIMAP_VIEWPORT_COLOR = 0x3b82f6
const MINIMAP_REFRESH_MS = 120
const TRIPLET_REFRESH_MS = 90
const AMBIENT_MOTE_POOL_SIZE = 26

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface WorkstationSprite {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  nameText: Phaser.GameObjects.Text
  statusDot: Phaser.GameObjects.Arc
  roleBadge: Phaser.GameObjects.Text | null
  deskBody: Phaser.GameObjects.Rectangle
  deskTop: Phaser.GameObjects.Rectangle
  monitorSprite: Phaser.GameObjects.Sprite | null
  chairSprite: Phaser.GameObjects.Sprite | null
  monitorGlowOverlay?: Phaser.GameObjects.Arc
  screenLines?: Phaser.GameObjects.Graphics
  monitorText?: Phaser.GameObjects.Text
  monitorTextTween?: Phaser.Tweens.Tween
  thoughtBubble: Phaser.GameObjects.Container
  thoughtBubbleText: Phaser.GameObjects.Text
  thoughtBubbleBg: Phaser.GameObjects.Graphics
  blockedIndicator: Phaser.GameObjects.Container
  blockedIndicatorPulse: Phaser.GameObjects.Arc
  blockedIndicatorBadge: Phaser.GameObjects.Arc
  blockedIndicatorStem: Phaser.GameObjects.Rectangle
  blockedIndicatorText: Phaser.GameObjects.Text
  state: AgentState | null
  breathTween?: Phaser.Tweens.Tween
  bounceTween?: Phaser.Tweens.Tween
  dotPulseTween?: Phaser.Tweens.Tween
  monitorGlowTween?: Phaser.Tweens.Tween
  screenTween?: Phaser.Tweens.Tween
  typingTween?: Phaser.Tweens.Tween
  headTiltTween?: Phaser.Tweens.Tween
  pulseTween?: Phaser.Tweens.Tween
  steamTweens?: Phaser.Tweens.Tween[]
  steamContainer?: Phaser.GameObjects.Container
  lastAnimMode?: 'idle' | 'working' | 'waiting'
  lastStateFingerprint?: string
  /** Level 2+: shown at room-level zoom (agents, desks, status dots, name tags) */
  lodLevel2Objects: Phaser.GameObjects.GameObject[]
  /** Level 3 only: shown at full-detail zoom (accessories, lamps, mugs, ledGlow, monitorText, moodEmoji) */
  lodLevel3Objects: Phaser.GameObjects.GameObject[]
  lookAroundTimer?: Phaser.Time.TimerEvent
  stretchTimer?: Phaser.Time.TimerEvent
  walkBreakTimer?: Phaser.Time.TimerEvent
  walkBreakTween?: Phaser.Tweens.Tween
  lookAtNeighborTimer?: Phaser.Time.TimerEvent
  yawnTimer?: Phaser.Time.TimerEvent
  blockedIndicatorTween?: Phaser.Tweens.Tween
  ledGlow?: Phaser.GameObjects.Graphics
  ledPulseTween?: Phaser.Tweens.Tween
  lastShownBlurb?: string
  blurbFadeTimer?: Phaser.Time.TimerEvent
  thoughtBubbleFloatTween?: Phaser.Tweens.Tween
  blurbTypingTween?: Phaser.Tweens.Tween
  moodEmoji?: Phaser.GameObjects.Text
  moodTween?: Phaser.Tweens.Tween
  deskPlantTween?: Phaser.Tweens.Tween
  xpBarBg?: Phaser.GameObjects.Rectangle
  xpBarFill?: Phaser.GameObjects.Rectangle
  xpBarText?: Phaser.GameObjects.Text
  xpBarTween?: Phaser.Tweens.Tween
  rippleFired?: boolean
  soundWaveGfx?: Phaser.GameObjects.Graphics
  soundWaveTween?: Phaser.Tweens.Tween
  sparklineGfx?: Phaser.GameObjects.Graphics
  activityHistory?: number[]
  phoneLight?: Phaser.GameObjects.Arc
  phoneLightTween?: Phaser.Tweens.Tween
  progressRing?: Phaser.GameObjects.Graphics
  progressRingTween?: Phaser.Tweens.Tween
  workStartTime?: number
  shadow?: Phaser.GameObjects.Ellipse
  uptimeText?: Phaser.GameObjects.Text
  roleBadgePulseTween?: Phaser.Tweens.Tween
  // Task completion tally — increments each time an agent transitions working→idle
  taskCountText?: Phaser.GameObjects.Text
  taskCountBg?: Phaser.GameObjects.Graphics
  taskCountFlashTween?: Phaser.Tweens.Tween
  localTaskCount: number
  onCoffeeRun?: boolean
}

interface Room {
  cwd: string
  label: string
  teamKey: string
  teamLabel: string
  agents: AgentState[]
  x: number
  y: number
  width: number
  height: number
  container: Phaser.GameObjects.Container
  workstations: Map<string, WorkstationSprite>
  floorGraphics: Phaser.GameObjects.Graphics
  activityBar: Phaser.GameObjects.Rectangle
  activityBarTween: Phaser.Tweens.Tween | null
  waitingBar: Phaser.GameObjects.Rectangle
  waitingBarTween: Phaser.Tweens.Tween | null
  statusLed: Phaser.GameObjects.Arc
  statusLedGlow: Phaser.GameObjects.Arc
  statusLedTween: Phaser.Tweens.Tween | null
  ledMode: 'idle' | 'active' | 'waiting'
  // Animated door
  doorGraphics: Phaser.GameObjects.Graphics
  doorFrameGraphics: Phaser.GameObjects.Graphics
  doorPulseTween: Phaser.Tweens.Tween | null
  prevAgentCount: number
  // Thermal heat overlay — glows warmer as agent activity increases
  heatOverlay?: Phaser.GameObjects.Rectangle
  heatTween?: Phaser.Tweens.Tween
  // Header status strip — 2px bar below accent line, width proportional to active agents
  statusStrip: Phaser.GameObjects.Graphics | null
  statusStripTween: Phaser.Tweens.Tween | null
  // Badge dot pulse tween
  badgeDotTween: Phaser.Tweens.Tween | null
  // Tiled floor texture sprites (very-low-alpha overlays from room-tiles spritesheet)
  floorTileSprites?: Phaser.GameObjects.Sprite[]
  miniWhiteboard?: Phaser.GameObjects.Container
  miniWhiteboardTexts?: Phaser.GameObjects.Text[]
  doorSide: 'top' | 'bottom'
}

// ---------------------------------------------------------------------------
// OfficeScene
// ---------------------------------------------------------------------------

// Triplet workflow info for connecting lines
interface TripletLineInfo {
  workflowId: string
  solverAgentId: string
  reviewerAgentId: string
  executorAgentId: string
  status: string
}

interface TeamAreaLayout {
  teamKey: string
  teamLabel: string
  x: number
  y: number
  width: number
  height: number
  agentCount: number
}

interface MinimapProjection {
  minX: number
  minY: number
  drawW: number
  drawH: number
  scale: number
  pad: number
}

export interface OfficeDebugSnapshot {
  ready: boolean
  roomCount: number
  workstationCount: number
  camera: {
    scrollX: number
    scrollY: number
    zoom: number
  }
  world: {
    width: number
    height: number
  }
}

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
  private cafeContainer: Phaser.GameObjects.Container | null = null
  private cafeBaristas: Phaser.GameObjects.Container[] = []
  private cafeVisitorTimer: Phaser.Time.TimerEvent | null = null
  private cafeSteamTimer: Phaser.Time.TimerEvent | null = null
  private coffeeRunTimer: Phaser.Time.TimerEvent | null = null
  private navMesh = new NavMesh()
  private coffeeRunners: Set<string> = new Set()  // agent IDs currently on coffee run
  private coffeeRunnerRooms: Set<string> = new Set()  // room CWDs with active coffee runners
  private cafeWorldX = 0
  private cafeWorldY = 0
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

  // Typing spark particles
  private typingParticlePool: Phaser.GameObjects.Arc[] = []
  private typingParticleTimer: Phaser.Time.TimerEvent | null = null
  private ambientMotePool: (Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics)[] = []
  private ambientMoteTimer: Phaser.Time.TimerEvent | null = null
  private constellationGfx: Phaser.GameObjects.Graphics | null = null
  // Corridor data-flow particle trail
  private corridorParticlePool: Phaser.GameObjects.Arc[] = []
  private corridorParticleTimer: Phaser.Time.TimerEvent | null = null
  // Window rain effect (night phase only, screen-space)
  private rainDropPool: Phaser.GameObjects.Line[] = []
  private rainActive = false
  // Window snow effect (morning phase only, screen-space)
  private snowPool: Phaser.GameObjects.Arc[] = []
  private snowActive = false
  // Alert ripple pool — sound-wave rings spawned when agents need interaction
  private alertRipplePool: Phaser.GameObjects.Arc[] = []

  // Mouse cursor sparkle trail — subtle fairy-dust effect following pointer movement
  private mouseTrailPool: Phaser.GameObjects.Arc[] = []
  private lastTrailSpawnAt = 0

  // Emoji reaction bubble pool — floating emoji pop-ups on agent state changes
  private emojiReactionPool: Phaser.GameObjects.Text[] = []

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
  private vignetteOverlay: Phaser.GameObjects.Graphics | null = null

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
  private chimeRipplePool: Phaser.GameObjects.Arc[] = []

  // Keyboard shortcut help overlay
  private helpOverlay: Phaser.GameObjects.Container | null = null
  private helpVisible = false

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
    this.windowGlintGfx = this.add.graphics().setDepth(-3.5)
    this.teamAreaGraphics.setDepth(-3)
    this.corridorGraphics.setDepth(-2)
    // Floor arrows: depth -1.5 — between corridors (-2) and hallway indicators (-1)
    this.floorArrowGfx = this.add.graphics().setDepth(-1.5)
    this.chatLineGraphics = this.add.graphics().setDepth(200)
    this.hallwayIndicatorGraphics.setDepth(-1)

    // Sky gradient — deepest background layer, behind stars and clouds
    this.skyGradient = this.add.graphics().setDepth(-11)

    // Starfield background — created before all other world objects
    this.initStarfield()

    // Cloud layer — slow atmospheric drift above/around the building
    this.initCloudLayer()

    // Typing spark particle pool
    this.initParticlePool()
    this.typingParticleTimer = this.time.addEvent({
      delay: 200, callback: () => this.tickParticles(), loop: true,
    })
    this.initAmbientMotePool()
    this.initRainPool()
    this.initSnowPool()
    this.ambientMoteTimer = this.time.addEvent({
      delay: 420,
      callback: () => this.tickAmbientMotes(),
      loop: true,
    })
    this.initCorridorParticlePool()
    this.corridorParticleTimer = this.time.addEvent({
      delay: 300,
      callback: () => this.tickCorridorParticles(),
      loop: true,
    })
    this.initAlertRipplePool()
    this.initChimeRipplePool()
    this.initEmojiReactionPool()
    this.initMouseTrailPool()

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
        if (time - this.lastTrailSpawnAt > 40) {
          this.lastTrailSpawnAt = time
          const wp = cam.getWorldPoint(p.x, p.y)
          const particle = this.mouseTrailPool.find(c => !c.getData('busy'))
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
      this.drawVignetteOverlay()
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
    }

    // Create minimap overlay
    this.initMinimap()
    this.minimapDirty = true

    // Day/night cycle overlay (doesn't block input)
    this.dayNightOverlay = this.add
      .rectangle(0, 0, 8000, 8000, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(9997)
      .setScrollFactor(0)
    this.applyDayNightCycle(false)
    this.vignetteOverlay = this.add.graphics().setDepth(9996).setScrollFactor(0)
    this.drawVignetteOverlay()
    this.dayNightTimer = this.time.addEvent({
      delay: 60_000,
      callback: () => this.applyDayNightCycle(true),
      loop: true,
    })

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
    this.startCoffeeRunTimer()
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

    if (this.rainActive) this.tickRain()
    if (this.snowActive) this.tickSnow(time)
    this.tickWindowGlint(time)
    if (this.starPool.length > 0 && time - this.lastTwinkleAt >= 500) {
      this.lastTwinkleAt = time
      this.tickStarfieldTwinkle()
    }
    this.tickClouds()
    this.tickCeilingLightActivity(time)
    if (this.wallClockContainer && time - this.lastClockTick >= 1000) {
      this.lastClockTick = time
      this.tickWallClock()
    }
    if (this.whiteboardContainer && time - this.lastWhiteboardUpdateAt >= 5000) {
      this.lastWhiteboardUpdateAt = time
      this.updateWhiteboardStats()
    }
    if (time - this.lastShadowUpdateAt >= 5000) {
      this.lastShadowUpdateAt = time
      this.updateShadows()
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
        if (ws.monitorGlowOverlay) {
          const isWorking = ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction
          const isWaiting = ws.state?.needsInteraction
          ws.monitorGlowOverlay.setFillStyle(isWaiting ? t.deskStrokeWaiting : isWorking ? t.monitorGlowActive : t.monitorGlowIdle)
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
      if (maxX > 0) {
        const bgW = maxX + WORLD_MARGIN * 2
        const bgH = maxY + WORLD_MARGIN * 2
        this.drawOfficeBackground(bgW, bgH)
      }
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

    // Destroy any previously created floor tile sprites so they don't accumulate
    // across redraws (resize, theme change, etc.)
    if (room.floorTileSprites && room.floorTileSprites.length > 0) {
      for (const s of room.floorTileSprites) s.destroy()
      room.floorTileSprites = []
    }

    const w = room.width
    const h = room.height

    // Keep heat overlay sized to match the room floor when dimensions change.
    if (room.heatOverlay) {
      room.heatOverlay.setSize(w, h)
    }

    const WALL_T = 3          // thinner than outer building walls (5)
    const WALL_I = 1
    const styleIdx = this.hashToken(room.teamKey || room.cwd || room.label) % 3
    const roomStyle = [
      {
        wallOuter: 0x475569,
        wallInner: 0x64748b,
        floor: COLOR_ROOM_FLOOR,
        floorGrid: COLOR_ROOM_FLOOR2,
        header: COLOR_HEADER_BG,
        accent: COLOR_DOOR_FRAME,
        rug: 0x1d4ed8,
      },
      {
        wallOuter: 0x495b6f,
        wallInner: 0x6b7f94,
        floor: 0x1b2b36,
        floorGrid: 0x355164,
        header: 0x0f1724,
        accent: 0x14b8a6,
        rug: 0x0f766e,
      },
      {
        wallOuter: 0x524c68,
        wallInner: 0x746d94,
        floor: 0x24203b,
        floorGrid: 0x433f63,
        header: 0x17122c,
        accent: 0x8b5cf6,
        rug: 0x6d28d9,
      },
    ][styleIdx]

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

    // Tiled floor texture sprites — subtly layered over the flat floor fill.
    // Each style picks a different region of the room-tiles spritesheet (48x48 frames).
    // Alpha is kept very low (0.08–0.12) so the texture reads as grain, not replacement art.
    // Floor tile sprites removed — they created a muddy gray overlay at low alpha

    // Slight room rug variation to avoid identical project spaces.
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

    // Distinctive rug patterns per room style
    const rugX = floorX + rugInsetX
    const rugY = floorY + rugInsetY
    const rugW = Math.max(floorW - rugInsetX * 2, 12)
    const rugH = Math.max(floorH - rugInsetY * 2, 12)
    if (styleIdx === 0) {
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
    } else if (styleIdx === 1) {
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

    // Herringbone / parquet floor pattern (replaces basic carpet grid)
    // Alternating rows of 8x3px parallelogram planks at opposing skews, alpha 0.15.
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
      g.fillStyle(this.windowTintColor, this.windowTintAlpha * 1.5)
      g.fillRect(winX, winY, winW, winH)

      // ── Tiny scenic view through the window ──────────────────────────────
      // Layers drawn bottom-to-top inside the window bounds so they composite
      // naturally before the frame, mullions, and curtains are painted over.
      if (this.currentTimePhase === 'day' || this.currentTimePhase === 'morning') {
        // Pale blue sky wash across the full pane
        g.fillStyle(0x7dd3fc, 0.06)
        g.fillRect(winX, winY, winW, winH)
        // Green hill — squat ellipse sitting just below the sill
        g.fillStyle(0x166534, 0.08)
        g.fillEllipse(winX + winW / 2, winY + winH + 1, winW * 0.9, 6)
        // Tiny sun dot in the upper-right quadrant
        g.fillStyle(0xfde68a, 0.10)
        g.fillCircle(winX + winW - 3, winY + 2, 1)
      } else if (this.currentTimePhase === 'night') {
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
      g.fillStyle(this.windowTintColor, 0.04)
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
    let monitorGlowOverlay: Phaser.GameObjects.Arc | undefined
    let screenLines: Phaser.GameObjects.Graphics | undefined
    let screenTween: Phaser.Tweens.Tween | undefined
    if (this.officeTilesLoaded) {
      monitorGlowOverlay = this.add.circle(0, WS_MONITOR_Y, 14, 0x0ea5e9, 0.15).setVisible(false)
      wsContainer.add(monitorGlowOverlay)
      monitorSprite = this.add.sprite(0, WS_MONITOR_Y, 'office', FRAME_MONITOR).setScale(0.42)
      wsContainer.add(monitorSprite)
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
      monitorGlowOverlay, screenLines, screenTween,
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
    if (this.coffeeRunners.has(agent.config.id)) {
      const m = agent.sessionMode
      if (m === 'working' || m === 'plan' || agent.needsInteraction) {
        // Agent started working — cancel the coffee run visual
        this.coffeeRunners.delete(agent.config.id)
        ws.sprite.setVisible(true)
      } else {
        // Still on coffee run — hide sprite and skip the rest
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
            this.spawnAlertRipple(wx, wy, rippleColor)
            this.spawnEmojiReaction(wx, wy, '\uD83D\uDD14') // blocked: 🔔
          }
        }
      } else if (!agent.needsInteraction && prevState.needsInteraction) {
        // Reset ripple guard so the next blocked event fires a fresh ripple
        ws.rippleFired = false
        const roomU = this.rooms.get(roomKey)
        if (roomU) this.spawnEmojiReaction(roomU.x + ws.container.x, roomU.y + ws.container.y, '\uD83D\uDC4D') // unblocked: 👍
      }

      if (wasWorking && !isWorking && !agent.needsInteraction) {
        this.queueMinimapRoomFlash(roomKey, COLOR_LED_GREEN, 1200)
        this.showToast(`${name} finished task`, 'success')
        const roomC = this.rooms.get(roomKey)
        if (roomC) this.spawnEmojiReaction(roomC.x + ws.container.x, roomC.y + ws.container.y, '\u2705') // completed: ✅
      } else if (!wasWorking && isWorking) {
        this.queueMinimapRoomFlash(roomKey, COLOR_DOOR_FRAME, 900)
        this.showToast(`${name} started working`, 'info')
        const roomS = this.rooms.get(roomKey)
        if (roomS) this.spawnEmojiReaction(roomS.x + ws.container.x, roomS.y + ws.container.y, '\u26A1') // started: ⚡
      }

      // Plan mode entry
      if (agent.sessionMode === 'plan' && prevState.sessionMode !== 'plan') {
        const roomP = this.rooms.get(roomKey)
        if (roomP) this.spawnEmojiReaction(roomP.x + ws.container.x, roomP.y + ws.container.y, '\uD83D\uDCCB') // plan: 📋
      }

      // Compressing entry
      if (agent.sessionMode === 'compressing' && prevState.sessionMode !== 'compressing') {
        const roomZ = this.rooms.get(roomKey)
        if (roomZ) this.spawnEmojiReaction(roomZ.x + ws.container.x, roomZ.y + ws.container.y, '\uD83D\uDCA8') // compressing: 💨
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

    this.updateThoughtBubble(ws, agent, shouldShow, accentColor, isWorking)

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
    for (const c of this.ceilingLights) {
      for (const child of c.getAll()) {
        this.tweens.killTweensOf(child)
      }
      c.destroy(true)
    }
    this.ceilingLights = []
  }

  private tickCeilingLightActivity(time: number): void {
    if (this.ceilingLights.length === 0 || time - this.lastLightCheckAt < 5000) return
    this.lastLightCheckAt = time
    let activeCount = 0
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (ws.state && (ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction) {
          activeCount++
        }
      }
    }
    const nextMode: 'active' | 'idle' = activeCount > 0 ? 'active' : 'idle'
    if (nextMode === this.lightActivityMode) return
    this.lightActivityMode = nextMode
    const lo = nextMode === 'active' ? 0.2 : 0.1
    const hi = nextMode === 'active' ? 0.35 : 0.2
    for (const lightContainer of this.ceilingLights) {
      const children = lightContainer.getAll()
      const innerCore = children[2] as Phaser.GameObjects.Arc | undefined
      if (innerCore) {
        this.tweens.killTweensOf(innerCore)
        this.tweens.add({ targets: innerCore, alpha: { from: lo, to: hi }, duration: 2000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
      }
    }
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
    this.clearSteamParticles(ws)
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
    // Position café inline — to the right of rooms, aligned with top row
    const CAFE_LAYOUT_W = 420
    const CAFE_LAYOUT_H = 180
    const cafeX = maxX + CAFE_LAYOUT_W / 2 + 40
    const cafeTopY = WORLD_MARGIN + 20  // align with top of rooms
    const cafeBottomY = cafeTopY + CAFE_LAYOUT_H

    // World bounds include both rooms and café
    const totalMaxX = cafeX + CAFE_LAYOUT_W / 2
    const totalMaxY = Math.max(maxY, cafeBottomY)
    this.worldWidth  = totalMaxX + WORLD_MARGIN
    this.worldHeight = totalMaxY + WORLD_MARGIN
    this.tripletDirty = true

    // Draw office background — includes both rooms and café
    if (this.officeGraphics) {
      const bgW = totalMaxX + WORLD_MARGIN
      const bgH = Math.max(maxY, cafeBottomY) + WORLD_MARGIN
      this.drawOfficeBackground(bgW, bgH)
    }

    // Build Penny Café
    if (this.rooms.size > 0) {
      this.buildCafeZone(cafeX, cafeTopY)
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

    // Building outer rect — everything is drawn INSIDE this so there is zero overshoot.
    const bx = WORLD_MARGIN - PAD
    const by = WORLD_MARGIN - PAD
    const bw = contentW - WORLD_MARGIN + PAD * 2
    const bh = contentH - WORLD_MARGIN + PAD * 2

    // Floor is inset from the wall
    const fx = bx + WALL_T
    const fy = by + WALL_T
    const fw = bw - WALL_T * 2
    const fh = bh - WALL_T * 2

    // Drop shadow (offset behind building)
    g.fillStyle(0x000000, 0.25)
    g.fillRoundedRect(bx + 4, by + 4, bw, bh, 8)

    // Outer wall — fills the full building rect
    g.fillStyle(COLOR_WALL)
    g.fillRoundedRect(bx, by, bw, bh, 6)

    // Inner wall accent
    g.fillStyle(COLOR_WALL_INNER)
    g.fillRoundedRect(bx + WALL_T - WALL_I, by + WALL_T - WALL_I, bw - (WALL_T - WALL_I) * 2, bh - (WALL_T - WALL_I) * 2, 4)

    // Top-wall windows
    const windowBandY = by + 8
    const windowBandH = 10
    const windowCount = Math.max(2, Math.floor(fw / 120))
    const windowGap = fw / (windowCount + 1)
    this.windowPositions = []
    for (let i = 0; i < windowCount; i++) {
      const wx = fx + windowGap * (i + 1) - 24
      g.fillStyle(0x0b1f36, 0.62)
      g.fillRoundedRect(wx, windowBandY, 48, windowBandH, 3)
      g.fillStyle(this.windowTintColor, this.windowTintAlpha)
      g.fillRoundedRect(wx + 3, windowBandY + 2, 42, windowBandH - 4, 2)
      this.windowPositions.push({ x: wx + 3, y: windowBandY + 2, w: 42, h: windowBandH - 4 })

      // Venetian blind lines on top-band windows (2 faint horizontal lines)
      g.lineStyle(1, 0x475569, 0.08)
      g.lineBetween(wx + 3, windowBandY + 3, wx + 45, windowBandY + 3)
      g.lineBetween(wx + 3, windowBandY + 5, wx + 45, windowBandY + 5)
    }

    // Floor (inset from wall)
    g.fillStyle(0x0f172a)
    g.fillRoundedRect(fx, fy, fw, fh, 2)

    // Animated ceiling fixtures
    this.destroyCeilingLights()
    const lightCount = Math.max(2, Math.floor(fw / 180))
    const lightGap = fw / (lightCount + 1)
    for (let i = 0; i < lightCount; i++) {
      const lx = fx + lightGap * (i + 1)
      const ly = fy + 16
      const outerGlow = this.add.arc(0, 0, 14, 0, 360, false, 0xf8fafc, 0.06)
      const innerCore = this.add.arc(0, 0, 4, 0, 360, false, 0xe8edf5, 0.25)
      const beamGfx = this.add.graphics()
      beamGfx.fillStyle(0xf0f4ff, 1)
      beamGfx.fillTriangle(-8, 2, 8, 2, 18, 40)
      beamGfx.fillTriangle(-8, 2, -18, 40, 18, 40)
      beamGfx.setAlpha(0.03)
      const lightContainer = this.add.container(lx, ly, [beamGfx, outerGlow, innerCore])
      lightContainer.setDepth(-3)
      const flickerDuration = 2000 + Math.random() * 2000
      const flickerDelay = Math.random() * 1500
      const baseLo = this.lightActivityMode === 'active' ? 0.2 : 0.15
      const baseHi = this.lightActivityMode === 'active' ? 0.35 : 0.3
      this.tweens.add({ targets: innerCore, alpha: { from: baseLo, to: baseHi }, duration: flickerDuration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: flickerDelay })
      this.tweens.add({ targets: beamGfx, alpha: { from: 0.02, to: 0.04 }, duration: flickerDuration * 1.1, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: flickerDelay })
      this.ceilingLights.push(lightContainer)
    }

    // Floor kept clean — no planks or rug overlay

    // -------------------------------------------------------------------------
    // BUILDING FACADE UPGRADES
    // -------------------------------------------------------------------------

    // 1. ROOF PARAPET / CORNICE — dark strip along the very top edge + AC units
    g.fillStyle(0x1e293b, 1)
    g.fillRect(bx, by, bw, 3)
    {
      const acSpacing = 40
      const acCount = Math.floor(bw / acSpacing) - 1
      for (let i = 1; i <= acCount; i++) {
        const acX = bx + i * acSpacing - 2
        g.fillStyle(0x334155, 1)
        g.fillRect(acX, by + 3, 4, 3)
      }
    }

    // 1b. ROOFTOP DETAILS — architectural elements above the building top edge
    {
      // Slightly raised roof section: a flush cap 4px above the parapet baseline
      g.fillStyle(0x1e293b, 0.8)
      g.fillRect(bx + 20, by - 4, bw - 40, 4)

      // HVAC unit cluster — left side of the roof
      const hvacBaseX = bx + 28
      const hvacBaseY = by - 4
      const hvacUnits = [
        { x: hvacBaseX,      w: 8, h: 6 },
        { x: hvacBaseX + 12, w: 8, h: 5 },
        { x: hvacBaseX + 24, w: 6, h: 6 },
      ]
      for (const u of hvacUnits) {
        g.fillStyle(0x475569, 0.4)
        g.fillRect(u.x, hvacBaseY - u.h, u.w, u.h)
        // Top highlight
        g.fillStyle(0x64748b, 0.2)
        g.fillRect(u.x, hvacBaseY - u.h, u.w, 1)
      }

      // Satellite dish — right side of roof (arc approximation with a filled circle slice)
      const dishX = bx + bw - 40
      const dishY = by - 4
      g.fillStyle(0x64748b, 0.3)
      g.beginPath()
      g.arc(dishX, dishY, 4, Math.PI, 0, false)
      g.fillPath()
      // Dish mast stub
      g.fillStyle(0x475569, 0.3)
      g.fillRect(dishX - 1, dishY - 3, 2, 3)

      // Antenna mast — thin vertical line with blinking aviation light
      const antX = bx + bw - 60
      const antBaseY = by - 4
      const antH = 12
      g.fillStyle(0x475569, 0.3)
      g.fillRect(antX, antBaseY - antH, 1, antH)
      // Red aviation light dot on tip
      g.fillStyle(0xef4444, 0.4)
      g.fillCircle(antX, antBaseY - antH, 1)

      // Roof edge shadow — 3px strip just inside the top wall, simulates parapet cast shadow
      g.fillStyle(0x000000, 0.06)
      g.fillRect(bx, by + 3, bw, 3)

      // Skylight — only on wide buildings
      if (bw > 400) {
        const slW = 24
        const slH = 12
        const slX = bx + Math.floor(bw / 2) - slW / 2
        const slY = by - 4 - slH
        // Glass fill
        g.fillStyle(0x7dd3fc, 0.06)
        g.fillRect(slX, slY, slW, slH)
        // Frame
        g.lineStyle(1, 0x475569, 0.3)
        g.strokeRect(slX, slY, slW, slH)
        // Centre mullion
        g.lineBetween(slX + slW / 2, slY, slX + slW / 2, slY + slH)
      }

      // Roof access door — stairwell hatch on the right-centre roof area
      const doorX = bx + Math.floor(bw * 0.65)
      const doorY = by - 4 - 14
      g.fillStyle(0x1e293b, 1)
      g.fillRect(doorX, doorY, 10, 14)
      g.lineStyle(1, 0x334155, 1)
      g.strokeRect(doorX, doorY, 10, 14)
      // Tiny door handle
      g.fillStyle(0x64748b, 0.6)
      g.fillRect(doorX + 7, doorY + 6, 2, 2)
    }

    // 1c. FLAG POLE + ANIMATED FLAG — left side of roof
    {
      // Destroy any previously created flag container so redraws don't stack
      if (this.flagContainer) {
        this.tweens.killTweensOf(this.flagContainer)
        this.flagContainer.destroy(true)
        this.flagContainer = null
      }

      if (bw > 200) {
        // Pole: thin vertical line drawn on g (static, part of background)
        const poleX = bx + 20
        const poleBaseY = by - 4   // sits on the roof cap
        const poleH = 30
        g.fillStyle(0x94a3b8, 1)
        g.fillRect(poleX, poleBaseY - poleH, 1, poleH)

        // Animated flag: live Container so Phaser tweens can run on it
        const flagTopY = poleBaseY - poleH
        this.flagContainer = this.add.container(poleX + 1, flagTopY)
        this.flagContainer.setDepth(-0.3)

        // Flag body — simple filled rect with a shading strip
        const flagGfx = this.add.graphics()
        flagGfx.fillStyle(0x3b82f6, 1)
        flagGfx.fillRect(0, 0, 12, 8)
        // Subtle shading strip along bottom edge
        flagGfx.fillStyle(0x1d4ed8, 0.4)
        flagGfx.fillRect(0, 6, 12, 2)

        // "P" label centred on the flag
        const flagLabel = this.add.text(6, 4, 'P', {
          fontSize: '4px',
          color: '#ffffff',
          fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5)

        this.flagContainer.add([flagGfx, flagLabel])

        // Waving animation: oscillate scaleX (wind flutter) + slight angle tilt
        this.tweens.add({
          targets: this.flagContainer,
          scaleX: { from: 1.0, to: 0.85 },
          angle: { from: -3, to: 3 },
          duration: 1500,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })
      }
    }

    // 2. SIDE WINDOWS — left and right walls, 3-4 windows each
    {
      const sideWinW = 12
      const sideWinH = 24
      const sideWinCount = Math.max(3, Math.floor(fh / 80))
      const sideWinGap = fh / (sideWinCount + 1)
      for (let i = 0; i < sideWinCount; i++) {
        const wy = fy + sideWinGap * (i + 1) - sideWinH / 2
        // Left wall
        g.fillStyle(0x0b1f36, 0.62)
        g.fillRoundedRect(bx + 1, wy, sideWinW + 2, sideWinH, 2)
        g.fillStyle(this.windowTintColor, this.windowTintAlpha)
        g.fillRoundedRect(bx + 2, wy + 2, sideWinW, sideWinH - 4, 1)
        g.lineStyle(1, 0x0f172a, 0.5)
        g.lineBetween(bx + 2 + sideWinW / 2, wy + 2, bx + 2 + sideWinW / 2, wy + sideWinH - 2)
        // Right wall
        const rwx = bx + bw - sideWinW - 3
        g.fillStyle(0x0b1f36, 0.62)
        g.fillRoundedRect(rwx, wy, sideWinW + 2, sideWinH, 2)
        g.fillStyle(this.windowTintColor, this.windowTintAlpha)
        g.fillRoundedRect(rwx + 1, wy + 2, sideWinW, sideWinH - 4, 1)
        g.lineStyle(1, 0x0f172a, 0.5)
        g.lineBetween(rwx + 1 + sideWinW / 2, wy + 2, rwx + 1 + sideWinW / 2, wy + sideWinH - 2)
        // Curtain rods above side windows
        g.lineStyle(1, 0x64748b, 0.3)
        g.lineBetween(bx, wy - 1, bx + sideWinW + 4, wy - 1)
        g.lineBetween(rwx - 1, wy - 1, rwx + sideWinW + 3, wy - 1)
      }
    }

    // 3. STRUCTURAL PILLAR COLUMNS at 1/3 and 2/3 of the floor width
    for (const frac of [1 / 3, 2 / 3]) {
      const pillarX = Math.round(fx + fw * frac) - 2
      g.fillStyle(0x334155, 0.15)
      g.fillRect(pillarX, fy, 4, fh)
      // Shadow on right edge
      g.fillStyle(0x0f172a, 0.1)
      g.fillRect(pillarX + 3, fy, 1, fh)
    }

    // Lobby, entrance, and exterior details removed — keeping the building clean

    // Decorations
    if (this.officeTilesLoaded) {
      const DECO_SCALE = 0.65  // scaled up to match duder proportions
      const decos: Phaser.GameObjects.Sprite[] = []

      // Large plant in bottom-left corner
      decos.push(this.add.sprite(fx + 14, fy + fh - 14, 'office', OFFICE_FRAME_PLANT).setScale(DECO_SCALE).setAlpha(0.85).setDepth(-1))

      // Tall plant in bottom-right
      decos.push(this.add.sprite(fx + fw - 14, fy + fh - 14, 'office', OFFICE_FRAME_PLANT_TALL).setScale(DECO_SCALE).setAlpha(0.8).setDepth(-1))

      // Small cactus near top-right
      decos.push(this.add.sprite(fx + fw - 14, fy + 20, 'office', OFFICE_FRAME_CACTUS).setScale(DECO_SCALE * 0.85).setAlpha(0.75).setDepth(-1))

      // Animated analog wall clock
      if (fw > 300) {
        const clockX = fx + fw / 2
        const clockY = by + 12
        if (this.wallClockContainer) {
          this.wallClockContainer.destroy()
          this.wallClockContainer = null
          this.clockHourHand = null
          this.clockMinuteHand = null
          this.clockSecondHand = null
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
        this.wallClockContainer = this.add.container(clockX, clockY, [clockFace, hourHand, minuteHand, secondHand])
        this.wallClockContainer.setDepth(-0.5)
        this.wallClockContainer.setAlpha(0.88)
        this.clockHourHand = hourHand
        this.clockMinuteHand = minuteHand
        this.clockSecondHand = secondHand
        this.tickWallClock()
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
    if (this.exteriorLights) {
      this.exteriorLights.destroy()
      this.exteriorLights = null
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
      const initAlpha = phaseAlphaMap[this.currentTimePhase] ?? 0.0

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

      this.exteriorLights = this.add.container(0, 0, lightChildren)
      this.exteriorLights.setDepth(-3.8)
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

  // ---------------------------------------------------------------------------
  // Penny Café — permanent coffee bar zone to the right of the building
  // ---------------------------------------------------------------------------

  private buildCafeZone(floorRight: number, floorBottom: number): void {
    if (this.cafeContainer) {
      this.tweens.killTweensOf(this.cafeContainer)
      this.cafeContainer.destroy(true)
      this.cafeContainer = null
    }
    this.cafeBaristas = []
    this.coffeeRunners.clear()  // clear stale runners that reference old container
    this.coffeeRunnerRooms.clear()
    if (this.cafeVisitorTimer) { this.cafeVisitorTimer.destroy(); this.cafeVisitorTimer = null }
    if (this.cafeSteamTimer) { this.cafeSteamTimer.destroy(); this.cafeSteamTimer = null }

    // ── HORIZONTAL layout — coffee bar in the corner ──
    const CAFE_W = 420   // wide coffee bar
    const CAFE_H = 180   // comfortable height
    const COUNTER_W = 16 // counter thickness
    const BEHIND_W = 68  // depth of barista workspace

    const cx = floorRight - CAFE_W / 2  // right-aligned
    const cy = floorBottom

    const container = this.add.container(cx, cy).setDepth(2)
    this.cafeWorldX = cx + CAFE_W / 2
    // Align duder walk target with stool Y position
    // counterY = (CAFE_H - BEHIND_W - 20) - 2, stoolY = counterY - 14
    const stoolWorldY = (CAFE_H - BEHIND_W - 20) - 2 - 14
    this.cafeWorldY = cy + stoolWorldY
    this.cafeContainer = container
    const g = this.add.graphics()
    container.add(g)

    // ── Building structure ──
    const CUSTOMER_H = CAFE_H - BEHIND_W - 20

    // Drop shadow
    g.fillStyle(0x000000, 0.15); g.fillRoundedRect(4, 4, CAFE_W, CAFE_H, 6)

    // Customer area (top) — clean, minimal
    g.fillStyle(0x1e293b, 0.35); g.fillRoundedRect(0, 0, CAFE_W, CUSTOMER_H, { tl: 6, tr: 6, bl: 0, br: 0 })

    // Barista workspace (bottom) — warm brown
    g.fillStyle(0x3d2b1f, 0.7); g.fillRoundedRect(0, CUSTOMER_H, CAFE_W, BEHIND_W + 20, { tl: 0, tr: 0, bl: 6, br: 6 })
    g.fillStyle(0x1a1208, 0.5); g.fillRect(6, CUSTOMER_H + 6, CAFE_W - 12, BEHIND_W + 6)

    // ── Header sign ──
    g.fillStyle(0x1a0f06, 0.85); g.fillRoundedRect(6, 2, CAFE_W - 12, 26, { tl: 4, tr: 4, bl: 0, br: 0 })
    g.lineStyle(2, 0xd97706, 0.5); g.lineBetween(6, 28, CAFE_W - 6, 28)
    const signText = this.add.text(CAFE_W / 2, 15, '☕  PENNY CAFÉ', {
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      color: '#fbbf24', resolution: 2,
    }).setOrigin(0.5)
    container.add(signText)

    // ── Counter bar ──
    const counterY = CUSTOMER_H - 2
    g.fillStyle(0x78350f, 0.75); g.fillRoundedRect(8, counterY, CAFE_W - 16, COUNTER_W, 3)
    g.fillStyle(0xb45309, 0.25); g.fillRect(10, counterY + 2, CAFE_W - 20, 4)

    // ── Equipment (small, behind counter) ──
    const eqY = counterY + COUNTER_W + 8
    const machinePositions = [30, 110]
    for (const mx of machinePositions) {
      g.fillStyle(0x334155, 0.7); g.fillRoundedRect(mx, eqY, 20, 22, 3)
      g.fillStyle(0xef4444, 0.4); g.fillCircle(mx + 10, eqY + 5, 2)
    }
    // Menu board (small)
    g.fillStyle(0x1e293b, 0.7); g.fillRoundedRect(200, eqY, 60, 28, 2)
    g.lineStyle(1, 0x78350f, 0.4); g.strokeRoundedRect(200, eqY, 60, 28, 2)
    for (let ml = 0; ml < 3; ml++) {
      g.fillStyle(0xf8fafc, 0.06); g.fillRect(204, eqY + 4 + ml * 8, 28, 2)
      g.fillStyle(0xfbbf24, 0.1); g.fillRect(240, eqY + 4 + ml * 8, 14, 2)
    }

    // ── BARISTAS — walk between machines, counter, make & serve drinks ──
    const baristaWorkY = counterY + COUNTER_W + 40  // Y where baristas stand/walk
    const counterServeY = counterY + 4               // Y where drinks are placed on counter
    const baristaConfigs = [
      { homeX: 60,  charIdx: 1, name: 'Latte Larry',   machineX: 30 },
      { homeX: 200, charIdx: 0, name: 'Mocha Maya',    machineX: 110 },
      { homeX: 350, charIdx: 1, name: 'Espresso Ed',   machineX: 200 },
    ]

    for (const cfg of baristaConfigs) {
      const walkKey = cfg.charIdx === 1 ? 'anim-walk-2' : 'anim-walk-1'
      const idleKey = cfg.charIdx === 1 ? 'anim-idle-2' : 'anim-idle-1'

      // Put everything in a container so walking moves it all together
      const bc = this.add.container(cfg.homeX, baristaWorkY)
      container.add(bc)

      const bSprite = this.add.sprite(0, 0, idleKey, 3)  // face counter (back view)
        .setScale(CHAR_SCALE).setOrigin(0.5, 1)
      bc.add(bSprite)

      const apron = this.add.rectangle(0, -8, 14, 12, 0x059669, 0.35)
      bc.add(apron)

      const tag = this.add.text(0, 6, cfg.name, {
        fontSize: '8px', fontFamily: 'system-ui, sans-serif', color: '#fbbf24',
        backgroundColor: '#1a0f06cc', padding: { x: 3, y: 1 }, resolution: 2,
      }).setOrigin(0.5, 0)
      bc.add(tag)

      this.cafeBaristas.push(bc)

      // Face up toward customers (walk-up stand frame = frame 6)
      bSprite.setTexture(walkKey, 6)
      // Busy working — sway, bob, shuffle
      this.tweens.add({ targets: bc, angle: { from: -3, to: 3 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 500 })
      this.tweens.add({ targets: bSprite, y: -2, scaleY: CHAR_SCALE * 0.97, duration: 450 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 400 })
      this.tweens.add({ targets: bc, x: cfg.homeX + 10, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 })
    }

    // ── Small stools along counter (customer side) — aligned with duder sit positions ──
    const stoolY = counterY - 14
    const STOOL_START = 42
    const STOOL_GAP = 48
    const stoolCount = Math.min(7, Math.floor((CAFE_W - STOOL_START - 20) / STOOL_GAP))
    for (let si = 0; si < stoolCount; si++) {
      const sx = STOOL_START + si * STOOL_GAP
      g.fillStyle(0x475569, 0.4); g.fillCircle(sx, stoolY, 8)
      g.fillStyle(0x334155, 0.25); g.fillRect(sx - 2, stoolY + 8, 4, 6)
      g.fillStyle(0x334155, 0.2); g.fillRect(sx - 4, stoolY + 13, 8, 2)
    }

    // ── Animated steam ──
    this.cafeSteamTimer = this.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (!this.cafeContainer?.active) return
        const mx = machinePositions[Math.floor(Math.random() * machinePositions.length)]
        for (let si = 0; si < 2; si++) {
          const p = this.add.circle(mx + 10 + (si - 0.5) * 4, eqY - 2, 2, 0xffffff, 0.25)
          container.add(p)
          this.tweens.add({
            targets: p, y: eqY - 16 - Math.random() * 8, x: mx + 10 + (si - 0.5) * 4 + (Math.random() - 0.5) * 6,
            alpha: 0, duration: 900 + Math.random() * 400, delay: si * 120, ease: 'Sine.easeOut',
            onComplete: () => { p.destroy() },
          })
        }
      },
    })
  }

    private startCoffeeRunTimer(): void {
    if (this.coffeeRunTimer) this.coffeeRunTimer.destroy()
    this.coffeeRunTimer = this.time.addEvent({
      delay: 10000 + Math.random() * 8000,
      loop: true,
      callback: () => this.tryStartCoffeeRun(),
    })
  }

  private tryStartCoffeeRun(): void {
    if (!this.cafeContainer || this.rooms.size === 0) return
    if (this.coffeeRunners.size >= 2) return

    const candidates: { ws: WorkstationSprite; room: Room }[] = []
    for (const room of this.rooms.values()) {
      // Only one coffee runner per room at a time
      if (this.coffeeRunnerRooms.has(room.cwd)) continue

      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        if (ws.walkBreakTween) continue
        if (this.coffeeRunners.has(ws.state.config.id)) continue
        const m = ws.state.sessionMode
        const status = ws.state.status
        // Only truly idle agents — not working, planning, waiting, or active in any way
        const isIdle = status === 'idle' || status === 'sleeping'
        const isBusy = ws.state.needsInteraction || m === 'working' || m === 'plan' || m === 'compressing' || m === 'waiting' || m === 'accept-edits'
        if (isIdle && !isBusy) candidates.push({ ws, room })
      }
    }
    if (candidates.length === 0) return

    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    this.sendAgentForCoffee(pick.ws, pick.room)
  }

  private sendAgentForCoffee(ws: WorkstationSprite, room: Room): void {
    if (!ws.state || !this.cafeContainer) return
    const agentId = ws.state.config.id
    this.coffeeRunners.add(agentId)
    this.coffeeRunnerRooms.add(room.cwd)

    const WALK_SPEED = 55
    const startX = room.x + ws.container.x
    const startY = room.y + ws.container.y + WS_SPRITE_Y
    const doorX = room.x
    const doorY = this.getRoomDoorY(room) + (room.doorSide === 'top' ? -4 : 4)
    const numStools = Math.min(7, Math.floor((420 - 42 - 20) / 48))
    const stoolIdx = Math.floor(Math.random() * numStools)
    const cafeX = (this.cafeWorldX - 210) + 42 + stoolIdx * 48
    const cafeY = this.cafeWorldY
    const midY = room.doorSide === 'top' ? doorY - 30 : doorY + 30

    // Hide desk sprite while on coffee run — desk stays clickable
    ws.sprite.setVisible(false)
    this.spawnEmojiReaction(startX, startY - 25, '☕')

    const charIdx = this.getAgentCharacterIndex(ws.state)
    // Use individual walk animation strips (_256 PNGs: 6 frames at 512×512)
    // Frames: 0=front-stepA, 1=front-stepB, 2=¾-stepA, 3=¾-stepB, 4=side-stepA, 5=side-stepB
    const walkSuffix = charIdx === 1 ? '2' : '1'
    const walkSheetKey = `anim-walk-${walkSuffix}`
    const sitSheetKey = `anim-sit-${walkSuffix}`
    const WALK_SCALE = CHAR_SCALE  // frames are 256×512, same as main spritesheet
    const walker = this.add.sprite(startX, startY, walkSheetKey, 0)
      .setScale(WALK_SCALE).setOrigin(0.5, 1).setDepth(9000)

    // Shadow
    const shadow = this.add.ellipse(startX, startY + 2, 16, 5, 0x000000, 0.15).setDepth(8999)

    // No waddle — the walk sprite frames handle the animation

    // Cleanup helper
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      shadow.destroy()
      walker.destroy()
      ws.sprite.setVisible(true)
      this.coffeeRunners.delete(agentId)
      this.coffeeRunnerRooms.delete(room.cwd)
    }

    // Walk through a list of waypoints sequentially
    const goPoints = [
      { x: doorX, y: doorY },
      { x: doorX, y: midY },
      { x: cafeX, y: midY },
      { x: cafeX, y: cafeY },
    ]
    const backPoints = [
      { x: cafeX, y: midY },
      { x: doorX, y: midY },
      { x: doorX, y: doorY },
      { x: startX, y: startY },
    ]

    let pointIdx = 0
    let currentPoints = goPoints
    let phase: 'going' | 'sitting' | 'returning' = 'going'

    const stepNext = () => {
      if (!walker.active) { cleanup(); return }
      if (pointIdx >= currentPoints.length) {
        if (phase === 'going') {
          // Arrived at café — sit
          phase = 'sitting'
          walker.setAngle(0)
          walker.setTexture(sitSheetKey, 0)  // front-facing sit
          walker.setFlipX(false)
          walker.setScale(WALK_SCALE)
          walker.setDepth(9000)

          // ── Barista serves a drink ──
          if (this.cafeContainer?.active && this.cafeBaristas.length > 0) {
            const barista = this.cafeBaristas[Math.floor(Math.random() * this.cafeBaristas.length)]
            if (barista?.active) {
              // Barista reaches forward (toward counter)
              this.time.delayedCall(600, () => {
                if (!barista.active || !this.cafeContainer?.active) return
                // Slide a cup from behind the counter to in front of the walker
                const cupStartX = this.cafeContainer.x + barista.x
                const cupStartY = this.cafeContainer.y + barista.y - 20
                const cupEndX = walker.x
                const cupEndY = walker.y - 10
                const cup = this.add.circle(cupStartX, cupStartY, 3, 0x8b5cf6, 0.8).setDepth(9002)
                // Steam wisp on the cup
                const steam = this.add.circle(cupStartX, cupStartY - 6, 2, 0xffffff, 0.3).setDepth(9002)
                this.tweens.add({
                  targets: [cup, steam], x: cupEndX, y: { value: cupEndY, ease: 'Quad.easeOut' },
                  duration: 600, ease: 'Sine.easeOut',
                  onComplete: () => {
                    steam.destroy()
                    // Cup stays by the walker, then fades when they leave
                    this.time.delayedCall(2500, () => {
                      if (cup.active) this.tweens.add({ targets: cup, alpha: 0, duration: 400, onComplete: () => cup.destroy() })
                    })
                  },
                })
              })
            }
          }

          this.time.delayedCall(120000, () => {  // 2 minutes coffee break
            if (!walker.active) { cleanup(); return }
            phase = 'returning'
            currentPoints = backPoints
            pointIdx = 0
            stepNext()
          })
        } else {
          // Arrived back at desk
          cleanup()
          this.spawnEmojiReaction(startX, startY - 25, '😊')
        }
        return
      }

      const target = currentPoints[pointIdx++]
      const dx = target.x - walker.x
      const dy = target.y - walker.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) { stepNext(); return }

      // Pick walk frames based on direction (A = step 1, B = step 2)
      const adx = Math.abs(dx), ady = Math.abs(dy)
      // Walk strip: 12 frames (256×512) — 4 directions × 3 frames each
      //   0-2:  walking DOWN  (stand, left-forward, right-forward)
      //   3-5:  walking RIGHT (stand, left-forward, right-forward)
      //   6-8:  walking UP    (stand, left-forward, right-forward)
      //   9-11: walking LEFT  (stand, left-forward, right-forward)

      let startFrame: number
      if (adx > ady * 1.5) {
        startFrame = dx > 0 ? 3 : 9
      } else if (ady > adx * 1.5) {
        startFrame = dy > 0 ? 0 : 6
      } else {
        // Diagonal — pick the dominant axis
        if (adx > ady) { startFrame = dx > 0 ? 3 : 9 }
        else { startFrame = dy > 0 ? 0 : 6 }
      }

      walker.setTexture(walkSheetKey, startFrame)
      walker.setFlipX(false)
      walker.setScale(WALK_SCALE)

      const dur = Math.max(200, (dist / WALK_SPEED) * 1000)
      let cycleIdx = 0
      // Cycle between left-foot(1) and right-foot(2), skip stand(0) to avoid vertical bounce
      // Add very subtle angle sway (±2°) for natural movement feel
      const walkCycleTimer = this.time.addEvent({
        delay: 200, loop: true,
        callback: () => {
          if (!walker.active) { walkCycleTimer.destroy(); return }
          cycleIdx = cycleIdx === 0 ? 1 : 0
          walker.setFrame(startFrame + 1 + cycleIdx)
          walker.setAngle(cycleIdx === 0 ? -3 : 3)
        },
      })
      this.tweens.add({
        targets: walker,
        x: target.x, y: target.y,
        duration: dur, ease: 'Linear',
        onComplete: () => { walkCycleTimer.destroy(); stepNext() },
      })
      this.tweens.add({ targets: shadow, x: target.x, y: target.y + 2, duration: dur, ease: 'Linear' })
    }

    stepNext()
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

    let cafeBounds: { x: number; y: number; w: number; h: number } | null = null
    if (this.cafeContainer) {
      cafeBounds = { x: this.cafeContainer.x, y: this.cafeContainer.y, w: 420, h: 180 }
    }

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

  // ---------------------------------------------------------------------------
  // Starfield
  // ---------------------------------------------------------------------------

  private initStarfield(): void {
    // Star color palette — mostly white, occasional cool blue or warm yellow
    const palette = [
      { color: 0xffffff, weight: 6 },
      { color: 0x93c5fd, weight: 2 },
      { color: 0xfef3c7, weight: 2 },
    ]
    const totalWeight = palette.reduce((s, e) => s + e.weight, 0)

    const count = 50 + Math.floor(Math.random() * 31) // 50-80 stars
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 4000
      const y = Math.random() * 3000
      const radius = 0.5 + Math.random() * 1.0 // 0.5-1.5px
      const baseAlpha = 0.03 + Math.random() * 0.05 // 0.03-0.08

      // Weighted random color pick
      let roll = Math.random() * totalWeight
      let chosenColor = 0xffffff
      for (const entry of palette) {
        roll -= entry.weight
        if (roll <= 0) { chosenColor = entry.color; break }
      }

      const star = this.add.circle(x, y, radius, chosenColor, baseAlpha)
      star.setDepth(-10)
      star.setData('baseAlpha', baseAlpha)
      this.starPool.push(star)
    }
  }

  // ---------------------------------------------------------------------------
  // Cloud layer
  // ---------------------------------------------------------------------------

  private initCloudLayer(): void {
    const CLOUD_COUNT = 5 // 4-6 clouds
    const CLOUD_COLOR = 0x94a3b8

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const gfx = this.add.graphics()
      gfx.setDepth(-9) // above stars (-10), below building elements

      // Scatter across sky area: wider than the world, y stays in upper 40% of world
      const x = Math.random() * 4200 - 100
      const y = Math.random() * (this.worldHeight * 0.4)

      // Each cloud has 2-3 overlapping blobs
      const blobCount = 2 + Math.floor(Math.random() * 2)
      const baseAlpha = 0.02 + Math.random() * 0.02 // 0.02-0.04

      gfx.setPosition(x, y)
      gfx.setAlpha(baseAlpha)
      gfx.setData('baseAlpha', baseAlpha)
      gfx.setData('blobCount', blobCount)
      gfx.setData('currentColor', CLOUD_COLOR)

      this.redrawCloud(gfx, CLOUD_COLOR)
      this.cloudPool.push(gfx)
    }
  }

  private redrawCloud(gfx: Phaser.GameObjects.Graphics, color: number): void {
    const blobCount = gfx.getData('blobCount') as number
    gfx.clear()

    // Draw 2-3 overlapping ellipses to form a soft hazy shape
    for (let b = 0; b < blobCount; b++) {
      const offsetX = (b - (blobCount - 1) / 2) * 45
      const offsetY = Math.sin(b * 1.4) * 12
      const w = 60 + Math.random() * 60  // 60-120px wide
      const h = w * (0.35 + Math.random() * 0.2) // roughly 35-55% of width tall

      gfx.fillStyle(color, 1)
      gfx.fillEllipse(offsetX, offsetY, w, h)
    }
  }

  private tickClouds(): void {
    if (this.cloudPool.length === 0) return
    const drift = 0.02
    const rightEdge = this.worldWidth + 300
    const leftWrap = -300

    for (const cloud of this.cloudPool) {
      cloud.x += drift
      if (cloud.x > rightEdge) {
        // Wrap back to the left with a slight y jitter for variety
        cloud.x = leftWrap
        cloud.y = Math.random() * (this.worldHeight * 0.4)
      }
    }
  }

  private tickStarfieldTwinkle(): void {
    if (this.starPool.length === 0) return
    const count = 3 + Math.floor(Math.random() * 3) // 3-5 stars per tick
    for (let i = 0; i < count; i++) {
      const star = this.starPool[Math.floor(Math.random() * this.starPool.length)]
      const baseAlpha = star.getData('baseAlpha') as number
      const currentAlpha = star.alpha

      // Peak is 2x the star's current alpha ceiling (respects day/night scaling)
      const peakAlpha = Math.min(currentAlpha * 2.5, 0.35)
      this.tweens.killTweensOf(star)
      this.tweens.add({
        targets: star,
        alpha: peakAlpha,
        duration: 700,
        ease: 'Sine.easeIn',
        yoyo: true,
        hold: 100,
        onComplete: () => {
          // Settle back to the phase-adjusted base alpha
          const phaseMultiplier =
            this.currentTimePhase === 'night' ? 1.5 :
            this.currentTimePhase === 'day'   ? 0.5 : 1.0
          this.tweens.add({
            targets: star,
            alpha: baseAlpha * phaseMultiplier,
            duration: 800,
            ease: 'Sine.easeOut',
          })
        },
      })
    }
  }

  private initParticlePool(): void {
    for (let i = 0; i < 80; i++) {
      const radius = 1 + Math.random() * 2
      const p = this.add.circle(0, 0, radius, 0xffffff, 0).setDepth(9998).setVisible(false)
      p.setData('busy', false)
      this.typingParticlePool.push(p)
    }
  }

  private spawnTypingParticle(worldX: number, worldY: number, isWaiting = false, isCompressing = false): void {
    const p = this.typingParticlePool.find(c => !c.getData('busy'))
    if (!p) return
    // Colors: theme-aware for working, amber for waiting, red for compressing
    const colors = isCompressing
      ? [0xf87171, 0xef4444, 0xfca5a5]
      : isWaiting
        ? [0xfbbf24, 0xf59e0b, 0xfcd34d]
        : activeTheme.particleColors.length > 0
          ? activeTheme.particleColors
          : [0x0ea5e9, 0x34d399, 0x22d3ee]
    const radius = 0.8 + Math.random() * 1.4
    p.setPosition(worldX + (Math.random() - 0.5) * 24, worldY)
    p.setFillStyle(colors[Math.floor(Math.random() * colors.length)])
    p.setRadius(radius)
    // Flash-in: start bright, decay quickly
    p.setAlpha(0.9).setVisible(true).setData('busy', true)
    const driftY = -8 - Math.random() * 18
    const driftX = (Math.random() - 0.5) * 24
    this.tweens.add({
      targets: p,
      y: worldY + driftY,
      x: p.x + driftX,
      alpha: 0,
      duration: 500 + Math.random() * 500,
      ease: 'Quad.easeOut',
      onComplete: () => { p.setVisible(false).setData('busy', false) },
    })
  }

  private tickParticles(): void {
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        const m = ws.state.sessionMode
        const isWorking = m === 'working' || m === 'plan'
        const isCompressing = m === 'compressing'
        const isWaiting = ws.state.needsInteraction
        if (!isWorking && !isWaiting && !isCompressing) continue
        const wx = room.x + ws.container.x
        const wy = room.y + ws.container.y + WS_DESK_Y + 2
        // Intensity scaling by mode
        const spawnCount = isCompressing ? 3 : m === 'plan' ? 2 : 1
        const spawnChance = isCompressing ? 0.25 : m === 'plan' ? 0.18 : 0.12
        for (let s = 0; s < spawnCount; s++) {
          if (Math.random() < spawnChance) this.spawnTypingParticle(wx, wy, isWaiting, isCompressing)
        }
      }
    }
  }

  private initRainPool(): void {
    const RAIN_COUNT = 40
    for (let i = 0; i < RAIN_COUNT; i++) {
      const len = 8 + Math.random() * 6           // 8–14px length
      const alpha = 0.15 + Math.random() * 0.10   // 0.15–0.25 alpha
      const speed = 3 + Math.random() * 2         // 3–5px per tick
      const x = Math.random() * this.viewWidth
      const y = Math.random() * this.viewHeight
      const drop = this.add.line(0, 0, x, y, x + 1, y + len, 0x60a5fa, alpha)
      drop.setOrigin(0, 0)
      drop.setLineWidth(1)
      drop.setDepth(9990)
      drop.setScrollFactor(0)
      drop.setVisible(false)
      drop.setData('speed', speed)
      this.rainDropPool.push(drop)
    }
  }

  private tickRain(): void {
    for (const drop of this.rainDropPool) {
      if (!drop.visible) continue
      const speed = drop.getData('speed') as number
      // geom.x1/y1/x2/y2 are the raw coordinates; shift the whole line via its position
      drop.x += 1
      drop.y += speed
      // When the top of the drop passes off the bottom, reset to the top
      const y1 = drop.geom.y1
      if (drop.y + y1 > this.viewHeight + 16) {
        drop.x = Math.random() * this.viewWidth
        drop.y = -16 - Math.random() * 80
      }
    }
  }

  private initSnowPool(): void {
    const SNOW_COUNT = 30
    for (let i = 0; i < SNOW_COUNT; i++) {
      const radius = 1 + Math.random() * 1.5 // 1–2.5px
      const alpha = 0.2 + Math.random() * 0.2 // 0.20–0.40
      const flake = this.add.circle(Math.random() * this.viewWidth, Math.random() * this.viewHeight, radius, 0xffffff, alpha)
      flake.setScrollFactor(0)
      flake.setDepth(9989)
      flake.setVisible(false)
      flake.setData('speed', 1 + Math.random())
      this.snowPool.push(flake)
    }
  }

  private tickSnow(time: number): void {
    for (let i = 0; i < this.snowPool.length; i++) {
      const flake = this.snowPool[i]
      if (!flake.visible) continue
      const speed = flake.getData('speed') as number
      flake.y += speed
      flake.x += Math.sin(time * 0.001 + i) * 0.5
      if (flake.y > this.viewHeight + 4) {
        flake.x = Math.random() * this.viewWidth
        flake.y = -4 - Math.random() * 40
      }
    }
  }

  private initAmbientMotePool(): void {
    // Shared constellation graphics layer — redrawn every tick
    this.constellationGfx = this.add.graphics().setDepth(1)

    for (let i = 0; i < AMBIENT_MOTE_POOL_SIZE; i++) {
      let m: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics

      if (i % 4 === 0) {
        // Diamond shape (rotated square) via Graphics
        const gfx = this.add.graphics().setDepth(2).setVisible(false)
        const s = 1.6 + Math.random() * 0.8
        gfx.fillStyle(0xe2e8f0, 1)
        gfx.fillPoints([{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }], true)
        gfx.setData('isDiamond', true)
        gfx.setData('baseSize', s)
        m = gfx
      } else {
        const r = 0.9 + Math.random() * 1.3
        const arc = this.add.circle(0, 0, r, 0xe2e8f0, 0).setDepth(2).setVisible(false)
        arc.setData('isDiamond', false)
        m = arc
      }

      // Per-mote animation state — driven by sine waves each tick, no tweens
      m.setData('busy', false)
      m.setData('phaseOffset', Math.random() * Math.PI * 2)
      m.setData('moteIndex', i)
      m.setData('originX', 0)
      m.setData('originY', 0)
      m.setData('driftX', 0)
      m.setData('driftY', 0)
      m.setData('lifetime', 0)
      m.setData('elapsed', 0)
      m.setData('baseAlpha', 0)

      this.ambientMotePool.push(m)
    }
  }

  // ---------------------------------------------------------------------------
  // Corridor data-flow particle trail
  // ---------------------------------------------------------------------------

  private initCorridorParticlePool(): void {
    for (let i = 0; i < 20; i++) {
      const arc = this.add.circle(0, 0, 1.5, 0xffffff, 0).setDepth(-1).setVisible(false)
      arc.setData('busy', false)
      this.corridorParticlePool.push(arc)
    }
  }

  // ---------------------------------------------------------------------------
  // Alert ripple pool — sound-wave rings for blocked/waiting agents
  // ---------------------------------------------------------------------------

  private initAlertRipplePool(): void {
    for (let i = 0; i < 10; i++) {
      const circle = this.add.circle(0, 0, 1, 0xffffff, 0).setDepth(100).setVisible(false)
      circle.setData('busy', false)
      this.alertRipplePool.push(circle)
    }
  }

  private spawnAlertRipple(worldX: number, worldY: number, color: number): void {
    const circle = this.alertRipplePool.find(c => !c.getData('busy'))
    if (!circle) return

    circle.setPosition(worldX, worldY)
    circle.setRadius(4)
    circle.setFillStyle(color, 0)
    circle.setStrokeStyle(1.5, color, 0.4)
    circle.setAlpha(0.4)
    circle.setScale(1)
    circle.setVisible(true)
    circle.setData('busy', true)

    this.tweens.add({
      targets: circle,
      scaleX: 7.5,
      scaleY: 7.5,
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => {
        circle.setVisible(false)
        circle.setScale(1)
        circle.setData('busy', false)
      },
    })
  }

  private tickCorridorParticles(): void {
    if (this.corridorSegments.length === 0) return

    // Only spawn when at least one agent is actively working
    const hasActiveAgent = this.agents.some(
      a => (a.sessionMode === 'working' || a.sessionMode === 'plan') && !a.needsInteraction,
    )
    if (!hasActiveAgent) return

    const free = this.corridorParticlePool.find(p => !p.getData('busy'))
    if (!free) return

    const seg = this.corridorSegments[Math.floor(Math.random() * this.corridorSegments.length)]
    const palette = activeTheme.particleColors
    const color = palette[Math.floor(Math.random() * palette.length)]
    const targetAlpha = 0.2 + Math.random() * 0.2
    const travelDuration = 800 + Math.random() * 400

    free.setFillStyle(color)
    free.setPosition(seg.x1, seg.y1)
    free.setAlpha(0)
    free.setVisible(true)
    free.setData('busy', true)

    // Fade in over 100ms, then tween to destination with fade-out over the last 15%
    this.tweens.add({
      targets: free,
      alpha: targetAlpha,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: free,
          x: seg.x2,
          y: seg.y2,
          duration: travelDuration,
          ease: 'Sine.easeInOut',
          onUpdate: (_tween: Phaser.Tweens.Tween, _target: unknown, _key: string, _value: number, _start: number, progress: number) => {
            if (progress > 0.85) {
              free.setAlpha(targetAlpha * (1 - (progress - 0.85) / 0.15))
            }
          },
          onComplete: () => {
            free.setVisible(false)
            free.setAlpha(0)
            free.setData('busy', false)
          },
        })
      },
    })
  }

  private spawnAmbientMote(): void {
    const mote = this.ambientMotePool.find(m => !m.getData('busy'))
    if (!mote) return

    const view = this.cameras.main.worldView
    const x = view.x + Math.random() * view.width
    const y = view.y + Math.random() * view.height

    // Pick a random color from the active theme palette
    const palette = activeTheme.particleColors
    const color = palette[Math.floor(Math.random() * palette.length)]

    if (mote.getData('isDiamond')) {
      const gfx = mote as Phaser.GameObjects.Graphics
      const s = mote.getData('baseSize') as number
      gfx.clear()
      gfx.fillStyle(color, 1)
      gfx.fillPoints([{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }], true)
    } else {
      ;(mote as Phaser.GameObjects.Arc).setFillStyle(color)
    }

    const baseAlpha = 0.18 + Math.random() * 0.18
    const lifetime = 2600 + Math.random() * 2200

    mote.setPosition(x, y)
    mote.setAlpha(baseAlpha)
    mote.setVisible(true)
    mote.setData('busy', true)
    mote.setData('originX', x)
    mote.setData('originY', y)
    mote.setData('driftX', (Math.random() - 0.5) * 16)
    mote.setData('driftY', -18 - Math.random() * 24)
    mote.setData('lifetime', lifetime)
    mote.setData('elapsed', 0)
    mote.setData('baseAlpha', baseAlpha)
  }

  private tickAmbientMotes(): void {
    if (this.rooms.size === 0) return
    if (this.cameras.main.zoom < 0.62) return
    if (Math.random() < 0.55) this.spawnAmbientMote()

    const time = this.time.now
    const delta = this.game.loop.delta

    // Advance each active mote manually (sine drift + brightness twinkle)
    const activePositions: { x: number; y: number }[] = []

    for (const mote of this.ambientMotePool) {
      if (!mote.getData('busy')) continue

      const elapsed: number = (mote.getData('elapsed') as number) + delta
      const lifetime: number = mote.getData('lifetime') as number
      const progress = elapsed / lifetime // 0 → 1

      if (progress >= 1) {
        mote.setVisible(false)
        mote.setData('busy', false)
        continue
      }

      mote.setData('elapsed', elapsed)

      const originX = mote.getData('originX') as number
      const originY = mote.getData('originY') as number
      const driftX = mote.getData('driftX') as number
      const driftY = mote.getData('driftY') as number
      const phase = mote.getData('phaseOffset') as number
      const idx = mote.getData('moteIndex') as number
      const baseAlpha = mote.getData('baseAlpha') as number

      // Sine-wave lateral sway with a unique phase offset per mote
      const sway = Math.sin(time * 0.001 + idx + phase) * 6

      mote.setPosition(originX + driftX * progress + sway, originY + driftY * progress)

      // Brightness twinkle: alpha oscillates 0.15–0.4, faded by quadratic progress
      const fadeOut = 1 - progress * progress
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.0023 + phase * 1.7)
      mote.setAlpha(Math.min(baseAlpha, Math.max(0, (0.15 + twinkle * 0.25) * fadeOut)))

      // Collect world-space center for constellation pass
      const anyMote = mote as unknown as { getCenter?: () => { x: number; y: number } }
      const center = anyMote.getCenter ? anyMote.getCenter() : { x: mote.x, y: mote.y }
      activePositions.push({ x: center.x, y: center.y })
    }

    // Constellation lines: faint connections between nearby mote pairs
    const cgfx = this.constellationGfx
    if (cgfx) {
      cgfx.clear()
      let connections = 0
      const maxConnections = 4
      const threshSq = 60 * 60
      outer: for (let i = 0; i < activePositions.length - 1; i++) {
        for (let j = i + 1; j < activePositions.length; j++) {
          const dx = activePositions[i].x - activePositions[j].x
          const dy = activePositions[i].y - activePositions[j].y
          if (dx * dx + dy * dy < threshSq) {
            cgfx.lineStyle(0.5, 0xffffff, 0.05 + Math.random() * 0.05)
            cgfx.beginPath()
            cgfx.moveTo(activePositions[i].x, activePositions[i].y)
            cgfx.lineTo(activePositions[j].x, activePositions[j].y)
            cgfx.strokePath()
            if (++connections >= maxConnections) break outer
          }
        }
      }
    }
  }

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

  private drawVignetteOverlay(): void {
    const g = this.vignetteOverlay
    if (!g) return
    g.clear()

    const w = this.viewWidth
    const h = this.viewHeight
    if (w <= 0 || h <= 0) return

    // Layered edge strips approximate a cheap vignette without extra textures.
    const layers = 5
    const baseThickness = Math.max(12, Math.round(Math.min(w, h) * 0.03))
    for (let i = 0; i < layers; i++) {
      const t = baseThickness + i * 8
      const alpha = 0.035 - i * 0.005
      if (alpha <= 0) break
      g.fillStyle(COLOR_VIGNETTE, alpha)
      g.fillRect(0, i * 2, w, t)                  // top
      g.fillRect(0, h - t - i * 2, w, t)          // bottom
      g.fillRect(i * 2, 0, t, h)                  // left
      g.fillRect(w - t - i * 2, 0, t, h)          // right
    }
  }

  // ---------------------------------------------------------------------------
  // Coffee steam particles (idle-only)
  // ---------------------------------------------------------------------------

  private spawnSteamParticles(ws: WorkstationSprite): void {
    if (!ws.steamContainer) return
    // Clear any lingering particles before spawning a fresh wave
    this.clearSteamParticles(ws)

    const container = ws.steamContainer
    const tweens: Phaser.Tweens.Tween[] = []

    for (let i = 0; i < 3; i++) {
      // Slight horizontal spread around the mug center
      const xOff = (i - 1) * 2.5 + (Math.random() - 0.5)
      const initAlpha = 0.3 + Math.random() * 0.2   // 0.3–0.5
      const riseY    = -12 - Math.random() * 6       // -12 to -18 px
      const duration = 1200 + Math.random() * 600    // 1200–1800 ms
      const swayAmp  = 2 + Math.random()             // ±2–3 px

      const particle = this.add.circle(xOff, 0, 1.5, 0xffffff, initAlpha)
      container.add(particle)

      const tween = this.tweens.add({
        targets: particle,
        y: riseY,
        alpha: 0,
        duration,
        delay: i * 400,
        ease: 'Sine.easeOut',
        onUpdate: (tw: Phaser.Tweens.Tween) => {
          // Sine X sway as the particle rises
          const progress = tw.progress
          particle.x = xOff + Math.sin(progress * Math.PI * 2) * swayAmp
        },
        onComplete: () => {
          // Remove this particle from the container and destroy it
          container.remove(particle, true)
        },
      })
      tweens.push(tween)
    }

    ws.steamTweens = tweens

    // Schedule the next wave once the slowest particle finishes (~1.8s + max delay 800ms)
    const respawnDelay = 1800 + 3 * 400 + 200
    const respawnTimer = this.time.delayedCall(respawnDelay, () => {
      // Only respawn if the workstation is still in idle mode
      if (ws.lastAnimMode === 'idle' && ws.steamContainer) {
        this.spawnSteamParticles(ws)
      }
    })
    // Piggyback the timer onto steamTweens so clearSteamParticles can cancel it
    ;(ws as unknown as { _steamRespawnTimer?: Phaser.Time.TimerEvent })._steamRespawnTimer = respawnTimer
  }

  private clearSteamParticles(ws: WorkstationSprite): void {
    // Cancel pending respawn timer
    const typed = ws as unknown as { _steamRespawnTimer?: Phaser.Time.TimerEvent }
    if (typed._steamRespawnTimer) {
      typed._steamRespawnTimer.destroy()
      typed._steamRespawnTimer = undefined
    }
    // Stop and discard all active particle tweens
    if (ws.steamTweens) {
      for (const t of ws.steamTweens) {
        if (t && t.isPlaying()) t.stop()
        t.destroy()
      }
      ws.steamTweens = []
    }
    // Remove any leftover particle circles still sitting in the container
    if (ws.steamContainer) {
      ws.steamContainer.removeAll(true)
    }
  }

  // ---------------------------------------------------------------------------
  // Confetti burst
  // ---------------------------------------------------------------------------

  private burstConfetti(x: number, y: number): void {
    const colors = activeTheme.particleColors
    const count = 12 + Math.floor(Math.random() * 5) // 12–16

    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)]
      const rect = this.add.rectangle(x, y, 3, 3, color, 1)
      rect.setDepth(500)

      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 60      // 40–100 px/s equivalent
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      const duration = 600 + Math.random() * 300  // 600–900ms
      const rotationDeg = (Math.random() - 0.5) * 720

      this.tweens.add({
        targets: rect,
        x: x + vx * (duration / 1000),
        y: y + vy * (duration / 1000) + 60,      // +60 simulates gravity drop
        angle: rotationDeg,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => { rect.destroy() },
      })
    }
  }

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
    this.clearSteamParticles(ws)

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
      this.spawnSteamParticles(ws)

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
            this.burstConfetti(worldX, worldY)
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
    if (!ws.monitorGlowOverlay) return
    ws.monitorGlowOverlay.setVisible(true)
    const isActive = isWorking || isWaiting
    const baseColor = isWaiting ? 0xfbbf24 : isWorking ? 0x0ea5e9 : 0x94a3b8
    const baseAlpha = isActive ? 0.35 : 0.12
    const peakAlpha = isActive ? 0.6 : 0.25
    const duration  = isActive ? 800 : 2400
    ws.monitorGlowOverlay.setFillStyle(baseColor)
    ws.monitorGlowOverlay.setAlpha(baseAlpha)
    ws.monitorGlowTween = this.tweens.add({
      targets: ws.monitorGlowOverlay, alpha: peakAlpha,
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
    if (ws.monitorGlowOverlay) ws.monitorGlowOverlay.setVisible(showFull)
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
  // Day/night cycle
  // ---------------------------------------------------------------------------

  private getTimePhase(): {
    phase: 'morning' | 'day' | 'evening' | 'night'
    color: number
    alpha: number
    bgColor: number
    glowMultiplier: number
  } {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 10) {
      return { phase: 'morning', color: 0xffa500, alpha: 0.06, bgColor: 0x151a24, glowMultiplier: 1.0 }
    } else if (hour >= 10 && hour < 17) {
      return { phase: 'day', color: 0x000000, alpha: 0.0, bgColor: 0x111827, glowMultiplier: 1.0 }
    } else if (hour >= 17 && hour < 20) {
      return { phase: 'evening', color: 0xff6a00, alpha: 0.08, bgColor: 0x14161f, glowMultiplier: 1.2 }
    } else {
      return { phase: 'night', color: 0x1a3a6a, alpha: 0.14, bgColor: 0x0a0e18, glowMultiplier: 1.6 }
    }
  }

  private tickWindowGlint(time: number): void {
    const gfx = this.windowGlintGfx
    if (!gfx || this.windowPositions.length === 0) return

    // Start a new glint sweep every GLINT_INTERVAL ms
    if (this.glintActiveWindow === -1 && time - this.lastGlintAt >= this.GLINT_INTERVAL) {
      this.glintActiveWindow = Math.floor(Math.random() * this.windowPositions.length)
      this.glintStartTime = time
      this.lastGlintAt = time
    }

    gfx.clear()
    if (this.glintActiveWindow === -1) return

    const win = this.windowPositions[this.glintActiveWindow]
    const elapsed = time - this.glintStartTime
    const t = Math.min(elapsed / this.GLINT_DURATION, 1)

    if (t >= 1) {
      this.glintActiveWindow = -1
      return
    }

    // Thin vertical bar sweeping left to right across the window
    const barW = 3
    const barX = win.x + t * (win.w - barW)
    gfx.fillStyle(0xffffff, 0.15)
    gfx.fillRect(barX, win.y, barW, win.h)
  }

  private applyDayNightCycle(animate: boolean): void {
    const { phase, color, alpha, bgColor, glowMultiplier } = this.getTimePhase()
    if (phase === this.currentTimePhase && animate) return
    this.currentTimePhase = phase

    // Draw sky gradient for new phase
    this.drawSkyGradient(phase)

    // Update window tint based on time of day and force a redraw
    if (phase === 'morning') {
      this.windowTintColor = 0xfde68a
      this.windowTintAlpha = 0.08
    } else if (phase === 'day') {
      this.windowTintColor = 0x7dd3fc
      this.windowTintAlpha = 0.16
    } else if (phase === 'evening') {
      this.windowTintColor = 0xfbbf24
      this.windowTintAlpha = 0.06
    } else {
      // night: interior glow suggesting lights inside
      this.windowTintColor = 0xfef3c7
      this.windowTintAlpha = 0.12
    }
    this.lastOfficeBgW = 0 // invalidate cache so drawOfficeBackground redraws with new tint

    // Set shadow angle based on simulated sun position for this phase
    if (phase === 'morning') {
      this.shadowAngle = -0.3   // light from the right, shadows lean left
    } else if (phase === 'day') {
      this.shadowAngle = 0      // overhead light, shadows fall straight down
    } else if (phase === 'evening') {
      this.shadowAngle = 0.3    // light from the left, shadows lean right
    } else {
      this.shadowAngle = 0      // night: ambient ceiling light, no directional bias
    }

    const overlay = this.dayNightOverlay
    if (!overlay) return

    this.cameras.main.setBackgroundColor(bgColor)

    if (animate) {
      this.tweens.killTweensOf(overlay)
      overlay.setFillStyle(color)
      this.tweens.add({ targets: overlay, alpha, duration: 3000, ease: 'Sine.easeInOut' })
    } else {
      overlay.setFillStyle(color)
      overlay.setAlpha(alpha)
    }

    // Adjust monitor glow and lamp brightness
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (ws.monitorGlowOverlay) {
          ws.monitorGlowOverlay.setScale(0.8 + (glowMultiplier - 1.0) * 0.5)
        }
      }
    }

    // Starfield alpha — more visible at night, barely perceptible during the day
    for (const star of this.starPool) {
      const baseAlpha = star.getData('baseAlpha') as number
      let targetAlpha: number
      if (phase === 'night') {
        targetAlpha = baseAlpha * 1.5
      } else if (phase === 'day') {
        targetAlpha = baseAlpha * 0.5
      } else {
        // morning / evening — base alpha
        targetAlpha = baseAlpha
      }
      if (animate) {
        this.tweens.killTweensOf(star)
        this.tweens.add({ targets: star, alpha: targetAlpha, duration: 3000, ease: 'Sine.easeInOut' })
      } else {
        star.setAlpha(targetAlpha)
      }
    }

    // Cloud layer — redraw each cloud Graphics with phase-appropriate color and alpha
    for (const cloud of this.cloudPool) {
      const baseAlpha = cloud.getData('baseAlpha') as number
      let targetAlpha: number
      let targetColor: number
      if (phase === 'night') {
        targetAlpha = baseAlpha * 1.3
        targetColor = 0x475569
      } else if (phase === 'morning') {
        targetAlpha = baseAlpha
        targetColor = 0xcbd5e1
      } else {
        // day / evening
        targetAlpha = baseAlpha
        targetColor = 0x94a3b8
      }
      cloud.setData('currentColor', targetColor)
      if (animate) {
        this.tweens.killTweensOf(cloud)
        this.tweens.add({ targets: cloud, alpha: targetAlpha, duration: 3000, ease: 'Sine.easeInOut' })
      } else {
        cloud.setAlpha(targetAlpha)
      }
      // Redraw the cloud shape with the new color
      this.redrawCloud(cloud, targetColor)
    }

    // Rain: only visible during night phase
    const shouldRain = phase === 'night'
    if (shouldRain !== this.rainActive) {
      this.rainActive = shouldRain
      for (const drop of this.rainDropPool) {
        if (shouldRain) {
          // Scatter drops randomly across screen on activation
          drop.x = Math.random() * this.viewWidth
          drop.y = -16 - Math.random() * this.viewHeight
          drop.setVisible(true)
        } else {
          drop.setVisible(false)
        }
      }
    }

    // Snow: only visible during morning phase — soft, slow, peaceful
    const shouldSnow = phase === 'morning'
    if (shouldSnow !== this.snowActive) {
      this.snowActive = shouldSnow
      for (const flake of this.snowPool) {
        if (shouldSnow) {
          // Scatter flakes across the full viewport on activation
          flake.x = Math.random() * this.viewWidth
          flake.y = Math.random() * this.viewHeight
          flake.setVisible(true)
        } else {
          flake.setVisible(false)
        }
      }
    }

    // Exterior lights — tween container alpha so all child fixtures change together.
    // Individual children were created with relative alphas (bulb full, halo/pool at
    // fractions), so animating the container preserves those ratios automatically.
    if (this.exteriorLights) {
      const extAlphaMap: Record<string, number> = {
        morning: 0.02,
        day: 0.0,
        evening: 0.06,
        night: 0.12,
      }
      const extTarget = extAlphaMap[phase] ?? 0.0
      if (animate) {
        this.tweens.killTweensOf(this.exteriorLights)
        this.tweens.add({
          targets: this.exteriorLights,
          alpha: extTarget,
          duration: 500,
          ease: 'Sine.easeInOut',
        })
      } else {
        this.exteriorLights.setAlpha(extTarget)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sky gradient (day/night background layer, depth -11)
  // ---------------------------------------------------------------------------

  private drawSkyGradient(phase: string): void {
    const g = this.skyGradient
    if (!g) return
    g.clear()
    const W = 8000
    const H = 8000
    const STRIPS = 200
    const stripH = H / STRIPS
    let topColor: number
    let midColor: number | null
    let midT: number
    let bottomColor: number
    if (phase === 'morning') {
      topColor = 0x1e1b4b
      midColor = 0xf97316
      midT = 0.55
      bottomColor = 0xfde68a
    } else if (phase === 'day') {
      topColor = 0x0c4a6e
      midColor = null
      midT = 0.5
      bottomColor = 0x7dd3fc
    } else if (phase === 'evening') {
      topColor = 0x1e1b4b
      midColor = 0x9333ea
      midT = 0.5
      bottomColor = 0xf97316
    } else {
      topColor = 0x030712
      midColor = null
      midT = 0.5
      bottomColor = 0x111827
    }
    const ALPHA = 0.18
    for (let i = 0; i < STRIPS; i++) {
      const t = i / (STRIPS - 1)
      let c: number
      if (midColor !== null) {
        c =
          t < midT
            ? lerpColor(topColor, midColor, t / midT)
            : lerpColor(midColor, bottomColor, (t - midT) / (1 - midT))
      } else {
        c = lerpColor(topColor, bottomColor, t)
      }
      g.fillStyle(c, ALPHA)
      g.fillRect(0, i * stripH, W, stripH + 1)
    }
  }

  // ---------------------------------------------------------------------------
  // Dynamic shadows (day/night light source movement)
  // ---------------------------------------------------------------------------

  private updateShadows(): void {
    const phase = this.currentTimePhase
    let shadowAlpha: number
    let shadowWidth: number

    if (phase === 'morning') {
      shadowAlpha = 0.15
      shadowWidth = 20
    } else if (phase === 'day') {
      shadowAlpha = 0.25
      shadowWidth = 22
    } else if (phase === 'evening') {
      shadowAlpha = 0.15
      shadowWidth = 20
    } else {
      // night: dim ambient, tighter ellipse
      shadowAlpha = 0.08
      shadowWidth = 15
    }

    const xOffset = this.shadowAngle * 8

    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.shadow) continue
        ws.shadow.x = xOffset
        ws.shadow.setAlpha(shadowAlpha)
        ws.shadow.width = shadowWidth
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Analog wall clock
  // ---------------------------------------------------------------------------

  private tickWallClock(): void {
    const hourHand = this.clockHourHand
    const minuteHand = this.clockMinuteHand
    const secondHand = this.clockSecondHand
    if (!hourHand || !minuteHand || !secondHand) return

    const now = new Date()
    const h = now.getHours() % 12
    const m = now.getMinutes()
    const s = now.getSeconds()

    const secAngle   = Phaser.Math.DegToRad((s / 60) * 360 - 90)
    const minAngle   = Phaser.Math.DegToRad((m / 60) * 360 + (s / 60) * 6 - 90)
    const hourAngle  = Phaser.Math.DegToRad((h / 12) * 360 + (m / 60) * 30 - 90)

    secondHand.clear()
    secondHand.lineStyle(0.5, 0xef4444, 1)
    secondHand.lineBetween(0, 0, Math.cos(secAngle) * 10, Math.sin(secAngle) * 10)

    minuteHand.clear()
    minuteHand.lineStyle(1, 0xcbd5e1, 1)
    minuteHand.lineBetween(0, 0, Math.cos(minAngle) * 9, Math.sin(minAngle) * 9)

    hourHand.clear()
    hourHand.lineStyle(1.5, 0xe2e8f0, 1)
    hourHand.lineBetween(0, 0, Math.cos(hourAngle) * 6, Math.sin(hourAngle) * 6)

    // Clock chime on the hour
    const hour = now.getHours()
    if (hour !== this.lastChimeHour && m === 0 && s < 2) {
      this.lastChimeHour = hour
      this.triggerChimeRipple()
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      this.showToast(`${displayHour}:00`, 'info')
    }
  }

  private initChimeRipplePool(): void {
    for (let i = 0; i < 3; i++) {
      const circle = this.add
        .circle(0, 0, 1, 0xfbbf24, 0)
        .setDepth(-0.4)
        .setVisible(false)
      circle.setData('busy', false)
      this.chimeRipplePool.push(circle)
    }
  }

  private initEmojiReactionPool(): void {
    for (let i = 0; i < 10; i++) {
      const label = this.add
        .text(0, 0, '', { fontSize: '12px', resolution: 2 })
        .setDepth(500)
        .setAlpha(0)
        .setData('busy', false)
      this.emojiReactionPool.push(label)
    }
  }

  private spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void {
    const label = this.emojiReactionPool.find(t => !t.getData('busy'))
    if (!label) return
    const sway = (Math.random() - 0.5) * 16
    label.setText(emoji)
    label.setPosition(worldX + sway, worldY - 20)
    label.setAlpha(0)
    label.setData('busy', true)
    this.tweens.add({
      targets: label,
      alpha: 1,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          y: label.y - 30,
          alpha: 0,
          duration: 1200,
          ease: 'Sine.easeOut',
          onComplete: () => {
            label.setAlpha(0)
            label.setData('busy', false)
          },
        })
      },
    })
  }

  private initMouseTrailPool(): void {
    const palette = activeTheme.particleColors
    for (let i = 0; i < 15; i++) {
      const color = palette[i % palette.length]
      const circle = this.add
        .circle(0, 0, 1, color, 0)
        .setDepth(9990)
        .setAlpha(0)
        .setVisible(false)
      circle.setData('busy', false)
      this.mouseTrailPool.push(circle)
    }
  }

  private triggerChimeRipple(): void {
    if (!this.wallClockContainer) return

    // Resolve clock world position from its container
    const wx = this.wallClockContainer.x
    const wy = this.wallClockContainer.y

    const delays = [0, 200, 400]
    for (let i = 0; i < this.chimeRipplePool.length; i++) {
      const circle = this.chimeRipplePool[i]
      if (circle.getData('busy')) continue
      circle.setPosition(wx, wy)
      circle.setRadius(4)
      circle.setFillStyle(0xfbbf24, 0.3)
      circle.setScale(1)
      circle.setAlpha(0.3)
      circle.setVisible(true)
      circle.setData('busy', true)

      this.time.delayedCall(delays[i], () => {
        this.tweens.add({
          targets: circle,
          scaleX: 10,
          scaleY: 10,
          alpha: 0,
          duration: 1000,
          ease: 'Sine.easeOut',
          onComplete: () => {
            circle.setVisible(false)
            circle.setScale(1)
            circle.setAlpha(0.3)
            circle.setData('busy', false)
          },
        })
      })
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

    this.dayNightTimer?.destroy()
    this.dayNightTimer = null
    this.dayNightOverlay?.destroy()
    this.dayNightOverlay = null
    this.skyGradient?.destroy()
    this.skyGradient = null
    this.vignetteOverlay?.destroy()
    this.vignetteOverlay = null

    this.typingParticleTimer?.destroy()
    this.typingParticleTimer = null
    for (const p of this.typingParticlePool) { this.tweens.killTweensOf(p); p.destroy() }
    this.typingParticlePool = []
    this.ambientMoteTimer?.destroy()
    this.ambientMoteTimer = null
    for (const m of this.ambientMotePool) { this.tweens.killTweensOf(m); m.destroy() }
    this.ambientMotePool = []
    this.constellationGfx?.destroy()
    this.constellationGfx = null
    this.corridorParticleTimer?.destroy()
    this.corridorParticleTimer = null
    for (const p of this.corridorParticlePool) { this.tweens.killTweensOf(p); p.destroy() }
    this.corridorParticlePool = []
    for (const s of this.starPool) { this.tweens.killTweensOf(s); s.destroy() }
    this.starPool = []
    this.cloudTimer?.destroy()
    this.cloudTimer = null
    for (const c of this.cloudPool) { this.tweens.killTweensOf(c); c.destroy() }
    this.cloudPool = []
    for (const d of this.rainDropPool) d.destroy()
    this.rainDropPool = []
    this.rainActive = false
    for (const f of this.snowPool) f.destroy()
    this.snowPool = []
    this.snowActive = false
    for (const c of this.alertRipplePool) { this.tweens.killTweensOf(c); c.destroy() }
    this.alertRipplePool = []
    for (const c of this.chimeRipplePool) { this.tweens.killTweensOf(c); c.destroy() }
    this.chimeRipplePool = []
    for (const t of this.emojiReactionPool) { this.tweens.killTweensOf(t); t.destroy() }
    this.emojiReactionPool = []
    for (const c of this.mouseTrailPool) { this.tweens.killTweensOf(c); c.destroy() }
    this.mouseTrailPool = []

    // Café cleanup
    if (this.coffeeRunTimer) { this.coffeeRunTimer.destroy(); this.coffeeRunTimer = null }
    if (this.cafeVisitorTimer) { this.cafeVisitorTimer.destroy(); this.cafeVisitorTimer = null }
    if (this.cafeSteamTimer) { this.cafeSteamTimer.destroy(); this.cafeSteamTimer = null }
    this.coffeeRunners.clear()
    this.coffeeRunnerRooms.clear()
    if (this.cafeContainer) { this.cafeContainer.destroy(true); this.cafeContainer = null }
    this.cafeBaristas = []

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

    this.destroyCeilingLights()

    if (this.exteriorLights) {
      this.tweens.killTweensOf(this.exteriorLights)
      this.exteriorLights.destroy()
      this.exteriorLights = null
    }

    this.wallClockContainer?.destroy()
    this.wallClockContainer = null
    this.clockHourHand = null
    this.clockMinuteHand = null
    this.clockSecondHand = null

    this.windowGlintGfx?.destroy()
    this.windowGlintGfx = null
    this.windowPositions = []
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
