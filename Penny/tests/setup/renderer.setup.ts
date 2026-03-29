import { afterEach, vi } from 'vitest'

// jsdom renderer tests: reset DOM between cases. Prefer factory data from tests/helpers/factories.ts
// for AgentState/Task/PodWorkflow/PreferenceEvent in main-oriented tests; renderer duplicate types live
// in src/renderer/src/types.ts — import the layer-appropriate type for the code under test.
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
