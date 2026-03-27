export type PreferenceSignal = 'approve' | 'reject' | 'edit' | 'complete' | 'fail'
export type SignalStrength = 'strong' | 'weak'

export interface PreferenceEvent {
  id: string
  timestamp: string
  agentId: string
  sessionId?: string
  signal: PreferenceSignal
  strength: SignalStrength
  context: {
    systemPrompt?: string
    recentMessages?: string[]
    toolCall?: string
    toolResult?: string
  }
  userAction?: string
}
