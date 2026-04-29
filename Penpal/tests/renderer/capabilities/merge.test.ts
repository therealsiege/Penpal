import { describe, it, expect } from 'vitest'
import { mergeCapabilityRows } from '../../../src/renderer/src/capabilities/merge'

describe('mergeCapabilityRows', () => {
  it('fills catalog order and maps unknown ids to unknown status', () => {
    const rows = mergeCapabilityRows({ graph: 'ok (1 nodes)' })
    expect(rows.length).toBeGreaterThan(0)
    const graph = rows.find(r => r.id === 'graph')
    expect(graph?.status).toBe('ok (1 nodes)')
    expect(graph?.title).toBe('Knowledge Graph')
    expect(graph?.validationSteps.length).toBeGreaterThan(0)
    const orch = rows.find(r => r.id === 'orchestrator')
    expect(orch?.status).toBe('unknown')
  })
})
