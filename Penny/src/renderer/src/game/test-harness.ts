// ---------------------------------------------------------------------------
// test-harness.ts
// DevTools console API for testing the Phaser game without real agent sessions.
//
// Usage (browser DevTools console):
//   window.PH.help()                          — list all commands
//   window.PH.addAgents(4)                    — add 4 active agents
//   window.PH.loadFixture('pod-trio')         — bundled JSON (game/fixtures/<name>.json)
//   window.PH.record() / PH.stopRecording()   — wall-clock tape
//   window.PH.replay(seq)                     — replay recording (Phaser time)
//   window.PH.profile(1500)                   — Promise: fps / heap sample
//   window.PH.scenario('busy-office')         — run a preset scenario
//   window.PH.celebrate('rankUp', agentId)    — fire celebration effect
//   window.PH.setTimeOfDay('night')           — switch atmosphere phase
//   window.PH.labDecoration()                 — lab JSON version + facility props layer (not fixtures)
//
// Mount by calling mountHarness(scene) from within OfficeScene or App.tsx:
//   import { mountHarness } from './game/test-harness'
//   mountHarness(scene)
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { OfficeScene } from './OfficeScene'
import type { AgentState, AgentStatus, SessionMode, InteractionType, AgentXP, AgentConfig } from '../types'
import { XP_RANKS } from '../types'
import { EventBus } from './events'
import { getFixtureMap, listFixtureNames, type HarnessFixtureAgentRow } from './harness-fixtures'
import { themeIconFrameForTheme, type CelebrationOptions } from './celebrations'
import {
  patchAnimConfig,
  resetAnimConfig,
  getAnimConfig,
  type AnimationConfig as RealAnimationConfig,
} from './animation-config'

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

export const REPLAY_VERSION = 1 as const

export interface HarnessReplayEvent {
  t: number
  cmd: string
  args: unknown[]
}

export interface HarnessReplayPayload {
  version: typeof REPLAY_VERSION
  events: HarnessReplayEvent[]
}

export interface HarnessProfileReport {
  wallMs: number
  frameSamples: number
  meanFps: number
  usedJSHeapMB?: number
}

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

export interface AddAgentsOpts {
  id?: string
  status?: AgentStatus
  sessionMode?: string
  needsInteraction?: boolean
  interactionType?: string
  cwd?: string
  xpLevel?: number
  name?: string
  exactName?: string
  title?: string
  podRole?: AgentConfig['podRole']
  desk?: { row: number; col: number }
  avatar?: string
}

export function cloneOpts<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function fixtureRowToOpts(row: HarnessFixtureAgentRow): AddAgentsOpts {
  const o: AddAgentsOpts = {}
  if (row.status != null) o.status = row.status
  if (row.sessionMode != null) o.sessionMode = row.sessionMode
  if (row.needsInteraction != null) o.needsInteraction = row.needsInteraction
  if (row.interactionType != null) o.interactionType = row.interactionType
  if (row.cwd != null) o.cwd = row.cwd
  if (row.xpLevel != null) o.xpLevel = row.xpLevel
  if (row.name != null) o.exactName = row.name
  if (row.title != null) o.title = row.title
  if (row.podRole != null) o.podRole = row.podRole
  if (row.desk != null) o.desk = row.desk
  if (row.id != null) o.id = row.id
  if (row.avatar != null) o.avatar = row.avatar
  return o
}

function agentFromFixtureRow(row: HarnessFixtureAgentRow, n: number): AgentState {
  return buildMockAgent(n, fixtureRowToOpts(row))
}

export function buildMockAgent(n: number, opts: AddAgentsOpts = {}): AgentState {
  const id = opts.id ?? crypto.randomUUID()
  const level = opts.xpLevel ?? 1
  const colorIndex = n % AGENT_COLORS.length
  const name = opts.exactName ?? (opts.name ? `${opts.name}-${n}` : `Test-${n}`)

  return {
    config: {
      id,
      name,
      title: opts.title ?? 'Mock Agent',
      podRole: opts.podRole ?? 'solver',
      systemPrompt: '',
      model: 'claude-opus-4-5',
      mcpProfile: 'default',
      skills: [],
      allowedTools: [],
      subAgents: {},
      defaultRepos: [],
      avatar: opts.avatar ?? AGENT_COLORS[colorIndex],
      desk: opts.desk ?? { row: 0, col: 0 },
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
  private _flushDeferOnce = false
  private _recordDepth = 0
  private _replaying = false
  private _recording: HarnessReplayEvent[] | null = null
  private _recordT0 = 0
  private _replayTimers: Phaser.Time.TimerEvent[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get fixtureNames(): string[] {
    return listFixtureNames()
  }

  listCommands(): string[] {
    const proto = Object.getPrototypeOf(this) as Record<string, unknown>
    return Object.getOwnPropertyNames(proto)
      .filter(k => k !== 'constructor' && typeof (this as unknown as Record<string, unknown>)[k] === 'function')
      .sort()
  }

  /** Prints strategic layout JSON version, pipeline id, and facility lab layer state (see `lab-decoration.ts`). */
  labDecoration(): void {
    const scene = this.scene as OfficeScene
    if (typeof scene.getLabDecorationDebugInfo !== 'function') {
      console.warn('[PH] labDecoration: getLabDecorationDebugInfo not available on this scene')
      return
    }
    console.log('[PH] Lab decoration', scene.getLabDecorationDebugInfo())
  }

  getAgentsSummary(): { id: string; name: string; sessionMode?: SessionMode }[] {
    return this.mockAgents.map(a => ({
      id: a.config.id,
      name: a.config.name,
      sessionMode: a.sessionMode,
    }))
  }

  loadFixture(nameOrSlug: string): boolean {
    const data = getFixtureMap().get(nameOrSlug)
    if (!data) {
      console.warn(
        `[PH] Unknown fixture "${nameOrSlug}". Try PH.fixtureNames — JSON lives in game/fixtures/<name>.json.`,
      )
      return false
    }
    this._maybeRecord('loadFixture', [nameOrSlug])
    this.mockAgents = data.agents.map((row, i) => agentFromFixtureRow(row, i + 1))
    this._flush()
    console.log(`[PH] Loaded fixture "${nameOrSlug}" (${this.mockAgents.length} agent(s)).`)
    return true
  }

  record(): void {
    if (this._recording) return
    this._cancelReplayTimers()
    this._recording = []
    this._recordT0 = performance.now()
    console.log('[PH] Recording started.')
  }

  stopRecording(): HarnessReplayPayload {
    if (!this._recording) {
      console.warn('[PH] Not recording.')
      return { version: REPLAY_VERSION, events: [] }
    }
    const events = this._recording
    this._recording = null
    console.log(`[PH] Recording stopped (${events.length} event(s)).`)
    return { version: REPLAY_VERSION, events }
  }

  replay(seq: HarnessReplayPayload): void {
    this._cancelReplayTimers()
    if (seq.version !== REPLAY_VERSION) {
      console.warn(`[PH] Unsupported replay version ${seq.version} (expected ${REPLAY_VERSION}).`)
      return
    }
    const events = [...seq.events].sort((a, b) => a.t - b.t)
    let prevT = 0
    for (const ev of events) {
      const delay = Math.max(0, ev.t - prevT)
      prevT = ev.t
      const timer = this.scene.time.delayedCall(delay, () => this._applyReplayEvent(ev))
      this._replayTimers.push(timer)
    }
    console.log(`[PH] Replay scheduled (${events.length} event(s)).`)
  }

  profile(durationMs: number): Promise<HarnessProfileReport> {
    const wallStart = performance.now()
    let frames = 0
    return new Promise(resolve => {
      const step = () => {
        frames++
        const elapsed = performance.now() - wallStart
        if (elapsed >= durationMs) {
          const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          resolve({
            wallMs: elapsed,
            frameSamples: frames,
            meanFps: frames / (elapsed / 1000),
            usedJSHeapMB: mem ? mem.usedJSHeapSize / (1024 * 1024) : undefined,
          })
          return
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
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
    this._maybeRecord('addAgents', [count, cloneOpts(opts)])
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
    this._maybeRecord('clearAgents', [])
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
    this._maybeRecord('transition', [agentId, to])
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
    this._maybeRecord('transitionAll', [to])
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
    this._maybeRecord('block', [agentId, type])
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
    this._maybeRecord('unblock', [agentId])
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
   * Types: 'rankUp', 'taskComplete', 'milestone', 'error', 'achievement', 'seasonEnd', 'seasonStart'
   * If agentId is supplied, the effect fires at the workstation world position.
   * Otherwise it fires at the camera center.
   *
   * @example
   * PH.celebrate('rankUp', PH.addAgents(1)[0])
   * PH.celebrate('taskComplete', id, { skipCooldown: true })
   */
  celebrate(type: string, agentId?: string, phOpts?: { skipCooldown?: boolean }): void {
    this._maybeRecord('celebrate', [type, agentId, phOpts])
    const celebrations = (this.scene as any).celebrationsManager
    if (!celebrations) {
      console.warn('[PH] CelebrationManager not found on scene (scene may not be ready).')
      return
    }

    const pos = agentId ? this._workstationPos(agentId) : this._cameraCenter()
    const { x, y } = pos

    const co = (id?: string): CelebrationOptions | undefined => {
      const o: CelebrationOptions = {}
      if (id) o.agentId = id
      if (phOpts?.skipCooldown) o.skipCooldown = true
      return Object.keys(o).length ? o : undefined
    }

    switch (type) {
      case 'rankUp':
        celebrations.rankUp(x, y, 'TestAgent', 'Senior', 0x3b82f6, co(agentId))
        break
      case 'taskComplete':
        celebrations.taskComplete(x, y, co(agentId))
        break
      case 'milestone':
        celebrations.milestone(x, y, 'Milestone Reached!')
        break
      case 'error':
        celebrations.error(x, y, co(agentId))
        break
      case 'achievement':
        celebrations.achievementUnlocked(x, y, 'First Achievement', 0)
        break
      case 'seasonEnd': {
        const ids = agentId ? [agentId] : this.addAgents(2, { status: 'idle', sessionMode: 'idle' })
        const mvpId = ids[0]
        const mvpPos = agentId ? pos : this._workstationPos(mvpId)
        celebrations.seasonEndCeremony(
          {
            seasonId: 'ph-mock-end',
            seasonName: 'Ship It',
            theme: 'ship',
            accentColor: 0x34d399,
            score: 1200,
            questsCompletedThisSeason: 47,
            totalSeasonXP: 2340,
            summaryLine: 'Ship It Season Complete — 47 quests, 2340 XP',
            rankings: [
              { rank: 1, agentId: mvpId, agentName: 'MVP Agent', seasonXP: 900, tasksCompleted: 30 },
              {
                rank: 2,
                agentId: ids[1] ?? 'runner-up',
                agentName: 'Runner Up',
                seasonXP: 400,
                tasksCompleted: 12,
              },
            ],
            mvpAgentId: mvpId,
            mvpWorldX: mvpPos.x,
            mvpWorldY: mvpPos.y,
            creditBonusShown: 84,
          },
          { bypassDedupe: true },
        )
        break
      }
      case 'seasonStart':
        celebrations.seasonStartIntro({
          seasonName: 'Neon Sprint',
          theme: 'neon',
          accentColor: 0x00e5ff,
          themeIconFrame: themeIconFrameForTheme('neon'),
          challenges: [
            { description: 'Complete 50 tasks', completed: false },
            { description: 'Earn 500 credits', completed: false },
          ],
        })
        break
      default:
        console.warn(
          `[PH] Unknown celebration type "${type}". Valid: rankUp, taskComplete, milestone, error, achievement, seasonEnd, seasonStart`,
        )
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
    this._maybeRecord('setTimeOfDay', [phase])
    this._applySetTimeOfDay(phase)
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
    this._maybeRecord('setWeather', [type])
    this._applySetTimeOfDay(phase)
    console.log(`[PH] Weather → ${type} (phase: ${phase})`)
  }

  // -------------------------------------------------------------------------
  // Time control (Phaser game time scale)
  // -------------------------------------------------------------------------

  /**
   * Set the Phaser time scale. 1.0 = normal, 2.0 = double speed, 0.5 = half speed.
   */
  timeScale(factor: number): void {
    this._maybeRecord('timeScale', [factor])
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
    this._maybeRecord('pause', [])
    this.scene.game.pause()
    console.log('[PH] Game paused.')
  }

  /**
   * Resume the Phaser game loop.
   */
  resume(): void {
    this._maybeRecord('resume', [])
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
      const snap = getAnimConfig()
      console.log('[PH] Current animation config:', snap)
      return snap as unknown as AnimationConfig
    }
    this._maybeRecord('config', [cloneOpts(patch)])
    patchAnimConfig(patch as any)
    console.log('[PH] Animation config patched:', getAnimConfig())
  }

  /**
   * Reset the animation config back to defaults.
   */
  configReset(): void {
    this._maybeRecord('configReset', [])
    resetAnimConfig()
    console.log('[PH] Animation config reset.')
  }

  /**
   * Force all workstations to rebuild their animation tweens by clearing
   * lastAnimMode and re-syncing the scene's agent state.
   */
  refresh(): void {
    this._maybeRecord('refresh', [])
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
    this._maybeRecord('scenario', [name])
    this._recordDepth++
    try {
      this.mockAgents = []
      this._flush()

      switch (name) {
        case 'busy-office': {
          this.addAgents(6, { status: 'active', sessionMode: 'working' })
          this.addAgents(2, { status: 'active', sessionMode: 'working', needsInteraction: true, interactionType: 'tool-approval' })
          console.log('[PH] Scenario: busy-office')
          break
        }

        case 'celebration': {
          const ids = this.addAgents(4, { status: 'idle', sessionMode: 'idle' })
          this.scene.time.delayedCall(600, () => {
            this._runWithoutRecording(() => this.celebrate('rankUp', ids[0]))
          })
          this.scene.time.delayedCall(1200, () => {
            this._runWithoutRecording(() => this.celebrate('taskComplete', ids[1]))
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
    } finally {
      this._recordDepth--
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
      `%cFixtures\n%c` +
      `  PH.loadFixture(name)           game/fixtures/<name>.json (bundled)\n` +
      `  PH.fixtureNames                List fixture slugs\n` +
      `  PH.getAgentsSummary()          { id, name, sessionMode }[]\n` +
      `  PH.listCommands()              Sorted method names\n\n` +
      `%cRecord / replay\n%c` +
      `  PH.record() / stopRecording()  Wall-clock event tape\n` +
      `  PH.replay(payload)             Phaser delayedCall chain (timeScale applies)\n\n` +
      `%cProfiling\n%c` +
      `  PH.profile(ms)                 Promise — meanFps / optional heap (Chromium)\n\n` +
      `%cState transitions\n%c` +
      `  PH.transition(id, to)          Transition one agent. to: working|idle|waiting|plan\n` +
      `  PH.transitionAll(to)           Transition all agents\n` +
      `  PH.block(id, type?)            Block agent. type: tool-approval|question|accept-edits|idle-prompt\n` +
      `  PH.unblock(id)                 Unblock agent\n\n` +
      `%cCelebrations\n%c` +
      `  PH.celebrate(type, agentId?, opts?)   Fire effect. opts: { skipCooldown }. Types: rankUp|taskComplete|milestone|error|achievement|seasonEnd|seasonStart\n\n` +
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
      `%cLab decoration\n%c` +
      `  PH.labDecoration()             Strategic JSON version, pipeline id, facility props layer\n\n` +
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

  private _recordingOn(): boolean {
    return this._recording != null && this._recordDepth === 0
  }

  private _maybeRecord(cmd: string, args: unknown[]): void {
    if (this._replaying || !this._recordingOn()) return
    this._recording!.push({
      t: performance.now() - this._recordT0,
      cmd,
      args,
    })
  }

  private _runWithoutRecording(fn: () => void): void {
    this._recordDepth++
    try {
      fn()
    } finally {
      this._recordDepth--
    }
  }

  private _cancelReplayTimers(): void {
    for (const t of this._replayTimers) {
      t.remove(false)
    }
    this._replayTimers = []
  }

  private _applySetTimeOfDay(phase: string): void {
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

  private _applyReplayEvent(ev: HarnessReplayEvent): void {
    this._replaying = true
    try {
      switch (ev.cmd) {
        case 'addAgents':
          this.addAgents(ev.args[0] as number, (ev.args[1] as AddAgentsOpts) ?? {})
          break
        case 'clearAgents':
          this.clearAgents()
          break
        case 'loadFixture':
          this.loadFixture(ev.args[0] as string)
          break
        case 'transition':
          this.transition(ev.args[0] as string, ev.args[1] as string)
          break
        case 'transitionAll':
          this.transitionAll(ev.args[0] as string)
          break
        case 'block':
          this.block(ev.args[0] as string, (ev.args[1] as InteractionType) ?? 'tool-approval')
          break
        case 'unblock':
          this.unblock(ev.args[0] as string)
          break
        case 'celebrate':
          this.celebrate(
            ev.args[0] as string,
            ev.args[1] as string | undefined,
            ev.args[2] as { skipCooldown?: boolean } | undefined,
          )
          break
        case 'setTimeOfDay':
          this.setTimeOfDay(ev.args[0] as string)
          break
        case 'setWeather':
          this.setWeather(ev.args[0] as string)
          break
        case 'timeScale':
          this.timeScale(ev.args[0] as number)
          break
        case 'pause':
          this.pause()
          break
        case 'resume':
          this.resume()
          break
        case 'config':
          this.config(ev.args[0] as Partial<AnimationConfig>)
          break
        case 'configReset':
          this.configReset()
          break
        case 'refresh':
          this.refresh()
          break
        case 'scenario':
          this.scenario(ev.args[0] as string)
          break
        default:
          console.warn(`[PH] replay: unknown cmd "${ev.cmd}"`)
      }
    } finally {
      this._replaying = false
    }
  }

  /** Push mockAgents to the scene via setAgents(). */
  private _flush(): void {
    const scene = this.scene as { setAgents?: (a: AgentState[]) => void }
    if (typeof scene.setAgents !== 'function') {
      console.warn('[PH] scene.setAgents() not found — scene may not be ready.')
      return
    }
    if (!this.scene.add) {
      if (!this._flushDeferOnce) {
        this._flushDeferOnce = true
        this.scene.events.once(Phaser.Scenes.Events.UPDATE, () => {
          this._flushDeferOnce = false
          this._flush()
        })
      }
      return
    }
    scene.setAgents([...this.mockAgents])
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
