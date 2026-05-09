/// <reference types="vite/client" />

import type {
  HealthResult,
  JobStatus,
  JobRun,
  ClaudeSession,
  ConversationMessage,
  SessionActionResult,
  BroadcastResult,
  SystemPaths,
  AgentConfig,
  AgentState,
  AgentHealthStatus,
  OpencodeSession,
  PodWorkflow,
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
      getClaudeSessions: () => Promise<ClaudeSession[]>
      getSessionConversation: (sessionId: string, source?: string) => Promise<ConversationMessage[]>
      sendToSession: (tty: string, message: string) => Promise<SessionActionResult>
      focusSession: (tty: string) => Promise<SessionActionResult>
      focusSessionByName: (name: string, cwd?: string) => Promise<SessionActionResult>
      createNewSession: (cwd: string) => Promise<SessionActionResult>
      broadcastToSessions: (message: string) => Promise<BroadcastResult>
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
      podRetry: (podId: string) => Promise<{ ok?: true; error?: string }>
      pipelineSweepMerged: () => Promise<{ swept: number }>
      mergePr: (prNumber: string, repo: string) => Promise<unknown>
      getPrDiff: (owner: string, repo: string, prNumber: string | number) => Promise<{
        title: string
        state: string
        merged: boolean
        htmlUrl: string
        additions: number
        deletions: number
        changedFiles: number
        files: Array<{
          filename: string
          status: string
          additions: number
          deletions: number
          changes: number
          patch: string
        }>
      }>
      retryIssue: (repo: string, issueNumber: number) => Promise<unknown>
      getPodPresets: () => Promise<import('./types').PodPreset[]>
      podProfiles: () => Promise<import('./types').ProfilesData>
      podSaveProfile: (name: string, profile: import('./types').RuntimeProfile) => Promise<{ success: boolean }>
      podDeleteProfile: (name: string) => Promise<{ success: boolean }>
      podSetDefaultProfile: (name: string) => Promise<{ success: boolean }>
      overridePod: (workflowId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) => Promise<unknown>
      // Pod Stage Change (spectator mode)
      onPodStageChanged: (callback: (data: { podId: string; status: string; solverId: string; reviewerId: string; executorId: string; iteration: number }) => void) => () => void
      // Pod Log Streaming — live stdout/stderr from running pods
      subscribePodLogs: (
        podId: string,
        callback: (entry: {
          podId: string
          agentRole: 'solver' | 'reviewer' | 'executor' | 'system'
          stream: 'stdout' | 'stderr' | 'system'
          line: string
          timestamp: number
          seq: number
        }) => void,
      ) => () => void
      unsubscribePodLogs: (podId: string) => Promise<{ ok?: boolean; error?: string }>
      getPodLogs: (podId: string) => Promise<{
        backlog: Array<{
          podId: string
          agentRole: 'solver' | 'reviewer' | 'executor' | 'system'
          stream: 'stdout' | 'stderr' | 'system'
          line: string
          timestamp: number
          seq: number
        }>
        error?: string
      }>
      // Session Health
      getITermStatus: () => Promise<{ healthy: boolean; consecutiveTimeouts: number; backoffUntil: number }>
      // Cursor Agent APIs
      focusCursorIDE: () => Promise<SessionActionResult>
      // Slack Bridge
      slackStatus: () => Promise<{ running: boolean; configured: boolean }>
      slackStart: () => Promise<boolean>
      slackStop: () => Promise<void>
      fleetStatus: () => Promise<import('./types').FleetStatus>
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
      // Webhook server (instant GitHub issue dispatch)
      webhookStatus: () => Promise<{ port: number; running: boolean; url: string; secretConfigured: boolean }>
      // Linear Issue Poller
      linearPollerStatus: () => Promise<{ running: boolean; polling: boolean }>
      linearPollNow: () => Promise<{ enqueued: number }>
      linearIssueCards: () => Promise<import('./types').LinearIssueCard[]>
      linearAddTeam: (teamKey: string, localPath: string, label?: string) => Promise<{ ok: boolean; error?: string }>
      linearRemoveTeam: (teamKey: string) => Promise<{ ok: boolean }>
      linearListTeams: () => Promise<import('./types').LinearTeamConfig[]>
      // Onboarding
      onboardingStatus: () => Promise<{ complete: boolean; hasAnthropicKey: boolean; hasGithubToken: boolean; hasLinearKey: boolean }>
      onboardingSave: (payload: { anthropicKey: string; githubToken: string; linearKey: string; addGithubRepo?: { owner: string; repo: string; localPath: string } }) => Promise<{ ok: boolean; error?: string }>
      onboardingSkip: () => Promise<{ ok: boolean }>
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
      // Pod Combo Analytics
      evalsPodCombos: (opts?: { since?: string; until?: string; presetId?: string; agentId?: string }) => Promise<unknown>
      // Eval Harness (per-agent and all-agent reports)
      evalReportAgent: (agentId: string, since?: string) => Promise<unknown>
      evalReportAll: (since?: string) => Promise<unknown>
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
      listPodsRich: () => Promise<ContextEngineeredResponse<PodWorkflow[]>>
      getPodStatusRich: (workflowId: string) => Promise<ContextEngineeredResponse<PodWorkflow | null>>
      orchestratorQueueRich: () => Promise<ContextEngineeredResponse<Task[]>>
      orchestratorAgentHealthRich: () => Promise<ContextEngineeredResponse<AgentHealthStatus[]>>
      // Flight Board
      flightBoardList: () => Promise<import('./types').FlightBoardEntry[]>
      flightBoardFilesInFlight: () => Promise<Record<string, import('./types').FlightBoardEntry>>
      // Config Snapshot + Editing
      getConfigSnapshot: () => Promise<import('./types').ConfigSnapshot>
      addProjectMcpServer: (server: { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }) => Promise<unknown>
      removeProjectMcpServer: (name: string) => Promise<unknown>
      addProfileMcpServer: (profile: string, server: { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }) => Promise<unknown>
      removeProfileMcpServer: (profile: string, serverName: string) => Promise<unknown>
      updateAgentTools: (agentId: string, tools: string[]) => Promise<unknown>
      governanceGet: () => Promise<{
        rules: Array<{
          id: string
          type: string
          value: number | string | string[]
          action: 'warn' | 'pause' | 'fail'
          message: string
        }>
        maxConcurrentPods: number
        maxPodRetries: number
      }>
      governanceSet: (partial: { maxConcurrentPods?: number; maxPodRetries?: number; rules?: unknown[] }) => Promise<{
        rules: Array<{
          id: string
          type: string
          value: number | string | string[]
          action: 'warn' | 'pause' | 'fail'
          message: string
        }>
        maxConcurrentPods: number
        maxPodRetries: number
      }>
      // MCP Server Management
      listMcpServers: () => Promise<{ success: boolean; data?: import('./types').ManagedMcpServer[]; error?: string }>
      addMcpServer: (server: Omit<import('./types').ManagedMcpServer, 'id'>) => Promise<{ success: boolean; data?: import('./types').ManagedMcpServer; error?: string }>
      updateMcpServer: (id: string, updates: Partial<Omit<import('./types').ManagedMcpServer, 'id'>>) => Promise<{ success: boolean; data?: import('./types').ManagedMcpServer; error?: string }>
      deleteMcpServer: (id: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>
      toggleMcpServer: (id: string, enabled: boolean) => Promise<{ success: boolean; toggled?: boolean; error?: string }>
      importMcpConfigs: () => Promise<{ success: boolean; data?: { imported: number; conflicts: string[]; duplicates: string[] }; error?: string }>
      getMcpTemplates: () => Promise<{ success: boolean; data?: import('./types').ManagedMcpServer[]; error?: string }>
      syncMcpTargets: () => Promise<{ success: boolean; error?: string }>
      // Session Replay
      replayStatus: () => Promise<{ active: boolean; recordingId: string | null; startedAt: number | null; durationMs: number }>
      replayStart: (label?: string) => Promise<{ id: string }>
      replayStop: () => Promise<import('./types').RecordingMeta | null>
      replayList: () => Promise<import('./types').RecordingMeta[]>
      replayGet: (id: string) => Promise<import('./types').Recording>
      replayDelete: (id: string) => Promise<{ ok: boolean }>
      // Autopilot (scheduled recurring tasks)
      autopilotStatus: () => Promise<{ enabled: boolean; scheduledTasks: import('./types').ScheduledTask[]; nextCheck: string | null }>
      autopilotList: () => Promise<{ enabled: boolean; schedules: import('./types').ScheduledTask[] }>
      autopilotAdd: (opts: { title: string; description: string; project: string; cronExpression: string }) => Promise<import('./types').ScheduledTask & { error?: string }>
      autopilotRemove: (taskId: string) => Promise<{ removed: boolean; error?: string }>
      autopilotToggle: (taskId: string, enabled: boolean) => Promise<{ toggled: boolean; error?: string }>
      autopilotStart: () => Promise<{ enabled: boolean; scheduledTasks: import('./types').ScheduledTask[]; nextCheck: string | null }>
      autopilotStop: () => Promise<{ enabled: boolean; scheduledTasks: import('./types').ScheduledTask[]; nextCheck: string | null }>
      reasoningList: () => Promise<PodPattern[]>
      reasoningDelete: (id: string) => Promise<{ ok: boolean }>
      reasoningClear: () => Promise<{ cleared: number }>
    }
  }
}

interface PodPattern {
  id: string
  task: string
  taskType: 'refactor' | 'feature' | 'fix' | 'config' | 'test' | 'docs' | 'unknown'
  filesModified: string[]
  durationMs: number
  iterations: number
  selfFixes: number
  passed: boolean
  solverSummary: string
  reviewerVerdict: string
  timestamp: number
}
