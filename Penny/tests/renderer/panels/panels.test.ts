// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

describe('renderer panels', () => {
  it('jsdom environment is active', () => {
    expect(typeof document).toBe('object')
    expect(document.createElement('div')).toBeDefined()
  })
})
