import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState } from '../types'
import { activeTheme, setActiveTheme, lerpColor, THEMES, type ThemeName } from './office-theme'

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

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHAR_SCALE      = 0.134
const WORKSTATION_W   = 70 // ~20% tighter office footprint
const WORKSTATION_H   = 77 // ~20% tighter office footprint
const ROOM_PADDING    = 12
const ROOM_TOP_EXTRA  = 30   // extra top padding so thought bubbles clear room headers
const ROOM_HEADER_H   = 20
const ROOM_GAP        = 10
const MAX_AGENTS_PER_ROW = 4
const TEAM_AREA_PAD_X = 18
const TEAM_AREA_PAD_Y = 18
const TEAM_AREA_GAP_X = 18
const TEAM_AREA_GAP_Y = 16
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
const ZOOM_MIN_OVERVIEW = 0.35
const ZOOM_MAX = 2.0
const ZOOM_FIT_MAX = 1.14
const ZOOM_LERP_SPEED = 0.08
const FOLLOW_LERP_SPEED = 0.06
const LOD_ZOOM_THRESHOLD = 0.65
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
  lastAnimMode?: 'idle' | 'working' | 'waiting'
  lastStateFingerprint?: string
  lodDetailObjects: Phaser.GameObjects.GameObject[]
  lookAroundTimer?: Phaser.Time.TimerEvent
  stretchTimer?: Phaser.Time.TimerEvent
  walkBreakTimer?: Phaser.Time.TimerEvent
  walkBreakTween?: Phaser.Tweens.Tween
  blockedIndicatorTween?: Phaser.Tweens.Tween
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

  // Office background (standalone, not a container)
  private officeGraphics: Phaser.GameObjects.Graphics | null = null
  private teamAreaGraphics: Phaser.GameObjects.Graphics | null = null
  private corridorGraphics: Phaser.GameObjects.Graphics | null = null
  private hallwayIndicatorGraphics: Phaser.GameObjects.Graphics | null = null
  private officeDecoSprites: Phaser.GameObjects.Sprite[] = []
  private teamAreaLabels: Phaser.GameObjects.Text[] = []
  private corridorSegments: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }> = []
  private lastOfficeBgW = 0
  private lastOfficeBgH = 0

  // Typing spark particles
  private typingParticlePool: Phaser.GameObjects.Arc[] = []
  private typingParticleTimer: Phaser.Time.TimerEvent | null = null
  private ambientMotePool: Phaser.GameObjects.Arc[] = []
  private ambientMoteTimer: Phaser.Time.TimerEvent | null = null

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
  private dayNightTimer: Phaser.Time.TimerEvent | null = null
  private currentTimePhase: 'morning' | 'day' | 'evening' | 'night' = 'day'
  // Subtle screen-space edge shading to frame the office.
  private vignetteOverlay: Phaser.GameObjects.Graphics | null = null

  // Keyboard selection state
  private selectedAgentIndex = -1
  private selectionRing: Phaser.GameObjects.Graphics | null = null
  private selectionRingTween: Phaser.Tweens.Tween | null = null

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
  private lastLodVisible = true
  private minimapContainer: Phaser.GameObjects.Container | null = null
  private minimapGraphics: Phaser.GameObjects.Graphics | null = null
  private minimapViewport: Phaser.GameObjects.Graphics | null = null
  private minimapHitZone: Phaser.GameObjects.Rectangle | null = null
  private minimapProjection: MinimapProjection | null = null
  private minimapPanning = false
  private minimapDirty = true
  private minimapRoomFlashes = new Map<string, { until: number; color: number }>()
  private lastMinimapDrawAt = 0
  private lastCamScrollX = 0
  private lastCamScrollY = 0
  private lastCamZoom = 1
  private tripletDirty = true
  private lastTripletDrawAt = 0
  private lastHallwayPulseAt = 0
  private compactLayoutEnabled = true
  private overviewZoomEnabled = false

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
    this.teamAreaGraphics.setDepth(-3)
    this.corridorGraphics.setDepth(-2)
    this.hallwayIndicatorGraphics.setDepth(-1)

    // Typing spark particle pool
    this.initParticlePool()
    this.typingParticleTimer = this.time.addEvent({
      delay: 200, callback: () => this.tickParticles(), loop: true,
    })
    this.initAmbientMotePool()
    this.ambientMoteTimer = this.time.addEvent({
      delay: 420,
      callback: () => this.tickAmbientMotes(),
      loop: true,
    })

    // Camera pan -- cancel follow on manual drag
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.isDraggingAgent) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
        this.followTarget = null
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

    // Double-click on empty space resets camera (zoom-to-fit)
    let lastSceneClickTime = 0
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const now = Date.now()
      if (now - lastSceneClickTime < 350) {
        const wp = cam.getWorldPoint(p.x, p.y)
        if (!this.getAgentAtWorldPoint(wp.x, wp.y)) {
          this.zoomToFit(true)
        }
      }
      lastSceneClickTime = now
    })

    // Resize — re-layout rooms when viewport changes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.viewWidth  = gameSize.width
      this.viewHeight = gameSize.height
      // Invalidate office bg cache so it redraws to new width
      this.lastOfficeBgW = 0
      this.lastOfficeBgH = 0
      if (this.rooms.size > 0) {
        this.layoutRooms()
        this.updateCameraBounds()
      }
      this.repositionMinimap()
      this.drawVignetteOverlay()
      this.minimapDirty = true
    })

    // Save default camera position for R reset
    this.defaultCameraX = cam.scrollX
    this.defaultCameraY = cam.scrollY
    this.defaultCameraZoom = cam.zoom

    // Selection ring graphic (drawn in world space, repositioned on select)
    this.selectionRing = this.add.graphics().setDepth(9999)

    // -----------------------------------------------------------------------
    // Keyboard shortcuts -- use Phaser keyboard events so they don't leak to React
    // -----------------------------------------------------------------------
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-TAB', (e: KeyboardEvent) => {
        e.preventDefault()
        this.cycleSelectedAgent(e.shiftKey ? -1 : 1)
      })

      this.input.keyboard.on('keydown-ENTER', (e: KeyboardEvent) => {
        e.preventDefault()
        this.confirmSelectedAgent()
      })

      this.input.keyboard.on('keydown-ESC', (e: KeyboardEvent) => {
        e.preventDefault()
        this.deselectAgent()
        this.stopAutoPan()
      })

      this.input.keyboard.on('keydown-F', () => { this.zoomToFitAll() })
      this.input.keyboard.on('keydown-R', () => { this.resetCamera() })
      this.input.keyboard.on('keydown-SPACE', (e: KeyboardEvent) => {
        e.preventDefault()
        this.toggleAutoPan()
      })

      // +/= and - for zoom
      this.input.keyboard.on('keydown-PLUS', () => { this.kbSmoothZoom(KB_ZOOM_STEP) })
      this.input.keyboard.on('keydown-MINUS', () => { this.kbSmoothZoom(-KB_ZOOM_STEP) })

      // Number keys 1-9: jump to agent by index
      for (let n = 1; n <= 9; n++) {
        this.input.keyboard.on(`keydown-${n}`, () => { this.selectAgentByIndex(n - 1) })
      }
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

    this.isReady = true
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

    // Zoom-dependent LOD
    const showDetails = cam.zoom >= LOD_ZOOM_THRESHOLD
    if (showDetails !== this.lastLodVisible) {
      this.lastLodVisible = showDetails
      this.applyLod(showDetails)
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
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setAgents(agents: AgentState[], opencodeSessions?: { pid: number; cwd: string; project: string; uptime: string; cpu: string; memoryMB: number; alive: boolean }[]): void {
    if (!this.isReady) {
      this.pendingAgents = agents
      return
    }

    const allAgents = [...agents]
    
    // Convert opencode sessions to agent states and merge
    if (opencodeSessions && opencodeSessions.length > 0) {
      for (const session of opencodeSessions) {
        allAgents.push({
          config: {
            id: `opencode-${session.pid}`,
            name: 'opencode',
            title: 'OpenCode',
            tripletRole: 'solver',
            systemPrompt: '',
            model: 'opencode',
            mcpProfile: '',
            skills: [],
            allowedTools: [],
            subAgents: {},
            defaultRepos: [session.cwd],
            avatar: 'opencode',
            desk: { row: 0, col: 0 },
            autonomy: 'default',
          },
          status: 'active',
          cwd: session.cwd,
          pid: session.pid,
          cpu: session.cpu,
          memoryMB: session.memoryMB,
          uptime: session.uptime,
          sessionMode: 'working' as const,
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

    // Zoom-to-fit on first data load
    if (!this.hasInitialZoomToFit && this.rooms.size > 0) {
      this.hasInitialZoomToFit = true
      this.zoomToFit(false)
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

  /** Toggle denser team-area packing to reduce office scrolling. */
  setCompactLayout(enabled: boolean): void {
    if (this.compactLayoutEnabled === enabled) return
    this.compactLayoutEnabled = enabled
    if (this.rooms.size > 0) {
      this.layoutRooms()
      this.updateCameraBounds()
      this.minimapDirty = true
      this.tripletDirty = true
    }
  }

  /** Allow a lower minimum zoom for high-level office overview. */
  setOverviewZoomEnabled(enabled: boolean): void {
    if (this.overviewZoomEnabled === enabled) return
    this.overviewZoomEnabled = enabled
    const minZoom = this.getMinZoom()
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom, minZoom, ZOOM_MAX)
    const cam = this.cameras.main
    if (cam.zoom < minZoom) cam.setZoom(minZoom)
    this.minimapDirty = true
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
      if (maxX > 0) this.drawOfficeBackground(maxX + WORLD_MARGIN, maxY + WORLD_MARGIN)
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
    }

    this.drawRoomBackground(room)
    this.syncWorkstations(room, agents)
    this.updateRoomActivity(room)
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
  }

  private destroyRoom(room: Room): void {
    if (room.activityBarTween) room.activityBarTween.destroy()
    if (room.waitingBarTween) room.waitingBarTween.destroy()
    if (room.statusLedTween) room.statusLedTween.destroy()
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

    // Carpet grid pattern
    g.lineStyle(1, roomStyle.floorGrid, 0.22)
    const GRID = 32
    for (let py = floorY; py < floorY + floorH; py += GRID) {
      g.lineBetween(floorX, py, floorX + floorW, py)
    }
    for (let px = floorX; px < floorX + floorW; px += GRID) {
      g.lineBetween(px, floorY, px, floorY + floorH)
    }

    // Header bar
    g.fillStyle(roomStyle.header)
    g.fillRect(-w / 2 + WALL_T + WALL_I, -h / 2 + WALL_T + WALL_I, floorW, ROOM_HEADER_H)

    // Accent line
    g.lineStyle(2, roomStyle.accent, 0.72)
    g.lineBetween(
      -w / 2 + WALL_T + WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
      w / 2 - WALL_T - WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
    )

    // Door frame at the bottom wall to suggest room entrances.
    const doorW = Math.max(20, Math.min(34, floorW * 0.22))
    const doorH = 12
    const doorX = -doorW / 2
    const doorY = h / 2 - WALL_T - WALL_I - doorH
    g.fillStyle(roomStyle.accent, 0.75)
    g.fillRoundedRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4, 3)
    g.fillStyle(COLOR_DOOR_FILL, 1)
    g.fillRoundedRect(doorX, doorY, doorW, doorH, 2)
    g.fillStyle(roomStyle.accent, 0.45)
    g.fillRect(doorX + 4, doorY + 2, Math.max(doorW - 8, 4), 2)
    g.lineStyle(1, roomStyle.accent, 0.3)
    g.lineBetween(0, doorY + 1, 0, doorY + doorH - 1)

    this.refreshRoomHeaderText(room)
  }

  private refreshRoomHeaderText(room: Room): void {
    const existing = room.container.getByName('headerText') as Phaser.GameObjects.Text | null
    if (existing) existing.destroy()

    const WALL_T = 8
    const WALL_I = 4

    const headerText = this.add.text(
      0,
      -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H / 2,
      this.formatLabel(room.label),
      {
        fontSize: '12px', color: '#e2e8f0',
        fontFamily: 'system-ui, monospace', fontStyle: 'bold', align: 'center',
        resolution: 2,
      },
    ).setOrigin(0.5, 0.5).setName('headerText')
    room.container.add(headerText)

    const badgeExisting = room.container.getByName('agentBadge') as Phaser.GameObjects.Text | null
    if (badgeExisting) badgeExisting.destroy()

    const badge = this.add.text(
      room.width / 2 - WALL_T - WALL_I - 8,
      -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H / 2,
      `${room.agents.length}`,
      {
        fontSize: '10px', color: '#94a3b8',
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

    // Coffee mug
    const mugBody = this.add.rectangle(22, WS_DESK_Y - 3, 5, 6, 0x8b5cf6).setStrokeStyle(0.5, 0x6d28d9, 0.8)
    wsContainer.add(mugBody)
    const mugHandle = this.add.arc(25, WS_DESK_Y - 3, 2.5, 0, 180, false, 0x000000, 0).setStrokeStyle(1, 0x8b5cf6, 0.8)
    wsContainer.add(mugHandle)

    // Coffee steam — store tweens so destroyWorkstation can clean them up
    const steamContainer = this.add.container(22, WS_DESK_Y - 7)
    wsContainer.add(steamContainer)
    const steamTweens: Phaser.Tweens.Tween[] = []
    for (let i = 0; i < 3; i++) {
      const steam = this.add.circle((i - 1) * 2, 0, 1, 0xffffff, 0.15)
      steamContainer.add(steam)
      steamTweens.push(this.tweens.add({
        targets: steam, y: -8 - Math.random() * 4, alpha: 0,
        duration: 1500 + Math.random() * 800,
        delay: i * 500, yoyo: false, repeat: -1, ease: 'Sine.easeOut',
        onRepeat: () => { steam.y = 0; steam.setAlpha(0.15) },
      }))
    }

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
    if (nameHash % 5 < 2) {
      const plX = nameHash % 2 === 0 ? -16 : 16
      const pot = this.add.rectangle(plX, WS_DESK_Y - 2, 5, 4, 0x475569, 0.7)
      wsContainer.add(pot); extraDecos.push(pot)
      const leaf = this.add.circle(plX, WS_DESK_Y - 6, 3, 0x34d399, 0.6)
      wsContainer.add(leaf); extraDecos.push(leaf)
    }

    // Track LOD details (mug, steam, lamp, accessories -- hidden when zoomed out)
    const lodDetailObjects: Phaser.GameObjects.GameObject[] = [
      mugBody, mugHandle, steamContainer, lampBase, lampArm, lampShade, lampLight,
      keyboard, kbLines, sticky, ...extraDecos,
    ]

    // Character shadow
    const shadow = this.add.ellipse(0, WS_SPRITE_Y + 2, 20, 6, 0x000000, 0.2)
    wsContainer.add(shadow)

    const charIdx = this.getAgentCharacterIndex(agent)
    const frame   = this.getPoseFrame(charIdx, agent)
    const sprite  = this.add.sprite(0, WS_SPRITE_Y, 'characters', frame)
    sprite.setScale(CHAR_SCALE).setOrigin(0.5, 1)
    wsContainer.add(sprite)

    // Thought bubble
    const thoughtBubbleBg = this.add.graphics()
    const thoughtBubbleText = this.add.text(0, -1, '', {
      fontSize: '13px', color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', resolution: 2,
    }).setOrigin(0.5)
    const thoughtBubble = this.add.container(4, WS_SPRITE_Y - 58, [thoughtBubbleBg, thoughtBubbleText]).setVisible(false)
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

    const roleBadge: Phaser.GameObjects.Text | null = null

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

    const hitArea = this.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge,
      deskBody, deskTop, monitorSprite, chairSprite,
      monitorGlowOverlay, screenLines, screenTween,
      blockedIndicator, blockedIndicatorPulse, blockedIndicatorBadge, blockedIndicatorStem, blockedIndicatorText,
      thoughtBubble, thoughtBubbleText, thoughtBubbleBg, state: agent,
      steamTweens,
      lodDetailObjects,
    }

    // Apply current LOD state to new workstation
    if (!this.lastLodVisible) {
      for (const obj of lodDetailObjects) {
        if (obj && 'setVisible' in obj) {
          (obj as Phaser.GameObjects.Components.Visible).setVisible(false)
        }
      }
    }

    let lastClickTime = 0
    hitArea.on('pointerdown', () => {
      const now = Date.now()
      if (now - lastClickTime < 350) {
        EventBus.emit(EVENTS.AGENT_DOUBLE_CLICKED, agent.config.id, ws.state)
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
    return ws
  }

  private updateWorkstation(ws: WorkstationSprite, agent: AgentState): void {
    // Skip redundant updates — fingerprint the fields that affect visuals
    const fp = `${agent.sessionMode}|${agent.needsInteraction}|${agent.interactionType}|${agent.config.name}`
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
          this.showToast(`${name} has edits to review`, 0x3b82f6)
        } else if (agent.interactionType === 'question') {
          this.showToast(`${name} asked a question`, 0xf59e0b)
        } else if (agent.interactionType === 'tool-approval') {
          this.showToast(`${name} needs approval`, 0xf59e0b)
        }
      } else if (wasWorking && !isWorking && !agent.needsInteraction) {
        this.queueMinimapRoomFlash(roomKey, COLOR_LED_GREEN, 1200)
        this.showToast(`${name} finished task`, 0x059669)
      } else if (!wasWorking && isWorking) {
        this.queueMinimapRoomFlash(roomKey, COLOR_DOOR_FRAME, 900)
        this.showToast(`${name} started working`, 0x334155)
      }
    }

    const charIdx = this.getAgentCharacterIndex(agent)
    ws.sprite.setFrame(this.getPoseFrame(charIdx, agent))

    const dotColor = this.getStatusColor(agent)
    ws.statusDot.setFillStyle(dotColor)
    ws.statusDot.setPosition(ws.nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y)

    ws.nameText.setVisible(false)
    ws.statusDot.setVisible(false)

    const isWaiting = agent.needsInteraction
    const isPlan = agent.sessionMode === 'plan'
    const isAcceptEdits = agent.interactionType === 'accept-edits' && isWaiting
    const isWorking = (agent.sessionMode === 'working' || isPlan) && !isWaiting

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
    this.updateBlockedIndicator(ws, agent)

    // Thought bubble
    let icon: string | null = null
    let bgColor = 0x475569
    
    if (isAcceptEdits) {
      icon = '~'; bgColor = 0x60a5fa  // Blue for pending edits
    } else if (agent.sessionMode === 'compressing') {
      icon = '!'; bgColor = 0xf87171  // Red for compression
    } else if (isPlan) {
      icon = '?'; bgColor = 0xa78bfa  // Purple for planning
    } else if (isWorking) {
      icon = '*'; bgColor = 0x059669  // Green for working
    } else if (agent.needsInteraction) {
      icon = '!'; bgColor = 0xfbbf24  // Yellow for needs attention
    } else if (agent.sessionMode === 'waiting') {
      icon = '...'; bgColor = 0xfbbf24  // Yellow for waiting
    } else if (!agent.sessionMode) {
      icon = '*'; bgColor = 0x059669  // Default to working (for opencode agents)
    } else {
      icon = '\u2615'; bgColor = 0x475569  // Coffee for idle
    }

    this.tweens.killTweensOf(ws.thoughtBubble)
    ws.thoughtBubbleBg.clear()
    if (icon) {
      ws.thoughtBubbleText.setText(icon)
      ws.thoughtBubbleBg.fillStyle(bgColor, 0.9)
      ws.thoughtBubbleBg.fillRoundedRect(-11, -12, 22, 24, 7)
      ws.thoughtBubbleBg.fillTriangle(-3, 12, 3, 12, -4, 17)
      ws.thoughtBubble.setVisible(true)

      const baseY = WS_SPRITE_Y - 58
      ws.thoughtBubble.y = baseY
      this.tweens.add({
        targets: ws.thoughtBubble, y: baseY - 3,
        duration: isWorking ? 1200 : 2000,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    } else {
      ws.thoughtBubble.setVisible(false)
    }

    this.updateAnimation(ws, agent)
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
    if (ws.pulseTween)       ws.pulseTween.destroy()
    if (ws.lookAroundTimer)  ws.lookAroundTimer.destroy()
    if (ws.stretchTimer)     ws.stretchTimer.destroy()
    if (ws.walkBreakTimer)   ws.walkBreakTimer.destroy()
    if (ws.steamTweens) { for (const t of ws.steamTweens) t.destroy() }
    this.tweens.killTweensOf(ws.thoughtBubble)
    ws.container.destroy()
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
      this.corridorGraphics?.clear()
      this.hallwayIndicatorGraphics?.clear()
      this.corridorSegments = []
      this.drawTeamAreas([])
      this.updateCameraBounds()
      return
    }

    // Team zoning: parent-folder teams get dedicated areas, packed in columns
    // to reduce vertical scrolling while keeping team separation clear.
    const availableW = Math.max(this.viewWidth - WORLD_MARGIN * 2, 340)
    const compact = this.compactLayoutEnabled
    const areaPadX = compact ? TEAM_AREA_PAD_X : TEAM_AREA_PAD_X + 10
    const areaPadY = compact ? TEAM_AREA_PAD_Y : TEAM_AREA_PAD_Y + 10
    const areaGapX = compact ? TEAM_AREA_GAP_X : TEAM_AREA_GAP_X + 12
    const areaGapY = compact ? TEAM_AREA_GAP_Y : TEAM_AREA_GAP_Y + 20
    const teamLabelH = compact ? TEAM_LABEL_H : TEAM_LABEL_H + 2
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
    const desiredCols = compact
      ? (teamCount >= 6 ? 3 : teamCount >= 3 ? 2 : 1)
      : (teamCount >= 4 ? 2 : 1)
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
      const teamWidth = Math.max(190, Math.min(preferredTeamWidth, Math.max(contentW, minTeamWidth)))
      const teamHeight = Math.max(compact ? 115 : 132, areaPadY * 2 + teamLabelH + Math.max(contentH, compact ? 62 : 76))
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

    let areaCursorX = 0
    let areaCursorY = 0
    let areaRowHeight = 0
    for (const draft of teamDrafts) {
      if (areaCursorX > 0 && areaCursorX + draft.width > availableW) {
        areaCursorX = 0
        areaCursorY += areaRowHeight + areaGapY
        areaRowHeight = 0
      }
      const areaX = WORLD_MARGIN + areaCursorX
      const areaY = WORLD_MARGIN + areaCursorY

      for (const room of draft.rooms) {
        const local = draft.roomLocalPos.get(room)
        if (!local) continue
        room.x = areaX + local.x
        room.y = areaY + local.y
        this.tweens.killTweensOf(room.container)
        if (!this.hasInitialZoomToFit) {
          room.container.setPosition(room.x, room.y)
        } else {
          this.tweens.add({ targets: room.container, x: room.x, y: room.y, duration: 320, ease: 'Power2' })
        }
      }

      teamLayouts.push({
        teamKey: draft.teamKey,
        teamLabel: draft.teamLabel,
        x: areaX,
        y: areaY,
        width: draft.width,
        height: draft.height,
      })
      areaCursorX += draft.width + areaGapX
      areaRowHeight = Math.max(areaRowHeight, draft.height)
    }

    for (const room of roomList) {
      if (!room.cwd.startsWith('__')) {
        this.refreshRoomHeaderText(room)
      }
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
    this.worldWidth  = maxX + WORLD_MARGIN
    this.worldHeight = maxY + WORLD_MARGIN
    this.tripletDirty = true

    // Draw office background behind rooms — clamp to viewport width
    if (this.officeGraphics) {
      const bgW = Math.max(Math.min(maxX + WORLD_MARGIN, this.viewWidth - 10), availableW)
      this.drawOfficeBackground(bgW, maxY + WORLD_MARGIN)
    }
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

    for (const area of layouts) {
      const color = this.getTeamColor(area.teamKey)
      g.fillStyle(color, 0.08)
      g.fillRoundedRect(area.x, area.y, area.width, area.height, 10)
      g.lineStyle(1.5, color, 0.24)
      g.strokeRoundedRect(area.x, area.y, area.width, area.height, 10)
      g.fillStyle(color, 0.24)
      g.fillRoundedRect(area.x + 10, area.y + 8, 7, 7, 2)

      const text = this.add.text(area.x + 22, area.y + 4, area.teamLabel, {
        fontSize: '11px',
        color: '#cbd5e1',
        fontFamily: 'system-ui, monospace',
        fontStyle: 'bold',
        resolution: 2,
      })
      text.setDepth(-1)
      this.teamAreaLabels.push(text)
    }
  }

  private drawCorridors(roomList: Room[]): void {
    const g = this.corridorGraphics
    if (!g) return
    g.clear()
    this.corridorSegments = []
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

      const maxBottom = Math.max(...rowRooms.map(r => r.y + r.height / 2))
      let hallY = maxBottom + ROOM_GAP * 0.45
      hallY = Math.max(hallY, maxBottom + 2)

      const minX = rowRooms[0].x
      const maxX = rowRooms[rowRooms.length - 1].x
      const lineColor = this.getTeamColor(row.teamKey)
      g.lineStyle(8, 0x0b1220, 0.28)
      g.lineBetween(minX, hallY, maxX, hallY)
      g.lineStyle(3, lineColor, 0.48)
      g.lineBetween(minX, hallY, maxX, hallY)
      this.corridorSegments.push({ x1: minX, y1: hallY, x2: maxX, y2: hallY, color: lineColor })

      for (const room of rowRooms) {
        const doorY = room.y + room.height / 2 - 8
        g.lineStyle(7, 0x0b1220, 0.24)
        g.lineBetween(room.x, doorY, room.x, hallY)
        g.lineStyle(2, lineColor, 0.42)
        g.lineBetween(room.x, doorY, room.x, hallY)
        g.fillStyle(0x94a3b8, 0.24)
        g.fillCircle(room.x, hallY, 2.2)
        this.corridorSegments.push({ x1: room.x, y1: doorY, x2: room.x, y2: hallY, color: lineColor })
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
  // Office background (standalone graphics, NOT a container)
  // ---------------------------------------------------------------------------

  private drawOfficeBackground(contentW: number, contentH: number): void {
    if (contentW === this.lastOfficeBgW && contentH === this.lastOfficeBgH) return
    this.lastOfficeBgW = contentW
    this.lastOfficeBgH = contentH

    const g = this.officeGraphics
    if (!g) return
    g.clear()

    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []

    const WALL_T = 5
    const WALL_I = 2
    const PAD = 30

    const x0 = WORLD_MARGIN - PAD
    const y0 = WORLD_MARGIN - PAD
    const w = contentW - WORLD_MARGIN + PAD * 2
    const h = contentH - WORLD_MARGIN + PAD * 2

    // Drop shadow
    g.fillStyle(0x000000, 0.25)
    g.fillRoundedRect(x0 - WALL_T + 4, y0 - WALL_T + 4, w + WALL_T * 2, h + WALL_T * 2, 8)

    // Outer wall
    g.fillStyle(COLOR_WALL)
    g.fillRoundedRect(x0 - WALL_T, y0 - WALL_T, w + WALL_T * 2, h + WALL_T * 2, 6)

    // Inner wall
    g.fillStyle(COLOR_WALL_INNER)
    g.fillRoundedRect(x0 - WALL_I, y0 - WALL_I, w + WALL_I * 2, h + WALL_I * 2, 4)

    // Top-wall windows to make the shell feel more like a building.
    const windowBandY = y0 - WALL_I + 8
    const windowBandH = 10
    const windowCount = Math.max(2, Math.floor(w / 120))
    const windowGap = w / (windowCount + 1)
    for (let i = 0; i < windowCount; i++) {
      const wx = x0 + windowGap * (i + 1) - 24
      g.fillStyle(0x0b1f36, 0.62)
      g.fillRoundedRect(wx, windowBandY, 48, windowBandH, 3)
      g.fillStyle(0x7dd3fc, 0.16)
      g.fillRoundedRect(wx + 3, windowBandY + 2, 42, windowBandH - 4, 2)
    }

    // Floor
    g.fillStyle(0x0f172a)
    g.fillRoundedRect(x0, y0, w, h, 2)

    // Ceiling fixtures (soft glow + core) for subtle office realism.
    const lightCount = Math.max(2, Math.floor(w / 180))
    const lightGap = w / (lightCount + 1)
    for (let i = 0; i < lightCount; i++) {
      const lx = x0 + lightGap * (i + 1)
      const ly = y0 + 16
      g.fillStyle(0xf8fafc, 0.08)
      g.fillCircle(lx, ly, 11)
      g.fillStyle(0xe2e8f0, 0.2)
      g.fillCircle(lx, ly, 4)
    }

    // Subtle grid lines on floor
    g.lineStyle(1, 0x1e293b, 0.3)
    const PLANK_H = 24
    for (let py = y0; py < y0 + h; py += PLANK_H) g.lineBetween(x0, py, x0 + w, py)
    g.lineStyle(1, 0x1e293b, 0.15)
    const PLANK_W = 48
    for (let py = y0; py < y0 + h; py += PLANK_H) {
      const off = ((py - y0) / PLANK_H) % 2 === 0 ? 0 : PLANK_W / 2
      for (let px = x0 + off; px < x0 + w; px += PLANK_W) g.lineBetween(px, py, px, py + PLANK_H)
    }

    // Carpet/rug in the center
    const rugMargin = 20
    const mainRugW = Math.max(w - rugMargin * 2, 100)
    const mainRugH = Math.max(h - rugMargin * 2, 60)
    g.fillStyle(0x1e3a5f, 0.15)
    g.fillRoundedRect(x0 + rugMargin, y0 + rugMargin, mainRugW, mainRugH, 6)
    g.lineStyle(1, 0x2563eb, 0.08)
    g.strokeRoundedRect(x0 + rugMargin + 6, y0 + rugMargin + 6, mainRugW - 12, mainRugH - 12, 4)

    // Decorations
    if (this.officeTilesLoaded) {
      const DECO_SCALE = 0.38
      const decos: Phaser.GameObjects.Sprite[] = []

      // Large plant in bottom-left corner
      decos.push(this.add.sprite(x0 + 14, y0 + h - 14, 'office', OFFICE_FRAME_PLANT).setScale(DECO_SCALE).setAlpha(0.75).setDepth(-1))
      
      // Tall plant in bottom-right
      decos.push(this.add.sprite(x0 + w - 14, y0 + h - 14, 'office', OFFICE_FRAME_PLANT_TALL).setScale(DECO_SCALE).setAlpha(0.7).setDepth(-1))
      
      // Small cactus near top-right
      decos.push(this.add.sprite(x0 + w - 14, y0 + 20, 'office', OFFICE_FRAME_CACTUS).setScale(DECO_SCALE * 0.85).setAlpha(0.6).setDepth(-1))

      // Wall clock between picture frames
      if (w > 300) {
        const clockX = x0 + w / 2
        decos.push(this.add.sprite(clockX, y0 + 8, 'office', OFFICE_FRAME_CLOCK).setScale(DECO_SCALE * 0.7).setAlpha(0.5).setDepth(-1))
      }

      // Picture frames along top wall (more variety)
      const picFrames = [OFFICE_FRAME_PICTURE, OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3]
      const picCount = Math.min(6, Math.floor(w / 80))
      const picSpacing = w / (picCount + 1)
      for (let i = 0; i < picCount; i++) {
        decos.push(this.add.sprite(x0 + picSpacing * (i + 1), y0 + 8, 'office', picFrames[i % picFrames.length])
          .setScale(DECO_SCALE * 0.85).setAlpha(0.45).setDepth(-1))
      }

      // Bookshelf on left side
      if (h > 140) {
        decos.push(this.add.sprite(x0 + 14, y0 + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.45).setDepth(-1))
      }

      // Filing cabinet on right side
      if (h > 160 && w > 250) {
        decos.push(this.add.sprite(x0 + w - 20, y0 + h - 50, 'office', OFFICE_FRAME_FILE_CABINET).setScale(DECO_SCALE * 0.9).setAlpha(0.5).setDepth(-1))
      }

      // Water cooler (if room is big enough)
      if (w > 350) {
        decos.push(this.add.sprite(x0 + w / 2 - 60, y0 + h - 30, 'office', OFFICE_FRAME_WATER_COOLER).setScale(DECO_SCALE * 0.85).setAlpha(0.4).setDepth(-1))
      }

      // Hanging plant in top corner (subtle)
      if (w > 200) {
        decos.push(this.add.sprite(x0 + 30, y0 + 5, 'office', OFFICE_FRAME_HANGING_PLANT).setScale(DECO_SCALE * 0.6).setAlpha(0.35).setDepth(-1))
      }

      // Monstera plant on floor
      if (h > 180) {
        decos.push(this.add.sprite(x0 + 40, y0 + h - 25, 'office', OFFICE_FRAME_MONSTERA).setScale(DECO_SCALE * 0.9).setAlpha(0.5).setDepth(-1))
      }

      this.officeDecoSprites = decos
    }
  }

  private updateCameraBounds(): void {
    const cam = this.cameras.main
    let maxX = this.worldWidth, maxY = this.worldHeight
    for (const room of this.rooms.values()) {
      maxX = Math.max(maxX, room.x + room.width / 2 + WORLD_MARGIN)
      maxY = Math.max(maxY, room.y + room.height / 2 + WORLD_MARGIN)
    }
    this.worldWidth  = Math.max(maxX, this.viewWidth)
    this.worldHeight = Math.max(maxY, this.viewHeight)
    cam.setBounds(-WORLD_MARGIN, -WORLD_MARGIN, this.worldWidth + WORLD_MARGIN * 2, this.worldHeight + WORLD_MARGIN * 2)
  }

  // ---------------------------------------------------------------------------
  // Typing spark particles
  // ---------------------------------------------------------------------------

  private initParticlePool(): void {
    for (let i = 0; i < 80; i++) {
      const radius = 1 + Math.random() * 2
      const p = this.add.circle(0, 0, radius, 0xffffff, 0).setDepth(9998).setVisible(false)
      p.setData('busy', false)
      this.typingParticlePool.push(p)
    }
  }

  private spawnTypingParticle(worldX: number, worldY: number, isWaiting = false): void {
    const p = this.typingParticlePool.find(c => !c.getData('busy'))
    if (!p) return
    // Colors based on state - more subtle
    const colors = isWaiting
      ? [0xfbbf24, 0xf59e0b, 0xfcd34d]  // Amber for waiting
      : [0x0ea5e9, 0x34d399, 0x22d3ee]   // Blue/green for working
    p.setPosition(worldX + (Math.random() - 0.5) * 20, worldY)
    p.setFillStyle(colors[Math.floor(Math.random() * colors.length)])
    p.setAlpha(0.8).setVisible(true).setData('busy', true)
    const radius = 1 + Math.random() * 1.5
    p.setRadius(radius)
    this.tweens.add({
      targets: p,
      y: worldY - 15 - Math.random() * 25,
      x: p.x + (Math.random() - 0.5) * 12,
      alpha: 0,
      duration: 600 + Math.random() * 400,
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
        const isWaiting = ws.state.needsInteraction
        if (!isWorking && !isWaiting) continue
        const wx = room.x + ws.container.x
        const wy = room.y + ws.container.y + WS_DESK_Y
        // Reduced spawn rate for subtlety
        if (Math.random() < 0.12) this.spawnTypingParticle(wx, wy, isWaiting)
      }
    }
  }

  private initAmbientMotePool(): void {
    for (let i = 0; i < AMBIENT_MOTE_POOL_SIZE; i++) {
      const r = 0.9 + Math.random() * 1.3
      const m = this.add.circle(0, 0, r, 0xe2e8f0, 0).setDepth(2).setVisible(false)
      m.setData('busy', false)
      this.ambientMotePool.push(m)
    }
  }

  private spawnAmbientMote(): void {
    const mote = this.ambientMotePool.find(c => !c.getData('busy'))
    if (!mote) return

    const view = this.cameras.main.worldView
    const x = view.x + Math.random() * view.width
    const y = view.y + Math.random() * view.height
    const colors = [0xe2e8f0, 0xcbd5e1, 0xbfdbfe]
    mote.setPosition(x, y)
    mote.setFillStyle(colors[Math.floor(Math.random() * colors.length)])
    mote.setAlpha(0.08 + Math.random() * 0.08)
    mote.setVisible(true)
    mote.setData('busy', true)
    const driftX = (Math.random() - 0.5) * 16
    const driftY = -18 - Math.random() * 24
    this.tweens.add({
      targets: mote,
      x: x + driftX,
      y: y + driftY,
      alpha: 0,
      duration: 2600 + Math.random() * 2200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        mote.setVisible(false)
        mote.setData('busy', false)
      },
    })
  }

  private tickAmbientMotes(): void {
    if (this.rooms.size === 0) return
    if (this.cameras.main.zoom < 0.62) return
    if (Math.random() < 0.55) this.spawnAmbientMote()
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
    if (ws.walkBreakTween)   { ws.walkBreakTween.destroy();   ws.walkBreakTween   = undefined }
    if (ws.lookAroundTimer)  { ws.lookAroundTimer.destroy();  ws.lookAroundTimer  = undefined }
    if (ws.stretchTimer)     { ws.stretchTimer.destroy();     ws.stretchTimer     = undefined }
    if (ws.walkBreakTimer)   { ws.walkBreakTimer.destroy();   ws.walkBreakTimer   = undefined }

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
    } else {
      ws.sprite.setFrame(base + POSE_SIT)
      ws.breathTween = this.tweens.add({
        targets: ws.sprite, scaleY: CHAR_SCALE * 0.97,
        duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      this.restoreDeskStroke(ws)

      // "Just finished" bounce when transitioning from working→idle
      if (prevMode === 'working') {
        this.tweens.add({
          targets: ws.sprite, y: WS_SPRITE_Y - 6,
          duration: 200, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { ws.sprite.y = WS_SPRITE_Y },
        })
      }

      // Periodic look-around: random head tilt every 4-8s
      ws.lookAroundTimer = this.time.addEvent({
        delay: 4000 + Math.random() * 4000,
        loop: true,
        callback: () => {
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          const angle = (Math.random() - 0.5) * 6
          ws.headTiltTween = this.tweens.add({
            targets: ws.sprite, angle,
            duration: 600, yoyo: true, hold: 800, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0) },
          })
        },
      })

      // Occasional stretch: subtle scale-up every 10-18s
      ws.stretchTimer = this.time.addEvent({
        delay: 10000 + Math.random() * 8000,
        loop: true,
        callback: () => {
          this.tweens.add({
            targets: ws.sprite,
            scaleX: CHAR_SCALE * 1.08, scaleY: CHAR_SCALE * 1.05,
            y: WS_SPRITE_Y - 3,
            duration: 500, yoyo: true, hold: 300, ease: 'Sine.easeInOut',
            onComplete: () => {
              ws.sprite.setScale(CHAR_SCALE)
              ws.sprite.y = WS_SPRITE_Y
            },
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

  private showToast(text: string, color: number = 0x334155): void {
    if (!this.toastContainer) return

    const TOAST_W = 220
    const TOAST_H = 28
    const TOAST_MARGIN = 8
    const MAX_TOASTS = 4

    // Remove oldest if at capacity
    while (this.activeToasts.length >= MAX_TOASTS) {
      const old = this.activeToasts.shift()
      old?.container.destroy()
    }

    const yOffset = this.activeToasts.length * (TOAST_H + TOAST_MARGIN)
    const startX = this.viewWidth - TOAST_W - 16
    const startY = 16 + yOffset

    const bg = this.add.graphics()
    bg.fillStyle(color, 0.92)
    bg.fillRoundedRect(0, 0, TOAST_W, TOAST_H, 6)

    const label = this.add.text(10, 6, text, {
      fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0',
      wordWrap: { width: TOAST_W - 20 },
    })

    const toast = this.add.container(startX + 30, startY, [bg, label])
    toast.setAlpha(0).setScrollFactor(0).setDepth(9998)
    this.toastContainer.add(toast)

    const entry = { container: toast, createdAt: Date.now() }
    this.activeToasts.push(entry)

    // Slide in + fade in, then auto-dismiss after 3s
    this.tweens.add({
      targets: toast, x: startX, alpha: 1,
      duration: 250, ease: 'Power2',
    })
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: toast, alpha: 0, x: startX + 30,
        duration: 200, ease: 'Power2',
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
        targets: t.container, y: 16 + i * (TOAST_H + TOAST_MARGIN),
        duration: 150, ease: 'Power2',
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
    return agent.config.model === 'opencode' || agent.config.id.startsWith('opencode-')
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

  private getMinZoom(): number {
    return this.overviewZoomEnabled ? ZOOM_MIN_OVERVIEW : ZOOM_MIN
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
    const padFactor = 1.25
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
      if (!this.minimapPanning || !p.isDown) return
      this.panCameraFromMinimapPointer(p)
    })
    this.minimapHitZone.on('pointerup', () => { this.minimapPanning = false })
    this.minimapHitZone.on('pointerout', () => { this.minimapPanning = false })
    this.minimapContainer.add([this.minimapGraphics, this.minimapViewport, this.minimapHitZone])
    this.repositionMinimap()
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

      const flash = this.minimapRoomFlashes.get(room.cwd)
      if (flash) {
        const pulse = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(this.time.now * 0.015))
        mg.lineStyle(2, flash.color, pulse)
        mg.strokeRect(rx - 1.5, ry - 1.5, room.width * s + 3, room.height * s + 3)
      }
      
      // Draw agent dots inside room
      const agents = Array.from(room.workstations.values())
      if (agents.length === 0) continue
      const cols = Math.min(agents.length, 4)
      const rows = Math.ceil(agents.length / cols)
      const cellW = (room.width * s) / cols
      const cellH = (room.height * s) / rows
      agents.forEach((ws, i) => {
        if (!ws.state) return
        const col = i % cols
        const row = Math.floor(i / cols)
        const dotX = rx + col * cellW + cellW / 2
        const dotY = ry + row * cellH + cellH / 2
        const dotColor = ws.state.needsInteraction ? 0xfbbf24 
          : ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan' ? 0x34d399 
          : 0x64748b
        mg.fillStyle(dotColor, 0.9)
        mg.fillCircle(dotX, dotY, 2)
      })
    }
    const cam = this.cameras.main
    vg.lineStyle(1.5, MINIMAP_VIEWPORT_COLOR, 0.9)
    vg.strokeRect(
      Phaser.Math.Clamp(pad + (cam.scrollX - minX) * s, pad, pad + drawW),
      Phaser.Math.Clamp(pad + (cam.scrollY - minY) * s, pad, pad + drawH),
      Math.min((cam.width / cam.zoom) * s, drawW),
      Math.min((cam.height / cam.zoom) * s, drawH),
    )
  }

  private applyLod(showDetails: boolean): void {
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.lodDetailObjects) continue
        for (const obj of ws.lodDetailObjects) {
          if (obj && 'setVisible' in obj) (obj as Phaser.GameObjects.Components.Visible).setVisible(showDetails)
        }
      }
    }
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

  /** Draw a pulsing blue ring at world coordinates */
  private drawSelectionRing(wx: number, wy: number): void {
    if (!this.selectionRing) return

    // Kill existing ring tween
    if (this.selectionRingTween) {
      this.selectionRingTween.destroy()
      this.selectionRingTween = null
    }

    const g = this.selectionRing
    g.clear()
    g.lineStyle(2.5, 0x3b82f6, 0.9)
    g.strokeCircle(0, 0, 38)
    g.lineStyle(1, 0x60a5fa, 0.4)
    g.strokeCircle(0, 0, 42)
    g.setPosition(wx, wy)
    g.setVisible(true)
    g.setAlpha(1)

    // Pulse animation
    this.selectionRingTween = this.tweens.add({
      targets: g,
      alpha: 0.45,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Remove the selection ring */
  private clearSelectionRing(): void {
    if (this.selectionRingTween) {
      this.selectionRingTween.destroy()
      this.selectionRingTween = null
    }
    this.selectionRing?.clear()
    this.selectionRing?.setVisible(false)
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

  private applyDayNightCycle(animate: boolean): void {
    const { phase, color, alpha, bgColor, glowMultiplier } = this.getTimePhase()
    if (phase === this.currentTimePhase && animate) return
    this.currentTimePhase = phase

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
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.dayNightTimer?.destroy()
    this.dayNightTimer = null
    this.dayNightOverlay?.destroy()
    this.dayNightOverlay = null
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

    // Keyboard selection cleanup
    this.stopAutoPan()
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    this.selectionRing?.destroy()
    this.selectionRing = null

    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    for (const label of this.teamAreaLabels) label.destroy()
    this.teamAreaLabels = []
    this.teamAreaGraphics?.destroy()
    this.teamAreaGraphics = null
    this.corridorGraphics?.destroy()
    this.corridorGraphics = null
    this.hallwayIndicatorGraphics?.destroy()
    this.hallwayIndicatorGraphics = null
    this.corridorSegments = []
    this.officeGraphics?.destroy()
    this.officeGraphics = null
    this.tripletGraphics?.destroy()
    this.tripletGraphics = null

    for (const room of this.rooms.values()) {
      this.destroyRoom(room)
    }
    this.rooms.clear()
  }
}
