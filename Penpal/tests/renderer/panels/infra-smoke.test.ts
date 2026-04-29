// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

describe('renderer panels infra smoke', () => {
  it('has DOM APIs in jsdom', () => {
    const node = document.createElement('section')
    node.dataset.testid = 'renderer-smoke'
    document.body.appendChild(node)
    expect(document.querySelector('[data-testid=\"renderer-smoke\"]')).toBeTruthy()
  })
})
