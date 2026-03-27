import { describe, expect, it } from 'vitest'
import { createMockPreferenceEvent } from '../../helpers/factories'

describe('preferences infra smoke', () => {
  it('creates a typed preference event', () => {
    const event = createMockPreferenceEvent({ signal: 'edit', strength: 'weak' })
    expect(event.id).toBeTruthy()
    expect(event.signal).toBe('edit')
    expect(event.strength).toBe('weak')
  })
})
