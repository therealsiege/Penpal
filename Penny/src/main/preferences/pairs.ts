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

type GroupedEvents = Map<string, PreferenceEvent[]>

export class PairGenerator {
  constructor(private readonly store: PreferenceStore) {}

  async *generate(since?: Date): AsyncIterable<DPOPair> {
    const events: PreferenceEvent[] = []
    const sinceMs = since?.getTime()
    for await (const event of this.store.query()) {
      if (sinceMs !== undefined && new Date(event.timestamp).getTime() < sinceMs) continue
      events.push(event)
    }

    yield* this.generateApproveRejectPairs(events)
    yield* this.generateOutcomePairs(events)
    yield* this.generateEditPairs(events)
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

  // ── Approve/Reject pairs ─────────────────────────────────────────────
  // Match approve + reject events with the same agentId and toolCall context
  private *generateApproveRejectPairs(events: PreferenceEvent[]): Iterable<DPOPair> {
    const grouped = this.groupByKey(events, (e) => {
      if (e.signal !== 'approve' && e.signal !== 'reject') return null
      if (!e.context.toolCall) return null
      return `${e.agentId}::${e.context.toolCall}`
    })

    for (const [, group] of grouped) {
      const approves = group.filter((e) => e.signal === 'approve')
      const rejects = group.filter((e) => e.signal === 'reject')
      if (approves.length === 0 || rejects.length === 0) continue

      // Pair the first approve with the first reject in each context group
      const approve = approves[0]
      const reject = rejects[0]
      yield {
        prompt: approve.context.toolCall!,
        chosen: approve.context.toolResult ?? approve.context.toolCall!,
        rejected: reject.context.toolResult ?? reject.context.toolCall!,
        source: 'approve_reject',
        agentId: approve.agentId,
        timestamp: approve.timestamp,
      }
    }
  }

  // ── Complete/Fail pairs ──────────────────────────────────────────────
  // Match complete + fail events with the same agentId
  private *generateOutcomePairs(events: PreferenceEvent[]): Iterable<DPOPair> {
    const grouped = this.groupByKey(events, (e) => {
      if (e.signal !== 'complete' && e.signal !== 'fail') return null
      return e.agentId
    })

    for (const [, group] of grouped) {
      const completes = group.filter((e) => e.signal === 'complete')
      const fails = group.filter((e) => e.signal === 'fail')
      if (completes.length === 0 || fails.length === 0) continue

      const complete = completes[0]
      const fail = fails[0]
      yield {
        prompt: complete.context.toolCall ?? complete.agentId,
        chosen: complete.context.toolResult ?? complete.context.toolCall ?? 'completed',
        rejected: fail.context.toolResult ?? fail.context.toolCall ?? 'failed',
        source: 'complete_fail',
        agentId: complete.agentId,
        timestamp: complete.timestamp,
      }
    }
  }

  // ── Edit (corrective) pairs ──────────────────────────────────────────
  // Each edit event is a self-contained pair: user correction vs original output
  private *generateEditPairs(events: PreferenceEvent[]): Iterable<DPOPair> {
    for (const event of events) {
      if (event.signal !== 'edit') continue
      if (!event.userAction) continue

      const original = event.context.toolResult ?? event.context.toolCall ?? ''
      if (!original) continue

      yield {
        prompt: event.context.toolCall ?? event.agentId,
        chosen: event.userAction,
        rejected: original,
        source: 'edit_corrective',
        agentId: event.agentId,
        timestamp: event.timestamp,
      }
    }
  }

  private groupByKey(
    events: PreferenceEvent[],
    keyFn: (e: PreferenceEvent) => string | null,
  ): GroupedEvents {
    const map: GroupedEvents = new Map()
    for (const event of events) {
      const key = keyFn(event)
      if (key === null) continue
      const group = map.get(key)
      if (group) {
        group.push(event)
      } else {
        map.set(key, [event])
      }
    }
    return map
  }
}
