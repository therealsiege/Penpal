/** Stage → suggested next actions (shared by IPC lead detail and MCP graph:lead-detail). */
export const STAGE_SUGGESTIONS: Record<string, string[]> = {
  prospecting: ['Schedule a discovery call.', 'Research practice via vault:search.'],
  qualified: ['Send a demo invite.', 'Check competitor EHR via leads:search.'],
  demo: ['Follow up on demo feedback.', 'Prepare pricing proposal.'],
  negotiation: ['Review contract terms.', 'Check similar deals via leads:search.'],
  'closed-won': ['Log final outcome.', 'Update pipeline via vault:write.'],
  'closed-lost': ['Log loss reason.', 'Update pipeline via vault:write.'],
}

export const DEFAULT_STAGE_SUGGESTIONS = ['Review lead details and determine next step.']

export function suggestedActionsForStage(stage: string): string[] {
  return STAGE_SUGGESTIONS[stage] ?? DEFAULT_STAGE_SUGGESTIONS
}
