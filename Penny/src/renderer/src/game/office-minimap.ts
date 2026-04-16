// ---------------------------------------------------------------------------
// OfficeMinimap — screen-space minimap with room layout, agent dots,
// viewport indicator, and click-to-pan navigation.
//
// Issue #256 — RPG UI 1a: Minimap — room layout, agent dots, click-to-pan
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { Room } from './office-types'
import { getStatusColor, getTeamColor } from './office-helpers'

// ---------------------------------------------------------------------------
// Host-scene interface
// ---------------------------------------------------------------------------

export interface MinimapHostScene {
  /** All rooms indexed by cwd key */
  readonly rooms: Map<string, Room>
  /** Current viewport width */
  readonly viewWidth: number
  /** Current viewport height */
  readonly viewHeight: number
  /** Smooth-pan the main camera to a world position */
  smoothNavigateCameraTo(wx: number, wy: number): void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINIMAP_W       = 180
const MINIMAP_H       = 120
const MINIMAP_PAD     = 10   // distance from screen edge
const MINIMAP_TITLE_H = 14   // header bar height
const MINIMAP_BG_CLR  = 0x0a1120
const MINIMAP_BG_A    = 0.82
const MINIMAP_DEPTH   = 9998 // above most overlays, below notifications (9999+)

const AGENT_DOT_R = 2        // radius for agent dots (px, minimap space)
const CAMERA_DOT_R = 3       // radius for camera-center dot

// ---------------------------------------------------------------------------
// OfficeMinimap
// ---------------------------------------------------------------------------

export class OfficeMinimap {
  private readonly scene: Phaser.Scene
  private readonly host: MinimapHostScene

  // --- Container and graphics layers ---
  private container!: Phaser.GameObjects.Container
  private bgRect!: Phaser.GameObjects.Rectangle
  private titleText!: Phaser.GameObjects.Text
  private collapseBtn!: Phaser.GameObjects.Text
  private roomGfx!: Phaser.GameObjects.Graphics
  private agentGfx!: Phaser.GameObjects.Graphics
  private viewportGfx!: Phaser.GameObjects.Graphics
  private camDot!: Phaser.GameObjects.Arc
  private camDotPulseTween!: Phaser.Tweens.Tween

  // --- State ---
  private _collapsed = false
  private lastDrawAt  = 0
  private worldBounds = { x: 0, y: 0, w: 2400, h: 1200 }

  constructor(scene: Phaser.Scene, host: MinimapHostScene) {
    this.scene = scene
    this.host  = host
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    const { scene } = this
    const px = viewWidth  - MINIMAP_W - MINIMAP_PAD
    const py = viewHeight - MINIMAP_H - MINIMAP_TITLE_H - MINIMAP_PAD

    // Root container — fixed to camera via scrollFactor(0)
    this.container = scene.add.container(px, py)
    this.container.setScrollFactor(0)
    this.container.setDepth(MINIMAP_DEPTH)

    // Background panel (title bar + map area)
    this.bgRect = scene.add.rectangle(
      0, 0,
      MINIMAP_W, MINIMAP_TITLE_H + MINIMAP_H,
      MINIMAP_BG_CLR, MINIMAP_BG_A,
    ).setOrigin(0, 0)
    this.bgRect.setStrokeStyle(1, 0x1e3a5f, 1)
    this.container.add(this.bgRect)

    // Title text
    this.titleText = scene.add.text(6, 2, 'MINIMAP', {
      fontSize: '9px',
      color: '#64748b',
      fontFamily: 'monospace',
      resolution: 2,
    }).setOrigin(0, 0)
    this.container.add(this.titleText)

    // Collapse/expand button (top-right of title bar)
    this.collapseBtn = scene.add.text(MINIMAP_W - 5, 2, '−', {
      fontSize: '9px',
      color: '#475569',
      fontFamily: 'monospace',
      resolution: 2,
    }).setOrigin(1, 0)
    this.container.add(this.collapseBtn)

    // Clickable title bar — toggles collapse
    const titleZone = scene.add
      .rectangle(0, 0, MINIMAP_W, MINIMAP_TITLE_H, 0x000000, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
    titleZone.on('pointerdown', () => this.toggleCollapse())
    this.container.add(titleZone)

    // Graphics layers — positioned below title bar
    this.roomGfx = scene.add.graphics().setPosition(0, MINIMAP_TITLE_H)
    this.container.add(this.roomGfx)

    this.agentGfx = scene.add.graphics().setPosition(0, MINIMAP_TITLE_H)
    this.container.add(this.agentGfx)

    this.viewportGfx = scene.add.graphics().setPosition(0, MINIMAP_TITLE_H)
    this.container.add(this.viewportGfx)

    // Clickable map area — click-to-pan
    const mapZone = scene.add
      .rectangle(0, MINIMAP_TITLE_H, MINIMAP_W, MINIMAP_H, 0x000000, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
    mapZone.on('pointerdown', (_ptr: Phaser.Input.Pointer, localX: number, localY: number) => {
      if (this._collapsed) return
      this._panToMiniMapPoint(localX, localY)
    })
    this.container.add(mapZone)

    // Camera-center dot (pulsing white)
    this.camDot = scene.add.arc(0, 0, CAMERA_DOT_R, 0, 360, false, 0xffffff, 0.9)
    this.camDot.setScrollFactor(0)
    this.container.add(this.camDot)

    this.camDotPulseTween = scene.tweens.add({
      targets: this.camDot,
      alpha: { from: 0.9, to: 0.3 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this._draw()
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  setViewSize(viewWidth: number, viewHeight: number): void {
    const px = viewWidth  - MINIMAP_W - MINIMAP_PAD
    const py = viewHeight - MINIMAP_H - MINIMAP_TITLE_H - MINIMAP_PAD
    this.container.setPosition(px, py)
  }

  // ---------------------------------------------------------------------------
  // Update — called from OfficeScene.update() every frame
  // ---------------------------------------------------------------------------

  update(time: number): void {
    if (this._collapsed) return
    // Throttle redraws to ~150ms
    if (time - this.lastDrawAt < 150) return
    this.lastDrawAt = time
    this._draw()
  }

  // ---------------------------------------------------------------------------
  // Toggle
  // ---------------------------------------------------------------------------

  toggleCollapse(): void {
    this._collapsed = !this._collapsed
    this.roomGfx.setVisible(!this._collapsed)
    this.agentGfx.setVisible(!this._collapsed)
    this.viewportGfx.setVisible(!this._collapsed)
    this.camDot.setVisible(!this._collapsed)
    this.collapseBtn.setText(this._collapsed ? '+' : '−')

    // Shrink bg to title-bar-only height when collapsed
    if (this._collapsed) {
      this.bgRect.setSize(MINIMAP_W, MINIMAP_TITLE_H)
    } else {
      this.bgRect.setSize(MINIMAP_W, MINIMAP_TITLE_H + MINIMAP_H)
      // Force redraw immediately when expanding
      this.lastDrawAt = 0
    }
  }

  get isCollapsed(): boolean {
    return this._collapsed
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private _computeWorldBounds(): void {
    const { rooms } = this.host
    if (rooms.size === 0) {
      this.worldBounds = { x: 0, y: 0, w: 2400, h: 1200 }
      return
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of rooms.values()) {
      const hw = room.width  / 2
      const hh = room.height / 2
      minX = Math.min(minX, room.x - hw)
      minY = Math.min(minY, room.y - hh)
      maxX = Math.max(maxX, room.x + hw)
      maxY = Math.max(maxY, room.y + hh)
    }

    const pad = 40
    this.worldBounds = {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(maxX - minX + pad * 2, 1),
      h: Math.max(maxY - minY + pad * 2, 1),
    }
  }

  /** Map a world-space coordinate to minimap-local pixel coordinates. */
  private _toMini(wx: number, wy: number): { x: number; y: number } {
    const { x, y, w, h } = this.worldBounds
    return {
      x: ((wx - x) / w) * MINIMAP_W,
      y: ((wy - y) / h) * MINIMAP_H,
    }
  }

  private _draw(): void {
    this._computeWorldBounds()
    this._drawRooms()
    this._drawAgentDots()
    this._drawViewportRect()
    this._updateCamDot()
  }

  private _drawRooms(): void {
    const g = this.roomGfx
    g.clear()

    for (const room of this.host.rooms.values()) {
      const color = getTeamColor(room.teamKey)
      const hw = room.width  / 2
      const hh = room.height / 2
      const tl = this._toMini(room.x - hw, room.y - hh)
      const br = this._toMini(room.x + hw, room.y + hh)
      const rw = Math.max(br.x - tl.x, 2)
      const rh = Math.max(br.y - tl.y, 2)

      // Filled room area (very low alpha so outlines read clearly)
      g.fillStyle(color, 0.15)
      g.fillRect(tl.x, tl.y, rw, rh)

      // Outline
      g.lineStyle(1, color, 0.75)
      g.strokeRect(tl.x, tl.y, rw, rh)
    }
  }

  private _drawAgentDots(): void {
    const g = this.agentGfx
    g.clear()

    for (const room of this.host.rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue

        const color  = getStatusColor(ws.state)
        // World position of the workstation (container is relative to room center)
        const wx = room.x + ws.container.x
        const wy = room.y + ws.container.y
        const mp = this._toMini(wx, wy)

        g.fillStyle(color, 0.95)
        g.fillCircle(mp.x, mp.y, AGENT_DOT_R)

        // Thin white halo for visibility
        g.lineStyle(0.5, 0xffffff, 0.25)
        g.strokeCircle(mp.x, mp.y, AGENT_DOT_R)
      }
    }
  }

  private _drawViewportRect(): void {
    const g  = this.viewportGfx
    const cam = this.scene.cameras.main
    g.clear()

    const camL = cam.scrollX
    const camT = cam.scrollY
    const camR = cam.scrollX + cam.width  / cam.zoom
    const camB = cam.scrollY + cam.height / cam.zoom

    const tl = this._toMini(camL, camT)
    const br = this._toMini(camR, camB)
    const vw = Math.max(br.x - tl.x, 4)
    const vh = Math.max(br.y - tl.y, 4)

    // Clip to minimap bounds
    const clx = Math.max(tl.x, 0)
    const cly = Math.max(tl.y, 0)
    const clw = Math.min(vw - (clx - tl.x), MINIMAP_W - clx)
    const clh = Math.min(vh - (cly - tl.y), MINIMAP_H - cly)
    if (clw <= 0 || clh <= 0) return

    g.lineStyle(1, 0xffffff, 0.7)
    g.strokeRect(clx, cly, clw, clh)

    // Subtle fill so the viewport zone is readable
    g.fillStyle(0xffffff, 0.05)
    g.fillRect(clx, cly, clw, clh)
  }

  private _updateCamDot(): void {
    const cam = this.scene.cameras.main
    const cx = cam.scrollX + cam.width  / (2 * cam.zoom)
    const cy = cam.scrollY + cam.height / (2 * cam.zoom)
    const mp = this._toMini(cx, cy)

    // Position relative to container (account for title bar offset)
    const dotX = Math.max(CAMERA_DOT_R, Math.min(mp.x, MINIMAP_W - CAMERA_DOT_R))
    const dotY = MINIMAP_TITLE_H + Math.max(CAMERA_DOT_R, Math.min(mp.y, MINIMAP_H - CAMERA_DOT_R))
    this.camDot.setPosition(dotX, dotY)
  }

  // ---------------------------------------------------------------------------
  // Click-to-pan
  // ---------------------------------------------------------------------------

  private _panToMiniMapPoint(localX: number, localY: number): void {
    const { x, y, w, h } = this.worldBounds
    const wx = x + (localX / MINIMAP_W) * w
    const wy = y + (localY / MINIMAP_H) * h
    this.host.smoothNavigateCameraTo(wx, wy)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.camDotPulseTween?.stop()
    this.container?.destroy(true)
  }
}
