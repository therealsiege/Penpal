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


// ── Triplet Workflow Types ──────────────────────────────────────────────────

export type TripletStatus =
  | 'pending'
  | 'solving'
  | 'reviewing'
  | 'executing'
  | 'feedback'
  | 'complete'
  | 'failed'
  | 'paused'

export interface TripletRole {
  agentId: string
  tty?: string
  sessionId?: string
  status: 'waiting' | 'active' | 'complete' | 'failed'
  output?: string
}

export interface TripletWorkflow {
  id: string
  name: string
  status: TripletStatus
  task: string
  cwd: string
  solver: TripletRole
  reviewer: TripletRole
  executor: TripletRole
  iteration: number
  maxIterations: number
  artifacts: { stage: string; path: string; iteration: number; timestamp: number }[]
  createdAt: number
  updatedAt: number
  error?: string
  stageHistory: { stage: TripletStatus; enteredAt: number }[]
}

export interface TripletPreset {
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
