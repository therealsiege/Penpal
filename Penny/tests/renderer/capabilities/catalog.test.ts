import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_CATALOG,
  listCapabilities,
} from '../../../src/renderer/src/capabilities/catalog'

describe('capabilities catalog', () => {
  it('has exactly one catalog entry', () => {
    expect(Object.keys(CAPABILITY_CATALOG).length).toBe(1)
    expect(listCapabilities().length).toBe(1)
    expect(listCapabilities()[0]).toBe('orchestrator')
  })
})
