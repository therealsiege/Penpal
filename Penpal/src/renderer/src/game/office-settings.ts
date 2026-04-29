// ---------------------------------------------------------------------------
// office-settings.ts
// In-game settings overlay: Audio volumes, theme selector, keybind reference.
// Tabs: Audio | Display | Controls.  Persists via audioManager (audio state)
// and localStorage (theme preference).  Opens via ESC as a final fallback;
// closes with ESC or the × button.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { audioManager, type ChannelName } from './audio-manager'
import { activeTheme, THEMES, setActiveTheme, type ThemeName } from './office-theme'
import { scaledFontSize } from './office-constants'
import { EventBus, EVENTS } from './events'

// ---------------------------------------------------------------------------
// Theme persistence
// ---------------------------------------------------------------------------

const SETTINGS_STORAGE_KEY = 'penny-game-settings'

interface GameSettings {
  themeName: ThemeName
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>
      const themeName: ThemeName =
        parsed.themeName === 'light' || parsed.themeName === 'dark'
          ? parsed.themeName
          : 'dark'
      return { themeName }
    }
  } catch { /* ignore */ }
  return { themeName: 'dark' }
}

function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// SettingsHostScene interface — minimal contract back to OfficeScene
// ---------------------------------------------------------------------------

export interface SettingsHostScene {
  /** Apply a theme change — triggers full redraw. */
  applyTheme(name: ThemeName): void
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'audio' | 'display' | 'controls'

interface SliderHandle {
  trackFillGfx: Phaser.GameObjects.Graphics
  thumbCircle: Phaser.GameObjects.Arc
  valueText: Phaser.GameObjects.Text
  trackLeft: number
  trackWidth: number
  value: number
}

// ---------------------------------------------------------------------------
// SettingsOverlay
// ---------------------------------------------------------------------------

export class SettingsOverlay {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private contentContainer: Phaser.GameObjects.Container | null = null
  settingsVisible = false

  private activeTab: Tab = 'audio'

  // Panel layout constants
  private readonly PW = 420
  private readonly PH = 390
  private readonly CONTENT_TOP_OFFSET = 88  // below title + tab bar
  private readonly CONTENT_HEIGHT = 270

  // Drag state — cleaned up on hide
  private _onPointerMove: ((ptr: Phaser.Input.Pointer) => void) | null = null
  private _onPointerUp: (() => void) | null = null
  private _activeDrag: ((v: number) => void) | null = null

  // Tab button text refs for highlight toggle
  private _tabTexts: Partial<Record<Tab, Phaser.GameObjects.Text>> = {}

  // Cached host scene reference
  private _host: SettingsHostScene | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  show(host: SettingsHostScene): void {
    if (this.container) return
    this._host = host
    this.settingsVisible = true
    this._build()
  }

  hide(): void {
    if (!this.container) return
    this.settingsVisible = false
    this._removeDragListeners()
    const c = this.container
    this.container = null
    this.contentContainer = null
    this._tabTexts = {}
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => { try { c.destroy() } catch { /* already gone */ } },
    })
  }

  destroy(): void {
    this._removeDragListeners()
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.destroy()
      this.container = null
    }
    this.contentContainer = null
    this._tabTexts = {}
    this.settingsVisible = false
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  private _build(): void {
    const { width, height } = this.scene.scale
    const { PW, PH } = this
    const panelX = width / 2
    const panelY = height / 2

    const container = this.scene.add.container(0, 0)
    container.setDepth(10000).setScrollFactor(0)
    this.container = container

    // Backdrop — click to close
    const backdrop = this.scene.add
      .rectangle(panelX, panelY, width, height, 0x000000, 0.75)
      .setScrollFactor(0)
      .setInteractive()
    backdrop.on('pointerdown', () => this.hide())
    container.add(backdrop)

    // Panel background
    const panelGfx = this.scene.add.graphics()
    panelGfx.fillStyle(activeTheme.panelBg, 1)
    panelGfx.fillRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 12)
    panelGfx.lineStyle(1, activeTheme.panelStroke, 1)
    panelGfx.strokeRoundedRect(panelX - PW / 2, panelY - PH / 2, PW, PH, 12)
    container.add(panelGfx)

    // Title
    container.add(
      this.scene.add
        .text(panelX, panelY - PH / 2 + 20, 'Settings', {
          fontSize: scaledFontSize(13),
          fontStyle: 'bold',
          color: '#f1f5f9',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0),
    )

    // × close button
    const closeBtn = this.scene.add
      .text(panelX + PW / 2 - 18, panelY - PH / 2 + 18, '×', {
        fontSize: scaledFontSize(16),
        color: '#5a6a7a',
        fontFamily: 'monospace',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    closeBtn.on('pointerover', () => closeBtn.setColor('#f1f5f9'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#5a6a7a'))
    closeBtn.on('pointerdown', () => this.hide())
    container.add(closeBtn)

    // Divider under title
    const titleDiv = this.scene.add.graphics()
    titleDiv.lineStyle(1, activeTheme.panelStroke, 0.6)
    titleDiv.lineBetween(
      panelX - PW / 2 + 16, panelY - PH / 2 + 46,
      panelX + PW / 2 - 16, panelY - PH / 2 + 46,
    )
    container.add(titleDiv)

    // Tab bar
    this._buildTabBar(container, panelX, panelY)

    // Content area (replaced on tab switch)
    this._buildContent(container, panelX, panelY)

    // Dismiss hint
    container.add(
      this.scene.add
        .text(panelX, panelY + PH / 2 - 14, 'Press ESC or click outside to close', {
          fontSize: scaledFontSize(9),
          color: '#3a4858',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0),
    )

    // Fade in
    container.setAlpha(0)
    this.scene.tweens.add({ targets: container, alpha: 1, duration: 200, ease: 'Quad.easeOut' })
  }

  // ---------------------------------------------------------------------------
  // Tab bar
  // ---------------------------------------------------------------------------

  private _buildTabBar(
    container: Phaser.GameObjects.Container,
    panelX: number,
    panelY: number,
  ): void {
    const { PW, PH } = this
    const tabs: Tab[] = ['audio', 'display', 'controls']
    const tabLabels: Record<Tab, string> = { audio: 'Audio', display: 'Display', controls: 'Controls' }
    const tabW = (PW - 32) / 3
    const tabY = panelY - PH / 2 + 60

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      const tabX = panelX - PW / 2 + 16 + i * tabW + tabW / 2
      const isActive = tab === this.activeTab

      // Tab background
      const tabBg = this.scene.add.graphics()
      tabBg.fillStyle(isActive ? activeTheme.panelStroke : 0, isActive ? 1 : 0)
      tabBg.fillRoundedRect(tabX - tabW / 2, tabY - 12, tabW, 24, 6)
      container.add(tabBg)

      // Tab label
      const tabText = this.scene.add
        .text(tabX, tabY, tabLabels[tab], {
          fontSize: scaledFontSize(10),
          fontStyle: isActive ? 'bold' : 'normal',
          color: isActive ? activeTheme.accentText : '#5a6a7a',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })

      this._tabTexts[tab] = tabText

      const capturedTab = tab
      const capturedBg = tabBg

      tabText.on('pointerover', () => {
        if (capturedTab !== this.activeTab) tabText.setColor('#a0b0c0')
      })
      tabText.on('pointerout', () => {
        if (capturedTab !== this.activeTab) tabText.setColor('#5a6a7a')
      })
      tabText.on('pointerdown', () => {
        if (capturedTab === this.activeTab) return
        // Deactivate old tab styling
        const oldTab = this.activeTab
        if (this._tabTexts[oldTab]) {
          this._tabTexts[oldTab]!.setColor('#5a6a7a').setStyle({ fontStyle: 'normal' })
        }
        // Activate new tab
        this.activeTab = capturedTab
        capturedBg.clear()
        capturedBg.fillStyle(activeTheme.panelStroke, 1)
        capturedBg.fillRoundedRect(tabX - tabW / 2, tabY - 12, tabW, 24, 6)
        tabText.setColor(activeTheme.accentText).setStyle({ fontStyle: 'bold' })
        // Rebuild content
        if (this.contentContainer && this.container) {
          this.contentContainer.destroy()
          this.contentContainer = null
          this._buildContent(this.container, panelX, panelY)
        }
      })

      container.add(tabText)
    }

    // Divider under tab bar
    const tabDiv = this.scene.add.graphics()
    tabDiv.lineStyle(1, activeTheme.panelStroke, 0.6)
    tabDiv.lineBetween(
      panelX - PW / 2 + 16, panelY - PH / 2 + 86,
      panelX + PW / 2 - 16, panelY - PH / 2 + 86,
    )
    container.add(tabDiv)
  }

  // ---------------------------------------------------------------------------
  // Content area dispatch
  // ---------------------------------------------------------------------------

  private _buildContent(
    container: Phaser.GameObjects.Container,
    panelX: number,
    panelY: number,
  ): void {
    const cc = this.scene.add.container(0, 0).setScrollFactor(0)
    this.contentContainer = cc
    container.add(cc)

    switch (this.activeTab) {
      case 'audio':    this._buildAudioTab(cc, panelX, panelY); break
      case 'display':  this._buildDisplayTab(cc, panelX, panelY); break
      case 'controls': this._buildControlsTab(cc, panelX, panelY); break
    }
  }

  // ---------------------------------------------------------------------------
  // Audio tab — master + per-channel sliders
  // ---------------------------------------------------------------------------

  private _buildAudioTab(
    cc: Phaser.GameObjects.Container,
    panelX: number,
    panelY: number,
  ): void {
    const { PW, PH, CONTENT_TOP_OFFSET } = this
    const leftPad = 24
    const trackLeft = panelX - PW / 2 + leftPad
    const trackWidth = PW - leftPad * 2
    const contentStartY = panelY - PH / 2 + CONTENT_TOP_OFFSET

    type SliderDef = { label: string; getValue: () => number; onChange: (v: number) => void }
    const sliders: SliderDef[] = [
      {
        label: 'Master',
        getValue: () => audioManager.masterVolume,
        onChange: (v) => audioManager.setMasterVolume(v),
      },
      {
        label: 'Ambient',
        getValue: () => audioManager.getChannelVolume('ambient'),
        onChange: (v) => audioManager.setChannelVolume('ambient', v),
      },
      {
        label: 'SFX',
        getValue: () => audioManager.getChannelVolume('sfx'),
        onChange: (v) => audioManager.setChannelVolume('sfx', v),
      },
      {
        label: 'UI',
        getValue: () => audioManager.getChannelVolume('ui'),
        onChange: (v) => audioManager.setChannelVolume('ui', v),
      },
      {
        label: 'Music',
        getValue: () => audioManager.getChannelVolume('music'),
        onChange: (v) => audioManager.setChannelVolume('music', v),
      },
    ]

    const ROW_H = 48
    for (let i = 0; i < sliders.length; i++) {
      const { label, getValue, onChange } = sliders[i]
      const rowY = contentStartY + i * ROW_H
      this._addSliderRow(cc, trackLeft, rowY, trackWidth, label, getValue(), onChange)
    }

    // Mute toggle at the bottom
    const muteY = contentStartY + sliders.length * ROW_H + 4
    const muteLabel = audioManager.isMuted ? '🔇 Muted — click to unmute' : '🔊 Click to mute all'
    const muteBtn = this.scene.add
      .text(panelX, muteY, muteLabel, {
        fontSize: scaledFontSize(9),
        color: audioManager.isMuted ? '#f87171' : '#5a6a7a',
        fontFamily: 'monospace',
        resolution: 2,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    muteBtn.on('pointerover', () => muteBtn.setColor('#f1f5f9'))
    muteBtn.on('pointerout', () => {
      muteBtn.setColor(audioManager.isMuted ? '#f87171' : '#5a6a7a')
    })
    muteBtn.on('pointerdown', () => {
      audioManager.toggleMute()
      const newLabel = audioManager.isMuted ? '🔇 Muted — click to unmute' : '🔊 Click to mute all'
      muteBtn.setText(newLabel)
      muteBtn.setColor(audioManager.isMuted ? '#f87171' : '#5a6a7a')
    })
    cc.add(muteBtn)
  }

  // ---------------------------------------------------------------------------
  // Display tab — theme selector
  // ---------------------------------------------------------------------------

  private _buildDisplayTab(
    cc: Phaser.GameObjects.Container,
    panelX: number,
    panelY: number,
  ): void {
    const { PH, CONTENT_TOP_OFFSET } = this
    const contentStartY = panelY - PH / 2 + CONTENT_TOP_OFFSET + 12

    // Section label
    cc.add(
      this.scene.add
        .text(panelX - this.PW / 2 + 24, contentStartY, 'Color Theme', {
          fontSize: scaledFontSize(10),
          color: '#8a96a4',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0, 0)
        .setScrollFactor(0),
    )

    const themes: { name: ThemeName; label: string; desc: string }[] = [
      { name: 'dark',  label: 'Dark',  desc: 'Deep industrial palette' },
      { name: 'light', label: 'Light', desc: 'Warm studio palette' },
    ]

    const currentTheme: ThemeName = activeTheme === THEMES.dark ? 'dark' : 'light'
    const BTN_W = 160
    const BTN_H = 64
    const gap = 16
    const totalW = themes.length * BTN_W + (themes.length - 1) * gap
    const startX = panelX - totalW / 2

    themes.forEach(({ name, label, desc }, idx) => {
      const btnX = startX + idx * (BTN_W + gap) + BTN_W / 2
      const btnY = contentStartY + 32
      const isActive = name === currentTheme

      // Card background
      const cardGfx = this.scene.add.graphics()
      const cardColor = isActive ? activeTheme.panelStroke : (activeTheme === THEMES.dark ? 0x0a0e14 : 0xe8e0d4)
      cardGfx.fillStyle(cardColor, 1)
      cardGfx.fillRoundedRect(btnX - BTN_W / 2, btnY, BTN_W, BTN_H, 8)
      if (isActive) {
        cardGfx.lineStyle(2, isActive ? parseInt(activeTheme.accentText.replace('#', '0x'), 16) : activeTheme.panelStroke, 1)
        cardGfx.strokeRoundedRect(btnX - BTN_W / 2, btnY, BTN_W, BTN_H, 8)
      }
      cc.add(cardGfx)

      // Theme name
      cc.add(
        this.scene.add
          .text(btnX, btnY + 18, label, {
            fontSize: scaledFontSize(11),
            fontStyle: isActive ? 'bold' : 'normal',
            color: isActive ? activeTheme.accentText : '#5a6a7a',
            fontFamily: 'monospace',
            resolution: 2,
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0),
      )

      // Theme description
      cc.add(
        this.scene.add
          .text(btnX, btnY + 40, desc, {
            fontSize: scaledFontSize(8),
            color: isActive ? activeTheme.subtleText : '#3a4858',
            fontFamily: 'monospace',
            resolution: 2,
          })
          .setOrigin(0.5, 0)
          .setScrollFactor(0),
      )

      // Invisible hit zone over card
      const zone = this.scene.add
        .zone(btnX, btnY + BTN_H / 2, BTN_W, BTN_H)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
      cc.add(zone)

      zone.on('pointerdown', () => {
        if (name === currentTheme) return
        // Apply theme
        if (this._host) this._host.applyTheme(name)
        saveGameSettings({ themeName: name })
        EventBus.emit(EVENTS.THEME_CHANGED, name)
        // Rebuild display tab to reflect new theme
        if (this.container) {
          cc.destroy()
          this.contentContainer = null
          this._buildContent(this.container, panelX, panelY)
        }
      })
    })

    // Info note
    cc.add(
      this.scene.add
        .text(panelX, contentStartY + BTN_H + 52, 'Press T in-game to toggle theme instantly', {
          fontSize: scaledFontSize(8),
          color: '#3a4858',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0),
    )
  }

  // ---------------------------------------------------------------------------
  // Controls tab — keybind reference
  // ---------------------------------------------------------------------------

  private _buildControlsTab(
    cc: Phaser.GameObjects.Container,
    panelX: number,
    panelY: number,
  ): void {
    const { PW, PH, CONTENT_TOP_OFFSET } = this
    const contentStartY = panelY - PH / 2 + CONTENT_TOP_OFFSET + 4
    const keyX  = panelX - PW / 2 + 24
    const descX = panelX - PW / 2 + 120

    const shortcuts: [string, string][] = [
      ['ESC',     'Settings / deselect'],
      ['TAB',     'Cycle agents'],
      ['ENTER',   'Open agent'],
      ['F',       'Zoom to fit'],
      ['R',       'Reset camera'],
      ['SPACE',   'Auto-pan'],
      ['+  /  -', 'Zoom in / out'],
      ['1 – 9',   'Jump to agent'],
      ['H  /  ?', 'Help overlay'],
      ['M',       'Toggle mute'],
      ['N',       'Cycle day / night'],
      ['O',       'Ops board'],
      ['T',       'Toggle theme'],
      ['Q',       'Quest log'],
      ['A',       'Achievements'],
      ['`',       'Debug overlay'],
    ]

    // Two-column layout to fit in content area
    const colWidth = (PW - 48) / 2
    const ROW_H = 18
    const half = Math.ceil(shortcuts.length / 2)

    for (let i = 0; i < shortcuts.length; i++) {
      const [key, desc] = shortcuts[i]
      const col = i < half ? 0 : 1
      const row = i < half ? i : i - half
      const cx = keyX + col * colWidth
      const cy = contentStartY + row * ROW_H

      cc.add(
        this.scene.add
          .text(cx, cy, key, {
            fontSize: scaledFontSize(9),
            color: '#5a6a7a',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            resolution: 2,
          })
          .setOrigin(0, 0)
          .setScrollFactor(0),
      )
      cc.add(
        this.scene.add
          .text(cx + 72, cy, desc, {
            fontSize: scaledFontSize(9),
            color: activeTheme.subtleText,
            fontFamily: 'monospace',
            resolution: 2,
          })
          .setOrigin(0, 0)
          .setScrollFactor(0),
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Slider row helper
  // ---------------------------------------------------------------------------

  private _addSliderRow(
    cc: Phaser.GameObjects.Container,
    trackLeft: number,
    rowY: number,
    trackWidth: number,
    label: string,
    initialValue: number,
    onChange: (v: number) => void,
  ): void {
    const TRACK_H = 6
    const THUMB_R = 7
    const trackY = rowY + 28
    const trackRight = trackLeft + trackWidth

    // Label
    cc.add(
      this.scene.add
        .text(trackLeft, rowY + 4, label, {
          fontSize: scaledFontSize(9),
          color: '#8a96a4',
          fontFamily: 'monospace',
          resolution: 2,
        })
        .setOrigin(0, 0)
        .setScrollFactor(0),
    )

    // Value percent text (right-aligned)
    const valueText = this.scene.add
      .text(trackRight, rowY + 4, `${Math.round(initialValue * 100)}%`, {
        fontSize: scaledFontSize(9),
        color: activeTheme.accentText,
        fontFamily: 'monospace',
        resolution: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
    cc.add(valueText)

    // Track background
    const trackBgGfx = this.scene.add.graphics()
    trackBgGfx.fillStyle(activeTheme.panelStroke, 1)
    trackBgGfx.fillRoundedRect(trackLeft, trackY - TRACK_H / 2, trackWidth, TRACK_H, 3)
    cc.add(trackBgGfx)

    // Track fill (accent color, width proportional to value)
    const trackFillGfx = this.scene.add.graphics()
    const fillW = Math.max(0, Math.min(trackWidth, initialValue * trackWidth))
    trackFillGfx.fillStyle(parseInt(activeTheme.accentText.replace('#', ''), 16), 1)
    trackFillGfx.fillRoundedRect(trackLeft, trackY - TRACK_H / 2, fillW, TRACK_H, 3)
    cc.add(trackFillGfx)

    // Thumb
    const thumbX = trackLeft + initialValue * trackWidth
    const thumbCircle = this.scene.add
      .arc(thumbX, trackY, THUMB_R, 0, 360, false, parseInt(activeTheme.accentText.replace('#', ''), 16), 1)
      .setScrollFactor(0)
    cc.add(thumbCircle)

    const handle: SliderHandle = {
      trackFillGfx,
      thumbCircle,
      valueText,
      trackLeft,
      trackWidth,
      value: initialValue,
    }

    // Interactive drag zone over the full slider (label + track area)
    const zoneW = trackWidth
    const zoneH = 36
    const zoneX = trackLeft + trackWidth / 2
    const zoneY = rowY + zoneH / 2

    const zone = this.scene.add
      .zone(zoneX, zoneY, zoneW, zoneH)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    cc.add(zone)

    const updateSlider = (screenX: number) => {
      const relX = screenX - trackLeft
      const v = Math.max(0, Math.min(1, relX / trackWidth))
      handle.value = v
      // Update fill
      trackFillGfx.clear()
      const fw = Math.max(0, v * trackWidth)
      trackFillGfx.fillStyle(parseInt(activeTheme.accentText.replace('#', ''), 16), 1)
      trackFillGfx.fillRoundedRect(trackLeft, trackY - TRACK_H / 2, fw, TRACK_H, 3)
      // Update thumb
      thumbCircle.setPosition(trackLeft + v * trackWidth, trackY)
      // Update label
      valueText.setText(`${Math.round(v * 100)}%`)
      onChange(v)
    }

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      updateSlider(ptr.x)
      this._startDrag(updateSlider)
    })
  }

  // ---------------------------------------------------------------------------
  // Drag handling (scene-level pointer move/up)
  // ---------------------------------------------------------------------------

  private _startDrag(updateFn: (x: number) => void): void {
    // Remove any previous drag listeners
    this._removeDragListeners()

    this._activeDrag = updateFn

    this._onPointerMove = (ptr: Phaser.Input.Pointer) => {
      if (ptr.isDown && this._activeDrag) {
        this._activeDrag(ptr.x)
      }
    }
    this._onPointerUp = () => {
      this._activeDrag = null
    }

    this.scene.input.on('pointermove', this._onPointerMove)
    this.scene.input.on('pointerup', this._onPointerUp)
  }

  private _removeDragListeners(): void {
    if (this._onPointerMove) {
      this.scene.input.off('pointermove', this._onPointerMove)
      this._onPointerMove = null
    }
    if (this._onPointerUp) {
      this.scene.input.off('pointerup', this._onPointerUp)
      this._onPointerUp = null
    }
    this._activeDrag = null
  }
}
