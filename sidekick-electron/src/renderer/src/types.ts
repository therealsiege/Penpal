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
