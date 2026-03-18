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
const NUM_CHARS    = 2

const POSE_IDLE     = 0
const POSE_INTERACT = 1
const POSE_SIT      = 2
const POSE_SURPRISE = 3

const OFFICE_TILE_SIZE = 48
const FRAME_CHAIR_DARK   = 112
const FRAME_MONITOR      = 122

const ROOM_TILE_SIZE = 48

const OFFICE_FRAME_PLANT     = 68
const OFFICE_FRAME_PLANT_SM  = 53
const OFFICE_FRAME_PICTURE   = 64
const OFFICE_FRAME_PICTURE2  = 65
const OFFICE_FRAME_PICTURE3  = 66
const OFFICE_FRAME_BOOKSHELF = 96

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHAR_SCALE      = 0.107
const WORKSTATION_W   = 70
const WORKSTATION_H   = 77
const ROOM_PADDING    = 10
const ROOM_HEADER_H   = 16
const ROOM_GAP        = 4
const MAX_AGENTS_PER_ROW = 4

const WS_CHAIR_Y    = 5
const WS_SPRITE_Y   = -4
const WS_DESK_Y     = 14
const WS_MONITOR_Y  = 4
const WS_NAME_Y     = 32
const WS_DOT_GAP    = 3

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
const ZOOM_LERP_SPEED = 0.08
const FOLLOW_LERP_SPEED = 0.06
const LOD_ZOOM_THRESHOLD = 0.65
const MINIMAP_W = 160
const MINIMAP_H = 100
const MINIMAP_MARGIN = 12
const MINIMAP_BG = 0x0f172a
const MINIMAP_ROOM_COLOR = 0x334155
const MINIMAP_VIEWPORT_COLOR = 0x3b82f6

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
}

interface Room {
  cwd: string
  label: string
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
  statusLed: Phaser.GameObjects.Arc
  statusLedGlow: Phaser.GameObjects.Arc
  statusLedTween: Phaser.Tweens.Tween | null
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
  private officeDecoSprites: Phaser.GameObjects.Sprite[] = []
  private lastOfficeBgW = 0
  private lastOfficeBgH = 0

  // Typing spark particles
  private typingParticlePool: Phaser.GameObjects.Arc[] = []
  private typingParticleTimer: Phaser.Time.TimerEvent | null = null

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

  // Camera & navigation state
  private targetZoom = 1
  private followTarget: { x: number; y: number } | null = null
  private lastLodVisible = true
  private minimapContainer: Phaser.GameObjects.Container | null = null
  private minimapGraphics: Phaser.GameObjects.Graphics | null = null
  private minimapViewport: Phaser.GameObjects.Graphics | null = null

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

    this.viewWidth  = this.scale.width
    this.viewHeight = this.scale.height

    // Office background (drawn behind rooms, updated in layoutRooms)
    this.officeGraphics = this.add.graphics()

    // Typing spark particle pool
    this.initParticlePool()
    this.typingParticleTimer = this.time.addEvent({
      delay: 200, callback: () => this.tickParticles(), loop: true,
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
        this.targetZoom = Phaser.Math.Clamp(this.targetZoom - deltaY * 0.001, ZOOM_MIN, ZOOM_MAX)
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

    // Day/night cycle overlay (doesn't block input)
    this.dayNightOverlay = this.add
      .rectangle(0, 0, 8000, 8000, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(9997)
      .setScrollFactor(0)
    this.applyDayNightCycle(false)
    this.dayNightTimer = this.time.addEvent({
      delay: 60_000,
      callback: () => this.applyDayNightCycle(true),
      loop: true,
    })

    this.isReady = true
    if (this.pendingAgents) {
      this.setAgents(this.pendingAgents)
      this.pendingAgents = null
    }
  }

  // ---------------------------------------------------------------------------
  // Update loop (smooth zoom, follow, LOD, minimap)
  // ---------------------------------------------------------------------------

  update(_time: number, _delta: number): void {
    const cam = this.cameras.main

    // Smooth zoom lerp
    const zoomDiff = this.targetZoom - cam.zoom
    if (Math.abs(zoomDiff) > 0.001) {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + zoomDiff * ZOOM_LERP_SPEED, ZOOM_MIN, ZOOM_MAX))
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

    // Minimap refresh
    this.drawMinimap()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setAgents(agents: AgentState[]): void {
    if (!this.isReady) {
      this.pendingAgents = agents
      return
    }

    this.agents = agents

    const grouped = new Map<string, AgentState[]>()
    for (const agent of agents) {
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
      const existing = this.rooms.get(cwd)
      if (existing) {
        this.updateRoom(existing, roomAgents)
      } else {
        const label = this.cwdToLabel(cwd)
        const room = this.createRoom(cwd, label, roomAgents)
        this.rooms.set(cwd, room)
      }
    }

    this.layoutRooms()
    this.updateCameraBounds()

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
    this.drawTripletLines()
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
    this.drawTripletLines()
  }

  // ---------------------------------------------------------------------------
  // Room creation
  // ---------------------------------------------------------------------------

  private createRoom(cwd: string, label: string, agents: AgentState[]): Room {
    const { width, height } = this.calcRoomSize(agents.length)
    const container = this.add.container(0, 0)
    const floorGraphics = this.add.graphics()
    container.add(floorGraphics)

    const activityBar = this.add.rectangle(-width / 2, height / 2 + 2, 0, 2, 0x34d399, 1).setOrigin(0, 0)
    container.add(activityBar)

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
      cwd, label, agents,
      x: 0, y: 0, width, height,
      container,
      workstations: new Map(),
      floorGraphics,
      activityBar, activityBarTween: null,
      statusLed, statusLedGlow, statusLedTween: null,
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
    const WALL_T = 6
    const WALL_I = 2

    // Drop shadow
    g.fillStyle(0x000000, 0.3)
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w, h, 8)

    // Outer wall
    g.fillStyle(COLOR_WALL)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6)

    // Inner wall highlight
    g.fillStyle(COLOR_WALL_INNER)
    g.fillRoundedRect(-w / 2 + WALL_T, -h / 2 + WALL_T, w - WALL_T * 2, h - WALL_T * 2, 4)

    // Floor
    const floorX = -w / 2 + WALL_T + WALL_I
    const floorY = -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H
    const floorW = w - (WALL_T + WALL_I) * 2
    const floorH = h - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H

    g.fillStyle(COLOR_ROOM_FLOOR)
    g.fillRect(floorX, floorY, floorW, floorH)

    // Carpet grid pattern
    g.lineStyle(1, COLOR_ROOM_FLOOR2, 0.25)
    const GRID = 32
    for (let py = floorY; py < floorY + floorH; py += GRID) {
      g.lineBetween(floorX, py, floorX + floorW, py)
    }
    for (let px = floorX; px < floorX + floorW; px += GRID) {
      g.lineBetween(px, floorY, px, floorY + floorH)
    }

    // Header bar
    g.fillStyle(COLOR_HEADER_BG)
    g.fillRect(-w / 2 + WALL_T + WALL_I, -h / 2 + WALL_T + WALL_I, floorW, ROOM_HEADER_H)

    // Blue accent line
    g.lineStyle(2, COLOR_DOOR_FRAME, 0.7)
    g.lineBetween(
      -w / 2 + WALL_T + WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
      w / 2 - WALL_T - WALL_I,
      -h / 2 + WALL_T + WALL_I + ROOM_HEADER_H,
    )

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

    const charIdx = isCursor ? 1 : this.getCharacterIndex(agent.config.name)
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

    const hitArea = this.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge,
      deskBody, deskTop, monitorSprite, chairSprite,
      monitorGlowOverlay, screenLines, screenTween,
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
        this.panToAgent(agent.config.id)
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
    ws.lastStateFingerprint = fp
    ws.state = agent

    const isCursor = this.isCursorAgent(agent)
    const charIdx = isCursor ? 1 : this.getCharacterIndex(agent.config.name)
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

    // Thought bubble
    let icon: string | null = null
    let bgColor = 0x475569
    if (isAcceptEdits)      { icon = '~';  bgColor = 0x3b82f6 }
    else if (isPlan)        { icon = '?';  bgColor = 0x8b5cf6 }
    else if (isWorking)     { icon = '*';  bgColor = 0x059669 }
    else if (!isWaiting)    { icon = '\u2615'; bgColor = 0x475569 }
    // isWaiting with no special state: no bubble (duplicate indicator exists)

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
    const floorStartY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H + ROOM_PADDING

    const usableW = room.width  - (WALL_T + WALL_I + ROOM_PADDING) * 2
    const usableH = room.height - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H - ROOM_PADDING * 2

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
    if (ws.typingTween)      ws.typingTween.destroy()
    if (ws.headTiltTween)    ws.headTiltTween.destroy()
    if (ws.monitorGlowTween) ws.monitorGlowTween.destroy()
    if (ws.screenTween)      ws.screenTween.destroy()
    if (ws.pulseTween)       ws.pulseTween.destroy()
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
      height: (WALL_T + WALL_I) * 2 + ROOM_HEADER_H + ROOM_PADDING * 2 + rows * WORKSTATION_H,
    }
  }

  private layoutRooms(): void {
    const roomList = Array.from(this.rooms.values())
    if (roomList.length === 0) {
      this.worldWidth  = 800
      this.worldHeight = 600
      this.updateCameraBounds()
      return
    }

    // Flow layout: pack rooms left-to-right, wrapping to next row by actual size
    const availableW = Math.max(this.viewWidth - WORLD_MARGIN * 2, 300)

    let cursorX = 0
    let cursorY = 0
    let rowHeight = 0

    for (const room of roomList) {
      // Wrap to next row if this room doesn't fit
      if (cursorX > 0 && cursorX + room.width > availableW) {
        cursorX = 0
        cursorY += rowHeight + ROOM_GAP
        rowHeight = 0
      }

      room.x = WORLD_MARGIN + cursorX + room.width / 2
      room.y = WORLD_MARGIN + cursorY + room.height / 2

      this.tweens.killTweensOf(room.container)
      if (!this.hasInitialZoomToFit) {
        // First layout: place instantly to avoid flash
        room.container.setPosition(room.x, room.y)
      } else {
        this.tweens.add({ targets: room.container, x: room.x, y: room.y, duration: 320, ease: 'Power2' })
      }

      cursorX += room.width + ROOM_GAP
      rowHeight = Math.max(rowHeight, room.height)
    }

    for (const room of roomList) {
      this.refreshRoomHeaderText(room)
    }

    let maxX = 0, maxY = 0
    for (const room of this.rooms.values()) {
      maxX = Math.max(maxX, room.x + room.width  / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    this.worldWidth  = maxX + WORLD_MARGIN
    this.worldHeight = maxY + WORLD_MARGIN

    // Draw office background behind rooms — clamp to viewport width
    if (this.officeGraphics) {
      const bgW = Math.min(maxX + WORLD_MARGIN, this.viewWidth - 60)
      this.drawOfficeBackground(bgW, maxY + WORLD_MARGIN)
    }

    this.updateCameraBounds()
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

    // Floor
    g.fillStyle(0x0f172a)
    g.fillRoundedRect(x0, y0, w, h, 2)

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

      // Plants in corners
      decos.push(this.add.sprite(x0 + 14, y0 + h - 14, 'office', OFFICE_FRAME_PLANT).setScale(DECO_SCALE).setAlpha(0.7).setDepth(-1))
      decos.push(this.add.sprite(x0 + w - 14, y0 + h - 14, 'office', OFFICE_FRAME_PLANT_SM).setScale(DECO_SCALE).setAlpha(0.7).setDepth(-1))
      decos.push(this.add.sprite(x0 + w - 14, y0 + 14, 'office', OFFICE_FRAME_PLANT_SM).setScale(DECO_SCALE * 0.8).setAlpha(0.5).setDepth(-1))

      // Picture frames along top wall
      const picFrames = [OFFICE_FRAME_PICTURE, OFFICE_FRAME_PICTURE2, OFFICE_FRAME_PICTURE3]
      const picCount = Math.min(5, Math.floor(w / 90))
      const picSpacing = w / (picCount + 1)
      for (let i = 0; i < picCount; i++) {
        decos.push(this.add.sprite(x0 + picSpacing * (i + 1), y0 + 8, 'office', picFrames[i % picFrames.length])
          .setScale(DECO_SCALE * 0.85).setAlpha(0.45).setDepth(-1))
      }

      // Bookshelf on left
      if (h > 140) {
        decos.push(this.add.sprite(x0 + 14, y0 + 50, 'office', OFFICE_FRAME_BOOKSHELF).setScale(DECO_SCALE).setAlpha(0.45).setDepth(-1))
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
      const p = this.add.circle(0, 0, 2, 0xffffff, 0).setDepth(9998).setVisible(false)
      p.setData('busy', false)
      this.typingParticlePool.push(p)
    }
  }

  private spawnTypingParticle(worldX: number, worldY: number): void {
    const p = this.typingParticlePool.find(c => !c.getData('busy'))
    if (!p) return
    const colors = [0x0ea5e9, 0x34d399, 0xffffff]
    p.setPosition(worldX + (Math.random() - 0.5) * 20, worldY)
    p.setFillStyle(colors[Math.floor(Math.random() * colors.length)])
    p.setAlpha(1).setVisible(true).setData('busy', true)
    this.tweens.add({
      targets: p,
      y: worldY - 20 - Math.random() * 20,
      x: p.x + (Math.random() - 0.5) * 16,
      alpha: 0,
      duration: 800 + Math.random() * 400,
      ease: 'Quad.easeOut',
      onComplete: () => { p.setVisible(false).setData('busy', false) },
    })
  }

  private tickParticles(): void {
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        const m = ws.state.sessionMode
        if (m !== 'working' && m !== 'plan') continue
        if (ws.state.needsInteraction) continue
        const wx = room.x + ws.container.x
        const wy = room.y + ws.container.y + WS_DESK_Y
        if (Math.random() < 0.3) this.spawnTypingParticle(wx, wy)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Room activity bar
  // ---------------------------------------------------------------------------

  private updateRoomActivity(room: Room): void {
    const agents = room.agents
    if (agents.length === 0) return
    const hasWaiting = agents.some(a => a.needsInteraction)
    const activeCount = agents.filter(a => a.needsInteraction || a.sessionMode === 'working' || a.sessionMode === 'plan').length

    const targetW = (activeCount / agents.length) * room.width
    room.activityBar.setFillStyle(hasWaiting ? 0xfbbf24 : 0x34d399)
    room.activityBar.setPosition(-room.width / 2, room.height / 2 + 1)
    if (room.activityBarTween) room.activityBarTween.destroy()
    room.activityBarTween = this.tweens.add({ targets: room.activityBar, width: targetW, duration: 280, ease: 'Power2' })
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWaiting = agent.needsInteraction
    const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !isWaiting

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return
    ws.lastAnimMode = mode

    // Tear down all animation state
    if (ws.bounceTween)      { ws.bounceTween.destroy();      ws.bounceTween      = undefined }
    if (ws.dotPulseTween)    { ws.dotPulseTween.destroy();    ws.dotPulseTween    = undefined; ws.statusDot.setAlpha(1) }
    if (ws.typingTween)      { ws.typingTween.destroy();      ws.typingTween      = undefined; ws.sprite.x = 0 }
    if (ws.monitorGlowTween) { ws.monitorGlowTween.destroy(); ws.monitorGlowTween = undefined }
    if (ws.breathTween)      { ws.breathTween.destroy();      ws.breathTween      = undefined }
    if (ws.headTiltTween)    { ws.headTiltTween.destroy();    ws.headTiltTween    = undefined }
    if (ws.pulseTween)       { ws.pulseTween.destroy();       ws.pulseTween       = undefined }

    ws.sprite.y = WS_SPRITE_Y
    ws.sprite.x = 0
    ws.sprite.setScale(CHAR_SCALE)
    ws.sprite.setAngle(0)

    this.updateMonitorGlow(ws, isWorking, isWaiting)

    const isCursor = this.isCursorAgent(agent)
    const charIdx = isCursor ? 1 : this.getCharacterIndex(agent.config.name)
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
  // Helpers
  // ---------------------------------------------------------------------------

  private getPoseFrame(charIdx: number, agent: AgentState): number {
    const base = charIdx * CHAR_COLS
    if (agent.needsInteraction)                                           return base + POSE_SURPRISE
    if (agent.sessionMode === 'working' || agent.sessionMode === 'plan') return base + POSE_INTERACT
    if (agent.sessionMode === 'idle' || !agent.sessionMode)              return base + POSE_SIT
    return base + POSE_IDLE
  }

  private getStatusColor(agent: AgentState): number {
    if (agent.needsInteraction)                return 0xfbbf24
    if (agent.sessionMode === 'working')       return 0x34d399
    if (agent.sessionMode === 'plan')          return 0xa78bfa
    if (agent.sessionMode === 'accept-edits')  return 0x60a5fa
    return 0x64748b
  }

  private isCursorAgent(agent: AgentState): boolean {
    return agent.config.model === 'cursor-agent'
  }

  private getCharacterIndex(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % NUM_CHARS
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

  private drawTripletLines(): void {
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
    }
  }

  private drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
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

  private zoomToFit(animated: boolean): void {
    if (this.rooms.size === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of this.rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2)
      minY = Math.min(minY, room.y - room.height / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      maxY = Math.max(maxY, room.y + room.height / 2)
    }
    const padFactor = 1.15
    const fitZoom = Phaser.Math.Clamp(
      Math.min(this.viewWidth / ((maxX - minX) * padFactor), this.viewHeight / ((maxY - minY) * padFactor)),
      ZOOM_MIN, ZOOM_MAX,
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

  private initMinimap(): void {
    this.minimapContainer = this.add.container(0, 0).setDepth(10010).setScrollFactor(0)
    this.minimapGraphics = this.add.graphics().setScrollFactor(0)
    this.minimapViewport = this.add.graphics().setScrollFactor(0)
    this.minimapContainer.add([this.minimapGraphics, this.minimapViewport])
    this.repositionMinimap()
  }

  private repositionMinimap(): void {
    if (!this.minimapContainer) return
    this.minimapContainer.setPosition(
      this.viewWidth - MINIMAP_W - MINIMAP_MARGIN,
      this.viewHeight - MINIMAP_H - MINIMAP_MARGIN,
    )
  }

  private drawMinimap(): void {
    if (!this.minimapGraphics || !this.minimapViewport || this.rooms.size === 0) return
    const mg = this.minimapGraphics, vg = this.minimapViewport
    mg.clear(); vg.clear()
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
    for (const room of this.rooms.values()) {
      const rx = pad + (room.x - room.width / 2 - minX) * s
      const ry = pad + (room.y - room.height / 2 - minY) * s
      const hasWorking = room.agents.some(a => a.sessionMode === 'working' || a.sessionMode === 'plan')
      const hasWaiting = room.agents.some(a => a.needsInteraction)
      mg.fillStyle(hasWaiting ? 0xfbbf24 : hasWorking ? 0x34d399 : MINIMAP_ROOM_COLOR, hasWaiting || hasWorking ? 0.6 : 0.4)
      mg.fillRect(rx, ry, room.width * s, room.height * s)
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
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, ZOOM_MIN, ZOOM_MAX)
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

    this.typingParticleTimer?.destroy()
    this.typingParticleTimer = null
    for (const p of this.typingParticlePool) { this.tweens.killTweensOf(p); p.destroy() }
    this.typingParticlePool = []

    // Minimap cleanup
    this.minimapGraphics?.destroy()
    this.minimapViewport?.destroy()
    this.minimapContainer?.destroy()
    this.minimapGraphics = null
    this.minimapViewport = null
    this.minimapContainer = null

    // Keyboard selection cleanup
    this.stopAutoPan()
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    this.selectionRing?.destroy()
    this.selectionRing = null

    for (const s of this.officeDecoSprites) s.destroy()
    this.officeDecoSprites = []
    this.officeGraphics?.destroy()
    this.officeGraphics = null

    for (const room of this.rooms.values()) {
      this.destroyRoom(room)
    }
    this.rooms.clear()
  }
}
