import type { AgentState, ContextHealth } from '../types'

/** True when eval context health indicates actionable context rot (compress / restart). */
export function contextRotDetectedFromHealth(h: ContextHealth): boolean {
  return h.recommendation === 'restart' || h.recommendation === 'compress'
}

/**
 * Overlays `evals:context-health` results onto agent list by matching `sessionId`.
 * Preserves each agent's existing `contextUtilization` / `contextRotDetected` when no row matches.
 */
export function mergeAgentContextFromHealth(
  agents: AgentState[],
  health: ContextHealth[] | undefined,
): AgentState[] {
  if (!health?.length) return agents
  const bySession = new Map<string, ContextHealth>()
  for (const h of health) {
    if (h.sessionId) bySession.set(h.sessionId, h)
  }
  return agents.map(a => {
    if (!a.sessionId) return a
    const h = bySession.get(a.sessionId)
    if (!h) return a
    return {
      ...a,
      contextUtilization: Math.min(1, Math.max(0, h.utilizationPct / 100)),
      contextRotDetected: contextRotDetectedFromHealth(h),
    }
  })
}
