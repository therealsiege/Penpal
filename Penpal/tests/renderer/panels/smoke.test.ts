import { describe, expect, it } from 'vitest'

describe('renderer panels smoke', () => {
  it('runs in jsdom with DOM APIs', () => {
    const node = document.createElement('section')
    node.dataset.testid = 'renderer-smoke'
    document.body.appendChild(node)
    expect(document.querySelector('[data-testid=\"renderer-smoke\"]')).toBeTruthy()
  })
})
