import { contextBridge, ipcRenderer } from 'electron'

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
  getClaudeSessions: () => ipcRenderer.invoke('sessions:list'),
  getSessionConversation: (sessionId: string, source?: string) => ipcRenderer.invoke('sessions:conversation', sessionId, source),
  sendToSession: (tty: string, message: string) => ipcRenderer.invoke('sessions:send', tty, message),
  focusSession: (tty: string) => ipcRenderer.invoke('sessions:focus', tty),
  focusSessionByName: (name: string, cwd?: string) => ipcRenderer.invoke('sessions:focus-by-name', name, cwd),
  createNewSession: (cwd: string) => ipcRenderer.invoke('sessions:create', cwd),
  broadcastToSessions: (message: string) => ipcRenderer.invoke('sessions:broadcast', message),
  getGraphStats: () => ipcRenderer.invoke('graph:stats'),
  searchLeads: (query: string) => ipcRenderer.invoke('leads:search', query),
  getLeadDetail: (name: string) => ipcRenderer.invoke('leads:detail', name),
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
  openDownloads: () => ipcRenderer.invoke('shell:open-downloads'),
  pickDirectory: () => ipcRenderer.invoke('dialog:open-directory') as Promise<string | null>,
  getSystemPaths: () => ipcRenderer.invoke('system:paths'),
  // Agent APIs
  getAgents: () => ipcRenderer.invoke('agents:list'),
  getAgentStatuses: () => ipcRenderer.invoke('agents:statuses'),
  launchAgent: (agentId: string, cwd: string) => ipcRenderer.invoke('agents:launch', agentId, cwd),
  focusAgent: (agentId: string) => ipcRenderer.invoke('agents:focus', agentId),
  // Triplet Workflow APIs
  createTriplet: (task: string, opts?: Record<string, unknown>) => ipcRenderer.invoke('triplet:create', task, opts),
  listTriplets: () => ipcRenderer.invoke('triplet:list'),
  getTripletStatus: (workflowId: string) => ipcRenderer.invoke('triplet:status', workflowId),
  pauseTriplet: (workflowId: string) => ipcRenderer.invoke('triplet:pause', workflowId),
  resumeTriplet: (workflowId: string) => ipcRenderer.invoke('triplet:resume', workflowId),
  cancelTriplet: (workflowId: string) => ipcRenderer.invoke('triplet:cancel', workflowId),
  getTripletPresets: () => ipcRenderer.invoke('triplet:presets'),
  // Vault File Manager
  vaultList: (relativePath: string) => ipcRenderer.invoke('vault:list', relativePath),
  vaultRead: (relativePath: string) => ipcRenderer.invoke('vault:read', relativePath),
  vaultWrite: (relativePath: string, content: string) => ipcRenderer.invoke('vault:write', relativePath, content),
  vaultSearch: (query: string, glob?: string, limit?: number) => ipcRenderer.invoke('vault:search', query, glob, limit),
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
  orchestratorQueue: () => ipcRenderer.invoke('orchestrator:queue'),
  orchestratorEnqueue: (title: string, description: string, project: string, priority: string) =>
    ipcRenderer.invoke('orchestrator:enqueue', title, description, project, priority),
  orchestratorCancelTask: (taskId: string) => ipcRenderer.invoke('orchestrator:cancel-task', taskId),
  orchestratorRetryTask: (taskId: string) => ipcRenderer.invoke('orchestrator:retry-task', taskId),
  orchestratorAgentHealth: () => ipcRenderer.invoke('orchestrator:agent-health'),
  orchestratorShutdownAgent: (agentId: string) => ipcRenderer.invoke('orchestrator:shutdown-agent', agentId),
  orchestratorStats: () => ipcRenderer.invoke('orchestrator:stats'),
  orchestratorXP: () => ipcRenderer.invoke('orchestrator:xp'),
  // Opencode Sessions
  getOpencodeSessions: () => ipcRenderer.invoke('opencode:sessions'),
})
