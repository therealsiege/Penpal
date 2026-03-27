export { PreferenceStore } from './store'
export type { PreferenceFilter, PreferenceStats } from './store'
export { PreferenceCollector } from './collector'
export type { PreferenceEvent } from './collector'
export { PairGenerator } from './pairs'
export type { DPOPair, PairStats } from './pairs'

import type { PreferenceCollector } from './collector'
import type { PreferenceStore } from './store'

/** Wire collector events into the store. */
export function connectCollector(collector: PreferenceCollector, store: PreferenceStore): void {
  collector.on('preference', (event) => {
    store.append(event).catch((err) => {
      console.error('[PreferenceStore] append failed:', err)
    })
  })
}
