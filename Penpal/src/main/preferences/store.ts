import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import readline from 'readline'
import type { PreferenceEvent, PreferenceSignal } from './types'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export interface PreferenceFilter {
  agentId?: string
  signal?: PreferenceSignal
  since?: Date
}

export interface PreferenceStats {
  total: number
  bySignal: Record<string, number>
  byAgent: Record<string, number>
}

export class PreferenceStore {
  private readonly filePath: string
  private readonly dataDir: string
  private mutex: Promise<void> = Promise.resolve()
  private rotationThreshold: number

  constructor(dataDir: string, opts?: { rotationThreshold?: number }) {
    this.dataDir = dataDir
    this.filePath = path.join(dataDir, 'preferences.jsonl')
    this.rotationThreshold = opts?.rotationThreshold ?? MAX_FILE_SIZE
    fs.mkdirSync(dataDir, { recursive: true })
  }

  async append(event: PreferenceEvent): Promise<void> {
    await this.serialize(async () => {
      const line = JSON.stringify(event) + '\n'
      const fh = await fsp.open(this.filePath, 'a')
      try {
        await fh.appendFile(line)
        await fh.sync()
      } finally {
        await fh.close()
      }
      await this.rotateIfNeeded()
    })
  }

  async *query(filter?: PreferenceFilter): AsyncIterable<PreferenceEvent> {
    const files = await this.getJsonlFiles()
    const sinceMs = filter?.since ? filter.since.getTime() : undefined

    for (const file of files) {
      const stream = fs.createReadStream(file, { encoding: 'utf-8' })
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

      for await (const line of rl) {
        if (!line.trim()) continue
        let event: PreferenceEvent
        try {
          event = JSON.parse(line)
        } catch {
          continue // skip malformed lines
        }
        if (filter?.agentId && event.agentId !== filter.agentId) continue
        if (filter?.signal && event.signal !== filter.signal) continue
        if (sinceMs !== undefined && new Date(event.timestamp).getTime() < sinceMs) continue
        yield event
      }
    }
  }

  async count(): Promise<number> {
    let total = 0
    for await (const _event of this.query()) total++
    return total
  }

  async stats(): Promise<PreferenceStats> {
    const result: PreferenceStats = { total: 0, bySignal: {}, byAgent: {} }
    for await (const event of this.query()) {
      result.total++
      result.bySignal[event.signal] = (result.bySignal[event.signal] ?? 0) + 1
      result.byAgent[event.agentId] = (result.byAgent[event.agentId] ?? 0) + 1
    }
    return result
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stat = await fsp.stat(this.filePath)
      if (stat.size >= this.rotationThreshold) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedPath = path.join(this.dataDir, `preferences-${ts}.jsonl`)
        await fsp.rename(this.filePath, rotatedPath)
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
      throw err
    }
  }

  private async getJsonlFiles(): Promise<string[]> {
    try {
      const entries = await fsp.readdir(this.dataDir)
      return entries
        .filter((f) => f.startsWith('preferences') && f.endsWith('.jsonl'))
        .sort()
        .map((f) => path.join(this.dataDir, f))
    } catch {
      return []
    }
  }

  private serialize(fn: () => Promise<void>): Promise<void> {
    this.mutex = this.mutex.then(fn, fn)
    return this.mutex
  }
}
