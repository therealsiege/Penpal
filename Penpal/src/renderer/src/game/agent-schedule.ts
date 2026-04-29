// ---------------------------------------------------------------------------
// agent-schedule.ts
// AgentScheduler — schedule-driven NPC animations:
//   • Arrival: agent walks in from room door and sits at desk
//   • Departure: agent stands, walks to door, fades out
//   • Standup meeting: idle agents gather at room centre, chat with speech dots,
//     then return to desks (fires on a periodic real-time timer)
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import type { WorkstationSprite, Room } from './office-types'
import type { NavMesh } from './nav-mesh'
import { buildOwnRoomRect } from './nav-mesh'
import { PathWalker } from './path-walker'
import { getRoomDoorY, getAgentCharacterIndex } from './office-helpers'
import { ANIM_KEYS } from './office-asset-keys'
import { CHAR_SCALE, WS_SPRITE_Y } from './office-constants'
import { activeTheme } from './office-theme'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often a standup is attempted across all rooms (ms). Default: 10 min. */
const STANDUP_INTERVAL_MS = 10 * 60 * 1000

/** How long each standup meeting lasts before agents return (ms). Default: 2 min. */
const STANDUP_DURATION_MS = 2 * 60 * 1000

/** Minimum idle agents in a room required to start a standup. */
const STANDUP_MIN_AGENTS = 2

/** Maximum agents pulled into a single standup. */
const STANDUP_MAX_AGENTS = 6

/** Base radius of the loose standup circle around room centre (px). */
const STANDUP_BASE_RADIUS = 22

/** Padding added per extra participant to spread the circle. */
const STANDUP_RADIUS_PER_AGENT = 5

/** Duration of each speech-dot step in the cycling wave animation (ms). */
const SPEECH_DOT_STEP_MS = 400

/** Fallback walk speed (px/s) for arrival / departure when no NavMesh path. */
const FALLBACK_FADE_MS = 400

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-participant state kept for the duration of one standup. */
interface StandupParticipant {
  ws: WorkstationSprite
  agent: AgentState
  standupSprite: Phaser.GameObjects.Sprite
  standupShadow: Phaser.GameObjects.Ellipse
  speechBubbleBg: Phaser.GameObjects.Graphics
  dots: Phaser.GameObjects.Arc[]
  dotTimer: Phaser.Time.TimerEvent | null
  pathWalker: PathWalker
  /** World-space desk position to return to after standup. */
  deskX: number
  deskY: number
  /** NavMesh path back to desk (pre-computed). */
  returnPath: import('./nav-mesh').NavPoint[] | null
}

// ---------------------------------------------------------------------------
// Host interface
// ---------------------------------------------------------------------------

export interface AgentSchedulerHost {
  getScene(): Phaser.Scene
  getNavMesh(): NavMesh
  getRooms(): Map<string, Room>
}

// ---------------------------------------------------------------------------
// AgentScheduler
// ---------------------------------------------------------------------------

export class AgentScheduler {
  private host: AgentSchedulerHost
  private standupTimer: Phaser.Time.TimerEvent | null = null

  /**
   * Rooms currently mid-standup — prevents re-entry until the current one
   * fully resolves (all agents returned to desks).
   */
  private activeStandupRooms = new Set<string>()

  constructor(host: AgentSchedulerHost) {
    this.host = host
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Start the periodic standup timer. Call once the scene is ready. */
  init(): void {
    const scene = this.host.getScene()
    this.standupTimer = scene.time.addEvent({
      delay: STANDUP_INTERVAL_MS,
      loop: true,
      callback: () => this._tryStandupsAllRooms(),
    })
  }

  destroy(): void {
    if (this.standupTimer) { this.standupTimer.destroy(); this.standupTimer = null }
    this.activeStandupRooms.clear()
  }

  pause(): void {
    if (this.standupTimer) this.standupTimer.paused = true
  }

  resume(): void {
    if (this.standupTimer) this.standupTimer.paused = false
  }

  // ---------------------------------------------------------------------------
  // Arrival animation
  // ---------------------------------------------------------------------------

  /**
   * Play a walk-in arrival for a newly created workstation.
   * Hides the desk sprite, spawns a walk sprite at the room door, walks to the
   * desk position via NavMesh, then shows the desk sprite and plays a small
   * sit-down bounce.
   *
   * Safe to call immediately after workstation creation — the workstation
   * layout (container.x/y) may not be finalised yet, so we defer by one frame.
   */
  playArrivalAnimation(ws: WorkstationSprite, agent: AgentState, room: Room): void {
    if (ws.isArriving || ws.isDeparting) return
    ws.isArriving = true

    // Defer by one frame so workstation layout (container.x/y) has settled
    const scene = this.host.getScene()
    scene.time.delayedCall(16, () => {
      this._doArrival(ws, agent, room)
    })
  }

  private _doArrival(ws: WorkstationSprite, agent: AgentState, room: Room): void {
    const scene = this.host.getScene()
    const navMesh = this.host.getNavMesh()

    // Target: desk world position
    const deskWorldX = room.x + ws.container.x
    const deskWorldY = room.y + ws.container.y + WS_SPRITE_Y

    // Entry: just outside the room door
    const doorY = getRoomDoorY(room)
    const entryX = room.x
    const entryY = room.doorSide === 'top' ? doorY - 28 : doorY + 28

    // Hide the static desk sprite during the walk
    ws.sprite.setVisible(false)

    const charIdx = getAgentCharacterIndex(agent)
    const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1

    const walkSprite = scene.add
      .sprite(entryX, entryY, walkSheetKey, 0)
      .setScale(CHAR_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(9000)
      .setAlpha(0)

    const walkShadow = scene.add
      .ellipse(entryX, entryY + 2, 16, 5, 0x000000, 0.15)
      .setDepth(8999)

    // Fade the walk sprite in as the agent "appears" from outside
    scene.tweens.add({ targets: walkSprite, alpha: 1, duration: 200, ease: 'Sine.easeOut' })

    const pathWalker = new PathWalker(scene, walkSprite, walkShadow, walkSheetKey)
    const ownRoomRect = buildOwnRoomRect(room)
    const path = navMesh.findPath(
      { x: entryX, y: entryY },
      { x: deskWorldX, y: deskWorldY },
      ownRoomRect,
    )

    const finish = () => {
      scene.tweens.add({
        targets: walkSprite,
        alpha: 0,
        duration: 150,
        ease: 'Sine.easeOut',
        onComplete: () => {
          pathWalker.destroy()
          if (walkSprite.active) walkSprite.destroy()
          if (walkShadow.active) walkShadow.destroy()
          if (!ws.container.active) { ws.isArriving = false; return }
          ws.sprite.setVisible(true)
          ws.isArriving = false
          // Tiny sit-down bounce to reinforce settling into the chair
          if (ws.sprite.active) {
            scene.tweens.add({
              targets: ws.sprite,
              y: WS_SPRITE_Y - 5,
              duration: 130,
              yoyo: true,
              ease: 'Sine.easeOut',
            })
          }
        },
      })
    }

    if (!path || path.length < 2) {
      // NavMesh returned no path — fall through to direct show
      pathWalker.destroy()
      if (walkSprite.active) walkSprite.destroy()
      if (walkShadow.active) walkShadow.destroy()
      ws.sprite.setVisible(true)
      ws.isArriving = false
      return
    }

    pathWalker.startPath(path, finish)
  }

  // ---------------------------------------------------------------------------
  // Departure animation
  // ---------------------------------------------------------------------------

  /**
   * Play a walk-out departure animation. `onComplete` is called when the
   * animation finishes — the caller should destroy the workstation there.
   *
   * If no NavMesh path is found the workstation container fades out instead.
   */
  playDepartureAnimation(
    ws: WorkstationSprite,
    agent: AgentState,
    room: Room,
    onComplete: () => void,
  ): void {
    if (ws.isDeparting) { onComplete(); return }
    const scene = this.host.getScene()
    const navMesh = this.host.getNavMesh()

    ws.isDeparting = true

    const deskWorldX = room.x + ws.container.x
    const deskWorldY = room.y + ws.container.y + WS_SPRITE_Y

    // Exit: just outside the room door
    const doorY = getRoomDoorY(room)
    const exitX = room.x
    const exitY = room.doorSide === 'top' ? doorY - 28 : doorY + 28

    // Hide the static desk sprite so the walk sprite takes over
    ws.sprite.setVisible(false)

    const charIdx = getAgentCharacterIndex(agent)
    const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1

    const walkSprite = scene.add
      .sprite(deskWorldX, deskWorldY, walkSheetKey, 0)
      .setScale(CHAR_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(9000)

    const walkShadow = scene.add
      .ellipse(deskWorldX, deskWorldY + 2, 16, 5, 0x000000, 0.15)
      .setDepth(8999)

    const pathWalker = new PathWalker(scene, walkSprite, walkShadow, walkSheetKey)
    const ownRoomRect = buildOwnRoomRect(room)
    const path = navMesh.findPath(
      { x: deskWorldX, y: deskWorldY },
      { x: exitX, y: exitY },
      ownRoomRect,
    )

    const cleanup = () => {
      pathWalker.destroy()
      if (walkSprite.active) walkSprite.destroy()
      if (walkShadow.active) walkShadow.destroy()
      ws.isDeparting = false
      onComplete()
    }

    if (!path || path.length < 2) {
      // Fallback: fade the whole container out then hand off
      pathWalker.destroy()
      if (walkSprite.active) walkSprite.destroy()
      if (walkShadow.active) walkShadow.destroy()
      scene.tweens.add({
        targets: ws.container,
        alpha: 0,
        duration: FALLBACK_FADE_MS,
        ease: 'Sine.easeOut',
        onComplete: () => { ws.isDeparting = false; onComplete() },
      })
      return
    }

    pathWalker.startPath(path, () => {
      // Alpha-fade the sprite as they step through the door
      scene.tweens.add({
        targets: walkSprite,
        alpha: 0,
        duration: 280,
        ease: 'Sine.easeOut',
        onComplete: cleanup,
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Standup meeting
  // ---------------------------------------------------------------------------

  /** Attempt standups in every room (called by the periodic timer). */
  private _tryStandupsAllRooms(): void {
    for (const room of this.host.getRooms().values()) {
      this._tryStandupForRoom(room)
    }
  }

  /** Trigger a standup in a specific room (also callable from tests / external code). */
  triggerStandupForRoom(room: Room): void {
    this._tryStandupForRoom(room)
  }

  private _tryStandupForRoom(room: Room): void {
    if (this.activeStandupRooms.has(room.cwd)) return

    const scene = this.host.getScene()
    const navMesh = this.host.getNavMesh()

    // Collect idle, non-animating candidates
    const candidates: Array<{ ws: WorkstationSprite; agent: AgentState }> = []
    for (const ws of room.workstations.values()) {
      if (!ws.state) continue
      if (ws.isArriving || ws.isDeparting || ws.isInStandup) continue
      if (ws.tweenBag.has('walkBreak')) continue
      const mode = ws.state.sessionMode
      const busy =
        mode === 'working' ||
        mode === 'plan' ||
        mode === 'compressing' ||
        ws.state.needsInteraction
      if (busy) continue
      candidates.push({ ws, agent: ws.state })
    }

    if (candidates.length < STANDUP_MIN_AGENTS) return

    const participants = candidates.slice(0, STANDUP_MAX_AGENTS)
    this.activeStandupRooms.add(room.cwd)

    const radius =
      STANDUP_BASE_RADIUS + participants.length * STANDUP_RADIUS_PER_AGENT

    const builtParticipants: StandupParticipant[] = []
    let arrivedCount = 0

    const onAllArrived = () => {
      // Schedule dispersal after the meeting duration
      scene.time.delayedCall(STANDUP_DURATION_MS, () => {
        this._disperseStandup(room, builtParticipants)
      })
    }

    for (let i = 0; i < participants.length; i++) {
      const { ws, agent } = participants[i]

      const angle = (2 * Math.PI * i) / participants.length - Math.PI / 2
      const targetX = room.x + Math.cos(angle) * radius
      const targetY = room.y + Math.sin(angle) * radius

      const deskWorldX = room.x + ws.container.x
      const deskWorldY = room.y + ws.container.y + WS_SPRITE_Y

      ws.isInStandup = true
      ws.sprite.setVisible(false)

      const charIdx = getAgentCharacterIndex(agent)
      const walkSheetKey = charIdx === 1 ? ANIM_KEYS.WALK_2 : ANIM_KEYS.WALK_1

      const standupSprite = scene.add
        .sprite(deskWorldX, deskWorldY, walkSheetKey, 0)
        .setScale(CHAR_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(9000 + i)

      const standupShadow = scene.add
        .ellipse(deskWorldX, deskWorldY + 2, 16, 5, 0x000000, 0.15)
        .setDepth(8999 + i)

      // Speech bubble background (small rounded rect above the sprite)
      const speechBubbleBg = scene.add.graphics().setDepth(9100 + i).setAlpha(0)

      // Three cycling dots inside the speech bubble
      const dots: Phaser.GameObjects.Arc[] = []
      for (let d = 0; d < 3; d++) {
        const dot = scene.add
          .circle(-8 + d * 8, 0, 2.5, activeTheme.deskStrokeWorking, 0)
          .setDepth(9101 + i)
          .setAlpha(0)
        dots.push(dot)
      }

      const pathWalker = new PathWalker(scene, standupSprite, standupShadow, walkSheetKey)
      const ownRoomRect = buildOwnRoomRect(room)
      const goPath = navMesh.findPath(
        { x: deskWorldX, y: deskWorldY },
        { x: targetX, y: targetY },
        ownRoomRect,
      )
      const returnPath =
        goPath
          ? navMesh.findPath({ x: targetX, y: targetY }, { x: deskWorldX, y: deskWorldY }, ownRoomRect) ??
            [...goPath].reverse()
          : null

      const participant: StandupParticipant = {
        ws,
        agent,
        standupSprite,
        standupShadow,
        speechBubbleBg,
        dots,
        dotTimer: null,
        pathWalker,
        deskX: deskWorldX,
        deskY: deskWorldY,
        returnPath,
      }
      builtParticipants.push(participant)

      const onArriveAtStandup = () => {
        if (!standupSprite.active) return

        // Stand idle facing down (frame 0 = idle/down)
        standupSprite.setFrame(0)
        standupSprite.setAngle(0)

        // Draw speech bubble background + show dots
        this._showSpeechDots(participant, scene)

        arrivedCount++
        if (arrivedCount === participants.length) onAllArrived()
      }

      if (!goPath || goPath.length < 2) {
        // Snap directly to standup position if no path
        standupSprite.setPosition(targetX, targetY)
        standupShadow.setPosition(targetX, targetY + 2)
        onArriveAtStandup()
      } else {
        pathWalker.startPath(goPath, onArriveAtStandup)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Speech dots — cycling wave above the standup sprite
  // ---------------------------------------------------------------------------

  private _showSpeechDots(p: StandupParticipant, scene: Phaser.Scene): void {
    const { standupSprite, speechBubbleBg, dots } = p
    if (!standupSprite.active) return

    const DOT_ROW_Y = standupSprite.y - 28
    const BUBBLE_W = 30
    const BUBBLE_H = 14

    // Draw speech bubble background once
    speechBubbleBg.setPosition(standupSprite.x, DOT_ROW_Y)
    speechBubbleBg.clear()
    speechBubbleBg.fillStyle(activeTheme.panelBg ?? 0x0f172a, 0.85)
    speechBubbleBg.fillRoundedRect(-BUBBLE_W / 2, -BUBBLE_H / 2, BUBBLE_W, BUBBLE_H, 4)
    speechBubbleBg.lineStyle(0.5, activeTheme.panelStroke ?? 0x334155, 0.6)
    speechBubbleBg.strokeRoundedRect(-BUBBLE_W / 2, -BUBBLE_H / 2, BUBBLE_W, BUBBLE_H, 4)
    // Tiny downward tail
    speechBubbleBg.fillStyle(activeTheme.panelBg ?? 0x0f172a, 0.85)
    speechBubbleBg.fillTriangle(-3, BUBBLE_H / 2, 3, BUBBLE_H / 2, 0, BUBBLE_H / 2 + 5)
    scene.tweens.add({ targets: speechBubbleBg, alpha: 1, duration: 200, ease: 'Sine.easeOut' })

    // Position dots inside the bubble
    for (let d = 0; d < dots.length; d++) {
      dots[d].setPosition(standupSprite.x - 8 + d * 8, DOT_ROW_Y)
      dots[d].setFillStyle(activeTheme.deskStrokeWorking, 0.15)
      dots[d].setDepth(9101)
    }

    let dotIdx = 0
    p.dotTimer = scene.time.addEvent({
      delay: SPEECH_DOT_STEP_MS,
      loop: true,
      callback: () => {
        if (!standupSprite.active) return
        // Wave: make the current dot bright, others dim
        for (let d = 0; d < dots.length; d++) {
          if (!dots[d].active) continue
          const bright = d === dotIdx % dots.length
          const targetAlpha = bright ? 1 : 0.15
          scene.tweens.add({
            targets: dots[d],
            alpha: targetAlpha,
            duration: 120,
            ease: 'Sine.easeOut',
          })
          dots[d].setFillStyle(activeTheme.deskStrokeWorking, targetAlpha)
        }
        dotIdx++

        // Keep bubble + dots following sprite (sprite may bob slightly)
        const bubbleY = standupSprite.y - 28
        speechBubbleBg.setPosition(standupSprite.x, bubbleY)
        for (let d = 0; d < dots.length; d++) {
          if (dots[d].active) dots[d].setPosition(standupSprite.x - 8 + d * 8, bubbleY)
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Standup dispersal — walk back to desks
  // ---------------------------------------------------------------------------

  private _disperseStandup(room: Room, participants: StandupParticipant[]): void {
    const scene = this.host.getScene()
    const navMesh = this.host.getNavMesh()

    let dispersed = 0
    const total = participants.length

    const onAgentReturned = () => {
      dispersed++
      if (dispersed === total) {
        this.activeStandupRooms.delete(room.cwd)
      }
    }

    for (const p of participants) {
      const { ws, standupSprite, standupShadow, speechBubbleBg, dots, dotTimer, pathWalker } = p

      // Stop speech dots
      if (dotTimer) { dotTimer.destroy(); p.dotTimer = null }
      for (const dot of dots) {
        if (dot.active) {
          scene.tweens.killTweensOf(dot)
          scene.tweens.add({ targets: dot, alpha: 0, duration: 150, ease: 'Sine.easeOut',
            onComplete: () => { if (dot.active) dot.destroy() },
          })
        }
      }
      scene.tweens.add({
        targets: speechBubbleBg, alpha: 0, duration: 150, ease: 'Sine.easeOut',
        onComplete: () => { if (speechBubbleBg.active) speechBubbleBg.destroy() },
      })

      if (!standupSprite.active) {
        ws.isInStandup = false
        ws.sprite.setVisible(true)
        onAgentReturned()
        continue
      }

      // Re-use the pre-computed return path or build a fresh one
      const ownRoomRect = buildOwnRoomRect(room)
      const returnPath =
        p.returnPath ??
        navMesh.findPath(
          { x: standupSprite.x, y: standupSprite.y },
          { x: p.deskX, y: p.deskY },
          ownRoomRect,
        )

      const finishReturn = () => {
        pathWalker.destroy()
        if (standupSprite.active) standupSprite.destroy()
        if (standupShadow.active) standupShadow.destroy()
        ws.isInStandup = false
        ws.sprite.setVisible(true)
        // Sit-down bounce when returning
        if (ws.sprite.active) {
          scene.tweens.add({
            targets: ws.sprite,
            y: WS_SPRITE_Y - 4,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeOut',
          })
        }
        onAgentReturned()
      }

      if (!returnPath || returnPath.length < 2) {
        finishReturn()
      } else {
        // Swap the pathWalker to a fresh sheet key (same as original walk key) for the return
        pathWalker.startPath(returnPath, finishReturn)
      }
    }
  }
}
