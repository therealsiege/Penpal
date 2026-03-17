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
  getSessionConversation: (sessionId: string) => ipcRenderer.invoke('sessions:conversation', sessionId),
  sendToSession: (tty: string, message: string) => ipcRenderer.invoke('sessions:send', tty, message),
  focusSession: (tty: string) => ipcRenderer.invoke('sessions:focus', tty),
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
  vaultSearch: (query: string, glob?: string, limit?: number) => ipcRenderer.invoke('vault:search', query, glob, limit),
  vaultTags: () => ipcRenderer.invoke('vault:tags'),
  vaultFilesByTag: (tag: string) => ipcRenderer.invoke('vault:files-by-tag', tag),
  vaultBacklinks: (relativePath: string) => ipcRenderer.invoke('vault:backlinks', relativePath),
})
