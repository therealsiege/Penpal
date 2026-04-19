// ---------------------------------------------------------------------------
// settings-menu.ts
// In-game settings overlay — volumes, theme, keybinds.
//
// Opened with ESC when no other overlay is active; closed with ESC or the
// X button.  All settings persist to localStorage.
//
// Sections:
//   AUDIO   — master + per-channel (ambient / sfx / ui / music) sliders
//   DISPLAY — dark / light theme selector
//   CONTROLS — keybind reference (two-column)
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { audioManager } from './audio-manager'
import type { ChannelName } from './audio-manager'
import { activeTheme, THEMES, setActiveTheme } from './office-theme'
import type { ThemeName } from './office-theme'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PANEL_W    = 420
const TRACK_W    = 210
const TRACK_H    = 5
const HANDLE_R   = 7
const ROW_H      = 40
const LABEL_W    = 72
const SECTION_GAP = 14

// Accent color for track fill + handle stroke
const ACCENT = 0x3b82f6

// ---------------------------------------------------------------------------
// Pointer-handler record (for cleanup)
// ---------------------------------------------------------------------------

interface PointerHandler {
  event: string
  fn: (...args: unknown[]) => void
}

// ---------------------------------------------------------------------------
// SettingsMenu
// ---------------------------------------------------------------------------

export class SettingsMenu {
  private _scene: Phaser.Scene
  private _container: Phaser.GameObjects.Container | null = null
  private _visible = false
  private _pointerHandlers: PointerHandler[] = []

  /**
   * Injected by OfficeScene — called when the user changes the theme so the
   * scene can redraw its background/rooms with the new palette.
   */
  private _onThemeChange: ((theme: ThemeName) => void) | null = null

  get isVisible(): boolean { return this._visible }

  constructor(scene: Phaser.Scene, onThemeChange?: (theme: ThemeName) => void) {
    this._scene = scene
    this._onThemeChange = onThemeChange ?? null
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  show(): void {
    if (this._visible) return
    this._visible = true
    audioManager.panelOpen()
    this._build()
  }

  hide(): void {
    if (!this._visible) return
    this._visible = false
    audioManager.panelClose()
    this._teardownPointerHandlers()
    const overlay = this._container
    this._container = null
    if (overlay) {
      this._scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => { try { overlay.destroy() } catch { /* already gone */ } },
      })
    }
  }

  toggle(): void {
    this._visible ? this.hide() : this.show()
  }

  destroy(): void {
    this._teardownPointerHandlers()
    this._container?.destroy()
    this._container = null
    this._visible = false
  }

  // -------------------------------------------------------------------------
  // Build — constructs the full overlay fresh each time it opens.
  //         On theme change the overlay rebuilds itself in-place.
  // -------------------------------------------------------------------------

  private _build(): void {
    const { width: W, height: H } = this._scene.scale

    // Estimated panel height — dynamic based on content rows
    const AUDIO_ROWS = 5  // master + 4 channels
    const PANEL_H =
      56 +                               // title area
      SECTION_GAP + 14 +                 // AUDIO section header
      AUDIO_ROWS * ROW_H + 4 +           // audio sliders
      SECTION_GAP + 14 +                 // DISPLAY section header
      48 + SECTION_GAP +                 // theme buttons
      SECTION_GAP + 14 +                 // CONTROLS section header
      8 * 18 + 16                        // keybind grid rows (8 rows × 2 cols = 16 entries)

    const panelX = W / 2
    const panelY = H / 2

    const ct = this._scene.add.container(0, 0).setDepth(10002).setScrollFactor(0)
    this._container = ct

    // ── Backdrop ──────────────────────────────────────────────────────────
    ct.add(
      this._scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setScrollFactor(0),
    )

    // ── Panel background ──────────────────────────────────────────────────
    const panelGfx = this._scene.add.graphics().setScrollFactor(0)
    panelGfx.fillStyle(activeTheme.panelBg, 1)
    panelGfx.fillRoundedRect(panelX - PANEL_W / 2, panelY - PANEL_H / 2, PANEL_W, PANEL_H, 12)
    panelGfx.lineStyle(1.5, activeTheme.panelStroke, 1)
    panelGfx.strokeRoundedRect(panelX - PANEL_W / 2, panelY - PANEL_H / 2, PANEL_W, PANEL_H, 12)
    // Accent top line
    panelGfx.lineStyle(2, ACCENT, 0.55)
    panelGfx.lineBetween(
      panelX - PANEL_W / 2 + 12, panelY - PANEL_H / 2,
      panelX + PANEL_W / 2 - 12, panelY - PANEL_H / 2,
    )
    ct.add(panelGfx)

    // ── Title ─────────────────────────────────────────────────────────────
    ct.add(
      this._scene.add.text(panelX, panelY - PANEL_H / 2 + 16, 'Settings', {
        fontSize: scaledFontSize(13),
        fontStyle: 'bold',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        resolution: 2,
      }).setOrigin(0.5, 0).setScrollFactor(0),
    )

    // ── Close button (✕) top-right ────────────────────────────────────────
    const closeBtn = this._scene.add.text(
      panelX + PANEL_W / 2 - 16,
      panelY - PANEL_H / 2 + 16,
      '✕',
      {
        fontSize: scaledFontSize(12),
        color: activeTheme.subtleText,
        fontFamily: 'monospace',
        resolution: 2,
      },
    ).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true })
    closeBtn.on('pointerover', () => closeBtn.setColor('#ef4444'))
    closeBtn.on('pointerout',  () => closeBtn.setColor(activeTheme.subtleText))
    closeBtn.on('pointerdown', () => this.hide())
    ct.add(closeBtn)

    // ── Title divider ─────────────────────────────────────────────────────
    const titleDiv = this._scene.add.graphics().setScrollFactor(0)
    titleDiv.lineStyle(1, activeTheme.panelStroke, 0.6)
    titleDiv.lineBetween(
      panelX - PANEL_W / 2 + 16, panelY - PANEL_H / 2 + 44,
      panelX + PANEL_W / 2 - 16, panelY - PANEL_H / 2 + 44,
    )
    ct.add(titleDiv)

    // ── Build sections ────────────────────────────────────────────────────
    let curY = panelY - PANEL_H / 2 + 52

    // AUDIO
    curY = this._sectionHeader(ct, panelX, curY, 'AUDIO')
    curY = this._buildAudioSection(ct, panelX, curY)

    curY = this._divider(ct, panelX, curY)

    // DISPLAY
    curY = this._sectionHeader(ct, panelX, curY, 'DISPLAY')
    curY = this._buildDisplaySection(ct, panelX, curY)

    curY = this._divider(ct, panelX, curY)

    // CONTROLS
    curY = this._sectionHeader(ct, panelX, curY, 'CONTROLS')
    this._buildControlsSection(ct, panelX, curY)

    // ── Fade in ───────────────────────────────────────────────────────────
    ct.setAlpha(0)
    this._scene.tweens.add({ targets: ct, alpha: 1, duration: 200, ease: 'Quad.easeOut' })
  }

  // -------------------------------------------------------------------------
  // Section helpers
  // -------------------------------------------------------------------------

  private _sectionHeader(
    ct: Phaser.GameObjects.Container,
    panelX: number,
    y: number,
    label: string,
  ): number {
    ct.add(
      this._scene.add.text(panelX - PANEL_W / 2 + 16, y, label, {
        fontSize: scaledFontSize(8),
        fontStyle: 'bold',
        color: '#3b82f6',
        fontFamily: 'system-ui, monospace',
        resolution: 2,
      }).setScrollFactor(0),
    )
    return y + 16
  }

  private _divider(
    ct: Phaser.GameObjects.Container,
    panelX: number,
    y: number,
  ): number {
    y += SECTION_GAP * 0.5
    const g = this._scene.add.graphics().setScrollFactor(0)
    g.lineStyle(1, activeTheme.panelStroke, 0.35)
    g.lineBetween(panelX - PANEL_W / 2 + 16, y, panelX + PANEL_W / 2 - 16, y)
    ct.add(g)
    return y + SECTION_GAP * 0.5
  }

  // -------------------------------------------------------------------------
  // AUDIO section — one slider per row
  // -------------------------------------------------------------------------

  private _buildAudioSection(
    ct: Phaser.GameObjects.Container,
    panelX: number,
    startY: number,
  ): number {
    const labelX  = panelX - PANEL_W / 2 + 16
    const trackX  = labelX + LABEL_W + 8
    const rows: { label: string; value: () => number; onChange: (v: number) => void }[] = [
      {
        label:    'Master',
        value:    () => audioManager.masterVolume,
        onChange: (v) => audioManager.setMasterVolume(v),
      },
      {
        label:    'Ambient',
        value:    () => audioManager.getChannelVolume('ambient' as ChannelName),
        onChange: (v) => audioManager.setChannelVolume('ambient' as ChannelName, v),
      },
      {
        label:    'SFX',
        value:    () => audioManager.getChannelVolume('sfx' as ChannelName),
        onChange: (v) => audioManager.setChannelVolume('sfx' as ChannelName, v),
      },
      {
        label:    'UI',
        value:    () => audioManager.getChannelVolume('ui' as ChannelName),
        onChange: (v) => audioManager.setChannelVolume('ui' as ChannelName, v),
      },
      {
        label:    'Music',
        value:    () => audioManager.getChannelVolume('music' as ChannelName),
        onChange: (v) => audioManager.setChannelVolume('music' as ChannelName, v),
      },
    ]

    let y = startY
    for (const row of rows) {
      this._buildSlider(ct, labelX, trackX, y, row.label, row.value(), row.onChange)
      y += ROW_H
    }
    return y + 4
  }

  // -------------------------------------------------------------------------
  // Slider widget
  // -------------------------------------------------------------------------

  private _buildSlider(
    ct: Phaser.GameObjects.Container,
    labelX: number,
    trackX: number,
    rowY: number,
    label: string,
    initial: number,
    onChange: (v: number) => void,
  ): void {
    const midY = rowY + ROW_H / 2

    // Label
    ct.add(
      this._scene.add.text(labelX, midY, label, {
        fontSize: scaledFontSize(10),
        color: activeTheme.subtleText,
        fontFamily: 'system-ui, sans-serif',
        resolution: 2,
      }).setOrigin(0, 0.5).setScrollFactor(0),
    )

    // Percentage text
    const valText = this._scene.add.text(trackX + TRACK_W + 10, midY, _pct(initial), {
      fontSize: scaledFontSize(9),
      color: '#f1f5f9',
      fontFamily: 'system-ui, monospace',
      resolution: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0)
    ct.add(valText)

    // Track + handle graphics
    const gfx = this._scene.add.graphics().setScrollFactor(0)
    ct.add(gfx)

    let val = initial
    const redraw = (v: number) => {
      val = v
      gfx.clear()
      // Track background
      gfx.fillStyle(activeTheme.panelStroke, 1)
      gfx.fillRoundedRect(trackX, midY - TRACK_H / 2, TRACK_W, TRACK_H, 3)
      // Track fill
      if (v > 0) {
        gfx.fillStyle(ACCENT, 1)
        gfx.fillRoundedRect(trackX, midY - TRACK_H / 2, Math.max(6, TRACK_W * v), TRACK_H, 3)
      }
      // Handle circle
      gfx.fillStyle(0xffffff, 1)
      gfx.fillCircle(trackX + TRACK_W * v, midY, HANDLE_R)
      gfx.lineStyle(1.5, ACCENT, 0.9)
      gfx.strokeCircle(trackX + TRACK_W * v, midY, HANDLE_R)
    }
    redraw(initial)

    // Interactive zone: covers track width + handle overhang on both sides
    const zoneH = TRACK_H + HANDLE_R * 2 + 8
    const zone = this._scene.add.zone(
      trackX - HANDLE_R, midY - zoneH / 2,
      TRACK_W + HANDLE_R * 2, zoneH,
    ).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0)
    ct.add(zone)

    const applyX = (screenX: number) => {
      const v = Phaser.Math.Clamp((screenX - trackX) / TRACK_W, 0, 1)
      if (v !== val) { redraw(v); valText.setText(_pct(v)); onChange(v) }
    }

    let dragging = false

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => { dragging = true; applyX(ptr.x) })
    zone.on('pointermove', (ptr: Phaser.Input.Pointer) => { if (ptr.isDown) applyX(ptr.x) })

    // Scene-level move/up so dragging outside the zone still works
    const moveH = (ptr: Phaser.Input.Pointer) => { if (dragging && ptr.isDown) applyX(ptr.x) }
    const upH   = () => { dragging = false }
    this._scene.input.on('pointermove', moveH)
    this._scene.input.on('pointerup', upH)
    this._pointerHandlers.push({ event: 'pointermove', fn: moveH as (...args: unknown[]) => void })
    this._pointerHandlers.push({ event: 'pointerup',   fn: upH   as (...args: unknown[]) => void })
  }

  // -------------------------------------------------------------------------
  // DISPLAY section — theme selector buttons
  // -------------------------------------------------------------------------

  private _buildDisplaySection(
    ct: Phaser.GameObjects.Container,
    panelX: number,
    y: number,
  ): number {
    const themes: { name: ThemeName; label: string }[] = [
      { name: 'dark',  label: 'Dark'  },
      { name: 'light', label: 'Light' },
    ]
    const BTN_W = 96
    const BTN_H = 30
    const GAP   = 10
    const totalW = themes.length * BTN_W + (themes.length - 1) * GAP
    let bx = panelX - totalW / 2

    for (const t of themes) {
      const isActive = activeTheme === THEMES[t.name]
      const btnGfx   = this._scene.add.graphics().setScrollFactor(0)

      const draw = (active: boolean) => {
        btnGfx.clear()
        btnGfx.fillStyle(active ? ACCENT : activeTheme.panelStroke, 1)
        btnGfx.fillRoundedRect(bx, y, BTN_W, BTN_H, 6)
        if (!active) {
          btnGfx.lineStyle(1, activeTheme.panelStroke, 0.7)
          btnGfx.strokeRoundedRect(bx, y, BTN_W, BTN_H, 6)
        }
      }
      draw(isActive)
      ct.add(btnGfx)

      ct.add(
        this._scene.add.text(bx + BTN_W / 2, y + BTN_H / 2, t.label, {
          fontSize: scaledFontSize(10),
          fontStyle: isActive ? 'bold' : 'normal',
          color: isActive ? '#ffffff' : activeTheme.subtleText,
          fontFamily: 'system-ui, sans-serif',
          resolution: 2,
        }).setOrigin(0.5).setScrollFactor(0),
      )

      // Hit zone
      const hz = this._scene.add.zone(bx, y, BTN_W, BTN_H)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
      hz.on('pointerover', () => { if (!isActive) draw(true) })
      hz.on('pointerout',  () => { draw(activeTheme === THEMES[t.name]) })
      hz.on('pointerdown', () => {
        if (activeTheme !== THEMES[t.name]) {
          setActiveTheme(t.name)
          try { localStorage.setItem('penny-settings-theme', t.name) } catch { /* sandboxed */ }
          this._onThemeChange?.(t.name)
          // Rebuild settings menu so button states refresh with new theme colors
          const old = this._container
          this._teardownPointerHandlers()
          this._container = null
          if (old) { try { old.destroy() } catch { /* gone */ } }
          this._build()
        }
      })
      ct.add(hz)

      bx += BTN_W + GAP
    }

    return y + BTN_H + 10
  }

  // -------------------------------------------------------------------------
  // CONTROLS section — two-column keybind reference grid
  // -------------------------------------------------------------------------

  private _buildControlsSection(
    ct: Phaser.GameObjects.Container,
    panelX: number,
    startY: number,
  ): void {
    const keybinds: [string, string][] = [
      ['TAB',     'Cycle agents'],
      ['ENTER',   'Open agent'],
      ['ESC',     'Settings / close'],
      ['F',       'Zoom fit'],
      ['R',       'Reset camera'],
      ['SPACE',   'Auto-pan'],
      ['+  /  -', 'Zoom in / out'],
      ['H  /  ?', 'Shortcuts'],
      ['M',       'Mute sound'],
      ['T',       'Toggle theme'],
      ['N',       'Cycle day/night'],
      ['O',       'Ops board'],
      ['Q',       'Quest log'],
      ['A',       'Achievements'],
      ['L',       'Leaderboard'],
      ['`',       'Debug overlay'],
    ]

    const ROW_PX   = 17
    const COL_W    = (PANEL_W - 32) / 2
    const leftX    = panelX - PANEL_W / 2 + 16
    const rightX   = leftX + COL_W
    const KEY_OFF  = 0
    const DESC_OFF = 52

    for (let i = 0; i < keybinds.length; i++) {
      const [key, desc] = keybinds[i]
      const col = i % 2
      const row = Math.floor(i / 2)
      const kx  = (col === 0 ? leftX : rightX) + KEY_OFF
      const dx  = (col === 0 ? leftX : rightX) + DESC_OFF
      const ky  = startY + row * ROW_PX

      ct.add(
        this._scene.add.text(kx, ky, key, {
          fontSize: scaledFontSize(8),
          color: '#5a6a7a',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          resolution: 2,
        }).setScrollFactor(0),
      )
      ct.add(
        this._scene.add.text(dx, ky, desc, {
          fontSize: scaledFontSize(8),
          color: activeTheme.subtleText,
          fontFamily: 'monospace',
          resolution: 2,
        }).setScrollFactor(0),
      )
    }
  }

  // -------------------------------------------------------------------------
  // Pointer handler cleanup
  // -------------------------------------------------------------------------

  private _teardownPointerHandlers(): void {
    for (const { event, fn } of this._pointerHandlers) {
      this._scene.input.off(event, fn)
    }
    this._pointerHandlers = []
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a [0, 1] value as a percentage string, e.g. '75%' */
function _pct(v: number): string {
  return Math.round(v * 100) + '%'
}

// ---------------------------------------------------------------------------
// Load persisted theme on startup (called by SettingsMenu static helper)
// ---------------------------------------------------------------------------

/** Load and apply the persisted theme from localStorage.  Call once at startup. */
export function loadPersistedTheme(): ThemeName | null {
  try {
    const raw = localStorage.getItem('penny-settings-theme')
    if (raw === 'dark' || raw === 'light') {
      setActiveTheme(raw as ThemeName)
      return raw as ThemeName
    }
  } catch { /* localStorage unavailable */ }
  return null
}
