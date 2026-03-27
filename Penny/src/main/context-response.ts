/**
 * Context-engineered response wrapper.
 * Every upgraded IPC handler returns this shape so agents and MCP consumers
 * know what the data means and what to do next.
 */
export interface ContextEngineeredResponse<T> {
  data: T
  summary: string
  suggestions: string[]
  related_tools: string[]
  context?: Record<string, unknown>
}

export function contextResponse<T>(
  data: T,
  summary: string,
  suggestions: string[],
  related_tools: string[],
  context?: Record<string, unknown>,
): ContextEngineeredResponse<T> {
  return { data, summary, suggestions, related_tools, ...(context !== undefined && { context }) }
}
