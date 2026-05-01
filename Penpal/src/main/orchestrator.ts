/**
 * Orchestrator — barrel re-export
 *
 * All logic lives in dispatch-queue.ts (pure state) and dispatch-loop.ts
 * (side effects). This file exists so every existing import path still works.
 */

export * from './dispatch-queue'
export * from './dispatch-loop'
