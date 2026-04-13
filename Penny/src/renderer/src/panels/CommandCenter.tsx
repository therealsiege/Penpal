import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppearanceStore } from '../stores/appearance-store'
import { usePolling } from '../hooks/usePolling'
import { AgentAvatar } from '../components/AgentAvatar'
import { useToast } from '../components/Toast'
import { Terminal } from '../components/Terminal'
import type { AgentConfig, AgentState, ContextHealth, HealthResult, HotLead, JobStatus, PodWorkflow, PodPreset, ProjectLeaderboardEntry, OpencodeSession, AgentXP, OpenClawInfo, ConfigSnapshot, McpServerEntry, AgentToolSummary, getRankForXP, Task, FleetStatus } from '../types'
import { mergeAgentContextFromHealth } from '../utils/contextHealthMerge'
import { PodLauncherModal, PodStatusModal, PodListModal } from '../components/PodModal'
import { ClaudeUsageIndicator } from '../components/ClaudeUsageIndicator'
import { createOfficeGame } from '../game/OfficeGame'
import { OfficeScene } from '../game/OfficeScene'
import { EventBus, EVENTS } from '../game/events'
import { mergeCapabilityRows } from '../capabilities/merge'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommandCenterProps {
  onOpenHealth: () => void
  onOpenScheduler: () => void
  onOpenVentures: () => void
  onOpenBriefing: () => void
  onOpenPipeline: () => void
  onOpenActivity: () => void
  onOpenTasks: () => void
}

// ---------------------------------------------------------------------------
// AgentActionPopup
// ---------------------------------------------------------------------------

function AgentActionPopup({
  state,
  onSendMessage,
  onApprove,
  onFocusiTerm,
  onClose,
}: {
  state: AgentState
  onSendMessage: (msg: string) => void
  onApprove: (choice: string) => void
  onFocusiTerm: () => void
  onClose: () => void
}) {
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const needsApproval = state.sessionMode === 'waiting' || state.sessionMode === 'accept-edits'
  const isCursorAgent = state.config.model === 'cursor-agent'

  useEffect(() => {
    if (!isCursorAgent) inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!state.tty || isCursorAgent) return
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return
      const key = e.key.toLowerCase()
      if (['1', '2', '3', '4', '5'].includes(key)) {
        e.preventDefault()
        if (needsApproval) onApprove(key)
        else onSendMessage(key)
      } else if (key === 'y') {
        e.preventDefault()
        onSendMessage('y')
      } else if (key === 'n') {
        e.preventDefault()
        onSendMessage('n')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.tty, needsApproval, onApprove, onSendMessage, isCursorAgent])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-4 w-[400px] shadow-2xl ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-bold text-[var(--c-text-heading)]">{state.config.name}</h3>
            {state.config.title && state.config.title !== state.config.name && (
              <p className="text-[11px] text-[var(--c-text-muted)] mt-0.5">{state.config.title}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {state.cwd && (
                <span className="text-[13px] text-[color-mix(in_srgb,var(--c-accent-blue)_80%,transparent)] font-mono">
                  {state.cwd.split('/').pop()}
                </span>
              )}
              {state.sessionMode && state.sessionMode !== 'idle' && (
                <span className="text-[13px] px-1.5 py-0.5 rounded bg-[var(--c-bg-elevated)] text-[var(--c-text-secondary)]">
                  {state.sessionMode}
                </span>
              )}
              {state.config.podRole && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  state.config.podRole === 'solver' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                  state.config.podRole === 'reviewer' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                  'text-orange-400 bg-orange-500/10 border-orange-500/20'
                }`}>
                  {state.config.podRole === 'solver' ? '\u{1F527}' : state.config.podRole === 'reviewer' ? '\u{1F50D}' : '\u{25B6}'} {state.config.podRole}
                </span>
              )}
              {state.openclaw?.supervised && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  state.openclaw.runtime === 'nemoclaw'
                    ? 'text-green-400 bg-green-500/10 border-green-500/20'
                    : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                }`}>
                  {state.openclaw.runtime === 'nemoclaw' ? 'NemoClaw' : 'OpenClaw'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg"
          >
            x
          </button>
        </div>

        {/* Persona info — Fix 10: includes backstory */}
        {state.config.persona && (
          <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] rounded-lg px-3 py-2 mb-3 border border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]">
            <p className="text-[11px] text-[var(--c-text-secondary)] italic leading-relaxed">
              &ldquo;{state.config.persona.catchphrase}&rdquo;
            </p>
            <p className="text-[10px] text-[var(--c-text-faint)] mt-1">{state.config.persona.style}</p>
            {state.config.persona.backstory && (
              <p className="text-[10px] text-[var(--c-text-muted)] mt-1.5 leading-relaxed">
                {state.config.persona.backstory.length > 120
                  ? state.config.persona.backstory.slice(0, 117) + '...'
                  : state.config.persona.backstory}
              </p>
            )}
          </div>
        )}

        {state.isSubAgent && state.parentAgentId && (
          <div className="bg-indigo-900/20 rounded-lg px-3 py-1.5 mb-2 border border-indigo-700/30">
            <p className="text-[13px] text-indigo-400">
              Sub-agent of: <span className="font-semibold">{state.parentAgentId}</span>
            </p>
          </div>
        )}

        {/* OpenClaw / NemoClaw supervision details */}
        {state.openclaw?.supervised && (
          <div className={`rounded-lg px-3 py-2 mb-3 border ${
            state.openclaw.runtime === 'nemoclaw'
              ? 'bg-green-900/20 border-green-700/30'
              : 'bg-cyan-900/20 border-cyan-700/30'
          }`}>
            <p className={`text-[10px] uppercase tracking-wider mb-1 ${
              state.openclaw.runtime === 'nemoclaw' ? 'text-green-500/70' : 'text-cyan-500/70'
            }`}>
              {state.openclaw.runtime === 'nemoclaw' ? 'NemoClaw Sandbox' : 'ACP Supervision'}
            </p>
            <div className="flex flex-col gap-0.5">
              <p className={`text-[11px] ${
                state.openclaw.runtime === 'nemoclaw' ? 'text-green-400' : 'text-cyan-400'
              }`}>
                {state.openclaw.runtime === 'nemoclaw'
                  ? 'Running in secure sandbox environment'
                  : 'Supervised by OpenClaw via ACP protocol'}
              </p>
              {state.openclaw.sandboxed && (
                <p className="text-[10px] text-green-400/60">Sandbox isolation active</p>
              )}
              {state.openclaw.agentId && (
                <p className="text-[10px] text-[var(--c-text-muted)] font-mono">
                  Agent: {state.openclaw.agentId}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Parse error warning */}
        {(state.parseErrors ?? 0) > 0 && (
          <div className="bg-red-900/20 rounded-lg px-3 py-1.5 mb-2 border border-red-700/30">
            <p className="text-[11px] text-red-400">
              {state.parseErrors} parse error{state.parseErrors !== 1 ? 's' : ''} in session log
            </p>
            {state.lastError && (
              <p className="text-[10px] text-red-400/60 font-mono mt-0.5 truncate">{state.lastError}</p>
            )}
          </div>
        )}

        {/* MCP Tools & Builtins */}
        {state.config.allowedTools.length > 0 && (() => {
          const { mcpServers, builtins } = extractAgentTools(state.config.allowedTools)
          return (mcpServers.length > 0 || builtins.length > 0) ? (
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] rounded-lg px-3 py-2 mb-3 border border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]">
              <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider mb-1.5">Toolbelt</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {mcpServers.map(s => (
                  <span
                    key={s.label}
                    className={`text-[11px] px-2 py-0.5 rounded border font-medium ${s.color}`}
                  >
                    {s.label}
                  </span>
                ))}
                {builtins.map(b => (
                  <span
                    key={b.label}
                    className={`text-[11px] px-2 py-0.5 rounded border font-medium ${b.color}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null
        })()}

        {state.lastAssistantBlurb && (
          <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 mb-3 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
            <p className="text-[13px] text-[var(--c-text-muted)] uppercase mb-0.5">Currently</p>
            <p className="text-[13px] text-[var(--c-text-primary)]">{state.lastAssistantBlurb}</p>
          </div>
        )}

        {isCursorAgent ? (
          <>
            <div className="bg-purple-900/20 rounded-lg px-3 py-2 mb-3 border border-purple-700/30">
              <p className="text-[11px] text-purple-400">
                This is a Cursor Agent session. Interact with it directly in the Cursor IDE.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onFocusiTerm}
                className="flex-1 px-3 py-1.5 text-[13px] bg-purple-600 hover:bg-purple-500 rounded-md text-white transition-colors"
              >
                Open in Cursor
              </button>
            </div>
          </>
        ) : (
          <>
            {needsApproval && state.tty && (
              <div className="mb-3">
                <p className="text-[13px] text-[var(--c-text-muted)] uppercase font-medium mb-1.5">
                  {state.sessionMode === 'accept-edits' ? 'Pending Edit Approval' : 'Pending Tool Approval'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove('1')}
                    className="flex-1 px-3 py-1.5 text-[13px] bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => onApprove('2')}
                    className="flex-1 px-3 py-1.5 text-[13px] bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors"
                  >
                    Allow Session
                  </button>
                  <button
                    onClick={() => onApprove('3')}
                    className="flex-1 px-3 py-1.5 text-[13px] bg-red-600 hover:bg-red-500 rounded-md text-white transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Send a message..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && msg.trim()) {
                    onSendMessage(msg.trim())
                    setMsg('')
                  }
                }}
                className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded-md px-3 py-2 text-[13px] text-[var(--c-text-heading)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] font-mono"
              />
              <button
                onClick={() => {
                  if (msg.trim()) {
                    onSendMessage(msg.trim())
                    setMsg('')
                  }
                }}
                disabled={!msg.trim()}
                className="px-3 py-2 text-[13px] bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors disabled:opacity-40"
              >
                Send
              </button>
            </div>

            {state.tty && (
              <div className="mb-3">
                <p className="text-[13px] text-[var(--c-text-muted)] uppercase font-medium mb-1.5">Quick Response</p>
                <div className="flex gap-1.5">
                  {['1', '2', '3', '4', '5'].map(n => (
                    <button
                      key={n}
                      onClick={() => onSendMessage(n)}
                      className="w-9 h-9 text-[13px] font-bold bg-[var(--c-bg-elevated)] hover:bg-blue-900/40 border border-[var(--c-border)] rounded-md text-[var(--c-text-primary)] transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => onSendMessage('y')}
                    className="px-3 h-9 text-[13px] font-bold bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-md text-emerald-400 transition-colors"
                  >
                    Y
                  </button>
                  <button
                    onClick={() => onSendMessage('n')}
                    className="px-3 h-9 text-[13px] font-bold bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded-md text-red-400 transition-colors"
                  >
                    N
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {state.tty && (
                <button
                  onClick={onFocusiTerm}
                  className="flex-1 px-3 py-1.5 text-[13px] bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] rounded-md border border-[var(--c-border)] text-[var(--c-text-primary)] transition-colors"
                >
                  Focus in iTerm
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TypePickerModal
// ---------------------------------------------------------------------------

function TypePickerModal({
  configs,
  onSelect,
  onClose,
}: {
  configs: AgentConfig[]
  onSelect: (c: AgentConfig) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in">
      <div className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[520px] shadow-2xl max-h-[80vh] overflow-y-auto animate-modal-scale-in ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-[var(--c-text-heading)]">Hire Worker</h3>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">Choose a role</p>
          </div>
          <button onClick={onClose} className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg">
            x
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {configs.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="stagger-item text-left p-3 bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] hover:bg-[var(--c-bg-elevated)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] hover:border-[var(--c-border-hover)] rounded-lg transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] group"
            >
              <p className="text-[13px] font-semibold text-[var(--c-text-heading)] group-hover:text-[var(--c-text-heading)]">{c.name}</p>
              <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">
                {c.mcpProfile} / {c.model}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {c.skills.map(s => (
                  <span
                    key={s}
                    className="text-[13px] px-1.5 py-0.5 bg-blue-600/10 border border-blue-500/20 rounded text-blue-400/80"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LaunchModal
// ---------------------------------------------------------------------------

function LaunchModal({
  config,
  onLaunch,
  onLaunchEmbedded,
  onClose,
}: {
  config: AgentConfig
  onLaunch: (id: string, cwd: string) => void
  onLaunchEmbedded: (id: string, cwd: string) => void
  onClose: () => void
}) {
  const [cwd, setCwd] = useState(config.defaultRepos[0] || '')
  const [custom, setCustom] = useState('')
  const repos = config.defaultRepos

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in">
      <div className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[420px] shadow-2xl animate-modal-scale-in ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-[var(--c-text-heading)]">{config.name}</h3>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">
              {config.model} / {config.mcpProfile}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg">
            x
          </button>
        </div>
        <p className="text-[13px] text-[var(--c-text-muted)] uppercase font-medium mb-2">Working Directory</p>
        {repos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {repos.map(r => (
              <button
                key={r}
                onClick={() => {
                  setCwd(r)
                  setCustom('')
                }}
                className={`stagger-item px-2.5 py-1 text-[13px] rounded-md border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                  cwd === r && !custom
                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                    : 'bg-[var(--c-bg-elevated)] border-[var(--c-border)] text-[var(--c-text-secondary)] hover:text-[var(--c-text-heading)]'
                }`}
              >
                {r.split('/').pop()}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder={repos.length > 0 ? 'Or enter a custom path...' : 'Enter project path...'}
            value={custom}
            onChange={e => {
              setCustom(e.target.value)
              if (e.target.value) setCwd(e.target.value)
            }}
            onKeyDown={e =>
              e.key === 'Enter' && (custom || cwd) && onLaunch(config.id, custom || cwd)
            }
            className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded-md px-3 py-2 text-[13px] text-[var(--c-text-heading)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] font-mono"
          />
          <button
            onClick={async () => {
              const picked = await window.api.pickDirectory()
              if (picked) {
                setCustom(picked)
                setCwd(picked)
              }
            }}
            className="flex-none px-3 py-2 text-[13px] bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-md text-[var(--c-text-primary)] transition-colors"
          >
            Browse...
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] rounded-md border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onLaunchEmbedded(config.id, custom || cwd)}
            disabled={!cwd && !custom}
            className="px-4 py-1.5 text-[13px] bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors disabled:opacity-40"
          >
            Launch Here
          </button>
          <button
            onClick={() => onLaunch(config.id, custom || cwd)}
            disabled={!cwd && !custom}
            className="px-4 py-1.5 text-[13px] bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors disabled:opacity-40"
          >
            Launch in iTerm
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusDot(state: AgentState): { color: string; pulse: boolean } {
  if (state.needsInteraction) return { color: 'bg-amber-400', pulse: true }
  if (state.sessionMode === 'plan') return { color: 'bg-violet-400', pulse: false }
  if (state.sessionMode === 'accept-edits') return { color: 'bg-blue-400', pulse: false }
  if (state.sessionMode === 'working') return { color: 'bg-emerald-400', pulse: false }
  if (state.status === 'active') return { color: 'bg-emerald-400', pulse: false }
  return { color: 'bg-[var(--c-text-faint)]', pulse: false }
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function IconHeart() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconFolder() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconNewspaper() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8z" />
    </svg>
  )
}

function IconFunnel() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconQueue() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="17" width="18" height="4" rx="1" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ConfigModal — Editable MCP servers, Claude settings, agent tools
// ---------------------------------------------------------------------------

function ConfigModal({ config, onClose, onRefresh }: {
  config: ConfigSnapshot
  onClose: () => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<'mcp' | 'claude' | 'agents'>('mcp')
  const [saving, setSaving] = useState(false)
  const [addingMcp, setAddingMcp] = useState<{ target: 'project' | string } | null>(null)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [newTool, setNewTool] = useState('')

  const doRemoveProjectMcp = async (name: string) => {
    if (!confirm(`Remove MCP server "${name}" from .mcp.json?`)) return
    setSaving(true)
    await window.api.removeProjectMcpServer(name)
    onRefresh()
    setSaving(false)
  }

  const doRemoveProfileMcp = async (profile: string, name: string) => {
    if (!confirm(`Remove "${name}" from profile "${profile}"?`)) return
    setSaving(true)
    await window.api.removeProfileMcpServer(profile, name)
    onRefresh()
    setSaving(false)
  }

  const doRemoveAgentTool = async (agentId: string, tool: string, currentTools: string[]) => {
    setSaving(true)
    await window.api.updateAgentTools(agentId, currentTools.filter(t => t !== tool))
    onRefresh()
    setSaving(false)
  }

  const doAddAgentTool = async (agentId: string, tool: string, currentTools: string[]) => {
    if (!tool.trim() || currentTools.includes(tool.trim())) return
    setSaving(true)
    await window.api.updateAgentTools(agentId, [...currentTools, tool.trim()])
    onRefresh()
    setSaving(false)
    setNewTool('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in" onClick={onClose}>
      <div className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[680px] shadow-2xl max-h-[80vh] overflow-y-auto animate-modal-scale-in ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-[var(--c-text-heading)]">Config</h3>
            <div className="flex rounded-lg bg-[var(--c-bg-elevated)] p-0.5">
              {(['mcp', 'claude', 'agents'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-2.5 py-0.5 text-[10px] rounded capitalize ${tab === t ? 'bg-[var(--c-border)] text-white' : 'text-[var(--c-text-muted)]'}`}
                >{t === 'mcp' ? `MCP (${config.mcp.totalUniqueServers})` : t === 'claude' ? 'Claude' : `Agents (${config.agents.length})`}</button>
              ))}
            </div>
            {saving && <span className="text-[10px] text-amber-400 animate-pulse">Saving...</span>}
          </div>
          <button onClick={onClose} className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg">x</button>
        </div>

        {/* ── MCP Tab ─────────────────────────────────────────────────── */}
        {tab === 'mcp' && (
          <div className="flex flex-col gap-3">
            {/* Project .mcp.json */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider">
                  Project MCP Servers ({config.mcp.projectServers.length})
                  <span className="text-[var(--c-border-hover)] ml-2 normal-case">.mcp.json</span>
                </p>
                <button onClick={() => setAddingMcp({ target: 'project' })}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 transition-colors"
                >+ Add Server</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {config.mcp.projectServers.map(s => (
                  <McpServerCard key={s.name} server={s} onRemove={() => doRemoveProjectMcp(s.name)} />
                ))}
              </div>
            </div>

            {/* Profile servers */}
            {Object.entries(config.mcp.profileServers).map(([profile, servers]) => (
              <div key={profile}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider">
                    Profile: <span className="text-cyan-400/70">{profile}</span>
                    <span className="text-[var(--c-border-hover)] ml-2 normal-case">({servers.length} servers)</span>
                  </p>
                  <button onClick={() => setAddingMcp({ target: profile })}
                    className="text-[10px] px-2 py-0.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 transition-colors"
                  >+ Add</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {servers.map(s => (
                    <McpServerCard key={`${profile}-${s.name}`} server={s}
                      onRemove={() => doRemoveProfileMcp(profile, s.name)} />
                  ))}
                </div>
              </div>
            ))}

            {/* Add MCP form */}
            {addingMcp && (
              <AddMcpForm
                target={addingMcp.target}
                onAdd={async (server) => {
                  setSaving(true)
                  if (addingMcp.target === 'project') {
                    await window.api.addProjectMcpServer(server)
                  } else {
                    await window.api.addProfileMcpServer(addingMcp.target, server)
                  }
                  setAddingMcp(null)
                  onRefresh()
                  setSaving(false)
                }}
                onCancel={() => setAddingMcp(null)}
              />
            )}
          </div>
        )}

        {/* ── Claude Tab ──────────────────────────────────────────────── */}
        {tab === 'claude' && (
          <div className="flex flex-col gap-3">
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
              <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider mb-1.5">Global Settings</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {config.claude.globalSettings.alwaysThinking && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">Always Thinking</span>
                )}
                {config.claude.globalSettings.enabledPlugins.map(p => (
                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">{p}</span>
                ))}
              </div>
              {config.claude.globalSettings.envVars.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[9px] text-[var(--c-text-faint)] mb-1">Environment Variables</p>
                  <div className="flex flex-wrap gap-1">
                    {config.claude.globalSettings.envVars.map(k => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--c-bg-chrome)] text-[var(--c-text-dim)] font-mono">{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {config.claude.globalSettings.permissions.allow.length > 0 && (
                <div>
                  <p className="text-[9px] text-[var(--c-text-faint)] mb-1">Allowed Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {config.claude.globalSettings.permissions.allow.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-mono">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
              <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider mb-1.5">Project Settings</p>
              <p className="text-[11px] text-[var(--c-text-dim)] font-mono">{config.claude.projectSettings.path}</p>
              <p className={`text-[10px] mt-0.5 ${config.claude.projectSettings.exists ? 'text-green-400' : 'text-[var(--c-text-faint)]'}`}>
                {config.claude.projectSettings.exists ? 'Active' : 'Not configured'}
              </p>
            </div>
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
              <p className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider mb-1.5">CLAUDE.md Files ({config.claude.claudeMdFiles.length})</p>
              {config.claude.claudeMdFiles.map(f => (
                <div key={f.path} className="flex items-center gap-2 py-1 border-b border-[color-mix(in_srgb,var(--c-border)_30%,transparent)] last:border-0">
                  <span className="text-[11px] text-cyan-400/80 font-mono flex-1 truncate">{f.path}</span>
                  <span className="text-[10px] text-[var(--c-text-faint)] shrink-0">{(f.sizeBytes / 1024).toFixed(1)}KB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Agents Tab (editable tools) ─────────────────────────────── */}
        {tab === 'agents' && (
          <div className="flex flex-col gap-2">
            {config.agents.map(a => {
              const isEditing = editingAgent === a.agentId
              return (
                <div key={a.agentId} className={`bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 border transition-colors ${isEditing ? 'border-cyan-500/40' : 'border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--c-text-heading)]">{a.agentName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{a.mcpProfile}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--c-text-faint)] font-mono">{a.agentId}</span>
                      <button
                        onClick={() => setEditingAgent(isEditing ? null : a.agentId)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          isEditing
                            ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                            : 'bg-[var(--c-bg-chrome)] border-[var(--c-border)] text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)]'
                        }`}
                      >{isEditing ? 'Done' : 'Edit'}</button>
                    </div>
                  </div>

                  {/* MCP servers */}
                  {a.mcpServers.length > 0 && (
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span className="text-[9px] text-[var(--c-text-faint)] mr-1">MCP:</span>
                      {a.mcpServers.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Tools — editable when selected */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-[var(--c-text-faint)] mr-1">Tools:</span>
                    {a.allowedTools.map(t => (
                      <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-[var(--c-bg-chrome)] text-[var(--c-text-dim)] font-mono inline-flex items-center gap-0.5 group">
                        {t.length > 25 ? t.slice(0, 23) + '..' : t}
                        {isEditing && (
                          <button
                            onClick={() => doRemoveAgentTool(a.agentId, t, a.allowedTools)}
                            className="text-red-400/50 hover:text-red-400 ml-0.5 leading-none"
                            title={`Remove ${t}`}
                          >x</button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Add tool input — visible when editing */}
                  {isEditing && (
                    <div className="flex gap-1.5 mt-2">
                      <input
                        type="text"
                        value={newTool}
                        onChange={e => setNewTool(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') doAddAgentTool(a.agentId, newTool, a.allowedTools) }}
                        placeholder="mcp__server__* or Bash(cmd:*)"
                        className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1 text-[11px] text-[var(--c-text-heading)] placeholder-[var(--c-border-hover)] font-mono focus:outline-none focus:border-cyan-500/40"
                      />
                      <button
                        onClick={() => doAddAgentTool(a.agentId, newTool, a.allowedTools)}
                        disabled={!newTool.trim()}
                        className="px-2 py-1 text-[10px] bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/30 rounded text-emerald-400 transition-colors disabled:opacity-30"
                      >Add</button>
                    </div>
                  )}

                  {/* Skills */}
                  {a.skills.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[9px] text-[var(--c-text-faint)] mr-1">Skills:</span>
                      {a.skills.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Inline form to add a new MCP server
function AddMcpForm({ target, onAdd, onCancel }: {
  target: string
  onAdd: (server: { name: string; command: string; args: string[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('npx')
  const [argsStr, setArgsStr] = useState('')

  return (
    <div className="bg-[var(--c-bg-chrome)] rounded-lg px-3 py-3 border border-cyan-500/30">
      <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-2">
        Add MCP Server to {target === 'project' ? '.mcp.json' : `profile: ${target}`}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Server name"
            className="flex-1 bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-[11px] text-[var(--c-text-heading)] placeholder-[var(--c-border-hover)] font-mono focus:outline-none focus:border-cyan-500/40" />
          <select value={command} onChange={e => setCommand(e.target.value)}
            className="bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-[11px] text-[var(--c-text-heading)] font-mono focus:outline-none focus:border-cyan-500/40">
            <option value="npx">npx</option>
            <option value="uvx">uvx</option>
            <option value="node">node</option>
          </select>
        </div>
        <input type="text" value={argsStr} onChange={e => setArgsStr(e.target.value)}
          placeholder="Args (space-separated, e.g. -y @pkg/name)"
          className="bg-[var(--c-bg-deep)] border border-[var(--c-border)] rounded px-2 py-1.5 text-[11px] text-[var(--c-text-heading)] placeholder-[var(--c-border-hover)] font-mono focus:outline-none focus:border-cyan-500/40" />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-2.5 py-1 text-[10px] bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded text-[var(--c-text-secondary)] transition-colors"
          >Cancel</button>
          <button onClick={() => { if (name.trim()) onAdd({ name: name.trim(), command, args: argsStr.split(/\s+/).filter(Boolean) }) }}
            disabled={!name.trim()}
            className="px-2.5 py-1 text-[10px] bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/30 rounded text-emerald-400 transition-colors disabled:opacity-30"
          >Add Server</button>
        </div>
      </div>
    </div>
  )
}

function McpServerCard({ server, onRemove }: { server: McpServerEntry; onRemove?: () => void }) {
  const cmdShort = server.command === 'npx' || server.command === 'uvx'
    ? server.args.filter(a => !a.startsWith('-')).pop() || server.command
    : server.command
  const envCount = Object.keys(server.env).length
  return (
    <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] rounded-lg px-2.5 py-2 border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)] group relative">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-semibold text-[var(--c-text-heading)]">{server.name}</span>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] px-1 py-0.5 rounded ${
            server.source === 'project' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
          }`}>{server.source}</span>
          {onRemove && (
            <button onClick={onRemove}
              className="text-[10px] text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 transition-colors leading-none"
              title="Remove server"
            >x</button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-[var(--c-text-muted)] font-mono truncate">{cmdShort}</p>
      {envCount > 0 && (
        <p className="text-[9px] text-[var(--c-border-hover)] mt-0.5">{envCount} env var{envCount !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SharePickerModal
// ---------------------------------------------------------------------------

function SharePickerModal({ source, agents, onShare, onClose }: {
  source: AgentState
  agents: AgentState[]
  onShare: (target: AgentState) => void
  onClose: () => void
}) {
  const targets = agents.filter(a => a.config.id !== source.config.id && a.tty)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in" onClick={onClose}>
      <div className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[400px] shadow-2xl animate-modal-scale-in ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-[var(--c-text-heading)]">Share from {source.config.name}</h3>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-0.5">Send last output to another agent</p>
          </div>
          <button onClick={onClose} className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg">x</button>
        </div>
        {!source.lastAssistantBlurb ? (
          <p className="text-[13px] text-[var(--c-text-muted)] py-4 text-center">No output to share</p>
        ) : (
          <>
            <div className="bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg px-3 py-2 mb-3 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)]">
              <p className="text-[13px] text-[var(--c-text-muted)] uppercase mb-0.5">Sharing</p>
              <p className="text-[13px] text-[var(--c-text-primary)] line-clamp-3">{source.lastAssistantBlurb}</p>
            </div>
            {targets.length === 0 ? (
              <p className="text-[13px] text-[var(--c-text-muted)] py-4 text-center">No other agents available</p>
            ) : (
              <div className="flex flex-col gap-2">
                {targets.map(t => (
                  <button key={t.config.id} onClick={() => onShare(t)}
                    className="stagger-item flex items-center gap-2 p-2 bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] hover:bg-[var(--c-bg-elevated)] border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] hover:border-[var(--c-border-hover)] rounded-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] text-left">
                    <span className={`w-2 h-2 rounded-full ${getStatusDot(t).color}`} />
                    <span className="text-[13px] text-[var(--c-text-heading)]">{t.config.name}</span>
                    {t.cwd && <span className="text-[13px] text-[var(--c-text-muted)] ml-auto">{t.cwd.split('/').pop()}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LeaderboardModal — Resource usage grouped by project directory
// ---------------------------------------------------------------------------

function buildProjectLeaderboard(agents: AgentState[]): ProjectLeaderboardEntry[] {
  const byDir = new Map<string, ProjectLeaderboardEntry>()

  for (const agent of agents) {
    if (agent.isSubAgent) continue
    const dir = agent.cwd || 'unknown'
    const projectName = dir.split('/').pop() || dir

    let entry = byDir.get(dir)
    if (!entry) {
      entry = { directory: dir, projectName, agentCount: 0, totalMemoryMB: 0, totalCpu: 0, agents: [] }
      byDir.set(dir, entry)
    }

    const cpuVal = parseFloat(agent.cpu || '0')
    const memVal = agent.memoryMB || 0
    entry.agentCount += 1
    entry.totalMemoryMB += memVal
    entry.totalCpu += cpuVal
    entry.agents.push({
      name: agent.config.name,
      status: agent.status,
      memoryMB: memVal,
      cpu: cpuVal,
      uptime: agent.uptime || '0m',
    })
  }

  return [...byDir.values()].sort((a, b) => b.totalMemoryMB - a.totalMemoryMB)
}

function getRankBadge(level: number): string {
  if (level >= 9) return '👑'
  if (level >= 7) return '⭐'
  if (level >= 5) return '💫'
  if (level >= 3) return '✨'
  return '💧'
}

function getRankColor(level: number): string {
  if (level >= 9) return 'text-amber-400'
  if (level >= 7) return 'text-purple-400'
  if (level >= 5) return 'text-blue-400'
  if (level >= 3) return 'text-green-400'
  return 'text-[var(--c-text-secondary)]'
}

function LeaderboardModal({ agents, xpData, onClose }: {
  agents: AgentState[]
  xpData: Record<string, AgentXP> | undefined
  onClose: () => void
}) {
  // Build XP-based leaderboard from agents merged with XP data
  const xpEntries = agents
    .filter(a => {
      const xp = xpData?.[a.config.id]
      return xp && xp.totalXP > 0
    })
    .map(a => ({
      agentId: a.config.id,
      name: a.config.name,
      project: a.cwd?.split('/').pop() || 'unknown',
      xp: xpData![a.config.id],
    }))
    .sort((a, b) => b.xp.totalXP - a.xp.totalXP)

  const totalXP = xpEntries.reduce((s, e) => s + e.xp.totalXP, 0)
  const totalTasks = xpEntries.reduce((s, e) => s + e.xp.tasksCompleted, 0)

  // Also build resource leaderboard as fallback
  const resourceEntries = buildProjectLeaderboard(agents)
  const totalMem = resourceEntries.reduce((s, e) => s + e.totalMemoryMB, 0)

  const [viewMode, setViewMode] = useState<'xp' | 'resources'>('xp')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in" onClick={onClose}>
      <div className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[560px] shadow-2xl max-h-[75vh] overflow-y-auto animate-modal-scale-in ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-[var(--c-text-heading)]">Leaderboard</h3>
            <div className="flex rounded-lg bg-[var(--c-bg-elevated)] p-0.5">
              <button
                onClick={() => setViewMode('xp')}
                className={`px-2 py-0.5 text-[10px] rounded ${viewMode === 'xp' ? 'bg-[var(--c-border)] text-white' : 'text-[var(--c-text-muted)]'}`}
              >
                XP
              </button>
              <button
                onClick={() => setViewMode('resources')}
                className={`px-2 py-0.5 text-[10px] rounded ${viewMode === 'resources' ? 'bg-[var(--c-border)] text-white' : 'text-[var(--c-text-muted)]'}`}
              >
                Resources
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] text-lg">x</button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-[color-mix(in_srgb,var(--c-bg-elevated)_50%,transparent)] rounded-lg border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] text-[12px] text-[var(--c-text-secondary)]">
          {viewMode === 'xp' ? (
            <>
              <span>{xpEntries.length} agent{xpEntries.length !== 1 ? 's' : ''}</span>
              <span>{totalXP.toLocaleString()} Total XP</span>
              <span>{totalTasks} Tasks</span>
            </>
          ) : (
            <>
              <span>{resourceEntries.length} project{resourceEntries.length !== 1 ? 's' : ''}</span>
              <span>{resourceEntries.reduce((s, e) => s + e.agentCount, 0)} agents</span>
              <span>{totalMem.toLocaleString()} MB</span>
            </>
          )}
        </div>

        {viewMode === 'xp' ? (
          /* XP Leaderboard */
          xpEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-[var(--c-text-muted)] mb-2">No XP data yet</p>
              <p className="text-[11px] text-[var(--c-text-faint)]">Complete tasks to earn XP and climb the ranks</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {xpEntries.map((entry, idx) => (
                <div key={entry.agentId} className={`stagger-item p-3 rounded-lg border transition-all ${
                  idx === 0 ? 'bg-amber-900/20 border-amber-700/50' :
                  idx === 1 ? 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border-[color-mix(in_srgb,var(--c-border-hover)_50%,transparent)]' :
                  idx === 2 ? 'bg-orange-900/15 border-orange-800/40' :
                  'bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg w-8 text-center font-bold ${idx === 0 ? 'text-amber-400' : 'text-[var(--c-text-muted)]'}`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[var(--c-text-heading)] truncate">{entry.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRankColor(entry.xp.level)} bg-[color-mix(in_srgb,var(--c-bg-elevated)_80%,transparent)]`}>
                          {getRankBadge(entry.xp.level)} Lv.{entry.xp.level} {entry.xp.rank}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--c-text-muted)] truncate">{entry.project}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[14px] font-bold ${idx === 0 ? 'text-amber-400' : 'text-[var(--c-text-primary)]'}`}>
                        {entry.xp.totalXP.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[var(--c-text-muted)]">XP</p>
                    </div>
                  </div>

                  {/* Progress bar to next level */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--c-bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          entry.xp.level >= 9 ? 'bg-amber-500' :
                          entry.xp.level >= 7 ? 'bg-purple-500' :
                          entry.xp.level >= 5 ? 'bg-blue-500' :
                          entry.xp.level >= 3 ? 'bg-green-500' :
                          'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, (entry.xp.totalXP % 1000) / 10)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--c-text-faint)] w-16 text-right">
                      {entry.xp.tasksCompleted} tasks
                    </span>
                  </div>

                  {/* Streak indicator */}
                  {entry.xp.currentStreak > 0 && (
                    <div className="mt-1 text-[9px] text-amber-500/70">
                      🔥 {entry.xp.currentStreak} task streak
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          /* Resource Leaderboard (original) */
          resourceEntries.length === 0 ? (
            <p className="text-[13px] text-[var(--c-text-muted)] text-center py-8">No active sessions.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {resourceEntries.map((entry, idx) => {
                const memPct = totalMem > 0 ? (entry.totalMemoryMB / totalMem) * 100 : 0
                return (
                  <div key={entry.directory} className={`stagger-item p-3 rounded-lg border transition-all ${
                    idx === 0 ? 'bg-amber-900/15 border-amber-700/40' :
                    idx === 1 ? 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border-[color-mix(in_srgb,var(--c-border-hover)_40%,transparent)]' :
                    idx === 2 ? 'bg-orange-900/10 border-orange-800/30' :
                    'bg-[color-mix(in_srgb,var(--c-bg-elevated)_30%,transparent)] border-[color-mix(in_srgb,var(--c-border)_30%,transparent)]'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center font-bold shrink-0" style={{ fontFamily: 'Monogram, monospace' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--c-text-heading)] truncate">{entry.projectName}</p>
                        <p className="text-[10px] text-[var(--c-text-muted)] truncate">{entry.directory}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold text-amber-400">{entry.totalMemoryMB.toLocaleString()} MB</p>
                        <p className="text-[10px] text-[var(--c-text-muted)]">{entry.totalCpu.toFixed(1)}% CPU</p>
                      </div>
                    </div>

                    {/* Memory proportion bar */}
                    <div className="mt-2 h-1.5 bg-[var(--c-bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${Math.max(memPct, 2)}%` }}
                      />
                    </div>

                    {/* Agent breakdown */}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {entry.agents.map((a, i) => (
                        <span key={i} className="text-[10px] text-[var(--c-text-secondary)] flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-400' : 'bg-[var(--c-text-faint)]'}`} />
                          {a.name}
                          <span className="text-[var(--c-text-faint)]">{a.memoryMB}MB</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommandCenter
// ---------------------------------------------------------------------------

export function CommandCenter(props: CommandCenterProps) {
  const { toast } = useToast()
  const uiTheme = useAppearanceStore((s) => s.theme)

  // --- Polling ---
  const { data: agentStatuses, errorCount: agentPollErrors } = usePolling<AgentState[]>(
    () => window.api.getAgentStatuses(),
    5000,
  )
  const { data: opencodeSessions } = usePolling<OpencodeSession[]>(
    () => window.api.getOpencodeSessions().catch(() => []),
    5000,
  )
  const { data: health } = usePolling<HealthResult>(() => window.api.getHealth(), 15000)
  const { data: hotLeads } = usePolling<HotLead[]>(
    () => window.api.getHotLeads().catch(() => []),
    30000,
  )
  const { data: schedulerJobs } = usePolling<JobStatus[]>(
    () => window.api.getSchedulerStatus().catch(() => []),
    30000,
  )
  const { data: xpData } = usePolling<Record<string, AgentXP>>(
    () => window.api.orchestratorXP().catch(() => ({})),
    10000,
  )
  const { data: contextHealthReports } = usePolling<ContextHealth[]>(
    () => window.api.contextHealth().catch(() => []),
    10000,
  )
  const { data: capStatus } = usePolling<{ updatedAt: string; overall: string; items: Record<string, string> } | null>(
    () => window.api.capabilitiesStatus().catch(() => null),
    10000,
  )

  const agentsForGame = useMemo(() => {
    if (!agentStatuses) return undefined
    return mergeAgentContextFromHealth(agentStatuses, contextHealthReports)
  }, [agentStatuses, contextHealthReports])

  // --- Agent configs (load once) ---
  const [allConfigs, setAllConfigs] = useState<AgentConfig[]>([])
  useEffect(() => {
    window.api.getAgents().then(setAllConfigs)
  }, [])

  // --- Clock ---
  const [clock, setClock] = useState(() => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  })
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // --- Modal state ---
  const [actionAgent, setActionAgent] = useState<AgentState | null>(null)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [launchConfig, setLaunchConfig] = useState<AgentConfig | null>(null)
  const [shareSource, setShareSource] = useState<AgentState | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showPodLauncher, setShowPodLauncher] = useState(false)
  const [showPodList, setShowPodList] = useState(false)
  const [viewingPod, setViewingPod] = useState<PodWorkflow | null>(null)
  const [podPresets, setPodPresets] = useState<PodPreset[]>([])
  const [smokeCheckRunning, setSmokeCheckRunning] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [configData, setConfigData] = useState<ConfigSnapshot | null>(null)

  // Load pod presets once
  useEffect(() => {
    window.api.getPodPresets().then(setPodPresets).catch(() => {})
  }, [])

  // Poll pod workflows for badge display (Fix 9)
  const { data: podWorkflows } = usePolling<PodWorkflow[]>(
    () => window.api.listPods().catch(() => []),
    5000,
  )

  const { data: orchestratorQueueTasks } = usePolling<Task[]>(
    () => window.api.orchestratorQueue().catch(() => []),
    5000,
  )

  const { data: fleetStatus } = usePolling<FleetStatus>(
    () => window.api.fleetStatus().catch(() => ({ instances: [], channelName: '', lastPollAt: null })),
    15000,
  )

  // --- Fleet popover state ---
  const [showFleetPopover, setShowFleetPopover] = useState(false)

  // Push fleet data to game scene via EventBus
  useEffect(() => {
    if (fleetStatus && fleetStatus.instances.length > 0) {
      EventBus.emit(EVENTS.FLEET_UPDATED, fleetStatus.instances)
    }
  }, [fleetStatus])

  // --- Embedded terminal ---
  const [terminal, setTerminal] = useState<{ ptyId: string; title: string } | null>(null)

  // --- Phaser game ---
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const gameRef = useRef<any>(null)

  // --- Initialize Phaser game ---
  useEffect(() => {
    if (!gameContainerRef.current) return
    const container = gameContainerRef.current
    const { game, scene } = createOfficeGame(container)
    gameRef.current = game
    sceneRef.current = scene

    let rafId: number | null = null
    const syncGameSizeToContainer = () => {
      // Prefer layout box integers (avoids subpixel rect vs client size drift).
      const width = Math.max(1, Math.round(container.clientWidth))
      const height = Math.max(1, Math.round(container.clientHeight))
      game.scale.resize(width, height)
      // Re-sync internal bounds after CSS-sized canvas (absolute in parent).
      game.scale.refresh()
    }

    const queueSync = () => {
      if (rafId !== null) return
      // Double rAF: run after flex/padding layout has settled (ResizeObserver can fire early).
      rafId = window.requestAnimationFrame(() => {
        rafId = window.requestAnimationFrame(() => {
          rafId = null
          syncGameSizeToContainer()
        })
      })
    }

    // Keep Phaser canvas dimensions locked to the React container size.
    const resizeObserver = new ResizeObserver(() => queueSync())
    resizeObserver.observe(container)
    window.addEventListener('resize', queueSync)
    queueSync()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', queueSync)
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      EventBus.removeAll()
      game.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  // --- Push agent data into Phaser scene ---
  useEffect(() => {
    if (sceneRef.current && agentsForGame) {
      sceneRef.current.setAgents(agentsForGame, opencodeSessions)
    }
  }, [agentsForGame, opencodeSessions])

  // --- Orchestrator tasks on desks (assigned / active) ---
  useEffect(() => {
    if (!sceneRef.current || !orchestratorQueueTasks) return
    const running = orchestratorQueueTasks
      .filter(t => (t.status === 'assigned' || t.status === 'active') && t.assignedAgent)
      .map(t => ({
        taskId: t.id,
        agentId: t.assignedAgent!,
        title: t.title,
        stage: t.currentStage ?? 'queued',
      }))
    sceneRef.current.setOrchestratorTasks(running)
  }, [orchestratorQueueTasks])

  const isCursorState = useCallback(
    (state: AgentState) =>
      state.config.model === 'cursor-agent' || state.config.id.startsWith('cursor-'),
    [],
  )

  const focusAgentFromState = useCallback(
    async (agentState: AgentState): Promise<boolean> => {
      if (isCursorState(agentState)) {
        const cursorResult = await window.api.focusCursorIDE().catch(() => ({ success: false }))
        if (cursorResult?.success) return true
      }

      if (agentState.tty) {
        const ttyResult = await window.api.focusSession(agentState.tty).catch(() => ({ success: false }))
        if (ttyResult?.success) return true
      }

      const isConfiguredAgent = allConfigs.some(cfg => cfg.id === agentState.config.id)
      if (isConfiguredAgent) {
        const idResult = await window.api.focusAgent(agentState.config.id).catch(() => ({ success: false }))
        if (idResult?.success) return true
      }

      const nameResult = await window.api
        .focusSessionByName(agentState.config.name, agentState.cwd)
        .catch(() => ({ success: false }))
      return !!nameResult?.success
    },
    [allConfigs, isCursorState],
  )

  // --- Push pod workflow data into Phaser scene for connecting lines (Fix 11) ---
  useEffect(() => {
    if (sceneRef.current && podWorkflows) {
      const activeWorkflows = podWorkflows
        .filter(wf => !['complete', 'failed'].includes(wf.status))
        .map(wf => ({
          workflowId: wf.id,
          solverAgentId: wf.solver.agentId,
          reviewerAgentId: wf.reviewer.agentId,
          executorAgentId: wf.executor.agentId,
          status: wf.status,
          candidates: wf.solverCandidateCount > 1 ? wf.solverCandidateCount : undefined,
          candidateSelected:
            !!wf.selfEvaluation ||
            (wf.solverCandidateCount > 1 &&
              wf.solver.status === 'complete' &&
              wf.status === 'solving' &&
              wf.phaseConfig?.selfEvaluation === false),
        }))
      sceneRef.current.setPodWorkflows(activeWorkflows)
    }
  }, [podWorkflows])

  // --- Push capabilities status into Phaser scene for ops board overlay ---
  useEffect(() => {
    if (!capStatus || !sceneRef.current) return
    const rows = mergeCapabilityRows(capStatus.items as Record<string, string>).map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
    }))
    sceneRef.current.setCapabilitiesBoard(rows)
  }, [capStatus])

  // --- Wire EventBus to React state ---
  useEffect(() => {
    const handleAgentClicked = (_id: unknown, state: unknown) => {
      const agentState = state as AgentState
      void focusAgentFromState(agentState).then((focused) => {
        if (!focused) {
          toast(`Couldn't focus ${agentState.config.name}`, 'error')
        }
      })
    }
    const handleAgentDoubleClicked = (_id: unknown, state: unknown) => {
      setActionAgent(state as AgentState)
    }
    const handleAddWorker = () => {
      setShowTypePicker(true)
    }

    EventBus.on(EVENTS.AGENT_CLICKED, handleAgentClicked)
    EventBus.on(EVENTS.AGENT_DOUBLE_CLICKED, handleAgentDoubleClicked)
    EventBus.on(EVENTS.ADD_WORKER_CLICKED, handleAddWorker)

    return () => {
      EventBus.off(EVENTS.AGENT_CLICKED, handleAgentClicked)
      EventBus.off(EVENTS.AGENT_DOUBLE_CLICKED, handleAgentDoubleClicked)
      EventBus.off(EVENTS.ADD_WORKER_CLICKED, handleAddWorker)
    }
  }, [focusAgentFromState, toast])

  // --- Derived data ---
  const agents = agentStatuses ?? []
  const cursorAgentCount = agents.filter(a => a.config.model === 'cursor-agent').length
  const claudeAgentCount = agents.length - cursorAgentCount
  const externalCliAgentCount = (opencodeSessions ?? []).length
  const activeAgentCount = agents.filter(a => a.status === 'active' || a.needsInteraction).length

  const enabledJobs = (schedulerJobs ?? []).filter(j => j.enabled)
  const failedJobs = enabledJobs.filter(j => j.last_success === false)

  const hotLeadCount = (hotLeads ?? []).length

  // --- Handlers ---
  const handleSendMessage = useCallback(
    async (state: AgentState, msg: string) => {
      if (!state.tty) {
        toast(`No terminal attached to ${state.config.name}`, 'error')
        return
      }
      try {
        const result = await window.api.sendToSession(state.tty, msg)
        if (result?.error) {
          toast(`Send failed: ${result.error}`, 'error')
          return
        }
        toast(`Message sent to ${state.config.name}`, 'success')
        setActionAgent(null)
      } catch {
        toast('Failed to send message', 'error')
      }
    },
    [toast],
  )

  const handleApprove = useCallback(
    async (state: AgentState, choice: string) => {
      if (!state.tty) {
        toast(`No terminal attached to ${state.config.name}`, 'error')
        return
      }
      try {
        const result = await window.api.approveSession(state.tty, choice)
        if (result?.error) {
          toast(`Approve failed: ${result.error}`, 'error')
          return
        }
        EventBus.emit(EVENTS.AGENT_APPROVED, state.config.id, state.tty)
        toast(`Approved for ${state.config.name}`, 'success')
        setActionAgent(null)
      } catch {
        toast('Failed to approve', 'error')
      }
    },
    [toast],
  )

  const handleFocusiTerm = useCallback(
    async (state: AgentState) => {
      try {
        const focused = await focusAgentFromState(state)
        if (!focused) {
          toast(`Couldn't focus ${state.config.name}`, 'error')
          return
        }
        setActionAgent(null)
      } catch {
        toast('Failed to focus', 'error')
      }
    },
    [focusAgentFromState, toast],
  )

  const handleLaunchAgent = useCallback(
    async (agentId: string, cwd: string) => {
      try {
        const r = await window.api.launchAgent(agentId, cwd)
        if (r.success) {
          toast('Agent launched in iTerm', 'success')
        } else {
          toast(r.error || 'Launch failed', 'error')
        }
      } catch {
        toast('Launch failed', 'error')
      }
      setLaunchConfig(null)
    },
    [toast],
  )

  const handleLaunchEmbedded = useCallback(
    async (agentId: string, cwd: string) => {
      try {
        const cfg = allConfigs.find(c => c.id === agentId)
        const ptyId = await window.pty.create(cwd, 'claude', [
          '--model', cfg?.model || 'opus',
          '--permission-mode', cfg?.autonomy || 'default',
        ])
        setTerminal({ ptyId, title: cfg?.name ?? agentId })
        toast('Agent terminal opened', 'success')
      } catch {
        toast('Failed to open terminal', 'error')
      }
      setLaunchConfig(null)
    },
    [allConfigs, toast],
  )

  const handleTypeSelected = useCallback((cfg: AgentConfig) => {
    setShowTypePicker(false)
    setLaunchConfig(cfg)
  }, [])

  // Fix 9: Open pod status modal by workflow ID
  const handleViewPod = useCallback((workflowId: string) => {
    const wf = podWorkflows?.find(w => w.id === workflowId)
    if (wf) setViewingPod(wf)
  }, [podWorkflows])

  const handleOverride = useCallback(async (workflowId: string, phase: string, override: { model?: string; timeoutMultiplier?: number }) => {
    await window.api.overridePod(workflowId, phase, override)
    toast(`Override set for ${phase} phase`, 'success')
  }, [toast])

  const handleShare = useCallback(async (source: AgentState, target: AgentState) => {
    if (!target.tty || !source.lastAssistantBlurb) return
    const msg = `Context shared from ${source.config.name}:\n\n${source.lastAssistantBlurb}`
    try {
      await window.api.sendToSession(target.tty, msg)
      toast(`Shared to ${target.config.name}`, 'success')
    } catch {
      toast('Failed to share', 'error')
    }
    setShareSource(null)
  }, [toast])

  const runOfficeSmokeCheck = useCallback(async () => {
    if (smokeCheckRunning) return
    setSmokeCheckRunning(true)
    try {
      const scene = sceneRef.current
      if (!scene) {
        toast('Lab smoke failed: scene unavailable', 'error')
        return
      }

      const before = scene.getDebugSnapshot()
      const issues: string[] = []
      const liveAgents = agentStatuses ?? []
      const expectedDesks = liveAgents.length + (opencodeSessions?.length ?? 0)

      if (!before.ready) issues.push('scene not ready')
      if (expectedDesks > 0 && before.workstationCount === 0) issues.push('no desks rendered')
      if (expectedDesks > 0 && before.workstationCount < expectedDesks) {
        issues.push(`desks ${before.workstationCount}/${expectedDesks}`)
      }

      const hasFocusableAgent = liveAgents.some(a =>
        isCursorState(a) ||
        !!a.tty ||
        allConfigs.some(cfg => cfg.id === a.config.id) ||
        !!a.config.name,
      )
      if (liveAgents.length > 0 && !hasFocusableAgent) {
        issues.push('no focus route candidates')
      }

      await new Promise(resolve => setTimeout(resolve, 320))
      const after = scene.getDebugSnapshot()
      const drift = Math.hypot(
        after.camera.scrollX - before.camera.scrollX,
        after.camera.scrollY - before.camera.scrollY,
      )
      if (drift > 2) issues.push(`camera drift ${drift.toFixed(1)}px`)
      if (Math.abs(after.camera.zoom - before.camera.zoom) > 0.02) {
        issues.push('camera zoom changed')
      }

      if (issues.length > 0) {
        toast(`Lab smoke failed: ${issues.join(' | ')}`, 'error')
      } else {
        toast(`Lab smoke ok: ${before.roomCount} rooms, ${before.workstationCount} desks`, 'success')
      }
    } catch {
      toast('Lab smoke failed unexpectedly', 'error')
    } finally {
      setSmokeCheckRunning(false)
    }
  }, [agentStatuses, allConfigs, isCursorState, opencodeSessions, smokeCheckRunning, toast])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-[var(--c-bg-deep)] text-[#c8d0e0] select-none overflow-hidden">

      {/* ------------------------------------------------------------------ */}
      {/* Status Bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="office-status-hud flex-none flex items-center justify-between gap-3 px-4 py-2.5 backdrop-blur-[2px]">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div
            className="flex items-center gap-2.5 min-w-0 pl-2 pr-3 py-1 rounded-xl bg-[color-mix(in_srgb,var(--c-bg-surface)_75%,transparent)] border border-[color-mix(in_srgb,var(--c-border-subtle)_90%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            title="Lab workspace"
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--c-accent)_90%,transparent)] shrink-0 hidden sm:inline">
              Lab
            </span>
            <span className="hidden sm:block w-px h-3.5 bg-[color-mix(in_srgb,var(--c-border)_80%,transparent)] shrink-0" aria-hidden />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] text-[var(--c-text-dim)]">Agents</span>
              <span className="text-[13px] font-semibold tabular-nums text-[var(--c-accent-blue)] drop-shadow-[0_0_12px_rgba(0,229,255,0.25)]">
                {activeAgentCount}/{agents.length}
              </span>
              <span
                className="text-[10px] text-[var(--c-text-faint)] font-mono truncate"
                title={`Claude ${claudeAgentCount} | Cursor ${cursorAgentCount} | OpenCode/Claw ${externalCliAgentCount}`}
              >
                C{claudeAgentCount} Cu{cursorAgentCount} X{externalCliAgentCount}
              </span>
            </div>
          </div>

          <span
            className="text-[13px] font-mono tabular-nums text-[#9aacbc] px-2.5 py-1 rounded-lg bg-[linear-gradient(180deg,rgba(12,18,26,0.95)_0%,rgba(8,12,18,0.98)_100%)] border border-[color-mix(in_srgb,var(--c-border)_55%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
            aria-label={`Local time ${clock}`}
          >
            {clock}
          </span>

          {health?.overall === 'down' && (
            <span
              className="flex items-center gap-2 text-[11px] text-red-300 px-2 py-0.5 rounded-lg border border-red-500/25 bg-red-500/10"
              title="Infrastructure health check reports a failure"
            >
              <span className="h-2 w-2 rounded-full shrink-0 bg-red-400" />
              <span className="hidden md:inline font-medium">Down</span>
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {schedulerJobs && schedulerJobs.length > 0 && (
            <button
              type="button"
              onClick={props.onOpenScheduler}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)] ${
                failedJobs.length > 0
                  ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                  : 'bg-[color-mix(in_srgb,var(--c-accent-blue)_10%,transparent)] border-[color-mix(in_srgb,var(--c-accent-blue)_22%,transparent)] text-[color-mix(in_srgb,var(--c-accent-blue)_85%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-accent-blue)_18%,transparent)]'
              }`}
            >
              {failedJobs.length > 0 ? (
                <span>{failedJobs.length} failed</span>
              ) : (
                <span>{enabledJobs.length} jobs ok</span>
              )}
            </button>
          )}

          {/* Fleet pill */}
          {fleetStatus && (() => {
            const online = fleetStatus.instances.filter(i => !i.stale).length
            const total = fleetStatus.instances.length
            const allHealthy = total === 0 || fleetStatus.instances.every(i => i.stale || i.health === 'healthy')
            return (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFleetPopover(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[13px] transition-colors ${
                    allHealthy
                      ? 'bg-[color-mix(in_srgb,var(--c-accent-blue)_10%,transparent)] border-[color-mix(in_srgb,var(--c-accent-blue)_22%,transparent)] text-[color-mix(in_srgb,var(--c-accent-blue)_85%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-accent-blue)_18%,transparent)]'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/18'
                  }`}
                >
                  <span className="text-[11px]">Fleet</span>
                  <span className="font-semibold tabular-nums">{online}/{total}</span>
                </button>
                {showFleetPopover && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFleetPopover(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--c-border)]">
                        <span className="text-[14px] font-semibold text-[var(--c-text-primary)]">Fleet Instances</span>
                      </div>
                      <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                        {fleetStatus.instances.map(inst => (
                          <div
                            key={inst.instanceId}
                            className={`px-3 py-2.5 rounded-lg ${inst.stale ? 'opacity-50' : 'bg-[var(--c-bg-elevated)]'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                inst.stale ? 'bg-[var(--c-border)]' :
                                inst.health === 'healthy' ? 'bg-emerald-400' :
                                inst.health === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
                              }`} />
                              <span className="text-[14px] font-medium text-[var(--c-text-heading)] truncate">
                                {inst.hostname}
                              </span>
                              {inst.isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--c-accent-blue)]/15 text-[var(--c-accent-blue)] border border-[var(--c-accent-blue)]/25">you</span>
                              )}
                              {inst.stale && (
                                <span className="text-[10px] text-amber-400 ml-auto">offline</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[12px] text-[var(--c-text-muted)]">
                              <span>{inst.sessions.total} agents ({inst.sessions.active} active)</span>
                              {inst.pods.active > 0 && <span className="text-blue-400">{inst.pods.active} pods</span>}
                            </div>
                            {inst.repos.length > 0 && (
                              <div className="text-[11px] text-[var(--c-text-faint)] mt-1 truncate">
                                {inst.repos.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                        {total === 0 && (
                          <div className="px-3 py-4 text-center text-[12px] text-[var(--c-text-faint)]">
                            {fleetStatus.debug ?? 'No instances found'}
                          </div>
                        )}
                      </div>
                      {fleetStatus.debug && (
                        <div className="px-4 py-2 border-t border-[var(--c-border)] text-[10px] text-[var(--c-text-faint)] font-mono">
                          {fleetStatus.debug}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          <button
            type="button"
            onClick={() => { void runOfficeSmokeCheck() }}
            disabled={smokeCheckRunning}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] text-[13px] transition-colors disabled:opacity-50 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)]"
          >
            {smokeCheckRunning ? 'Checking...' : 'Smoke'}
          </button>

          <ClaudeUsageIndicator />

          <button
            type="button"
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#d4a017]/10 hover:bg-[#d4a017]/18 border border-[#d4a017]/28 rounded-lg text-[#d4a017] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a017]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)]"
          >
            🏆
            Ranks
          </button>

          <button
            type="button"
            onClick={() => window.api.openDownloads()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)]"
          >
            <IconDownload />
            Downloads
          </button>

          <button
            type="button"
            onClick={async () => {
              const snap = await window.api.getConfigSnapshot().catch(() => null)
              if (snap) {
                setConfigData(snap)
                setShowConfig(true)
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-surface)]"
          >
            Config
          </button>
        </div>
      </div>

      {/* Connection issues banner */}
      {agentPollErrors >= 3 && (
        <div className="flex-none mx-2.5 mt-1 px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-700/30 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-amber-400">
            Connection issues — polling interval increased ({agentPollErrors} consecutive errors)
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main Content: Phaser Office + Agent Cards                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-2.5 pt-2">
        <div className="flex-1 min-h-0 relative overflow-hidden rounded-[14px]">
          {/* Void behind canvas — themed wash + faint texture */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.08]"
            style={{
              backgroundImage: uiTheme === 'light'
                ? 'linear-gradient(165deg, var(--c-bg-app) 0%, var(--c-bg-elevated) 45%, var(--c-bg-deep) 100%), url(light-1.jpg)'
                : 'linear-gradient(165deg, var(--c-bg-app) 0%, var(--c-bg-deep) 45%, var(--c-bg-surface) 100%), url(office-bg.jpg)',
            }}
          />
          <div
            ref={gameContainerRef}
            className="app-main-chrome absolute inset-0"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Embedded Terminal                                                   */}
      {/* ------------------------------------------------------------------ */}
      {terminal && (
        <div className="flex-none h-64 border-t border-[var(--c-bg-hover)] bg-[linear-gradient(180deg,var(--c-bg-deep)_0%,var(--c-bg-chrome)_100%)] shadow-[inset_0_1px_0_0_rgba(0,255,136,0.06)]">
          <Terminal
            ptyId={terminal.ptyId}
            title={terminal.title}
            onClose={() => {
              window.pty.destroy(terminal.ptyId)
              setTerminal(null)
            }}
          />
        </div>
      )}


      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                              */}
      {/* ------------------------------------------------------------------ */}
      {actionAgent && (() => {
        const live = agentStatuses?.find(a => a.config.id === actionAgent.config.id) ?? actionAgent
        return (
          <AgentActionPopup
            state={live}
            onSendMessage={msg => handleSendMessage(live, msg)}
            onApprove={choice => handleApprove(live, choice)}
            onFocusiTerm={() => handleFocusiTerm(live)}
            onClose={() => setActionAgent(null)}
          />
        )
      })()}

      {showTypePicker && (
        <TypePickerModal
          configs={allConfigs}
          onSelect={handleTypeSelected}
          onClose={() => setShowTypePicker(false)}
        />
      )}

      {launchConfig && (
        <LaunchModal
          config={launchConfig}
          onLaunch={handleLaunchAgent}
          onLaunchEmbedded={handleLaunchEmbedded}
          onClose={() => setLaunchConfig(null)}
        />
      )}

      {shareSource && (
        <SharePickerModal
          source={shareSource}
          agents={agents}
          onShare={target => handleShare(shareSource, target)}
          onClose={() => setShareSource(null)}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal
          agents={agentStatuses ?? []}
          xpData={xpData}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showConfig && configData && (
        <ConfigModal
          config={configData}
          onClose={() => setShowConfig(false)}
          onRefresh={async () => {
            const snap = await window.api.getConfigSnapshot().catch(() => null)
            if (snap) setConfigData(snap)
          }}
        />
      )}

      {showPodLauncher && (
        <PodLauncherModal
          presets={podPresets}
          agents={allConfigs}
          onLaunch={async (task, opts) => {
            try {
              const wf = await window.api.createPod(task, opts)
              setShowPodLauncher(false)
              setViewingPod(wf)
              toast('Pod workflow launched', 'success')
            } catch {
              toast('Failed to launch pod', 'error')
            }
          }}
          onClose={() => setShowPodLauncher(false)}
        />
      )}

      {showPodList && (
        <PodListModal
          onSelect={wf => {
            setShowPodList(false)
            setViewingPod(wf)
          }}
          onClose={() => setShowPodList(false)}
        />
      )}

      {viewingPod && (
        <PodStatusModal
          workflow={viewingPod}
          onPause={async (id) => {
            await window.api.pausePod(id)
            toast('Workflow paused', 'success')
          }}
          onResume={async (id) => {
            await window.api.resumePod(id)
            toast('Workflow resumed', 'success')
          }}
          onCancel={async (id) => {
            await window.api.cancelPod(id)
            toast('Workflow cancelled', 'success')
          }}
          onClose={() => setViewingPod(null)}
        />
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// QuickActionButton
// ---------------------------------------------------------------------------

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[color-mix(in_srgb,var(--c-bg-surface)_60%,transparent)] hover:bg-[var(--c-bg-elevated)] border border-[var(--c-border)] hover:border-[var(--c-border)] rounded-lg text-[var(--c-text-secondary)] hover:text-[var(--c-text-heading)] text-[13px] transition-all duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// MCP tool extraction helpers
// ---------------------------------------------------------------------------

/** Map of MCP server prefix → display label & color class */
const MCP_DISPLAY: Record<string, { label: string; color: string }> = {
  serena:   { label: 'Serena',   color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  context7:  { label: 'Context7', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  github:    { label: 'GitHub',   color: 'text-[var(--c-text-primary)] bg-[color-mix(in_srgb,var(--c-text-faint)_15%,transparent)] border-[color-mix(in_srgb,var(--c-text-faint)_25%,transparent)]' },
  Neon:      { label: 'Neon',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  magic:     { label: '21st',     color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  linear:    { label: 'Linear',   color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
}

const BUILTIN_DISPLAY: Record<string, { label: string; color: string }> = {
  Edit:  { label: 'Edit',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Write: { label: 'Write', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Bash:  { label: 'Bash',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  Read:  { label: 'Read',  color: 'text-[var(--c-text-secondary)] bg-[color-mix(in_srgb,var(--c-text-faint)_15%,transparent)] border-[color-mix(in_srgb,var(--c-text-faint)_25%,transparent)]' },
  Glob:  { label: 'Glob',  color: 'text-[var(--c-text-secondary)] bg-[color-mix(in_srgb,var(--c-text-faint)_15%,transparent)] border-[color-mix(in_srgb,var(--c-text-faint)_25%,transparent)]' },
  Grep:  { label: 'Grep',  color: 'text-[var(--c-text-secondary)] bg-[color-mix(in_srgb,var(--c-text-faint)_15%,transparent)] border-[color-mix(in_srgb,var(--c-text-faint)_25%,transparent)]' },
}

function extractAgentTools(allowedTools: string[]): { mcpServers: { label: string; color: string }[]; builtins: { label: string; color: string }[] } {
  const mcpServers: { label: string; color: string }[] = []
  const builtins: { label: string; color: string }[] = []
  const seenMcp = new Set<string>()
  const seenBuiltin = new Set<string>()

  for (const tool of allowedTools) {
    // MCP tools: mcp__<server>__*
    const mcpMatch = tool.match(/^mcp__([^_]+)__/)
    if (mcpMatch) {
      const server = mcpMatch[1]
      if (!seenMcp.has(server)) {
        seenMcp.add(server)
        const display = MCP_DISPLAY[server]
        mcpServers.push(display || { label: server, color: 'text-[var(--c-text-secondary)] bg-[color-mix(in_srgb,var(--c-text-faint)_15%,transparent)] border-[color-mix(in_srgb,var(--c-text-faint)_25%,transparent)]' })
      }
      continue
    }

    // Bash patterns: Bash(git:*), Bash(npm:*), etc.
    const bashMatch = tool.match(/^Bash\(([^:)]+)/)
    if (bashMatch) {
      if (!seenBuiltin.has('Bash')) {
        seenBuiltin.add('Bash')
        builtins.push(BUILTIN_DISPLAY['Bash'])
      }
      continue
    }

    // Direct builtins
    const baseName = tool.split('(')[0]
    if (BUILTIN_DISPLAY[baseName] && !seenBuiltin.has(baseName)) {
      seenBuiltin.add(baseName)
      builtins.push(BUILTIN_DISPLAY[baseName])
    }
  }

  return { mcpServers, builtins }
}

