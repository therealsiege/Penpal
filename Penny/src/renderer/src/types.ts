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

export interface StageSummary {
  stage: string
  total: number
  avgScore: number
  byArm: Record<string, number>
}

export interface HotLead {
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  nextAction: string
}

export interface TerritoryData {
  territory: string
  leads: number
  avgScore: number
}

export interface NewLead {
  name: string
  company: string
  businessArm: string
  score: number
  source: string
}

export interface GraphStats {
  totalNodes: number
  totalRelationships: number
  nodesByLabel: Record<string, number>
  relsByType: Record<string, number>
}

export interface LeadSearchResult {
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  location: string
  nextAction: string
  source: string
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

export interface SoundboardClip {
  id: string
  name: string
  relativePath: string
  absolutePath: string
  url: string
}

export interface SoundboardListing {
  directory: string
  clips: SoundboardClip[]
  source: 'configured' | 'candidate' | 'fallback-scan' | 'default'
}

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

export interface LeadDetail {
  name: string
  company: string
  score: number
  businessArm: string
  stage: string
  ehr: string
  location: string
  nextAction: string
  source: string
  npi: string
  phone: string
  specialty: string
  website: string
  events: { type: string; date: string; detail: string }[]
  documents: { title: string; path: string }[]
  stageHistory: { stage: string; enteredAt: string }[]
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
  artifacts: { stage: string; path: string; iteration: number; timestamp: number }[]
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: PodStatus; enteredAt: number }[]
}

export interface PodPreset {
  id: string
  solver: string
  reviewer: string
  executor: string
  description: string
}

// ── Vault Types ──────────────────────────────────────────────────────────────

export interface VaultEntry {
  name: string
  isDirectory: boolean
  path: string
  size?: number
  mtime?: number
}

export interface VaultFileContent {
  content: string
  mtime: number
}

export interface VaultSearchResult {
  path: string
  line: number
  text: string
}

export interface VaultTag {
  name: string
  count: number
}

export interface VaultBacklink {
  title: string
  path: string
  snippet: string
}

export interface VaultIndexEntry {
  path: string
  name: string
  title: string
  mtime: number
  size: number
  tags: string[]
}

// ── Orchestrator Types ──────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export type TaskStatusType = 'queued' | 'assigned' | 'active' | 'completed' | 'failed' | 'cancelled'
export type TaskSource = 'slack' | 'dashboard' | 'api'
export type TaskStage = 'queued' | 'planning' | 'executing' | 'validating' | 'done'
export type ModelProvider = 'claude' | 'ollama'

export interface StageResult {
  stage: TaskStage
  success: boolean
  output: string
  durationMs: number
  provider: ModelProvider
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
  issueNumber: number
  repo: string
  title: string
  taskId: string
  taskStatus: string
  taskStage: string | null
  priority: string
  assignedAgent: string | null
  ingestedAt: number
  url: string
}

export interface VeritasServiceStatus {
  configured: boolean
  composeFile: string
  envFile?: string
  projectName: string
  serviceName: string
  sourceDir: string
  sourceDirConfigured: boolean
  sourceDirValid: boolean
  dockerAvailable: boolean
  composeAvailable: boolean
  running: boolean
  healthy: boolean
  apiReachable: boolean
  state: string
  health: string
  apiUrl: string
  webUrl: string
  warnings: string[]
  error?: string
}

export interface VeritasCommandResult {
  success: boolean
  output?: string
  error?: string
}

export type VeritasTaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type VeritasTaskPriority = 'low' | 'medium' | 'high'

export interface VeritasTaskSummary {
  id: string
  title: string
  description?: string
  status: VeritasTaskStatus
  priority: VeritasTaskPriority
  type?: string
  project?: string
  sprint?: string
  agent?: string
  created?: string
  updated?: string
  blockedBy?: string[]
}

export interface VeritasTaskCounts {
  backlog: number
  todo: number
  'in-progress': number
  blocked: number
  done: number
  archived: number
}
