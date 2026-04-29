import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_CATALOG,
  listCapabilities,
} from '../../../src/renderer/src/capabilities/catalog'

describe('capabilities catalog', () => {
  it('lists every catalog id in stable order', () => {
    const keys = Object.keys(CAPABILITY_CATALOG)
    expect(keys.length).toBe(7)
    expect(listCapabilities()).toEqual(keys)
  })
})
