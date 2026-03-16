import { useState, useEffect, useRef } from 'react'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import type { ClaudeSession, ConversationMessage } from '../types'

function memColor(mb: number): string {
  if (mb >= 900) return 'text-amber-400'
  if (mb >= 500) return 'text-slate-200'
  return 'text-slate-400'
}

function cpuColor(cpu: string): string {
  const val = parseFloat(cpu)
  if (val >= 10) return 'text-emerald-400'
  if (val >= 1) return 'text-blue-400'
  return 'text-slate-500'
}

// ── Chat View ───────────────────────────────────────────────────────────────

function SessionChat({
  session,
  onBack,
}: {
  session: ClaudeSession
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversation = async () => {
    const msgs = await window.api.getSessionConversation(session.sessionId)
    setMessages(msgs)
    setLoading(false)
  }

  useEffect(() => {
    loadConversation()
    const id = setInterval(loadConversation, 5000)
    return () => clearInterval(id)
  }, [session.sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const msg = input.trim()
    setInput('')
    setSending(true)
    try {
      await window.api.sendToSession(session.tty, msg)
      // Optimistically add the message
      setMessages(prev => [...prev, { role: 'user', text: msg }])
    } finally {
      setSending(false)
    }
  }

  const handleFocus = async () => {
    await window.api.focusSession(session.tty)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400"
          >
            Back
          </button>
          <div>
            <h2 className="text-lg font-semibold">{session.project}</h2>
            <p className="text-[11px] text-slate-500">
              {session.terminalName || session.cwd}
              <span className="ml-2 text-slate-600">PID {session.pid}</span>
            </p>
          </div>
        </div>
        <button
          onClick={handleFocus}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors"
        >
          Open in Terminal
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100'
                    : 'bg-slate-800 border border-slate-700 text-slate-300'
                }`}
              >
                <p className={`text-[9px] font-medium mb-1 ${
                  msg.role === 'user' ? 'text-blue-400' : 'text-slate-500'
                }`}>
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </p>
                <p className="leading-relaxed">
                  {msg.text.length > 2000 ? msg.text.slice(0, 2000) + '...' : msg.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="Send a message to this Claude session..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors disabled:opacity-40"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── New Session Dialog ──────────────────────────────────────────────────────

function NewSessionDialog({ onClose }: { onClose: () => void }) {
  const [cwd, setCwd] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const presets = [
    { label: 'sidekick', path: '/Users/fuzeelogik/sidekick' },
    { label: 'medscrub', path: '/Users/fuzeelogik/ComSci/Workspace/1putthealth/medscrub' },
    { label: 'medhook', path: '/Users/fuzeelogik/ComSci/Workspace/1putthealth/medhook' },
    { label: '1putthealth.com', path: '/Users/fuzeelogik/ComSci/Workspace/1putthealth/1putthealth.com' },
    { label: 'atlas', path: '/Users/fuzeelogik/ComSci/Workspace/graphiteatlas/atlas' },
    { label: 'givingprints', path: '/Users/fuzeelogik/ComSci/Workspace/givingprints' },
    { label: 'espiral', path: '/Users/fuzeelogik/ComSci/Workspace/espiral.healthcare' },
  ]

  const handleCreate = async () => {
    if (!cwd.trim()) return
    setCreating(true)
    setError(null)
    try {
      const result = await window.api.createNewSession(cwd.trim())
      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Failed to create session')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">New Claude Session</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">
          Cancel
        </button>
      </div>

      {/* Preset project buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => setCwd(p.path)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              cwd === p.path
                ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom path */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Or enter a custom path..."
          value={cwd}
          onChange={e => setCwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 font-mono text-xs"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !cwd.trim()}
          className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors disabled:opacity-40"
        >
          {creating ? 'Creating...' : 'Launch'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

// ── Sessions List ───────────────────────────────────────────────────────────

export function SessionsPanel() {
  const { data: sessions, loading, refresh } = usePolling<ClaudeSession[]>(
    () => window.api.getClaudeSessions(),
    10000,
  )

  const [activeSession, setActiveSession] = useState<ClaudeSession | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)

  // If viewing a chat, show the chat view
  if (activeSession) {
    return (
      <SessionChat
        session={activeSession}
        onBack={() => setActiveSession(null)}
      />
    )
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Scanning for Claude sessions...</div>
  }

  const totalMem = sessions?.reduce((sum, s) => sum + s.memoryMB, 0) || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Claude Sessions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {sessions?.length || 0} active
            {totalMem > 0 && <span className="ml-2">({(totalMem / 1024).toFixed(1)} GB)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewSession(!showNewSession)}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
          >
            New Session
          </button>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {showNewSession && <NewSessionDialog onClose={() => setShowNewSession(false)} />}

      {!sessions || sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center">
          <p className="text-slate-500 text-sm">No active Claude sessions found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <div
              key={session.pid}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors cursor-pointer"
              onClick={() => setActiveSession(session)}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-3">
                  <StatusBadge status="ok" size="md" />
                  <span className="text-sm font-semibold text-white">{session.project}</span>
                  <span className="text-[10px] text-slate-600 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                    PID {session.pid}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500">{session.uptime}</span>
                  <span className={cpuColor(session.cpu)}>CPU {session.cpu}</span>
                  <span className={memColor(session.memoryMB)}>{session.memoryMB} MB</span>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      window.api.focusSession(session.tty)
                    }}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400"
                  >
                    Focus
                  </button>
                </div>
              </div>

              {/* Terminal name from iTerm2 */}
              {session.terminalName && (
                <div className="text-[11px] text-blue-400/70 mb-1 truncate">
                  {session.terminalName}
                </div>
              )}

              {/* CWD */}
              <div className="text-[11px] text-slate-600 font-mono truncate">
                {session.cwd}
              </div>

              {/* Last message */}
              {session.lastUserMessage && (
                <div className="bg-slate-800/50 rounded px-3 py-2 mt-2">
                  <p className="text-[10px] text-slate-600 mb-0.5">Last prompt</p>
                  <p className="text-xs text-slate-300 leading-relaxed truncate">
                    {session.lastUserMessage}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {sessions && sessions.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{sessions.length}</p>
            <p className="text-[10px] text-slate-500 uppercase">Sessions</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{(totalMem / 1024).toFixed(1)} GB</p>
            <p className="text-[10px] text-slate-500 uppercase">Memory</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">
              {new Set(sessions.map(s => s.project)).size}
            </p>
            <p className="text-[10px] text-slate-500 uppercase">Projects</p>
          </div>
        </div>
      )}
    </div>
  )
}
