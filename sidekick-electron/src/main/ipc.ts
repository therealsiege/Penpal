import { ipcMain } from 'electron'
import { checkHealth } from './health'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import { getPipelineSummary, getHotLeads, getTerritories, getNewLeads, getGraphStats, searchLeads } from './graph'
import {
  getClaudeSessions,
  getSessionConversation,
  sendToSession,
  focusSession,
  createNewSession,
} from './sessions'

function wrapHandler<T>(fn: (...args: unknown[]) => Promise<T> | T) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (err) {
      return { error: (err as Error).message }
    }
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('health:check', wrapHandler(() => checkHealth()))
  ipcMain.handle('scheduler:status', wrapHandler(() => getJobStatuses()))
  ipcMain.handle('scheduler:history', wrapHandler((jobName?: unknown) =>
    getJobHistory(typeof jobName === 'string' ? jobName : undefined),
  ))
  ipcMain.handle('scheduler:run', wrapHandler((jobName: unknown) => {
    if (typeof jobName !== 'string') throw new Error('jobName must be a string')
    return forceRunJob(jobName)
  }))
  ipcMain.handle('pipeline:summary', wrapHandler(() => getPipelineSummary()))
  ipcMain.handle('pipeline:hot-leads', wrapHandler(() => getHotLeads()))
  ipcMain.handle('pipeline:territories', wrapHandler(() => getTerritories()))
  ipcMain.handle('pipeline:new-leads', wrapHandler(() => getNewLeads()))
  ipcMain.handle('sessions:list', wrapHandler(() => getClaudeSessions()))
  ipcMain.handle('sessions:conversation', wrapHandler((sessionId: unknown) => {
    if (typeof sessionId !== 'string') throw new Error('sessionId must be a string')
    return getSessionConversation(sessionId)
  }))
  ipcMain.handle('sessions:send', wrapHandler((tty: unknown, message: unknown) => {
    if (typeof tty !== 'string' || typeof message !== 'string') throw new Error('tty and message must be strings')
    return sendToSession(tty, message)
  }))
  ipcMain.handle('sessions:focus', wrapHandler((tty: unknown) => {
    if (typeof tty !== 'string') throw new Error('tty must be a string')
    return focusSession(tty)
  }))
  ipcMain.handle('sessions:create', wrapHandler((cwd: unknown) => {
    if (typeof cwd !== 'string') throw new Error('cwd must be a string')
    return createNewSession(cwd)
  }))
  ipcMain.handle('graph:stats', wrapHandler(() => getGraphStats()))
  ipcMain.handle('leads:search', wrapHandler((query: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    return searchLeads(query)
  }))
}
