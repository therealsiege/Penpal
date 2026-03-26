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
import { OfficeSelection } from './office-selection'
import { OfficeRooms } from './office-rooms'
import { OfficeWorkstations } from './office-workstation'
import { OfficeBackground } from './office-background'
import { OfficeBroadcast } from './office-broadcast'
import { OfficeCamera } from './office-camera'
import type { WorkstationSprite, Room, PodLineInfo, OfficeDebugSnapshot } from './office-types'
import {
  getPoseFrame, getRoomDoorY, getStatusColor,
  hashToken, getAgentCharacterIndex, getTeamInfo, getTeamColor,
  cwdToLabel, formatLabel,
} from './office-helpers'

import { SPRITESHEET_KEYS, ANIM_KEYS, SCENE_KEYS } from './office-asset-keys'
import { RoomVisibilityManager } from './room-visibility'
import { soundEngine } from './sound-engine'
import { achievements } from './achievements'
import { CelebrationManager } from './celebrations'
import { AgentMoodManager } from './agent-mood'
import { InteractivePropsManager } from './interactive-props'

import {
  KB_ZOOM_STEP,
  CHAR_FRAME_W, CHAR_FRAME_H,
  OFFICE_TILE_SIZE, ROOM_TILE_SIZE,
  WORKSTATION_W, WORKSTATION_H, WS_DESK_Y,
  COLOR_BG, ZOOM_MAX,
  LOD_L1_MAX, LOD_L2_MAX,
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

  // Game systems
  private celebrations!: CelebrationManager
  private moodManager!: AgentMoodManager
  private propsManager!: InteractivePropsManager
  private lastMoodUpdateAt = 0


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
  }

  create(): void {
    this.cafe = new PennyCafe(this as unknown as CafeHostScene)

    const cam = this.cameras.main
    cam.setBackgroundColor(COLOR_BG)

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

      if (this.ui) { this.ui.setViewSize(gameSize.width, gameSize.height) }

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
    this.agentClickedHandler = (agentId: string) => {
      if (this.cafe.isOnCoffeeRun(agentId)) {
        this.cafe.cancelCoffeeRun(agentId)
      }
    }
    EventBus.on(EVENTS.AGENT_CLICKED, this.agentClickedHandler)

    // Game systems — celebrations, mood, achievements, sound, props
    this.celebrations = new CelebrationManager(this)
    this.moodManager = new AgentMoodManager(this)
    this.propsManager = new InteractivePropsManager(this)
    soundEngine.wireEvents()
    achievements.load()

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
        spawnAlertRipple: (x, y, c) => scene.particles.spawnAlertRipple(x, y, c),
        burstConfetti: (x, y) => scene.particles.burstConfetti(x, y),
        spawnSteamParticles: (ws) => scene.particles.spawnSteamParticles(ws),
        clearSteamParticles: (ws) => scene.particles.clearSteamParticles(ws),
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

    this.background.layoutRooms()
    this.officeCamera.updateCameraBounds()
    this.background.updateWhiteboardStats()

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
  }


  // ---------------------------------------------------------------------------
  // Room layout — delegated to OfficeBackground
  // ---------------------------------------------------------------------------

  /** Expose NavMesh for CoffeRunHostScene and other consumers. */
  getNavMesh(): NavMesh { return this.navMesh }

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

    this.navMesh.rebuild({
      buildingBounds,
      rooms,
      corridorSegments: this.background.getCorridorSegments(),
      cafeBounds,
    })

    // Block desk footprints so agents walk around furniture
    const DESK_BLOCK_W = 64
    const DESK_BLOCK_H = 21
    for (const room of this.rooms.values()) {
      for (const ws of room.workstations.values()) {
        const deskWorldX = room.x + ws.container.x - DESK_BLOCK_W / 2
        const deskWorldY = room.y + ws.container.y + WS_DESK_Y - DESK_BLOCK_H / 2
        this.navMesh.blockRect(deskWorldX, deskWorldY, DESK_BLOCK_W, DESK_BLOCK_H)
      }
    }
  }


  // ---------------------------------------------------------------------------
  // Notification toasts
  // ---------------------------------------------------------------------------

  private showToast(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.ui.showToast(text, type)
    // Also push to UIScene via EventBus so the parallel overlay scene receives it.
    // UIScene uses 'warn' where OfficeUI uses 'warning'; map here at the source.
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
