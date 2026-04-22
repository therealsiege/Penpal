import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { resolveUserPath } from './paths'
import { atomicUpdate } from './atomic-store'

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
  podRole: 'solver' | 'reviewer' | 'executor'
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

export type SessionMode = 'working' | 'plan' | 'accept-edits' | 'waiting' | 'idle' | 'compressing' | 'error' | 'disconnected' | 'crashed'

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

export interface OpenClawInfo {
  supervised: boolean
  runtime?: 'openclaw' | 'nemoclaw'
  sessionId?: string
  agentId?: string
  sandboxed?: boolean
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
  openclaw?: OpenClawInfo
  parseErrors?: number
  lastError?: string | null
  // Context window utilization (0.0–1.0) and rot detection
  contextUtilization?: number
  contextRotDetected?: boolean
}

// ── YAML Loader ─────────────────────────────────────────────────────────────

let cachedAgentsDir: string | null = null

/** Resolves to the folder containing agent-types.yaml (dev: Penny/agents, packaged: app.asar/agents). */
function getAgentsDir(): string {
  if (cachedAgentsDir) return cachedAgentsDir
  const fromMain = path.resolve(__dirname, '..', '..', 'agents')
  const candidates: string[] = [fromMain]
  try {
    // Packaged app: configs live next to out/ inside app.asar; __dirname resolution can differ by install path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (app?.isPackaged && typeof app.getAppPath === 'function') {
      candidates.unshift(path.join(app.getAppPath(), 'agents'))
    }
  } catch {
    /* electron unavailable (e.g. some tests) */
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'agent-types.yaml'))) {
      cachedAgentsDir = dir
      console.log(`[agents] Using agent config directory: ${dir}`)
      return cachedAgentsDir
    }
  }
  cachedAgentsDir = fromMain
  return cachedAgentsDir
}

function getAgentTypesYamlPath(): string {
  return path.join(getAgentsDir(), 'agent-types.yaml')
}

let agentConfigs: AgentConfig[] = []

export function loadAgentConfigs(): AgentConfig[] {
  const yamlPath = getAgentTypesYamlPath()
  console.log(`[agents] Loading agent configs from ${yamlPath}`)
  try {
    const raw = fs.readFileSync(yamlPath, 'utf-8')
    const doc = yaml.load(raw) as { agents: Record<string, Record<string, unknown>> }
    if (!doc?.agents || typeof doc.agents !== 'object') {
      console.error(`[agents] YAML parsed but doc.agents is missing or not an object. Keys: ${Object.keys(doc ?? {})}`)
      agentConfigs = []
      return agentConfigs
    }
    agentConfigs = Object.entries(doc.agents).map(([id, cfg]) => {
      const persona = cfg.persona as Record<string, string> | undefined
      return {
        id,
        name: (cfg.name as string) || id,
        title: (cfg.title as string) || (cfg.name as string) || id,
        podRole: ((cfg.pod_role as string) || (cfg.triplet_role as string) || 'solver') as AgentConfig['podRole'],
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
        defaultRepos: ((cfg.defaultRepos as string[]) || []).map(resolveUserPath),
        avatar: (cfg.avatar as string) || id,
        desk: (cfg.desk as { row: number; col: number }) || { row: 0, col: 0 },
        autonomy: (cfg.autonomy as string) || 'default',
      }
    })
    console.log(`[agents] Loaded ${agentConfigs.length} agents: ${agentConfigs.map(a => a.id).join(', ')}`)
  } catch (err) {
    console.error(`[agents] Failed to load agent configs from ${yamlPath}:`, err)
    agentConfigs = []
  }
  return agentConfigs
}

export function getAgentConfigs(): AgentConfig[] {
  if (agentConfigs.length === 0) loadAgentConfigs()
  return agentConfigs
}

export function getAgentConfig(agentId: string): AgentConfig | undefined {
  const configs = getAgentConfigs()
  const found = configs.find(a => a.id === agentId)
  if (!found) {
    console.error(`[agents] getAgentConfig('${agentId}') not found. Loaded ${configs.length} agents: [${configs.map(a => a.id).join(', ')}]`)
  }
  return found
}

// ── YAML Preset Loader (Fix 14) ─────────────────────────────────────────────

export interface PodPresetYaml {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

export function loadPodPresets(): PodPresetYaml[] {
  try {
    const raw = fs.readFileSync(getAgentTypesYamlPath(), 'utf-8')
    const doc = yaml.load(raw) as { pod_presets?: Record<string, Record<string, string>>; triplet_presets?: Record<string, Record<string, string>> }
    const presets = doc.pod_presets || doc.triplet_presets
    if (!presets) return []
    return Object.entries(presets).map(([id, cfg]) => ({
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
  return path.join(getAgentsDir(), 'mcp-profiles', `${profileName}.json`)
}

/**
 * Generates a per-agent markdown file with YAML frontmatter (mcpServers) and the
 * tagged system prompt as the body. Consumed by the `--agent` Claude Code flag, which
 * loads mcpServers for the main-thread session and appends the body to the system prompt.
 *
 * Files are written to agents/agent-files/{agentId}.md and regenerated on every call
 * so that dynamic content (shared CLAUDE.md) is always fresh.
 */
export function generateAgentFile(agentId: string, opts: BuildCliOpts = {}): string {
  const agent = getAgentConfig(agentId)
  if (!agent) throw new Error(`Unknown agent: ${agentId}`)

  // Load mcpServers from the agent's MCP profile JSON
  const mcpPath = getMcpProfilePath(agent.mcpProfile)
  let mcpServers: Record<string, unknown> = {}
  if (fs.existsSync(mcpPath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(mcpPath, 'utf-8')) as { mcpServers?: Record<string, unknown> }
      mcpServers = profile.mcpServers || {}
    } catch (err) {
      console.warn(`[agents] Failed to load MCP profile for ${agentId}:`, err)
    }
  }

  // Build the system prompt body (same content previously injected via --append-system-prompt)
  const taggedPrompt = buildAgentTaggedSystemPrompt(agentId, opts)

  // Serialize mcpServers as YAML frontmatter
  const frontmatter = yaml.dump({ mcpServers }, { noRefs: true, lineWidth: 200, quotingType: '"' })

  const agentFilesDir = path.join(getAgentsDir(), 'agent-files')
  fs.mkdirSync(agentFilesDir, { recursive: true })

  const agentFilePath = path.join(agentFilesDir, `${agentId}.md`)
  const content = `---\n${frontmatter}---\n\n${taggedPrompt}\n`
  fs.writeFileSync(agentFilePath, content, 'utf-8')

  console.log(`[agents] Generated agent file: ${agentFilePath} (${content.length} bytes)`)
  return agentFilePath
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

export interface BuildCliOpts {
  dispatch?: boolean
  headless?: boolean
  permissionMode?: string
  /** Override the agent's default model (e.g. 'opus', 'sonnet', 'haiku'). */
  modelOverride?: string
}

/** System prompt + agent tag (same text Claude Code receives via --append-system-prompt). */
export function buildAgentTaggedSystemPrompt(agentId: string, opts: BuildCliOpts = {}): string {
  const agent = getAgentConfig(agentId)
  if (!agent) throw new Error(`Unknown agent: ${agentId}`)

  const isDispatch = opts.dispatch || agent.autonomy === 'dispatch'

  // All agents receive shared team knowledge (CLAUDE.md)
  let sharedMemoryNote = ''
  const sharedMemoryPath = path.join(getAgentsDir(), 'CLAUDE.md')
  if (fs.existsSync(sharedMemoryPath)) {
    try {
      const sharedContent = fs.readFileSync(sharedMemoryPath, 'utf-8')
      sharedMemoryNote = `\n\n--- SHARED TEAM KNOWLEDGE ---\n${sharedContent}\n--- END SHARED TEAM KNOWLEDGE ---`
      console.log('[agent] injected shared memory:', sharedMemoryNote.length, 'chars')
    } catch {
      sharedMemoryNote = ''
    }
  }

  // Persona context is injected for ALL agents (including headless pod agents)
  // so they retain their identity, style, and team knowledge.
  const personaContext = agent.persona
    ? `\n\nYour name is ${agent.name}. ${agent.persona.backstory} Your working style: ${agent.persona.style}.`
    : ''

  // Headless mode skips the interactive DISPATCH prompt — task instructions come via the prompt arg
  const systemPrompt = (!opts.headless && isDispatch)
    ? `${agent.systemPrompt}${personaContext}${sharedMemoryNote}\n\n${DISPATCH_SYSTEM_PROMPT}`
    : `${agent.systemPrompt}${personaContext}${sharedMemoryNote}`

  const agentTag = isDispatch ? `dispatch:${agentId}` : `agent:${agentId}`
  return `[AGENT_ID:${agentTag}]\n\n${systemPrompt}`
}

export type TaskRunnerKind = 'claude' | 'opencode' | 'cursor-agent'

/** Stages that can each use a different headless backend chain (see PENNY_TASK_RUNNER_* env vars). */
export type HeadlessPhase = 'planning' | 'executing' | 'validating' | 'reviewing'

/** CLI runner or local Ollama (read-only / cheap validation). */
export type HeadlessBackend = TaskRunnerKind | 'ollama'

function normalizeTaskRunnerToken(raw: string): TaskRunnerKind | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  if (s === 'opencode' || s === 'open-code') return 'opencode'
  if (s === 'cursor' || s === 'cursor-agent') return 'cursor-agent'
  if (s === 'claude' || s === 'claude-code') return 'claude'
  return null
}

/**
 * Parse a comma-separated backend list, e.g. `claude,cursor-agent` or `ollama,claude`.
 * Tokens `ollama` / `local` use the Ollama-compatible API (`PENNY_OLLAMA_BASE_URL`, `PENNY_OLLAMA_MODEL`).
 */
export function parseHeadlessBackends(spec: string | undefined): HeadlessBackend[] | null {
  if (spec == null || !spec.trim()) return null
  const out: HeadlessBackend[] = []
  for (const part of spec.split(',')) {
    const t = part.trim().toLowerCase()
    if (!t) continue
    if (t === 'ollama' || t === 'local') {
      out.push('ollama')
      continue
    }
    const k = normalizeTaskRunnerToken(t)
    if (k) out.push(k)
  }
  return out.length ? out : null
}

/**
 * Resolved backend chain for a workflow phase. Falls back to `PENNY_TASK_RUNNER` (single runner) when no phase-specific env is set.
 * Reviewing: PENNY_TASK_RUNNER_REVIEW* → PENNY_TASK_RUNNER_VALIDATE* → PENNY_TASK_RUNNER_PLAN* → default.
 */
export function getHeadlessBackendChain(phase: HeadlessPhase): HeadlessBackend[] {
  let spec: string | undefined
  switch (phase) {
    case 'planning':
      spec = process.env.PENNY_TASK_RUNNER_PLANNING?.trim() || process.env.PENNY_TASK_RUNNER_PLAN?.trim()
      break
    case 'executing':
      spec = process.env.PENNY_TASK_RUNNER_EXECUTING?.trim() || process.env.PENNY_TASK_RUNNER_EXECUTE?.trim()
      break
    case 'validating':
      spec = process.env.PENNY_TASK_RUNNER_VALIDATING?.trim() || process.env.PENNY_TASK_RUNNER_VALIDATE?.trim()
      break
    case 'reviewing':
      spec =
        process.env.PENNY_TASK_RUNNER_REVIEWING?.trim() ||
        process.env.PENNY_TASK_RUNNER_REVIEW?.trim() ||
        process.env.PENNY_TASK_RUNNER_VALIDATING?.trim() ||
        process.env.PENNY_TASK_RUNNER_VALIDATE?.trim() ||
        process.env.PENNY_TASK_RUNNER_PLANNING?.trim() ||
        process.env.PENNY_TASK_RUNNER_PLAN?.trim()
      break
  }
  const parsed = parseHeadlessBackends(spec)
  if (parsed?.length) return parsed
  return [getTaskRunnerKind()]
}

/** True when stderr/stdout suggests quota, rate limit, or local Ollama unavailable — try next backend in chain. */
export function headlessFailureShouldFallback(errorText: string, outputText: string): boolean {
  if (process.env.PENNY_TASK_RUNNER_RETRY_ANY_FAILURE === '1') return true
  const blob = `${errorText || ''}\n${outputText || ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    blob.includes('hit your limit') ||
    blob.includes("you've hit your limit") ||
    blob.includes('rate limit') ||
    blob.includes('rate_limit') ||
    blob.includes('too many requests') ||
    blob.includes('status code 429') ||
    /\b429\b/.test(blob) ||
    blob.includes('quota') ||
    blob.includes('overloaded') ||
    blob.includes('capacity') ||
    blob.includes('ollama not running') ||
    blob.includes('ollama endpoint unreachable') ||
    blob.includes('econnrefused')
  )
}

/** Headless orchestrator/pods execution. Default: Cursor Agent CLI. Override with `PENNY_TASK_RUNNER=claude` or `opencode`. */
export function getTaskRunnerKind(): TaskRunnerKind {
  const fromEnv = (process.env.PENNY_TASK_RUNNER || '').trim().toLowerCase()
  if (fromEnv === 'opencode' || fromEnv === 'open-code') return 'opencode'
  if (fromEnv === 'cursor' || fromEnv === 'cursor-agent') return 'cursor-agent'
  if (fromEnv === 'claude' || fromEnv === 'claude-code') return 'claude'
  return 'cursor-agent'
}

/** Map YAML `model` shorthand to OpenCode `provider/model` (override any model with `PENNY_OPENCODE_MODEL`). */
export function mapModelToOpenCodeModel(model: string): string {
  const override = process.env.PENNY_OPENCODE_MODEL?.trim()
  if (override) return override

  // Already in provider/model format
  if (model.includes('/')) return model

  // Ollama models: 'ollama:qwen3-coder:30b' → 'ollama/qwen3-coder:30b'
  if (model.startsWith('ollama:')) return `ollama/${model.slice('ollama:'.length)}`

  const m = model.toLowerCase()
  if (m === 'opus' || m === 'claude-opus') return 'anthropic/claude-opus-4-5-20251001'
  if (m.includes('sonnet')) return 'anthropic/claude-sonnet-4-5-20250929'
  if (m.includes('haiku')) return 'anthropic/claude-3-5-haiku-20241022'
  if (m === 'cursor-agent') return 'anthropic/claude-sonnet-4-5-20250929'
  return 'anthropic/claude-sonnet-4-5-20250929'
}

export interface HeadlessInvocation {
  command: string
  args: string[]
  cwd: string
}

export function buildAgentHeadlessInvocation(
  agentId: string,
  cwd: string,
  userPrompt: string,
  opts: BuildCliOpts & { permissionMode?: string; runner?: TaskRunnerKind } = {},
): HeadlessInvocation {
  const resolvedCwd = resolveUserPath(cwd)
  const runner = opts.runner ?? getTaskRunnerKind()

  if (runner === 'claude') {
    const cliArgs = buildAgentCliArgs(agentId, resolvedCwd, {
      headless: true,
      permissionMode: opts.permissionMode,
      dispatch: opts.dispatch,
      modelOverride: opts.modelOverride,
    })
    return { command: 'claude', args: [...cliArgs, '--', userPrompt], cwd: resolvedCwd }
  }

  const taggedSystem = buildAgentTaggedSystemPrompt(agentId, { ...opts, headless: true })
  const fullPrompt = `${taggedSystem}\n\n--- USER TASK ---\n\n${userPrompt}`

  if (runner === 'opencode') {
    const agent = getAgentConfig(agentId)
    if (!agent) throw new Error(`Unknown agent: ${agentId}`)
    const model = mapModelToOpenCodeModel(opts.modelOverride || agent.model)
    const args: string[] = ['run', '-m', model]
    const attach = process.env.PENNY_OPENCODE_ATTACH?.trim() || process.env.OPENCODE_RUN_ATTACH?.trim()
    if (attach) {
      args.push('--attach', attach)
    }
    args.push(fullPrompt)
    return { command: 'opencode', args, cwd: resolvedCwd }
  }

  const agentBin = process.env.PENNY_CURSOR_AGENT_BIN?.trim() || 'agent'
  return {
    command: agentBin,
    args: ['-p', '--force', '--output-format', 'text', fullPrompt],
    cwd: resolvedCwd,
  }
}

export function buildAgentCliArgs(agentId: string, cwd: string, opts: BuildCliOpts = {}): string[] {
  const agent = getAgentConfig(agentId)
  if (!agent) throw new Error(`Unknown agent: ${agentId}`)

  const isDispatch = opts.dispatch || agent.autonomy === 'dispatch'

  // Generate the per-agent .md file (YAML frontmatter with mcpServers + system prompt body).
  // This replaces the previous --append-system-prompt + --mcp-config pair: Claude Code now
  // loads mcpServers for the main-thread session when invoked with --agent.
  const agentFilePath = generateAgentFile(agentId, opts)

  const args: string[] = []

  if (opts.headless) {
    args.push('-p')
  }

  args.push('--agent', agentFilePath)
  args.push('--model', opts.modelOverride || agent.model)

  // Permission handling: explicit override > headless default > dispatch > agent config
  if (opts.permissionMode) {
    args.push('--permission-mode', opts.permissionMode)
  } else if (opts.headless || isDispatch) {
    args.push('--dangerously-skip-permissions')
  } else {
    args.push('--permission-mode', agent.autonomy)
  }

  if (agent.allowedTools.length > 0) {
    for (const tool of agent.allowedTools) {
      args.push('--allowedTools', tool)
    }
  }

  if (Object.keys(agent.subAgents).length > 0) {
    args.push('--agents', JSON.stringify(agent.subAgents))
  }

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
  // Check for agent:<id> name pattern in iTerm session name
  if (session.name && session.name.startsWith('agent:')) {
    const agentId = session.name.slice(6)
    if (getAgentConfig(agentId)) return agentId
  }

  // Check persisted session map by PID
  const map = loadAgentSessionMap()
  for (const [agentId, saved] of Object.entries(map)) {
    if (saved.pid === session.pid && getAgentConfig(agentId)) return agentId
  }

  // Match by CWD against agent default repos
  for (const cfg of getAgentConfigs()) {
    if (cfg.defaultRepos.some(repo => session.cwd === repo)) return cfg.id
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
  atomicUpdate<Record<string, { sessionId: string; pid: number; cwd: string; launchedAt: number }>>(
    STATE_FILE,
    (map) => ({ ...map, [agentId]: { sessionId, pid, cwd, launchedAt: Date.now() } }),
    {},
  )
}

export function removeAgentSession(agentId: string): void {
  atomicUpdate<Record<string, unknown>>(
    STATE_FILE,
    (map) => { const next = { ...map }; delete next[agentId]; return next },
    {},
  )
}
