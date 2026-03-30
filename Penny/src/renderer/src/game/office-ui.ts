import Phaser from 'phaser'
import type { AgentState } from '../types'
import type { WorkstationSprite, Room } from './office-types'
import { NavMesh } from './nav-mesh'
import type { PennyCafe } from './penny-cafe'
import { WS_DESK_Y } from './office-constants'
import { activeTheme } from './office-theme'
import { SPRITESHEET_KEYS, TOAST_ICON_FRAMES, ICON_FRAMES, ITEM_FRAMES, PET_COUNT, IMAGE_KEYS } from './office-asset-keys'
import { SIGNATURE_ITEM_NAMES } from './workstation-creation'

// ---------------------------------------------------------------------------
// OfficeUI — owns all screen-space UI state for OfficeScene
// ---------------------------------------------------------------------------

export class OfficeUI {
  private scene: Phaser.Scene

  // Viewport dimensions — kept in sync via setViewSize()
  private viewWidth  = 800
  private viewHeight = 600

  // Notification toasts (screen-space)
  private toastContainer: Phaser.GameObjects.Container | null = null
  private activeToasts: { container: Phaser.GameObjects.Container; createdAt: number }[] = []
  private recentToasts: Map<string, number> = new Map()

  // Rich hover tooltip (screen-space, animated)
  private tooltipContainer: Phaser.GameObjects.Container | null = null
  private tooltipGraphics: Phaser.GameObjects.Graphics | null = null
  private tooltipFadeTween: Phaser.Tweens.Tween | null = null

  // World-space highlight ring around hovered desk
  private hoverRingGraphics: Phaser.GameObjects.Graphics | null = null
  private hoverRingAccent: Phaser.GameObjects.Sprite | null = null

  // Keyboard shortcut help overlay
  private helpOverlay: Phaser.GameObjects.Container | null = null
  helpVisible = false

  // Debug overlay (backtick toggle)
  debugOverlayVisible = false
  private debugOverlayContainer: Phaser.GameObjects.Container | null = null
  private debugFpsText: Phaser.GameObjects.Text | null = null
  private debugObjectCountText: Phaser.GameObjects.Text | null = null
  private debugNavMeshGfx: Phaser.GameObjects.Graphics | null = null
  private debugPathGfx: Phaser.GameObjects.Graphics | null = null

  // LOD label (screen-space, shown briefly on LOD level changes)
  private lodLabelContainer: Phaser.GameObjects.Container | null = null
  private lodLabelFadeTween: Phaser.Tweens.Tween | null = null

  // Status bar (screen-space, bottom of viewport)
  private statusBarContainer: Phaser.GameObjects.Container | null = null
  private statusBarBg: Phaser.GameObjects.Rectangle | null = null
  private statusBarAgentText: Phaser.GameObjects.Text | null = null
  private statusBarActiveText: Phaser.GameObjects.Text | null = null
  private statusBarRoomText: Phaser.GameObjects.Text | null = null
  private statusBarTimeText: Phaser.GameObjects.Text | null = null
  private statusBarSep: Phaser.GameObjects.Rectangle | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  init(viewWidth: number, viewHeight: number): void {
    this.viewWidth  = viewWidth
    this.viewHeight = viewHeight

    // Notification toast container (screen-space, top-right)
    this.toastContainer = this.scene.add.container(0, 0).setDepth(9998).setScrollFactor(0)

    // Status bar disabled — info is in the React header bar
  }

  /** Call whenever the viewport is resized */
  setViewSize(w: number, h: number): void {
    this.viewWidth  = w
    this.viewHeight = h
  }

  destroy(): void {
    if (this.helpOverlay) {
      this.scene.tweens.killTweensOf(this.helpOverlay)
      this.helpOverlay.destroy()
      this.helpOverlay = null
    }
    this.helpVisible = false

    if (this.debugOverlayContainer) { this.debugOverlayContainer.destroy(); this.debugOverlayContainer = null }
    if (this.debugNavMeshGfx)       { this.debugNavMeshGfx.destroy(); this.debugNavMeshGfx = null }
    if (this.debugPathGfx)          { this.debugPathGfx.destroy(); this.debugPathGfx = null }

    if (this.lodLabelFadeTween) { this.lodLabelFadeTween.destroy(); this.lodLabelFadeTween = null }
    if (this.lodLabelContainer) { this.lodLabelContainer.destroy(); this.lodLabelContainer = null }

    if (this.tooltipFadeTween) { this.tooltipFadeTween.destroy(); this.tooltipFadeTween = null }
    if (this.tooltipContainer) { this.tooltipContainer.destroy(); this.tooltipContainer = null }
    if (this.tooltipGraphics)  { this.tooltipGraphics.destroy(); this.tooltipGraphics = null }

    if (this.hoverRingGraphics) { this.hoverRingGraphics.destroy(); this.hoverRingGraphics = null }
    if (this.hoverRingAccent) { this.hoverRingAccent.destroy(); this.hoverRingAccent = null }

    if (this.toastContainer) { this.toastContainer.destroy(); this.toastContainer = null }
    this.activeToasts = []

    if (this.statusBarContainer) { this.statusBarContainer.destroy(); this.statusBarContainer = null }
  }

  // ---------------------------------------------------------------------------
  // Notification toasts
  // ---------------------------------------------------------------------------

  showToast(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.toastContainer) return

    // De-duplicate: drop identical messages shown within the last 2 seconds
    const now = Date.now()
    const lastShown = this.recentToasts.get(text)
    if (lastShown !== undefined && now - lastShown < 2000) return
    // Purge stale entries to prevent unbounded growth
    for (const [key, ts] of this.recentToasts) {
      if (now - ts >= 2000) this.recentToasts.delete(key)
    }
    this.recentToasts.set(text, now)

    const TOAST_W = 220
    const TOAST_H = 28
    const TOAST_MARGIN = 8
    const MAX_TOASTS = 3
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
      this.scene.tweens.add({
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
    const bg = this.scene.add.graphics()
    bg.fillStyle(bgColor, 0.92)
    bg.fillRoundedRect(0, 0, TOAST_W, TOAST_H, 6)

    // Type-indicator icon — sprite from game-icons sheet, vertically centred
    const iconFrame = TOAST_ICON_FRAMES[type] ?? ICON_FRAMES.CIRCLE_BLUE
    const dot = this.scene.add.sprite(16, TOAST_H / 2, SPRITESHEET_KEYS.GAME_ICONS, iconFrame)
      .setScale(0.3).setOrigin(0.5)

    // Label — offset right to clear the dot
    const label = this.scene.add.text(26, 6, text, {
      fontSize: '11px', fontFamily: 'monospace', color: activeTheme.headerText,
      wordWrap: { width: TOAST_W - 34 },
    })

    // Start off-screen to the right; slide in on entry
    const toast = this.scene.add.container(startX + SLIDE_OFFSET, startY, [bg, dot, label])
    toast.setAlpha(0).setScrollFactor(0).setDepth(9998)
    this.toastContainer!.add(toast)

    const entry = { container: toast, createdAt: Date.now() }
    this.activeToasts.push(entry)

    // Countdown progress bar at the bottom of the toast
    const bar = this.scene.add.rectangle(0, TOAST_H - 1, TOAST_W, 1.5, iconColor, 0.4)
      .setOrigin(0, 0.5)
    toast.add(bar)
    this.scene.tweens.add({
      targets: bar,
      width: 0,
      duration: 3500,
      ease: 'Linear',
    })

    // Slide in from right with a slight overshoot bounce
    this.scene.tweens.add({
      targets: toast,
      x: startX,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })

    // Icon entrance pulse after slide-in completes
    this.scene.tweens.add({
      targets: dot,
      scaleX: 0.42,
      scaleY: 0.42,
      duration: 150,
      yoyo: true,
      delay: 300,
      ease: 'Back.easeOut',
    })

    // Auto-dismiss: slide back out to the right and fade
    this.scene.time.delayedCall(3500, () => {
      this.scene.tweens.add({
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
      this.scene.tweens.add({
        targets: t.container,
        y: 16 + i * (TOAST_H + TOAST_MARGIN),
        duration: 200,
        ease: 'Back.easeOut',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Rich hover tooltip + hover ring
  // ---------------------------------------------------------------------------

  showRichTooltip(agent: AgentState, screenX: number, screenY: number): void {
    if (this.tooltipFadeTween) { this.tooltipFadeTween.destroy(); this.tooltipFadeTween = null }
    if (this.tooltipContainer) { this.tooltipContainer.destroy(); this.tooltipContainer = null }
    if (this.tooltipGraphics)  { this.tooltipGraphics.destroy();  this.tooltipGraphics  = null }
    const name   = agent.config.name  ?? 'Agent'
    const title  = agent.config.title ?? ''
    const role   = agent.config.podRole ? agent.config.podRole.toUpperCase() : ''
    const uptime = agent.uptime ?? ''
    const resources = [agent.cpu ? `CPU ${agent.cpu}` : '', agent.memoryMB ? `${Math.round(agent.memoryMB)}MB` : ''].filter(Boolean).join('  ')
    let statusLabel = 'idle', statusHex = '#5a6a7a'
    if (agent.needsInteraction) { statusLabel = agent.interactionType === 'tool-approval' ? 'needs approval' : agent.interactionType === 'question' ? 'question' : agent.interactionType === 'accept-edits' ? 'accept edits' : 'waiting'; statusHex = '#fbbf24' }
    else if (agent.sessionMode === 'working') { statusLabel = 'working'; statusHex = '#34d399' }
    else if (agent.sessionMode === 'plan') { statusLabel = 'planning'; statusHex = '#a78bfa' }
    else if (agent.sessionMode === 'compressing') { statusLabel = 'compressing'; statusHex = '#60a5fa' }
    const raw = (agent.lastAssistantBlurb ?? agent.lastUserMessage ?? '').trim()
    const blurb = raw.length > 110 ? raw.slice(0, 108) + '..' : raw
    const bs = agent.config.persona?.backstory ?? ''
    const sub = blurb || (bs.length > 80 ? bs.slice(0, 78) + '..' : bs)
    // Compute signature item trait from agent name hash
    let sigTrait = ''
    {
      let nh = 0
      const aName = agent.config.name ?? ''
      for (let i = 0; i < aName.length; i++) { nh = ((nh << 5) - nh) + aName.charCodeAt(i); nh |= 0 }
      nh = Math.abs(nh)
      const sigItems = [
        ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.BOOK, ITEM_FRAMES.HEADPHONES,
        ITEM_FRAMES.PIZZA, ITEM_FRAMES.PAINT_PALETTE, ITEM_FRAMES.WRENCH,
        ITEM_FRAMES.BEER, ITEM_FRAMES.CAMERA, ITEM_FRAMES.DONUT,
        ITEM_FRAMES.FIRST_AID, ITEM_FRAMES.PHONE, ITEM_FRAMES.MONITOR,
      ]
      const sigFrame = sigItems[nh % sigItems.length]
      sigTrait = SIGNATURE_ITEM_NAMES[sigFrame] ?? ''
    }
    const hasTrait = sigTrait.length > 0
    // Compute pet frame and sig item frame for tooltip preview sprites
    let tooltipPetFrame = -1
    let tooltipSigFrame = -1
    {
      let nh2 = 0
      const aName2 = agent.config.name ?? ''
      for (let i = 0; i < aName2.length; i++) { nh2 = ((nh2 << 5) - nh2) + aName2.charCodeAt(i); nh2 |= 0 }
      nh2 = Math.abs(nh2)
      tooltipPetFrame = nh2 % PET_COUNT
      const sigItems2 = [
        ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.BOOK, ITEM_FRAMES.HEADPHONES,
        ITEM_FRAMES.PIZZA, ITEM_FRAMES.PAINT_PALETTE, ITEM_FRAMES.WRENCH,
        ITEM_FRAMES.BEER, ITEM_FRAMES.CAMERA, ITEM_FRAMES.DONUT,
        ITEM_FRAMES.FIRST_AID, ITEM_FRAMES.PHONE, ITEM_FRAMES.MONITOR,
      ]
      tooltipSigFrame = sigItems2[nh2 % sigItems2.length]
    }
    const hasPetPreview = this.scene.textures.exists(SPRITESHEET_KEYS.DESK_PETS) && this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)
    const TW = 220, PX = 10, PY = 8, LH = 16, AH = 7
    const hasR = resources.length > 0, hasS = sub.length > 0
    const subL = hasS ? Math.max(1, Math.ceil(sub.length / 26)) : 0
    const tH = PY + LH + (title ? LH : 0) + 4 + LH + (hasR ? LH : 0) + (hasTrait ? LH : 0) + (hasPetPreview ? LH + 2 : 0) + (hasS ? 6 + subL * LH : 0) + PY, tW = TW + PX * 2
    const flip = screenY < tH + AH + 20
    const aY = flip ? screenY + AH + 2 : screenY - AH - 2 - tH
    const cX = Math.max(8, Math.min(screenX - tW / 2, this.viewWidth - tW - 8))
    const g = this.scene.add.graphics(); g.setScrollFactor(0).setDepth(10000); this.tooltipGraphics = g
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(cX + 3, aY + 3, tW, tH, 7)
    g.fillStyle(activeTheme.panelBg, 0.97); g.fillRoundedRect(cX, aY, tW, tH, 7)
    g.lineStyle(1, activeTheme.panelStroke, 0.8); g.strokeRoundedRect(cX, aY, tW, tH, 7)
    const aInt = parseInt(statusHex.replace('#', ''), 16), arX = Math.min(Math.max(screenX, cX + 14), cX + tW - 14)
    g.fillStyle(activeTheme.panelBg, 0.97)
    if (!flip) { g.fillTriangle(arX - 6, aY + tH, arX, aY + tH + AH, arX + 6, aY + tH); g.lineStyle(1, activeTheme.panelBg, 1); g.lineBetween(arX - 5, aY + tH, arX + 5, aY + tH) }
    else { g.fillTriangle(arX - 6, aY, arX, aY - AH, arX + 6, aY); g.lineStyle(1, activeTheme.panelBg, 1); g.lineBetween(arX - 5, aY, arX + 5, aY) }
    g.lineStyle(2, aInt, 0.6); g.lineBetween(cX + 7, aY, cX + tW - 7, aY)
    const ct = this.scene.add.container(0, 0); ct.setScrollFactor(0).setDepth(10001); this.tooltipContainer = ct
    const tx = cX + PX; let ty = aY + PY
    ct.add(this.scene.add.text(tx, ty, name, { fontSize: '12px', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', resolution: 2 }))
    if (role) { const rc: Record<string, string> = { SOLVER: '#3b82f6', REVIEWER: '#8b5cf6', EXECUTOR: '#22c55e' }; ct.add(this.scene.add.text(cX + tW - PX, ty + 1, role, { fontSize: '9px', color: '#ffffff', fontFamily: 'system-ui, monospace', fontStyle: 'bold', backgroundColor: rc[role] ?? '#3a4858', padding: { x: 4, y: 2 }, resolution: 2 }).setOrigin(1, 0)) }
    ty += LH
    if (title) { ct.add(this.scene.add.text(tx, ty, title, { fontSize: '10px', color: activeTheme.subtleText, fontFamily: 'system-ui, sans-serif', resolution: 2 })); ty += LH }
    ty += 4
    const statusDotFrame = aInt === 0xfbbf24 ? ICON_FRAMES.CIRCLE_YELLOW : aInt === 0x34d399 ? ICON_FRAMES.CIRCLE_GREEN : aInt === 0xa78bfa ? ICON_FRAMES.CIRCLE_BLUE : ICON_FRAMES.CIRCLE_GREY
    ct.add(this.scene.add.sprite(tx + 3.5, ty + LH / 2, SPRITESHEET_KEYS.GAME_ICONS, statusDotFrame).setScale(0.22).setOrigin(0.5)); ct.add(this.scene.add.text(tx + 12, ty, statusLabel, { fontSize: '10px', color: statusHex, fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', resolution: 2 }))
    if (uptime) ct.add(this.scene.add.text(cX + tW - PX, ty, uptime, { fontSize: '10px', color: '#5a6a7a', fontFamily: 'system-ui, monospace', resolution: 2 }).setOrigin(1, 0))
    ty += LH
    if (hasR) { ct.add(this.scene.add.text(tx + 12, ty, resources, { fontSize: '9px', color: '#5a6a7a', fontFamily: 'system-ui, monospace', resolution: 2 })); ty += LH }
    if (hasTrait) { ct.add(this.scene.add.text(tx + 12, ty, sigTrait, { fontSize: '9px', color: '#a78bfa', fontFamily: 'system-ui, sans-serif', fontStyle: 'italic', resolution: 2 })); ty += LH }
    if (hasPetPreview) {
      ty += 2
      ct.add(this.scene.add.sprite(tx + 8, ty + 6, SPRITESHEET_KEYS.DESK_PETS, tooltipPetFrame).setScale(0.5).setOrigin(0.5))
      ct.add(this.scene.add.sprite(tx + 24, ty + 6, SPRITESHEET_KEYS.GAME_ITEMS, tooltipSigFrame).setScale(0.4).setOrigin(0.5))
      ty += LH
    }
    if (hasS) { ty += 2; const dg = this.scene.add.graphics(); dg.setScrollFactor(0); dg.lineStyle(1, activeTheme.panelStroke, 0.6); dg.lineBetween(tx, ty, cX + tW - PX, ty); ct.add(dg); ty += 4; ct.add(this.scene.add.text(tx, ty, sub, { fontSize: '10px', color: activeTheme.subtleText, fontFamily: 'system-ui, sans-serif', wordWrap: { width: TW }, resolution: 2 })) }
    ct.setAlpha(0); g.setAlpha(0)
    this.tooltipFadeTween = this.scene.tweens.add({ targets: [ct, g], alpha: 1, duration: 150, ease: 'Quad.easeOut' })
  }

  hideTooltip(): void {
    if (this.tooltipFadeTween) { this.tooltipFadeTween.destroy(); this.tooltipFadeTween = null }
    if (this.tooltipContainer) {
      const c = this.tooltipContainer, gfx = this.tooltipGraphics
      this.tooltipContainer = null; this.tooltipGraphics = null
      this.scene.tweens.add({ targets: [c, gfx].filter(Boolean), alpha: 0, duration: 120, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); gfx?.destroy() } })
    }
  }

  // ---------------------------------------------------------------------------
  // Hover ring (world-space)
  // ---------------------------------------------------------------------------

  drawHoverRing(worldX: number, worldY: number): void {
    if (!this.hoverRingGraphics) { this.hoverRingGraphics = this.scene.add.graphics(); this.hoverRingGraphics.setDepth(500) }
    const g = this.hoverRingGraphics, cy = worldY + WS_DESK_Y
    g.clear()
    g.lineStyle(5, 0x60a5fa, 0.12); g.strokeEllipse(worldX, cy, 82, 46)
    g.lineStyle(2.5, 0x3b82f6, 0.32); g.strokeEllipse(worldX, cy, 74, 38)
    g.lineStyle(1.5, 0x3b82f6, 0.72); g.strokeEllipse(worldX, cy, 68, 32)

    // Highlight accent sprite at the ring's peak (top of the innermost ellipse)
    if (!this.hoverRingAccent && this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS)) {
      this.hoverRingAccent = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_BLUE)
        .setScale(0.2)
        .setAlpha(0.7)
        .setDepth(501)
    }
    if (this.hoverRingAccent) {
      // Innermost ellipse is 68 wide x 32 tall — top is cy - 16
      this.hoverRingAccent.setPosition(worldX, cy - 16).setVisible(true)
    }
  }

  clearHoverRing(): void {
    this.hoverRingGraphics?.clear()
    this.hoverRingAccent?.setVisible(false)
  }

  // ---------------------------------------------------------------------------
  // Help overlay
  // ---------------------------------------------------------------------------

  showHelpOverlay(): void {
    if (this.helpOverlay) return
    this.helpVisible = true

    const { width, height } = this.scene.scale
    const PW = 280
    const PH = 370

    const container = this.scene.add.container(0, 0)
    container.setDepth(9999)
    container.setScrollFactor(0)

    // Backdrop: full-viewport semi-transparent dark rect, screen-space
    const backdrop = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0)
    container.add(backdrop)

    // Panel background with rounded corners and border
    const panelX = width / 2
    const panelY = height / 2
    const panelGfx = this.scene.add.graphics()
    panelGfx.fillStyle(activeTheme.panelBg, 1)
    panelGfx.fillRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 10)
    panelGfx.lineStyle(1, activeTheme.panelStroke, 1)
    panelGfx.strokeRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 10)
    container.add(panelGfx)

    // Title
    container.add(
      this.scene.add
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
    const divider = this.scene.add.graphics()
    divider.lineStyle(1, activeTheme.panelStroke, 0.6)
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
      ['M',       'Toggle sound'],
      ['N',       'Cycle day/night'],
      ['T',       'Toggle dark/light'],
      ['Q',       'Quest log'],
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
        this.scene.add.text(keyX, rowY, key, { fontSize: '10px', color: '#5a6a7a', fontFamily: 'monospace', fontStyle: 'bold' }).setScrollFactor(0),
      )
      container.add(
        this.scene.add.text(descX, rowY, desc, { fontSize: '10px', color: activeTheme.subtleText, fontFamily: 'monospace' }).setScrollFactor(0),
      )
    }

    // Divider sprite above dismiss hint (if loaded), else Graphics fallback
    if (this.scene.textures.exists(IMAGE_KEYS.DIVIDER)) {
      container.add(
        this.scene.add.image(panelX, panelY + PH / 2 - 28, IMAGE_KEYS.DIVIDER)
          .setDisplaySize(PW - 32, 4).setAlpha(0.5).setScrollFactor(0),
      )
    } else {
      const hintDiv = this.scene.add.graphics()
      hintDiv.lineStyle(1, activeTheme.panelStroke, 0.4)
      hintDiv.lineBetween(panelX - PW / 2 + 16, panelY + PH / 2 - 28, panelX + PW / 2 - 16, panelY + PH / 2 - 28)
      container.add(hintDiv)
    }

    // Button sprite accent next to dismiss hint
    container.add(
      this.scene.add.sprite(panelX - 80, panelY + PH / 2 - 12, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.BUTTON_ROUND)
        .setScale(0.35).setOrigin(0.5, 0.5).setAlpha(0.6).setScrollFactor(0),
    )

    // Dismiss hint at bottom of panel
    container.add(
      this.scene.add
        .text(panelX - 66, panelY + PH / 2 - 12, 'Press H or ESC to dismiss', {
          fontSize: '9px',
          color: '#3a4858',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0),
    )

    container.setAlpha(0)
    this.helpOverlay = container

    // Fade in over 200ms
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 200, ease: 'Quad.easeOut' })
  }

  hideHelpOverlay(): void {
    if (!this.helpOverlay) return
    this.helpVisible = false
    const overlay = this.helpOverlay
    this.helpOverlay = null
    // Fade out then destroy
    this.scene.tweens.add({
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

  toggleDebugOverlay(navMesh: NavMesh, rooms: Map<string, Room>, agents: AgentState[], cafe: PennyCafe): void {
    if (this.debugOverlayVisible) {
      this.hideDebugOverlay()
    } else {
      this.showDebugOverlay(navMesh, rooms, agents, cafe)
    }
  }

  showDebugOverlay(navMesh: NavMesh, rooms: Map<string, Room>, agents: AgentState[], cafe: PennyCafe): void {
    this.debugOverlayVisible = true

    // HUD text panel (screen-space)
    const container = this.scene.add.container(0, 0).setDepth(11000).setScrollFactor(0)
    this.debugOverlayContainer = container

    const panelGfx = this.scene.add.graphics()
    panelGfx.fillStyle(0x000000, 0.75)
    panelGfx.fillRoundedRect(8, this.viewHeight - 88, 210, 80, 6)
    panelGfx.lineStyle(1, 0x3b82f6, 0.5)
    panelGfx.strokeRoundedRect(8, this.viewHeight - 88, 210, 80, 6)
    container.add(panelGfx)

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '10px', fontFamily: 'monospace', color: '#34d399', resolution: 2,
    }
    this.debugFpsText = this.scene.add.text(16, this.viewHeight - 82, 'FPS: --', textStyle).setScrollFactor(0)
    this.debugObjectCountText = this.scene.add.text(16, this.viewHeight - 68, 'Objects: --', textStyle).setScrollFactor(0)
    const navStats = navMesh.getStats()
    const navText = this.scene.add.text(16, this.viewHeight - 54, `NavMesh: ${navStats.walkable}/${navStats.total} walkable`, { ...textStyle, color: '#60a5fa' }).setScrollFactor(0)
    const roomText = this.scene.add.text(16, this.viewHeight - 40, `Rooms: ${rooms.size}  Agents: ${agents.length}`, { ...textStyle, color: activeTheme.subtleText }).setScrollFactor(0)
    const hintText = this.scene.add.text(16, this.viewHeight - 26, 'Press ` to dismiss', { ...textStyle, color: '#3a4858', fontSize: '9px' }).setScrollFactor(0)
    container.add([this.debugFpsText, this.debugObjectCountText, navText, roomText, hintText])

    // Nav mesh world-space overlays
    this.debugNavMeshGfx = this.scene.add.graphics().setDepth(50).setAlpha(0.3)
    this.debugPathGfx = this.scene.add.graphics().setDepth(51)
    this.drawNavMeshDebug(navMesh, rooms, cafe)

    // Dump scene graph to console
    this.dumpSceneGraph(rooms, agents, navMesh)

    this.showToast('Debug overlay ON', 'info')
  }

  hideDebugOverlay(): void {
    this.debugOverlayVisible = false
    if (this.debugOverlayContainer) { this.debugOverlayContainer.destroy(); this.debugOverlayContainer = null }
    this.debugFpsText = null
    this.debugObjectCountText = null
    if (this.debugNavMeshGfx) { this.debugNavMeshGfx.destroy(); this.debugNavMeshGfx = null }
    if (this.debugPathGfx) { this.debugPathGfx.destroy(); this.debugPathGfx = null }
    this.showToast('Debug overlay OFF', 'info')
  }

  refreshDebugOverlay(_time: number, delta: number, rooms: Map<string, Room>): void {
    const fps = Math.round(1000 / Math.max(delta, 1))
    if (this.debugFpsText) this.debugFpsText.setText(`FPS: ${fps}  (${delta.toFixed(1)}ms)`)

    // Count all display list objects across the scene
    let objectCount = 0
    try { objectCount = this.scene.children.length } catch { /* noop */ }
    if (this.debugObjectCountText) this.debugObjectCountText.setText(`Objects: ${objectCount}`)

    // Redraw active paths on nav mesh debug layer
    if (this.debugPathGfx) {
      this.debugPathGfx.clear()
      this.debugPathGfx.lineStyle(2, 0xfbbf24, 0.8)
      for (const room of rooms.values()) {
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

  drawNavMeshDebug(navMesh: NavMesh, rooms: Map<string, Room>, cafe: PennyCafe): void {
    if (!this.debugNavMeshGfx) return
    const g = this.debugNavMeshGfx
    g.clear()

    const stats = navMesh.getStats()
    if (stats.total === 0) return

    // Use the navMesh's public API to check walkability cell-by-cell
    // We reconstruct the grid bounds from the navMesh stats and known origin
    // Since NavMesh doesn't expose origin directly, sample the walkable area
    // by iterating over the world bounds we know about
    const cellSize = 12 // matches CELL_SIZE in nav-mesh.ts
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.x - room.width / 2 - 60)
      minY = Math.min(minY, room.y - room.height / 2 - 60)
      maxX = Math.max(maxX, room.x + room.width / 2 + 60)
      maxY = Math.max(maxY, room.y + room.height / 2 + 60)
    }
    if (cafe) {
      const cb = cafe.getBounds()
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
        if (navMesh.isPointWalkable(wx, wy)) {
          g.fillStyle(0x22c55e, 0.25)
          g.fillRect(wx - cellSize / 2, wy - cellSize / 2, cellSize, cellSize)
        }
      }
    }
  }

  private dumpSceneGraph(rooms: Map<string, Room>, agents: AgentState[], navMesh: NavMesh): void {
    const summary: Record<string, number> = {}
    this.scene.children.each((child: Phaser.GameObjects.GameObject) => {
      const type = child.type || (child.constructor as { name?: string }).name || 'Unknown'
      summary[type] = (summary[type] || 0) + 1
    })
    console.group('%c[OfficeScene Debug] Scene Graph', 'color: #34d399; font-weight: bold')
    console.log('Total objects:', this.scene.children.length)
    console.table(summary)
    console.log('Rooms:', rooms.size)
    console.log('Agents:', agents.length)
    console.log('NavMesh:', navMesh.getStats())
    console.log('Camera:', {
      scrollX: this.scene.cameras.main.scrollX.toFixed(1),
      scrollY: this.scene.cameras.main.scrollY.toFixed(1),
      zoom: this.scene.cameras.main.zoom.toFixed(3),
    })
    console.groupEnd()
  }

  // ---------------------------------------------------------------------------
  // LOD label (shown briefly on LOD level transitions)
  // ---------------------------------------------------------------------------

  showLodLabel(level: number): void {
    const labels: Record<number, string> = { 1: 'Overview', 2: 'Rooms', 3: 'Detail' }
    const label = labels[level]
    if (!label) return

    if (this.lodLabelFadeTween) { this.lodLabelFadeTween.destroy(); this.lodLabelFadeTween = null }
    if (this.lodLabelContainer) { this.lodLabelContainer.destroy(); this.lodLabelContainer = null }

    const x = this.viewWidth - 14
    const y = this.viewHeight - 14 - 28

    const bg = this.scene.add.graphics()
    bg.fillStyle(activeTheme.panelBg, 0.72)
    bg.fillRoundedRect(-72, -11, 72, 22, 4)

    const text = this.scene.add.text(-36, 0, label, {
      fontSize: '10px',
      color: activeTheme.subtleText,
      fontFamily: 'system-ui, sans-serif',
      resolution: 2,
    }).setOrigin(0.5)

    this.lodLabelContainer = this.scene.add.container(x, y, [bg, text])
      .setDepth(9995)
      .setScrollFactor(0)
      .setAlpha(1)

    this.lodLabelFadeTween = this.scene.tweens.add({
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
  // LOD application
  // ---------------------------------------------------------------------------

  applyLod(
    level: number,
    rooms: Map<string, Room>,
    whiteboardContainer: Phaser.GameObjects.Container | null,
    corridorSignTexts: Phaser.GameObjects.Text[],
    teamAreaLabels: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[],
  ): void {
    this.showLodLabel(level)

    const showRoomInterior = level >= 2
    for (const room of rooms.values()) {
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
      // Header status dots are an overview-zoom summary — visible at L1,
      // hidden at L2+ where individual workstation status dots take over.
      if (room.headerStatusDots) {
        const showOverviewDots = level === 1
        for (const d of room.headerStatusDots) d.setVisible(showOverviewDots)
      }
    }

    if (whiteboardContainer) whiteboardContainer.setVisible(level >= 3)
    for (const t of corridorSignTexts) t.setVisible(level >= 2)
    for (const t of teamAreaLabels) t.setVisible(level >= 2)
  }

  applyLodToWorkstation(ws: WorkstationSprite, level: number, _useFadeIn: boolean): void {
    // Guard: skip if LOD level hasn't changed for this workstation
    if (ws.currentLodLevel === level) return
    const prevLevel = ws.currentLodLevel ?? 1
    ws.currentLodLevel = level

    const showRoom = level >= 2
    const showFull = level >= 3
    const wasRoom = prevLevel >= 2
    const wasFull = prevLevel >= 3

    type AlphaObj = Phaser.GameObjects.Components.Visible &
      Phaser.GameObjects.Components.AlphaSingle

    const hideLodLevel2And3 = () => {
      for (const obj of ws.lodLevel2Objects) {
        if (!obj || !('setVisible' in obj)) continue
        this.scene.tweens.killTweensOf(obj)
        ;(obj as unknown as AlphaObj).setVisible(false)
      }
      for (const obj of ws.lodLevel3Objects) {
        if (!obj || !('setVisible' in obj)) continue
        this.scene.tweens.killTweensOf(obj)
        ;(obj as unknown as AlphaObj).setVisible(false)
      }
    }

    // Container visibility — fade the whole container when entering/leaving L2
    if (showRoom && !wasRoom) {
      // Entering L2 from L1: fade in container
      ws.container.setVisible(true).setAlpha(0)
      this.scene.tweens.add({ targets: ws.container, alpha: 1, duration: 200, ease: 'Power2' })
    } else if (!showRoom && wasRoom) {
      // Leaving L2 to L1: hide LOD2+ desk extras immediately, then fade out container
      hideLodLevel2And3()
      this.scene.tweens.add({
        targets: ws.container, alpha: 0, duration: 150, ease: 'Power2',
        onComplete: () => { ws.container.setVisible(false) },
      })
      return // container fading out — skip child visibility
    } else if (!showRoom) {
      hideLodLevel2And3()
      ws.container.setVisible(false)
      return
    }

    const fadeIn = (obj: Phaser.GameObjects.GameObject, targetAlpha = 1) => {
      const v = obj as unknown as AlphaObj
      // Kill any existing LOD fade tween on this object to prevent conflicts
      this.scene.tweens.killTweensOf(obj)
      v.setVisible(true)
      // Respect objects that manage their own alpha (e.g. quest icons at alpha 0)
      if (v.alpha > 0 && v.alpha < targetAlpha) {
        // Already partially visible — tween from current
        this.scene.tweens.add({ targets: obj, alpha: targetAlpha, duration: 200, ease: 'Power2' })
      } else {
        v.setAlpha(0)
        this.scene.tweens.add({ targets: obj, alpha: targetAlpha, duration: 200, ease: 'Power2' })
      }
    }

    const fadeOut = (obj: Phaser.GameObjects.GameObject) => {
      const v = obj as unknown as AlphaObj
      if (!v.visible) return // already hidden
      // Kill any existing LOD fade tween on this object
      this.scene.tweens.killTweensOf(obj)
      this.scene.tweens.add({
        targets: obj, alpha: 0, duration: 150, ease: 'Power2',
        onComplete: () => { (obj as unknown as AlphaObj).setVisible(false) },
      })
    }

    // L2 objects: shown at level >= 2
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

    // L3 objects: shown at level >= 3
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

    // These are managed by animation state but suppressed below L3
    if (ws.screenLines) {
      if (showFull && !wasFull) {
        ws.screenLines.setVisible(true).setAlpha(0)
        this.scene.tweens.add({ targets: ws.screenLines, alpha: 1, duration: 200, ease: 'Power2' })
      } else if (!showFull && wasFull) {
        this.scene.tweens.add({
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
  }

  // ---------------------------------------------------------------------------
  // Status bar (screen-space, bottom of viewport)
  // ---------------------------------------------------------------------------

  buildStatusBar(): void {
    const BAR_H = 24;
    const vw = this.viewWidth;
    const vh = this.viewHeight;
    this.statusBarContainer = this.scene.add.container(0, vh - BAR_H).setDepth(9995).setScrollFactor(0);
    this.statusBarBg = this.scene.add.rectangle(0, 0, vw, BAR_H, activeTheme.panelBg, 0.85).setOrigin(0, 0);
    this.statusBarContainer.add(this.statusBarBg);
    const ts = { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: activeTheme.subtleText };
    const midY = BAR_H / 2;
    const brandText = this.scene.add.text(10, midY, 'PENNY OFFICE', ts).setOrigin(0, 0.5);
    this.statusBarContainer.add(brandText);
    const cx = vw / 2;
    this.statusBarAgentText = this.scene.add.text(cx - 80, midY, 'AGENTS 0', ts).setOrigin(0.5, 0.5);
    this.statusBarActiveText = this.scene.add.text(cx, midY, 'ACTIVE 0', ts).setOrigin(0.5, 0.5);
    this.statusBarRoomText = this.scene.add.text(cx + 80, midY, 'ROOMS 0', ts).setOrigin(0.5, 0.5);
    this.statusBarContainer.add([this.statusBarAgentText, this.statusBarActiveText, this.statusBarRoomText]);
    this.statusBarTimeText = this.scene.add.text(vw - 10, midY, this.getStatusBarTime(), ts).setOrigin(1, 0.5);
    this.statusBarContainer.add(this.statusBarTimeText);
    this.statusBarSep = this.scene.add.rectangle(0, BAR_H - 1, vw, 1, activeTheme.separator, 1).setOrigin(0, 0);
    this.statusBarContainer.add(this.statusBarSep);
  }

  repositionStatusBar(): void {
    if (!this.statusBarContainer) return;
    const vw = this.viewWidth;
    const vh = this.viewHeight;
    this.statusBarContainer.setY(vh - 24);
    if (this.statusBarBg) this.statusBarBg.setSize(vw, 24);
    if (this.statusBarSep) this.statusBarSep.setSize(vw, 1);
    if (this.statusBarAgentText) this.statusBarAgentText.setX(vw / 2 - 80);
    if (this.statusBarActiveText) this.statusBarActiveText.setX(vw / 2);
    if (this.statusBarRoomText) this.statusBarRoomText.setX(vw / 2 + 80);
    if (this.statusBarTimeText) this.statusBarTimeText.setX(vw - 10);
  }

  updateStatusBar(agents: AgentState[], roomCount: number): void {
    if (!this.statusBarAgentText || !this.statusBarActiveText || !this.statusBarRoomText) return;
    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === 'active').length;
    this.statusBarAgentText.setText('AGENTS ' + totalAgents);
    this.statusBarActiveText.setText('ACTIVE ' + activeAgents);
    this.statusBarActiveText.setColor(activeAgents > 0 ? '#34d399' : activeTheme.subtleText);
    this.statusBarRoomText.setText('ROOMS ' + roomCount);
  }

  refreshStatusBarTime(): void {
    if (this.statusBarTimeText) this.statusBarTimeText.setText(this.getStatusBarTime());
  }

  getStatusBarTime(): string {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  }

  /** Whether the status bar container exists (used for update throttling checks) */
  get hasStatusBar(): boolean {
    return this.statusBarContainer !== null
  }

  /** Whether the status bar time text exists (used for update throttling checks) */
  get hasStatusBarTime(): boolean {
    return this.statusBarTimeText !== null
  }
}
