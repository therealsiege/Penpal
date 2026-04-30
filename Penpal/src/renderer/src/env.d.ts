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
  SystemPaths,
  GraphStats,
  LeadSearchResult,
  LeadDetail,
  AgentConfig,
  AgentState,
  AgentHealthStatus,
  OpencodeSession,
  PodWorkflow,
  VaultFileContent,
  VaultSearchResult,
  Task,
  ContextHealth,
  EvalAgentReport,
  EvalStats,
  PreferenceStats,
  PreferenceEvent,
} from './types'

interface ContextEngineeredResponse<T> {
  data: T
  summary: string
  suggestions: string[]
  related_tools: string[]
  context?: Record<string, unknown>
}

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
      getSessionConversation: (sessionId: string, source?: string) => Promise<ConversationMessage[]>
      sendToSession: (tty: string, message: string) => Promise<SessionActionResult>
      focusSession: (tty: string) => Promise<SessionActionResult>
      focusSessionByName: (name: string, cwd?: string) => Promise<SessionActionResult>
      createNewSession: (cwd: string) => Promise<SessionActionResult>
      broadcastToSessions: (message: string) => Promise<BroadcastResult>
      getGraphStats: () => Promise<GraphStats>
      searchLeads: (query: string) => Promise<LeadSearchResult[]>
      getLeadDetail: (name: string) => Promise<LeadDetail | null>
      getLatestBriefing: () => Promise<{ date: string; content: string } | null>
      listBriefings: () => Promise<string[]>
      getBriefing: (date: string) => Promise<string | null>
      getVaultFolders: () => Promise<{ name: string; fileCount: number; subfolders: string[] }[]>
      // Shell APIs
      openUrl: (url: string) => Promise<{ success: boolean }>
      openDownloads: () => Promise<{ success: boolean }>
      pickDirectory: () => Promise<string | null>
      getSystemPaths: () => Promise<SystemPaths>
      // Approval APIs
      approveSession: (tty: string, choice: string) => Promise<SessionActionResult>
      approveAllSessions: (choice: string) => Promise<BroadcastResult>
      // Agent APIs
      getAgents: () => Promise<AgentConfig[]>
      getAgentStatuses: () => Promise<AgentState[]>
      launchAgent: (agentId: string, cwd: string) => Promise<SessionActionResult>
      focusAgent: (agentId: string) => Promise<SessionActionResult>
      // Pod Workflows
      createPod: (task: string, opts?: Record<string, unknown>) => Promise<import('./types').PodWorkflow>
      listPods: () => Promise<import('./types').PodWorkflow[]>
      getPodStatus: (workflowId: string) => Promise<import('./types').PodWorkflow | null>
      pausePod: (workflowId: string) => Promise<boolean>
      resumePod: (workflowId: string) => Promise<boolean>
      cancelPod: (workflowId: string) => Promise<boolean>
      getPodPresets: () => Promise<import('./types').PodPreset[]>
      podProfiles: () => Promise<import('./types').ProfilesData>
      podSaveProfile: (name: string, profile: import('./types').RuntimeProfile) => Promise<{ success: boolean }>
      podDeleteProfile: (name: string) => Promise<{ success: boolean }>
      podSetDefaultProfile: (name: string) => Promise<{ success: boolean }>
      // Vault File Manager
      vaultList: (relativePath: string) => Promise<import('./types').VaultEntry[]>
      vaultRead: (relativePath: string) => Promise<import('./types').VaultFileContent | null>
      vaultWrite: (relativePath: string, content: string) => Promise<{ success: boolean; mtime: number; error?: string }>
      vaultSearch: (query: string, glob?: string, limit?: number) => Promise<import('./types').VaultSearchResult[]>
      vaultTags: () => Promise<import('./types').VaultTag[]>
      vaultFilesByTag: (tag: string) => Promise<string[]>
      vaultBacklinks: (relativePath: string) => Promise<import('./types').VaultBacklink[]>
      vaultCreate: (relativePath: string, content?: string) => Promise<{ success: boolean; mtime: number }>
      vaultCreateFolder: (relativePath: string) => Promise<{ success: boolean }>
      vaultRename: (oldPath: string, newPath: string) => Promise<{ success: boolean; mtime?: number }>
      vaultDelete: (relativePath: string) => Promise<{ success: boolean }>
      vaultIndex: () => Promise<import('./types').VaultIndexEntry[]>
      vaultSearchIndexed: (query: string, limit?: number) => Promise<{ path: string; title: string; snippet: string; score: number }[]>
      vaultBuildSearchIndex: () => Promise<number>
      vaultGraphData: (scope?: string, centerPath?: string) => Promise<{ nodes: { id: string; label: string; type: string; path?: string }[]; links: { source: string; target: string; type: string }[] }>
      onVaultFileChanged: (callback: (event: { eventType: string; path: string }) => void) => () => void
      // Cursor Agent APIs
      focusCursorIDE: () => Promise<SessionActionResult>
      // Slack Bridge
      slackStatus: () => Promise<{ running: boolean; configured: boolean }>
      slackStart: () => Promise<boolean>
      slackStop: () => Promise<void>
      fleetStatus: () => Promise<import('./types').FleetStatus>
      capabilitiesStatus: () => Promise<{
        updatedAt: string
        overall: string
        items: Record<string, string>
        facets: {
          graph_orchestrator: Record<string, string>
          evals_vault: Record<string, string>
        }
      }>
      // Orchestrator
      orchestratorQueue: () => Promise<import('./types').Task[]>
      orchestratorEnqueue: (title: string, description: string, project: string, priority: string) => Promise<import('./types').Task>
      orchestratorCancelTask: (taskId: string) => Promise<boolean>
      orchestratorRetryTask: (taskId: string) => Promise<boolean>
      orchestratorAgentHealth: () => Promise<import('./types').AgentHealthStatus[]>
      orchestratorShutdownAgent: (agentId: string) => Promise<{ success: boolean; error?: string }>
      orchestratorStats: () => Promise<import('./types').OrchestratorStats>
      orchestratorXP: () => Promise<Record<string, import('./types').AgentXP>>
      orchestratorSetProvider: (provider: string) => Promise<{ provider: string }>
      orchestratorGetProvider: () => Promise<{ provider: import('./types').ModelProvider; ollamaAvailable: boolean }>
      projectResolvePath: (raw: string) => Promise<{ resolved: string }>
      // GitHub Issue Poller
      githubPollerStatus: () => Promise<import('./types').GithubPollerStatus>
      githubPollNow: () => Promise<{ enqueued: number }>
      githubSeenIssues: () => Promise<{ number: number; repo: string; taskId: string; ingestedAt: number }[]>
      githubIssueCards: () => Promise<import('./types').GitHubIssueCard[]>
      githubAddRepo: (owner: string, repo: string, localPath: string) => Promise<{ ok: boolean }>
      githubRemoveRepo: (owner: string, repo: string) => Promise<{ ok: boolean }>
      githubListRepos: () => Promise<{ owner: string; repo: string; localPath: string }[]>
      // Opencode Sessions
      getOpencodeSessions: () => Promise<OpencodeSession[]>
      // Data Scripts
      runDataScript: (script: string, opts?: { rootDir?: string }) => Promise<string>
      cancelDataScript: (runId: string) => Promise<boolean>
      onScriptOutput: (callback: (data: { id: string; stream: string; line: string }) => void) => () => void
      onScriptDone: (callback: (data: { id: string; exitCode: number; durationMs: number; error?: string }) => void) => () => void
      getBriefingSchedule: () => Promise<{ cron: string; enabled: boolean }>
      setBriefingSchedule: (cron: string, enabled: boolean) => Promise<void>
      // Eval Dashboard
      evalsReportAll: () => Promise<EvalAgentReport[]>
      evalsReportAgent: (agentId: string) => Promise<EvalAgentReport | null>
      evalsStats: () => Promise<EvalStats>
      evalsWeeklyDigest: (weekOverride?: string) => Promise<{ markdown: string; filePath: string }>
      // Preference APIs
      preferencesStats: () => Promise<PreferenceStats>
      preferencesCount: () => Promise<number>
      preferencesQuery: (filter?: { agentId?: string; signal?: string; since?: string }) => Promise<PreferenceEvent[]>
      preferencesGeneratePairs: () => Promise<{ count: number; path: string }>
      // Spot-Check Queue
      evalsSpotCheckQueue: () => Promise<import('./types').SpotCheck[]>
      evalsSpotCheckSample: (count: number) => Promise<import('./types').SpotCheck[]>
      evalsSpotCheckReview: (id: string, verdict: 'pass' | 'fail' | 'partial', notes?: string) => Promise<void>
      evalsSpotCheckAgreement: () => Promise<import('./types').SpotCheckAgreement>
      evalsGenerateDpoPairs: () => Promise<{ count: number; path: string }>
      // Pod Quality Metrics
      evalsPodQuality: (since?: string) => Promise<{
        period: { from: string; to: string }
        totalPods: number
        completionRate: number
        avgIterations: number
        reviewerFirstPassRate: number
        executorPassRate: number
        selfFixRate: number
        avgCompletionTime_ms: number
        byPreset: Record<string, { total: number; completed: number; avgIterations: number }>
      }>
      // Context Health
      contextHealth: () => Promise<ContextHealth[]>
      contextHealthAgent: (agentId: string) => Promise<ContextHealth>
      // Context-Engineered Rich APIs (full ContextEngineeredResponse shape)
      getAgentStatusesRich: () => Promise<ContextEngineeredResponse<AgentState[]>>
      getClaudeSessionsRich: () => Promise<ContextEngineeredResponse<ClaudeSession[]>>
      searchLeadsRich: (query: string) => Promise<ContextEngineeredResponse<LeadSearchResult[]>>
      getLeadDetailRich: (name: string) => Promise<ContextEngineeredResponse<LeadDetail | null>>
      listPodsRich: () => Promise<ContextEngineeredResponse<PodWorkflow[]>>
      getPodStatusRich: (workflowId: string) => Promise<ContextEngineeredResponse<PodWorkflow | null>>
      vaultReadRich: (relativePath: string) => Promise<ContextEngineeredResponse<VaultFileContent | null>>
      vaultSearchRich: (query: string, glob?: string, limit?: number) => Promise<ContextEngineeredResponse<VaultSearchResult[]>>
      orchestratorQueueRich: () => Promise<ContextEngineeredResponse<Task[]>>
      orchestratorAgentHealthRich: () => Promise<ContextEngineeredResponse<AgentHealthStatus[]>>
      // Session Replay
      replayStatus: () => Promise<{ active: boolean; recordingId: string | null; startedAt: number | null; durationMs: number }>
      replayStart: (label?: string) => Promise<{ id: string }>
      replayStop: () => Promise<import('./types').RecordingMeta | null>
      replayList: () => Promise<import('./types').RecordingMeta[]>
      replayGet: (id: string) => Promise<import('./types').Recording>
      replayDelete: (id: string) => Promise<{ ok: boolean }>
    }
  }
}
