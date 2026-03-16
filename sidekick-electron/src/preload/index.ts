import { contextBridge, ipcRenderer } from 'electron'

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
  getGraphStats: () => ipcRenderer.invoke('graph:stats'),
  searchLeads: (query: string) => ipcRenderer.invoke('leads:search', query),
})
