import { ipcMain } from 'electron'
import { checkHealth } from './health'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import { getPipelineSummary, getHotLeads, getTerritories, getNewLeads } from './graph'

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
}
