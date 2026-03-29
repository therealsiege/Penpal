import { describe, expect, it } from 'vitest'

/** Keep in sync with `Penny/src/preload/index.ts` unwrap — UI callers must receive `.data` only. */
const unwrap = <T>(result: T): T =>
  (result && typeof result === 'object' && 'data' in result && 'summary' in result)
    ? (result as { data: T }).data
    : result

describe('preload unwrap contract (renderer consumers)', () => {
  it('strips ContextEngineeredResponse to an array for getAgentStatuses-style APIs', () => {
    const envelope = {
      data: [{ config: { id: 'a' }, status: 'idle' as const }],
      summary: '1 agents: 0 busy, 1 idle, and 0 blocked waiting for input.',
      suggestions: [] as string[],
      related_tools: [] as string[],
    }
    const out = unwrap(envelope)
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(1)
  })

  it('passes through legacy raw payloads', () => {
    const raw = { foo: 1 }
    expect(unwrap(raw)).toBe(raw)
  })
})
