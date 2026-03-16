/// <reference types="vite/client" />

import type {
  HealthResult,
  JobStatus,
  JobRun,
  StageSummary,
  HotLead,
  TerritoryData,
  NewLead,
  ClaudeSession,
  ConversationMessage,
  SessionActionResult,
  BroadcastResult,
  GraphStats,
  LeadSearchResult,
} from './types'

declare global {
  interface Window {
    api: {
      getHealth: () => Promise<HealthResult>
      getSchedulerStatus: () => Promise<JobStatus[]>
      getSchedulerHistory: (jobName?: string) => Promise<JobRun[]>
      runJob: (name: string) => Promise<JobRun>
      getPipelineSummary: () => Promise<StageSummary[]>
      getHotLeads: () => Promise<HotLead[]>
      getTerritories: () => Promise<TerritoryData[]>
      getNewLeads: () => Promise<NewLead[]>
      getClaudeSessions: () => Promise<ClaudeSession[]>
      getSessionConversation: (sessionId: string) => Promise<ConversationMessage[]>
      sendToSession: (tty: string, message: string) => Promise<SessionActionResult>
      focusSession: (tty: string) => Promise<SessionActionResult>
      createNewSession: (cwd: string) => Promise<SessionActionResult>
      broadcastToSessions: (message: string) => Promise<BroadcastResult>
      getGraphStats: () => Promise<GraphStats>
      searchLeads: (query: string) => Promise<LeadSearchResult[]>
    }
  }
}
