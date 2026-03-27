// ---------------------------------------------------------------------------
// office-workstation.ts
// OfficeWorkstations orchestrator — coordinates WorkstationFactory and
// WorkstationAnimator. Handles sync, state updates, task counts, and
// desk-stroke restoration. All heavy logic lives in the two sub-modules.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { flash, pulse, shake } from './juice-utils'
import { STATUS_DOT_FRAMES, ICON_FRAMES, SPRITESHEET_KEYS, LEGO_SPECIAL_FRAMES } from './office-asset-keys'
import { EventBus, EVENTS } from './events'
import type { AgentState } from '../types'
import { XP_RANKS, getXPForLevel } from '../types'
import type { WorkstationSprite, Room, PodLineInfo } from './office-types'
import { activeTheme } from './office-theme'
import { CelebrationManager } from './celebrations'
import { achievements } from './achievements'
import { soundEngine } from './sound-engine'
import { leaderboardManager } from './leaderboard'
import { seasonManager } from './seasons'
import type { InteractivePropsManager } from './interactive-props'
import {
  WS_DOT_GAP,
  WS_MONITOR_Y,
  WS_NAME_Y,
  WORKSTATION_W,
  WS_DESK_Y,
  CTX_GREEN,
  CTX_AMBER,
  CTX_RED,
  CTX_THRESHOLD_AMBER,
  CTX_THRESHOLD_RED,
} from './office-constants'
import { WorkstationFactory } from './workstation-creation'
import { WorkstationAnimator } from './workstation-animation'

// ---------------------------------------------------------------------------
// Host interface — callbacks into OfficeScene for cross-module calls
// ---------------------------------------------------------------------------

export interface WorkstationHost {
  // Toast notifications
  showToast(text: string, type?: 'info' | 'success' | 'warning' | 'error'): void
  // Particle / effect calls
  spawnEmojiReaction(x: number, y: number, emoji: string): void
  spawnSpriteReaction(x: number, y: number, frame: number): void
  spawnAlertRipple(x: number, y: number, color: number): void
  burstConfetti(x: number, y: number): void
  spawnSteamParticles(ws: WorkstationSprite): void
  clearSteamParticles(ws: WorkstationSprite): void
  spawnFlameParticle(x: number, y: number, streak: number): void
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
  // Game systems
  celebrations: CelebrationManager
  propsManager: InteractivePropsManager
  // NavMesh for pathfinding
  getNavMesh(): import('./nav-mesh').NavMesh
}

// ---------------------------------------------------------------------------
// OfficeWorkstations class — orchestrator
// ---------------------------------------------------------------------------

export class OfficeWorkstations {
  private scene: Phaser.Scene
  private host: WorkstationHost
  private factory: WorkstationFactory
  private animator: WorkstationAnimator
  private _onApproved: (...args: unknown[]) => void

  constructor(scene: Phaser.Scene, host: WorkstationHost) {
    this.scene = scene
    this.host = host

    this.animator = new WorkstationAnimator(
      scene,
      host,
      (ws) => this.restoreDeskStroke(ws),
      (ws) => this.refreshTaskCountDisplay(ws),
    )

    this.factory = new WorkstationFactory(
      scene,
      host,
      (ws, agent) => this.updateWorkstation(ws, agent),
      (ws) => this.restoreDeskStroke(ws),
    )

    // Listen for approve events and trigger sparkle on the agent's workstation
    this._onApproved = (agentId: unknown) => {
      if (typeof agentId !== 'string') return
      // Skip if LOD is overview level (workstation not visible)
      if (this.host.getLastLodLevel() <= 1) return
      const rooms = this.host.getRooms()
      if (agentId === '__all__') {
        // Bulk approve — sparkle all workstations that are currently waiting
        for (const room of rooms.values()) {
          for (const ws of room.workstations.values()) {
            if (ws.state?.needsInteraction) {
              const wx = room.x + ws.container.x
              const wy = room.y + ws.container.y
              this.host.celebrations.approveSparkle(wx, wy)
            }
          }
        }
      } else {
        // Single agent approve
        for (const room of rooms.values()) {
          const ws = room.workstations.get(agentId)
          if (ws) {
            const wx = room.x + ws.container.x
            const wy = room.y + ws.container.y
            this.host.celebrations.approveSparkle(wx, wy)
            break
          }
        }
      }
    }
    EventBus.on(EVENTS.AGENT_APPROVED, this._onApproved)
  }

  destroy(): void {
    EventBus.off(EVENTS.AGENT_APPROVED, this._onApproved)
  }

  // ---------------------------------------------------------------------------
  // syncWorkstations — reconciles workstations with agent list
  // ---------------------------------------------------------------------------

  syncWorkstations(room: Room, agents: AgentState[], onDoorAnimation: (room: Room) => void): void {
    const currentIds = new Set(agents.map(a => a.config.id))

    for (const [id, ws] of room.workstations) {
      if (!currentIds.has(id)) {
        // Flash red before destroying (crash/departure visibility)
        const name = ws.state?.config?.name?.split(' ')[0] || id
        this.host.showToast(`${name} session ended`, 'warning')
        flash(ws.sprite, this.scene, { tint: 0xff4444, duration: 150, repeat: 2 })
        // Red flash on the desk (Rectangle cast — setTint exists at runtime)
        flash(ws.deskBody as unknown as Parameters<typeof flash>[0], this.scene, { tint: 0xff4444, duration: 150, repeat: 1 })
        // Delay destruction by 500ms so the flash is visible
        const wsRef = ws
        this.scene.time.delayedCall(500, () => {
          this.destroyWorkstation(wsRef)
        })
        room.workstations.delete(id)
        EventBus.emit(EVENTS.AGENT_DEPARTED, id)
      }
    }

    for (const agent of agents) {
      const existing = room.workstations.get(agent.config.id)
      if (existing) {
        this.updateWorkstation(existing, agent)
      } else {
        const ws = this.createWorkstation(room, agent)
        room.workstations.set(agent.config.id, ws)
        EventBus.emit(EVENTS.AGENT_ARRIVED, agent.config.id, agent)
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
  // Delegation to WorkstationFactory
  // ---------------------------------------------------------------------------

  createWorkstation(room: Room, agent: AgentState): WorkstationSprite {
    return this.factory.create(room, agent)
  }

  layoutWorkstations(room: Room): void {
    this.factory.layout(room)
  }

  destroyWorkstation(ws: WorkstationSprite): void {
    this.factory.destroy(ws)
  }

  ensureCoffeeIndicator(ws: WorkstationSprite): void {
    this.factory.ensureCoffeeIndicator(ws)
  }

  removeCoffeeIndicator(ws: WorkstationSprite): void {
    this.factory.removeCoffeeIndicator(ws)
  }

  // ---------------------------------------------------------------------------
  // Delegation to WorkstationAnimator
  // ---------------------------------------------------------------------------

  updateAnimation(ws: WorkstationSprite, agent: AgentState): void {
    this.animator.updateAnimation(ws, agent)
  }

  updateMonitorGlow(ws: WorkstationSprite, isWorking: boolean, isWaiting: boolean): void {
    this.animator.updateMonitorGlow(ws, isWorking, isWaiting)
  }

  updateBlockedIndicator(ws: WorkstationSprite, agent: AgentState): void {
    this.animator.updateBlockedIndicator(ws, agent)
  }

  getAgentMood(agent: AgentState): { emoji: string; color: string } {
    return this.animator.getAgentMood(agent)
  }

  updateMood(ws: WorkstationSprite, agent: AgentState): void {
    this.animator.updateMood(ws, agent)
  }

  drawThoughtBubbleBg(ws: WorkstationSprite, accentColor: number): void {
    this.animator.drawThoughtBubbleBg(ws, accentColor)
  }

  updateThoughtBubble(
    ws: WorkstationSprite,
    agent: AgentState,
    shouldShow: boolean,
    accentColor: number,
    isWorking: boolean,
  ): void {
    this.animator.updateThoughtBubble(ws, agent, shouldShow, accentColor, isWorking)
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
    const ctxRound = agent.contextUtilization != null ? (agent.contextUtilization * 100 | 0) : ''
    const fp = `${agent.status}|${agent.sessionMode}|${agent.needsInteraction}|${agent.interactionType}|${agent.config.name}|${blurbSnippet}|${agent.uptime ?? ''}|${ctxRound}|${agent.contextRotDetected ?? ''}`
    if (ws.lastStateFingerprint === fp) {
      ws.state = agent
      // Keep eval glow fresh even when nothing else changed; animator throttles fetches to 30s.
      this.animator.updateEvalGlow(ws)
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
            this.host.spawnSpriteReaction(wx, wy, ICON_FRAMES.CIRCLE_YELLOW) // blocked
            // Smoke effect on blocked/error state
            this.host.celebrations.error(wx, wy)
          }
        }
        // Juice: shake the workstation container and flash the sprite red to signal attention needed
        shake(ws.container, this.scene, { intensity: 3, duration: 260 })
        flash(ws.sprite, this.scene, { tint: 0xff4444, duration: 100, repeat: 3 })

        // LEGO_SPECIALS exclamation indicator — bouncing above the agent
        if (!ws.exclamationSprite && this.scene.textures.exists(SPRITESHEET_KEYS.LEGO_SPECIALS)) {
          ws.exclamationSprite = this.scene.add.sprite(0, -40, SPRITESHEET_KEYS.LEGO_SPECIALS, LEGO_SPECIAL_FRAMES.EXCLAMATION)
            .setScale(0).setOrigin(0.5).setAlpha(0).setDepth(500)
          ws.container.add(ws.exclamationSprite)
          this.scene.tweens.add({
            targets: ws.exclamationSprite,
            alpha: 0.9, scaleX: 0.55, scaleY: 0.55,
            duration: 250, ease: 'Back.easeOut',
          })
          ws.exclamationTween = this.scene.tweens.add({
            targets: ws.exclamationSprite,
            y: -43, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
        }
      } else if (!agent.needsInteraction && prevState.needsInteraction) {
        // Reset ripple guard so the next blocked event fires a fresh ripple
        ws.rippleFired = false
        const roomU = this.host.getRooms().get(roomKey)
        if (roomU) this.host.spawnSpriteReaction(roomU.x + ws.container.x, roomU.y + ws.container.y, ICON_FRAMES.CHECKMARK) // unblocked

        // Remove exclamation indicator
        if (ws.exclamationTween) { ws.exclamationTween.destroy(); ws.exclamationTween = undefined }
        if (ws.exclamationSprite) {
          const excl = ws.exclamationSprite
          ws.exclamationSprite = undefined
          this.scene.tweens.add({
            targets: excl, alpha: 0, scaleX: 0.2, scaleY: 0.2,
            duration: 200, ease: 'Power2',
            onComplete: () => excl.destroy(),
          })
        }
      }

      if (wasWorking && !isWorking && !agent.needsInteraction) {
        this.host.showToast(`${name} finished task`, 'success')
        const roomC = this.host.getRooms().get(roomKey)
        if (roomC) this.host.spawnSpriteReaction(roomC.x + ws.container.x, roomC.y + ws.container.y, ICON_FRAMES.CHECKMARK) // completed
      } else if (!wasWorking && isWorking) {
        this.host.showToast(`${name} started working`, 'info')
        const roomS = this.host.getRooms().get(roomKey)
        if (roomS) this.host.spawnSpriteReaction(roomS.x + ws.container.x, roomS.y + ws.container.y, ICON_FRAMES.PLAY_DARK) // started working
      }

      // Plan mode entry
      if (agent.sessionMode === 'plan' && prevState.sessionMode !== 'plan') {
        const roomP = this.host.getRooms().get(roomKey)
        if (roomP) this.host.spawnSpriteReaction(roomP.x + ws.container.x, roomP.y + ws.container.y, ICON_FRAMES.ARROW_EAST) // plan mode
      }

      // Compressing entry
      if (agent.sessionMode === 'compressing' && prevState.sessionMode !== 'compressing') {
        const roomZ = this.host.getRooms().get(roomKey)
        if (roomZ) this.host.spawnSpriteReaction(roomZ.x + ws.container.x, roomZ.y + ws.container.y, ICON_FRAMES.REPEAT_DARK) // compressing
      }
    }

    const charIdx = this.host.getAgentCharacterIndex(agent)
    ws.sprite.setFrame(this.host.getPoseFrame(charIdx, agent))

    const dotColor = this.host.getStatusColor(agent)
    const prevDotColor = ws.statusDot.getData('lastColor') as number | undefined
    const dotFrame = STATUS_DOT_FRAMES[dotColor] ?? ICON_FRAMES.CIRCLE_GREY
    ws.statusDot.setFrame(dotFrame)
    ws.statusDot.setPosition(ws.nameText.width / 2 + WS_DOT_GAP, WS_NAME_Y)
    if (prevDotColor !== dotColor) {
      ws.statusDot.setData('lastColor', dotColor)
      pulse(ws.statusDot, this.scene, { scale: 1.5, duration: 180 })
    }

    if (!ws.nameText.visible) {
      ws.nameText.setVisible(true).setAlpha(0)
      this.scene.tweens.add({ targets: ws.nameText, alpha: 1, duration: 150, ease: 'Power2' })
    }
    if (!ws.statusDot.visible) {
      ws.statusDot.setVisible(true).setAlpha(0)
      this.scene.tweens.add({ targets: ws.statusDot, alpha: 1, duration: 150, ease: 'Power2' })
    }

    const isWaiting = agent.needsInteraction
    const isPlan = agent.sessionMode === 'plan'
    const isCompressing = agent.sessionMode === 'compressing'
    const isWorking = (agent.sessionMode === 'working' || isPlan) && !isWaiting

    // ── Name tag color + background tint based on state ──────────────────────
    const nameColor = isWorking ? activeTheme.accentText : isWaiting ? '#fbbf24' : isPlan ? '#a78bfa' : activeTheme.subtleText
    const nameBg    = activeTheme.nameBg
    const prevNameColor = ws.nameText.getData('prevColor') as string | undefined
    if (prevNameColor !== nameColor) {
      ws.nameText.setData('prevColor', nameColor)
      // Brief white flash then settle to new color
      ws.nameText.setColor('#ffffff').setBackgroundColor(nameBg)
      this.scene.time.delayedCall(80, () => {
        if (ws.nameText?.active) ws.nameText.setColor(nameColor)
      })
      // Scale pop on the name tag
      this.scene.tweens.add({
        targets: ws.nameText,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 100,
        yoyo: true,
        ease: 'Back.easeOut',
      })
    } else {
      ws.nameText.setColor(nameColor).setBackgroundColor(nameBg)
    }

    // ── Role badge (S / R / E) ────────────────────────────────────────────────
    if (ws.roleBadge) {
      const podRole = agent.config.podRole
      if (podRole) {
        const roleLabel = podRole === 'solver' ? 'S' : podRole === 'reviewer' ? 'R' : 'E'
        const roleBgColor: Record<string, string> = { solver: '#3b82f6', reviewer: '#8b5cf6', executor: '#22c55e' }
        const wasRoleBadgeVisible = ws.roleBadge.visible
        ws.roleBadge.setText(roleLabel).setBackgroundColor(roleBgColor[podRole] ?? '#3a4858').setVisible(true)
        if (!wasRoleBadgeVisible) {
          ws.roleBadge.setAlpha(0)
          this.scene.tweens.add({ targets: ws.roleBadge, alpha: 0.75, duration: 150, ease: 'Power2' })
        }

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
        if (ws.roleBadge.visible) {
          this.scene.tweens.add({ targets: ws.roleBadge, alpha: 0, duration: 120, ease: 'Power2',
            onComplete: () => { ws.roleBadge?.setVisible(false) },
          })
        }
      }
    }

    // ── Thinking dots — best-of-N solver animation ────────────────────────
    {
      const podLines = this.host.getPodLines()
      const agentId = agent.config.id
      const solverPod = podLines.find(
        t => t.solverAgentId === agentId && t.status === 'solving' && (t.candidates ?? 0) > 1,
      )
      if (solverPod && isWorking && !ws.thinkingDotsContainer) {
        this.animator.showThinkingDots(ws, solverPod.candidates!)
      } else if (solverPod?.candidateSelected && ws.thinkingDotsContainer && !ws.thinkingMergeTween) {
        this.animator.playThinkingMerge(ws)
      } else if (!solverPod && ws.thinkingDotsContainer) {
        this.animator.hideThinkingDots(ws)
      }
    }

    // ── MVP medal indicator ──────────────────────────────────────────────────
    if (ws.mvpMedal) {
      const isMVP = leaderboardManager.isMVP(agent.config.id)
      if (isMVP && !ws.mvpMedal.visible) {
        ws.mvpMedal.setVisible(true).setAlpha(0)
        this.scene.tweens.add({ targets: ws.mvpMedal, alpha: 1, duration: 400, ease: 'Back.easeOut' })
        if (!ws.mvpMedalTween) {
          ws.mvpMedalTween = this.scene.tweens.add({
            targets: ws.mvpMedal, y: ws.mvpMedal.y - 2,
            duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
        }
      } else if (!isMVP && ws.mvpMedal.visible) {
        ws.mvpMedalTween?.destroy(); ws.mvpMedalTween = undefined
        this.scene.tweens.add({ targets: ws.mvpMedal, alpha: 0, duration: 200, ease: 'Sine.easeOut',
          onComplete: () => { ws.mvpMedal?.setVisible(false) },
        })
      }
    }

    // ── Rivalry indicator ────────────────────────────────────────────────────
    if (ws.rivalryIndicator) {
      const rivalries = leaderboardManager.getRivalries()
      const hasRival = rivalries.some(
        r => r.agent1Id === agent.config.id || r.agent2Id === agent.config.id,
      )
      if (hasRival && !ws.rivalryIndicator.visible) {
        ws.rivalryIndicator.setVisible(true).setAlpha(0)
        this.scene.tweens.add({ targets: ws.rivalryIndicator, alpha: 0.6, duration: 300, ease: 'Back.easeOut' })
        if (!ws.rivalryGlowTween) {
          ws.rivalryGlowTween = this.scene.tweens.add({
            targets: ws.rivalryIndicator,
            scaleX: { from: 0.35, to: 0.5 },
            scaleY: { from: 0.35, to: 0.5 },
            alpha: { from: 0.6, to: 1.0 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          })
        }
      } else if (!hasRival && ws.rivalryIndicator.visible) {
        ws.rivalryGlowTween?.destroy(); ws.rivalryGlowTween = undefined
        this.scene.tweens.add({
          targets: ws.rivalryIndicator, alpha: 0, duration: 200, ease: 'Sine.easeOut',
          onComplete: () => { ws.rivalryIndicator?.setVisible(false) },
        })
      }
    }

    // ── OpenClaw/NemoClaw supervision badge ──────────────────────────────────
    if (ws.openclawBadge) {
      const oc = agent.openclaw
      if (oc?.supervised) {
        // Set color: cyan tint for OpenClaw, green tint for NemoClaw
        const tint = oc.runtime === 'nemoclaw' ? 0x22c55e : 0x06b6d4
        ws.openclawBadge.setTint(tint)
        if (!ws.openclawBadge.visible) {
          ws.openclawBadge.setVisible(true).setAlpha(0)
          this.scene.tweens.add({ targets: ws.openclawBadge, alpha: 0.85, duration: 300, ease: 'Back.easeOut' })
          // Gentle pulse
          if (!ws.openclawBadgeTween) {
            ws.openclawBadgeTween = this.scene.tweens.add({
              targets: ws.openclawBadge,
              scaleX: { from: 0.26, to: 0.30 },
              scaleY: { from: 0.26, to: 0.30 },
              duration: 2000,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        }
      } else if (ws.openclawBadge.visible) {
        ws.openclawBadgeTween?.destroy(); ws.openclawBadgeTween = undefined
        this.scene.tweens.add({
          targets: ws.openclawBadge, alpha: 0, duration: 200, ease: 'Sine.easeOut',
          onComplete: () => { ws.openclawBadge?.setVisible(false) },
        })
      }
    }

    // ── Parse error warning badge ──────────────────────────────────────────
    if (ws.errorBadge) {
      const hasErrors = (agent.parseErrors ?? 0) > 0
      if (hasErrors && !ws.errorBadge.visible) {
        ws.errorBadge.setVisible(true).setAlpha(0)
        this.scene.tweens.add({ targets: ws.errorBadge, alpha: 0.8, duration: 250, ease: 'Power2' })
        if (!ws.errorBadgeTween) {
          ws.errorBadgeTween = this.scene.tweens.add({
            targets: ws.errorBadge,
            alpha: { from: 0.8, to: 0.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          })
        }
      } else if (!hasErrors && ws.errorBadge.visible) {
        ws.errorBadgeTween?.destroy(); ws.errorBadgeTween = undefined
        this.scene.tweens.add({
          targets: ws.errorBadge, alpha: 0, duration: 200, ease: 'Sine.easeOut',
          onComplete: () => { ws.errorBadge?.setVisible(false) },
        })
      }
    }

    // ── Uptime counter ────────────────────────────────────────────────────────
    if (ws.uptimeText) {
      if (agent.uptime) {
        const wasUptimeVisible = ws.uptimeText.visible
        ws.uptimeText.setText(agent.uptime).setVisible(true)
        if (!wasUptimeVisible) {
          ws.uptimeText.setAlpha(0)
          this.scene.tweens.add({ targets: ws.uptimeText, alpha: 1, duration: 150, ease: 'Power2' })
        }
      } else if (ws.uptimeText.visible) {
        this.scene.tweens.add({ targets: ws.uptimeText, alpha: 0, duration: 120, ease: 'Power2',
          onComplete: () => { ws.uptimeText?.setVisible(false) },
        })
      }
    }

    // Screen content — set mode-specific pattern and timeScale
    if (ws.screenLines && ws.screenTween) {
      const screenMode = isWorking ? (isPlan ? 'plan' : 'working') : isCompressing ? 'compressing' : 'idle'
      if (ws.screenState) ws.screenState.mode = screenMode
      ws.screenLines.setVisible(true)
      ws.screenTween.resume()
      if (screenMode === 'compressing') ws.screenTween.setTimeScale(2)
      else if (screenMode === 'idle') ws.screenTween.setTimeScale(0.3)
      else ws.screenTween.setTimeScale(1)
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
          .setColor('#5a6a7a')
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

    // Streak flame — check on every sync so external streak resets are caught
    this.animator.updateStreakFlame(ws, agent)

    // Eval glow — update color from cached eval data (refreshes every 30s)
    this.animator.updateEvalGlow(ws)

    // XP progress bar — update fill percentage and rank label
    if (ws.xpBar && ws.xpBarText && agent.xp) {
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
      const fillColor = xp.level >= 8 ? 0xf59e0b : xp.level >= 5 ? 0xa855f7 : 0x3b82f6

      const prevRank = ws.xpBarText.text
      const prevPct = (ws.xpBar.graphics.getData('lastPct') as number) ?? 0
      const wasXpBarVisible = ws.xpBar.graphics.visible
      ws.xpBar.graphics.setVisible(true)
      ws.xpBar.setFillColor(fillColor)
      ws.xpBar.setPercent(pct, true)
      const wasXpTextVisible = ws.xpBarText.visible
      ws.xpBarText.setText(xp.rank).setVisible(true)

      // XP bar fill flash — briefly brighten bar when percentage increases
      if (pct > prevPct) {
        ws.xpBar.graphics.setData('lastPct', pct)
        ws.xpBar.graphics.setAlpha(1.0)
        this.scene.tweens.add({
          targets: ws.xpBar.graphics,
          alpha: 0.6,
          duration: 400,
          ease: 'Power2',
        })
      } else if (!wasXpBarVisible) {
        ws.xpBar.graphics.setAlpha(0)
        this.scene.tweens.add({ targets: ws.xpBar.graphics, alpha: 0.6, duration: 200, ease: 'Power2' })
      } else {
        ws.xpBar.graphics.setAlpha(0.6)
      }
      if (!wasXpTextVisible) {
        ws.xpBarText.setAlpha(0)
        this.scene.tweens.add({ targets: ws.xpBarText, alpha: 1, duration: 200, ease: 'Power2' })
      }

      // Lego brick segment visibility — each segment represents 20% of the bar
      // Animate new segments popping in with a sequential scale bounce
      if (ws.legoSegments) {
        for (let i = 0; i < ws.legoSegments.length; i++) {
          const shouldShow = pct >= (i + 1) * 0.2
          const wasVisible = ws.legoSegments[i].visible
          ws.legoSegments[i].setVisible(shouldShow)
          if (shouldShow && !wasVisible) {
            const origScale = (ws.legoSegments[i].getData('origScale') as number) ?? 0.375
            ws.legoSegments[i].setScale(0).setAlpha(0)
            this.scene.tweens.add({
              targets: ws.legoSegments[i],
              scaleX: origScale,
              scaleY: origScale,
              alpha: 1,
              duration: 250,
              delay: i * 60,
              ease: 'Back.easeOut',
            })
          }
        }
      }

      // Rank-up celebration
      if (prevRank && prevRank !== xp.rank && prevRank !== '') {
        // Golden flash across the XP bar before it resets to new level
        ws.xpBar.setFillColor(0xffd700)
        ws.xpBar.graphics.setAlpha(1.0)
        this.scene.tweens.add({
          targets: ws.xpBar.graphics,
          alpha: { from: 1.0, to: 0.6 },
          duration: 600,
          ease: 'Sine.easeOut',
        })
        // Restore fill color after golden flash
        this.scene.time.delayedCall(500, () => {
          if (ws.xpBar) ws.xpBar.setFillColor(fillColor)
        })
        // Reset tracked pct so new level's lego segments pop in fresh
        ws.xpBar.graphics.setData('lastPct', 0)

        const rooms = this.host.getRooms()
        for (const room of rooms.values()) {
          if (room.workstations.has(agent.config?.id ?? '')) {
            const wx = room.x + ws.container.x
            const wy = room.y + ws.container.y
            this.host.celebrations.rankUp(wx, wy, agent.config?.name ?? 'Agent', xp.rank, fillColor)
            this.host.celebrations.taskComplete(wx, wy)
            achievements.trackRankUp()
            soundEngine.levelUp()
            // Track in leaderboard + season
            leaderboardManager.recordXP(agent.config.id, agent.config.name, 0, xp.level, xp.rank)
            seasonManager.trackAgentLevel(xp.level)

            // Instant cosmetic refresh — destroy and re-create workstation
            // so newly unlocked rank-gated items appear immediately
            const capturedRoom = room
            this.scene.time.delayedCall(600, () => {
              const refreshRoom = capturedRoom
              if (refreshRoom && refreshRoom.workstations.has(agent.config.id)) {
                this.destroyWorkstation(ws)
                const newWs = this.createWorkstation(refreshRoom, agent)
                refreshRoom.workstations.set(agent.config.id, newWs)
                this.layoutWorkstations(refreshRoom)
              }
            })
            break
          }
        }
      }
    } else if (ws.xpBar) {
      if (ws.xpBar.graphics.visible) {
        this.scene.tweens.add({ targets: ws.xpBar.graphics, alpha: 0, duration: 120, ease: 'Power2',
          onComplete: () => { ws.xpBar?.graphics.setVisible(false) },
        })
      }
      if (ws.xpBarText?.visible) {
        this.scene.tweens.add({ targets: ws.xpBarText, alpha: 0, duration: 120, ease: 'Power2',
          onComplete: () => { ws.xpBarText?.setVisible(false) },
        })
      }
      if (ws.legoSegments) {
        for (const seg of ws.legoSegments) seg.setVisible(false)
      }
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
          gfx.lineStyle(0.5, activeTheme.wall, 0.15)
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
            const col = v1 >= 1 ? 0x34d399 : v1 >= 0.5 ? 0xfbbf24 : activeTheme.wall

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

    // ── Energy bar drain/recovery ──────────────────────────────────────────
    if (ws.energyFill) {
      const onCoffee = ws.onCoffeeRun ?? false
      const prevEnergy = ws.energyLevel
      if (isWorking) {
        // Drain slowly while working (min 0.1)
        ws.energyLevel = Math.max(0.1, ws.energyLevel - 0.001)
      } else if (onCoffee) {
        // Fast recovery on coffee run
        ws.energyLevel = Math.min(1.0, ws.energyLevel + 0.005)
      } else {
        // Idle recovery
        ws.energyLevel = Math.min(1.0, ws.energyLevel + 0.002)
      }

      // Update crop — show fill from bottom up
      const tex = ws.energyFill.texture.getSourceImage() as HTMLImageElement
      const fullW = tex.width
      const fullH = tex.height
      const pct = ws.energyLevel
      ws.energyFill.setCrop(0, Math.round((1 - pct) * fullH), fullW, Math.round(pct * fullH))

      // Determine target tint: >0.5 = no tint (0), 0.25-0.5 = yellow, <0.25 = red
      const targetTint = pct > 0.5 ? 0 : pct > 0.25 ? 0xfbbf24 : 0xef4444
      const lastTint = ws.energyLastTint ?? 0

      if (targetTint !== lastTint) {
        ws.energyLastTint = targetTint
        // Smooth tint transition: flash white briefly then settle to new color
        ws.energyFill.setTint(0xffffff)
        this.scene.time.delayedCall(80, () => {
          if (!ws.energyFill?.active) return
          if (targetTint === 0) {
            ws.energyFill.clearTint()
          } else {
            ws.energyFill.setTint(targetTint)
          }
        })
      } else {
        // Apply current tint (no transition needed)
        if (targetTint === 0) {
          ws.energyFill.clearTint()
        } else {
          ws.energyFill.setTint(targetTint)
        }
      }

      // Low energy warning pulse — red pulse when below 25%
      if (ws.energyLevel < 0.25 && !ws.energyPulseTween) {
        ws.energyPulseTween = this.scene.tweens.add({
          targets: ws.energyFill,
          alpha: { from: 0.3, to: 0.7 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else if (ws.energyLevel >= 0.25 && ws.energyPulseTween) {
        ws.energyPulseTween.destroy()
        ws.energyPulseTween = undefined
        ws.energyFill.setAlpha(0.5)
      }

      // Coffee recovery sparkle — tiny green particle floats up from the energy bar
      if (onCoffee && ws.energyLevel > prevEnergy && Math.random() < 0.05) {
        const ENERGY_BAR_X = WORKSTATION_W / 2 + 2
        const ENERGY_BAR_Y = WS_DESK_Y - 8
        const sparkle = this.scene.add.sprite(
          ENERGY_BAR_X, ENERGY_BAR_Y - 5,
          SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREEN,
        ).setScale(0.04).setAlpha(0.6).setDepth(500)
        ws.container.add(sparkle)
        this.scene.tweens.add({
          targets: sparkle,
          y: sparkle.y - 8,
          alpha: 0,
          duration: 400,
          onComplete: () => { try { sparkle.destroy() } catch { /* gone */ } },
        })
      }
    }

    // ── Context utilization meter ────────────────────────────────────────────
    if (ws.contextMeter) {
      const utilization = agent.contextUtilization
      if (utilization == null) {
        ws.contextMeter.setVisible(false)
      } else {
        ws.contextMeter.setVisible(true)
        ws.contextMeter.setPercent(utilization, true)

        // Color threshold: green → amber → red
        const fillColor = utilization >= CTX_THRESHOLD_RED
          ? CTX_RED
          : utilization >= CTX_THRESHOLD_AMBER
            ? CTX_AMBER
            : CTX_GREEN
        ws.contextMeter.setFillColor(fillColor)
        ws.contextMeter.graphics.setAlpha(0.6)

        const rotDetected = agent.contextRotDetected === true
        const prevRot = ws.lastContextRotState ?? false

        if (rotDetected) {
          // Pulsing red on the meter
          if (!ws.contextMeterPulseTween || !ws.contextMeterPulseTween.isPlaying()) {
            ws.contextMeterPulseTween?.destroy()
            ws.contextMeterPulseTween = this.scene.tweens.add({
              targets: ws.contextMeter.graphics,
              alpha: { from: 0.4, to: 1.0 },
              duration: 600,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
          // Subtle monitor shake — only on transition false→true
          if (!prevRot && ws.monitorSprite) {
            ws.contextRotShakeTween?.destroy()
            const origX = ws.monitorSprite.x
            ws.contextRotShakeTween = this.scene.tweens.add({
              targets: ws.monitorSprite,
              x: { from: origX - 1, to: origX + 1 },
              duration: 80,
              yoyo: true,
              repeat: 3,
              ease: 'Sine.easeInOut',
              onComplete: () => { if (ws.monitorSprite?.active) ws.monitorSprite.setX(origX) },
            })
          }
        } else {
          // Rot cleared — kill pulse, restore alpha
          if (ws.contextMeterPulseTween) {
            ws.contextMeterPulseTween.destroy()
            ws.contextMeterPulseTween = undefined
            ws.contextMeter.graphics.setAlpha(0.6)
          }
        }
        ws.lastContextRotState = rotDetected
      }
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
   *   1-4     — gray  (#5a6a7a) — "getting started"
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
      tierColor = '#5a6a7a'  // gray — getting started
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
  // restoreDeskStroke — reset desk outline based on current agent state
  // ---------------------------------------------------------------------------

  restoreDeskStroke(ws: WorkstationSprite): void {
    const s = ws.state
    if (s?.needsInteraction) {
      ws.deskBody.setStrokeStyle(2, 0xfbbf24, 0.7)
    } else if (s?.sessionMode === 'working' || s?.sessionMode === 'plan') {
      ws.deskBody.setStrokeStyle(1, 0x34d399, 0.5)
    } else {
      ws.deskBody.setStrokeStyle(1, activeTheme.deskStrokeIdle, 0.5)
    }
  }
}

// Suppress unused-import warnings — these are used in the host interface above
// and in EVENTS reference kept for consumers that might import EventBus here.
void EventBus
void EVENTS
