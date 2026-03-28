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

/** Matches issue #16 stats shape (`totalPairs`, `bySource`). */
export interface PairStats {
  totalPairs: number
  bySource: Record<string, number>
}

const ORCH_COMPLETE = 'orchestrator:task-completed'
const ORCH_FAILED = 'orchestrator:task-failed'

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

  async export(
    path: string,
    format: 'jsonl' | 'parquet',
    options?: { since?: Date; trlCoreFieldsOnly?: boolean },
  ): Promise<number> {
    if (format === 'parquet') {
      throw new Error('Parquet export not yet implemented. Use jsonl format.')
    }

    let count = 0
    const lines: string[] = []
    const iter = options?.since !== undefined ? this.generate(options.since) : this.generate()
    for await (const pair of iter) {
      const payload = options?.trlCoreFieldsOnly
        ? { prompt: pair.prompt, chosen: pair.chosen, rejected: pair.rejected }
        : pair
      lines.push(JSON.stringify(payload))
      count++
    }
    await fsp.writeFile(path, lines.length > 0 ? lines.join('\n') + '\n' : '')
    return count
  }

  async stats(since?: Date): Promise<PairStats> {
    const result: PairStats = { totalPairs: 0, bySource: {} }
    const iter = since !== undefined ? this.generate(since) : this.generate()
    for await (const pair of iter) {
      result.totalPairs++
      result.bySource[pair.source] = (result.bySource[pair.source] ?? 0) + 1
    }
    return result
  }

  private async loadEvents(since?: Date): Promise<PreferenceEvent[]> {
    const events: PreferenceEvent[] = []
    const filter = since !== undefined ? { since } : undefined
    for await (const event of this.store.query(filter)) {
      if (this.parseTimestamp(event.timestamp) === null) continue
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

      const pair = this.buildApproveRejectPair(approve, event)
      if (pair) pairs.push(pair)
    }

    return pairs.sort(this.comparePair)
  }

  private buildApproveRejectPair(approve: PreferenceEvent, reject: PreferenceEvent): DPOPair | null {
    const prompt = this.cleanText(approve.context.toolCall ?? reject.context.toolCall)
    const chosen =
      this.cleanText(approve.context.toolResult) || this.cleanText(approve.userAction)
    const rejected =
      this.cleanText(reject.context.toolResult) || this.cleanText(reject.userAction)

    return this.makePair({
      prompt,
      chosen,
      rejected,
      source: 'approve_reject',
      agentId: approve.agentId,
      timestamp: approve.timestamp,
    })
  }

  private generateOutcomePairs(events: PreferenceEvent[]): DPOPair[] {
    const pendingCompletes = new Map<string, PreferenceEvent[]>()
    const pairs: DPOPair[] = []

    for (const event of events) {
      if (event.signal !== 'complete' && event.signal !== 'fail') continue
      const key = this.outcomeQueueKey(event)
      if (!key) continue

      if (event.signal === 'complete') {
        const queue = pendingCompletes.get(key)
        if (queue) queue.push(event)
        else pendingCompletes.set(key, [event])
        continue
      }

      const queue = pendingCompletes.get(key)
      const complete = queue?.shift()
      if (!complete) continue

      const pair = this.buildOutcomePair(complete, event)
      if (pair) pairs.push(pair)
    }

    return pairs.sort(this.comparePair)
  }

  private buildOutcomePair(complete: PreferenceEvent, fail: PreferenceEvent): DPOPair | null {
    const taskType = this.taskTypeKey(complete) ?? this.taskTypeKey(fail)
    const prompt =
      this.cleanText(complete.context.toolCall ?? fail.context.toolCall) ||
      this.cleanText(taskType ?? '')

    let chosen =
      this.cleanText(complete.context.toolResult) || this.cleanText(complete.context.toolCall)
    let rejected =
      this.cleanText(fail.context.toolResult) || this.cleanText(fail.context.toolCall)

    if (chosen === rejected) {
      chosen = `completed: ${chosen}`
      rejected = `failed: ${rejected}`
    }

    return this.makePair({
      prompt,
      chosen,
      rejected,
      source: 'complete_fail',
      agentId: complete.agentId,
      timestamp: complete.timestamp,
    })
  }

  private generateEditPairs(events: PreferenceEvent[]): DPOPair[] {
    const pairs: DPOPair[] = []
    for (const event of events) {
      if (event.signal !== 'edit') continue
      const prompt = this.editPrompt(event)
      const chosen = this.cleanText(event.userAction)
      const rejected = this.editRejectedText(event)
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

  /** Prefer stored before-text; else last non-empty recent message (assistant draft). */
  private editRejectedText(event: PreferenceEvent): string {
    const tr = this.cleanText(event.context.toolResult)
    if (tr) return tr
    const msgs = event.context.recentMessages
    if (!msgs?.length) return ''
    for (let i = msgs.length - 1; i >= 0; i--) {
      const t = this.cleanText(msgs[i])
      if (t) return t
    }
    return ''
  }

  private editPrompt(event: PreferenceEvent): string {
    const base = this.cleanText(event.context.toolCall) || event.agentId
    const snippets =
      event.context.recentMessages?.map((m) => this.cleanText(m)).filter((s) => s.length > 0) ?? []
    if (snippets.length === 0) return base
    const ctx = snippets.join('\n---\n')
    const max = 2000
    const truncated = ctx.length > max ? `${ctx.slice(0, max)}…` : ctx
    return `${base}\n\nContext:\n${truncated}`
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

  /**
   * FIFO key for complete→fail pairing. Orchestrator events include task id so unrelated tasks
   * never pair; generic tool calls still pair on shared task-type prefix (see taskTypeKey).
   */
  private outcomeQueueKey(event: PreferenceEvent): string | null {
    const tc = this.normalizeToken(event.context.toolCall)
    if (!tc) return null

    if (tc === ORCH_COMPLETE || tc === ORCH_FAILED) {
      const tid = this.normalizeToken(event.context.toolResult)
      if (!tid) return null
      return `${event.agentId}::orch::${tid}`
    }

    const taskType = this.taskTypeKey(event)
    if (!taskType) return null
    return `${event.agentId}::${taskType}`
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
