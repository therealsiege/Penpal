import { afterEach, vi } from 'vitest'

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// jsdom renderer tests: reset DOM between cases. Prefer factory data from tests/helpers/factories.ts
// for AgentState/Task/PodWorkflow/PreferenceEvent in main-oriented tests; renderer duplicate types live
// in src/renderer/src/types.ts — import the layer-appropriate type for the code under test.
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
