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
  OpencodeSession,
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
      listVentures: (relativePath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>
      readVentureFile: (relativePath: string) => Promise<string | null>
      // Shell APIs
      openUrl: (url: string) => Promise<{ success: boolean }>
      openDownloads: () => Promise<{ success: boolean }>
      pickDirectory: () => Promise<string | null>
      getSystemPaths: () => Promise<SystemPaths>
      soundboardList: () => Promise<import('./types').SoundboardListing>
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
      // Veritas Control Plane
      veritasStatus: () => Promise<import('./types').VeritasServiceStatus>
      veritasStart: () => Promise<import('./types').VeritasServiceStatus>
      veritasStop: () => Promise<import('./types').VeritasServiceStatus>
      veritasRestart: () => Promise<import('./types').VeritasServiceStatus>
      veritasLogs: (tail?: number) => Promise<import('./types').VeritasCommandResult>
      veritasOpen: () => Promise<{ success: boolean; url: string }>
      veritasListTasks: (status?: import('./types').VeritasTaskStatus) => Promise<import('./types').VeritasTaskSummary[]>
      veritasTaskCounts: () => Promise<import('./types').VeritasTaskCounts>
      veritasCreateTask: (
        title: string,
        description?: string,
        project?: string,
        priority?: import('./types').VeritasTaskPriority,
      ) => Promise<import('./types').VeritasTaskSummary>
      veritasUpdateTaskStatus: (
        taskId: string,
        status: import('./types').VeritasTaskStatus,
      ) => Promise<import('./types').VeritasTaskSummary>
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
      // GitHub Issue Poller
      githubPollerStatus: () => Promise<{ running: boolean; repos: string[]; seenCount: number; lastPoll: number | null; pollIntervalMs: number }>
      githubPollNow: () => Promise<{ enqueued: number }>
      githubSeenIssues: () => Promise<{ number: number; repo: string; taskId: string; ingestedAt: number }[]>
      githubIssueCards: () => Promise<import('./types').GitHubIssueCard[]>
      githubAddRepo: (owner: string, repo: string, localPath: string) => Promise<{ ok: boolean }>
      githubRemoveRepo: (owner: string, repo: string) => Promise<{ ok: boolean }>
      githubListRepos: () => Promise<{ owner: string; repo: string; localPath: string }[]>
      // Opencode Sessions
      getOpencodeSessions: () => Promise<OpencodeSession[]>
    }
  }
}
