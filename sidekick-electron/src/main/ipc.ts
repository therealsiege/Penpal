import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { checkHealth } from './health'
import { getJobStatuses, getJobHistory, forceRunJob } from './scheduler-bridge'
import { getPipelineSummary, getHotLeads, getTerritories, getNewLeads, getGraphStats, searchLeads, getLeadDetail } from './graph'
import {
  getClaudeSessions,
  getSessionConversation,
  sendToSession,
  focusSession,
  createNewSession,
  broadcastToSessions,
} from './sessions'

const VAULT_ROOT = path.resolve(__dirname, '..', '..')
const BRIEFINGS_DIR = path.join(VAULT_ROOT, 'Ventures', '1Putt', 'Daily Briefings')

function getLatestBriefing(): { date: string; content: string } | null {
  try {
    if (!fs.existsSync(BRIEFINGS_DIR)) return null
    const files = fs.readdirSync(BRIEFINGS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
    if (files.length === 0) return null
    const latest = files[0]
    const content = fs.readFileSync(path.join(BRIEFINGS_DIR, latest), 'utf-8')
    return { date: latest.replace('.md', ''), content }
  } catch {
    return null
  }
}

function listBriefings(): string[] {
  try {
    if (!fs.existsSync(BRIEFINGS_DIR)) return []
    return fs.readdirSync(BRIEFINGS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(f => f.replace('.md', ''))
  } catch {
    return []
  }
}

function getBriefing(date: string): string | null {
  try {
    const filePath = path.join(BRIEFINGS_DIR, `${date}.md`)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

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
  ipcMain.handle('sessions:broadcast', wrapHandler((message: unknown) => {
    if (typeof message !== 'string') throw new Error('message must be a string')
    return broadcastToSessions(message)
  }))
  ipcMain.handle('graph:stats', wrapHandler(() => getGraphStats()))
  ipcMain.handle('leads:search', wrapHandler((query: unknown) => {
    if (typeof query !== 'string') throw new Error('query must be a string')
    return searchLeads(query)
  }))
  ipcMain.handle('leads:detail', wrapHandler((name: unknown) => {
    if (typeof name !== 'string') throw new Error('name must be a string')
    return getLeadDetail(name)
  }))
  ipcMain.handle('briefing:latest', wrapHandler(() => getLatestBriefing()))
  ipcMain.handle('briefing:list', wrapHandler(() => listBriefings()))
  ipcMain.handle('briefing:get', wrapHandler((date: unknown) => {
    if (typeof date !== 'string') throw new Error('date must be a string')
    return getBriefing(date)
  }))
}
