/**
 * OfficeSelection — keyboard selection, selection ring, auto-pan, and focus mode.
 *
 * Extracted from OfficeScene.ts. All methods are pure extractions with no logic changes.
 * OfficeScene delegates to this class for all selection/navigation behaviour.
 */

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import { activeTheme, lerpColor } from './office-theme'
import type { Room, WorkstationSprite } from './office-types'
import { KB_AUTO_PAN_INTERVAL, ZOOM_MAX } from './office-constants'
import { SPRITESHEET_KEYS, ICON_FRAMES, EFFECT_ANIM_KEYS } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Host-scene interface — the contract OfficeSelection requires from OfficeScene
// ---------------------------------------------------------------------------

export interface SelectionHostScene {
  /** Phaser scene object (for tweens, time, add helpers) */
  readonly scene: Phaser.Scene

  /** All rooms indexed by cwd key */
  readonly rooms: Map<string, Room>

  /** Current lerp target zoom — written by selection methods */
  targetZoom: number

  /** Current lerp follow target — written by selection methods */
  followTarget: { x: number; y: number } | null

  /** Saved default camera X scroll for R-reset */
  readonly defaultCameraX: number

  /** Saved default camera Y scroll for R-reset */
  readonly defaultCameraY: number

  /** Saved default camera zoom for R-reset */
  readonly defaultCameraZoom: number

  /** Current viewport width */
  readonly viewWidth: number

  /** Current viewport height */
  readonly viewHeight: number

  /** Minimum zoom the scene allows */
  getMinZoom(): number

  /** Smooth animated (or instant) zoom-to-fit-all-rooms */
  zoomToFit(animated: boolean): void
}

// ---------------------------------------------------------------------------
// OfficeSelection
// ---------------------------------------------------------------------------

export class OfficeSelection {
  private host: SelectionHostScene

  // Phaser scene shorthand — host IS a Phaser.Scene (OfficeScene extends Scene)
  private get scene(): Phaser.Scene { return this.host as unknown as Phaser.Scene }

  // -------------------------------------------------------------------------
  // Keyboard selection state
  // -------------------------------------------------------------------------

  selectedAgentIndex = -1
  selectionRing: Phaser.GameObjects.Graphics | null = null
  selectionRingOuter: Phaser.GameObjects.Graphics | null = null
  private selectionRingTween: Phaser.Tweens.Tween | null = null
  private selectionRingRotateTween: Phaser.Tweens.Tween | null = null
  private selectionRingBreatheTween: Phaser.Tweens.Tween | null = null
  private selectionRingPosTween: Phaser.Tweens.Tween | null = null
  private selectionRingCurrentPos: { x: number; y: number } | null = null

  // Star sprite pointer at top of selection ring
  private selectionStarSprite: Phaser.GameObjects.Sprite | null = null
  private selectionStarTween: Phaser.Tweens.Tween | null = null

  // -------------------------------------------------------------------------
  // Input lock state
  // -------------------------------------------------------------------------

  private _inputLocked = false

  /** Lock all keyboard-driven input (e.g. during a transition or modal). Emits INPUT_LOCKED. */
  lockInput(): void {
    this._inputLocked = true
    EventBus.emit(EVENTS.INPUT_LOCKED)
  }

  /** Re-enable keyboard-driven input. Emits INPUT_UNLOCKED. */
  unlockInput(): void {
    this._inputLocked = false
    EventBus.emit(EVENTS.INPUT_UNLOCKED)
  }

  // -------------------------------------------------------------------------
  // Auto-pan state
  // -------------------------------------------------------------------------

  private autoPanEnabled = false
  private autoPanTimer: Phaser.Time.TimerEvent | null = null
  private autoPanIndex = 0

  // -------------------------------------------------------------------------
  // Focus mode state
  // -------------------------------------------------------------------------

  private focusedAgentId: string | null = null
  private focusDimOverlay: Phaser.GameObjects.Graphics | null = null
  private focusDimTween: Phaser.Tweens.Tween | null = null
  private focusedWorkstationPrevDepth: number | null = null

  // Focus mode indicator sprite (play icon near focused agent)
  private focusIndicatorSprite: Phaser.GameObjects.Sprite | null = null
  private focusIndicatorTween: Phaser.Tweens.Tween | null = null

  // -------------------------------------------------------------------------

  constructor(host: SelectionHostScene) {
    this.host = host
  }

  /**
   * Create the Graphics objects for the selection ring. Must be called after the
   * Phaser scene `create()` phase so that `scene.add` is available.
   */
  initGraphics(): void {
    // Inner ring: solid, theme-coloured (higher depth so it renders above outer)
    this.selectionRing = this.scene.add.graphics().setDepth(9999)
    // Outer ring: dashed appearance via arc segments, slowly rotates
    this.selectionRingOuter = this.scene.add.graphics().setDepth(9998)

    // Star pointer sprite at top of selection ring — hidden until first selection
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) {
      this.selectionStarSprite = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_YELLOW)
        .setScale(0.15)
        .setOrigin(0.5, 1)
        .setDepth(10000)
        .setVisible(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Workstation position helper
  // ---------------------------------------------------------------------------

  private getWorkstationWorldPos(agentId: string): { x: number; y: number } | null {
    for (const room of this.host.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        return { x: room.x + ws.container.x, y: room.y + ws.container.y }
      }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Flat agent list
  // ---------------------------------------------------------------------------

  /** Get a flat, deterministic list of all agent IDs in room->workstation order */
  getFlatAgentIds(): string[] {
    const ids: string[] = []
    for (const room of this.host.rooms.values()) {
      for (const id of room.workstations.keys()) {
        ids.push(id)
      }
    }
    return ids
  }

  // ---------------------------------------------------------------------------
  // Selection API
  // ---------------------------------------------------------------------------

  /** Cycle selection forward (+1) or backward (-1) through agents */
  cycleSelectedAgent(dir: 1 | -1): void {
    if (this._inputLocked) return
    const ids = this.getFlatAgentIds()
    if (ids.length === 0) return

    // Capture previous agent position for puff VFX
    const prevIndex = this.selectedAgentIndex
    const prevId = prevIndex >= 0 && prevIndex < ids.length ? ids[prevIndex] : null
    const prevPos = prevId ? this.getWorkstationWorldPos(prevId) : null

    if (this.selectedAgentIndex < 0 || this.selectedAgentIndex >= ids.length) {
      this.selectedAgentIndex = dir === 1 ? 0 : ids.length - 1
    } else {
      this.selectedAgentIndex = (this.selectedAgentIndex + dir + ids.length) % ids.length
    }
    this.applySelection(ids)

    // Spawn a small puff VFX at the previous agent's position on cycle
    if (prevPos && this.scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) {
      const puff = this.scene.add.sprite(prevPos.x, prevPos.y, SPRITESHEET_KEYS.EFFECTS_PUFF)
        .setScale(0.25)
        .setAlpha(0.5)
        .setDepth(9997)
      puff.play(EFFECT_ANIM_KEYS.PUFF)
      puff.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        puff.destroy()
      })
    }
  }

  /** Jump directly to agent at index (0-based) */
  selectAgentByIndex(index: number): void {
    const ids = this.getFlatAgentIds()
    if (index < 0 || index >= ids.length) return
    this.selectedAgentIndex = index
    this.applySelection(ids)
  }

  /** Apply the current selectedAgentIndex: draw ring + pan camera */
  applySelection(ids?: string[]): void {
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
  confirmSelectedAgent(): void {
    if (this._inputLocked) return
    const ids = this.getFlatAgentIds()
    if (this.selectedAgentIndex < 0 || this.selectedAgentIndex >= ids.length) return
    const agentId = ids[this.selectedAgentIndex]

    for (const room of this.host.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws?.state) {
        EventBus.emit(EVENTS.AGENT_CLICKED, agentId, ws.state)
        return
      }
    }
  }

  /** Clear selection state */
  deselectAgent(): void {
    if (this._inputLocked) return
    this.selectedAgentIndex = -1
    this.clearSelectionRing()
    EventBus.emit(EVENTS.AGENT_DESELECTED)
  }

  // ---------------------------------------------------------------------------
  // Selection ring rendering
  // ---------------------------------------------------------------------------

  /** Draw a glowing animated targeting ring at world coordinates */
  drawSelectionRing(wx: number, wy: number): void {
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
      this.selectionRingPosTween = this.scene.tweens.add({
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
    this.selectionRingTween = this.scene.tweens.add({
      targets: innerG,
      alpha: 0.5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Slow rotation on outer dashed ring
    this.selectionRingRotateTween = this.scene.tweens.add({
      targets: outerG,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
    })

    // Breathing scale pulse on both rings together
    this.selectionRingBreatheTween = this.scene.tweens.add({
      targets: [innerG, outerG],
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // --- Position the star pointer sprite at the top of the outer ring ---
    if (this.selectionStarSprite) {
      // Kill previous star tween
      if (this.selectionStarTween) { this.selectionStarTween.destroy(); this.selectionStarTween = null }

      this.selectionStarSprite.setVisible(true).setAlpha(0.85)
      // Position at ring top: outer ring radius is 46, star origin is (0.5, 1) so
      // bottom-center sits at the ring peak
      this.selectionStarSprite.setPosition(wx, wy - outerRadius)

      // Gentle bob animation on the star
      this.selectionStarTween = this.scene.tweens.add({
        targets: this.selectionStarSprite,
        y: wy - outerRadius - 4,
        alpha: 0.55,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  /** Remove the selection ring and stop all its animations */
  clearSelectionRing(): void {
    if (this.selectionRingPosTween) { this.selectionRingPosTween.destroy(); this.selectionRingPosTween = null }
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    if (this.selectionRingRotateTween) { this.selectionRingRotateTween.destroy(); this.selectionRingRotateTween = null }
    if (this.selectionRingBreatheTween) { this.selectionRingBreatheTween.destroy(); this.selectionRingBreatheTween = null }
    this.selectionRingCurrentPos = null
    this.selectionRing?.clear()
    this.selectionRing?.setVisible(false)
    this.selectionRingOuter?.clear()
    this.selectionRingOuter?.setVisible(false)

    // Hide the star pointer
    if (this.selectionStarTween) { this.selectionStarTween.destroy(); this.selectionStarTween = null }
    this.selectionStarSprite?.setVisible(false)
  }

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------

  /** Smoothly pan the camera to center on world coords (uses lerp follow) */
  kbPanCameraTo(wx: number, wy: number): void {
    this.host.followTarget = { x: wx, y: wy }
  }

  /** Smoothly adjust zoom level (syncs with lerp-based targetZoom) */
  kbSmoothZoom(delta: number): void {
    this.host.targetZoom = Phaser.Math.Clamp(
      this.host.targetZoom + delta,
      this.host.getMinZoom(),
      ZOOM_MAX,
    )
    this.host.followTarget = null
  }

  /** Zoom camera to fit all rooms (delegates to smooth zoomToFit) */
  zoomToFitAll(): void {
    if (this._inputLocked) return
    this.host.zoomToFit(true)
  }

  /** Reset camera to the default position/zoom (uses lerp system) */
  resetCamera(): void {
    if (this._inputLocked) return
    this.host.targetZoom = this.host.defaultCameraZoom
    this.host.followTarget = {
      x: this.host.defaultCameraX + this.host.viewWidth / (2 * this.host.defaultCameraZoom),
      y: this.host.defaultCameraY + this.host.viewHeight / (2 * this.host.defaultCameraZoom),
    }
    this.deselectAgent()
    this.stopAutoPan()
  }

  // ---------------------------------------------------------------------------
  // Auto-pan
  // ---------------------------------------------------------------------------

  /** Toggle slow auto-pan that cycles the camera across all agents */
  toggleAutoPan(): void {
    if (this._inputLocked) return
    if (this.autoPanEnabled) {
      this.stopAutoPan()
    } else {
      this.startAutoPan()
    }
  }

  startAutoPan(): void {
    const ids = this.getFlatAgentIds()
    if (ids.length === 0) return

    this.autoPanEnabled = true
    this.autoPanIndex = this.selectedAgentIndex >= 0 ? this.selectedAgentIndex : 0

    // Immediately show first agent
    this.selectedAgentIndex = this.autoPanIndex
    this.applySelection(ids)

    this.autoPanTimer = this.scene.time.addEvent({
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

  stopAutoPan(): void {
    this.autoPanEnabled = false
    if (this.autoPanTimer) {
      this.autoPanTimer.destroy()
      this.autoPanTimer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Focus mode
  // ---------------------------------------------------------------------------

  enterFocusMode(agentId: string): void {
    if (this.focusedAgentId === agentId) return
    if (this.focusedAgentId !== null) this.exitFocusMode()
    this.focusedAgentId = agentId

    let targetWs: WorkstationSprite | null = null
    let worldPos: { x: number; y: number } | null = null
    for (const room of this.host.rooms.values()) {
      const ws = room.workstations.get(agentId)
      if (ws) {
        targetWs = ws
        worldPos = { x: room.x + ws.container.x, y: room.y + ws.container.y }
        break
      }
    }
    if (!targetWs || !worldPos) { this.focusedAgentId = null; return }

    this.focusedWorkstationPrevDepth = targetWs.container.depth
    targetWs.container.setDepth(100)

    const overlay = this.scene.add.graphics()
    overlay.fillStyle(0x000000, 1)
    overlay.fillRect(-4000, -4000, 8000, 8000)
    overlay.setAlpha(0).setDepth(50)
    this.focusDimOverlay = overlay

    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }
    this.focusDimTween = this.scene.tweens.add({
      targets: overlay,
      alpha: 0.4,
      duration: 300,
      ease: 'Quad.easeOut',
    })

    this.host.targetZoom = 1.8
    this.host.followTarget = { x: worldPos.x, y: worldPos.y }

    // Show a play icon indicator to the left of the focused agent
    this.destroyFocusIndicator()
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) {
      const indicator = this.scene.add.sprite(
        worldPos.x - 50, worldPos.y,
        SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.PLAY_DARK,
      )
        .setScale(0.20)
        .setAlpha(0)
        .setDepth(101)
        .setTint(0x3b82f6)
      this.focusIndicatorSprite = indicator

      // Fade in and pulse
      this.focusIndicatorTween = this.scene.tweens.add({
        targets: indicator,
        alpha: { from: 0, to: 0.7 },
        x: worldPos.x - 46,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // Gentle horizontal bob once visible
          this.focusIndicatorTween = this.scene.tweens.add({
            targets: indicator,
            x: worldPos.x - 42,
            alpha: 0.45,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          })
        },
      })
    }
  }

  exitFocusMode(): void {
    if (this.focusedAgentId === null) return

    for (const room of this.host.rooms.values()) {
      const ws = room.workstations.get(this.focusedAgentId)
      if (ws) { ws.container.setDepth(this.focusedWorkstationPrevDepth ?? 0); break }
    }

    this.focusedWorkstationPrevDepth = null
    this.focusedAgentId = null

    const overlay = this.focusDimOverlay
    this.focusDimOverlay = null
    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }

    if (overlay) {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 250,
        ease: 'Quad.easeIn',
        onComplete: () => { try { overlay.destroy() } catch { /* gone */ } },
      })
    }

    // Remove focus indicator sprite
    this.destroyFocusIndicator()

    this.host.zoomToFit(true)
  }

  /** Tear down the focus indicator sprite and its tween */
  private destroyFocusIndicator(): void {
    if (this.focusIndicatorTween) { this.focusIndicatorTween.destroy(); this.focusIndicatorTween = null }
    if (this.focusIndicatorSprite) { this.focusIndicatorSprite.destroy(); this.focusIndicatorSprite = null }
  }

  /** Returns true if a focus session is currently active */
  get isFocused(): boolean {
    return this.focusedAgentId !== null
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    // Stop auto-pan timer
    this.stopAutoPan()

    // Destroy all selection ring tweens and graphics
    if (this.selectionRingPosTween) { this.selectionRingPosTween.destroy(); this.selectionRingPosTween = null }
    if (this.selectionRingTween) { this.selectionRingTween.destroy(); this.selectionRingTween = null }
    if (this.selectionRingRotateTween) { this.selectionRingRotateTween.destroy(); this.selectionRingRotateTween = null }
    if (this.selectionRingBreatheTween) { this.selectionRingBreatheTween.destroy(); this.selectionRingBreatheTween = null }
    this.selectionRingCurrentPos = null
    this.selectionRing?.destroy()
    this.selectionRing = null
    this.selectionRingOuter?.destroy()
    this.selectionRingOuter = null

    // Star pointer cleanup
    if (this.selectionStarTween) { this.selectionStarTween.destroy(); this.selectionStarTween = null }
    if (this.selectionStarSprite) { this.selectionStarSprite.destroy(); this.selectionStarSprite = null }

    // Focus mode cleanup
    if (this.focusDimTween) { this.focusDimTween.destroy(); this.focusDimTween = null }
    if (this.focusDimOverlay) { this.focusDimOverlay.destroy(); this.focusDimOverlay = null }
    this.destroyFocusIndicator()
    this.focusedAgentId = null
    this.focusedWorkstationPrevDepth = null
  }
}
