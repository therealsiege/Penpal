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
  LeadDetail,
  AgentConfig,
  AgentState,
} from './types'

declare global {
  interface Window {
    pty: {
      create: (cwd: string, command?: string, args?: string[], env?: Record<string, string>) => Promise<string>
      write: (id: string, data: string) => void
      resize: (id: string, cols: number, rows: number) => void
      destroy: (id: string) => Promise<void>
      onData: (callback: (id: string, data: string) => void) => () => void
      onExit: (callback: (id: string, exitCode: number) => void) => () => void
    }
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
      getLeadDetail: (name: string) => Promise<LeadDetail | null>
      getLatestBriefing: () => Promise<{ date: string; content: string } | null>
      listBriefings: () => Promise<string[]>
      getBriefing: (date: string) => Promise<string | null>
      getVaultFolders: () => Promise<{ name: string; fileCount: number; subfolders: string[] }[]>
      listVentures: (relativePath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>
      readVentureFile: (relativePath: string) => Promise<string | null>
      // Shell APIs
      openDownloads: () => Promise<{ success: boolean }>
      pickDirectory: () => Promise<string | null>
      // Approval APIs
      approveSession: (tty: string, choice: string) => Promise<SessionActionResult>
      approveAllSessions: (choice: string) => Promise<BroadcastResult>
      // Agent APIs
      getAgents: () => Promise<AgentConfig[]>
      getAgentStatuses: () => Promise<AgentState[]>
      launchAgent: (agentId: string, cwd: string) => Promise<SessionActionResult>
      focusAgent: (agentId: string) => Promise<SessionActionResult>
      // Triplet Workflows
      createTriplet: (task: string, opts?: Record<string, unknown>) => Promise<import('./types').TripletWorkflow>
      listTriplets: () => Promise<import('./types').TripletWorkflow[]>
      getTripletStatus: (workflowId: string) => Promise<import('./types').TripletWorkflow | null>
      pauseTriplet: (workflowId: string) => Promise<boolean>
      resumeTriplet: (workflowId: string) => Promise<boolean>
      cancelTriplet: (workflowId: string) => Promise<boolean>
      getTripletPresets: () => Promise<import('./types').TripletPreset[]>
      // Vault File Manager
      vaultList: (relativePath: string) => Promise<import('./types').VaultEntry[]>
      vaultRead: (relativePath: string) => Promise<import('./types').VaultFileContent | null>
      vaultSearch: (query: string, glob?: string, limit?: number) => Promise<import('./types').VaultSearchResult[]>
      vaultTags: () => Promise<import('./types').VaultTag[]>
      vaultFilesByTag: (tag: string) => Promise<string[]>
      vaultBacklinks: (relativePath: string) => Promise<import('./types').VaultBacklink[]>
      // Slack Bridge
      slackStatus: () => Promise<{ running: boolean; configured: boolean }>
      slackStart: () => Promise<boolean>
      slackStop: () => Promise<void>
    }
  }
}
