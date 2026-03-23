// ---------------------------------------------------------------------------
// office-workstation.ts
// Extracted workstation lifecycle management from OfficeScene.ts
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { EventBus, EVENTS } from './events'
import type { AgentState } from '../types'
import { XP_RANKS, getXPForLevel } from '../types'
import type { WorkstationSprite, Room, PodLineInfo } from './office-types'
import { activeTheme } from './office-theme'
import {
  CHAR_COLS,
  FRAME_CHAIR_DARK,
  FRAME_MONITOR,
  POSE_IDLE,
  POSE_INTERACT,
  POSE_SIT,
  POSE_WALK,
  CHAR_SCALE,
  WORKSTATION_W,
  WORKSTATION_H,
  ROOM_PADDING,
  ROOM_TOP_EXTRA,
  ROOM_HEADER_H,
  MAX_AGENTS_PER_ROW,
  WS_CHAIR_Y,
  WS_SPRITE_Y,
  WS_DESK_Y,
  WS_MONITOR_Y,
  WS_NAME_Y,
  WS_DOT_GAP,
  IDLE_WALK_BREAK_MIN_MS,
  IDLE_WALK_BREAK_VAR_MS,
  IDLE_WALK_RANGE_X,
  COLOR_DESK_BODY,
  COLOR_DESK_TOP,
  COLOR_LED_AMBER,
  COLOR_LED_GREEN,
  COLOR_DOOR_FRAME,
} from './office-constants'

// ---------------------------------------------------------------------------
// Host interface — callbacks into OfficeScene for cross-module calls
// ---------------------------------------------------------------------------

export interface WorkstationHost {
  // Toast notifications
  showToast(text: string, type?: 'info' | 'success' | 'warning' | 'error'): void
  // Particle / effect calls
  spawnEmojiReaction(x: number, y: number, emoji: string): void
  spawnAlertRipple(x: number, y: number, color: number): void
  burstConfetti(x: number, y: number): void
  spawnSteamParticles(ws: WorkstationSprite): void
  clearSteamParticles(ws: WorkstationSprite): void
  // Minimap
  queueMinimapRoomFlash(cwd: string, color: number, durationMs: number): void
  // Agent helpers (kept on OfficeScene as they relate to broader scene state)
  getAgentCharacterIndex(agent: AgentState): number
  getPoseFrame(charIdx: number, agent: AgentState): number
  getStatusColor(agent: AgentState): number
  // Pod lines — needed for role badge pulse detection
  getPodLines(): PodLineInfo[]
  // LOD & interaction
  applyLodToWorkstation(ws: WorkstationSprite, level: number, useFadeIn: boolean): void
  getLastLodLevel(): number
  enterFocusMode(agentId: string): void
  drawHoverRing(worldX: number, worldY: number): void
  clearHoverRing(): void
  showRichTooltip(agent: AgentState, screenX: number, screenY: number): void
  hideTooltip(): void
  // Asset availability
  officeTilesLoaded: boolean
  // Room map (needed for world position lookups in updateWorkstation/updateAnimation)
  getRooms(): Map<string, Room>
  // Coffee run checks
  isCoffeeRunActive(agentId: string): boolean
  cancelCoffeeRun(agentId: string): void
}

// ---------------------------------------------------------------------------
// OfficeWorkstations class
// ---------------------------------------------------------------------------

export class OfficeWorkstations {
  private scene: Phaser.Scene
  private host: WorkstationHost

  constructor(scene: Phaser.Scene, host: WorkstationHost) {
    this.scene = scene
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // syncWorkstations — reconciles workstations with agent list
  // ---------------------------------------------------------------------------

  syncWorkstations(room: Room, agents: AgentState[], onDoorAnimation: (room: Room) => void): void {
    const currentIds = new Set(agents.map(a => a.config.id))

    for (const [id, ws] of room.workstations) {
      if (!currentIds.has(id)) {
        this.destroyWorkstation(ws)
        room.workstations.delete(id)
      }
    }

    for (const agent of agents) {
      const existing = room.workstations.get(agent.config.id)
      if (existing) {
        this.updateWorkstation(existing, agent)
      } else {
        const ws = this.createWorkstation(room, agent)
        room.workstations.set(agent.config.id, ws)
      }
    }

    // Trigger door animation when agent count changes (someone enters or leaves).
    if (agents.length !== room.prevAgentCount) {
      onDoorAnimation(room)
      room.prevAgentCount = agents.length
    }

    this.layoutWorkstations(room)
  }

  // ---------------------------------------------------------------------------
  // createWorkstation — creates all desk/chair/monitor/sprite objects
  // ---------------------------------------------------------------------------

  createWorkstation(room: Room, agent: AgentState): WorkstationSprite {
    const wsContainer = this.scene.add.container(0, 0)
    room.container.add(wsContainer)

    let chairSprite: Phaser.GameObjects.Sprite | null = null
    if (this.host.officeTilesLoaded) {
      chairSprite = this.scene.add.sprite(0, WS_CHAIR_Y + 4, 'office', FRAME_CHAIR_DARK)
      chairSprite.setScale(0.44).setAlpha(0.85)
      wsContainer.add(chairSprite)
    } else {
      wsContainer.add(this.scene.add.rectangle(0, WS_CHAIR_Y, 18, 13, 0x2d3748).setStrokeStyle(1, 0x4a5568, 0.6))
    }

    const deskBody = this.scene.add.rectangle(0, WS_DESK_Y, 64, 21, COLOR_DESK_BODY).setStrokeStyle(1, 0x64748b, 0.5)
    wsContainer.add(deskBody)

    const deskTop = this.scene.add.rectangle(0, WS_DESK_Y - 8, 61, 3, COLOR_DESK_TOP)
    wsContainer.add(deskTop)

    let monitorSprite: Phaser.GameObjects.Sprite | null = null
    let monitorGlowFx: Phaser.FX.Glow | undefined
    let screenLines: Phaser.GameObjects.Graphics | undefined
    let screenTween: Phaser.Tweens.Tween | undefined
    if (this.host.officeTilesLoaded) {
      monitorSprite = this.scene.add.sprite(0, WS_MONITOR_Y, 'office', FRAME_MONITOR).setScale(0.42)
      wsContainer.add(monitorSprite)
      monitorGlowFx = monitorSprite.postFX.addGlow(0x0ea5e9, 0, 0, false, 0.1, 16)
      // Scrolling screen content lines
      screenLines = this.scene.add.graphics().setVisible(false)
      wsContainer.add(screenLines)
      const LINE_COLORS = [0x0ea5e9, 0x34d399]
      const lineWidths = Array.from({ length: 4 }, () => 6 + Math.random() * 6)
      const lineColors = lineWidths.map(() => LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)])
      screenTween = this.scene.tweens.addCounter({
        from: 0, to: 1, duration: 1200 + Math.random() * 600, repeat: -1, ease: 'Linear',
        onUpdate: (tw) => {
          if (!screenLines?.active) return
          screenLines.clear()
          const v = tw.getValue()
          for (let i = 0; i < 4; i++) {
            const y = WS_MONITOR_Y + ((v * 13 + i * 3.25) % 13) - 6.5
            screenLines.fillStyle(lineColors[i], 0.5)
            screenLines.fillRect(-lineWidths[i] / 2, y, lineWidths[i], 1)
          }
        },
      })
      screenTween.pause()
    } else {
      wsContainer.add(this.scene.add.rectangle(0, WS_MONITOR_Y, 16, 13, 0x1a1a2e).setStrokeStyle(1, 0x4a5568, 0.8))
    }

    // Monitor blurb text — tiny live text overlaid on the monitor screen
    const monitorText = this.scene.add.text(0, WS_MONITOR_Y - 1, '', {
      fontSize: '4px',
      fontFamily: 'monospace',
      color: '#64748b',
      wordWrap: { width: 14, useAdvancedWrap: false },
      resolution: 3,
    }).setOrigin(0.5, 0).setAlpha(0.7).setVisible(false)
    wsContainer.add(monitorText)

    // Coffee mug
    const mugBody = this.scene.add.rectangle(22, WS_DESK_Y - 3, 5, 6, 0x8b5cf6).setStrokeStyle(0.5, 0x6d28d9, 0.8)
    wsContainer.add(mugBody)
    const mugHandle = this.scene.add.arc(25, WS_DESK_Y - 3, 2.5, 0, 180, false, 0x000000, 0).setStrokeStyle(1, 0x8b5cf6, 0.8)
    wsContainer.add(mugHandle)

    // Coffee steam — particles spawned dynamically only while agent is idle
    // (see spawnSteamParticles / clearSteamParticles)
    const steamContainer = this.scene.add.container(22, WS_DESK_Y - 7)
    wsContainer.add(steamContainer)
    const steamTweens: Phaser.Tweens.Tween[] = []

    // Desk lamp
    const lampBase = this.scene.add.rectangle(-24, WS_DESK_Y - 2, 6, 3, 0x94a3b8)
    wsContainer.add(lampBase)
    const lampArm = this.scene.add.rectangle(-24, WS_DESK_Y - 8, 1.5, 10, 0x94a3b8)
    wsContainer.add(lampArm)
    const lampShade = this.scene.add.triangle(-24, WS_DESK_Y - 14, -5, 6, 0, -2, 5, 6, 0xfbbf24, 0.8)
    wsContainer.add(lampShade)
    const lampLight = this.scene.add.triangle(-24, WS_DESK_Y - 4, -10, 18, 0, 0, 10, 18, 0xfbbf24, 0.04)
    wsContainer.add(lampLight)

    // Desk accessories (deterministic per agent name)
    let nameHash = 0
    for (let i = 0; i < agent.config.name.length; i++) {
      nameHash = ((nameHash << 5) - nameHash) + agent.config.name.charCodeAt(i); nameHash |= 0
    }
    nameHash = Math.abs(nameHash)

    // Keyboard
    const keyboard = this.scene.add.rectangle(0, WS_DESK_Y + 2, 18, 5, 0x1e293b).setAlpha(0.8)
    wsContainer.add(keyboard)
    const kbLines = this.scene.add.graphics()
    kbLines.lineStyle(0.5, 0x334155, 0.6)
    for (let r = 0; r < 3; r++) kbLines.lineBetween(-7, WS_DESK_Y + r * 1.5, 7, WS_DESK_Y + r * 1.5)
    wsContainer.add(kbLines)

    // Desk communicator / phone — left side of desk
    const phoneBody = this.scene.add.rectangle(-20, WS_DESK_Y - 2, 4, 6, 0x334155)
    wsContainer.add(phoneBody)
    const phoneScreen = this.scene.add.rectangle(-20, WS_DESK_Y - 5, 3, 2, 0x1e293b)
    wsContainer.add(phoneScreen)
    const phoneLight = this.scene.add.arc(-18, WS_DESK_Y - 6, 1.5, 0, 360, false, 0xfbbf24, 0)
    wsContainer.add(phoneLight)

    // Sticky note (color varies)
    const stickyColors = [0x38bdf8, 0x818cf8, 0x34d399, 0xfbbf24, 0xf472b6]
    const stickyX = nameHash % 2 === 0 ? 14 : -14
    const sticky = this.scene.add.rectangle(stickyX, WS_DESK_Y - 6, 7, 6, stickyColors[nameHash % 5], 0.7)
    wsContainer.add(sticky)

    // Pencil holder (~60% of desks)
    const extraDecos: Phaser.GameObjects.GameObject[] = []
    if (nameHash % 5 >= 2) {
      const phX = nameHash % 2 === 0 ? -14 : 14
      const cup = this.scene.add.rectangle(phX, WS_DESK_Y - 5, 5, 7, 0x475569, 0.7)
      wsContainer.add(cup); extraDecos.push(cup)
      const p1 = this.scene.add.rectangle(phX - 1, WS_DESK_Y - 10, 1, 6, 0xfbbf24, 0.6).setAngle(-5)
      wsContainer.add(p1); extraDecos.push(p1)
      const p2 = this.scene.add.rectangle(phX + 1, WS_DESK_Y - 10, 1, 6, 0xef4444, 0.5).setAngle(7)
      wsContainer.add(p2); extraDecos.push(p2)
    }

    // Desk plant (~40% of desks)
    let deskPlantLeaf: Phaser.GameObjects.Arc | null = null
    if (nameHash % 5 < 2) {
      const plX = nameHash % 2 === 0 ? -16 : 16
      const pot = this.scene.add.rectangle(plX, WS_DESK_Y - 2, 5, 4, 0x475569, 0.7)
      wsContainer.add(pot); extraDecos.push(pot)
      const leaf = this.scene.add.circle(plX, WS_DESK_Y - 6, 3, 0x34d399, 0.6)
      wsContainer.add(leaf); extraDecos.push(leaf)
      deskPlantLeaf = leaf
    }

    // LED underglow strip — drawn just beneath the desk body
    const ledGlow = this.scene.add.graphics()
    ledGlow.fillStyle(activeTheme.deskStrokeIdle, 0.3)
    ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
    wsContainer.add(ledGlow)

    // Task completion counter — 14×8px pill at top-right of the desk surface.
    // bg rect at (26, WS_DESK_Y - 12); text centered inside at (33, WS_DESK_Y - 8).
    // Color tiers: 0 = hidden, 1-4 = gray, 5-9 = blue, 10+ = gold.
    const taskCountBg = this.scene.add.graphics()
    taskCountBg.fillStyle(0x0f172a, 0.6)
    taskCountBg.fillRoundedRect(0, 0, 14, 8, 2)
    taskCountBg.setPosition(26, WS_DESK_Y - 12)
    taskCountBg.setAlpha(0)        // hidden until first task completes
    wsContainer.add(taskCountBg)

    const taskCountText = this.scene.add.text(33, WS_DESK_Y - 8, '0', {
      fontSize: '5px',
      fontFamily: 'system-ui, monospace',
      color: '#64748b',
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
      mugBody, mugHandle, steamContainer, lampBase, lampArm, lampShade, lampLight,
      ...extraDecos, ledGlow, monitorText,
      phoneBody, phoneScreen, phoneLight,
      taskCountBg, taskCountText,
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
    const sprite  = this.scene.add.sprite(0, WS_SPRITE_Y, 'characters', frame)
    sprite.setScale(CHAR_SCALE).setOrigin(0.5, 1)
    wsContainer.add(sprite)

    // Thought bubble — dark card with accent border and live blurb text
    const thoughtBubbleBg = this.scene.add.graphics()
    const thoughtBubbleText = this.scene.add.text(0, 0, '', {
      fontSize: '9px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
      wordWrap: { width: 90, useAdvancedWrap: false },
      align: 'left', resolution: 2, lineSpacing: 1,
    }).setOrigin(0.5)
    const thoughtBubble = this.scene.add.container(4, WS_SPRITE_Y - 60, [thoughtBubbleBg, thoughtBubbleText]).setVisible(false)
    wsContainer.add(thoughtBubble)

    // Show persona name (e.g. "Marcus Chen") instead of title
    const nameText = this.scene.add.text(0, WS_NAME_Y, '', {
      fontSize: '11px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0f172acc', padding: { x: 4, y: 2 }, align: 'center',
      resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(nameText)

    const dotColor  = this.host.getStatusColor(agent)
    const statusDot = this.scene.add.circle(nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y, 3.5, dotColor).setVisible(false)
    wsContainer.add(statusDot)

    // Role badge (S / R / E) — shown when agent has a pod role assigned.
    // Sits to the left of the name tag; revealed/hidden in updateWorkstation.
    const roleBadge = this.scene.add.text(-28, WS_NAME_Y, '', {
      fontSize: '7px', color: '#0f172a', fontFamily: 'system-ui, monospace',
      fontStyle: 'bold', backgroundColor: '#3b82f6',
      padding: { x: 3, y: 1 }, resolution: 2,
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(roleBadge)
    lodLevel3Objects.push(roleBadge)

    // Uptime indicator — tiny dim counter just below the name tag
    const uptimeText = this.scene.add.text(0, WS_NAME_Y + 12, '', {
      fontSize: '6px', color: '#475569', fontFamily: 'system-ui, monospace',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setAlpha(0.7).setVisible(false)
    wsContainer.add(uptimeText)
    lodLevel3Objects.push(uptimeText)

    // XP progress bar — thin strip below the name tag
    const XP_BAR_W  = 30
    const XP_BAR_H  = 3
    const XP_BAR_Y  = WS_NAME_Y + 14

    const xpBarBg = this.scene.add.rectangle(0, XP_BAR_Y, XP_BAR_W, XP_BAR_H, 0x1e293b)
      .setOrigin(0.5).setAlpha(0.6).setVisible(false)
    wsContainer.add(xpBarBg)

    const xpBarFill = this.scene.add.rectangle(-XP_BAR_W / 2, XP_BAR_Y, 0, XP_BAR_H, 0x3b82f6)
      .setOrigin(0, 0.5).setVisible(false)
    wsContainer.add(xpBarFill)

    const XP_TEXT_Y = XP_BAR_Y + 6
    const xpBarText = this.scene.add.text(0, XP_TEXT_Y, '', {
      fontSize: '5px', color: '#64748b', fontFamily: 'system-ui, sans-serif',
      resolution: 2, align: 'center',
    }).setOrigin(0.5).setVisible(false)
    wsContainer.add(xpBarText)

    lodLevel3Objects.push(xpBarBg, xpBarFill, xpBarText)

    // "Blocked" clarity marker for needsInteraction agents.
    const blockedIndicatorPulse = this.scene.add.circle(0, 0, 10, 0xfbbf24, 0.16)
    const blockedIndicatorStem = this.scene.add.rectangle(0, 8, 1.5, 7, 0xfbbf24, 0.55)
    const blockedIndicatorBadge = this.scene.add.circle(0, 0, 6.5, 0xfbbf24, 0.95)
    const blockedIndicatorText = this.scene.add.text(0, -0.5, '!', {
      fontSize: '10px',
      color: '#0f172a',
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

    const hitArea = this.scene.add.rectangle(0, 5, WORKSTATION_W - 6, WORKSTATION_H - 10, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    wsContainer.add(hitArea)

    const ws: WorkstationSprite = {
      container: wsContainer, sprite, nameText, statusDot, roleBadge,
      deskBody, deskTop, monitorSprite, chairSprite,
      monitorGlowFx, screenLines, screenTween,
      monitorText,
      blockedIndicator, blockedIndicatorPulse, blockedIndicatorBadge, blockedIndicatorStem, blockedIndicatorText,
      thoughtBubble, thoughtBubbleText, thoughtBubbleBg, state: agent,
      steamTweens, steamContainer,
      ledGlow,
      moodEmoji,
      soundWaveGfx,
      sparklineGfx,
      shadow,
      activityHistory: [],
      phoneLight,
      progressRing,
      lodLevel2Objects,
      lodLevel3Objects,
      xpBarBg,
      xpBarFill,
      xpBarText,
      uptimeText,
      taskCountBg,
      taskCountText,
      localTaskCount: 0,
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
      this.restoreDeskStroke(ws)
      this.host.clearHoverRing()
      this.host.hideTooltip()
    })

    this.updateWorkstation(ws, agent)

    // --- Entrance animation ---
    wsContainer.setAlpha(0.3).setScale(0.85)
    this.scene.tweens.add({
      targets: wsContainer,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 250, ease: 'Back.easeOut',
      onComplete: () => {
        if (wsContainer.active) { wsContainer.setAlpha(1).setScale(1) }
      },
    })
    this.host.queueMinimapRoomFlash(room.cwd, 0x34d399, 1500)

    return ws
  }

  // ---------------------------------------------------------------------------
  // updateWorkstation — updates workstation state from agent data, fires toasts
  // ---------------------------------------------------------------------------

  updateWorkstation(ws: WorkstationSprite, agent: AgentState): void {
    // If agent is on a coffee run, keep desk sprite hidden and skip all visual updates
    if (this.host.isCoffeeRunActive(agent.config.id)) {
      const m = agent.sessionMode
      if (m === 'working' || m === 'plan' || m === 'compressing' || m === 'accept-edits' || agent.status === 'active') {
        this.host.cancelCoffeeRun(agent.config.id)
        ws.sprite.setVisible(true)
        this.removeCoffeeIndicator(ws)
      } else {
        ws.sprite.setVisible(false)
        this.ensureCoffeeIndicator(ws)
        ws.state = agent
        return
      }
    } else {
      this.removeCoffeeIndicator(ws)
    }
    if (ws.container.alpha < 0.9) ws.container.setAlpha(1)
    if (ws.container.scaleX < 0.9) ws.container.setScale(1)

    // Skip redundant updates — fingerprint the fields that affect visuals
    const blurbSnippet = agent.lastAssistantBlurb?.slice(0, 20) ?? ''
    const fp = `${agent.status}|${agent.sessionMode}|${agent.needsInteraction}|${agent.interactionType}|${agent.config.name}|${blurbSnippet}|${agent.uptime ?? ''}`
    if (ws.lastStateFingerprint === fp) {
      ws.state = agent
      return
    }
    // Fire toasts on meaningful state transitions
    const prevState = ws.state
    ws.lastStateFingerprint = fp
    ws.state = agent

    if (prevState) {
      const name = agent.config.name.split(' ')[0]
      const wasWorking = (prevState.sessionMode === 'working' || prevState.sessionMode === 'plan') && !prevState.needsInteraction
      const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !agent.needsInteraction
      const roomKey = agent.cwd ?? '__unassigned__'
      if (agent.needsInteraction && !prevState.needsInteraction) {
        this.host.queueMinimapRoomFlash(roomKey, COLOR_LED_AMBER, 1600)
        if (agent.interactionType === 'accept-edits') {
          this.host.showToast(`${name} has edits to review`, 'info')
        } else if (agent.interactionType === 'question') {
          this.host.showToast(`${name} asked a question`, 'warning')
        } else if (agent.interactionType === 'tool-approval') {
          this.host.showToast(`${name} needs approval`, 'warning')
        }
        // Spawn a sound-wave ripple at the workstation world position (once per blocked state entry)
        if (!ws.rippleFired) {
          ws.rippleFired = true
          const room = this.host.getRooms().get(roomKey)
          if (room) {
            const wx = room.x + ws.container.x
            const wy = room.y + ws.container.y
            let rippleColor = 0xfbbf24 // default amber
            if (agent.interactionType === 'tool-approval') rippleColor = 0xf97316
            else if (agent.interactionType === 'question') rippleColor = 0x60a5fa
            else if (agent.interactionType === 'accept-edits') rippleColor = 0x3b82f6
            this.host.spawnAlertRipple(wx, wy, rippleColor)
            this.host.spawnEmojiReaction(wx, wy, '\uD83D\uDD14') // blocked: 🔔
          }
        }
      } else if (!agent.needsInteraction && prevState.needsInteraction) {
        // Reset ripple guard so the next blocked event fires a fresh ripple
        ws.rippleFired = false
        const roomU = this.host.getRooms().get(roomKey)
        if (roomU) this.host.spawnEmojiReaction(roomU.x + ws.container.x, roomU.y + ws.container.y, '\uD83D\uDC4D') // unblocked: 👍
      }

      if (wasWorking && !isWorking && !agent.needsInteraction) {
        this.host.queueMinimapRoomFlash(roomKey, COLOR_LED_GREEN, 1200)
        this.host.showToast(`${name} finished task`, 'success')
        const roomC = this.host.getRooms().get(roomKey)
        if (roomC) this.host.spawnEmojiReaction(roomC.x + ws.container.x, roomC.y + ws.container.y, '\u2705') // completed: ✅
      } else if (!wasWorking && isWorking) {
        this.host.queueMinimapRoomFlash(roomKey, COLOR_DOOR_FRAME, 900)
        this.host.showToast(`${name} started working`, 'info')
        const roomS = this.host.getRooms().get(roomKey)
        if (roomS) this.host.spawnEmojiReaction(roomS.x + ws.container.x, roomS.y + ws.container.y, '\u26A1') // started: ⚡
      }

      // Plan mode entry
      if (agent.sessionMode === 'plan' && prevState.sessionMode !== 'plan') {
        const roomP = this.host.getRooms().get(roomKey)
        if (roomP) this.host.spawnEmojiReaction(roomP.x + ws.container.x, roomP.y + ws.container.y, '\uD83D\uDCCB') // plan: 📋
      }

      // Compressing entry
      if (agent.sessionMode === 'compressing' && prevState.sessionMode !== 'compressing') {
        const roomZ = this.host.getRooms().get(roomKey)
        if (roomZ) this.host.spawnEmojiReaction(roomZ.x + ws.container.x, roomZ.y + ws.container.y, '\uD83D\uDCA8') // compressing: 💨
      }
    }

    const charIdx = this.host.getAgentCharacterIndex(agent)
    ws.sprite.setFrame(this.host.getPoseFrame(charIdx, agent))

    const dotColor = this.host.getStatusColor(agent)
    ws.statusDot.setFillStyle(dotColor)
    ws.statusDot.setPosition(ws.nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y)

    ws.nameText.setVisible(true)
    ws.statusDot.setVisible(true)

    const isWaiting = agent.needsInteraction
    const isPlan = agent.sessionMode === 'plan'
    const isAcceptEdits = agent.interactionType === 'accept-edits' && isWaiting
    const isWorking = (agent.sessionMode === 'working' || isPlan) && !isWaiting

    // ── Name tag color + background tint based on state ──────────────────────
    const nameColor = isWorking ? '#34d399' : isWaiting ? '#fbbf24' : isPlan ? '#a78bfa' : '#94a3b8'
    const nameBg    = isWorking ? '#071a0f' : isWaiting ? '#1a1500' : '#0f172acc'
    ws.nameText.setColor(nameColor).setBackgroundColor(nameBg)

    // ── Role badge (S / R / E) ────────────────────────────────────────────────
    if (ws.roleBadge) {
      const podRole = agent.config.tripletRole
      if (podRole) {
        const roleLabel = podRole === 'solver' ? 'S' : podRole === 'reviewer' ? 'R' : 'E'
        const roleBgColor: Record<string, string> = { solver: '#3b82f6', reviewer: '#8b5cf6', executor: '#22c55e' }
        ws.roleBadge.setText(roleLabel).setBackgroundColor(roleBgColor[podRole] ?? '#475569').setVisible(true)

        // Pulse the badge when this agent is actively part of a running pod
        const podLines = this.host.getPodLines()
        const isInActivePod = podLines.some(t => {
          const isActive = t.status === 'solving' || t.status === 'reviewing' || t.status === 'executing' || t.status === 'feedback'
          const agentId = agent.config.id
          return isActive && (t.solverAgentId === agentId || t.reviewerAgentId === agentId || t.executorAgentId === agentId)
        })
        if (isInActivePod) {
          if (!ws.roleBadgePulseTween || !ws.roleBadgePulseTween.isPlaying()) {
            ws.roleBadgePulseTween?.destroy()
            ws.roleBadgePulseTween = this.scene.tweens.add({
              targets: ws.roleBadge,
              alpha: { from: 1, to: 0.35 },
              duration: 600,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        } else {
          ws.roleBadgePulseTween?.destroy()
          ws.roleBadgePulseTween = undefined
          ws.roleBadge.setAlpha(0.75)
        }
      } else {
        ws.roleBadgePulseTween?.destroy()
        ws.roleBadgePulseTween = undefined
        ws.roleBadge.setVisible(false).setAlpha(1)
      }
    }

    // ── Uptime counter ────────────────────────────────────────────────────────
    if (ws.uptimeText) {
      if (agent.uptime) {
        ws.uptimeText.setText(agent.uptime).setVisible(true)
      } else {
        ws.uptimeText.setVisible(false)
      }
    }

    // Screen content
    if (isWorking && ws.screenLines && ws.screenTween) {
      ws.screenLines.setVisible(true); ws.screenTween.resume()
    } else if (ws.screenLines) {
      ws.screenLines.setVisible(false); ws.screenTween?.pause()
    }

    if (ws.monitorSprite) {
      ws.monitorSprite.setTint(isWorking ? 0x0ea5e9 : isWaiting ? 0xf59e0b : 0xffffff)
      ws.monitorSprite.setAlpha(isWorking ? 0.95 : isWaiting ? 0.9 : 0.7)
    }

    // Monitor blurb text — show a snippet of the agent's last assistant message
    if (ws.monitorText) {
      // Kill any existing scroll tween on this text
      if (ws.monitorTextTween) {
        ws.monitorTextTween.destroy()
        ws.monitorTextTween = undefined
      }

      if (isWorking && agent.lastAssistantBlurb) {
        const snippet = agent.lastAssistantBlurb.slice(0, 20)
        ws.monitorText
          .setText(snippet)
          .setColor('#0ea5e9')
          .setAlpha(0.7)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
        // Scroll text upward and reset in a repeating loop to simulate activity
        ws.monitorTextTween = this.scene.tweens.add({
          targets: ws.monitorText,
          y: WS_MONITOR_Y - 4,
          duration: 3000,
          ease: 'Linear',
          repeat: -1,
          onRepeat: () => { if (ws.monitorText?.active) ws.monitorText.setY(WS_MONITOR_Y - 1) },
        })
      } else if (isWaiting) {
        ws.monitorText
          .setText('!')
          .setColor('#fbbf24')
          .setAlpha(0.9)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
        // Pulse alpha for waiting state
        ws.monitorTextTween = this.scene.tweens.add({
          targets: ws.monitorText,
          alpha: 0.3,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else {
        // Idle — show first word of last blurb dimly, or "idle"
        const idleText = agent.lastAssistantBlurb
          ? agent.lastAssistantBlurb.split(/\s+/)[0].slice(0, 8)
          : 'idle'
        ws.monitorText
          .setText(idleText)
          .setColor('#64748b')
          .setAlpha(0.5)
          .setY(WS_MONITOR_Y - 1)
          .setVisible(true)
      }
    }

    this.updateBlockedIndicator(ws, agent)

    // Thought bubble — delegate to rich update method
    // Thought bubbles disabled — too small to read at game scale, adds visual noise
    // this.updateThoughtBubble(ws, agent, shouldShow, accentColor, isWorking)
    if (ws.thoughtBubble) ws.thoughtBubble.setVisible(false)

    this.updateAnimation(ws, agent)
    this.updateMood(ws, agent)

    // XP progress bar — update fill width and rank label
    if (ws.xpBarBg && ws.xpBarFill && ws.xpBarText && agent.xp) {
      const xp = agent.xp
      const currentRankIdx = XP_RANKS.findIndex(r => r.level === xp.level)
      const currentMin = getXPForLevel(xp.level)
      const nextMin =
        currentRankIdx >= 0 && currentRankIdx < XP_RANKS.length - 1
          ? XP_RANKS[currentRankIdx + 1].minXP
          : currentMin + 500
      const pct =
        nextMin > currentMin
          ? Math.min(1, Math.max(0, (xp.totalXP - currentMin) / (nextMin - currentMin)))
          : 1
      const XP_BAR_W = 30
      const targetW  = Math.max(0, Math.floor(XP_BAR_W * pct))
      const fillColor = xp.level >= 8 ? 0xf59e0b : xp.level >= 5 ? 0xa855f7 : 0x3b82f6

      ws.xpBarBg.setVisible(true)
      ws.xpBarFill.setFillStyle(fillColor).setVisible(true)
      ws.xpBarText.setText(xp.rank).setVisible(true)

      if (ws.xpBarTween) { ws.xpBarTween.destroy(); ws.xpBarTween = undefined }
      ws.xpBarTween = this.scene.tweens.add({
        targets: ws.xpBarFill,
        displayWidth: targetW,
        duration: 300,
        ease: 'Power2',
      })
    } else if (ws.xpBarBg) {
      ws.xpBarBg.setVisible(false)
      ws.xpBarFill?.setVisible(false)
      ws.xpBarText?.setVisible(false)
    }

    // Productivity sparkline — track activity and redraw only when value changes
    if (ws.sparklineGfx) {
      const newValue = isWorking ? 1 : isWaiting ? 0.5 : 0
      const history  = ws.activityHistory ?? []
      const lastVal  = history.length > 0 ? history[history.length - 1] : undefined

      if (lastVal !== newValue) {
        history.push(newValue)
        if (history.length > 20) history.shift()
        ws.activityHistory = history

        const gfx  = ws.sparklineGfx
        const W    = 20
        const H    = 8
        const n    = history.length
        const toY  = (v: number) => H - v * H

        gfx.clear()

        if (n >= 2) {
          // Axis lines at 0.15 alpha
          gfx.lineStyle(0.5, 0x475569, 0.15)
          gfx.beginPath()
          gfx.moveTo(0, H); gfx.lineTo(W, H)
          gfx.moveTo(0, H / 2); gfx.lineTo(W, H / 2)
          gfx.strokePath()

          for (let i = 1; i < n; i++) {
            const x0 = ((i - 1) / (n - 1)) * W
            const x1 = (i       / (n - 1)) * W
            const y0 = toY(history[i - 1])
            const y1 = toY(history[i])
            const v1 = history[i]
            const col = v1 >= 1 ? 0x34d399 : v1 >= 0.5 ? 0xfbbf24 : 0x475569

            // Polyline segment
            gfx.lineStyle(1, col, 0.85)
            gfx.beginPath()
            gfx.moveTo(x0, y0)
            gfx.lineTo(x1, y1)
            gfx.strokePath()

            // Area fill below at 0.05 alpha
            gfx.fillStyle(col, 0.05)
            gfx.beginPath()
            gfx.moveTo(x0, H)
            gfx.lineTo(x0, y0)
            gfx.lineTo(x1, y1)
            gfx.lineTo(x1, H)
            gfx.closePath()
            gfx.fillPath()
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // layoutWorkstations — positions workstations in a grid within a room
  // ---------------------------------------------------------------------------

  layoutWorkstations(room: Room): void {
    const agents = Array.from(room.workstations.values())
    const count  = agents.length
    if (count === 0) return

    const cols = Math.min(count, MAX_AGENTS_PER_ROW)
    const rows = Math.ceil(count / cols)

    const WALL_T = 8
    const WALL_I = 4
    const floorStartX = -room.width  / 2 + WALL_T + WALL_I + ROOM_PADDING
    const floorStartY = -room.height / 2 + WALL_T + WALL_I + ROOM_HEADER_H + ROOM_PADDING + ROOM_TOP_EXTRA

    const usableW = room.width  - (WALL_T + WALL_I + ROOM_PADDING) * 2
    const usableH = room.height - (WALL_T + WALL_I) * 2 - ROOM_HEADER_H - ROOM_PADDING * 2 - ROOM_TOP_EXTRA

    const cellW = usableW / cols
    const cellH = usableH / rows

    agents.forEach((ws, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx  = floorStartX + col * cellW + cellW / 2
      const cy  = floorStartY + row * cellH + cellH / 2

      this.scene.tweens.killTweensOf(ws.container)
      this.scene.tweens.add({ targets: ws.container, x: cx, y: cy, duration: 280, ease: 'Power2' })
      ws.container.setDepth(cy + room.y)
    })
  }

  // ---------------------------------------------------------------------------
  // destroyWorkstation — cleanup
  // ---------------------------------------------------------------------------

  destroyWorkstation(ws: WorkstationSprite): void {
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
    if (ws.moodTween) ws.moodTween.destroy()
    if (ws.moodEmoji) this.scene.tweens.killTweensOf(ws.moodEmoji)
    if (ws.deskPlantTween)   ws.deskPlantTween.destroy()
    if (ws.xpBarTween)       ws.xpBarTween.destroy()
    if (ws.soundWaveTween)   ws.soundWaveTween.destroy()
    if (ws.soundWaveGfx)     ws.soundWaveGfx.destroy()
    if (ws.shadow)           ws.shadow.destroy()
    if (ws.sparklineGfx)     { ws.sparklineGfx.clear(); ws.sparklineGfx.destroy() }
    if (ws.phoneLightTween)      ws.phoneLightTween.destroy()
    if (ws.progressRingTween)    ws.progressRingTween.destroy()
    if (ws.progressRing)         { ws.progressRing.clear(); ws.progressRing.destroy() }
    if (ws.roleBadgePulseTween)  ws.roleBadgePulseTween.destroy()
    if (ws.taskCountFlashTween)  ws.taskCountFlashTween.destroy()
    if (ws.taskCountBg)          { ws.taskCountBg.clear(); ws.taskCountBg.destroy() }
    if (ws.taskCountText)        ws.taskCountText.destroy()
    ws.activityHistory = []

    // Exit animation: shrink + fade, then destroy.
    // Detach from room container first so deferred destroy can't interfere with layout.
    try {
      const agentName = ws.state?.config.name || 'Agent'
      if (ws.container.active && this.scene.scene.isActive()) {
        const parent = ws.container.parentContainer
        if (parent) parent.remove(ws.container)
        this.host.showToast(`${agentName} left`, 'info')
        this.scene.tweens.add({
          targets: ws.container,
          alpha: 0, scaleX: 0.3, scaleY: 0.3,
          duration: 300, ease: 'Quad.easeIn',
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
  // refreshTaskCountDisplay — task count badge updates
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
  refreshTaskCountDisplay(ws: WorkstationSprite): void {
    const { taskCountBg, taskCountText, localTaskCount: count } = ws
    if (!taskCountBg || !taskCountText) return

    // Determine tier color
    let tierColor: string
    if (count >= 10) {
      tierColor = '#fbbf24'  // gold — champion
    } else if (count >= 5) {
      tierColor = '#3b82f6'  // blue — productive
    } else {
      tierColor = '#64748b'  // gray — getting started
    }

    // Make visible if this is the first completion
    if (count === 1) {
      taskCountBg.setAlpha(0.6)
      taskCountText.setAlpha(1)
    }

    // Update label text with the current count
    taskCountText.setText(String(count))

    // Kill any in-progress flash tween
    if (ws.taskCountFlashTween) {
      ws.taskCountFlashTween.destroy()
      ws.taskCountFlashTween = undefined
    }

    // Green flash on the bg, then restore; text briefly green then tier color
    taskCountText.setColor('#34d399')
    taskCountBg.setAlpha(1)

    ws.taskCountFlashTween = this.scene.tweens.add({
      targets: taskCountBg,
      alpha: { from: 1, to: 0.6 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        ws.taskCountFlashTween = undefined
        // Restore text to tier color after flash settles
        if (taskCountText.active) taskCountText.setColor(tierColor)
      },
    })

    // After a short delay, snap text color to tier color if flash completed early
    this.scene.time.delayedCall(500, () => {
      if (taskCountText.active) taskCountText.setColor(tierColor)
    })
  }

  // ---------------------------------------------------------------------------
  // Mood indicator
  // ---------------------------------------------------------------------------

  getAgentMood(agent: AgentState): { emoji: string; color: string } {
    if (agent.needsInteraction && agent.interactionType === 'tool-approval') {
      return { emoji: '😤', color: '#f97316' }
    }
    if (agent.needsInteraction && agent.interactionType === 'question') {
      return { emoji: '🤔', color: '#60a5fa' }
    }
    if (agent.sessionMode === 'working') {
      return { emoji: '💻', color: '#34d399' }
    }
    if (agent.sessionMode === 'plan') {
      return { emoji: '🧠', color: '#a78bfa' }
    }
    if (agent.sessionMode === 'compressing') {
      return { emoji: '😵', color: '#f87171' }
    }
    return { emoji: '☕', color: '#64748b' }
  }

  updateMood(ws: WorkstationSprite, agent: AgentState): void {
    if (!ws.moodEmoji) return
    const { emoji } = this.getAgentMood(agent)
    const currentEmoji = ws.moodEmoji.getData('currentEmoji') as string | undefined

    if (currentEmoji === emoji) return

    // Emoji changed — stop existing float tween, fade out, then swap and bounce in
    if (ws.moodTween) {
      ws.moodTween.destroy()
      ws.moodTween = undefined
    }

    const moodText = ws.moodEmoji
    moodText.setData('currentEmoji', emoji)

    // Fade out current emoji, then swap and bounce in
    this.scene.tweens.add({
      targets: moodText,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!moodText.active) return
        moodText.setText(emoji)
        moodText.setScale(0)
        // Bounce in: 0 → 1.2 → 1
        this.scene.tweens.add({
          targets: moodText,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 1,
          duration: 180,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!moodText.active) return
            this.scene.tweens.add({
              targets: moodText,
              scaleX: 1,
              scaleY: 1,
              duration: 120,
              ease: 'Sine.easeOut',
              onComplete: () => {
                if (!moodText.active) return
                // Gentle infinite float: oscillate y ±2px
                const baseY = moodText.y
                ws.moodTween = this.scene.tweens.add({
                  targets: moodText,
                  y: baseY - 2,
                  duration: 2000,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                })
              },
            })
          },
        })
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Thought bubble — rich live-text with typing animation, auto-sizing, and fade
  // ---------------------------------------------------------------------------

  drawThoughtBubbleBg(ws: WorkstationSprite, accentColor: number): void {
    const PAD_X = 8
    const PAD_Y = 5
    const ACCENT_W = 3
    const CORNER = 5

    const tw = ws.thoughtBubbleText.width
    const th = ws.thoughtBubbleText.height
    const bw = tw + PAD_X * 2 + ACCENT_W
    const bh = th + PAD_Y * 2

    ws.thoughtBubbleText.setPosition(ACCENT_W / 2 + PAD_X / 2, 0)

    const g = ws.thoughtBubbleBg
    g.clear()

    // Dark background card
    g.fillStyle(0x0f172a, 0.92)
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, CORNER)

    // Accent left border
    g.fillStyle(accentColor, 0.9)
    g.fillRoundedRect(-bw / 2, -bh / 2, ACCENT_W, bh, CORNER)

    // Downward tail
    const tailW = 6
    const tailH = 6
    const tailY = bh / 2
    g.fillStyle(0x0f172a, 0.92)
    g.fillTriangle(-tailW / 2, tailY, tailW / 2, tailY, 0, tailY + tailH)
  }

  updateThoughtBubble(
    ws: WorkstationSprite,
    agent: AgentState,
    shouldShow: boolean,
    accentColor: number,
    isWorking: boolean,
  ): void {
    if (!shouldShow) {
      this.scene.tweens.killTweensOf(ws.thoughtBubble)
      ws.thoughtBubble.setVisible(false)
      return
    }

    const rawBlurb = (agent.lastAssistantBlurb ?? '').trim()
    const MAX_CHARS = 60
    let displayText: string

    if (rawBlurb) {
      displayText = rawBlurb.length > MAX_CHARS ? rawBlurb.slice(0, MAX_CHARS) + '...' : rawBlurb
    } else if (agent.sessionMode === 'compressing') {
      displayText = 'compressing...'
    } else if (agent.sessionMode === 'plan') {
      displayText = 'planning...'
    } else if (agent.needsInteraction) {
      displayText = 'waiting for input'
    } else if (agent.sessionMode === 'working' || !agent.sessionMode) {
      displayText = 'working...'
    } else {
      displayText = '\u2615 idle'
    }

    const blurbChanged = ws.lastShownBlurb !== displayText
    ws.lastShownBlurb = displayText

    if (ws.blurbFadeTimer) {
      ws.blurbFadeTimer.destroy()
      ws.blurbFadeTimer = undefined
    }

    ws.thoughtBubble.setVisible(true)
    this.scene.tweens.killTweensOf(ws.thoughtBubble)
    ws.thoughtBubble.setAlpha(1)

    const baseY = WS_SPRITE_Y - 62

    if (blurbChanged && rawBlurb) {
      if (ws.blurbTypingTween) {
        ws.blurbTypingTween.destroy()
        ws.blurbTypingTween = undefined
      }
      ws.thoughtBubbleText.setText('')
      ws.thoughtBubble.y = baseY
      this.drawThoughtBubbleBg(ws, accentColor)

      const counter = { val: 0 }
      ws.blurbTypingTween = this.scene.tweens.add({
        targets: counter,
        val: displayText.length,
        duration: Math.min(500, displayText.length * 18),
        ease: 'Linear',
        onUpdate: () => {
          ws.thoughtBubbleText.setText(displayText.slice(0, Math.floor(counter.val)))
          this.drawThoughtBubbleBg(ws, accentColor)
        },
        onComplete: () => {
          ws.thoughtBubbleText.setText(displayText)
          this.drawThoughtBubbleBg(ws, accentColor)
          ws.blurbTypingTween = undefined
        },
      })
    } else {
      ws.thoughtBubbleText.setText(displayText)
      this.drawThoughtBubbleBg(ws, accentColor)
      ws.thoughtBubble.y = baseY
    }

    if (ws.thoughtBubbleFloatTween) {
      ws.thoughtBubbleFloatTween.destroy()
    }
    ws.thoughtBubbleFloatTween = this.scene.tweens.add({
      targets: ws.thoughtBubble,
      y: baseY - 3,
      duration: isWorking ? 1200 : 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (rawBlurb) {
      ws.blurbFadeTimer = this.scene.time.delayedCall(5000, () => {
        if (!ws.thoughtBubble.active) return
        this.scene.tweens.add({
          targets: ws.thoughtBubble,
          alpha: 0,
          duration: 300,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (ws.thoughtBubble.active) ws.thoughtBubble.setVisible(false)
          },
        })
        ws.blurbFadeTimer = undefined
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    const isWaiting = agent.needsInteraction
    const isWorking = (agent.sessionMode === 'working' || agent.sessionMode === 'plan') && !isWaiting

    const mode: 'idle' | 'working' | 'waiting' = isWaiting ? 'waiting' : isWorking ? 'working' : 'idle'
    if (ws.lastAnimMode === mode) return
    const prevMode = ws.lastAnimMode
    ws.lastAnimMode = mode

    // Tear down all animation state
    if (ws.bounceTween)      { ws.bounceTween.destroy();      ws.bounceTween      = undefined }
    if (ws.dotPulseTween)    { ws.dotPulseTween.destroy();    ws.dotPulseTween    = undefined; ws.statusDot.setAlpha(1) }
    if (ws.typingTween)      { ws.typingTween.destroy();      ws.typingTween      = undefined; ws.sprite.x = 0 }
    if (ws.monitorGlowTween) { ws.monitorGlowTween.destroy(); ws.monitorGlowTween = undefined }
    if (ws.breathTween)      { ws.breathTween.destroy();      ws.breathTween      = undefined }
    if (ws.headTiltTween)    { ws.headTiltTween.destroy();    ws.headTiltTween    = undefined }
    if (ws.pulseTween)       { ws.pulseTween.destroy();       ws.pulseTween       = undefined }
    if (ws.ledPulseTween)    { ws.ledPulseTween.destroy();    ws.ledPulseTween    = undefined }
    if (ws.walkBreakTween)   { ws.walkBreakTween.destroy();   ws.walkBreakTween   = undefined }
    if (ws.lookAroundTimer)     { ws.lookAroundTimer.destroy();     ws.lookAroundTimer     = undefined }
    if (ws.stretchTimer)        { ws.stretchTimer.destroy();        ws.stretchTimer        = undefined }
    if (ws.walkBreakTimer)      { ws.walkBreakTimer.destroy();      ws.walkBreakTimer      = undefined }
    if (ws.lookAtNeighborTimer) { ws.lookAtNeighborTimer.destroy(); ws.lookAtNeighborTimer = undefined }
    if (ws.yawnTimer)           { ws.yawnTimer.destroy();           ws.yawnTimer           = undefined }
    // Clear ambient sound-wave indicator on every mode transition; working branch re-draws it
    if (ws.soundWaveTween) { ws.soundWaveTween.destroy(); ws.soundWaveTween = undefined }
    if (ws.soundWaveGfx)   { ws.soundWaveGfx.clear(); ws.soundWaveGfx.setAlpha(1) }
    // Fade out progress ring when leaving working mode; working branch re-starts it
    if (ws.progressRingTween) { ws.progressRingTween.destroy(); ws.progressRingTween = undefined }
    if (ws.progressRing && ws.progressRing.alpha > 0) {
      this.scene.tweens.add({ targets: ws.progressRing, alpha: 0, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => { ws.progressRing?.clear() },
      })
    }
    ws.workStartTime = undefined
    // Always stop steam when transitioning; idle branch will re-spawn it
    this.host.clearSteamParticles(ws)

    // Fade out mood emoji on mode transition; updateMood will fade the new one in
    if (ws.moodTween) { ws.moodTween.destroy(); ws.moodTween = undefined }
    if (ws.moodEmoji) {
      this.scene.tweens.add({ targets: ws.moodEmoji, alpha: 0, duration: 200, ease: 'Sine.easeOut' })
    }

    ws.sprite.y = WS_SPRITE_Y
    ws.sprite.x = 0
    ws.sprite.setScale(CHAR_SCALE)
    ws.sprite.setAngle(0)

    this.updateMonitorGlow(ws, isWorking, isWaiting)

    const charIdx = this.host.getAgentCharacterIndex(agent)
    const base = charIdx * CHAR_COLS

    if (isWaiting) {
      ws.sprite.setFrame(base + POSE_IDLE)
      ws.pulseTween = this.scene.tweens.add({
        targets: ws.sprite, scaleX: CHAR_SCALE * 1.06, scaleY: CHAR_SCALE * 1.06,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.typingTween = this.scene.tweens.add({
        targets: ws.sprite, x: 1.2,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.dotPulseTween = this.scene.tweens.add({
        targets: ws.statusDot, alpha: 0.3,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // LED: waiting — amber steady glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeWaiting, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.5, duration: 300, ease: 'Sine.easeOut' })
      }
      this.restoreDeskStroke(ws)
    } else if (isWorking) {
      ws.sprite.setFrame(base + POSE_INTERACT)
      ws.typingTween = this.scene.tweens.add({
        targets: ws.sprite, x: 0.8,
        duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.bounceTween = this.scene.tweens.add({
        targets: ws.sprite, y: WS_SPRITE_Y - 2,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.headTiltTween = this.scene.tweens.add({
        targets: ws.sprite, angle: 1.5,
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.55)
      // LED: working — green pulsing glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeWorking, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.6, duration: 300, ease: 'Sine.easeOut',
          onComplete: () => {
            if (!ws.ledGlow) return
            ws.ledGlow.setAlpha(0.4)
            ws.ledPulseTween = this.scene.tweens.add({
              targets: ws.ledGlow, alpha: 0.7,
              duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }
      // Ambient sound-wave indicator — three concentric quarter-circle arcs drawn
      // to the left of the agent, suggesting keyboard/typing audio ambiance.
      if (ws.soundWaveGfx) {
        const gfx = ws.soundWaveGfx
        gfx.clear()
        gfx.lineStyle(1, 0x94a3b8, 0.15)
        gfx.beginPath()
        gfx.arc(0, 0, 3, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.lineStyle(1, 0x94a3b8, 0.10)
        gfx.beginPath()
        gfx.arc(0, 0, 5, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.lineStyle(1, 0x94a3b8, 0.05)
        gfx.beginPath()
        gfx.arc(0, 0, 7, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false)
        gfx.strokePath()
        gfx.setAlpha(1)
        ws.soundWaveTween = this.scene.tweens.add({
          targets: gfx, alpha: 0,
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }
      // Progress ring — circular arc that fills clockwise over 60 seconds.
      if (ws.progressRing) {
        ws.workStartTime = Date.now()
        const ring = ws.progressRing
        const RING_DURATION_MS = 60_000
        const RING_R = 10
        const drawRing = (progress: number) => {
          if (!ring.active) return
          ring.clear()
          // Background track
          ring.lineStyle(1.5, 0x334155, 0.3)
          ring.beginPath()
          ring.arc(0, 0, RING_R, 0, Math.PI * 2, false)
          ring.strokePath()
          // Filled arc from top (-90deg) clockwise
          const fill = Math.min(progress, 1)
          if (fill > 0) {
            const arcColor = fill < 0.8 ? 0x34d399 : 0xfbbf24
            ring.lineStyle(1.5, arcColor, 0.5)
            ring.beginPath()
            ring.arc(0, 0, RING_R,
              Phaser.Math.DegToRad(-90),
              Phaser.Math.DegToRad(fill * 360 - 90),
              false,
            )
            ring.strokePath()
          }
        }
        // Fade in, then start counter tween 0->100 over RING_DURATION_MS
        ring.setAlpha(0)
        drawRing(0)
        this.scene.tweens.add({ targets: ring, alpha: 1, duration: 400, ease: 'Sine.easeOut' })
        ws.progressRingTween = this.scene.tweens.addCounter({
          from: 0, to: 100,
          duration: RING_DURATION_MS,
          ease: 'Linear',
          onUpdate: (tw) => {
            const pct = tw.getValue() / 100
            drawRing(pct)
          },
          onComplete: () => {
            // Ring is full — pulse alpha to signal overtime
            drawRing(1)
            ws.progressRingTween = this.scene.tweens.add({
              targets: ring, alpha: 0.35,
              duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            })
          },
        })
      }
    } else {
      ws.sprite.setFrame(base + POSE_SIT)
      ws.breathTween = this.scene.tweens.add({
        targets: ws.sprite, scaleY: CHAR_SCALE * 0.97,
        duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      // LED: idle — muted dim glow
      if (ws.ledGlow) {
        ws.ledGlow.clear()
        ws.ledGlow.fillStyle(activeTheme.deskStrokeIdle, 1)
        ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
        this.scene.tweens.add({ targets: ws.ledGlow, alpha: 0.1, duration: 600, ease: 'Sine.easeOut' })
      }
      this.restoreDeskStroke(ws)

      // Spawn coffee steam — agent is relaxing, mug is hot
      this.host.spawnSteamParticles(ws)

      // "Just finished" bounce + confetti when transitioning from working→idle
      if (prevMode === 'working') {
        this.scene.tweens.add({
          targets: ws.sprite, y: WS_SPRITE_Y - 6,
          duration: 200, yoyo: true, ease: 'Back.easeOut',
          onComplete: () => { ws.sprite.y = WS_SPRITE_Y },
        })
        // Find the room that owns this workstation to compute world position
        for (const room of this.host.getRooms().values()) {
          if (room.workstations.has(agent.config.id)) {
            const worldX = room.x + ws.container.x
            const worldY = room.y + ws.container.y - 16  // slightly above the agent head
            this.host.burstConfetti(worldX, worldY)
            break
          }
        }

        // Task completion tally — increment counter and refresh the desk badge
        ws.localTaskCount++
        this.refreshTaskCountDisplay(ws)
      }

      // Stamp idleSince so later timers can detect prolonged boredom
      ws.sprite.setData('idleSince', Date.now())

      // Head tilt: tween angle -4..+4 degrees every 8-15s, hold 1s, return to 0
      ws.lookAroundTimer = this.scene.time.addEvent({
        delay: 8000 + Math.random() * 7000,
        loop: true,
        callback: () => {
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          const angle = (Math.random() - 0.5) * 8   // -4 to +4 degrees
          ws.headTiltTween = this.scene.tweens.add({
            targets: ws.sprite, angle,
            duration: 400, hold: 1000, yoyo: true, ease: 'Sine.easeInOut',
            onComplete: () => { ws.sprite.setAngle(0); ws.headTiltTween = undefined },
          })
        },
      })

      // Stretch: scaleY 1→1.04 over 300ms, hold 200ms, back to 1 every 20-30s
      ws.stretchTimer = this.scene.time.addEvent({
        delay: 20000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          this.scene.tweens.add({
            targets: ws.sprite,
            scaleY: CHAR_SCALE * 1.04,
            duration: 300, ease: 'Sine.easeOut',
            onComplete: () => {
              this.scene.time.delayedCall(200, () => {
                this.scene.tweens.add({
                  targets: ws.sprite,
                  scaleY: CHAR_SCALE,
                  duration: 300, ease: 'Sine.easeIn',
                })
              })
            },
          })
        },
      })

      // Look at neighbor: tilt -3/+3 degrees toward a working peer every 12-18s
      ws.lookAtNeighborTimer = this.scene.time.addEvent({
        delay: 12000 + Math.random() * 6000,
        loop: true,
        callback: () => {
          if (ws.walkBreakTween || ws.headTiltTween) return
          let neighborContainerX: number | null = null
          for (const room of this.host.getRooms().values()) {
            if (!room.workstations.has(agent.config.id)) continue
            for (const [otherId, otherWs] of room.workstations) {
              if (otherId === agent.config.id) continue
              const otherMode = otherWs.state?.sessionMode
              const isOtherWorking =
                (otherMode === 'working' || otherMode === 'plan') &&
                !otherWs.state?.needsInteraction
              if (isOtherWorking) {
                neighborContainerX = otherWs.container.x
                break
              }
            }
            break
          }
          if (neighborContainerX === null) return
          const tiltAngle = neighborContainerX < ws.container.x ? -3 : 3
          if (ws.headTiltTween) ws.headTiltTween.destroy()
          ws.headTiltTween = this.scene.tweens.add({
            targets: ws.sprite, angle: tiltAngle,
            duration: 350, ease: 'Sine.easeOut',
            onComplete: () => {
              this.scene.time.delayedCall(2000, () => {
                this.scene.tweens.add({
                  targets: ws.sprite, angle: 0,
                  duration: 350, ease: 'Sine.easeIn',
                  onComplete: () => { ws.headTiltTween = undefined },
                })
              })
            },
          })
        },
      })

      // Yawn/bored pose: after 60s+ idle, briefly switch to POSE_INTERACT (fidget) for 1.5s
      ws.yawnTimer = this.scene.time.addEvent({
        delay: 65000 + Math.random() * 10000,
        loop: true,
        callback: () => {
          const idleSince: number = ws.sprite.getData('idleSince') ?? Date.now()
          if (Date.now() - idleSince < 60000) return
          if (ws.walkBreakTween) return
          ws.sprite.setFrame(base + POSE_INTERACT)
          this.scene.time.delayedCall(1500, () => {
            if (ws.lastAnimMode === 'idle') {
              ws.sprite.setFrame(base + POSE_SIT)
            }
          })
        },
      })

      ws.walkBreakTimer = this.scene.time.addEvent({
        delay: IDLE_WALK_BREAK_MIN_MS + Math.random() * IDLE_WALK_BREAK_VAR_MS,
        loop: true,
        callback: () => {
          if (!ws.state || ws.walkBreakTween) return
          const stillIdle =
            !ws.state.needsInteraction &&
            ws.state.sessionMode !== 'working' &&
            ws.state.sessionMode !== 'plan' &&
            ws.state.sessionMode !== 'compressing'
          if (!stillIdle) return

          const walkTargetX = Phaser.Math.Between(-IDLE_WALK_RANGE_X, IDLE_WALK_RANGE_X)
          const walkTargetY = WS_SPRITE_Y + Phaser.Math.Between(2, 8)
          ws.sprite.setFrame(base + POSE_WALK)
          ws.walkBreakTween = this.scene.tweens.add({
            targets: ws.sprite,
            x: walkTargetX,
            y: walkTargetY,
            duration: 520 + Math.random() * 240,
            yoyo: true,
            hold: 280 + Math.random() * 240,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              ws.walkBreakTween = undefined
              ws.sprite.x = 0
              ws.sprite.y = WS_SPRITE_Y
              ws.sprite.setFrame(base + POSE_SIT)
            },
          })
        },
      })
    }
  }

  updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void {
    if (ws.blockedIndicatorTween) {
      ws.blockedIndicatorTween.destroy()
      ws.blockedIndicatorTween = undefined
    }

    // Phone light: stop and hide on every re-evaluation before deciding state
    if (ws.phoneLightTween) {
      ws.phoneLightTween.destroy()
      ws.phoneLightTween = undefined
    }
    if (ws.phoneLight) {
      ws.phoneLight.setAlpha(0)
    }

    if (!agent.needsInteraction) {
      ws.blockedIndicator.setVisible(false)
      ws.blockedIndicator.setAlpha(1)
      ws.blockedIndicator.setScale(1)
      return
    }

    let color = COLOR_LED_AMBER
    let glyph = '!'
    if (agent.interactionType === 'question') {
      color = 0x60a5fa
      glyph = '?'
    } else if (agent.interactionType === 'accept-edits') {
      color = 0x3b82f6
      glyph = '~'
    } else if (agent.interactionType === 'tool-approval') {
      color = 0xf97316
      glyph = '!'
    }

    ws.blockedIndicatorBadge.setFillStyle(color, 0.95)
    ws.blockedIndicatorPulse.setFillStyle(color, 0.16)
    ws.blockedIndicatorStem.setFillStyle(color, 0.55)
    ws.blockedIndicatorText.setText(glyph)
    ws.blockedIndicator.setVisible(true)

    ws.blockedIndicatorTween = this.scene.tweens.add({
      targets: ws.blockedIndicator,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.78,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Phone notification light — blink the desk communicator dot in interaction-type color
    if (ws.phoneLight) {
      ws.phoneLight.setFillStyle(color, 1)
      ws.phoneLight.setAlpha(0)
      ws.phoneLightTween = this.scene.tweens.add({
        targets: ws.phoneLight,
        alpha: { from: 0, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void {
    if (!ws.monitorGlowFx) return
    const isActive = isWorking || isWaiting
    const baseColor = isWaiting ? 0xfbbf24 : isWorking ? 0x0ea5e9 : 0x94a3b8
    const baseStrength = isActive ? 3 : 1
    const peakStrength = isActive ? 6 : 2
    const duration     = isActive ? 800 : 2400
    ws.monitorGlowFx.color = baseColor
    ws.monitorGlowFx.outerStrength = baseStrength
    ws.monitorGlowTween = this.scene.tweens.add({
      targets: ws.monitorGlowFx, outerStrength: peakStrength,
      duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  /** Show a small coffee cup emoji on the desk when the agent is at the cafe */
  private ensureCoffeeIndicator(ws: WorkstationSprite): void {
    if (ws.coffeeIndicator) return
    const indicator = this.scene.add.text(0, WS_SPRITE_Y - 8, '\u2615', {
      fontSize: '14px', resolution: 2,
    }).setOrigin(0.5).setAlpha(0.8)
    ws.container.add(indicator)
    ws.coffeeIndicator = indicator
    // Gentle bob
    this.scene.tweens.add({
      targets: indicator, y: WS_SPRITE_Y - 11,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  /** Remove the coffee indicator when the agent returns */
  private removeCoffeeIndicator(ws: WorkstationSprite): void {
    if (!ws.coffeeIndicator) return
    this.scene.tweens.killTweensOf(ws.coffeeIndicator)
    ws.coffeeIndicator.destroy()
    ws.coffeeIndicator = undefined
  }

  restoreDeskStroke(ws: WorkstationSprite): void {
    const s = ws.state
    if (s?.needsInteraction) {
      ws.deskBody.setStrokeStyle(2, 0xfbbf24, 0.7)
    } else if (s?.sessionMode === 'working' || s?.sessionMode === 'plan') {
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.5)
    } else {
      ws.deskBody.setStrokeStyle(1, 0x64748b, 0.5)
    }
  }
}
