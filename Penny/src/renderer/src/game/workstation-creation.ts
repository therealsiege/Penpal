// ---------------------------------------------------------------------------
// workstation-creation.ts
// WorkstationFactory — desk/chair/monitor/sprite creation, layout, and cleanup.
// Extracted from office-workstation.ts.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { SPRITESHEET_KEYS, ICON_FRAMES, ITEM_FRAMES, STATUS_DOT_FRAMES, LEGO_FRAMES, PET_COUNT, PET_FACE_FRAMES, EFFECT_ANIM_KEYS, IMAGE_KEYS } from './office-asset-keys'
import { fadeInUp, fadeOutDown, pulse } from './juice-utils'
import { EventBus, EVENTS } from './events'
import type { AgentState } from '../types'
import type { WorkstationSprite, Room } from './office-types'
import { activeTheme } from './office-theme'
import { AnimatedBar } from './animated-bar'
import { computeRoomLayout, detectRoomType } from './office-layout'
import {
  FRAME_CHAIR_DARK,
  FRAME_MONITOR,
  CHAR_SCALE,
  WORKSTATION_W,
  WORKSTATION_H,
  WS_CHAIR_Y,
  WS_SPRITE_Y,
  WS_DESK_Y,
  WS_MONITOR_Y,
  WS_NAME_Y,
  WS_DOT_GAP,
  COLOR_DESK_BODY,
  COLOR_DESK_TOP,
} from './office-constants'
import type { WorkstationHost } from './office-workstation'
import { isDeskItemUnlocked, isFlairUnlocked, getRankColor } from './cosmetic-tiers'

// ---------------------------------------------------------------------------
// Signature item — deterministic per-agent personality item on desk
// ---------------------------------------------------------------------------

/** Map a name hash to a unique desk item frame from the GAME_ITEMS sheet. */
function getSignatureItem(nameHash: number): number {
  const items = [
    ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.BOOK, ITEM_FRAMES.HEADPHONES,
    ITEM_FRAMES.PIZZA, ITEM_FRAMES.PAINT_PALETTE, ITEM_FRAMES.WRENCH,
    ITEM_FRAMES.BEER, ITEM_FRAMES.CAMERA, ITEM_FRAMES.DONUT,
    ITEM_FRAMES.FIRST_AID, ITEM_FRAMES.PHONE, ITEM_FRAMES.MONITOR,
  ]
  return items[nameHash % items.length]
}

/** Human-readable personality trait names for each signature item. */
export const SIGNATURE_ITEM_NAMES: Record<number, string> = {
  [ITEM_FRAMES.COFFEE_CUP]:    'Coffee Lover',
  [ITEM_FRAMES.BOOK]:          'Bookworm',
  [ITEM_FRAMES.HEADPHONES]:    'Music Fan',
  [ITEM_FRAMES.PIZZA]:         'Pizza Fiend',
  [ITEM_FRAMES.PAINT_PALETTE]: 'Creative Soul',
  [ITEM_FRAMES.WRENCH]:        'Tinkerer',
  [ITEM_FRAMES.BEER]:          'Social Butterfly',
  [ITEM_FRAMES.CAMERA]:        'Shutterbug',
  [ITEM_FRAMES.DONUT]:         'Snack Enthusiast',
  [ITEM_FRAMES.FIRST_AID]:     'Team Medic',
  [ITEM_FRAMES.PHONE]:         'Always Connected',
  [ITEM_FRAMES.MONITOR]:       'Screen Addict',
}

// ---------------------------------------------------------------------------
// Room-type → desk item mappings — different rooms feel distinct
// ---------------------------------------------------------------------------

const ROOM_TYPE_ITEMS: Record<string, number[]> = {
  'server-room':    [ITEM_FRAMES.WRENCH, ITEM_FRAMES.PHONE, ITEM_FRAMES.FIRST_AID],
  'design-studio':  [ITEM_FRAMES.PAINT_PALETTE, ITEM_FRAMES.CAMERA, ITEM_FRAMES.BOOK],
  'game-den':       [ITEM_FRAMES.PIZZA, ITEM_FRAMES.BEER, ITEM_FRAMES.HEADPHONES],
  'mobile-lab':     [ITEM_FRAMES.PHONE, ITEM_FRAMES.CAMERA, ITEM_FRAMES.COFFEE_CUP],
  'creative-suite': [ITEM_FRAMES.PAINT_PALETTE, ITEM_FRAMES.BOOK, ITEM_FRAMES.CAMERA],
  'ops-center':     [ITEM_FRAMES.WRENCH, ITEM_FRAMES.FIRST_AID, ITEM_FRAMES.MONITOR],
  'qa-lab':         [ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.BOOK, ITEM_FRAMES.WRENCH],
  'default':        [ITEM_FRAMES.COFFEE_CUP, ITEM_FRAMES.BOOK, ITEM_FRAMES.DONUT],
}

/** Pick a room-themed item frame based on agent nameHash and room type. */
function getRoomTypeItem(roomType: string, nameHash: number): number {
  const items = ROOM_TYPE_ITEMS[roomType] ?? ROOM_TYPE_ITEMS['default']
  return items[nameHash % items.length]
}

// ---------------------------------------------------------------------------
// Room-type → header icon mappings — accent icon next to room header text
// ---------------------------------------------------------------------------

export const ROOM_HEADER_ITEM: Record<string, number> = {
  'server-room':    ITEM_FRAMES.WRENCH,
  'design-studio':  ITEM_FRAMES.PAINT_PALETTE,
  'game-den':       ITEM_FRAMES.HEADPHONES,
  'mobile-lab':     ITEM_FRAMES.PHONE,
  'creative-suite': ITEM_FRAMES.CAMERA,
  'ops-center':     ITEM_FRAMES.FIRST_AID,
  'qa-lab':         ITEM_FRAMES.COFFEE_CUP,
  'standard':       ITEM_FRAMES.MONITOR,
}

// ---------------------------------------------------------------------------
// WorkstationFactory
// ---------------------------------------------------------------------------

export class WorkstationFactory {
  private scene: Phaser.Scene
  private host: WorkstationHost

  /** Callback to the parent OfficeWorkstations.updateWorkstation — needed
   *  because createWorkstation must call updateWorkstation at the end to
   *  apply initial state, but we cannot import OfficeWorkstations here
   *  without creating a circular dependency. */
  private updateCallback: (ws: WorkstationSprite, agent: AgentState) => void
  /** Callback to OfficeWorkstations.restoreDeskStroke — used in the
   *  pointerout handler wired during creation. */
  private restoreDeskStrokeCallback: (ws: WorkstationSprite) => void

  constructor(
    scene: Phaser.Scene,
    host: WorkstationHost,
    updateCallback: (ws: WorkstationSprite, agent: AgentState) => void,
    restoreDeskStrokeCallback: (ws: WorkstationSprite) => void,
  ) {
    this.scene = scene
    this.host = host
    this.updateCallback = updateCallback
    this.restoreDeskStrokeCallback = restoreDeskStrokeCallback
  }

  // ---------------------------------------------------------------------------
  // createWorkstation — creates all desk/chair/monitor/sprite objects
  // ---------------------------------------------------------------------------

  create(room: Room, agent: AgentState): WorkstationSprite {
    const wsContainer = this.scene.add.container(0, 0)
    room.container.add(wsContainer)

    let chairSprite: Phaser.GameObjects.Sprite | null = null
    if (this.host.officeTilesLoaded) {
      chairSprite = this.scene.add.sprite(0, WS_CHAIR_Y + 4, SPRITESHEET_KEYS.OFFICE, FRAME_CHAIR_DARK)
      chairSprite.setScale(0.44).setAlpha(0.85)
      wsContainer.add(chairSprite)
    } else {
      wsContainer.add(this.scene.add.rectangle(0, WS_CHAIR_Y, 18, 13, activeTheme.deskBody).setStrokeStyle(1, activeTheme.deskTop, 0.6))
    }

    const deskBody = this.scene.add.rectangle(0, WS_DESK_Y, 80, 21, COLOR_DESK_BODY).setStrokeStyle(1, activeTheme.deskStrokeIdle, 0.5)
    wsContainer.add(deskBody)

    const deskTop = this.scene.add.rectangle(0, WS_DESK_Y - 8, 77, 3, COLOR_DESK_TOP)
    wsContainer.add(deskTop)

    let monitorSprite: Phaser.GameObjects.Sprite | null = null
    let monitorGlowFx: Phaser.FX.Glow | undefined
    let screenLines: Phaser.GameObjects.Graphics | undefined
    let screenTween: Phaser.Tweens.Tween | undefined
    const screenState = { mode: 'idle' }
    if (this.host.officeTilesLoaded) {
      monitorSprite = this.scene.add.sprite(0, WS_MONITOR_Y, SPRITESHEET_KEYS.OFFICE, FRAME_MONITOR).setScale(0.42)
      wsContainer.add(monitorSprite)
      monitorGlowFx = monitorSprite.postFX.addGlow(0x0ea5e9, 0, 0, false, 0.1, 16)
      // Scrolling screen content lines
      screenLines = this.scene.add.graphics().setVisible(false)
      wsContainer.add(screenLines)
      const LINE_COLORS_WORK = [0x0ea5e9, 0x34d399]
      const LINE_COLORS_PLAN = [0xa78bfa, 0xc4b5fd]
      const lineWidths = Array.from({ length: 4 }, () => 6 + Math.random() * 6)
      const lineColorsWork = lineWidths.map(() => LINE_COLORS_WORK[Math.floor(Math.random() * LINE_COLORS_WORK.length)])
      const lineColorsPlan = lineWidths.map(() => LINE_COLORS_PLAN[Math.floor(Math.random() * LINE_COLORS_PLAN.length)])
      const planWidths = [10, 7, 9, 5]
      screenTween = this.scene.tweens.addCounter({
        from: 0, to: 1, duration: 1200 + Math.random() * 600, repeat: -1, ease: 'Linear',
        onUpdate: (tw) => {
          if (!screenLines?.active) return
          screenLines.clear()
          const v = tw.getValue()
          const mode = screenState.mode

          if (mode === 'plan') {
            // Document outline — static lines that shift slightly like a bulleted list
            const shift = Math.sin(v * Math.PI * 2) * 0.5
            for (let i = 0; i < 4; i++) {
              const y = WS_MONITOR_Y - 4.5 + i * 3 + shift
              const w = planWidths[i]
              screenLines.fillStyle(lineColorsPlan[i], 0.45)
              screenLines.fillRect(-w / 2 - 1, y, w, 1)
              screenLines.fillStyle(lineColorsPlan[i], 0.6)
              screenLines.fillRect(-w / 2 - 3, y, 1, 1)
            }
          } else if (mode === 'compressing') {
            // Fast scrolling lines + static noise dots
            for (let i = 0; i < 4; i++) {
              const y = WS_MONITOR_Y + ((v * 13 + i * 3.25) % 13) - 6.5
              screenLines.fillStyle(lineColorsWork[i], 0.5)
              screenLines.fillRect(-lineWidths[i] / 2, y, lineWidths[i], 1)
            }
            for (let n = 0; n < 7; n++) {
              const nx = (Math.random() - 0.5) * 12
              const ny = WS_MONITOR_Y - 5 + Math.random() * 10
              screenLines.fillStyle(0xffffff, 0.12 + Math.random() * 0.18)
              screenLines.fillRect(nx, ny, 1, 1)
            }
          } else if (mode === 'idle') {
            // Slow dim screensaver lines
            for (let i = 0; i < 4; i++) {
              const y = WS_MONITOR_Y + ((v * 13 + i * 3.25) % 13) - 6.5
              screenLines.fillStyle(lineColorsWork[i], 0.2)
              screenLines.fillRect(-lineWidths[i] / 2, y, lineWidths[i], 1)
            }
          } else {
            // Working (default) — scrolling colored lines
            for (let i = 0; i < 4; i++) {
              const y = WS_MONITOR_Y + ((v * 13 + i * 3.25) % 13) - 6.5
              screenLines.fillStyle(lineColorsWork[i], 0.5)
              screenLines.fillRect(-lineWidths[i] / 2, y, lineWidths[i], 1)
            }
          }
        },
      })
      screenTween.pause()
    } else {
      wsContainer.add(this.scene.add.rectangle(0, WS_MONITOR_Y, 16, 13, activeTheme.roomFloor).setStrokeStyle(1, activeTheme.deskTop, 0.8))
    }

    // Monitor screen frame overlay — sprite-based outline on the monitor screen area
    let monitorFrame: Phaser.GameObjects.Image | undefined
    if (monitorSprite && this.scene.textures.exists(IMAGE_KEYS.PANEL_OUTLINE)) {
      monitorFrame = this.scene.add.image(0, WS_MONITOR_Y, IMAGE_KEYS.PANEL_OUTLINE)
        .setDisplaySize(14, 10).setAlpha(0.15).setTint(0x0ea5e9).setOrigin(0.5)
      wsContainer.add(monitorFrame)
    }

    // Monitor blurb text — tiny live text overlaid on the monitor screen
    const monitorText = this.scene.add.text(0, WS_MONITOR_Y - 1, '', {
      fontSize: '4px',
      fontFamily: 'monospace',
      color: '#5a6a7a',
      wordWrap: { width: 14, useAdvancedWrap: false },
      resolution: 3,
    }).setOrigin(0.5, 0).setAlpha(0.7).setVisible(false)
    wsContainer.add(monitorText)

    // ── Rank-gated desk items ─────────────────────────────────────────────
    // Desk accessories unlock as agents rank up. The cosmetic-tiers module
    // defines which items appear at each level.
    const agentLevel = agent.xp?.level ?? 1

    // Desk lamp (unlocks at Associate / L4)
    const lampBase = this.scene.add.rectangle(-34, WS_DESK_Y - 2, 6, 3, activeTheme.lampMetal)
    wsContainer.add(lampBase)
    const lampArm = this.scene.add.rectangle(-34, WS_DESK_Y - 8, 1.5, 10, activeTheme.lampMetal)
    wsContainer.add(lampArm)
    const lampShade = this.scene.add.triangle(-34, WS_DESK_Y - 14, -5, 6, 0, -2, 5, 6, activeTheme.lampShade, 0.8)
    wsContainer.add(lampShade)
    const lampLight = this.scene.add.triangle(-34, WS_DESK_Y - 4, -10, 18, 0, 0, 10, 18, activeTheme.lampShade, 0.04)
    wsContainer.add(lampLight)
    const lampVisible = isDeskItemUnlocked(agentLevel, 'lamp')
    lampBase.setVisible(lampVisible)
    lampArm.setVisible(lampVisible)
    lampShade.setVisible(lampVisible)
    lampLight.setVisible(lampVisible)

    // Desk accessories (deterministic per agent name)
    let nameHash = 0
    for (let i = 0; i < agent.config.name.length; i++) {
      nameHash = ((nameHash << 5) - nameHash) + agent.config.name.charCodeAt(i); nameHash |= 0
    }
    nameHash = Math.abs(nameHash)

    // Keyboard (unlocks at Associate / L3)
    const kbVisible = isDeskItemUnlocked(agentLevel, 'keyboard')
    const keyboard = this.scene.add.rectangle(0, WS_DESK_Y + 2, 18, 5, activeTheme.roomFloor).setAlpha(0.8).setVisible(kbVisible)
    wsContainer.add(keyboard)
    const kbLines = this.scene.add.graphics().setVisible(kbVisible)
    kbLines.lineStyle(0.5, activeTheme.deskTop, 0.6)
    for (let r = 0; r < 3; r++) kbLines.lineBetween(-7, WS_DESK_Y + r * 1.5, 7, WS_DESK_Y + r * 1.5)
    wsContainer.add(kbLines)

    // Desk communicator / phone (unlocks at Expert / L7)
    const phoneVisible = isDeskItemUnlocked(agentLevel, 'phone')
    const phoneBody = this.scene.add.rectangle(-30, WS_DESK_Y - 2, 4, 6, activeTheme.deskTop).setVisible(phoneVisible)
    wsContainer.add(phoneBody)
    const phoneScreen = this.scene.add.rectangle(-30, WS_DESK_Y - 5, 3, 2, activeTheme.roomFloor).setVisible(phoneVisible)
    wsContainer.add(phoneScreen)
    const phoneLight = this.scene.add.arc(-28, WS_DESK_Y - 6, 1.5, 0, 360, false, 0x00e5ff, 0).setVisible(phoneVisible)
    wsContainer.add(phoneLight)

    // Sticky note (unlocks at Associate / L3)
    const stickyColors = [0x00e5ff, 0xd4a017, 0xd4a017, 0xa78bfa, 0x00ff88]
    const stickyX = nameHash % 2 === 0 ? 20 : -20
    const stickyVisible = isDeskItemUnlocked(agentLevel, 'sticky')
    const sticky = this.scene.add.rectangle(stickyX, WS_DESK_Y - 6, 7, 6, stickyColors[nameHash % 5], 0.7).setVisible(stickyVisible)
    wsContainer.add(sticky)

    // Pencil holder (unlocks at Lead / L6)
    const extraDecos: Phaser.GameObjects.GameObject[] = []
    if (isDeskItemUnlocked(agentLevel, 'pencil_holder')) {
      const phX = nameHash % 2 === 0 ? -20 : 20
      const cup = this.scene.add.rectangle(phX, WS_DESK_Y - 5, 5, 7, activeTheme.deskTop, 0.7)
      wsContainer.add(cup); extraDecos.push(cup)
      const p1 = this.scene.add.rectangle(phX - 1, WS_DESK_Y - 10, 1, 6, 0xd4a017, 0.6).setAngle(-5)
      wsContainer.add(p1); extraDecos.push(p1)
      const p2 = this.scene.add.rectangle(phX + 1, WS_DESK_Y - 10, 1, 6, 0xef4444, 0.5).setAngle(7)
      wsContainer.add(p2); extraDecos.push(p2)
    }

    // Desk plant (unlocks at Lead / L6)
    let deskPlantLeaf: Phaser.GameObjects.Arc | null = null
    if (isDeskItemUnlocked(agentLevel, 'plant')) {
      const plX = nameHash % 2 === 0 ? -16 : 16
      const pot = this.scene.add.rectangle(plX, WS_DESK_Y - 2, 5, 4, activeTheme.deskTop, 0.7)
      wsContainer.add(pot); extraDecos.push(pot)
      const leaf = this.scene.add.sprite(plX, WS_DESK_Y - 6, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN)
        .setScale(0.22).setAlpha(0.6).setOrigin(0.5) as unknown as Phaser.GameObjects.Sprite & { setFillStyle?: never }
      wsContainer.add(leaf); extraDecos.push(leaf)
      deskPlantLeaf = leaf
    }

    // Desk pet (unlocks at Senior / L5) — composable monster body sprite
    let deskPet: Phaser.GameObjects.Sprite | null = null
    let petEyes: Phaser.GameObjects.Sprite | null = null
    let petMouth: Phaser.GameObjects.Sprite | null = null
    if (isDeskItemUnlocked(agentLevel, 'pet')) {
      const petFrame = nameHash % PET_COUNT
      const petX = 28
      deskPet = this.scene.add.sprite(petX, WS_DESK_Y - 6, SPRITESHEET_KEYS.DESK_PETS, petFrame)
        .setScale(0.42)
        .setAlpha(0.9)
      wsContainer.add(deskPet)
      extraDecos.push(deskPet)

      // Pet face — eyes and mouth overlaid on the body
      if (this.scene.textures.exists(SPRITESHEET_KEYS.DESK_PET_FACES)) {
        const eyeVariants = [PET_FACE_FRAMES.EYES_CUTE, PET_FACE_FRAMES.EYES_WIDE, PET_FACE_FRAMES.EYES_CUTE, PET_FACE_FRAMES.EYES_SLEEPY]
        const mouthVariants = [PET_FACE_FRAMES.MOUTH_HAPPY, PET_FACE_FRAMES.MOUTH_O, PET_FACE_FRAMES.MOUTH_HAPPY, PET_FACE_FRAMES.MOUTH_GRIN]
        const eyeFrame = eyeVariants[nameHash % eyeVariants.length]
        const mouthFrame = mouthVariants[(nameHash >> 2) % mouthVariants.length]

        petEyes = this.scene.add.sprite(petX, WS_DESK_Y - 8, SPRITESHEET_KEYS.DESK_PET_FACES, eyeFrame)
          .setScale(0.65)
          .setAlpha(0.95)
        wsContainer.add(petEyes)
        extraDecos.push(petEyes)

        petMouth = this.scene.add.sprite(petX, WS_DESK_Y - 5, SPRITESHEET_KEYS.DESK_PET_FACES, mouthFrame)
          .setScale(0.65)
          .setAlpha(0.95)
        wsContainer.add(petMouth)
        extraDecos.push(petMouth)
      }
    }

    // Signature item — unique per-agent personality item on the desk surface
    let signatureItemSprite: Phaser.GameObjects.Sprite | null = null
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)) {
      const sigFrame = getSignatureItem(nameHash)
      // Place on the opposite side from the sticky note
      const sigX = -28
      signatureItemSprite = this.scene.add.sprite(sigX, WS_DESK_Y - 12, SPRITESHEET_KEYS.GAME_ITEMS, sigFrame)
        .setScale(0.25)
        .setAlpha(0.65)
      wsContainer.add(signatureItemSprite)
      extraDecos.push(signatureItemSprite)
    }

    // Room-type themed prop — desk item varies by the room's project type
    let roomPropSprite: Phaser.GameObjects.Sprite | null = null
    if (this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ITEMS)) {
      const roomType = detectRoomType(room.cwd ?? '')
      const roomItemFrame = getRoomTypeItem(roomType, nameHash)
      roomPropSprite = this.scene.add.sprite(30, WS_DESK_Y - 4, SPRITESHEET_KEYS.GAME_ITEMS, roomItemFrame)
        .setScale(0.25)
        .setAlpha(0.7)
      wsContainer.add(roomPropSprite)
      extraDecos.push(roomPropSprite)
    }

    // LED underglow strip — color based on rank
    const ledGlow = this.scene.add.graphics()
    const ledColor = isDeskItemUnlocked(agentLevel, 'rgb_underglow') ? getRankColor(agentLevel) : activeTheme.deskStrokeIdle
    ledGlow.fillStyle(ledColor, isDeskItemUnlocked(agentLevel, 'rgb_underglow') ? 0.6 : 0.3)
    ledGlow.fillRoundedRect(-34, WS_DESK_Y + 4, 68, 2, 1)
    wsContainer.add(ledGlow)

    // Gold desk trim for Master+ (L8)
    if (isDeskItemUnlocked(agentLevel, 'gold_trim')) {
      deskBody.setStrokeStyle(1.5, 0xfbbf24, 0.7)
    }

    // Task completion counter — 14×8px pill at top-right of the desk surface.
    // bg rect at (26, WS_DESK_Y - 12); text centered inside at (33, WS_DESK_Y - 8).
    // Color tiers: 0 = hidden, 1-4 = gray, 5-9 = blue, 10+ = gold.
    const taskCountBg = this.scene.add.graphics()
    taskCountBg.fillStyle(activeTheme.bg, 0.6)
    taskCountBg.fillRoundedRect(0, 0, 14, 8, 2)
    taskCountBg.setPosition(26, WS_DESK_Y - 12)
    taskCountBg.setAlpha(0)        // hidden until first task completes
    wsContainer.add(taskCountBg)

    const taskCountText = this.scene.add.text(33, WS_DESK_Y - 8, '0', {
      fontSize: '5px',
      fontFamily: 'system-ui, monospace',
      color: '#5a6a7a',
      resolution: 3,
    }).setOrigin(0.5).setAlpha(0)  // hidden until first task completes
    wsContainer.add(taskCountText)

    // LOD level 2+: shown at room-level zoom (sprite, desk body/top, monitor, chair are always visible at L2+;
    // these extras add context at the room-view scale without requiring full detail)
    const lodLevel2Objects: Phaser.GameObjects.GameObject[] = [
      keyboard, kbLines, sticky,
    ]
    // LOD level 3 only: micro-accessories only visible at full detail zoom
    const lodLevel3Objects: Phaser.GameObjects.GameObject[] = [
      lampBase, lampArm, lampShade, lampLight,
      ...extraDecos, ledGlow, monitorText,
      phoneBody, phoneScreen, phoneLight,
      taskCountBg, taskCountText,
      ...(monitorFrame ? [monitorFrame] : []),
    ]

    // Ambient sound-wave indicator — concentric arcs to the left of the agent.
    // Drawn/cleared dynamically in updateAnimation; registered here so it
    // participates in the LOD system from the start (LOD 3 only).
    const soundWaveGfx = this.scene.add.graphics()
    soundWaveGfx.x = -28
    soundWaveGfx.y = WS_SPRITE_Y - 8
    wsContainer.add(soundWaveGfx)
    lodLevel3Objects.push(soundWaveGfx)

    // Productivity sparkline — tiny area graph on the right side of the desk surface
    // showing the agent's recent activity pattern (last 20 ticks).
    // Redrawn in updateWorkstation whenever the activity value changes.
    const sparklineGfx = this.scene.add.graphics()
    sparklineGfx.setPosition(18, WS_DESK_Y - 12)
    wsContainer.add(sparklineGfx)
    lodLevel3Objects.push(sparklineGfx)

    // Circular progress ring — drawn above the agent's head while they are working.
    // The arc fills clockwise over 60 seconds giving a visual sense of task duration.
    // Registered in lodLevel2Objects so it is visible at room-level zoom and above.
    const progressRing = this.scene.add.graphics()
    progressRing.setPosition(0, WS_SPRITE_Y - 12)
    progressRing.setAlpha(0)
    wsContainer.add(progressRing)
    lodLevel2Objects.push(progressRing)

    // Character shadow
    const shadow = this.scene.add.ellipse(0, WS_SPRITE_Y + 2, 20, 6, 0x000000, 0.2)
    wsContainer.add(shadow)

    const charIdx = this.host.getAgentCharacterIndex(agent)
    const frame   = this.host.getPoseFrame(charIdx, agent)
    const sprite  = this.scene.add.sprite(0, WS_SPRITE_Y, SPRITESHEET_KEYS.CHARACTERS, frame)
    sprite.setScale(CHAR_SCALE).setOrigin(0.5, 1)
    wsContainer.add(sprite)

    // Thought bubble — dark card with accent border and live blurb text
    const thoughtBubbleBg = this.scene.add.graphics()
    let thoughtBubbleBgSprite: Phaser.GameObjects.Image | undefined
    if (this.scene.textures.exists(IMAGE_KEYS.PANEL_BG)) {
      thoughtBubbleBgSprite = this.scene.add.image(0, 0, IMAGE_KEYS.PANEL_BG)
        .setDisplaySize(110, 30).setAlpha(0.9).setTint(activeTheme.bg).setOrigin(0.5)
      thoughtBubbleBg.setVisible(false)
    }
    const thoughtBubbleText = this.scene.add.text(0, 0, '', {
      fontSize: '10px', color: '#c8d0e0', fontFamily: 'system-ui, sans-serif',
      wordWrap: { width: 95, useAdvancedWrap: false },
      align: 'left', resolution: 2, lineSpacing: 1,
    }).setOrigin(0.5)
    const bubbleChildren: Phaser.GameObjects.GameObject[] = [thoughtBubbleBg]
    if (thoughtBubbleBgSprite) bubbleChildren.push(thoughtBubbleBgSprite)
    bubbleChildren.push(thoughtBubbleText)
    const thoughtBubble = this.scene.add.container(4, WS_SPRITE_Y - 60, bubbleChildren).setVisible(false)
    wsContainer.add(thoughtBubble)

    // Show persona name (e.g. "Marcus Chen") instead of title
    const nameText = this.scene.add.text(0, WS_NAME_Y, '', {
      fontSize: '13px', color: activeTheme.nameText, fontFamily: 'system-ui, sans-serif',
      backgroundColor: activeTheme.nameBg, padding: { x: 5, y: 2 }, align: 'center',
      resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(nameText)

    // Name glow effect (unlocks at Associate / L3)
    if (isFlairUnlocked(agentLevel, 'name_glow')) {
      const glowFx = nameText.postFX?.addGlow(getRankColor(agentLevel), 2, 0, false, 0.08, 8)
      void glowFx // applied via postFX pipeline
    }

    // Crown accessory (unlocks at Expert / L7) — gold medal sprite
    // Use HD sheet (2x pixels at half scale) when available for crisper LOD3 rendering
    const hdAvailable = this.scene.textures.exists(SPRITESHEET_KEYS.GAME_ICONS_HD)
    if (isFlairUnlocked(agentLevel, 'crown')) {
      const crownSheet = hdAvailable ? SPRITESHEET_KEYS.GAME_ICONS_HD : SPRITESHEET_KEYS.GAME_ICONS
      const crownScale = hdAvailable ? 0.16 : 0.32
      const crown = this.scene.add.sprite(0, WS_SPRITE_Y - 28, crownSheet, ICON_FRAMES.MEDAL_GOLD)
        .setScale(crownScale).setOrigin(0.5).setAlpha(0.9)
      wsContainer.add(crown)
      lodLevel3Objects.push(crown)
    }

    // Quest difficulty star — floats above workstation while a quest is active
    // Use HD sheet (2x pixels at half scale) for crisper rendering when available
    const questSheet = hdAvailable ? SPRITESHEET_KEYS.GAME_ICONS_HD : SPRITESHEET_KEYS.GAME_ICONS
    const questScale = hdAvailable ? 0.19 : 0.38
    const questIcon = this.scene.add.sprite(0, WS_SPRITE_Y - 36, questSheet, ICON_FRAMES.STAR_GREY)
      .setScale(questScale).setOrigin(0.5).setAlpha(0).setVisible(false)
    wsContainer.add(questIcon)
    lodLevel2Objects.push(questIcon)

    // MVP medal — gold medal shown for weekly MVP agent
    // Use HD sheet (2x pixels at half scale) for crisper rendering when available
    const mvpSheet = hdAvailable ? SPRITESHEET_KEYS.GAME_ICONS_HD : SPRITESHEET_KEYS.GAME_ICONS
    const mvpScale = hdAvailable ? 0.19 : 0.38
    const mvpMedal = this.scene.add.sprite(14, WS_SPRITE_Y - 30, mvpSheet, ICON_FRAMES.MEDAL_GOLD)
      .setScale(mvpScale).setOrigin(0.5).setAlpha(0).setVisible(false)
    wsContainer.add(mvpMedal)
    lodLevel2Objects.push(mvpMedal)

    // Rivalry indicator — red star shown when agent has an active leaderboard rival
    const rivalryIndicator = this.scene.add.sprite(20, WS_SPRITE_Y - 36, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.STAR_RED)
      .setScale(0.32).setOrigin(0.5).setAlpha(0).setVisible(false)
    wsContainer.add(rivalryIndicator)
    lodLevel2Objects.push(rivalryIndicator)

    const dotColor  = this.host.getStatusColor(agent)
    const dotFrame  = STATUS_DOT_FRAMES[dotColor] ?? ICON_FRAMES.CIRCLE_GREY
    const statusDot = this.scene.add.sprite(nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y, SPRITESHEET_KEYS.GAME_ICONS, dotFrame)
      .setScale(0.22).setOrigin(0.5).setVisible(false)
    wsContainer.add(statusDot)

    // Role badge (S / R / E) — shown when agent has a pod role assigned.
    // Sits to the left of the name tag; revealed/hidden in updateWorkstation.
    const roleBadge = this.scene.add.text(-30, WS_NAME_Y, '', {
      fontSize: '9px', color: activeTheme.nameBg.replace(/cc$/, ''), fontFamily: 'system-ui, monospace',
      fontStyle: 'bold', backgroundColor: activeTheme.accentText,
      padding: { x: 3, y: 1 }, resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(roleBadge)
    lodLevel3Objects.push(roleBadge)

    // Uptime indicator — tiny dim counter just below the name tag
    const uptimeText = this.scene.add.text(0, WS_NAME_Y + 12, '', {
      fontSize: '6px', color: '#3a4858', fontFamily: 'system-ui, monospace',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setAlpha(0.7).setVisible(false)
    wsContainer.add(uptimeText)
    lodLevel3Objects.push(uptimeText)

    // XP progress bar — thin strip below the name tag
    const XP_BAR_W  = 30
    const XP_BAR_H  = 3
    const XP_BAR_Y  = WS_NAME_Y + 14

    // AnimatedBar: origin is top-left of the track, so offset x by half-width and y by half-height
    // to match the previous centered-origin rectangle placement.
    const xpBar = new AnimatedBar({
      scene: this.scene,
      x: -XP_BAR_W / 2,
      y: XP_BAR_Y - XP_BAR_H / 2,
      width: XP_BAR_W,
      height: XP_BAR_H,
      fillColor: 0x3b82f6,
      backgroundColor: activeTheme.roomFloor,
    })
    xpBar.graphics.setAlpha(0.6).setVisible(false)
    wsContainer.add(xpBar.graphics)

    const XP_TEXT_Y = XP_BAR_Y + 6
    const xpBarText = this.scene.add.text(0, XP_TEXT_Y, '', {
      fontSize: '5px', color: '#5a6a7a', fontFamily: 'system-ui, sans-serif',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(xpBarText)

    // Lego brick XP segments — 5 tiny brick sprites overlaying the XP bar track.
    // Each segment represents 20% of progress. Starts invisible; becomes visible as XP fills.
    const LEGO_SEGMENT_W = 16
    const LEGO_SEGMENT_SCALE = XP_BAR_W / (5 * LEGO_SEGMENT_W)  // scale each brick to fit 1/5 of the bar
    const legoFrames = [LEGO_FRAMES.BLUE, LEGO_FRAMES.GREEN, LEGO_FRAMES.YELLOW, LEGO_FRAMES.RED, LEGO_FRAMES.SPECIAL]
    const legoSegments: Phaser.GameObjects.Sprite[] = []
    for (let i = 0; i < 5; i++) {
      const segX = -XP_BAR_W / 2 + (i + 0.5) * (XP_BAR_W / 5)
      const seg = this.scene.add.sprite(segX, XP_BAR_Y, SPRITESHEET_KEYS.LEGO_BAR, legoFrames[i])
        .setScale(LEGO_SEGMENT_SCALE).setOrigin(0.5).setVisible(false)
      seg.setData('origScale', LEGO_SEGMENT_SCALE)
      wsContainer.add(seg)
      legoSegments.push(seg)
    }

    lodLevel3Objects.push(xpBar.graphics, xpBarText, ...legoSegments)

    // Vertical energy/stamina bar — right side of desk, shows energy drain/recovery
    const ENERGY_BAR_H = 25
    const ENERGY_BAR_X = WORKSTATION_W / 2 + 2
    const ENERGY_BAR_Y = WS_DESK_Y - 8  // centered vertically: from WS_DESK_Y-20 to WS_DESK_Y+5
    let energyTrack: Phaser.GameObjects.Image | undefined
    let energyFill: Phaser.GameObjects.Image | undefined
    if (this.scene.textures.exists(IMAGE_KEYS.VSLIDER_TRACK) && this.scene.textures.exists(IMAGE_KEYS.VSLIDER_FILL)) {
      energyTrack = this.scene.add.image(ENERGY_BAR_X, ENERGY_BAR_Y, IMAGE_KEYS.VSLIDER_TRACK)
        .setDisplaySize(4, ENERGY_BAR_H)
        .setOrigin(0.5)
        .setAlpha(0.5)
      wsContainer.add(energyTrack)
      lodLevel3Objects.push(energyTrack)

      energyFill = this.scene.add.image(ENERGY_BAR_X, ENERGY_BAR_Y, IMAGE_KEYS.VSLIDER_FILL)
        .setDisplaySize(4, ENERGY_BAR_H)
        .setOrigin(0.5)
        .setAlpha(0.5)
      wsContainer.add(energyFill)
      lodLevel3Objects.push(energyFill)
    }

    // "Blocked" clarity marker for needsInteraction agents.
    const blockedIndicatorPulse = this.scene.add.circle(0, 0, 10, 0xfbbf24, 0.16)
    const blockedIndicatorStem = this.scene.add.rectangle(0, 8, 1.5, 7, 0xfbbf24, 0.55)
    const blockedIndicatorBadge = this.scene.add.sprite(0, 0, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_YELLOW)
      .setScale(0.32).setOrigin(0.5)
    const blockedIndicatorText = this.scene.add.text(0, -0.5, '!', {
      fontSize: '10px',
      color: activeTheme.nameBg.replace(/cc$/, ''),
      fontFamily: 'system-ui, monospace',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0.5)
    const blockedIndicator = this.scene.add
      .container(27, WS_SPRITE_Y - 34, [blockedIndicatorPulse, blockedIndicatorStem, blockedIndicatorBadge, blockedIndicatorText])
      .setVisible(false)
    wsContainer.add(blockedIndicator)

    // Mood emoji indicator — shown top-left above the agent, fades in/out on state change
    const moodEmoji = this.scene.add.text(
      -WORKSTATION_W / 2 + 4,
      WS_SPRITE_Y - 20,
      '',
      { fontSize: '8px', fontFamily: 'system-ui, sans-serif', resolution: 2 },
    ).setOrigin(0, 1).setAlpha(0)
    wsContainer.add(moodEmoji)
    lodLevel3Objects.push(moodEmoji)

    // Mood badge sprite — small icon from GAME_ICONS sheet next to the mood emoji.
    // Updated in workstation-animation.ts updateMood alongside the emoji text.
    const moodBadge = this.scene.add.sprite(
      -WORKSTATION_W / 2 + 16,
      WS_SPRITE_Y - 24,
      SPRITESHEET_KEYS.GAME_ICONS,
      ICON_FRAMES.CIRCLE_GREY,
    ).setScale(0.25).setOrigin(0.5).setAlpha(0).setVisible(false)
    wsContainer.add(moodBadge)
    lodLevel3Objects.push(moodBadge)

    const hitArea = this.scene.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge,
      deskBody, deskTop, monitorSprite, chairSprite,
      monitorGlowFx, monitorFrame, screenLines, screenTween, screenState,
      monitorText,
      blockedIndicator, blockedIndicatorPulse, blockedIndicatorBadge, blockedIndicatorStem, blockedIndicatorText,
      thoughtBubble, thoughtBubbleText, thoughtBubbleBg, thoughtBubbleBgSprite, state: agent,
      steamTweens: [] as Phaser.Tweens.Tween[], steamContainer: null as Phaser.GameObjects.Container | null,
      keyboard,
      ledGlow,
      moodEmoji,
      moodBadge,
      soundWaveGfx,
      sparklineGfx,
      shadow,
      activityHistory: [],
      phoneLight,
      progressRing,
      lodLevel2Objects,
      lodLevel3Objects,
      xpBar,
      xpBarText,
      legoSegments,
      uptimeText,
      taskCountBg,
      taskCountText,
      localTaskCount: 0,
      questIcon,
      mvpMedal,
      deskPet: deskPet ?? undefined,
      petEyes: petEyes ?? undefined,
      petMouth: petMouth ?? undefined,
      signatureItem: signatureItemSprite ?? undefined,
      roomProp: roomPropSprite ?? undefined,
      rivalryIndicator,
      energyTrack,
      energyFill,
      energyLevel: 1.0,
      lampLight: lampVisible ? lampLight : undefined,
    }

    // Desk pet idle bounce — gentle y-oscillation with face sprites in sync
    if (deskPet) {
      const petBaseY = deskPet.y
      const _eyeBaseY = petEyes?.y ?? 0
      const _mouthBaseY = petMouth?.y ?? 0
      ws.deskPetTween = this.scene.tweens.add({
        targets: deskPet,
        y: { from: petBaseY - 1.5, to: petBaseY + 0.5 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
        onUpdate: () => {
          const offset = deskPet!.y - petBaseY
          if (petEyes) petEyes.y = _eyeBaseY + offset
          if (petMouth) petMouth.y = _mouthBaseY + offset
        },
      })
    }
    // Desk pet blink — swap eyes to sleepy frame for 150ms every 3-6s
    if (petEyes) {
      const _defaultEyeFrame = petEyes.frame.name
      petEyes.setData('normalEyeFrame', _defaultEyeFrame)
      ws.petBlinkTimer = this.scene.time.addEvent({
        delay: 3000 + Math.random() * 3000,
        loop: true,
        callback: () => {
          if (!ws.petEyes || !ws.petEyes.visible || !ws.petEyes.active) return
          const nf = ws.petEyes.getData('normalEyeFrame') ?? _defaultEyeFrame
          ws.petEyes.setFrame(PET_FACE_FRAMES.EYES_SLEEPY)
          this.scene.time.delayedCall(150, () => {
            if (ws.petEyes?.active) ws.petEyes.setFrame(nf)
          })
        },
      })
    }

    // Desk plant micro-sway — subtle y-oscillation on the leaf circle
    if (deskPlantLeaf) {
      const leafBaseY = deskPlantLeaf.y
      ws.deskPlantTween = this.scene.tweens.add({
        targets: deskPlantLeaf,
        y: { from: leafBaseY - 1, to: leafBaseY + 1 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1500,
      })
    }

    // Signature item idle rotation — gentle wobble to give personality
    if (signatureItemSprite) {
      ws.signatureItemTween = this.scene.tweens.add({
        targets: signatureItemSprite,
        angle: { from: -3, to: 3 },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
      })
    }

    // Apply current LOD state immediately to the newly created workstation.
    this.host.applyLodToWorkstation(ws, this.host.getLastLodLevel(), false)

    let lastClickTime = 0
    hitArea.on('pointerdown', () => {
      const now = Date.now()
      if (now - lastClickTime < 350) {
        EventBus.emit(EVENTS.AGENT_DOUBLE_CLICKED, agent.config.id, ws.state)
        this.host.enterFocusMode(agent.config.id)
      } else {
        EventBus.emit(EVENTS.AGENT_CLICKED, agent.config.id, ws.state)
      }
      lastClickTime = now
    })

    hitArea.on('pointerover', () => {
      this.scene.tweens.killTweensOf(wsContainer)
      this.scene.tweens.add({ targets: wsContainer, scaleX: 1.07, scaleY: 1.07, duration: 140, ease: 'Back.easeOut' })
      ws.deskBody.setStrokeStyle(2, 0x3b82f6, 0.9)

      // --- Micro-interactions: desk items react to pointer ---
      // Desk pet excited bounce
      if (ws.deskPet?.visible) {
        this.scene.tweens.add({ targets: ws.deskPet, y: ws.deskPet.y - 3, duration: 100, yoyo: true, ease: 'Bounce.easeOut' })
      }
      // Signature item wiggle
      if (ws.signatureItem?.visible) {
        this.scene.tweens.add({ targets: ws.signatureItem, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, ease: 'Sine.easeInOut' })
      }
      // Status dot pulse
      this.scene.tweens.add({ targets: ws.statusDot, scaleX: 0.32, scaleY: 0.32, duration: 100, yoyo: true, ease: 'Back.easeOut' })
      // Monitor glow boost
      if (ws.monitorGlowFx) {
        const origOuter = ws.monitorGlowFx.outerStrength
        ws.monitorGlowFx.outerStrength = 4
        this.scene.time.delayedCall(300, () => { if (ws.monitorGlowFx) ws.monitorGlowFx.outerStrength = origOuter })
      }

      // Highlight ring around desk in world-space
      const rWx = room.container.x + wsContainer.x
      const rWy = room.container.y + wsContainer.y
      this.host.drawHoverRing(rWx, rWy)
      // Rich tooltip near pointer in screen-space
      const ptr = (this.scene.input as Phaser.Input.InputPlugin).activePointer
      this.host.showRichTooltip(ws.state ?? agent, ptr.x, ptr.y)
    })

    hitArea.on('pointerout', () => {
      this.scene.tweens.killTweensOf(wsContainer)
      this.scene.tweens.add({ targets: wsContainer, scaleX: 1, scaleY: 1, duration: 140, ease: 'Power2' })
      // Reset signature item angle in case yoyo tween was interrupted
      if (ws.signatureItem) ws.signatureItem.setAngle(0)
      this.restoreDeskStrokeCallback(ws)
      this.host.clearHoverRing()
      this.host.hideTooltip()
    })

    this.updateCallback(ws, agent)

    // --- Entrance animation ---
    // Slide up from below + fade in, then pulse the sprite for a brief attention grab.
    fadeInUp(wsContainer, this.scene, {
      offset: 20,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (sprite.active) pulse(sprite, this.scene, { scale: 1.12, duration: 200 })
        // Sparkle trail — small star sprites rising from the workstation position
        this.spawnEntranceSparkles(room, wsContainer)
      },
    })

    return ws
  }

  // ---------------------------------------------------------------------------
  // layoutWorkstations — positions workstations in a grid within a room
  // ---------------------------------------------------------------------------

  layout(room: Room): void {
    const agents = Array.from(room.workstations.values())
    const count  = agents.length
    if (count === 0) return

    const roomType = detectRoomType(room.cwd ?? '')
    const layout = computeRoomLayout(count, roomType, room.doorSide ?? 'bottom')

    agents.forEach((ws, i) => {
      if (i >= layout.deskPositions.length) return
      const { x: cx, y: cy } = layout.deskPositions[i]

      this.scene.tweens.killTweensOf(ws.container)
      this.scene.tweens.add({ targets: ws.container, x: cx, y: cy, duration: 280, ease: 'Power2' })
      ws.container.setDepth(cy + room.y)
    })

    // Spawn in-room props if not already placed
    if (!room.propsPlaced && this.host.propsManager) {
      room.propsPlaced = true
      for (const slot of layout.propSlots) {
        const prop = this.host.propsManager.addProp({ type: slot.type, x: slot.x, y: slot.y })
        if (prop) room.container.add(prop.container)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // destroyWorkstation — cleanup
  // ---------------------------------------------------------------------------

  destroy(ws: WorkstationSprite): void {
    if (ws.breathTween)      ws.breathTween.destroy()
    if (ws.bounceTween)      ws.bounceTween.destroy()
    if (ws.dotPulseTween)    ws.dotPulseTween.destroy()
    if (ws.blockedIndicatorTween) ws.blockedIndicatorTween.destroy()
    if (ws.walkBreakTween)   ws.walkBreakTween.destroy()
    if (ws.typingTween)      ws.typingTween.destroy()
    if (ws.headTiltTween)    ws.headTiltTween.destroy()
    if (ws.monitorGlowTween) ws.monitorGlowTween.destroy()
    if (ws.screenTween)      ws.screenTween.destroy()
    if (ws.monitorTextTween) ws.monitorTextTween.destroy()
    if (ws.pulseTween)       ws.pulseTween.destroy()
    if (ws.ledPulseTween)    ws.ledPulseTween.destroy()
    if (ws.lookAroundTimer)     ws.lookAroundTimer.destroy()
    if (ws.stretchTimer)        ws.stretchTimer.destroy()
    if (ws.walkBreakTimer)      ws.walkBreakTimer.destroy()
    if (ws.lookAtNeighborTimer) ws.lookAtNeighborTimer.destroy()
    if (ws.yawnTimer)           ws.yawnTimer.destroy()
    this.host.clearSteamParticles(ws)
    this.scene.tweens.killTweensOf(ws.thoughtBubble)
    if (ws.blurbFadeTimer)          ws.blurbFadeTimer.destroy()
    if (ws.blurbTypingTween)        ws.blurbTypingTween.destroy()
    if (ws.thoughtBubbleFloatTween) ws.thoughtBubbleFloatTween.destroy()
    if (ws.thoughtBubbleBgSprite) ws.thoughtBubbleBgSprite.destroy()
    if (ws.monitorFrame) ws.monitorFrame.destroy()
    if (ws.moodTween) ws.moodTween.destroy()
    if (ws.moodBadgeTween) ws.moodBadgeTween.destroy()
    if (ws.moodEmoji) this.scene.tweens.killTweensOf(ws.moodEmoji)
    if (ws.moodBadge) { this.scene.tweens.killTweensOf(ws.moodBadge); ws.moodBadge.destroy() }
    if (ws.deskPetTween)     ws.deskPetTween.destroy()
    if (ws.deskPet)          ws.deskPet.destroy()
    if (ws.petBlinkTimer)    ws.petBlinkTimer.destroy()
    if (ws.petEyes)          ws.petEyes.destroy()
    if (ws.petMouth)         ws.petMouth.destroy()
    if (ws.deskPlantTween)   ws.deskPlantTween.destroy()
    if (ws.signatureItemTween) ws.signatureItemTween.destroy()
    if (ws.signatureItem)      ws.signatureItem.destroy()
    if (ws.roomProp)           ws.roomProp.destroy()
    if (ws.xpBar)            ws.xpBar.destroy()
    if (ws.chairRockTween)   ws.chairRockTween.destroy()
    if (ws.soundWaveTween)   ws.soundWaveTween.destroy()
    if (ws.soundWaveGfx)     ws.soundWaveGfx.destroy()
    if (ws.soundWaveSpeaker) ws.soundWaveSpeaker.destroy()
    if (ws.kbGlowTween)      ws.kbGlowTween.destroy()
    if (ws.typingNoteTimer)  ws.typingNoteTimer.destroy()
    if (ws.shadow)           ws.shadow.destroy()
    if (ws.sparklineGfx)     { ws.sparklineGfx.clear(); ws.sparklineGfx.destroy() }
    if (ws.phoneLightTween)      ws.phoneLightTween.destroy()
    if (ws.progressRingTween)    ws.progressRingTween.destroy()
    if (ws.progressRing)         { ws.progressRing.clear(); ws.progressRing.destroy() }
    if (ws.roleBadgePulseTween)  ws.roleBadgePulseTween.destroy()
    if (ws.taskCountFlashTween)  ws.taskCountFlashTween.destroy()
    if (ws.taskCountBg)          { ws.taskCountBg.clear(); ws.taskCountBg.destroy() }
    if (ws.taskCountText)        ws.taskCountText.destroy()
    if (ws.questIconTween)       ws.questIconTween.destroy()
    if (ws.questIcon)            ws.questIcon.destroy()
    if (ws.mvpMedalTween)        ws.mvpMedalTween.destroy()
    if (ws.mvpMedal)             ws.mvpMedal.destroy()
    if (ws.rivalryGlowTween)     ws.rivalryGlowTween.destroy()
    if (ws.rivalryIndicator)     ws.rivalryIndicator.destroy()
    if (ws.energyPulseTween)     ws.energyPulseTween.destroy()
    if (ws.energyTrack)          ws.energyTrack.destroy()
    if (ws.energyFill)           ws.energyFill.destroy()
    if (ws.lampLightTween)       ws.lampLightTween.destroy()
    if (ws.lampFlickerTimer)     ws.lampFlickerTimer.destroy()
    ws.activityHistory = []

    // Exit animation: shrink + fade, then destroy.
    // Detach from room container first so deferred destroy can't interfere with layout.
    try {
      const agentName = ws.state?.config.name || 'Agent'
      if (ws.container.active && this.scene.scene.isActive()) {
        // Spawn a small exit puff at the departing workstation's world position
        this.spawnExitPuff(ws)

        const parent = ws.container.parentContainer
        if (parent) parent.remove(ws.container)
        this.host.showToast(`${agentName} left`, 'info')
        fadeOutDown(ws.container, this.scene, {
          offset: 20,
          duration: 260,
          ease: 'Quad.easeIn',
          onComplete: () => { try { ws.container.destroy() } catch { /* already gone */ } },
        })
      } else {
        ws.container.destroy()
      }
    } catch {
      try { ws.container.destroy() } catch { /* noop */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Coffee indicator helpers
  // ---------------------------------------------------------------------------

  /** Show a small coffee cup sprite on the desk when the agent is at the cafe */
  ensureCoffeeIndicator(ws: WorkstationSprite): void {
    if (ws.coffeeIndicator) return
    const indicator = this.scene.add.sprite(0, WS_SPRITE_Y - 8, SPRITESHEET_KEYS.GAME_ITEMS, ITEM_FRAMES.COFFEE_CUP)
      .setScale(0.38).setOrigin(0.5).setAlpha(0.8)
    ws.container.add(indicator)
    ws.coffeeIndicator = indicator
    // Gentle bob
    this.scene.tweens.add({
      targets: indicator, y: WS_SPRITE_Y - 11,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  /** Remove the coffee indicator when the agent returns */
  removeCoffeeIndicator(ws: WorkstationSprite): void {
    if (!ws.coffeeIndicator) return
    this.scene.tweens.killTweensOf(ws.coffeeIndicator)
    ws.coffeeIndicator.destroy()
    ws.coffeeIndicator = undefined
  }

  // ---------------------------------------------------------------------------
  // Entrance sparkle trail — small star sprites that rise and fade
  // ---------------------------------------------------------------------------

  private spawnEntranceSparkles(room: Room, wsContainer: Phaser.GameObjects.Container): void {
    const worldX = room.container.x + wsContainer.x
    const worldY = room.container.y + wsContainer.y
    const count = 5 + Math.floor(Math.random() * 4) // 5-8 sparkles
    for (let i = 0; i < count; i++) {
      const sparkle = this.scene.add.sprite(
        worldX + (Math.random() - 0.5) * 10,
        worldY + 10,
        SPRITESHEET_KEYS.GAME_ICONS,
        ICON_FRAMES.STAR_YELLOW,
      ).setScale(0.12).setAlpha(0.7).setDepth(210)
      this.scene.tweens.add({
        targets: sparkle,
        x: sparkle.x + (Math.random() - 0.5) * 30,
        y: sparkle.y - 20 - Math.random() * 15,
        alpha: 0,
        scale: 0.04,
        duration: 600,
        delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => { try { sparkle.destroy() } catch { /* gone */ } },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Exit puff — play a small puff VFX at the departing workstation
  // ---------------------------------------------------------------------------

  private spawnExitPuff(ws: WorkstationSprite): void {
    if (!this.scene.anims.exists(EFFECT_ANIM_KEYS.PUFF)) return
    const parent = ws.container.parentContainer
    const worldX = (parent ? parent.x : 0) + ws.container.x
    const worldY = (parent ? parent.y : 0) + ws.container.y
    const puff = this.scene.add.sprite(worldX, worldY, SPRITESHEET_KEYS.EFFECTS_PUFF)
      .setDepth(200)
      .setScale(0.14)
      .setAlpha(0.3)
    puff.play(EFFECT_ANIM_KEYS.PUFF)
    puff.once('animationcomplete', () => { try { puff.destroy() } catch { /* gone */ } })
  }
}
