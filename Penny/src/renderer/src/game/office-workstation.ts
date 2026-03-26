// ---------------------------------------------------------------------------
// office-workstation.ts
// OfficeWorkstations orchestrator — coordinates WorkstationFactory and
// WorkstationAnimator. Handles sync, state updates, task counts, and
// desk-stroke restoration. All heavy logic lives in the two sub-modules.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import { flash, pulse, shake } from './juice-utils'
import { STATUS_DOT_FRAMES, ICON_FRAMES } from './office-asset-keys'
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
} from './office-constants'
import { WorkstationFactory } from './workstation-creation'
import { WorkstationAnimator } from './workstation-animation'

// Re-export so callers that import WorkstationHost from this file continue to work.
export type { WorkstationHost }

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
          }
        }
        // Juice: shake the workstation container and flash the sprite red to signal attention needed
        shake(ws.container, this.scene, { intensity: 3, duration: 260 })
        flash(ws.sprite, this.scene, { tint: 0xff4444, duration: 100, repeat: 3 })
      } else if (!agent.needsInteraction && prevState.needsInteraction) {
        // Reset ripple guard so the next blocked event fires a fresh ripple
        ws.rippleFired = false
        const roomU = this.host.getRooms().get(roomKey)
        if (roomU) this.host.spawnSpriteReaction(roomU.x + ws.container.x, roomU.y + ws.container.y, ICON_FRAMES.CHECKMARK) // unblocked
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

    ws.nameText.setVisible(true)
    ws.statusDot.setVisible(true)

    const isWaiting = agent.needsInteraction
    const isPlan = agent.sessionMode === 'plan'
    const isWorking = (agent.sessionMode === 'working' || isPlan) && !isWaiting

    // ── Name tag color + background tint based on state ──────────────────────
    const nameColor = isWorking ? '#00e5ff' : isWaiting ? '#fbbf24' : isPlan ? '#a78bfa' : '#8a96a4'
    const nameBg    = isWorking ? '#0a1a2a' : isWaiting ? '#1a1500' : '#0a0e14cc'
    ws.nameText.setColor(nameColor).setBackgroundColor(nameBg)

    // ── Role badge (S / R / E) ────────────────────────────────────────────────
    if (ws.roleBadge) {
      const podRole = agent.config.podRole
      if (podRole) {
        const roleLabel = podRole === 'solver' ? 'S' : podRole === 'reviewer' ? 'R' : 'E'
        const roleBgColor: Record<string, string> = { solver: '#3b82f6', reviewer: '#8b5cf6', executor: '#22c55e' }
        ws.roleBadge.setText(roleLabel).setBackgroundColor(roleBgColor[podRole] ?? '#3a4858').setVisible(true)

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
      ws.xpBar.graphics.setAlpha(1).setVisible(true)
      ws.xpBar.setFillColor(fillColor)
      ws.xpBar.setPercent(pct, true)
      ws.xpBarText.setText(xp.rank).setVisible(true)

      // Lego brick segment visibility — each segment represents 20% of the bar
      if (ws.legoSegments) {
        for (let i = 0; i < ws.legoSegments.length; i++) {
          ws.legoSegments[i].setVisible(pct >= (i + 1) * 0.2)
        }
      }

      // Rank-up celebration
      if (prevRank && prevRank !== xp.rank && prevRank !== '') {
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
            break
          }
        }
      }
    } else if (ws.xpBar) {
      ws.xpBar.graphics.setVisible(false)
      ws.xpBarText?.setVisible(false)
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
          gfx.lineStyle(0.5, 0x2a3440, 0.15)
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
            const col = v1 >= 1 ? 0x34d399 : v1 >= 0.5 ? 0xfbbf24 : 0x2a3440

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

      // Tint based on level: >0.5 = blue (default), 0.25-0.5 = yellow, <0.25 = red
      if (pct > 0.5) {
        ws.energyFill.clearTint()
      } else if (pct > 0.25) {
        ws.energyFill.setTint(0xfbbf24)
      } else {
        ws.energyFill.setTint(0xef4444)
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
