import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgentPersona {
  backstory: string
  style: string
  catchphrase: string
}

export interface AgentConfig {
  id: string
  name: string
  title: string
  tripletRole: 'solver' | 'reviewer' | 'executor'
  persona?: AgentPersona
  systemPrompt: string
  model: string
  mcpProfile: string
  skills: string[]
  allowedTools: string[]
  subAgents: Record<string, { description: string; prompt: string }>
  defaultRepos: string[]
  avatar: string
  desk: { row: number; col: number }
  autonomy: string
}

export type AgentStatus = 'sleeping' | 'idle' | 'active'

export type SessionMode = 'working' | 'plan' | 'accept-edits' | 'waiting' | 'idle' | 'compressing'

export type InteractionType =
  | 'tool-approval'
  | 'question'
  | 'accept-edits'
  | 'idle-prompt'
  | 'none'

export interface SubAgentInvocation {
  description: string
  timestamp: number
  status: 'active' | 'completed'
}

export interface AgentState {
  config: AgentConfig
  status: AgentStatus
  needsInteraction?: boolean
  sessionMode?: SessionMode
  interactionType?: InteractionType
  sessionId?: string
  pid?: number
  tty?: string
  cpu?: string
  memoryMB?: number
  uptime?: string
  lastUserMessage?: string
  lastAssistantBlurb?: string
  cwd?: string
  parentAgentId?: string
  isSubAgent?: boolean
  subAgents?: AgentState[]
  subAgentInvocations?: SubAgentInvocation[]
}

// ── YAML Loader ─────────────────────────────────────────────────────────────

const AGENTS_DIR = path.resolve(__dirname, '..', '..', 'agents')
const AGENTS_YAML = path.join(AGENTS_DIR, 'agent-types.yaml')

let agentConfigs: AgentConfig[] = []

export function loadAgentConfigs(): AgentConfig[] {
  try {
    const raw = fs.readFileSync(AGENTS_YAML, 'utf-8')
    const doc = yaml.load(raw) as { agents: Record<string, Record<string, unknown>> }
    agentConfigs = Object.entries(doc.agents).map(([id, cfg]) => {
      const persona = cfg.persona as Record<string, string> | undefined
      return {
        id,
        name: (cfg.name as string) || id,
        title: (cfg.title as string) || (cfg.name as string) || id,
        tripletRole: ((cfg.triplet_role as string) || 'solver') as AgentConfig['tripletRole'],
        persona: persona ? {
          backstory: (persona.backstory || '').trim(),
          style: (persona.style || '').trim(),
          catchphrase: (persona.catchphrase || '').trim(),
        } : undefined,
        systemPrompt: ((cfg.systemPrompt as string) || '').trim(),
        model: (cfg.model as string) || 'opus',
        mcpProfile: (cfg.mcpProfile as string) || 'developer',
        skills: (cfg.skills as string[]) || [],
        allowedTools: (cfg.allowedTools as string[]) || [],
        subAgents: (cfg.subAgents as Record<string, { description: string; prompt: string }>) || {},
        defaultRepos: (cfg.defaultRepos as string[]) || [],
        avatar: (cfg.avatar as string) || id,
        desk: (cfg.desk as { row: number; col: number }) || { row: 0, col: 0 },
        autonomy: (cfg.autonomy as string) || 'default',
      }
    })
  } catch (err) {
    console.error('Failed to load agent configs:', err)
    agentConfigs = []
  }
  return agentConfigs
}

export function getAgentConfigs(): AgentConfig[] {
  if (agentConfigs.length === 0) loadAgentConfigs()
  return agentConfigs
}

export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return getAgentConfigs().find(a => a.id === agentId)
}

// ── YAML Preset Loader (Fix 14) ─────────────────────────────────────────────

export interface TripletPresetYaml {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

export function loadTripletPresets(): TripletPresetYaml[] {
  try {
    const raw = fs.readFileSync(AGENTS_YAML, 'utf-8')
    const doc = yaml.load(raw) as { triplet_presets?: Record<string, Record<string, string>> }
    if (!doc.triplet_presets) return []
    return Object.entries(doc.triplet_presets).map(([id, cfg]) => ({
      id,
      solver: cfg.solver || 'fullstack-dev',
      reviewer: cfg.reviewer || 'backend-arch',
      executor: cfg.executor || 'electron-dev',
      description: cfg.description || '',
    }))
  } catch {
    return []
  }
}

// ── MCP Profile Resolution ──────────────────────────────────────────────────

export function getMcpProfilePath(profileName: string): string {
  return path.join(AGENTS_DIR, 'mcp-profiles', `${profileName}.json`)
}

// ── CLI Command Builder ─────────────────────────────────────────────────────

const DISPATCH_SYSTEM_PROMPT = `You are operating in DISPATCH mode — a two-phase autonomous workflow.

== PHASE 1: PLAN ==
You are currently in the PLANNING phase.
- Analyze the task thoroughly before proposing any changes
- Read relevant code and understand the codebase context
- Ask clarifying questions if anything is ambiguous — this is the ONLY time to ask
- Present a clear, numbered plan of what you will do
- Wait for the user to approve the plan before proceeding
- If the user says 'go', 'approved', 'execute', 'do it', 'lgtm', or similar — move to Phase 2

== PHASE 2: EXECUTE ==
Once the plan is approved:
- Execute the entire plan without stopping for permission
- You may ask clarifying questions if you hit genuine ambiguity, but NEVER ask for permission to proceed
- Make all file edits, run all commands, install dependencies — whatever the plan requires
- If something fails, debug and fix it yourself
- When finished, provide a complete summary of everything you did

== RULES ==
- NEVER ask 'shall I proceed?' or 'would you like me to continue?' — just do it
- NEVER ask permission to read, edit, create, or delete files — just do it
- NEVER ask permission to run commands — just do it
- You MAY ask questions when you genuinely need information you cannot determine yourself
- After execution, report: what changed, what was created, what was tested
- If you encounter an error, fix it. If you can't fix it, explain why and what you tried.`

export function buildAgentCliArgs(agentId: string, cwd: string, dispatch = false): string[] {
  const agent = getAgentConfig(agentId)
  if (!agent) throw new Error(`Unknown agent: ${agentId}`)

  const mcpPath = getMcpProfilePath(agent.mcpProfile)
  const isDispatch = dispatch || agent.autonomy === 'dispatch'

  // Fix 7: Read and inline shared team memory content instead of just referencing the path
  const sharedMemoryPath = path.join(AGENTS_DIR, 'CLAUDE.md')
  let sharedMemoryNote = ''
  if (fs.existsSync(sharedMemoryPath)) {
    try {
      const sharedContent = fs.readFileSync(sharedMemoryPath, 'utf-8')
      sharedMemoryNote = `\n\n--- SHARED TEAM KNOWLEDGE ---\n${sharedContent}\n--- END SHARED TEAM KNOWLEDGE ---`
    } catch {
      sharedMemoryNote = ''
    }
  }

  // Inject persona context
  const personaContext = agent.persona
    ? `\n\nYour name is ${agent.name}. ${agent.persona.backstory} Your working style: ${agent.persona.style}.`
    : ''

  const systemPrompt = isDispatch
    ? `${agent.systemPrompt}${personaContext}${sharedMemoryNote}\n\n${DISPATCH_SYSTEM_PROMPT}`
    : `${agent.systemPrompt}${personaContext}${sharedMemoryNote}`

  const args: string[] = [
    '--name', isDispatch ? `dispatch:${agentId}` : `agent:${agentId}`,
    '--append-system-prompt', systemPrompt,
    '--model', agent.model,
  ]

  if (isDispatch) {
    args.push('--dangerously-skip-permissions')
  } else {
    args.push('--permission-mode', agent.autonomy)
  }

  if (fs.existsSync(mcpPath)) {
    args.push('--mcp-config', mcpPath)
  }

  // Allowed tools — restrict what this agent can access
  if (agent.allowedTools.length > 0) {
    args.push('--allowedTools', ...agent.allowedTools)
  }

  // Sub-agents — give the agent specialized helpers
  if (Object.keys(agent.subAgents).length > 0) {
    args.push('--agents', JSON.stringify(agent.subAgents))
  }

  // Additional directory access for the working directory
  if (cwd) {
    args.push('--add-dir', cwd)
  }

  return args
}

// ── Session Matching ────────────────────────────────────────────────────────

interface SessionInfo {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  name?: string
}

export function matchSessionToAgent(session: SessionInfo): string | null {
  // Check for agent:<id> name pattern in session metadata
  if (session.name && session.name.startsWith('agent:')) {
    const agentId = session.name.slice(6)
    if (getAgentConfig(agentId)) return agentId
  }

  return null
}

// ── Agent State Persistence ─────────────────────────────────────────────────

const STATE_FILE = path.resolve(__dirname, '..', '..', 'data', 'agent-sessions.json')

interface AgentSessionMap {
  [agentId: string]: {
    sessionId: string
    pid: number
    cwd: string
    launchedAt: number
  }
}

export function loadAgentSessionMap(): AgentSessionMap {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    }
  } catch { /* */ }
  return {}
}

export function saveAgentSession(agentId: string, sessionId: string, pid: number, cwd: string): void {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const map = loadAgentSessionMap()
  map[agentId] = { sessionId, pid, cwd, launchedAt: Date.now() }
  fs.writeFileSync(STATE_FILE, JSON.stringify(map, null, 2))
}

export function removeAgentSession(agentId: string): void {
  const map = loadAgentSessionMap()
  delete map[agentId]
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(map, null, 2))
}
