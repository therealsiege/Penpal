// ---------------------------------------------------------------------------
// agent-schedule.ts
// Agent daily routine schedule driven by game (wall-clock) time.
// Real session state always overrides — schedule only drives idle behavior.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleActivity =
  | 'work'
  | 'break'
  | 'coffee'
  | 'meeting'
  | 'review'
  | 'standup'
  | 'arrive'
  | 'leave'

export interface ScheduleBlock {
  /** Start hour in 24h decimal (e.g. 8.25 = 08:15) */
  startHour: number
  /** End hour in 24h decimal (e.g. 10.5 = 10:30) */
  endHour: number
  activity: ScheduleActivity
  /** Optional location hint for future spatial routing */
  location?: string
}

export interface AgentSchedule {
  /** Human-readable variation name */
  variation: 'early_bird' | 'normal' | 'night_owl'
  blocks: ScheduleBlock[]
}

// ---------------------------------------------------------------------------
// Schedule templates
// ---------------------------------------------------------------------------

/** Default 9-to-5 schedule (08:00–17:30) */
const NORMAL_SCHEDULE: AgentSchedule = {
  variation: 'normal',
  blocks: [
    { startHour: 8.0,   endHour: 8.25,  activity: 'arrive' },
    { startHour: 8.25,  endHour: 8.5,   activity: 'standup' },
    { startHour: 8.5,   endHour: 10.5,  activity: 'work' },
    { startHour: 10.5,  endHour: 10.75, activity: 'coffee' },
    { startHour: 10.75, endHour: 12.0,  activity: 'work' },
    { startHour: 12.0,  endHour: 12.5,  activity: 'break' },
    { startHour: 12.5,  endHour: 15.0,  activity: 'work' },
    { startHour: 15.0,  endHour: 15.25, activity: 'coffee' },
    { startHour: 15.25, endHour: 17.0,  activity: 'work' },
    { startHour: 17.0,  endHour: 17.5,  activity: 'review' },
    { startHour: 17.5,  endHour: 24.0,  activity: 'leave' },
  ],
}

/** Early bird schedule (07:00–15:30) — 2h shift earlier */
const EARLY_BIRD_SCHEDULE: AgentSchedule = {
  variation: 'early_bird',
  blocks: [
    { startHour: 7.0,   endHour: 7.25,  activity: 'arrive' },
    { startHour: 7.25,  endHour: 7.5,   activity: 'standup' },
    { startHour: 7.5,   endHour: 9.5,   activity: 'work' },
    { startHour: 9.5,   endHour: 9.75,  activity: 'coffee' },
    { startHour: 9.75,  endHour: 11.0,  activity: 'work' },
    { startHour: 11.0,  endHour: 11.5,  activity: 'break' },
    { startHour: 11.5,  endHour: 13.0,  activity: 'work' },
    { startHour: 13.0,  endHour: 13.25, activity: 'coffee' },
    { startHour: 13.25, endHour: 15.0,  activity: 'work' },
    { startHour: 15.0,  endHour: 15.5,  activity: 'review' },
    { startHour: 15.5,  endHour: 24.0,  activity: 'leave' },
  ],
}

/** Night owl schedule (10:00–19:30) — 2h shift later */
const NIGHT_OWL_SCHEDULE: AgentSchedule = {
  variation: 'night_owl',
  blocks: [
    { startHour: 10.0,  endHour: 10.25, activity: 'arrive' },
    { startHour: 10.25, endHour: 10.5,  activity: 'standup' },
    { startHour: 10.5,  endHour: 12.5,  activity: 'work' },
    { startHour: 12.5,  endHour: 12.75, activity: 'coffee' },
    { startHour: 12.75, endHour: 14.0,  activity: 'work' },
    { startHour: 14.0,  endHour: 14.5,  activity: 'break' },
    { startHour: 14.5,  endHour: 17.0,  activity: 'work' },
    { startHour: 17.0,  endHour: 17.25, activity: 'coffee' },
    { startHour: 17.25, endHour: 19.0,  activity: 'work' },
    { startHour: 19.0,  endHour: 19.5,  activity: 'review' },
    { startHour: 19.5,  endHour: 24.0,  activity: 'leave' },
  ],
}

// ---------------------------------------------------------------------------
// Per-persona variation assignments
// Names match the agent personas defined in agents/agent-types.yaml
// ---------------------------------------------------------------------------

const EARLY_BIRD_AGENTS = new Set([
  'lena-park',
  'lena_park',
  'Lena Park',
  'ava-reyes',
  'ava_reyes',
  'Ava Reyes',
  'dana-webb',
  'dana_webb',
  'Dana Webb',
])

const NIGHT_OWL_AGENTS = new Set([
  'kai-tanaka',
  'kai_tanaka',
  'Kai Tanaka',
  'sam-torres',
  'sam_torres',
  'Sam Torres',
  'oleg-volkov',
  'oleg_volkov',
  'Oleg Volkov',
])

// ---------------------------------------------------------------------------
// Schedule lookup
// ---------------------------------------------------------------------------

/**
 * Return the AgentSchedule for an agent based on their ID or name.
 * Matches hyphenated IDs, underscore IDs, and display names.
 */
export function getAgentSchedule(agentId: string): AgentSchedule {
  if (EARLY_BIRD_AGENTS.has(agentId)) return EARLY_BIRD_SCHEDULE
  if (NIGHT_OWL_AGENTS.has(agentId)) return NIGHT_OWL_SCHEDULE
  return NORMAL_SCHEDULE
}

/**
 * Return the scheduled activity for an agent at the given game hour.
 *
 * `gameHour` is a decimal 0–24 derived from real wall-clock time
 * (e.g. `new Date().getHours() + new Date().getMinutes() / 60`).
 *
 * **Real agent session state always overrides this value.**
 * Only call this function when the agent is genuinely idle (no active session).
 */
export function getCurrentActivity(agentId: string, gameHour: number): ScheduleActivity {
  const schedule = getAgentSchedule(agentId)
  for (const block of schedule.blocks) {
    if (gameHour >= block.startHour && gameHour < block.endHour) {
      return block.activity
    }
  }
  // Outside all blocks (e.g. midnight–7am for normal) → office is empty
  return 'leave'
}

/**
 * Return the current game hour as a decimal from real wall-clock time.
 * e.g. 14:45 → 14.75
 */
export function getGameHour(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}

/**
 * Return true if the agent should currently be "in office" according
 * to their schedule (any activity other than 'leave').
 * Real session state always takes precedence over this check.
 */
export function isAgentInOffice(agentId: string): boolean {
  return getCurrentActivity(agentId, getGameHour()) !== 'leave'
}
