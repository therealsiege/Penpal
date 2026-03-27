import { contextBridge, ipcRenderer } from 'electron'

// Unwrap context-engineered responses for backward compat — renderer gets raw data
const unwrap = <T>(result: T): T =>
  (result && typeof result === 'object' && 'data' in result && 'summary' in result) ? (result as { data: T }).data : result

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
  getPipelineSummary: () => ipcRenderer.invoke('pipeline:summary'),
  getHotLeads: () => ipcRenderer.invoke('pipeline:hot-leads'),
  getTerritories: () => ipcRenderer.invoke('pipeline:territories'),
  getNewLeads: () => ipcRenderer.invoke('pipeline:new-leads'),
  getClaudeSessions: () => ipcRenderer.invoke('sessions:list').then(unwrap),
  getSessionConversation: (sessionId: string, source?: string) => ipcRenderer.invoke('sessions:conversation', sessionId, source),
  sendToSession: (tty: string, message: string) => ipcRenderer.invoke('sessions:send', tty, message),
  focusSession: (tty: string) => ipcRenderer.invoke('sessions:focus', tty),
  focusSessionByName: (name: string, cwd?: string) => ipcRenderer.invoke('sessions:focus-by-name', name, cwd),
  createNewSession: (cwd: string) => ipcRenderer.invoke('sessions:create', cwd),
  broadcastToSessions: (message: string) => ipcRenderer.invoke('sessions:broadcast', message),
  getGraphStats: () => ipcRenderer.invoke('graph:stats'),
  searchLeads: (query: string) => ipcRenderer.invoke('leads:search', query).then(unwrap),
  getLeadDetail: (name: string) => ipcRenderer.invoke('leads:detail', name).then(unwrap),
  getLatestBriefing: () => ipcRenderer.invoke('briefing:latest'),
  listBriefings: () => ipcRenderer.invoke('briefing:list'),
  getBriefing: (date: string) => ipcRenderer.invoke('briefing:get', date),
  getVaultFolders: () => ipcRenderer.invoke('vault:folders'),
  listVentures: (relativePath: string) => ipcRenderer.invoke('ventures:list', relativePath),
  readVentureFile: (relativePath: string) => ipcRenderer.invoke('ventures:read', relativePath),
  // Approval APIs
  approveSession: (tty: string, choice: string) => ipcRenderer.invoke('sessions:approve', tty, choice),
  approveAllSessions: (choice: string) => ipcRenderer.invoke('sessions:approve-all', choice),
  // Shell APIs
  openUrl: (url: string) => ipcRenderer.invoke('shell:open-url', url),
  openDownloads: () => ipcRenderer.invoke('shell:open-downloads'),
  pickDirectory: () => ipcRenderer.invoke('dialog:open-directory') as Promise<string | null>,
  getSystemPaths: () => ipcRenderer.invoke('system:paths'),
  soundboardList: () => ipcRenderer.invoke('soundboard:list'),
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
  getPodPresets: () => ipcRenderer.invoke('pod:presets'),
  // Vault File Manager
  vaultList: (relativePath: string) => ipcRenderer.invoke('vault:list', relativePath),
  vaultRead: (relativePath: string) => ipcRenderer.invoke('vault:read', relativePath).then(unwrap),
  vaultWrite: (relativePath: string, content: string) => ipcRenderer.invoke('vault:write', relativePath, content),
  vaultSearch: (query: string, glob?: string, limit?: number) => ipcRenderer.invoke('vault:search', query, glob, limit).then(unwrap),
  vaultTags: () => ipcRenderer.invoke('vault:tags'),
  vaultFilesByTag: (tag: string) => ipcRenderer.invoke('vault:files-by-tag', tag),
  vaultBacklinks: (relativePath: string) => ipcRenderer.invoke('vault:backlinks', relativePath),
  vaultCreate: (relativePath: string, content?: string) => ipcRenderer.invoke('vault:create', relativePath, content),
  vaultCreateFolder: (relativePath: string) => ipcRenderer.invoke('vault:create-folder', relativePath),
  vaultRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('vault:rename', oldPath, newPath),
  vaultDelete: (relativePath: string) => ipcRenderer.invoke('vault:delete', relativePath),
  vaultIndex: () => ipcRenderer.invoke('vault:index'),
  vaultSearchIndexed: (query: string, limit?: number) => ipcRenderer.invoke('vault:search-indexed', query, limit),
  vaultBuildSearchIndex: () => ipcRenderer.invoke('vault:build-search-index'),
  vaultGraphData: (scope?: string, centerPath?: string) => ipcRenderer.invoke('vault:graph-data', scope, centerPath),
  onVaultFileChanged: (callback: (event: { eventType: string; path: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { eventType: string; path: string }) => callback(data)
    ipcRenderer.on('vault:file-changed', handler)
    return () => ipcRenderer.removeListener('vault:file-changed', handler)
  },
  // Cursor Agent APIs
  focusCursorIDE: () => ipcRenderer.invoke('cursor:focus'),
  // Slack Bridge
  slackStatus: () => ipcRenderer.invoke('slack:status'),
  slackStart: () => ipcRenderer.invoke('slack:start'),
  slackStop: () => ipcRenderer.invoke('slack:stop'),
  // Veritas Control Plane
  veritasStatus: () => ipcRenderer.invoke('veritas:status'),
  veritasStart: () => ipcRenderer.invoke('veritas:start'),
  veritasStop: () => ipcRenderer.invoke('veritas:stop'),
  veritasRestart: () => ipcRenderer.invoke('veritas:restart'),
  veritasLogs: (tail?: number) => ipcRenderer.invoke('veritas:logs', tail),
  veritasOpen: () => ipcRenderer.invoke('veritas:open'),
  veritasListTasks: (status?: string) => ipcRenderer.invoke('veritas:tasks', status),
  veritasTaskCounts: () => ipcRenderer.invoke('veritas:task-counts'),
  veritasCreateTask: (title: string, description?: string, project?: string, priority?: string) =>
    ipcRenderer.invoke('veritas:create-task', title, description, project, priority),
  veritasUpdateTaskStatus: (taskId: string, status: string) =>
    ipcRenderer.invoke('veritas:update-task-status', taskId, status),
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
  // Eval Dashboard
  evalsReportAll: () => ipcRenderer.invoke('evals:report-all').then(unwrap),
  evalsReportAgent: (agentId: string) => ipcRenderer.invoke('evals:report-agent', agentId),
  evalsStats: () => ipcRenderer.invoke('evals:stats').then(unwrap),
  // Preference APIs
  preferencesStats: () => ipcRenderer.invoke('preferences:stats'),
  preferencesCount: () => ipcRenderer.invoke('preferences:count'),
  preferencesQuery: (filter?: { agentId?: string; signal?: string; since?: string }) =>
    ipcRenderer.invoke('preferences:query', filter),
  preferencesGeneratePairs: () => ipcRenderer.invoke('preferences:generate-pairs'),
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
  // Session Health
  getITermStatus: () => ipcRenderer.invoke('sessions:iterm-status'),
  // Opencode Sessions
  getOpencodeSessions: () => ipcRenderer.invoke('opencode:sessions'),
  // Data Scripts
  runDataScript: (script: string, opts?: { rootDir?: string }) =>
    ipcRenderer.invoke('data:run-script', script, opts),
  cancelDataScript: (runId: string) => ipcRenderer.invoke('data:cancel-script', runId),
  onScriptOutput: (callback: (data: { id: string; stream: string; line: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; stream: string; line: string }) => callback(data)
    ipcRenderer.on('data:script-output', handler)
    return () => ipcRenderer.removeListener('data:script-output', handler)
  },
  onScriptDone: (callback: (data: { id: string; exitCode: number; durationMs: number; error?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number; durationMs: number; error?: string }) => callback(data)
    ipcRenderer.on('data:script-done', handler)
    return () => ipcRenderer.removeListener('data:script-done', handler)
  },
  getBriefingSchedule: () => ipcRenderer.invoke('data:get-briefing-schedule') as Promise<{ cron: string; enabled: boolean }>,
  setBriefingSchedule: (cron: string, enabled: boolean) => ipcRenderer.invoke('data:set-briefing-schedule', cron, enabled),
  // Eval Harness
  evalReportAgent: (agentId: string, since?: string) => ipcRenderer.invoke('evals:harness-report-agent', agentId, since),
  evalReportAll: (since?: string) => ipcRenderer.invoke('evals:harness-report-all', since),
  evalsWeeklyDigest: (weekOverride?: string) => ipcRenderer.invoke('evals:weekly-digest', weekOverride),
  // Pod Quality Metrics
  evalsPodQuality: (since?: string) => ipcRenderer.invoke('evals:pod-quality', since),
  // Spot-Check Queue
  evalsSpotCheckQueue: () => ipcRenderer.invoke('evals:spot-check-queue'),
  evalsSpotCheckSample: (count: number) => ipcRenderer.invoke('evals:spot-check-sample', count),
  evalsSpotCheckReview: (id: string, verdict: string, notes?: string) => ipcRenderer.invoke('evals:spot-check-review', id, verdict, notes),
  evalsSpotCheckAgreement: () => ipcRenderer.invoke('evals:spot-check-agreement'),
  // Context Health
  contextHealth: () => ipcRenderer.invoke('evals:context-health'),
  contextHealthAgent: (agentId: string) => ipcRenderer.invoke('evals:context-health-agent', agentId),
  // Context-Engineered Rich APIs (full ContextEngineeredResponse shape)
  getAgentStatusesRich: () => ipcRenderer.invoke('agents:statuses'),
  getClaudeSessionsRich: () => ipcRenderer.invoke('sessions:list'),
  searchLeadsRich: (query: string) => ipcRenderer.invoke('leads:search', query),
  getLeadDetailRich: (name: string) => ipcRenderer.invoke('leads:detail', name),
  listPodsRich: () => ipcRenderer.invoke('pod:list'),
  getPodStatusRich: (workflowId: string) => ipcRenderer.invoke('pod:status', workflowId),
  vaultReadRich: (relativePath: string) => ipcRenderer.invoke('vault:read', relativePath),
  vaultSearchRich: (query: string, glob?: string, limit?: number) => ipcRenderer.invoke('vault:search', query, glob, limit),
  orchestratorQueueRich: () => ipcRenderer.invoke('orchestrator:queue'),
  orchestratorAgentHealthRich: () => ipcRenderer.invoke('orchestrator:agent-health'),
})
