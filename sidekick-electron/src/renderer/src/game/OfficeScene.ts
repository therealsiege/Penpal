import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState } from '../types'

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

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHAR_SCALE      = 0.134
const WORKSTATION_W   = 88
const WORKSTATION_H   = 96
const ROOM_PADDING    = 19
const ROOM_HEADER_H   = 22
const ROOM_GAP        = 6
const MAX_AGENTS_PER_ROW = 4

const WS_CHAIR_Y    = 6
const WS_SPRITE_Y   = -5
const WS_DESK_Y     = 18
const WS_MONITOR_Y  = 5
const WS_NAME_Y     = 40
const WS_BLURB_Y    = 50
const WS_DOT_GAP    = 4

// Colors
const COLOR_BG          = 0x111827
const COLOR_ROOM_FLOOR  = 0x94a3b8
const COLOR_ROOM_FLOOR2 = 0x8b97a8
const COLOR_WALL        = 0xcbd5e1
const COLOR_WALL_INNER  = 0xe2e8f0
const COLOR_DESK_BODY   = 0x475569
const COLOR_DESK_TOP    = 0x64748b
const COLOR_HEADER_BG   = 0x1e293b
const COLOR_DOOR_FRAME  = 0x3b82f6

const WORLD_MARGIN   = 60

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface WorkstationSprite {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  nameText: Phaser.GameObjects.Text
  statusDot: Phaser.GameObjects.Arc
  roleBadge: Phaser.GameObjects.Text | null
  blurbText: Phaser.GameObjects.Text
  deskBody: Phaser.GameObjects.Rectangle
  deskTop: Phaser.GameObjects.Rectangle
  monitorSprite: Phaser.GameObjects.Sprite | null
  chairSprite: Phaser.GameObjects.Sprite | null
  state: AgentState | null
  breathTween?: Phaser.Tweens.Tween
  bounceTween?: Phaser.Tweens.Tween
  dotPulseTween?: Phaser.Tweens.Tween
  lastAnimMode?: 'idle' | 'working' | 'waiting'
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

  // Fix 11: Hover tooltip
  private tooltipText: Phaser.GameObjects.Text | null = null
  private tooltipBg: Phaser.GameObjects.Rectangle | null = null

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

    // Camera pan
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.isDraggingAgent) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
      }
    })

    // Zoom
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, _gz: unknown, deltaY: number) => {
        const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.4, 2.0)
        cam.setZoom(newZoom)
      },
    )

    // Resize — re-layout rooms when viewport changes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.viewWidth  = gameSize.width
      this.viewHeight = gameSize.height
      if (this.rooms.size > 0) {
        this.layoutRooms()
        this.updateCameraBounds()
      }
    })

    this.isReady = true
    if (this.pendingAgents) {
      this.setAgents(this.pendingAgents)
      this.pendingAgents = null
    }
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

  // ---------------------------------------------------------------------------
  // Room creation
  // ---------------------------------------------------------------------------

  private createRoom(cwd: string, label: string, agents: AgentState[]): Room {
    const { width, height } = this.calcRoomSize(agents.length)
    const container = this.add.container(0, 0)
    const floorGraphics = this.add.graphics()
    container.add(floorGraphics)

    const room: Room = {
      cwd, label, agents,
      x: 0, y: 0, width, height,
      container,
      workstations: new Map(),
      floorGraphics,
    }

    this.drawRoomBackground(room)
    this.syncWorkstations(room, agents)
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
  }

  private destroyRoom(room: Room): void {
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

    const deskBody = this.add.rectangle(0, WS_DESK_Y, 64, 21, COLOR_DESK_BODY).setStrokeStyle(1, 0x64748b, 0.5)
    wsContainer.add(deskBody)

    const deskTop = this.add.rectangle(0, WS_DESK_Y - 8, 61, 3, COLOR_DESK_TOP)
    wsContainer.add(deskTop)

    let monitorSprite: Phaser.GameObjects.Sprite | null = null
    if (this.officeTilesLoaded) {
      monitorSprite = this.add.sprite(0, WS_MONITOR_Y, 'office', FRAME_MONITOR).setScale(0.42)
      wsContainer.add(monitorSprite)
    } else {
      wsContainer.add(this.add.rectangle(0, WS_MONITOR_Y, 16, 13, 0x1a1a2e).setStrokeStyle(1, 0x4a5568, 0.8))
    }

    const charIdx = this.getCharacterIndex(agent.config.name)
    const frame   = this.getPoseFrame(charIdx, agent)
    const sprite  = this.add.sprite(0, WS_SPRITE_Y, 'characters', frame)
    sprite.setScale(CHAR_SCALE).setOrigin(0.5, 1)
    wsContainer.add(sprite)

    // Show persona name (e.g. "Marcus Chen") instead of title
    const displayName = agent.config.name || agent.config.title || agent.config.id
    const nameText = this.add.text(0, WS_NAME_Y, this.truncName(displayName), {
      fontSize: '11px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0f172acc', padding: { x: 4, y: 2 }, align: 'center',
      resolution: 2,
    }).setOrigin(0.5)
    wsContainer.add(nameText)

    const dotColor  = this.getStatusColor(agent)
    const statusDot = this.add.circle(nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y, 3.5, dotColor)
    wsContainer.add(statusDot)

    // Triplet role badge (small icon below name)
    let roleBadge: Phaser.GameObjects.Text | null = null
    const tripletRole = (agent.config as { tripletRole?: string }).tripletRole
    if (tripletRole) {
      const roleChar = tripletRole === 'solver' ? 'S' : tripletRole === 'reviewer' ? 'R' : 'E'
      const roleColor = tripletRole === 'solver' ? '#34d399' : tripletRole === 'reviewer' ? '#60a5fa' : '#fb923c'
      roleBadge = this.add.text(-(nameText.width / 2) - WS_DOT_GAP - 4, WS_NAME_Y, roleChar, {
        fontSize: '8px', color: roleColor,
        fontFamily: 'system-ui, monospace', fontStyle: 'bold',
        backgroundColor: '#0f172acc', padding: { x: 2, y: 1 },
        resolution: 2,
      }).setOrigin(1, 0.5)
      wsContainer.add(roleBadge)
    }

    const blurbText = this.add.text(0, WS_BLURB_Y, '', {
      fontSize: '9px', color: '#94a3b8', fontFamily: 'system-ui, sans-serif',
      align: 'center', wordWrap: { width: WORKSTATION_W + 20 },
      resolution: 2,
    }).setOrigin(0.5, 0)
    wsContainer.add(blurbText)

    const hitArea = this.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge, blurbText,
      deskBody, deskTop, monitorSprite, chairSprite, state: agent,
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
      // Fix 11: Show backstory tooltip on hover
      const backstory = (agent.config as { persona?: { backstory?: string } }).persona?.backstory
      if (backstory) {
        const worldX = room.container.x + wsContainer.x
        const worldY = room.container.y + wsContainer.y - WORKSTATION_H / 2
        this.showTooltip(worldX, worldY, backstory.slice(0, 150))
      }
    })

    hitArea.on('pointerout', () => {
      this.tweens.killTweensOf(wsContainer)
      this.tweens.add({ targets: wsContainer, scaleX: 1, scaleY: 1, duration: 140, ease: 'Power2' })
      this.restoreDeskStroke(ws)
      this.hideTooltip()
    })

    this.startBreathing(ws)
    this.updateWorkstation(ws, agent)
    return ws
  }

  private updateWorkstation(ws: WorkstationSprite, agent: AgentState): void {
    ws.state = agent

    const charIdx = this.getCharacterIndex(agent.config.name)
    ws.sprite.setFrame(this.getPoseFrame(charIdx, agent))

    const dotColor = this.getStatusColor(agent)
    ws.statusDot.setFillStyle(dotColor)
    ws.statusDot.setPosition(ws.nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y)

    const blurb = agent.lastAssistantBlurb ?? ''
    ws.blurbText.setText(blurb.length > 48 ? blurb.slice(0, 45) + '...' : blurb)

    const isWorking = agent.sessionMode === 'working' || agent.sessionMode === 'plan'
    const isWaiting = agent.needsInteraction
    if (ws.monitorSprite) {
      ws.monitorSprite.setTint(isWorking ? 0x0ea5e9 : isWaiting ? 0xf59e0b : 0xffffff)
      ws.monitorSprite.setAlpha(isWorking ? 0.95 : isWaiting ? 0.9 : 0.7)
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
    if (ws.breathTween)   ws.breathTween.destroy()
    if (ws.bounceTween)   ws.bounceTween.destroy()
    if (ws.dotPulseTween) ws.dotPulseTween.destroy()
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
      this.tweens.add({ targets: room.container, x: room.x, y: room.y, duration: 320, ease: 'Power2' })

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

    this.updateCameraBounds()
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
  // Animations
  // ---------------------------------------------------------------------------

  private startBreathing(ws: WorkstationSprite): void {
    if (ws.breathTween) ws.breathTween.destroy()
    ws.breathTween = this.tweens.add({
      targets: ws.sprite, scaleY: CHAR_SCALE * 0.96,
      duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  private updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWorking = agent.sessionMode === 'working' || agent.sessionMode === 'plan'
    const isWaiting = agent.needsInteraction

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return
    ws.lastAnimMode = mode

    if (ws.bounceTween)   { ws.bounceTween.destroy();   ws.bounceTween   = undefined }
    if (ws.dotPulseTween) { ws.dotPulseTween.destroy(); ws.dotPulseTween = undefined; ws.statusDot.setAlpha(1) }

    if (isWaiting) {
      ws.bounceTween = this.tweens.add({
        targets: ws.sprite, y: WS_SPRITE_Y - 4,
        duration: 460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.deskBody.setStrokeStyle(2, 0xfbbf24, 0.8)
      ws.dotPulseTween = this.tweens.add({
        targets: ws.statusDot, alpha: 0.2,
        duration: 620, yoyo: true, repeat: -1,
      })
    } else if (isWorking) {
      ws.bounceTween = this.tweens.add({
        targets: ws.sprite, y: WS_SPRITE_Y - 2,
        duration: 820, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.55)
    } else {
      ws.sprite.y = WS_SPRITE_Y
      this.restoreDeskStroke(ws)
    }
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
    return `[ ${label.toUpperCase()} ]`
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
  // Hover tooltip (Fix 11)
  // ---------------------------------------------------------------------------

  private showTooltip(x: number, y: number, text: string): void {
    if (!this.tooltipText) {
      this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x0f172a, 0.9)
        .setStrokeStyle(1, 0x334155)
        .setDepth(10001)
        .setOrigin(0.5, 1)
      this.tooltipText = this.add.text(0, 0, '', {
        fontSize: '10px', color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        wordWrap: { width: 180 },
        resolution: 2,
        padding: { x: 6, y: 4 },
      }).setDepth(10002).setOrigin(0.5, 1)
    }

    this.tooltipText.setText(text)
    this.tooltipText.setPosition(x, y - 20)
    this.tooltipText.setVisible(true)

    if (this.tooltipBg) {
      this.tooltipBg.setPosition(x, y - 20)
      this.tooltipBg.setSize(this.tooltipText.width + 12, this.tooltipText.height + 8)
      this.tooltipBg.setVisible(true)
    }
  }

  private hideTooltip(): void {
    this.tooltipText?.setVisible(false)
    this.tooltipBg?.setVisible(false)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    for (const room of this.rooms.values()) {
      this.destroyRoom(room)
    }
    this.rooms.clear()
  }
}
