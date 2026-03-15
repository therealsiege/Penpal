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
  getGraphStats: () => ipcRenderer.invoke('graph:stats'),
})
