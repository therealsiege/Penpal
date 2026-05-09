export interface HealthCheck {
  name: string
  status: 'ok' | 'fail'
  latency_ms: number
  message?: string
}

export interface HealthResult {
  timestamp: string
  overall: 'healthy' | 'degraded' | 'down'
  checks: HealthCheck[]
}

export interface JobStatus {
  name: string
  description: string
  cron: string
  enabled: boolean
  last_run: string | null
  last_success: boolean | null
  next_run: string
  depends_on: string[]
}

export interface JobRun {
  job: string
  started_at: string
  finished_at: string
  duration_ms: number
  exit_code: number | null
  success: boolean
  stdout_tail: string
  stderr_tail: string
}

export interface ClaudeSession {
  pid: number
  sessionId: string
  project: string
  cwd: string
  startedAt: number
  uptime: string
  cpu: string
  memoryMB: number
  alive: boolean
  lastUserMessage: string
  tty: string
  terminalName: string
  waitingForInput: boolean
  source?: 'claude' | 'cursor'
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface SessionActionResult {
  success: boolean
  error?: string
}

export interface BroadcastResult {
  sent: number
  failed: number
}

export interface SystemPaths {
  homeDir: string
  sidekickRoot: string
  docsRoot: string
}

export interface LinearTeamConfig {
  teamKey: string
  label: string
  localPath: string
  /** Linear team UUID — resolved from teamKey on first add */
  teamId?: string
  /** Optional runtime profile override (e.g. 'economic', 'sonnet', 'max') */
  runtimeProfile?: string
}

export interface LinearIssueCard {
  source: 'linear'
  issueId: string
  issueNumber: number
  identifier: string    // e.g. "META-123"
  repo: string          // teamKey, e.g. "META"
  title: string
  taskId: string
  taskStatus: string
  taskStage: string | null
  priority: string
  assignedAgent: string | null
  podAgents?: { role: 'solver' | 'reviewer' | 'executor'; agentId: string; active: boolean }[]
  ingestedAt: number
  url: string
  podWorkflowId?: string
}

export interface AgentPersona {
  backstory: string
  style: string
  catchphrase: string
}

export interface AgentStats {
  speed: number      // 1–10
  precision: number  // 1–10
  creativity: number // 1–10
  depth: number      // 1–10
  teamwork: number   // 1–10
}

export interface AgentPower {
  name: string
  lore: string
  coding_analog: string
}

export interface AgentBestiary {
  realm: string
  titles: string[]
  lore: string
  weapon: { name: string; lore: string; coding_analog: string }
  powers: AgentPower[]
  weakness: string
  rival: string | null
  ally: string | null
  motivation: string
  fear: string
  stats: AgentStats
  signature_move: { name: string; description: string }
  colors: { primary: string; accent: string }
  desk_items: string[]
  tags: string[]
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
  bestiary?: AgentBestiary
}

export interface OpencodeSession {
  pid: number
  cwd: string
  project: string
  uptime: string
  cpu: string
  memoryMB: number
  alive: boolean
  startedAt: number
  runtime?: 'opencode' | 'openclaw' | 'nemoclaw'
  tty?: string
}

// ── Agent State ──────────────────────────────────────────────────────────────

export type AgentStatus = 'sleeping' | 'idle' | 'active'

export type SessionMode = 'working' | 'plan' | 'accept-edits' | 'waiting' | 'idle' | 'compressing' | 'error' | 'disconnected' | 'crashed'

// Finer-grained classification of WHY the session needs interaction (or doesn't)
export type InteractionType =
  | 'tool-approval'  // Tool use pending approval (bash, read, etc.)
  | 'question'       // AskUserQuestion tool used — agent asked user something
  | 'accept-edits'   // File edits pending accept/reject
  | 'idle-prompt'    // Task finished (end_turn), sitting at idle prompt
  | 'none'           // Working or no interaction pending

export interface SubAgentInvocation {
  description: string
  timestamp: number
  status: 'active' | 'completed'
}

export interface OpenClawInfo {
  supervised: boolean
  runtime?: 'openclaw' | 'nemoclaw'
  sessionId?: string      // OPENCLAW_SESSION_ID
  agentId?: string        // ACP_AGENT_ID
  sandboxed?: boolean     // NemoClaw sandbox active
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
  xp?: AgentXP
  // OpenClaw/NemoClaw supervision
  openclaw?: OpenClawInfo
  // Parse/connection error tracking
  parseErrors?: number
  lastError?: string | null
  // Context window utilization (0.0–1.0) and rot detection
  contextUtilization?: number
  contextRotDetected?: boolean
  // Orchestrator headless task agents (synthesized, not real sessions)
  isOrchestratorTask?: boolean
  taskStage?: 'planning' | 'executing' | 'validating'
  taskTitle?: string
}

export interface AgentXP {
  totalXP: number
  level: number
  rank: string
  tasksCompleted: number
  tasksFailed: number
  currentStreak: number
}

export const XP_RANKS = [
  { level: 1,  title: 'Intern',        minXP: 0 },
  { level: 2,  title: 'Junior',        minXP: 500 },
  { level: 3,  title: 'Associate',     minXP: 1500 },
  { level: 4,  title: 'Agent',        minXP: 3500 },
  { level: 5,  title: 'Senior',       minXP: 7000 },
  { level: 6,  title: 'Lead',          minXP: 12000 },
  { level: 7,  title: 'Expert',        minXP: 20000 },
  { level: 8,  title: 'Master',        minXP: 35000 },
  { level: 9,  title: 'Grandmaster',   minXP: 55000 },
  { level: 10, title: 'Legend',        minXP: 85000 },
] as const

export function getXPForLevel(level: number): number {
  return XP_RANKS.find(r => r.level === level)?.minXP ?? 0
}

export function getRankForXP(xp: number): { level: number; title: string } {
  for (let i = XP_RANKS.length - 1; i >= 0; i--) {
    if (xp >= XP_RANKS[i].minXP) {
      return { level: XP_RANKS[i].level, title: XP_RANKS[i].title }
    }
  }
  return { level: 1, title: 'Intern' }
}

export interface ProjectLeaderboardEntry {
  directory: string
  projectName: string
  agentCount: number
  totalMemoryMB: number
  totalCpu: number
  agents: { name: string; status: AgentStatus; memoryMB: number; cpu: number; uptime: string }[]
}


// ── Pod Workflow Types ──────────────────────────────────────────────────

export type PodStatus =
  | 'pending'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'self-fixing'
  | 'feedback'
  | 'complete'
  | 'failed'
  | 'paused'

export interface PodRole {
  agentId: string
  tty?: string
  sessionId?: string
  status: 'waiting' | 'active' | 'complete' | 'failed'
  output?: string
}

export interface SolverCandidate {
  index: number
  output: string
  agentId: string
  durationMs: number
}

export interface SelfEvalResult {
  selected: number
  confidence: number
  reasoning: string
}

export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'nitpick'
  location: string
  description: string
  suggestion: string
}

export interface ReviewerCritique {
  verdict: 'approve' | 'approve-with-notes' | 'request-changes' | 'reject'
  confidence: number
  issues: ReviewIssue[]
  strengths: string[]
  summary: string
}

/** Resolved pod compute policy (from task priority at creation). Mirrors main process `PhaseConfig`. */
export interface PhaseConfig {
  candidates: number
  selfEvaluation: boolean
  confidenceThreshold: number
  maxSelfFixes: number
}

export interface PodWorkflow {
  id: string
  name: string
  status: PodStatus
  task: string
  cwd: string
  solver: PodRole
  reviewer: PodRole
  executor: PodRole
  iteration: number
  maxIterations: number
  artifacts: { stage: string; path: string; iteration: number; timestamp: number; candidateIndex?: number; selected?: boolean }[]
  solverCandidates?: SolverCandidate[]
  selfEvaluation?: SelfEvalResult
  solverCandidateCount: number
  critique?: ReviewerCritique
  pendingReviewerFeedback?: string
  selfFixAttempts: number
  maxSelfFixes: number
  priority?: string
  phaseConfig?: PhaseConfig
  presetId?: string
  lastExecutorPassed?: boolean
  qualityRecorded?: boolean
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: PodStatus; enteredAt: number }[]
  runtimeProfile?: string
  resolvedProfile?: { phases: Record<string, { model: string }>; timeoutMultiplier: number }
  phaseOverrides?: Partial<Record<'plan' | 'execute' | 'validate', { model?: string; timeoutMultiplier?: number }>>
  issueNumber?: number
  issueRepo?: string
}

// ── Pod Runtime Profiles ────────────────────────────────────────────────────

export interface PhaseModel {
  model: string
}

export interface RuntimeProfile {
  phases: Record<'plan' | 'execute' | 'validate', PhaseModel>
  timeoutMultiplier: number
  ollamaUrl?: string
  description: string
  maxIterations?: number
  maxSelfFixes?: number
}

export interface ProfilesData {
  profiles: Record<string, RuntimeProfile>
  defaultProfile: string
  builtInNames?: string[]
}

export interface PodPreset {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

// ── Orchestrator Types ──────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export type TaskStatusType = 'queued' | 'assigned' | 'active' | 'completed' | 'failed' | 'cancelled'
export type TaskSource = 'slack' | 'dashboard' | 'api'
export type TaskStage = 'queued' | 'planning' | 'executing' | 'validating' | 'done'
export type ModelProvider = 'claude' | 'ollama'

/** Shown on orchestrator stage rows when headless runs use OpenCode or Cursor Agent CLI. */
export type StageResultProvider = ModelProvider | 'opencode' | 'cursor-agent'

export interface StageResult {
  stage: TaskStage
  success: boolean
  output: string
  durationMs: number
  provider: StageResultProvider
  startedAt: number
  completedAt: number
}

export interface Task {
  id: string
  title: string
  description: string
  project: string
  priority: TaskPriority
  status: TaskStatusType
  requiredSkills: string[]
  preferredAgent?: string
  assignedAgent?: string
  assignedSessionId?: string
  source: TaskSource
  slackChannelId?: string
  slackThreadTs?: string
  createdAt: number
  assignedAt?: number
  completedAt?: number
  result?: string
  error?: string
  retryCount: number
  maxRetries: number
  currentStage?: TaskStage
  stageResults?: StageResult[]
  planOutput?: string
  validateOutput?: string
  provider?: ModelProvider
}

export interface AgentHealthStatus {
  agentId: string
  name: string
  alive: boolean
  pid?: number
  memoryMB?: number
  cpu?: string
  uptime?: string
  activeTasks: number
  status: 'healthy' | 'warning' | 'dead'
  warnings: string[]
}

export interface OrchestratorStats {
  queueDepth: number
  activeTasks: number
  completedToday: number
  failedToday: number
  totalProcessed: number
}

export interface GitHubIssueCard {
  source?: 'github' | 'linear'
  issueNumber: number
  repo: string
  title: string
  taskId: string
  taskStatus: string
  taskStage: string | null
  priority: string
  assignedAgent: string | null
  podAgents?: { role: 'solver' | 'reviewer' | 'executor'; agentId: string; active: boolean }[]
  ingestedAt: number
  url: string
}

/** Main-process GitHub issue poller status (githubPollerStatus IPC). */
export interface GithubPollerStatus {
  running: boolean
  /** True while a poll fetch is in flight (interval or Poll Now). */
  polling: boolean
  repos: string[]
  seenCount: number
  lastPoll: number | null
  pollIntervalMs: number
}

// ── Fleet Types ─────────────────────────────────────────────────────────────

export interface FleetInstance {
  instanceId: string
  hostname: string
  user: string
  platform: string
  lastSeen: string
  stale: boolean
  health: 'healthy' | 'degraded' | 'down'
  sessions: { total: number; active: number; idle: number; waiting: number }
  pods: { active: number; total: number }
  repos: string[]
  uptime: number
  isSelf: boolean
  lat?: number
  lon?: number
  city?: string
}

export interface FleetStatus {
  instances: FleetInstance[]
  channelName: string
  lastPollAt: string | null
  debug?: string
}

// ── Context Health Types ──────────────────────────────────────────────────

export interface ContextHealth {
  agentId: string
  sessionId: string
  tokenCount: number
  contextWindowSize: number
  utilizationPct: number
  rotScore: number
  recommendation: 'healthy' | 'warning' | 'compress' | 'restart'
}

// ── Eval Dashboard Types ──────────────────────────────────────────────────

export interface EvalAgentReport {
  agentId: string
  agentName: string
  totalTasks: number
  successCount: number
  successRate: number
  avgDurationMs: number
  streak: number
  recentOutcomes: boolean[]
  trend: 'up' | 'down' | 'flat'
}

export interface EvalStats {
  totalTasks: number
  overallSuccessRate: number
  experimentVelocity: number
  weekStart: string
}

// ── Spot-Check Types ─────────────────────────────────────────────────────────

export interface SpotCheck {
  id: string
  taskId: string
  agentId: string
  taskDescription: string
  agentOutput: string
  automatedScore?: number
  humanVerdict?: SpotCheckVerdict
  humanNotes?: string
  reviewedAt?: string
  sampledAt: string
}

export type SpotCheckVerdict = 'pass' | 'fail' | 'partial'

export interface SpotCheckAgreement {
  total: number
  agreed: number
  rate: number
}

// ── Preference Types ────────────────────────────────────────────────────────

export type PreferenceSignal = 'approve' | 'reject' | 'edit' | 'complete' | 'fail'

export interface PreferenceEvent {
  id: string
  timestamp: string
  agentId: string
  sessionId?: string
  signal: PreferenceSignal
  strength: 'strong' | 'weak'
  context: Record<string, unknown>
  userAction?: string
}

export interface PreferenceStats {
  total: number
  bySignal: Record<string, number>
  byAgent: Record<string, number>
}

// ── Config Snapshot Types ────────────────────────────────────────────────────

export interface McpServerEntry {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  cwd?: string
  source: 'project' | 'profile' | 'global'
}

export interface McpConfigSummary {
  projectServers: McpServerEntry[]
  profileServers: Record<string, McpServerEntry[]>
  totalUniqueServers: number
}

export interface ClaudeSettingsSummary {
  globalSettings: {
    envVars: string[]
    permissions: { allow: string[]; deny: string[] }
    alwaysThinking: boolean
    enabledPlugins: string[]
  }
  projectSettings: {
    exists: boolean
    path: string
  }
  claudeMdFiles: {
    path: string
    sizeBytes: number
    firstLine: string
  }[]
}

export interface AgentToolSummary {
  agentId: string
  agentName: string
  mcpProfile: string
  allowedTools: string[]
  mcpServers: string[]
  skills: string[]
}

export interface ConfigSnapshot {
  mcp: McpConfigSummary
  claude: ClaudeSettingsSummary
  agents: AgentToolSummary[]
  timestamp: number
}

// ── Session Replay ────────────────────────────────────────────────────────────

export type ReplayEventType =
  | 'state-transition'
  | 'task-dispatched'
  | 'task-completed'
  | 'task-failed'
  | 'snapshot'

export interface AgentSnapshot {
  agentId: string
  agentName: string
  status: AgentStatus
  sessionMode?: SessionMode
  cwd?: string
  cpu?: string
  memoryMB?: number
  contextUtilization?: number
  needsInteraction?: boolean
}

export interface ReplayEvent {
  id: string
  timestamp: number
  type: ReplayEventType
  agentId: string
  agentName: string
  data: {
    fromStatus?: AgentStatus
    toStatus?: AgentStatus
    fromMode?: SessionMode
    toMode?: SessionMode
    taskTitle?: string
    taskId?: string
    taskPriority?: string
    message?: string
    sessionId?: string
    cwd?: string
    contextUtilization?: number
    cpu?: string
    memoryMB?: number
    agents?: AgentSnapshot[]
  }
}

export interface RecordingMeta {
  id: string
  label: string
  startedAt: number
  endedAt?: number
  eventCount: number
  durationMs: number
  isActive: boolean
}

// ── MCP Manager Types ─────────────────────────────────────────────────────────

export interface ManagedMcpServer {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  targets: Array<'claude-global' | 'claude-project' | 'cursor' | 'vscode'>
  notes?: string
}

// ── Flight Board Types ────────────────────────────────────────────────────────

export type FlightBoardStatus =
  | 'planning'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'pr-created'
  | 'merged'
  | 'failed'

export interface FlightBoardEntry {
  podId: string
  task: string
  status: FlightBoardStatus
  filesInFlight: string[]
  startedAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  cwd?: string
  planSummary?: string
}

export interface Recording extends RecordingMeta {
  events: ReplayEvent[]
}

// ── Autopilot Types ───────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string
  title: string
  description: string
  project: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}
