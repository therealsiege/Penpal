// Phase-level compute allocation for pod workflows.
// Priority determines how much inference budget each phase gets.

export interface PhaseConfig {
  candidates: number          // best-of-N sampling (default: 1, critical: 3)
  selfEvaluation: boolean     // generate reasoning about own output
  confidenceThreshold: number // 0-1, below this → request clarification
  maxSelfFixes: number        // executor self-fix attempts before escalating
}

export const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  critical: { candidates: 3, selfEvaluation: true, confidenceThreshold: 0.8, maxSelfFixes: 2 },
  high:     { candidates: 2, selfEvaluation: true, confidenceThreshold: 0.7, maxSelfFixes: 1 },
  normal:   { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.5, maxSelfFixes: 1 },
  low:      { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.3, maxSelfFixes: 0 },
}

export function getPhaseConfig(priority?: string): PhaseConfig {
  return PHASE_CONFIGS[priority ?? 'normal'] ?? PHASE_CONFIGS.normal
}
