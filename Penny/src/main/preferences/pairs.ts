import fsp from 'fs/promises'
import type { PreferenceStore } from './store'
import type { PreferenceEvent } from './types'

export interface DPOPair {
  prompt: string
  chosen: string
  rejected: string
  source: string
  agentId: string
  timestamp: string
}

export interface PairStats {
  totalPairs: number
  bySource: Record<string, number>
}

type PairSource = 'approve_reject' | 'complete_fail' | 'edit_corrective'

export class PairGenerator {
  constructor(private readonly store: PreferenceStore) {}

  async *generate(since?: Date): AsyncIterable<DPOPair> {
    const events = await this.loadEvents(since)
    const pairs = [
      ...this.generateApproveRejectPairs(events),
      ...this.generateOutcomePairs(events),
      ...this.generateEditPairs(events),
    ].sort(this.comparePair)
    for (const pair of pairs) {
      yield pair
    }
  }

  async export(path: string, format: 'jsonl' | 'parquet'): Promise<number> {
    if (format === 'parquet') {
      throw new Error('Parquet export not yet implemented. Use jsonl format.')
    }

    let count = 0
    const lines: string[] = []
    for await (const pair of this.generate()) {
      lines.push(JSON.stringify(pair))
      count++
    }
    await fsp.writeFile(path, lines.length > 0 ? lines.join('\n') + '\n' : '')
    return count
  }

  async stats(): Promise<PairStats> {
    const result: PairStats = { totalPairs: 0, bySource: {} }
    for await (const pair of this.generate()) {
      result.totalPairs++
      result.bySource[pair.source] = (result.bySource[pair.source] ?? 0) + 1
    }
    return result
  }

  private async loadEvents(since?: Date): Promise<PreferenceEvent[]> {
    const events: PreferenceEvent[] = []
    const sinceMs = since?.getTime()
    for await (const event of this.store.query()) {
      const ts = this.parseTimestamp(event.timestamp)
      if (ts === null) continue
      if (sinceMs !== undefined && ts < sinceMs) continue
      events.push(event)
    }
    return events.sort(this.compareEvent)
  }

  private generateApproveRejectPairs(events: PreferenceEvent[]): DPOPair[] {
    const pendingApproves = new Map<string, PreferenceEvent[]>()
    const pairs: DPOPair[] = []

    for (const event of events) {
      if (event.signal !== 'approve' && event.signal !== 'reject') continue
      const key = this.contextKey(event)
      if (!key) continue

      if (event.signal === 'approve') {
        const queue = pendingApproves.get(key)
        if (queue) queue.push(event)
        else pendingApproves.set(key, [event])
        continue
      }

      const queue = pendingApproves.get(key)
      const approve = queue?.shift()
      if (!approve) continue

      const pair = this.buildPair(approve, event, 'approve_reject', approve.context.toolCall)
      if (pair) pairs.push(pair)
    }

    return pairs.sort(this.comparePair)
  }

  private generateOutcomePairs(events: PreferenceEvent[]): DPOPair[] {
    const pendingCompletes = new Map<string, PreferenceEvent[]>()
    const pairs: DPOPair[] = []

    for (const event of events) {
      if (event.signal !== 'complete' && event.signal !== 'fail') continue
      const taskType = this.taskTypeKey(event)
      if (!taskType) continue
      const key = `${event.agentId}::${taskType}`

      if (event.signal === 'complete') {
        const queue = pendingCompletes.get(key)
        if (queue) queue.push(event)
        else pendingCompletes.set(key, [event])
        continue
      }

      const queue = pendingCompletes.get(key)
      const complete = queue?.shift()
      if (!complete) continue

      const prompt = complete.context.toolCall ?? event.context.toolCall ?? taskType
      const pair = this.buildPair(complete, event, 'complete_fail', prompt)
      if (pair) pairs.push(pair)
    }

    return pairs.sort(this.comparePair)
  }

  private generateEditPairs(events: PreferenceEvent[]): DPOPair[] {
    const pairs: DPOPair[] = []
    for (const event of events) {
      if (event.signal !== 'edit') continue
      const prompt = event.context.toolCall ?? event.agentId
      const chosen = this.cleanText(event.userAction)
      const rejected = this.cleanText(event.context.toolResult)
      const pair = this.makePair({
        prompt,
        chosen,
        rejected,
        source: 'edit_corrective',
        agentId: event.agentId,
        timestamp: event.timestamp,
      })
      if (pair) pairs.push(pair)
    }
    return pairs.sort(this.comparePair)
  }

  private buildPair(
    chosenEvent: PreferenceEvent,
    rejectedEvent: PreferenceEvent,
    source: PairSource,
    promptCandidate?: string,
  ): DPOPair | null {
    const prompt = this.cleanText(promptCandidate ?? chosenEvent.context.toolCall ?? rejectedEvent.context.toolCall)
    const chosen = this.cleanText(chosenEvent.context.toolResult ?? chosenEvent.context.toolCall)
    const rejected = this.cleanText(rejectedEvent.context.toolResult ?? rejectedEvent.context.toolCall)

    return this.makePair({
      prompt,
      chosen,
      rejected,
      source,
      agentId: chosenEvent.agentId,
      timestamp: chosenEvent.timestamp,
    })
  }

  private makePair(input: DPOPair): DPOPair | null {
    const ts = this.parseTimestamp(input.timestamp)
    if (ts === null) return null
    if (!input.prompt || !input.chosen || !input.rejected) return null
    if (input.chosen === input.rejected) return null

    return {
      prompt: input.prompt,
      chosen: input.chosen,
      rejected: input.rejected,
      source: input.source,
      agentId: input.agentId,
      timestamp: new Date(ts).toISOString(),
    }
  }

  private contextKey(event: PreferenceEvent): string | null {
    const toolCall = this.normalizeToken(event.context.toolCall)
    if (!toolCall) return null
    const session = this.normalizeToken(event.sessionId) ?? 'nosession'
    return `${event.agentId}::${session}::${toolCall}`
  }

  private taskTypeKey(event: PreferenceEvent): string | null {
    const toolCall = this.normalizeToken(event.context.toolCall)
    if (!toolCall) return null
    const first = toolCall.split(/\s+/)[0]
    const cleaned = first.split(/[?:]/)[0]
    return cleaned || null
  }

  private parseTimestamp(value: string): number | null {
    const ms = new Date(value).getTime()
    if (!Number.isFinite(ms)) return null
    return ms
  }

  private cleanText(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  private normalizeToken(value: string | undefined): string | null {
    const cleaned = this.cleanText(value).toLowerCase()
    return cleaned.length > 0 ? cleaned : null
  }

  private compareEvent = (a: PreferenceEvent, b: PreferenceEvent): number => {
    const aTs = this.parseTimestamp(a.timestamp) ?? 0
    const bTs = this.parseTimestamp(b.timestamp) ?? 0
    if (aTs !== bTs) return aTs - bTs
    return a.id.localeCompare(b.id)
  }

  private comparePair = (a: DPOPair, b: DPOPair): number => {
    const aTs = this.parseTimestamp(a.timestamp) ?? 0
    const bTs = this.parseTimestamp(b.timestamp) ?? 0
    if (aTs !== bTs) return aTs - bTs
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    if (a.agentId !== b.agentId) return a.agentId.localeCompare(b.agentId)
    if (a.prompt !== b.prompt) return a.prompt.localeCompare(b.prompt)
    if (a.chosen !== b.chosen) return a.chosen.localeCompare(b.chosen)
    return a.rejected.localeCompare(b.rejected)
  }
}
