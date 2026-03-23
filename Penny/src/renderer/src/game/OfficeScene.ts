import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState, OpencodeSession } from '../types'
import { activeTheme, setActiveTheme, lerpColor, THEMES, type ThemeName } from './office-theme'
import { NavMesh } from './nav-mesh'
import { PennyCafe, type CafeHostScene } from './penny-cafe'
import { GitHubBuilding, type GitHubBuildingHostScene } from './office-github'
import { OfficeParticles } from './office-particles'
import { OfficeAtmosphere } from './office-atmosphere'
import { OfficeUI } from './office-ui'
import { OfficeAmbient } from './office-ambient'
import { OfficePods } from './office-pods'
import { OfficeSelection } from './office-selection'
import { OfficeMinimap } from './office-minimap'
import { OfficeRooms } from './office-rooms'
import { OfficeWorkstations } from './office-workstation'
import { OfficeBackground } from './office-background'
import type { WorkstationSprite, Room, PodLineInfo, OfficeDebugSnapshot } from './office-types'
import {
  getPoseFrame, getRoomDoorY, getStatusColor,
  hashToken, getAgentCharacterIndex, getTeamInfo, getTeamColor,
  cwdToLabel, formatLabel,
} from './office-helpers'

import {
  KB_ZOOM_STEP,
  CHAR_FRAME_W, CHAR_FRAME_H,
  OFFICE_TILE_SIZE, ROOM_TILE_SIZE,
  WORKSTATION_W, WORKSTATION_H,
  COLOR_BG, COLOR_LED_GREEN, COLOR_LED_AMBER, COLOR_LED_GRAY,
  WORLD_MARGIN, ZOOM_MIN, ZOOM_MAX, ZOOM_FIT_MAX, ZOOM_LERP_SPEED, FOLLOW_LERP_SPEED,
  LOD_L1_MAX, LOD_L2_MAX,
  MINIMAP_REFRESH_MS,
  POD_REFRESH_MS,
} from './office-constants'


// ---------------------------------------------------------------------------
// OfficeScene
// ---------------------------------------------------------------------------

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

  private isDraggingAgent = false

  // Pod connecting lines and chat animations (extracted to OfficePods)
  private pods!: OfficePods

  // Office background — extracted to OfficeBackground
  private background!: OfficeBackground

  // Tooltip state (managed by showRichTooltip / hideTooltip)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tooltipFadeTween: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tooltipContainer: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tooltipGraphics: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hoverRingGraphics: any = null

  private cafe!: PennyCafe
  private githubBuilding!: GitHubBuilding
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

  // Camera & navigation state
  private targetZoom = 1
  private followTarget: { x: number; y: number } | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  /** Current LOD level: 1=overview, 2=room, 3=full detail. Initialized to 3 so first frame always applies the correct state. */
  private lastLodLevel = 3
  // Minimap subsystem (extracted to OfficeMinimap)
  private minimap!: OfficeMinimap
  // Room rendering subsystem (extracted to OfficeRooms)
  private roomRenderer!: OfficeRooms
  // Workstation lifecycle subsystem (extracted to OfficeWorkstations)
  private wsManager!: OfficeWorkstations
  private lastCamScrollX = 0
  private lastCamScrollY = 0
  private lastCamZoom = 1
  private lastHallwayPulseAt = 0
  private pendingCameraRecoveryUntil = 0

  private lastClockTick = 0

  // Screen-space UI overlays (toasts, tooltip, hover ring, help, debug, LOD label, status bar)
  private ui!: OfficeUI
  private lastDebugRefreshAt = 0
  private lastStatusBarUpdateAt = 0
  private lastStatusBarTimeUpdateAt = 0

  // Ambient office-life activity subsystem (paper airplanes, coffee refills, phone rings, etc.)
  private ambient!: OfficeAmbient

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
    this.load.spritesheet('characters', './sprites/characters.png', {
      frameWidth:  CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet('office', './sprites/office-tiles.png', {
      frameWidth:  OFFICE_TILE_SIZE,
      frameHeight: OFFICE_TILE_SIZE,
    })
    this.load.spritesheet('rooms', './sprites/room-tiles.png', {
      frameWidth:  ROOM_TILE_SIZE,
      frameHeight: ROOM_TILE_SIZE,
    })
    this.load.spritesheet('duder1', './sprites/duder-compact.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    this.load.spritesheet('duder2', './sprites/duder-compact-2.png', {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    })
    // Individual animation strips (_256 PNGs, 256×512 per frame — same as main spritesheet)
    // Walk: 3072×512 = 12 frames (step-A: 8 rotations + step-B: 4 rotations)
    // Idle: 1024×512 = 4 frames (4 rotations)
    // Sit:  1024×512 = 4 frames (4 rotations)
    const ANIM_FW = 256, ANIM_FH = 512
    this.load.spritesheet('anim-walk-1', './sprites/walk-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-walk-2', './sprites/walk-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-idle-1', './sprites/idle-1.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-idle-2', './sprites/idle-2.png', { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-sit-1',  './sprites/sit-1.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.spritesheet('anim-sit-2',  './sprites/sit-2.png',  { frameWidth: ANIM_FW, frameHeight: ANIM_FH })
    this.load.on('filecomplete-spritesheet-office', () => { this.officeTilesLoaded = true })
  }

  create(): void {
    this.cafe = new PennyCafe(this as unknown as CafeHostScene)
    this.githubBuilding = new GitHubBuilding(this as unknown as GitHubBuildingHostScene)

    const cam = this.cameras.main
    cam.setBackgroundColor(COLOR_BG)
    this.lastCamScrollX = cam.scrollX
    this.lastCamScrollY = cam.scrollY
    this.lastCamZoom = cam.zoom

    this.viewWidth  = this.scale.width
    this.viewHeight = this.scale.height

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
      drawDashedLine: (g, x1, y1, x2, y2, dl, gl) => this.drawDashedLine(g, x1, y1, x2, y2, dl, gl),
      refreshRoomHeaderText: (r) => { this.ensureRoomRenderer(); this.roomRenderer.refreshRoomHeaderText(r) },
      drawDoorPanel: (r, fw, ac) => { this.ensureRoomRenderer(); this.roomRenderer.drawDoorPanel(r, fw, ac) },
      getTeamInfo: (cwd) => getTeamInfo(cwd),
      rebuildNavMesh: () => this.rebuildNavMesh(),
      updateCameraBounds: () => this.updateCameraBounds(),
      setWorldSize: (w, h) => { this.worldWidth = w; this.worldHeight = h },
      markPodsDirty: () => { if (this.pods) this.pods.markDirty() },
      setCorridorData: (segs, active) => { if (this.particles) this.particles.setCorridorData(segs, active) },
      getAtmosphere: () => this.atmosphere,
      getCafe: () => this.cafe,
      getGithubBuilding: () => this.githubBuilding,
      getCafeFloorMask: () => this.cafeFloorMask,
      setCafeFloorMask: (g) => { this.cafeFloorMask = g },
    })
    this.background.init()

    // Pod connecting lines and chat animations
    this.pods = new OfficePods(this)
    this.pods.init()

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
      invalidateOfficeBgCache: () => { this.background.invalidateBgCache() },
      showToast: (msg, type) => { if (this.ui) this.ui.showToast(msg, type === 'warn' ? 'warning' : type) },
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
      if (this.selection.isFocused) {
        this.selection.exitFocusMode()
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

    // Resize — reposition overlays immediately (no zoom compensation needed for
    // setScrollFactor(0) objects — they use gameSize coordinates directly).
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.viewWidth  = gameSize.width
      this.viewHeight = gameSize.height

      if (this.minimap) { this.minimap.reposition(gameSize.width, gameSize.height); this.minimap.markDirty() }
      if (this.ui) { this.ui.setViewSize(gameSize.width, gameSize.height); this.ui.repositionStatusBar() }

      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null
        this.background.invalidateBgCache()
        this.layoutRooms()
        this.updateCameraBounds()
        if (this.rooms.size > 0) this.zoomToFit(true)
      }, 100)
    })

    // OfficeSelection: manages keyboard selection, selection ring, auto-pan, focus mode
    this.selection = new OfficeSelection(this)
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

      // Backtick — toggle debug overlay (dev only)
      this.input.keyboard.on('keydown-BACKTICK', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.ui.toggleDebugOverlay(this.navMesh, this.rooms, this.agents, this.cafe)
      })
    }

    // Create minimap overlay — temporarily disabled for debugging
    this.minimap = new OfficeMinimap(this, (worldX, worldY) => {
      this.followTarget = { x: worldX, y: worldY }
    })
    // this.minimap.init(this.viewWidth, this.viewHeight)
    // this.minimap.markDirty()

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

    // PA system broadcast — listen for cross-component broadcast events
    this.broadcastHandler = (msg: unknown) => this.showBroadcastEffect(String(msg))
    EventBus.on(EVENTS.BROADCAST, this.broadcastHandler)

    // Desk click recall — if agent is at cafe, cancel their coffee run so they walk back
    EventBus.on(EVENTS.AGENT_CLICKED, (agentId: string) => {
      if (this.cafe.isOnCoffeeRun(agentId)) {
        this.cafe.cancelCoffeeRun(agentId)
      }
    })

    this.isReady = true
    this.cafe.startCoffeeRunTimer()
    if (this.pendingAgents) {
      this.setAgents(this.pendingAgents)
      this.pendingAgents = null
    } else {
      // Build service buildings immediately even with no agents
      this.layoutRooms()
      this.updateCameraBounds()
    }
  }

  // ---------------------------------------------------------------------------
  // roomRenderer lazy initializer guard (fallback for timing edge cases)
  // ---------------------------------------------------------------------------

  private ensureRoomRenderer(): void {
    if (!this.roomRenderer) {
      this.roomRenderer = new OfficeRooms(this, {
        atmosphere: this.atmosphere,
        calcRoomSize: (n) => this.calcRoomSize(n),
        syncWorkstations: (room, agents) => this.syncWorkstations(room, agents),
        updateRoomActivity: (room) => this.updateRoomActivity(room),
        destroyWorkstation: (ws) => this.destroyWorkstation(ws),
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
        spawnAlertRipple: (x, y, c) => scene.particles.spawnAlertRipple(x, y, c),
        burstConfetti: (x, y) => scene.particles.burstConfetti(x, y),
        spawnSteamParticles: (ws) => scene.particles.spawnSteamParticles(ws),
        clearSteamParticles: (ws) => scene.particles.clearSteamParticles(ws),
        queueMinimapRoomFlash: (cwd, color, ms) => { if (scene.minimap) scene.minimap.queueFlash(cwd, color, ms) },
        getAgentCharacterIndex: (agent) => getAgentCharacterIndex(agent),
        getPoseFrame: (idx, agent) => getPoseFrame(idx, agent),
        getStatusColor: (agent) => getStatusColor(agent),
        getPodLines: () => scene.pods?.podLines ?? [],
        applyLodToWorkstation: (ws, level, fade) => scene.applyLodToWorkstation(ws, level, fade),
        getLastLodLevel: () => scene.lastLodLevel,
        enterFocusMode: (id) => scene.enterFocusMode(id),
        drawHoverRing: (x, y) => scene.drawHoverRing(x, y),
        clearHoverRing: () => scene.clearHoverRing(),
        showRichTooltip: (agent, sx, sy) => scene.showRichTooltip(agent, sx, sy),
        hideTooltip: () => scene.hideTooltip(),
        get officeTilesLoaded() { return scene.officeTilesLoaded },
        getRooms: () => scene.rooms,
        isCoffeeRunActive: (id) => scene.cafe.isOnCoffeeRun(id),
        cancelCoffeeRun: (id) => scene.cafe.cancelCoffeeRun(id),
      })
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
      this.background.applyLodToWhiteboard(lodLevel)
      this.ui.applyLod(lodLevel, this.rooms, null, [], [])
    }

    // GitHub building LOD + poll (always call — building may rebuild between LOD changes)
    this.githubBuilding.applyLod(cam.zoom)
    this.githubBuilding.tick(time)

    if (this.pods.podLines.length > 0 && (this.pods.isDirty() || this.pods.hasAnimatedPods()) && time - this.pods.getLastDrawAt() >= POD_REFRESH_MS) {
      this.pods.drawPodLines(time, this.rooms)
      this.pods.setLastDrawAt(time)
      this.pods.clearDirty()
    }
    if (this.background.getCorridorSegments().length > 0 && time - this.lastHallwayPulseAt >= 90) {
      this.background.drawHallwayIndicators(time)
      this.lastHallwayPulseAt = time
    }
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

    // Minimap refresh (throttled + dirty on camera/data movement)
    const cameraChanged =
      Math.abs(cam.scrollX - this.lastCamScrollX) > 0.5 ||
      Math.abs(cam.scrollY - this.lastCamScrollY) > 0.5 ||
      Math.abs(cam.zoom - this.lastCamZoom) > 0.001
    if (cameraChanged) {
      this.lastCamScrollX = cam.scrollX
      this.lastCamScrollY = cam.scrollY
      this.lastCamZoom = cam.zoom
      this.minimap.markDirty()
    }

    const minimapExtras: { label: string; bounds: { x: number; y: number; w: number; h: number }; color: number }[] = []
    const cafeBounds3 = this.cafe.getBounds()
    if (cafeBounds3) minimapExtras.push({ label: 'Cafe', bounds: cafeBounds3, color: 0xd97706 })
    const ghBounds2 = this.githubBuilding.getBounds()
    if (ghBounds2.w > 0) minimapExtras.push({ label: 'GitHub', bounds: ghBounds2, color: 0x7c3aed })
    this.minimap.tick(time, MINIMAP_REFRESH_MS, this.rooms, minimapExtras)

    // Debug overlay refresh (throttled to 250ms)
    if (this.ui.debugOverlayVisible && time - this.lastDebugRefreshAt >= 250) {
      this.ui.refreshDebugOverlay(time, _delta, this.rooms)
      this.lastDebugRefreshAt = time
    }

    if (this.particles.isRainActive()) this.particles.tickRain(this.viewWidth, this.viewHeight)
    if (this.particles.isSnowActive()) this.particles.tickSnow(time, this.viewWidth, this.viewHeight)
    try { this.atmosphere.tickWindowGlint(time) } catch { /* guard: stale window index after HMR */ }
    this.atmosphere.tick(time, this.particles.isRainActive(), this.particles.isSnowActive())
    this.atmosphere.tickCeilingLightActivity(time, this.rooms)
    if (this.atmosphere.wallClockContainer && time - this.lastClockTick >= 1000) {
      this.lastClockTick = time
      this.atmosphere.tickWallClock()
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

    this.layoutRooms()
    this.updateCameraBounds()
    this.minimap.markDirty()
    this.background.updateWhiteboardStats()

    // Keep live agents visible on each refresh.
    if (this.rooms.size > 0) {
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

  /** Update active pod workflows for connecting lines (Fix 11) */
  setPodWorkflows(workflows: PodLineInfo[]): void {
    if (!this.pods) return
    this.pods.setPodLines(workflows)
    this.pods.drawPodLines(this.time.now, this.rooms)
    this.pods.setLastDrawAt(this.time.now)
    this.pods.clearDirty()
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
  /** Delegate for CafeHostScene — cafe calls scene.spawnEmojiReaction() */
  public spawnEmojiReaction(worldX: number, worldY: number, emoji: string): void {
    this.particles.spawnEmojiReaction(worldX, worldY, emoji)
  }

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
      onUpdate: (tw) => { if (tw) cam?.setBackgroundColor(lerpColor(oldBg, newBg, (tw.getValue() ?? 0) / 100)) },
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
    this.ensureRoomRenderer()
    const t = activeTheme
    for (const room of this.rooms.values()) {
      this.roomRenderer.drawRoomBackground(room)
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
    {
      // Background is drawn by layoutRooms which has café bounds for L-shape
    }
    this.pods.markDirty()
    this.pods.drawPodLines(this.time.now, this.rooms)
    this.pods.setLastDrawAt(this.time.now)
    this.pods.clearDirty()
  }


  // ---------------------------------------------------------------------------
  // Workstation management — delegated to OfficeWorkstations
  // ---------------------------------------------------------------------------

  private syncWorkstations(room: Room, agents: AgentState[]): void {
    this.ensureWsManager()
    this.wsManager.syncWorkstations(room, agents, (r) => this.roomRenderer.triggerDoorAnimation(r))
  }

  private createWorkstation(room: Room, agent: AgentState): WorkstationSprite { this.ensureWsManager(); return this.wsManager.createWorkstation(room, agent) }

  private updateWorkstation(ws: WorkstationSprite, agent: AgentState): void { this.ensureWsManager(); this.wsManager.updateWorkstation(ws, agent) }

  private layoutWorkstations(room: Room): void { this.ensureWsManager(); this.wsManager.layoutWorkstations(room) }

  private destroyWorkstation(ws: WorkstationSprite): void { this.ensureWsManager(); this.wsManager.destroyWorkstation(ws) }

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
  private refreshTaskCountDisplay(ws: WorkstationSprite): void { this.ensureWsManager(); this.wsManager.refreshTaskCountDisplay(ws) }

  // ---------------------------------------------------------------------------
  // Room layout — delegated to OfficeBackground
  // ---------------------------------------------------------------------------

  private calcRoomSize(agentCount: number): { width: number; height: number } {
    return this.background.calcRoomSize(agentCount)
  }

  private layoutRooms(): void {
    this.background.layoutRooms()
  }

  private updateRoomActivity(room: Room): void {
    this.background.updateRoomActivity(room)
  }

  private rebuildNavMesh(): void {
    const rooms: Array<{ x: number; y: number; width: number; height: number; doorX: number; doorY: number }> = []
    for (const room of this.rooms.values()) {
      rooms.push({
        x: room.x, y: room.y,
        width: room.width, height: room.height,
        doorX: room.x,
        doorY: getRoomDoorY(room),
      })
    }

    // Build bounds from all room positions (per-team buildings, no single building rect)
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

    const cafeBounds = this.cafe.getBounds()
    const githubBuildingBounds = this.githubBuilding.getBounds()

    this.navMesh.rebuild({
      buildingBounds,
      rooms,
      corridorSegments: this.background.getCorridorSegments(),
      cafeBounds,
      githubBuildingBounds: githubBuildingBounds.w > 0 ? githubBuildingBounds : null,
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
    // Include building background extents (rooms only, no cafe)
    const hasRooms = this.rooms.size > 0
    const bgDims2 = this.background.getBgDimensions()
    let contentW = Math.max(maxX, hasRooms ? bgDims2.w + 30 : 0)
    let contentH = Math.max(maxY, hasRooms ? bgDims2.h + 30 : 0)
    // Include cafe (positioned outside the building)
    const cafeBounds = this.cafe.getBounds()
    if (cafeBounds) {
      contentW = Math.max(contentW, cafeBounds.x + cafeBounds.w + WORLD_MARGIN)
      contentH = Math.max(contentH, cafeBounds.y + cafeBounds.h + WORLD_MARGIN)
    }
    // Include GitHub building
    const ghBounds = this.githubBuilding.getBounds()
    if (ghBounds.w > 0) {
      contentW = Math.max(contentW, ghBounds.x + ghBounds.w + WORLD_MARGIN)
      contentH = Math.max(contentH, ghBounds.y + ghBounds.h + WORLD_MARGIN)
    }
    this.worldWidth = Math.max(contentW, this.viewWidth)
    this.worldHeight = Math.max(contentH, this.viewHeight)
    cam.setBounds(-WORLD_MARGIN, -WORLD_MARGIN, this.worldWidth + WORLD_MARGIN * 2, this.worldHeight + WORLD_MARGIN * 2)
  }

  // ---------------------------------------------------------------------------
  // Mood indicator / workstation state
  // ---------------------------------------------------------------------------

  private getAgentMood(agent: AgentState): { emoji: string; color: string } { this.ensureWsManager(); return this.wsManager.getAgentMood(agent) }

  private updateMood(ws: WorkstationSprite, agent: AgentState): void { this.ensureWsManager(); this.wsManager.updateMood(ws, agent) }

  // ---------------------------------------------------------------------------
  // Thought bubble — rich live-text with typing animation, auto-sizing, and fade
  // ---------------------------------------------------------------------------

  private drawThoughtBubbleBg(ws: WorkstationSprite, accentColor: number): void { this.ensureWsManager(); this.wsManager.drawThoughtBubbleBg(ws, accentColor) }

  private updateThoughtBubble(ws: WorkstationSprite, agent: AgentState, shouldShow: boolean, accentColor: number, isWorking: boolean): void { this.ensureWsManager(); this.wsManager.updateThoughtBubble(ws, agent, shouldShow, accentColor, isWorking) }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private updateAnimation(ws: WorkstationSprite, agent: AgentState): void { this.ensureWsManager(); this.wsManager.updateAnimation(ws, agent) }

  private updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void { this.ensureWsManager(); this.wsManager.updateBlockedIndicator(ws, agent) }

  private updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void { this.ensureWsManager(); this.wsManager.updateMonitorGlow(ws, isWorking, isWaiting) }

  private restoreDeskStroke(ws: WorkstationSprite): void { this.ensureWsManager(); this.wsManager.restoreDeskStroke(ws) }

  // ---------------------------------------------------------------------------
  // Notification toasts
  // ---------------------------------------------------------------------------

  private showToast(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.ui.showToast(text, type); return
  }


  // ---------------------------------------------------------------------------
  // Pod lines and chat animations: extracted to OfficePods module
  // ---------------------------------------------------------------------------

  // drawPodLines moved to OfficePods.drawPodLines()

  // isPodAnimatedStatus, getPodPulseSegments, drawPodPulse: moved to OfficePods

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
    if (!this.isReady) return
    this.pods.showAgentChat(fromAgentId, toAgentId, duration, this.rooms)
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
    void worldX; void worldY // moved to OfficeUI
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
    // Expand bounds to include the building rect (rooms only)
    const bgDims = this.background.getBgDimensions()
    if (bgDims.w > 0) {
      minX = Math.min(minX, 0)
      minY = Math.min(minY, 0)
      maxX = Math.max(maxX, bgDims.w + 30)
      maxY = Math.max(maxY, bgDims.h + 30)
    }
    // Don't include the cafe in zoom-to-fit — it's a peripheral area.
    // Including it forces the camera to zoom out too far to fit the wide content.
    // The cafe is reachable by panning and visible on the minimap.
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


  // ---------------------------------------------------------------------------
  // LOD system — applyLodToWorkstation is used by OfficeWorkstations host
  // ---------------------------------------------------------------------------

  // Multi-level LOD system (3 levels):
  //   Level 1 (overview, zoom < LOD_L1_MAX):  rooms show as colored rects only — internals hidden
  //   Level 2 (room, LOD_L1_MAX..LOD_L2_MAX): agents + desks visible, micro-accessories hidden
  //   Level 3 (detail, zoom > LOD_L2_MAX):    full detail including accessories, monitor content


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




  // ---------------------------------------------------------------------------
  // Focus mode — delegates to OfficeSelection
  // ---------------------------------------------------------------------------

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
    this._destroyBroadcastBanner()
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

    // GitHub building cleanup
    this.githubBuilding.destroy()

    // Minimap cleanup
    this.minimap.destroy()

    // atmosphere.destroy() already handled ceiling lights, exterior lights,
    // wall clock, window glint, starfield, clouds, day/night overlay

    // Background subsystem cleanup (decoTweens, officeDecoSprites, whiteboard,
    // teamAreaLabels, corridorGraphics, floorArrowGfx, officeGraphics, flagContainer)
    this.background.destroy()

    this.ambient.destroy()
    this.pods.destroy()

    // UI subsystem cleanup (helpOverlay, debugOverlay, tooltips, hover ring, notifications)
    this.ui.destroy()

    if (this.roomRenderer) {
      for (const room of this.rooms.values()) {
        this.roomRenderer.destroyRoom(room)
      }
    }
    this.rooms.clear()
  }
}
