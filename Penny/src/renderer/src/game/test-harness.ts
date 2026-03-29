// ---------------------------------------------------------------------------
// test-harness.ts
// DevTools console API for testing the Phaser game without real agent sessions.
//
// Usage (browser DevTools console):
//   window.PH.help()                          — list all commands
//   window.PH.addAgents(4)                    — add 4 active agents
//   window.PH.scenario('busy-office')         — run a preset scenario
//   window.PH.celebrate('rankUp', agentId)    — fire celebration effect
//   window.PH.setTimeOfDay('night')           — switch atmosphere phase
//
// Mount by calling mountHarness(scene) from within OfficeScene or App.tsx:
//   import { mountHarness } from './game/test-harness'
//   mountHarness(scene)
// ---------------------------------------------------------------------------

import type { AgentState, AgentStatus, SessionMode, InteractionType, AgentXP } from '../types'
import { XP_RANKS } from '../types'
import { EventBus } from './events'

// ---------------------------------------------------------------------------
// Minimal AnimationConfig shape — defined locally so no circular dep is needed.
// Expand as workstation-animation.ts gains more knobs.
// ---------------------------------------------------------------------------
export interface AnimationConfig {
  breathDuration?: number
  bounceDuration?: number
  idleWalkInterval?: number
  thoughtBubbleDelay?: number
  [key: string]: unknown
}

let _globalConfig: AnimationConfig = {}

// ---------------------------------------------------------------------------
// State-transition presets
// ---------------------------------------------------------------------------

interface TransitionPreset {
  sessionMode: SessionMode
  needsInteraction: boolean
  interactionType: InteractionType
  status?: AgentStatus
}

const TRANSITION_MAP: Record<string, TransitionPreset> = {
  working: {
    sessionMode: 'working',
    needsInteraction: false,
    interactionType: 'none',
    status: 'active',
  },
  idle: {
    sessionMode: 'idle',
    needsInteraction: false,
    interactionType: 'none',
  },
  waiting: {
    sessionMode: 'working',
    needsInteraction: true,
    interactionType: 'tool-approval',
    status: 'active',
  },
  plan: {
    sessionMode: 'plan',
    needsInteraction: false,
    interactionType: 'none',
    status: 'active',
  },
}

// ---------------------------------------------------------------------------
// Color palette for generated agents
// ---------------------------------------------------------------------------

const AGENT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
]

// ---------------------------------------------------------------------------
// Mock agent factory helpers
// ---------------------------------------------------------------------------

function makeXP(level: number): AgentXP {
  const clampedLevel = Math.max(1, Math.min(10, level))
  const rankEntry = XP_RANKS[clampedLevel - 1]
  return {
    totalXP: clampedLevel * 100,
    level: clampedLevel,
    rank: rankEntry?.title ?? 'Intern',
    tasksCompleted: clampedLevel * 5,
    tasksFailed: 0,
    currentStreak: 0,
  }
}

interface AddAgentsOpts {
  status?: AgentStatus
  sessionMode?: string
  needsInteraction?: boolean
  interactionType?: string
  cwd?: string
  xpLevel?: number
  name?: string
}

function buildMockAgent(n: number, opts: AddAgentsOpts = {}): AgentState {
  const id = crypto.randomUUID()
  const level = opts.xpLevel ?? 1
  const colorIndex = n % AGENT_COLORS.length
  const name = opts.name ? `${opts.name}-${n}` : `Test-${n}`

  return {
    config: {
      id,
      name,
      title: 'Mock Agent',
      podRole: 'solver',
      systemPrompt: '',
      model: 'claude-opus-4-5',
      mcpProfile: 'default',
      skills: [],
      allowedTools: [],
      subAgents: {},
      defaultRepos: [],
      avatar: AGENT_COLORS[colorIndex],
      desk: { row: 0, col: 0 },
      autonomy: 'default',
    },
    status: (opts.status ?? 'active') as AgentStatus,
    sessionMode: (opts.sessionMode ?? 'working') as SessionMode,
    needsInteraction: opts.needsInteraction ?? false,
    interactionType: (opts.interactionType ?? 'none') as InteractionType,
    cwd: opts.cwd ?? '/tmp/penny-test',
    xp: makeXP(level),
  }
}

// ---------------------------------------------------------------------------
// PennyHarness
// ---------------------------------------------------------------------------

export class PennyHarness {
  private mockAgents: AgentState[] = []
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // -------------------------------------------------------------------------
  // Agent injection
  // -------------------------------------------------------------------------

  /**
   * Add `count` mock agents to the scene and return their generated IDs.
   *
   * @example
   * PH.addAgents(4, { status: 'active', sessionMode: 'working' })
   */
  addAgents(count: number, opts: AddAgentsOpts = {}): string[] {
    const ids: string[] = []
    const startN = this.mockAgents.length
    for (let i = 0; i < count; i++) {
      const agent = buildMockAgent(startN + i + 1, opts)
      this.mockAgents.push(agent)
      ids.push(agent.config.id)
    }
    this._flush()
    console.log(`[PH] Added ${count} agent(s). Total: ${this.mockAgents.length}`)
    return ids
  }

  /**
   * Remove all mock agents from the scene.
   */
  clearAgents(): void {
    this.mockAgents = []
    this._flush()
    console.log('[PH] Cleared all mock agents.')
  }

  /**
   * Print a table of current mock agents to the console.
   */
  listAgents(): void {
    const rows = this.mockAgents.map(a => ({
      id: a.config.id.slice(0, 8) + '…',
      name: a.config.name,
      status: a.status,
      sessionMode: a.sessionMode,
      needsInteraction: a.needsInteraction,
      interactionType: a.interactionType,
      xpLevel: a.xp?.level ?? 1,
      cwd: a.cwd,
    }))
    console.table(rows)
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  /**
   * Transition a single agent to a named state preset.
   * Valid presets: 'working', 'idle', 'waiting', 'plan'
   */
  transition(agentId: string, to: string): void {
    const preset = TRANSITION_MAP[to]
    if (!preset) {
      console.warn(`[PH] Unknown transition "${to}". Valid: ${Object.keys(TRANSITION_MAP).join(', ')}`)
      return
    }
    const agent = this.mockAgents.find(a => a.config.id === agentId)
    if (!agent) {
      console.warn(`[PH] Agent not found: ${agentId}`)
      return
    }
    Object.assign(agent, preset)
    this._flush()
    console.log(`[PH] ${agent.config.name} → ${to}`)
  }

  /**
   * Transition all mock agents to a named state preset.
   */
  transitionAll(to: string): void {
    const preset = TRANSITION_MAP[to]
    if (!preset) {
      console.warn(`[PH] Unknown transition "${to}". Valid: ${Object.keys(TRANSITION_MAP).join(', ')}`)
      return
    }
    for (const agent of this.mockAgents) {
      Object.assign(agent, preset)
    }
    this._flush()
    console.log(`[PH] All ${this.mockAgents.length} agent(s) → ${to}`)
  }

  /**
   * Block an agent (set needsInteraction + optional interactionType).
   * Defaults to 'tool-approval'.
   */
  block(agentId: string, type: InteractionType = 'tool-approval'): void {
    const agent = this.mockAgents.find(a => a.config.id === agentId)
    if (!agent) {
      console.warn(`[PH] Agent not found: ${agentId}`)
      return
    }
    agent.needsInteraction = true
    agent.interactionType = type
    this._flush()
    console.log(`[PH] ${agent.config.name} blocked (${type})`)
  }

  /**
   * Unblock an agent — clears needsInteraction and interactionType.
   */
  unblock(agentId: string): void {
    const agent = this.mockAgents.find(a => a.config.id === agentId)
    if (!agent) {
      console.warn(`[PH] Agent not found: ${agentId}`)
      return
    }
    agent.needsInteraction = false
    agent.interactionType = 'none'
    this._flush()
    console.log(`[PH] ${agent.config.name} unblocked`)
  }

  // -------------------------------------------------------------------------
  // Celebrations
  // -------------------------------------------------------------------------

  /**
   * Fire a celebration effect.
   * Types: 'rankUp', 'taskComplete', 'milestone', 'error', 'achievement'
   * If agentId is supplied, the effect fires at the workstation world position.
   * Otherwise it fires at the camera center.
   *
   * @example
   * PH.celebrate('rankUp', PH.addAgents(1)[0])
   */
  celebrate(type: string, agentId?: string): void {
    const celebrations = (this.scene as any).celebrationsManager
    if (!celebrations) {
      console.warn('[PH] CelebrationManager not found on scene (scene may not be ready).')
      return
    }

    const pos = agentId ? this._workstationPos(agentId) : this._cameraCenter()
    const { x, y } = pos

    switch (type) {
      case 'rankUp':
        celebrations.rankUp(x, y, 'TestAgent', 'Senior', 0x3b82f6)
        break
      case 'taskComplete':
        celebrations.taskComplete(x, y)
        break
      case 'milestone':
        celebrations.milestone(x, y, 'Milestone Reached!')
        break
      case 'error':
        celebrations.error(x, y)
        break
      case 'achievement':
        celebrations.achievementUnlocked(x, y, 'First Achievement', 0)
        break
      default:
        console.warn(`[PH] Unknown celebration type "${type}". Valid: rankUp, taskComplete, milestone, error, achievement`)
        return
    }
    console.log(`[PH] Fired celebration "${type}" at (${Math.round(x)}, ${Math.round(y)})`)
  }

  // -------------------------------------------------------------------------
  // Atmosphere
  // -------------------------------------------------------------------------

  /**
   * Set the time-of-day atmosphere phase.
   * Valid phases: 'morning', 'day', 'evening', 'night'
   */
  setTimeOfDay(phase: string): void {
    const atm = (this.scene as any).atmosphereManager
    if (!atm) {
      console.warn('[PH] atmosphereManager not found on scene.')
      return
    }
    const validPhases = ['morning', 'day', 'evening', 'night']
    if (!validPhases.includes(phase)) {
      console.warn(`[PH] Unknown phase "${phase}". Valid: ${validPhases.join(', ')}`)
      return
    }
    atm.currentTimePhase = phase as 'morning' | 'day' | 'evening' | 'night'
    atm.applyDayNightCycle(true)
    console.log(`[PH] Time of day → ${phase}`)
  }

  /**
   * Set the weather type by mapping to an atmosphere phase.
   * Valid types: 'clear' → 'day', 'rain' → 'night', 'snow' → 'morning', 'sunset' → 'evening'
   */
  setWeather(type: string): void {
    const weatherPhaseMap: Record<string, string> = {
      clear: 'day',
      rain: 'night',
      snow: 'morning',
      sunset: 'evening',
    }
    const phase = weatherPhaseMap[type]
    if (!phase) {
      console.warn(`[PH] Unknown weather "${type}". Valid: ${Object.keys(weatherPhaseMap).join(', ')}`)
      return
    }
    this.setTimeOfDay(phase)
    console.log(`[PH] Weather → ${type} (phase: ${phase})`)
  }

  // -------------------------------------------------------------------------
  // Time control (Phaser game time scale)
  // -------------------------------------------------------------------------

  /**
   * Set the Phaser time scale. 1.0 = normal, 2.0 = double speed, 0.5 = half speed.
   */
  timeScale(factor: number): void {
    this.scene.game.loop.wake()
    ;(this.scene.game.loop as any).timeScale = factor
    // Also set on the scene's own time manager
    ;(this.scene.time as any).timeScale = factor
    console.log(`[PH] Time scale → ${factor}`)
  }

  /**
   * Pause the Phaser game loop.
   */
  pause(): void {
    this.scene.game.pause()
    console.log('[PH] Game paused.')
  }

  /**
   * Resume the Phaser game loop.
   */
  resume(): void {
    this.scene.game.resume()
    console.log('[PH] Game resumed.')
  }

  // -------------------------------------------------------------------------
  // Animation config
  // -------------------------------------------------------------------------

  /**
   * Get or patch the animation config object.
   * Pass no args to read the current config.
   * Pass a partial object to merge it in.
   *
   * @example
   * PH.config()                             // get current config
   * PH.config({ breathDuration: 500 })      // patch
   */
  config(patch?: Partial<AnimationConfig>): AnimationConfig | void {
    if (!patch) {
      console.log('[PH] Current animation config:', { ..._globalConfig })
      return { ..._globalConfig }
    }
    Object.assign(_globalConfig, patch)
    console.log('[PH] Animation config patched:', { ..._globalConfig })
  }

  /**
   * Reset the animation config back to defaults.
   */
  configReset(): void {
    _globalConfig = {}
    console.log('[PH] Animation config reset.')
  }

  /**
   * Force all workstations to rebuild their animation tweens by clearing
   * lastAnimMode and re-syncing the scene's agent state.
   */
  refresh(): void {
    const rooms: Map<string, unknown> = (this.scene as any).roomMap
    if (!rooms) {
      console.warn('[PH] roomMap not found on scene.')
      return
    }
    for (const room of rooms.values()) {
      const r = room as { workstations?: Map<string, { lastAnimMode?: string; state?: AgentState }>; }
      if (!r.workstations) continue
      for (const ws of r.workstations.values()) {
        ws.lastAnimMode = undefined
      }
    }
    // Re-push current mock agents to trigger a full sync
    this._flush()
    console.log('[PH] All workstation tweens flagged for rebuild.')
  }

  // -------------------------------------------------------------------------
  // Scenario presets
  // -------------------------------------------------------------------------

  /**
   * Run a named scenario preset.
   *
   * Presets:
   *   'busy-office'  — 8 agents: 6 working, 2 waiting
   *   'celebration'  — 4 idle agents, then fire effects on the first two
   *   'blocked'      — 4 agents, each with a different interactionType
   *   'stress-test'  — 16 working agents
   */
  scenario(name: string): void {
    this.clearAgents()

    switch (name) {
      case 'busy-office': {
        this.addAgents(6, { status: 'active', sessionMode: 'working' })
        this.addAgents(2, { status: 'active', sessionMode: 'working', needsInteraction: true, interactionType: 'tool-approval' })
        console.log('[PH] Scenario: busy-office')
        break
      }

      case 'celebration': {
        const ids = this.addAgents(4, { status: 'idle', sessionMode: 'idle' })
        // Fire effects after a brief delay so workstations have time to render
        this.scene.time.delayedCall(600, () => {
          this.celebrate('rankUp', ids[0])
        })
        this.scene.time.delayedCall(1200, () => {
          this.celebrate('taskComplete', ids[1])
        })
        console.log('[PH] Scenario: celebration')
        break
      }

      case 'blocked': {
        const blockTypes: InteractionType[] = ['tool-approval', 'question', 'accept-edits', 'idle-prompt']
        for (let i = 0; i < 4; i++) {
          const id = this.addAgents(1, {
            status: 'active',
            sessionMode: 'working',
            needsInteraction: true,
            interactionType: blockTypes[i],
            name: `Blocked-${blockTypes[i]}`,
          })[0]
          void id
        }
        console.log('[PH] Scenario: blocked')
        break
      }

      case 'stress-test': {
        this.addAgents(16, { status: 'active', sessionMode: 'working' })
        console.log('[PH] Scenario: stress-test (16 agents)')
        break
      }

      default:
        console.warn(`[PH] Unknown scenario "${name}". Valid: busy-office, celebration, blocked, stress-test`)
    }
  }

  // -------------------------------------------------------------------------
  // Help
  // -------------------------------------------------------------------------

  help(): void {
    console.log(
      `%c Penny Harness (PH) — DevTools API %c\n\n` +
      `%cAgent injection\n%c` +
      `  PH.addAgents(count, opts?)     Add mock agents. opts: { status, sessionMode, needsInteraction,\n` +
      `                                 interactionType, cwd, xpLevel, name }\n` +
      `  PH.clearAgents()               Remove all mock agents\n` +
      `  PH.listAgents()                Print agent table\n\n` +
      `%cState transitions\n%c` +
      `  PH.transition(id, to)          Transition one agent. to: working|idle|waiting|plan\n` +
      `  PH.transitionAll(to)           Transition all agents\n` +
      `  PH.block(id, type?)            Block agent. type: tool-approval|question|accept-edits|idle-prompt\n` +
      `  PH.unblock(id)                 Unblock agent\n\n` +
      `%cCelebrations\n%c` +
      `  PH.celebrate(type, agentId?)   Fire effect. type: rankUp|taskComplete|milestone|error|achievement\n\n` +
      `%cAtmosphere\n%c` +
      `  PH.setTimeOfDay(phase)         morning|day|evening|night\n` +
      `  PH.setWeather(type)            clear|rain|snow|sunset\n\n` +
      `%cTime control\n%c` +
      `  PH.timeScale(factor)           1.0=normal, 2.0=double, 0.5=half\n` +
      `  PH.pause()                     Pause Phaser loop\n` +
      `  PH.resume()                    Resume Phaser loop\n\n` +
      `%cAnimation config\n%c` +
      `  PH.config(patch?)              Get or patch AnimationConfig\n` +
      `  PH.configReset()               Reset config to defaults\n` +
      `  PH.refresh()                   Force rebuild all workstation tweens\n\n` +
      `%cScenarios\n%c` +
      `  PH.scenario(name)              busy-office|celebration|blocked|stress-test\n\n` +
      `%cMisc\n%c` +
      `  PH.help()                      Show this help\n` +
      `  window.__PENNY_HARNESS__       Direct reference to PennyHarness instance\n` +
      `  window.__PENNY_SCENE__         Direct reference to OfficeScene (set externally)\n`,
      'background:#1e293b;color:#38bdf8;font-weight:bold;padding:4px 8px;border-radius:4px',
      '',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
      'color:#f59e0b;font-weight:bold',
      'color:#94a3b8',
    )
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Push mockAgents to the scene via setAgents(). */
  private _flush(): void {
    const scene = this.scene as any
    if (typeof scene.setAgents === 'function') {
      scene.setAgents([...this.mockAgents])
    } else {
      console.warn('[PH] scene.setAgents() not found — scene may not be ready.')
    }
  }

  /**
   * Resolve a workstation's world position for a given agent ID.
   * Falls back to camera center if the workstation can't be found.
   */
  private _workstationPos(agentId: string): { x: number; y: number } {
    const rooms: Map<string, unknown> = (this.scene as any).roomMap
    if (rooms) {
      for (const room of rooms.values()) {
        const r = room as { workstations?: Map<string, { container?: { x: number; y: number } }> }
        if (!r.workstations) continue
        const ws = r.workstations.get(agentId)
        if (ws?.container) {
          return { x: ws.container.x, y: ws.container.y }
        }
      }
    }
    return this._cameraCenter()
  }

  /** Return the world-space position at the center of the camera viewport. */
  private _cameraCenter(): { x: number; y: number } {
    const cam = this.scene.cameras.main
    return {
      x: cam.scrollX + cam.width / 2,
      y: cam.scrollY + cam.height / 2,
    }
  }
}

// ---------------------------------------------------------------------------
// mountHarness — registers window.PH and window.__PENNY_HARNESS__
// ---------------------------------------------------------------------------

/**
 * Mount the test harness on the window object.
 * Call this from within the OfficeScene (or from App.tsx after the game starts).
 *
 * @example
 * // In OfficeScene.create():
 * import { mountHarness } from './test-harness'
 * mountHarness(this)
 */
export function mountHarness(scene: Phaser.Scene): PennyHarness {
  const harness = new PennyHarness(scene)
  ;(window as any).PH = harness
  ;(window as any).__PENNY_HARNESS__ = harness

  // Emit to EventBus so other game modules can react if needed
  EventBus.emit('harness:mounted', harness)

  console.log(
    '%c Penny Harness mounted. Type PH.help() to get started. %c',
    'background:#0f172a;color:#38bdf8;font-weight:bold;padding:3px 8px;border-radius:4px',
    '',
  )

  return harness
}
