// ---------------------------------------------------------------------------
// lab-workstation.ts
// LabWorkstationFactory — lab desk furniture variant for workstation creation.
// Provides lab-specific signature items and desk props using LAB_PROPS sheet.
// Issue #127: Lab desk furniture / workstation variants.
// ---------------------------------------------------------------------------

import { SPRITESHEET_KEYS, LAB_PROP_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Lab signature items — deterministic per-agent, drawn from LAB_PROPS sheet
// ---------------------------------------------------------------------------

/** Ordered list of lab signature item frames from the LAB_PROPS spritesheet. */
export const LAB_SIGNATURE_ITEMS = Object.freeze([
  LAB_PROP_FRAMES.MICROSCOPE,
  LAB_PROP_FRAMES.BEAKER,
  LAB_PROP_FRAMES.PETRI_DISH,
  LAB_PROP_FRAMES.TABLET,
  LAB_PROP_FRAMES.CLIPBOARD,
  LAB_PROP_FRAMES.SCALE,
] as const)

/** Human-readable personality trait names for each lab signature item. */
export const LAB_SIGNATURE_ITEM_NAMES: Record<number, string> = {
  [LAB_PROP_FRAMES.MICROSCOPE]: 'Researcher',
  [LAB_PROP_FRAMES.BEAKER]:    'Chemist',
  [LAB_PROP_FRAMES.PETRI_DISH]: 'Biologist',
  [LAB_PROP_FRAMES.TABLET]:    'Data Analyst',
  [LAB_PROP_FRAMES.CLIPBOARD]: 'Lab Manager',
  [LAB_PROP_FRAMES.SCALE]:     'Metrologist',
}

/** Pick a lab signature item frame based on agent name hash. */
export function getLabSignatureItem(nameHash: number): number {
  return LAB_SIGNATURE_ITEMS[nameHash % LAB_SIGNATURE_ITEMS.length]
}

// ---------------------------------------------------------------------------
// Lab workstation variant type
// ---------------------------------------------------------------------------

export type WorkstationVariant = 'office' | 'lab'

// ---------------------------------------------------------------------------
// LabWorkstationFactory — creates lab-specific desk elements
// ---------------------------------------------------------------------------

/**
 * Provides methods to create lab-specific workstation furniture elements.
 * Used by WorkstationFactory when the workstation variant is 'lab'.
 *
 * The lab variant replaces:
 *   - Office chair → Lab stool (LAB_PROP_FRAMES.STOOL)
 *   - Office monitor → Console screen (LAB_PROP_FRAMES.CONSOLE_SCREEN)
 *   - Office signature items → Lab items (microscope, beaker, petri dish, etc.)
 *   - Adds desk drawer prop (LAB_PROP_FRAMES.DESK_DRAW)
 */
export class LabWorkstationFactory {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Whether the lab furniture spritesheet is available. */
  get isAvailable(): boolean {
    return this.scene.textures.exists(SPRITESHEET_KEYS.LAB_PROPS)
  }

  /**
   * Create a lab stool sprite at the given position.
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createStool(x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.STOOL)
      .setScale(0.22)
      .setAlpha(0.85)
  }

  /**
   * Create a lab console screen sprite at the given position.
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createConsoleScreen(x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.CONSOLE_SCREEN)
      .setScale(0.22)
  }

  /**
   * Create a free-standing screen sprite (alternative monitor style).
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createFreeStandingScreen(x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.FREE_STANDING_SCREEN)
      .setScale(0.22)
  }

  /**
   * Create a desk drawer prop sprite at the given position.
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createDeskDrawer(x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.DESK_DRAW)
      .setScale(0.20)
      .setAlpha(0.8)
  }

  /**
   * Create a lab signature item sprite based on agent's name hash.
   * Uses microscope, beaker, petri dish, tablet, clipboard, or scale.
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createSignatureItem(x: number, y: number, nameHash: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    const frame = getLabSignatureItem(nameHash)
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, frame)
      .setScale(0.20)
      .setAlpha(0.65)
  }

  /**
   * Create a lab keyboard sprite at the given position.
   * Returns null if the LAB_PROPS sheet is not loaded.
   */
  createKeyboard(x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (!this.isAvailable) return null
    return this.scene.add.sprite(x, y, SPRITESHEET_KEYS.LAB_PROPS, LAB_PROP_FRAMES.KEYBOARD)
      .setScale(0.18)
      .setAlpha(0.8)
  }

  /**
   * Get the human-readable name for a lab signature item frame.
   */
  static getSignatureItemName(frame: number): string {
    return LAB_SIGNATURE_ITEM_NAMES[frame] ?? 'Scientist'
  }
}
