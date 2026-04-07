import { BaseScene } from './base-scene'
import { EventBus, EVENTS } from './events'
import { SCENE_KEYS } from './office-asset-keys'
import { scaledFontSize } from './office-constants'

// ---------------------------------------------------------------------------
// CampusScene — top-level building selector
// ---------------------------------------------------------------------------
// Shows two building panels (Duder HQ and Pod Foundry) with live agent/pod
// counts. Clicking a building navigates into the corresponding scene.
// ---------------------------------------------------------------------------

const PANEL_W = 240
const PANEL_H = 300
const PANEL_GAP = 40

export class CampusScene extends BaseScene {
  private agentCount = 0
  private podCount = 0
  private agentLabel!: Phaser.GameObjects.Text
  private podLabel!: Phaser.GameObjects.Text

  constructor() {
    super({ key: SCENE_KEYS.CAMPUS })
  }

  onPreload(): void {
    // All assets loaded by BootScene
  }

  onCreate(): void {
    const { width: camW, height: camH } = this.cameras.main

    // Fade in from black
    this.cameras.main.fadeIn(300, 0, 0, 0)

    // Center two panels horizontally
    const totalW = PANEL_W * 2 + PANEL_GAP
    const startX = camW / 2 - totalW / 2
    const panelY = camH * 0.4

    // --- Duder HQ panel ---
    this.createBuildingPanel(
      startX + PANEL_W / 2,
      panelY,
      'Duder HQ',
      () => `${this.agentCount} agents`,
      (label) => { this.agentLabel = label },
      () => this.enterDuderHQ(),
    )

    // --- Pod Foundry panel ---
    this.createBuildingPanel(
      startX + PANEL_W + PANEL_GAP + PANEL_W / 2,
      panelY,
      'Pod Foundry',
      () => `${this.podCount} pods`,
      (label) => { this.podLabel = label },
      () => this.enterPodFoundry(),
    )

    // Listen for count updates from OfficeScene / IPC
    EventBus.on(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)

    // Listen for wake requests (returning from a building)
    EventBus.on(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)

    // Clean up listeners when scene shuts down
    this.events.on('shutdown', () => {
      EventBus.off(EVENTS.CAMPUS_COUNTS_UPDATED, this.onCountsUpdated)
      EventBus.off(EVENTS.NAVIGATE_CAMPUS, this.onNavigateCampus)
    })
  }

  onUpdate(): void {
    // No per-frame logic needed
  }

  // -------------------------------------------------------------------------
  // Panel builder
  // -------------------------------------------------------------------------

  private createBuildingPanel(
    cx: number,
    cy: number,
    title: string,
    countText: () => string,
    setLabelRef: (label: Phaser.GameObjects.Text) => void,
    onPress: () => void,
  ): void {
    const theme = this.theme

    // Panel background
    const bg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, theme.panelBg)
      .setStrokeStyle(2, theme.panelStroke)

    // Border highlight rect (initially matches panelStroke)
    const border = this.add.rectangle(cx, cy, PANEL_W, PANEL_H)
      .setStrokeStyle(2, theme.panelStroke)
      .setFillStyle()

    // Building name
    this.add.text(cx, cy - 40, title, {
      fontSize: scaledFontSize(18),
      fontFamily: 'monospace',
      color: theme.headerText,
      resolution: 2,
    }).setOrigin(0.5)

    // Count badge
    const label = this.add.text(cx, cy + 20, countText(), {
      fontSize: scaledFontSize(13),
      fontFamily: 'monospace',
      color: theme.subtleText,
      resolution: 2,
    }).setOrigin(0.5)

    setLabelRef(label)

    // Interactive zone
    const hitZone = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    hitZone.on('pointerover', () => {
      border.setStrokeStyle(2, theme.doorFrame)
      this.tweens.add({
        targets: [bg, border, hitZone],
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 120,
        ease: 'Power1',
      })
    })

    hitZone.on('pointerout', () => {
      border.setStrokeStyle(2, theme.panelStroke)
      this.tweens.add({
        targets: [bg, border, hitZone],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Power1',
      })
    })

    hitZone.on('pointerup', () => {
      this.cameras.main.flash(150)
      onPress()
    })
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  private enterDuderHQ(): void {
    this.scene.sleep(SCENE_KEYS.CAMPUS)
    if (this.scene.isSleeping(SCENE_KEYS.OFFICE)) {
      this.scene.wake(SCENE_KEYS.OFFICE)
    } else {
      this.scene.start(SCENE_KEYS.OFFICE)
    }
  }

  private enterPodFoundry(): void {
    // Pod Foundry scene not yet implemented — enter Duder HQ as stub
    this.enterDuderHQ()
  }

  // -------------------------------------------------------------------------
  // EventBus handlers (arrow functions for stable `this` binding)
  // -------------------------------------------------------------------------

  private onCountsUpdated = (agents: number, pods: number): void => {
    this.agentCount = agents
    this.podCount = pods
    if (this.agentLabel?.active) this.agentLabel.setText(`${agents} agents`)
    if (this.podLabel?.active) this.podLabel.setText(`${pods} pods`)
  }

  private onNavigateCampus = (): void => {
    if (this.scene.isSleeping(SCENE_KEYS.CAMPUS)) {
      this.scene.wake(SCENE_KEYS.CAMPUS)
    }
  }
}
