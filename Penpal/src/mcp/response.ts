/**
 * Context-engineered response wrapper for MCP tools.
 * Every tool response includes summary, suggestions, and related_tools
 * so that calling agents know what to do next.
 */

export interface ContextEngineeredResponse<T> {
  data: T
  summary: string
  suggestions: string[]
  related_tools: string[]
  _meta: {
    suggestions: string[]
    related_tools: string[]
  } & Record<string, unknown>
}

export function wrapResponse<T>(
  data: T,
  summary: string,
  suggestions: string[],
  related_tools: string[],
  meta: Record<string, unknown> = {},
): ContextEngineeredResponse<T> {
  return {
    data,
    summary,
    suggestions,
    related_tools,
    _meta: { suggestions, related_tools, ...meta },
  }
}
