import { contextBridge, ipcRenderer } from 'electron'

// Unwrap context-engineered responses for backward compat — renderer gets raw data
const unwrap = <T>(result: T): T =>
  (result && typeof result === 'object' && 'data' in result && 'summary' in result) ? (result as { data: T }).data : result

const throwOnIpcError = <T>(result: T): T => {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof (result as { error?: unknown }).error === 'string'
  ) {
    throw new Error((result as { error: string }).error)
  }
  return result
}

contextBridge.exposeInMainWorld('pty', {
  create: (cwd: string, command?: string, args?: string[], env?: Record<string, string>) =>
    ipcRenderer.invoke('pty:create', cwd, command, args, env),
  write: (id: string, data: string) => ipcRenderer.send('pty:write', id, data),
  resize: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', id, cols, rows),
  destroy: (id: string) => ipcRenderer.invoke('pty:destroy', id),
  onData: (callback: (id: string, data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  onExit: (callback: (id: string, exitCode: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number) => callback(id, exitCode)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  },
})

contextBridge.exposeInMainWorld('api', {
  getHealth: () => ipcRenderer.invoke('health:check'),
  getSchedulerStatus: () => ipcRenderer.invoke('scheduler:status'),
  getSchedulerHistory: (jobName?: string) => ipcRenderer.invoke('scheduler:history', jobName),
  runJob: (name: string) => ipcRenderer.invoke('scheduler:run', name),
  getClaudeSessions: () => ipcRenderer.invoke('sessions:list').then(unwrap),
  getSessionConversation: (sessionId: string, source?: string) => ipcRenderer.invoke('sessions:conversation', sessionId, source),
  sendToSession: (tty: string, message: string) => ipcRenderer.invoke('sessions:send', tty, message),
  focusSession: (tty: string) => ipcRenderer.invoke('sessions:focus', tty),
  focusSessionByName: (name: string, cwd?: string) => ipcRenderer.invoke('sessions:focus-by-name', name, cwd),
  createNewSession: (cwd: string) => ipcRenderer.invoke('sessions:create', cwd),
  broadcastToSessions: (message: string) => ipcRenderer.invoke('sessions:broadcast', message),
  // Approval APIs
  approveSession: (tty: string, choice: string) => ipcRenderer.invoke('sessions:approve', tty, choice),
  approveAllSessions: (choice: string) => ipcRenderer.invoke('sessions:approve-all', choice),
  // Shell APIs
  openUrl: (url: string) => ipcRenderer.invoke('shell:open-url', url),
  openDownloads: () => ipcRenderer.invoke('shell:open-downloads'),
  pickDirectory: () => ipcRenderer.invoke('dialog:open-directory') as Promise<string | null>,
  getSystemPaths: () => ipcRenderer.invoke('system:paths'),
  // Agent APIs
  getAgents: () => ipcRenderer.invoke('agents:list'),
  getAgentStatuses: () => ipcRenderer.invoke('agents:statuses').then(unwrap),
  launchAgent: (agentId: string, cwd: string) => ipcRenderer.invoke('agents:launch', agentId, cwd),
  focusAgent: (agentId: string) => ipcRenderer.invoke('agents:focus', agentId),
  // Pod Workflow APIs
  createPod: (task: string, opts?: Record<string, unknown>) => ipcRenderer.invoke('pod:create', task, opts),
  listPods: () => ipcRenderer.invoke('pod:list').then(unwrap),
  getPodStatus: (workflowId: string) => ipcRenderer.invoke('pod:status', workflowId).then(unwrap),
  pausePod: (workflowId: string) => ipcRenderer.invoke('pod:pause', workflowId),
  resumePod: (workflowId: string) => ipcRenderer.invoke('pod:resume', workflowId),
  cancelPod: (workflowId: string) => ipcRenderer.invoke('pod:cancel', workflowId),
  mergePr: (prNumber: string, repo: string) => ipcRenderer.invoke('pod:merge-pr', prNumber, repo),
  getPrDiff: (owner: string, repo: string, prNumber: string | number) =>
    ipcRenderer.invoke('pod:get-pr-diff', { owner, repo, prNumber }).then(throwOnIpcError),
  retryIssue: (repo: string, issueNumber: number) => ipcRenderer.invoke('pod:retry-issue', repo, issueNumber),
  getPodPresets: () => ipcRenderer.invoke('pod:presets'),
  overridePod: (workflowId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) =>
    ipcRenderer.invoke('pod:override', workflowId, phase, override),
  podProfiles: () => ipcRenderer.invoke('pod:profiles').then(unwrap),
  podSaveProfile: (name: string, profile: unknown) => ipcRenderer.invoke('pod:save-profile', name, profile),
  podDeleteProfile: (name: string) => ipcRenderer.invoke('pod:delete-profile', name),
  podSetDefaultProfile: (name: string) => ipcRenderer.invoke('pod:set-default-profile', name),
  // Cursor Agent APIs
  focusCursorIDE: () => ipcRenderer.invoke('cursor:focus'),
  // Slack Bridge
  slackStatus: () => ipcRenderer.invoke('slack:status'),
  slackStart: () => ipcRenderer.invoke('slack:start'),
  slackStop: () => ipcRenderer.invoke('slack:stop'),
  fleetStatus: () => ipcRenderer.invoke('fleet:status').then(unwrap),
  // Orchestrator
  orchestratorQueue: () => ipcRenderer.invoke('orchestrator:queue').then(unwrap),
  orchestratorEnqueue: (title: string, description: string, project: string, priority: string) =>
    ipcRenderer.invoke('orchestrator:enqueue', title, description, project, priority),
  orchestratorCancelTask: (taskId: string) => ipcRenderer.invoke('orchestrator:cancel-task', taskId),
  orchestratorRetryTask: (taskId: string) => ipcRenderer.invoke('orchestrator:retry-task', taskId),
  orchestratorAgentHealth: () => ipcRenderer.invoke('orchestrator:agent-health').then(unwrap),
  orchestratorShutdownAgent: (agentId: string) => ipcRenderer.invoke('orchestrator:shutdown-agent', agentId),
  orchestratorStats: () => ipcRenderer.invoke('orchestrator:stats'),
  orchestratorXP: () => ipcRenderer.invoke('orchestrator:xp'),
  orchestratorSetProvider: (provider: string) => ipcRenderer.invoke('orchestrator:set-provider', provider),
  orchestratorGetProvider: () => ipcRenderer.invoke('orchestrator:get-provider'),
  /** Resolve `atlas`, `sidekick`, ~/… to absolute cwd (same rules as orchestrator / pods). */
  projectResolvePath: (raw: string) => ipcRenderer.invoke('project:resolve-path', raw),
  // GitHub Issue Poller
  githubPollerStatus: () => ipcRenderer.invoke('github:status'),
  githubPollNow: () => ipcRenderer.invoke('github:poll-now'),
  githubSeenIssues: () => ipcRenderer.invoke('github:seen'),
  githubIssueCards: () => ipcRenderer.invoke('github:cards'),
  githubAddRepo: (owner: string, repo: string, localPath: string) =>
    ipcRenderer.invoke('github:add-repo', owner, repo, localPath),
  githubRemoveRepo: (owner: string, repo: string) =>
    ipcRenderer.invoke('github:remove-repo', owner, repo),
  githubListRepos: () => ipcRenderer.invoke('github:list-repos'),
  // Linear Issue Poller
  linearPollerStatus: () => ipcRenderer.invoke('linear:status'),
  linearPollNow: () => ipcRenderer.invoke('linear:poll-now'),
  linearIssueCards: () => ipcRenderer.invoke('linear:cards'),
  linearAddTeam: (teamKey: string, localPath: string, label?: string) =>
    ipcRenderer.invoke('linear:add-team', teamKey, localPath, label),
  linearRemoveTeam: (teamKey: string) => ipcRenderer.invoke('linear:remove-team', teamKey),
  linearListTeams: () => ipcRenderer.invoke('linear:list-teams'),
  // Onboarding
  onboardingStatus: () => ipcRenderer.invoke('onboarding:status'),
  onboardingSave: (payload: { anthropicKey: string; githubToken: string; linearKey: string; addGithubRepo?: { owner: string; repo: string; localPath: string } }) =>
    ipcRenderer.invoke('onboarding:save', payload),
  onboardingSkip: () => ipcRenderer.invoke('onboarding:skip'),
  // Eval Dashboard (report-* are plain payloads; stats uses contextResponse — unwrap)
  evalsReportAll: () => ipcRenderer.invoke('evals:report-all'),
  evalsReportAgent: (agentId: string) => ipcRenderer.invoke('evals:report-agent', agentId),
  evalsStats: () => ipcRenderer.invoke('evals:stats').then(unwrap),
  // Preference APIs
  preferencesStats: () => ipcRenderer.invoke('preferences:stats'),
  preferencesCount: () => ipcRenderer.invoke('preferences:count'),
  preferencesQuery: (filter?: { agentId?: string; signal?: string; since?: string }) =>
    ipcRenderer.invoke('preferences:query', filter),
  preferencesGeneratePairs: () => ipcRenderer.invoke('preferences:generate-pairs').then(throwOnIpcError),
  // Config Snapshot + Editing
  getConfigSnapshot: () => ipcRenderer.invoke('config:snapshot'),
  addProjectMcpServer: (server: { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }) =>
    ipcRenderer.invoke('config:add-project-mcp', server),
  removeProjectMcpServer: (name: string) => ipcRenderer.invoke('config:remove-project-mcp', name),
  addProfileMcpServer: (profile: string, server: { name: string; command: string; args: string[]; env?: Record<string, string>; cwd?: string }) =>
    ipcRenderer.invoke('config:add-profile-mcp', profile, server),
  removeProfileMcpServer: (profile: string, serverName: string) =>
    ipcRenderer.invoke('config:remove-profile-mcp', profile, serverName),
  updateAgentTools: (agentId: string, tools: string[]) =>
    ipcRenderer.invoke('config:update-agent-tools', agentId, tools),
  // MCP APIs
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  addMcpServer: (server: any) => ipcRenderer.invoke('mcp:add', server),
  updateMcpServer: (id: string, updates: any) => ipcRenderer.invoke('mcp:update', id, updates),
  deleteMcpServer: (id: string) => ipcRenderer.invoke('mcp:delete', id),
  toggleMcpServer: (id: string, enabled: boolean) => ipcRenderer.invoke('mcp:toggle', id, enabled),
  importMcpConfigs: () => ipcRenderer.invoke('mcp:import'),
  getMcpTemplates: () => ipcRenderer.invoke('mcp:templates'),
  syncMcpTargets: () => ipcRenderer.invoke('mcp:sync'),
  // Session Health
  getITermStatus: () => ipcRenderer.invoke('sessions:iterm-status'),
  // Opencode Sessions
  getOpencodeSessions: () => ipcRenderer.invoke('opencode:sessions'),
  // Eval Harness
  evalReportAgent: (agentId: string, since?: string) => ipcRenderer.invoke('evals:harness-report-agent', agentId, since),
  evalReportAll: (since?: string) => ipcRenderer.invoke('evals:harness-report-all', since),
  evalsWeeklyDigest: (weekOverride?: string) => ipcRenderer.invoke('evals:weekly-digest', weekOverride),
  // Pod Quality Metrics
  evalsPodQuality: (since?: string) => ipcRenderer.invoke('evals:pod-quality', since),
  // Pod Combo Analytics
  evalsPodCombos: (opts?: { since?: string; until?: string; presetId?: string; agentId?: string }) =>
    ipcRenderer.invoke('evals:pod-combos', opts),
  // Spot-Check Queue
  evalsSpotCheckQueue: () => ipcRenderer.invoke('evals:spot-check-queue'),
  evalsSpotCheckSample: (count: number) => ipcRenderer.invoke('evals:spot-check-sample', count),
  evalsSpotCheckReview: (id: string, verdict: string, notes?: string) => ipcRenderer.invoke('evals:spot-check-review', id, verdict, notes),
  evalsSpotCheckAgreement: () => ipcRenderer.invoke('evals:spot-check-agreement'),
  // DPO Pair Generation
  evalsGenerateDpoPairs: () => ipcRenderer.invoke('evals:generate-dpo-pairs').then(throwOnIpcError),
  // Pod Stage Change (spectator mode)
  onPodStageChanged: (callback: (event: { podId: string; status: string; solverId: string; reviewerId: string; executorId: string; iteration: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { podId: string; status: string; solverId: string; reviewerId: string; executorId: string; iteration: number }) => callback(data)
    ipcRenderer.on('pod:stage-changed', handler)
    return () => ipcRenderer.removeListener('pod:stage-changed', handler)
  },
  // Pod Log Streaming — subscribe to live stdout/stderr from a running pod.
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
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: {
      podId: string
      agentRole: 'solver' | 'reviewer' | 'executor' | 'system'
      stream: 'stdout' | 'stderr' | 'system'
      line: string
      timestamp: number
      seq: number
    }) => {
      if (data && data.podId === podId) callback(data)
    }
    ipcRenderer.on('pod:log', handler)
    // Fire and forget; backlog is delivered via the same callback after the
    // main process responds with the buffered entries.
    void ipcRenderer.invoke('pod:subscribe-logs', podId).then((res: unknown) => {
      const r = res as { backlog?: unknown[]; error?: string } | undefined
      if (r && Array.isArray(r.backlog)) {
        for (const entry of r.backlog) callback(entry as Parameters<typeof callback>[0])
      }
    }).catch(() => {})
    return () => {
      ipcRenderer.removeListener('pod:log', handler)
      void ipcRenderer.invoke('pod:unsubscribe-logs', podId).catch(() => {})
    }
  },
  unsubscribePodLogs: (podId: string) => ipcRenderer.invoke('pod:unsubscribe-logs', podId),
  getPodLogs: (podId: string) => ipcRenderer.invoke('pod:get-logs', podId),
  // Context Health
  contextHealth: () => ipcRenderer.invoke('evals:context-health'),
  contextHealthAgent: (agentId: string) => ipcRenderer.invoke('evals:context-health-agent', agentId),
  // Context-Engineered Rich APIs (full ContextEngineeredResponse shape)
  getAgentStatusesRich: () => ipcRenderer.invoke('agents:statuses'),
  getClaudeSessionsRich: () => ipcRenderer.invoke('sessions:list'),
  listPodsRich: () => ipcRenderer.invoke('pod:list'),
  getPodStatusRich: (workflowId: string) => ipcRenderer.invoke('pod:status', workflowId),
  orchestratorQueueRich: () => ipcRenderer.invoke('orchestrator:queue'),
  orchestratorAgentHealthRich: () => ipcRenderer.invoke('orchestrator:agent-health'),
  // Flight Board
  flightBoardList: () => ipcRenderer.invoke('flight-board:list'),
  flightBoardFilesInFlight: () => ipcRenderer.invoke('flight-board:files-in-flight'),
  // Autopilot (scheduled recurring tasks)
  autopilotStatus: () => ipcRenderer.invoke('autopilot:status'),
  autopilotList: () => ipcRenderer.invoke('autopilot:list'),
  autopilotAdd: (opts: { title: string; description: string; project: string; cronExpression: string }) =>
    ipcRenderer.invoke('autopilot:add', opts),
  autopilotRemove: (taskId: string) => ipcRenderer.invoke('autopilot:remove', taskId),
  autopilotToggle: (taskId: string, enabled: boolean) => ipcRenderer.invoke('autopilot:toggle', taskId, enabled),
  autopilotStart: () => ipcRenderer.invoke('autopilot:start'),
  autopilotStop: () => ipcRenderer.invoke('autopilot:stop'),
  // Session Replay
  replayStatus: () => ipcRenderer.invoke('replay:status'),
  replayStart: (label?: string) => ipcRenderer.invoke('replay:start', label),
  replayStop: () => ipcRenderer.invoke('replay:stop'),
  replayList: () => ipcRenderer.invoke('replay:list'),
  replayGet: (id: string) => ipcRenderer.invoke('replay:get', id),
  replayDelete: (id: string) => ipcRenderer.invoke('replay:delete', id),
})
