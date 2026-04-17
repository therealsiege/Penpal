import Phaser from 'phaser'
import { EventBus, EVENTS, type SeasonCeremonyRankingRow, type SeasonEndedEventPayload, type SeasonStartedEventPayload } from './events'
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
import { LabEditor } from './lab-editor'
import { OfficeBroadcast } from './office-broadcast'
import { OfficeCamera, panDurationFromDistance, getWorkstationWorldPos } from './office-camera'
import { AnimConfig } from './animation-config'
import type { WorkstationSprite, Room, PodLineInfo, OfficeDebugSnapshot, OrchestratorTaskOfficeInfo } from './office-types'
import {
  getPoseFrame, getRoomDoorY, getStatusColor,
  hashToken, getAgentCharacterIndex, getTeamInfo, getTeamColor,
  cwdToLabel, formatLabel,
} from './office-helpers'

import { SPRITESHEET_KEYS, SCENE_KEYS } from './office-asset-keys'
import { computeLabLayout, type SpritePlacement } from './lab-layout-engine'
import { detectRoomType } from './office-layout'
import {
  labRoomFloorWorldRect,
  collectFacilityDeskPositionsWorld,
  hashFacilityLabProps,
} from './lab-facility-geometry'
import { LAB_DECORATION_PIPELINE_ID, LAB_STRATEGIC_LAYOUT_LINKS, LAB_STRATEGIC_LAYOUT_VERSION } from './lab-decoration'
import { RoomVisibilityManager } from './room-visibility'
import { soundEngine } from './sound-engine'
import { achievements } from './achievements'
import { CelebrationManager, themeIconFrameForTheme, type CameraJuiceHint } from './celebrations'
import { AgentMoodManager } from './agent-mood'
import { InteractivePropsManager } from './interactive-props'
import { SeasonHUD } from './season-hud'
import { QuestPanel } from './quest-panel'
import { AchievementPanel } from './achievement-panel'
import { NpcDialogPanel } from './npc-dialog'
import { questSystem } from './quest-system'
import { creditManager } from './credits'
import { leaderboardManager } from './leaderboard'
import { seasonManager } from './seasons'

import {
  KB_ZOOM_STEP,
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

  private officeTilesLoaded = true  // BootScene preloads all assets before OfficeScene starts

  private isDraggingAgent = false

  // Pod connecting lines and chat animations (extracted to OfficePods)
  private pods!: OfficePods
  // MCP server connection lines (workstation → tool icon clusters)
  private mcp!: OfficeMcp

  // Office background — extracted to OfficeBackground
  private background!: OfficeBackground
  // Lab layout editor — toggle with E key
  private labEditor!: LabEditor


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
  private _cameraJuiceLockDepth = 0
  private _workstationRefitTimer: ReturnType<typeof setTimeout> | null = null
  private _lastWorkstationCount = -1
  private _defaultCamScrollX = 0
  private _defaultCamScrollY = 0
  private _defaultCamZoom = 1
  /** Current LOD level: 1=overview, 2=room, 3=full detail. Initialized to 3 so first frame always applies the correct state. */
  private lastLodLevel = 3
  /** World-space lab strategic props + glow (one pass for the whole facility row). */
  private labFacilityPropsLayer: Phaser.GameObjects.Container | null = null
  /** Matches WorkspaceUnifiedFloor.drawFloor bbox — snap per-room strategic hex to these cell centers. */
  private labHexSlabRect: { x: number; y: number; width: number; height: number } | null = null
  // Room rendering subsystem (extracted to OfficeRooms)
  private roomRenderer!: OfficeRooms
  // Workstation lifecycle subsystem (extracted to OfficeWorkstations)
  private wsManager!: OfficeWorkstations
  private lastHallwayPulseAt = 0

  // Room-based object culling — managed by RoomVisibilityManager
  private _roomVisibility = new RoomVisibilityManager()
  private lastRoomCheckAt = 0

  // Sleep / wake lifecycle
  private _isSleeping = false
  private _navMeshDirtyWhileSleeping = false
  private _roomCountAtSleep = 0

  // Performance auto-reducer
  private _perfFrameCount = 0
  private _perfLastCheckAt = 0
  private _perfReducedMode = false

  // Game systems
  private celebrations!: CelebrationManager
  private moodManager!: AgentMoodManager
  private propsManager!: InteractivePropsManager
  private seasonHud!: SeasonHUD
  private questPanel!: QuestPanel
  private achievementPanel!: AchievementPanel
  private npcDialog!: NpcDialogPanel
  private lastQuestPanelUpdateAt = 0
  private lastAchievementPanelUpdateAt = 0
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
  private agentClickedHandler: ((...args: unknown[]) => void) | null = null
  private _deskClickedHandler: ((...args: unknown[]) => void) | null = null

  constructor() {
    super({ key: SCENE_KEYS.OFFICE })
  }

  // ---------------------------------------------------------------------------
  // Public getters — used by test-harness and external tooling
  // ---------------------------------------------------------------------------

  get celebrationsManager() { return this.celebrations }
  get atmosphereManager() { return this.atmosphere }
  get roomMap() { return this.rooms }

  get targetZoom() { return this.officeCamera.targetZoom }
  set targetZoom(z: number) { this.officeCamera.targetZoom = z }
  get followTarget() { return this.officeCamera.followTarget }
  set followTarget(t: { x: number; y: number } | null) { this.officeCamera.followTarget = t }
  get defaultCameraX() { return this._defaultCamScrollX }
  get defaultCameraY() { return this._defaultCamScrollY }
  get defaultCameraZoom() { return this._defaultCamZoom }

  getMinZoom(): number {
    return this.officeCamera.getMinZoom()
  }

  zoomToFit(animated: boolean, opts?: { slow?: boolean }): void {
    this.officeCamera.zoomToFit(animated, opts)
    this._scheduleDefaultCameraSnapshot(animated, opts)
  }

  private _snapshotDefaultCamera(): void {
    const c = this.cameras.main
    this._defaultCamScrollX = c.scrollX
    this._defaultCamScrollY = c.scrollY
    this._defaultCamZoom = c.zoom
  }

  private _scheduleDefaultCameraSnapshot(animated: boolean, opts?: { slow?: boolean }): void {
    if (!animated) {
      this._snapshotDefaultCamera()
      return
    }
    if (opts?.slow) {
      this.time.delayedCall(AnimConfig.camera.fitSlowDurationMs + 50, () => this._snapshotDefaultCamera())
    } else {
      this.time.delayedCall(750, () => this._snapshotDefaultCamera())
    }
  }

  getCameraWorldCenter(): { x: number; y: number } {
    const c = this.cameras.main
    return {
      x: c.scrollX + c.width / (2 * c.zoom),
      y: c.scrollY + c.height / (2 * c.zoom),
    }
  }

  smoothNavigateCameraTo(wx: number, wy: number): void {
    const ctr = this.getCameraWorldCenter()
    const dist = Phaser.Math.Distance.Between(ctr.x, ctr.y, wx, wy)
    if (dist >= AnimConfig.camera.crossRoomPanMinWorldDist) {
      const dur = panDurationFromDistance(dist)
      this.officeCamera.smoothPanTo(wx, wy, dur)
    } else {
      this.officeCamera.followTarget = { x: wx, y: wy }
    }
  }

  prepareFocusCamera(wx: number, wy: number): void {
    const ctr = this.getCameraWorldCenter()
    const dist = Phaser.Math.Distance.Between(ctr.x, ctr.y, wx, wy)
    const dur = panDurationFromDistance(dist)
    this.officeCamera.smoothPanTo(wx, wy, dur)
  }

  private lockCameraJuiceInput(): void {
    this._cameraJuiceLockDepth++
  }

  private unlockCameraJuiceInput(): void {
    this._cameraJuiceLockDepth = Math.max(0, this._cameraJuiceLockDepth - 1)
  }

  private onCameraJuice(hint: CameraJuiceHint): void {
    if (hint === 'rankUp') this.officeCamera.pulseZoom('rankUp')
    else if (hint === 'taskComplete') this.officeCamera.pulseZoom('taskComplete')
    else this.officeCamera.pulseZoom('errorZoomOut')
  }

  private readonly _agentArrivedCamera = (...args: unknown[]) => {
    const id = args[0] as string
    if (id) this.officeCamera.panToAgent(id, this.rooms, { scripted: true })
  }

  private readonly _agentDepartedCamera = (..._args: unknown[]) => {
    this.officeCamera.pulseZoom('agentLeave')
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  preload(): void {
    // Assets loaded by BootScene — Phaser TextureManager is global
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
      softLockCameraInput: () => this.lockCameraJuiceInput(),
      softUnlockCameraInput: () => this.unlockCameraJuiceInput(),
      getGdsSceneBounds: () => this.background?.hasGdsScene() ? this.background.getGdsSceneBounds() : null,
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
      rebuildLabFacilityProps: () => this.rebuildLabFacilityProps(),
      setLabHexSlabRect: (r) => { this.labHexSlabRect = r },
      relayoutAllWorkstations: () => {
        this.ensureWsManager()
        for (const room of this.rooms.values()) {
          this.wsManager.layoutWorkstations(room)
        }
      },
    })
    this.background.init()

    // Lab editor — toggle with E key for interactive prop placement
    this.labEditor = new LabEditor(this)

    // Pod connecting lines and chat animations
    this.pods = new OfficePods(this)
    this.pods.init()

    // MCP server connection lines
    this.mcp = new OfficeMcp(this)
    this.mcp.init()

    // Ground plane — semi-transparent so the HTML background image bleeds through.
    // Keep a touch lighter than full-opacity so lab hex + props stay readable at overview zoom.
    this.add.rectangle(0, 0, 16000, 16000, COLOR_BG, 0.78)
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
      if (this._cameraJuiceLockDepth > 0) return
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
        if (this._cameraJuiceLockDepth > 0) return
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
      if (this._cameraJuiceLockDepth > 0) {
        lastSceneClickTime = now
        return
      }
      if (now - lastSceneClickTime < 350) {
        const wp = cam.getWorldPoint(p.x, p.y)
        if (!this.getAgentAtWorldPoint(wp.x, wp.y)) {
          // GDS mode: double-click empty space → back to world map
          if (this.background.hasGdsScene()) {
            EventBus.emit(EVENTS.NAVIGATE_CAMPUS)
            this.scene.sleep(SCENE_KEYS.OFFICE)
          } else {
            this.zoomToFit(true)
          }
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
      if (this.questPanel) { this.questPanel.setViewSize(gameSize.width, gameSize.height) }
      if (this.achievementPanel) { this.achievementPanel.setViewSize(gameSize.width, gameSize.height) }
      if (this.npcDialog) { this.npcDialog.setViewSize(gameSize.width, gameSize.height) }

      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null
        // Fixed grid layout — don't relayout rooms on window resize.
        // Just update camera bounds and re-fit.
        this.officeCamera.updateCameraBounds()
        if (this.rooms.size > 0) this.zoomToFit(true)
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
        // Modal surfaces can opt out of office hotkeys.
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

      // ESC document order: npc dialog → ops board → achievements → help → focus → deselect
      this.input.keyboard.on('keydown-ESC', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.npcDialog?.isVisible()) { this.npcDialog.hide(); return }
        if (this.ui.opsVisible) { this.ui.hideOpsBoardOverlay(); return }
        if (this.achievementPanel?.isVisible) { this.achievementPanel.hide(); return }
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

      // Q — toggle quest log panel
      this.input.keyboard.on('keydown-Q', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.questPanel.toggleQuestLog()
      })

      // A — toggle achievements panel
      this.input.keyboard.on('keydown-A', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        this.achievementPanel.toggle()
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

      // O — toggle ops / capabilities board
      this.input.keyboard.on('keydown-O', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        e.preventDefault()
        if (this.ui.opsVisible) {
          this.ui.hideOpsBoardOverlay()
        } else {
          this.ui.showOpsBoardOverlay(this._capRows)
        }
      })

      // E — interact with selected agent (show NPC dialog). LabEditor also listens
      // to E but only activates its own mode; we emit AGENT_INTERACT here only when
      // an agent is selected and the lab editor is not active.
      this.input.keyboard.on('keydown-E', (e: KeyboardEvent) => {
        if (shouldIgnoreKeyboardShortcuts(e)) return
        if (this.labEditor.isActive) return
        // If dialog already open, close it
        if (this.npcDialog.isVisible()) { this.npcDialog.hide(); return }
        // Find the currently selected agent
        this._emitInteractForSelectedAgent()
      })
    }

    // Vignette — subtle edge framing only (strong strength + tight radius read as “too dark” on wide labs)
    this.vignetteFx = this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.22)

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

    // Desk click recall — if agent is at cafe, cancel their coffee run so they walk back.
    // Also smooth-pan camera to the clicked agent's workstation.
    this.agentClickedHandler = ((...args: unknown[]) => {
      const agentId = args[0] as string
      if (this.cafe.isOnCoffeeRun(agentId)) {
        this.cafe.cancelCoffeeRun(agentId)
      }
      this.navigateCameraToAgent(agentId)
    })
    EventBus.on(EVENTS.AGENT_CLICKED, this.agentClickedHandler)

    // Desk / room-header click — smooth-pan to the clicked world position.
    this._deskClickedHandler = ((...args: unknown[]) => {
      const [, wx, wy] = args as [string, number, number]
      if (typeof wx === 'number' && typeof wy === 'number') {
        this.smoothNavigateCameraTo(wx, wy)
      }
    })
    EventBus.on(EVENTS.DESK_CLICKED, this._deskClickedHandler)

    EventBus.on(EVENTS.AGENT_ARRIVED, this._agentArrivedCamera)
    EventBus.on(EVENTS.AGENT_DEPARTED, this._agentDepartedCamera)

    // Game systems — celebrations, mood, achievements, sound, props, season HUD
    this.celebrations = new CelebrationManager(this, { onCameraJuice: (h: CameraJuiceHint) => this.onCameraJuice(h) })

    // VFX + animal pet animations registered globally by BootScene

    this.moodManager = new AgentMoodManager(this)
    this.propsManager = new InteractivePropsManager(this)
    this.seasonHud = new SeasonHUD(this)
    this.seasonHud.init(this.viewWidth, this.viewHeight)
    this.questPanel = new QuestPanel(this)
    this.questPanel.init(this.viewWidth, this.viewHeight)
    this.achievementPanel = new AchievementPanel(this)
    this.achievementPanel.init(this.viewWidth, this.viewHeight)
    this.npcDialog = new NpcDialogPanel(this)
    this.npcDialog.init(this.viewWidth, this.viewHeight)

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

    EventBus.on(EVENTS.SEASON_ENDED, (...args: unknown[]) => {
      const payload = args[0] as SeasonEndedEventPayload
      const awaiting = seasonManager.isAwaitingSeasonRollover()
      this.selection.lockInput()

      const snap = leaderboardManager.getRankingsSnapshot(12)
      const mvp = leaderboardManager.getSeasonMVP()
      const mvpPos = this._workstationWorldPosForAgent(mvp?.agentId ?? null)

      let creditBonusShown = 0
      if (awaiting) {
        for (const e of snap) {
          if (e.tasksCompleted > 0) creditBonusShown += Math.floor(2 * e.tasksCompleted)
        }
        if (creditBonusShown > 0) creditManager.earn(creditBonusShown)

        const topBadges = ['season_badge_gold', 'season_badge_silver', 'season_badge_bronze'] as const
        snap.slice(0, 3).forEach((e, i) => {
          creditManager.grantSeasonRewardItem(e.agentId, topBadges[i])
        })
        if (mvp) creditManager.grantSeasonRewardItem(mvp.agentId, 'name_gold')
      }

      const rankings: SeasonCeremonyRankingRow[] = snap.map(e => ({
        rank: e.rank,
        agentId: e.agentId,
        agentName: e.agentName,
        seasonXP: e.seasonXP,
        tasksCompleted: e.tasksCompleted,
      }))

      const ceremonyPayload = {
        ...payload,
        rankings,
        mvpAgentId: mvp?.agentId ?? null,
        mvpWorldX: mvpPos.x,
        mvpWorldY: mvpPos.y,
        creditBonusShown,
      }

      const afterVisual = (didRollover: boolean) => {
        this.ensureWsManager()
        if (didRollover) this.wsManager.playSeasonRefreshPulseAll()
        this.seasonHud.refreshForSeasonChange()
        this.selection.unlockInput()
      }

      this.celebrations.seasonEndCeremony(ceremonyPayload, {
        onComplete: () => {
          if (awaiting) {
            leaderboardManager.resetSeason()
            seasonManager.finishSeasonRollover()
          }
          const introSeason = awaiting ? seasonManager.getCurrentSeason() : null
          if (introSeason) {
            this.celebrations.seasonStartIntro({
              seasonName: introSeason.name,
              theme: introSeason.theme,
              accentColor: introSeason.accentColor,
              themeIconFrame: themeIconFrameForTheme(introSeason.theme),
              challenges: introSeason.challenges.map(ch => ({
                description: ch.description,
                completed: ch.completed,
              })),
            }, {
              onComplete: () => afterVisual(awaiting),
            })
          } else {
            afterVisual(awaiting)
          }
        },
      })
    })

    EventBus.on(EVENTS.SEASON_STARTED, (...args: unknown[]) => {
      const payload = args[0] as SeasonStartedEventPayload
      if (payload.skipIntroCelebration) {
        this.seasonHud.refreshForSeasonChange()
        return
      }
      this.celebrations.seasonStartIntro({
        seasonName: payload.seasonName,
        theme: payload.theme,
        accentColor: payload.accentColor,
        themeIconFrame: themeIconFrameForTheme(payload.theme),
        challenges: payload.challenges.map(c => ({ ...c })),
      }, {
        onComplete: () => {
          this.ensureWsManager()
          this.wsManager.playSeasonRefreshPulseAll()
          this.seasonHud.refreshForSeasonChange()
        },
      })
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
          this.celebrations.questCelebration(
            wx, wy,
            difficulty as 'trivial' | 'normal' | 'hard' | 'epic' | 'legendary',
            xpReward, creditReward,
            { agentId },
          )
          soundEngine.levelUp()
          if (difficulty === 'epic' || difficulty === 'legendary') {
            this.officeCamera.focusAgentBriefly(agentId, this.rooms)
          }
          // Star-fly to quest panel if visible
          if (this.questPanel.isVisible) {
            const panelPos = this.questPanel.getPanelScreenPosition()
            this.celebrations.starFlyToPanel(
              wx, wy,
              difficulty as 'trivial' | 'normal' | 'hard' | 'epic' | 'legendary',
              panelPos.x, panelPos.y,
            )
          }
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
          this.celebrations.error(wx, wy, { agentId })
          break
        }
      }
    })

    // Launch UIScene as a parallel overlay — owns all screen-space HUD elements
    this.scene.launch(SCENE_KEYS.UI_SCENE)

    // Navigate back to campus when NAVIGATE_BUILDING requests it
    EventBus.on(EVENTS.NAVIGATE_BUILDING, (building: string) => {
      if (building === 'campus') {
        this.scene.sleep(SCENE_KEYS.OFFICE)
        EventBus.emit(EVENTS.NAVIGATE_CAMPUS)
      }
    })

    this.isReady = true

    // Scene sleep/wake lifecycle hooks — pause all subsystem timers/tweens when
    // this scene is put to sleep (e.g., switching to another scene) and resume
    // them on wake, re-syncing wall-clock-driven visuals.
    this.events.on(Phaser.Scenes.Events.SLEEP, this._onSleep, this)
    this.events.on(Phaser.Scenes.Events.WAKE, this._onWake, this)

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

    // Test harness — dynamic import for tree-shaking in production
    import('./test-harness').then(m => m.mountHarness(this)).catch(() => {})
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
        usesFacilityLabStrategicProps: () => this.textures.exists(SPRITESHEET_KEYS.LAB_PROPS),
        hasGdsScene: () => this.textures.exists(SPRITESHEET_KEYS.GDS_MEDIUM),
      })
    }
  }

  /** Expose the workstation subsystem for test harness access (scene.wsAnimator). */
  get wsAnimator(): OfficeWorkstations { return this.wsManager }

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
        usesFacilityLabStrategicProps: () => scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS),
        getOrAssignGdsDeskSlot: (agentId: string) => {
          if (!scene.background.hasGdsScene()) return null
          return scene.background.assignGdsDeskSlot(agentId)
        },
        getGdsScale: () => scene.background.hasGdsScene() ? scene.background.getGdsScale() : 1,
      })
    }
  }

  private applyLabFacilityPropsLod(lodLevel: number): void {
    if (!this.labFacilityPropsLayer) return
    this.labFacilityPropsLayer.setVisible(lodLevel >= 2)
  }

  /**
   * Rebuilds world-space lab props with one layout pass per lab room (merged into one layer).
   * Per-room `placeLabEquipment` skips strategic placement when LAB_PROPS is loaded.
   */
  private rebuildLabFacilityProps(): void {
    // Cleanup old layer — tilemap.decorateRooms() now handles all room props
    if (this.labFacilityPropsLayer) {
      this.labFacilityPropsLayer.destroy(true)
      this.labFacilityPropsLayer = null
    }
    return  // Props now rendered by lab-tilemap.ts decorateRooms()

    const roomList = [...this.rooms.values()]
    if (roomList.length === 0) return

    // One layout pass per lab room: strategic anchors use floor fractions, so a single union
    // bbox stacks the whole reference kit into one coordinate space and causes corridor overlap.
    const propPlacements: SpritePlacement[] = []
    const sortedRooms = [...roomList].sort(
      (a, b) => labRoomFloorWorldRect(a).x - labRoomFloorWorldRect(b).x,
    )
    // One hash for the whole facility so JSON layout (stasis, etc.) does not vary per room cwd.
    const facilityHash = hashFacilityLabProps(sortedRooms)
    for (let i = 0; i < sortedRooms.length; i++) {
      const room = sortedRooms[i]!
      const floorRect = labRoomFloorWorldRect(room)
      const desks = collectFacilityDeskPositionsWorld([room])
      const hash = facilityHash
      const strategicWing: 'west' | 'east' =
        sortedRooms.length >= 2 && i === sortedRooms.length - 1 ? 'east' : 'west'
      const slice = computeLabLayout(
        floorRect.x, floorRect.y, floorRect.width, floorRect.height,
        hash, desks, undefined,
        {
          floorClipRects: [floorRect],
          strategicWing,
          hexSlabWorldRect: this.labHexSlabRect ?? undefined,
          roomType: detectRoomType(room.cwd),
        },
      )
      propPlacements.push(...slice.propPlacements)
    }

    // Above room floor / heat (-2…0.5) but workstations use depth ≈ cy+room.y (hundreds),
    // so props still sort under desks — avoids fighting interior floor tiles.
    const layer = this.add.container(0, 0).setDepth(1.2)
    const OLD_CELL = 64
    for (const p of propPlacements) {
      const spr = this.add.sprite(p.x, p.y, SPRITESHEET_KEYS.LAB_PROPS, p.frame)
      const fw = spr.width || OLD_CELL
      spr.setScale((p.scale * OLD_CELL) / fw)
        .setAlpha(p.alpha)
        .setDepth(p.depth)
      if (p.angle != null) spr.setAngle(p.angle)
      if (p.tint) spr.setTint(p.tint)
      layer.add(spr)
    }
    // No merged glow discs — they read as extra floor noise next to hex + hazard trim.
    this.labFacilityPropsLayer = layer
    this.applyLabFacilityPropsLod(this.lastLodLevel)
  }

  /** DevTools / PH: see `lab-decoration.ts` — JSON version, pipeline id, facility layer vs per-room pass. */
  getLabDecorationDebugInfo(): Record<string, unknown> {
    const layer = this.labFacilityPropsLayer
    const list = layer?.list ?? []
    const labProps = this.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)
    return {
      pipelineId: LAB_DECORATION_PIPELINE_ID,
      strategicLayoutJsonVersion: LAB_STRATEGIC_LAYOUT_VERSION,
      strategicLayoutLinks: LAB_STRATEGIC_LAYOUT_LINKS,
      labPropsTextureLoaded: labProps,
      facilityLayerChildCount: list.length,
      facilityLayerVisible: layer?.visible ?? false,
      roomCount: this.rooms.size,
      perRoomStrategicPropsSkipped: labProps,
      hint:
        'When labPropsTextureLoaded, placeLabEquipment passes strategicMode none — JSON props exist only on labFacilityPropsLayer.',
    }
  }

  private _workstationWorldPosForAgent(agentId: string | null): { x: number; y: number } {
    const cam = this.cameras.main
    const cx = cam.scrollX + cam.width / 2
    const cy = cam.scrollY + cam.height * 0.55
    if (!agentId) return { x: cx, y: cy }
    const p = getWorkstationWorldPos(agentId, this.rooms)
    return p ?? { x: cx, y: cy }
  }

  // ---------------------------------------------------------------------------
  // Update loop (smooth zoom, follow, LOD, minimap)
  // ---------------------------------------------------------------------------

  update(time: number, _delta: number): void {
    // Belt-and-suspenders: Phaser stops calling update() on sleeping scenes,
    // but guard against manual invocations.
    if (this._isSleeping) return

    const cam = this.cameras.main

    // Camera smooth zoom + follow + recovery
    this.officeCamera.updateZoomAndFollow(time)

    // Zoom-dependent multi-level LOD
    const lodLevel = cam.zoom < LOD_L1_MAX ? 1 : cam.zoom <= LOD_L2_MAX ? 2 : 3
    if (lodLevel !== this.lastLodLevel) {
      this.lastLodLevel = lodLevel
      this.background.applyLodToWhiteboard(lodLevel)
      // Apply LOD to lab tile sprites in each room
      if (this.roomRenderer) {
        for (const room of this.rooms.values()) {
          this.roomRenderer.applyLodToRoomTiles(room, lodLevel)
        }
      }
      this.applyLabFacilityPropsLod(lodLevel)
      this.ui.applyLod(lodLevel, this.rooms, null, [], [])
      if (lodLevel < 2) {
        this.pods.clearPodLineVisuals()
        this.pods.clearRivalryVisuals()
      } else {
        this.pods.markDirty()
      }
    }

    // Pod lines, MCP lines, rivalry lines — skip entirely in GDS mode (sessions only)
    if (!this.background.hasGdsScene()) {
      if (
        lodLevel >= 2 &&
        this.pods.podLines.length > 0 &&
        (this.pods.isDirty() || this.pods.hasAnimatedPods()) &&
        time - this.pods.getLastDrawAt() >= POD_REFRESH_MS
      ) {
        this.pods.drawPodLines(time, this.rooms)
        this.pods.setLastDrawAt(time)
        this.pods.clearDirty()
      }
      if (lodLevel >= 2 && (this.mcp.isDirty() || this.mcp.hasActiveConnections(this.rooms)) && time - this.mcp.getLastDrawAt() >= MCP_REFRESH_MS) {
        this.mcp.drawMcpLines(time, this.rooms)
        this.mcp.setLastDrawAt(time)
        this.mcp.clearDirty()
      }
      if (lodLevel < 2 && this.mcp) this.mcp.setVisible(false)
      else if (lodLevel >= 2 && this.mcp) this.mcp.setVisible(true)
      if (lodLevel >= 2 && this.pods.hasRivalries() && time - this.pods.getLastRivalryDrawAt() >= 2500) {
        this.pods.drawRivalryLines(time, this.rooms)
      }
    } else {
      // GDS mode: hide all overlay lines
      if (this.mcp) this.mcp.setVisible(false)
      this.pods.setVisible(false)
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

    // Lab editor grid refresh
    if (this.labEditor) this.labEditor.update()

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

    // Quest panel — update every 3s
    if (this.achievementPanel && time - this.lastAchievementPanelUpdateAt >= 4000) {
      this.lastAchievementPanelUpdateAt = time
      this.achievementPanel.update()
    }

    if (this.questPanel && time - this.lastQuestPanelUpdateAt >= 3000) {
      this.lastQuestPanelUpdateAt = time
      this.questPanel.update()
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

    // If the scene is sleeping and room count changed, mark nav mesh dirty for
    // deferred rebuild on wake — skip the expensive layout/camera work.
    if (this._isSleeping && this.rooms.size !== this._roomCountAtSleep) {
      this._navMeshDirtyWhileSleeping = true
      return
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
      this.zoomToFit(false)
      this.officeCamera.pendingCameraRecoveryUntil = this.time.now + 1500
    }

    let wsCount = 0
    for (const room of this.rooms.values()) wsCount += room.workstations.size
    if (this.officeCamera.hasInitialFit) {
      if (this._lastWorkstationCount < 0) {
        this._lastWorkstationCount = wsCount
      } else if (Math.abs(wsCount - this._lastWorkstationCount) >= AnimConfig.camera.workstationRefitThreshold) {
        if (this._workstationRefitTimer) clearTimeout(this._workstationRefitTimer)
        this._workstationRefitTimer = setTimeout(() => {
          this._workstationRefitTimer = null
          let c = 0
          for (const r of this.rooms.values()) c += r.workstations.size
          this._lastWorkstationCount = c
          this.officeCamera.followTarget = null
          this.zoomToFit(true, { slow: true })
        }, AnimConfig.camera.workstationRefitDebounceMs)
      } else {
        this._lastWorkstationCount = wsCount
      }
    }

    // Push live counts to CampusScene
    EventBus.emit(EVENTS.CAMPUS_COUNTS_UPDATED, allAgents.length, this.pods?.podLines?.length ?? 0)
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
    if (this.background.hasGdsScene()) {
      this.pods.setVisible(false)
    } else if (this.lastLodLevel >= 2) {
      this.pods.drawPodLines(this.time.now, this.rooms)
      this.pods.setLastDrawAt(this.time.now)
      this.pods.clearDirty()
    } else {
      this.pods.clearPodLineVisuals()
      this.pods.markDirty()
    }
    // Push updated pod count to CampusScene
    EventBus.emit(EVENTS.CAMPUS_COUNTS_UPDATED, this.agents.length, workflows.length)
  }

  /** Capabilities / ops board rows — pushed from CommandCenter polling */
  private _capRows: { id: string; title: string; status: string }[] = []

  setCapabilitiesBoard(rows: { id: string; title: string; status: string }[]): void {
    this._capRows = rows
    if (this.ui && this.ui.opsVisible) {
      // Refresh live
      this.ui.showOpsBoardOverlay(rows)
    }
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

  /** Pan toward an agent with cross-room smooth pan when needed (Command Center / React). */
  navigateCameraToAgent(agentId: string): void {
    const pos = getWorkstationWorldPos(agentId, this.rooms)
    if (!pos) return
    this.smoothNavigateCameraTo(pos.x, pos.y)
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
    if (!this.background.hasGdsScene() && this.lastLodLevel >= 2) {
      this.pods.drawPodLines(this.time.now, this.rooms)
      this.pods.setLastDrawAt(this.time.now)
      this.pods.clearDirty()
    } else {
      this.pods.clearPodLineVisuals()
    }
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

    // In GDS mode, disable pathfinding — agents stay at their desks
    this.navMesh.disabled = this.background.hasGdsScene()

    this.navMesh.rebuild({
      buildingBounds,
      corridorSegments: this.background.getCorridorSegments(),
      cafeBounds: this.cafe.getBounds(),
    })
  }


  // ---------------------------------------------------------------------------
  // NPC dialog interaction
  // ---------------------------------------------------------------------------

  /** Emit AGENT_INTERACT for the currently keyboard-selected agent (E key handler). */
  private _emitInteractForSelectedAgent(): void {
    const ids = this.selection.getFlatAgentIds()
    const idx = this.selection.selectedAgentIndex
    if (idx < 0 || idx >= ids.length) return
    const agentId = ids[idx]
    for (const room of this.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws?.state) {
        EventBus.emit(EVENTS.AGENT_INTERACT, agentId, ws.state)
        return
      }
    }
  }

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
  // Sleep / Wake lifecycle
  // ---------------------------------------------------------------------------

  private _onSleep(): void {
    this._isSleeping = true
    this._roomCountAtSleep = this.rooms.size
    this.atmosphere?.pause()
    this.particles?.pause()
    this.cafe?.pause()
    this.ambient?.pause()
    if (this.wsManager) this.wsManager.pauseAll()
    if (this.bgTransitionTween) this.bgTransitionTween.pause()
  }

  private _onWake(): void {
    this._isSleeping = false
    this.atmosphere?.resume()   // re-syncs day/night to wall clock
    this.particles?.resume()
    this.cafe?.resume()
    this.ambient?.resume()
    if (this.wsManager) this.wsManager.resumeAll()
    if (this.bgTransitionTween) this.bgTransitionTween.resume()

    // If rooms changed while sleeping, rebuild the nav mesh now
    if (this._navMeshDirtyWhileSleeping) {
      this.background.layoutRooms()
      this._navMeshDirtyWhileSleeping = false
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.events.off(Phaser.Scenes.Events.SLEEP, this._onSleep, this)
    this.events.off(Phaser.Scenes.Events.WAKE, this._onWake, this)
    if (this.resizeTimer) { clearTimeout(this.resizeTimer); this.resizeTimer = null }
    if (this._workstationRefitTimer) { clearTimeout(this._workstationRefitTimer); this._workstationRefitTimer = null }

    // PA system broadcast banner cleanup
    this.broadcast.destroy()
    EventBus.off(EVENTS.AGENT_ARRIVED, this._agentArrivedCamera)
    EventBus.off(EVENTS.AGENT_DEPARTED, this._agentDepartedCamera)
    if (this.agentClickedHandler) {
      EventBus.off(EVENTS.AGENT_CLICKED, this.agentClickedHandler)
      this.agentClickedHandler = null
    }
    if (this._deskClickedHandler) {
      EventBus.off(EVENTS.DESK_CLICKED, this._deskClickedHandler)
      this._deskClickedHandler = null
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
    this.questPanel.destroy()
    this.achievementPanel.destroy()
    this.npcDialog.destroy()

    if (this.roomRenderer) {
      for (const room of this.rooms.values()) {
        this.roomRenderer.destroyRoom(room)
      }
    }
    this.rooms.clear()
  }
}
