import { useState, useEffect, useRef, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { AgentAvatar } from '../components/AgentAvatar'
import { useToast } from '../components/Toast'
import { Terminal } from '../components/Terminal'
import type { AgentConfig, AgentState, HealthResult, HotLead, JobStatus, TripletWorkflow, TripletPreset, ProjectLeaderboardEntry } from '../types'
import { TripletLauncherModal, TripletStatusModal, TripletListModal } from '../components/TripletModal'
import { OrchestratorModal } from '../components/OrchestratorModal'
import { createOfficeGame } from '../game/OfficeGame'
import { OfficeScene } from '../game/OfficeScene'
import { EventBus, EVENTS } from '../game/events'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[400px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-bold text-white">{state.config.name}</h3>
            {state.config.title && state.config.title !== state.config.name && (
              <p className="text-[11px] text-slate-500 mt-0.5">{state.config.title}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {state.cwd && (
                <span className="text-[13px] text-blue-400/70 font-mono">
                  {state.cwd.split('/').pop()}
                </span>
              )}
              {state.sessionMode && state.sessionMode !== 'idle' && (
                <span className="text-[13px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {state.sessionMode}
                </span>
              )}
              {state.config.tripletRole && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  state.config.tripletRole === 'solver' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                  state.config.tripletRole === 'reviewer' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                  'text-orange-400 bg-orange-500/10 border-orange-500/20'
                }`}>
                  {state.config.tripletRole === 'solver' ? '\u{1F527}' : state.config.tripletRole === 'reviewer' ? '\u{1F50D}' : '\u{25B6}'} {state.config.tripletRole}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg"
          >
            x
          </button>
        </div>

        {/* Persona info — Fix 10: includes backstory */}
        {state.config.persona && (
          <div className="bg-slate-800/30 rounded-lg px-3 py-2 mb-3 border border-slate-700/30">
            <p className="text-[11px] text-slate-400 italic leading-relaxed">
              &ldquo;{state.config.persona.catchphrase}&rdquo;
            </p>
            <p className="text-[10px] text-slate-600 mt-1">{state.config.persona.style}</p>
            {state.config.persona.backstory && (
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
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

        {/* MCP Tools & Builtins */}
        {state.config.allowedTools.length > 0 && (() => {
          const { mcpServers, builtins } = extractAgentTools(state.config.allowedTools)
          return (mcpServers.length > 0 || builtins.length > 0) ? (
            <div className="bg-slate-800/30 rounded-lg px-3 py-2 mb-3 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Toolbelt</p>
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
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 mb-3 border border-slate-700/50">
            <p className="text-[13px] text-slate-500 uppercase mb-0.5">Currently</p>
            <p className="text-[13px] text-slate-300">{state.lastAssistantBlurb}</p>
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
                <p className="text-[13px] text-slate-500 uppercase font-medium mb-1.5">
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
                className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 font-mono"
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
                <p className="text-[13px] text-slate-500 uppercase font-medium mb-1.5">Quick Response</p>
                <div className="flex gap-1.5">
                  {['1', '2', '3', '4', '5'].map(n => (
                    <button
                      key={n}
                      onClick={() => onSendMessage(n)}
                      className="w-9 h-9 text-[13px] font-bold bg-slate-800 hover:bg-blue-900/40 border border-slate-700 rounded-md text-slate-300 transition-colors"
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
                  className="flex-1 px-3 py-1.5 text-[13px] bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-300 transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[520px] shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-white">Hire Worker</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Choose a role</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">
            x
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {configs.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="text-left p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-colors group"
            >
              <p className="text-[13px] font-semibold text-slate-200 group-hover:text-white">{c.name}</p>
              <p className="text-[13px] text-slate-500 mt-0.5">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[420px] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-white">{config.name}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {config.model} / {config.mcpProfile}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">
            x
          </button>
        </div>
        <p className="text-[13px] text-slate-500 uppercase font-medium mb-2">Working Directory</p>
        {repos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {repos.map(r => (
              <button
                key={r}
                onClick={() => {
                  setCwd(r)
                  setCustom('')
                }}
                className={`px-2.5 py-1 text-[13px] rounded-md border transition-colors ${
                  cwd === r && !custom
                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
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
            className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 font-mono"
          />
          <button
            onClick={async () => {
              const picked = await window.api.pickDirectory()
              if (picked) {
                setCustom(picked)
                setCwd(picked)
              }
            }}
            className="flex-none px-3 py-2 text-[13px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-300 transition-colors"
          >
            Browse...
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400 transition-colors"
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
  return { color: 'bg-slate-500', pulse: false }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-white">Share from {source.config.name}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Send last output to another agent</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">x</button>
        </div>
        {!source.lastAssistantBlurb ? (
          <p className="text-[13px] text-slate-500 py-4 text-center">No output to share</p>
        ) : (
          <>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 mb-3 border border-slate-700/50">
              <p className="text-[13px] text-slate-500 uppercase mb-0.5">Sharing</p>
              <p className="text-[13px] text-slate-300 line-clamp-3">{source.lastAssistantBlurb}</p>
            </div>
            {targets.length === 0 ? (
              <p className="text-[13px] text-slate-500 py-4 text-center">No other agents available</p>
            ) : (
              <div className="flex flex-col gap-2">
                {targets.map(t => (
                  <button key={t.config.id} onClick={() => onShare(t)}
                    className="flex items-center gap-2 p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-colors text-left">
                    <span className={`w-2 h-2 rounded-full ${getStatusDot(t).color}`} />
                    <span className="text-[13px] text-slate-200">{t.config.name}</span>
                    {t.cwd && <span className="text-[13px] text-slate-500 ml-auto">{t.cwd.split('/').pop()}</span>}
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

function LeaderboardModal({ agents, onClose }: {
  agents: AgentState[]
  onClose: () => void
}) {
  const entries = buildProjectLeaderboard(agents)
  const totalMem = entries.reduce((s, e) => s + e.totalMemoryMB, 0)
  const totalCpu = entries.reduce((s, e) => s + e.totalCpu, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-[540px] shadow-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-white">Resource Leaderboard</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">x</button>
        </div>

        {/* Totals bar */}
        <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 text-[12px] text-slate-400">
          <span>{entries.length} project{entries.length !== 1 ? 's' : ''}</span>
          <span>{entries.reduce((s, e) => s + e.agentCount, 0)} agent{entries.reduce((s, e) => s + e.agentCount, 0) !== 1 ? 's' : ''}</span>
          <span>{totalMem.toLocaleString()} MB</span>
          <span>{totalCpu.toFixed(1)}% CPU</span>
        </div>

        {entries.length === 0 ? (
          <p className="text-[13px] text-slate-500 text-center py-8">No active sessions.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, idx) => {
              const memPct = totalMem > 0 ? (entry.totalMemoryMB / totalMem) * 100 : 0
              return (
                <div key={entry.directory} className={`p-3 rounded-lg border transition-all ${
                  idx === 0 ? 'bg-amber-900/15 border-amber-700/40' :
                  idx === 1 ? 'bg-slate-800/60 border-slate-600/40' :
                  idx === 2 ? 'bg-orange-900/10 border-orange-800/30' :
                  'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center font-bold shrink-0" style={{ fontFamily: 'Monogram, monospace' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-200 truncate">{entry.projectName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{entry.directory}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-amber-400">{entry.totalMemoryMB.toLocaleString()} MB</p>
                      <p className="text-[10px] text-slate-500">{entry.totalCpu.toFixed(1)}% CPU</p>
                    </div>
                  </div>

                  {/* Memory proportion bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${Math.max(memPct, 2)}%` }}
                    />
                  </div>

                  {/* Agent breakdown */}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {entry.agents.map((a, i) => (
                      <span key={i} className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        {a.name}
                        <span className="text-slate-600">{a.memoryMB}MB</span>
                        <span className="text-slate-600">{a.uptime}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
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

  // --- Polling ---
  const { data: agentStatuses } = usePolling<AgentState[]>(
    () => window.api.getAgentStatuses(),
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
  const [showTripletLauncher, setShowTripletLauncher] = useState(false)
  const [showOrchestrator, setShowOrchestrator] = useState(false)
  const [showTripletList, setShowTripletList] = useState(false)
  const [viewingTriplet, setViewingTriplet] = useState<TripletWorkflow | null>(null)
  const [tripletPresets, setTripletPresets] = useState<TripletPreset[]>([])

  // Load triplet presets once
  useEffect(() => {
    window.api.getTripletPresets().then(setTripletPresets).catch(() => {})
  }, [])

  // Poll triplet workflows for badge display (Fix 9)
  const { data: tripletWorkflows } = usePolling<TripletWorkflow[]>(
    () => window.api.listTriplets().catch(() => []),
    5000,
  )

  // --- Embedded terminal ---
  const [terminal, setTerminal] = useState<{ ptyId: string; title: string } | null>(null)

  // --- Phaser game ---
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const gameRef = useRef<any>(null)

  // --- Initialize Phaser game ---
  useEffect(() => {
    if (!gameContainerRef.current) return
    const { game, scene } = createOfficeGame(gameContainerRef.current)
    gameRef.current = game
    sceneRef.current = scene

    return () => {
      EventBus.removeAll()
      game.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  // --- Push agent data into Phaser scene ---
  useEffect(() => {
    if (sceneRef.current && agentStatuses) {
      sceneRef.current.setAgents(agentStatuses)
    }
  }, [agentStatuses])

  // --- Push triplet workflow data into Phaser scene for connecting lines (Fix 11) ---
  useEffect(() => {
    if (sceneRef.current && tripletWorkflows) {
      const activeWorkflows = tripletWorkflows
        .filter(wf => !['complete', 'failed'].includes(wf.status))
        .map(wf => ({
          workflowId: wf.id,
          solverAgentId: wf.solver.agentId,
          reviewerAgentId: wf.reviewer.agentId,
          executorAgentId: wf.executor.agentId,
          status: wf.status,
        }))
      sceneRef.current.setTripletWorkflows(activeWorkflows)
    }
  }, [tripletWorkflows])

  // --- Wire EventBus to React state ---
  useEffect(() => {
    const handleAgentClicked = (_id: unknown, state: unknown) => {
      const agentState = state as AgentState
      if (agentState.tty) {
        window.api.focusSession(agentState.tty).catch(() => {})
      }
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
  }, [])

  // --- Derived data ---
  const agents = agentStatuses ?? []

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
        if (state.tty) {
          await window.api.focusSession(state.tty)
        } else {
          await window.api.focusAgent(state.config.id)
        }
        setActionAgent(null)
      } catch {
        toast('Failed to focus', 'error')
      }
    },
    [toast],
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
          '--name', `agent:${agentId}`,
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

  // Fix 9: Open triplet status modal by workflow ID
  const handleViewTriplet = useCallback((workflowId: string) => {
    const wf = tripletWorkflows?.find(w => w.id === workflowId)
    if (wf) setViewingTriplet(wf)
  }, [tripletWorkflows])

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

  // --- Health dot ---
  const healthColor =
    health?.overall === 'healthy'
      ? 'bg-emerald-400'
      : health?.overall === 'degraded'
        ? 'bg-amber-400'
        : health?.overall === 'down'
          ? 'bg-red-400'
          : 'bg-slate-600'

  const healthLabel =
    health?.overall === 'healthy'
      ? 'Healthy'
      : health?.overall === 'degraded'
        ? 'Degraded'
        : health?.overall === 'down'
          ? 'Down'
          : 'Unknown'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 select-none overflow-hidden">

      {/* ------------------------------------------------------------------ */}
      {/* Status Bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-none flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 backdrop-blur">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Health dot */}
          <button
            onClick={props.onOpenHealth}
            className="flex items-center gap-1.5 group"
            title={`System ${healthLabel}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${healthColor} ${health?.overall === 'degraded' ? 'animate-pulse' : ''}`}
            />
            <span className="text-[13px] text-slate-400 group-hover:text-slate-200 transition-colors">
              {healthLabel}
            </span>
          </button>

          {/* Agent count */}
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-slate-500">Agents</span>
            <span className="text-[13px] font-semibold text-slate-300">
              {activeAgentCount}/{agents.length}
            </span>
          </div>

          {/* Clock */}
          <span
            className="text-[13px] font-mono text-slate-400"

          >
            {clock}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Hot leads pill */}
          {hotLeadCount > 0 && (
            <button
              onClick={props.onOpenPipeline}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              <span className="text-[13px] font-semibold">{hotLeadCount}</span>
              <span className="text-[13px]">hot leads</span>
            </button>
          )}

          {/* Jobs summary */}
          {schedulerJobs && schedulerJobs.length > 0 && (
            <button
              onClick={props.onOpenScheduler}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[13px] transition-colors ${
                failedJobs.length > 0
                  ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80 hover:bg-emerald-500/20'
              }`}
            >
              {failedJobs.length > 0 ? (
                <span>{failedJobs.length} failed</span>
              ) : (
                <span>{enabledJobs.length} jobs ok</span>
              )}
            </button>
          )}

          {/* Leaderboard button */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-md text-amber-400 text-[13px] transition-colors"
          >
            🏆
            Ranks
          </button>

          {/* Triplet buttons */}
          <button
            onClick={() => setShowTripletLauncher(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-emerald-400 text-[13px] transition-colors"
          >
            <IconPlus />
            Triplet
          </button>
          <button
            onClick={() => setShowTripletList(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-400 text-[13px] transition-colors"
          >
            Workflows
          </button>

          {/* Hire button */}
          <button
            onClick={() => setShowTypePicker(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-md text-blue-400 text-[13px] transition-colors"
          >
            <IconPlus />
            Hire
          </button>

          {/* Downloads button */}
          <button
            onClick={() => window.api.openDownloads()}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-400 text-[13px] transition-colors"
          >
            <IconDownload />
            Downloads
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main Content: Phaser Office + Agent Cards                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Phaser game canvas — takes all available space */}
        <div
          ref={gameContainerRef}
          className="flex-1"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Embedded Terminal                                                   */}
      {/* ------------------------------------------------------------------ */}
      {terminal && (
        <div className="flex-none h-64 border-t border-slate-800">
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
      {/* Quick Actions Bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-none border-t border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <QuickActionButton icon={<IconHeart />} label="Health" onClick={props.onOpenHealth} />
          <QuickActionButton icon={<IconClock />} label="Scheduler" onClick={props.onOpenScheduler} />
          <QuickActionButton icon={<IconFolder />} label="Ventures" onClick={props.onOpenVentures} />
          <QuickActionButton icon={<IconNewspaper />} label="Briefing" onClick={props.onOpenBriefing} />
          <QuickActionButton icon={<IconFunnel />} label="Pipeline" onClick={props.onOpenPipeline} />
          <QuickActionButton icon={<IconActivity />} label="Activity" onClick={props.onOpenActivity} />
          <QuickActionButton icon={<IconQueue />} label="Tasks" onClick={() => setShowOrchestrator(true)} />
        </div>
      </div>

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
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showTripletLauncher && (
        <TripletLauncherModal
          presets={tripletPresets}
          agents={allConfigs}
          onLaunch={async (task, opts) => {
            try {
              const wf = await window.api.createTriplet(task, opts)
              setShowTripletLauncher(false)
              setViewingTriplet(wf)
              toast('Triplet workflow launched', 'success')
            } catch {
              toast('Failed to launch triplet', 'error')
            }
          }}
          onClose={() => setShowTripletLauncher(false)}
        />
      )}

      {showTripletList && (
        <TripletListModal
          onSelect={wf => {
            setShowTripletList(false)
            setViewingTriplet(wf)
          }}
          onClose={() => setShowTripletList(false)}
        />
      )}

      {showOrchestrator && (
        <OrchestratorModal onClose={() => setShowOrchestrator(false)} />
      )}

      {viewingTriplet && (
        <TripletStatusModal
          workflow={viewingTriplet}
          onPause={async (id) => {
            await window.api.pauseTriplet(id)
            toast('Workflow paused', 'success')
          }}
          onResume={async (id) => {
            await window.api.resumeTriplet(id)
            toast('Workflow resumed', 'success')
          }}
          onCancel={async (id) => {
            await window.api.cancelTriplet(id)
            toast('Workflow cancelled', 'success')
          }}
          onClose={() => setViewingTriplet(null)}
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
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 text-[13px] transition-all duration-200"
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
  github:    { label: 'GitHub',   color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  Neon:      { label: 'Neon',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  magic:     { label: '21st',     color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  linear:    { label: 'Linear',   color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
}

const BUILTIN_DISPLAY: Record<string, { label: string; color: string }> = {
  Edit:  { label: 'Edit',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Write: { label: 'Write', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Bash:  { label: 'Bash',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  Read:  { label: 'Read',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  Glob:  { label: 'Glob',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  Grep:  { label: 'Grep',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
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
        mcpServers.push(display || { label: server, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' })
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

