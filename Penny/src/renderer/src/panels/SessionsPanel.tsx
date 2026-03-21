import { useState, useEffect, useRef } from 'react'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import type { ClaudeSession, ConversationMessage, SystemPaths } from '../types'
import { getPathPresets } from '../utils/path-presets'
import { EventBus, EVENTS } from '../game/events'

function memColor(mb: number): string {
  if (mb >= 900) return 'text-amber-400'
  if (mb >= 500) return 'text-slate-200'
  return 'text-slate-400'
}

function cpuBadge(cpu: string): { color: string; bg: string } {
  const val = parseFloat(cpu)
  if (val >= 10) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (val >= 1) return { color: 'text-blue-400', bg: 'bg-blue-500/10' }
  return { color: 'text-slate-500', bg: 'bg-slate-800' }
}

// ── Chat View ───────────────────────────────────────────────────────────────

const isCursorSession = (s: ClaudeSession) => s.source === 'cursor'

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
  const isCursor = isCursorSession(session)

  const loadConversation = async () => {
    const msgs = await window.api.getSessionConversation(session.sessionId, session.source)
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
      setMessages(prev => [...prev, { role: 'user', text: msg }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400"
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
          onClick={() => window.api.focusSession(session.tty)}
          className={`px-3 py-1.5 text-xs rounded-md text-white transition-colors ${
            isCursor ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          Focus Terminal
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
      {isCursor ? (
        <div className="mt-3 shrink-0 bg-slate-900/50 border border-slate-800 rounded-md px-3 py-2.5 text-center">
          <p className="text-xs text-slate-500">
            Cursor agent sessions are read-only.{' '}
            <button
              onClick={() => window.api.focusSession(session.tty)}
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Focus Terminal
            </button>
            {' '}to interact.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  )
}

// ── New Session Dialog ──────────────────────────────────────────────────────

function NewSessionDialog({ onClose }: { onClose: () => void }) {
  const [cwd, setCwd] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemPaths, setSystemPaths] = useState<SystemPaths | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.getSystemPaths()
      .then(paths => {
        if (!cancelled) setSystemPaths(paths)
      })
      .catch(() => {
        // Allow manual path entry if IPC call fails.
      })
    return () => { cancelled = true }
  }, [])

  const presetsRoots = getPathPresets(systemPaths)
  const presets = [
    { label: 'sidekick', path: presetsRoots.sidekickRoot },
    { label: 'medscrub', path: presetsRoots.medscrubRoot },
    { label: 'medhook', path: presetsRoots.medhookRoot },
    { label: '1putthealth.com', path: presetsRoots.onePuttWebRoot },
    { label: 'atlas', path: presetsRoots.atlasRoot },
    { label: 'givingprints', path: presetsRoots.givingPrintsRoot },
    { label: 'espiral', path: presetsRoots.eSpiralRoot },
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
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Cancel</button>
      </div>
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

// ── Session Card ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
}: {
  session: ClaudeSession
  onClick: () => void
}) {
  const cpu = cpuBadge(session.cpu)
  const isActive = parseFloat(session.cpu) >= 1
  const isCursor = isCursorSession(session)

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-slate-950/50 ${
        isCursor
          ? 'border-purple-500/30 hover:border-purple-500/50'
          : isActive
            ? 'border-blue-500/30 hover:border-blue-500/50'
            : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top: project + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={isActive ? 'ok' : 'none'} size="md" />
          <h3 className="text-sm font-bold text-white truncate">{session.project}</h3>
          {isCursor && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
              CURSOR
            </span>
          )}
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            window.api.focusSession(session.tty)
          }}
          className="shrink-0 px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400 transition-colors"
        >
          Focus
        </button>
      </div>

      {/* Terminal name / source label */}
      {(session.terminalName || isCursor) && (
        <p className={`text-[11px] truncate mb-2 -mt-1 ${isCursor ? 'text-purple-400/60' : 'text-blue-400/60'}`}>
          {isCursor ? 'Cursor Agent' : session.terminalName}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${cpu.bg} ${cpu.color}`}>
          CPU {session.cpu}
        </span>
        <span className={`text-[10px] ${memColor(session.memoryMB)}`}>
          {session.memoryMB} MB
        </span>
        <span className="text-[10px] text-slate-600 ml-auto">{session.uptime}</span>
      </div>

      {/* Last prompt */}
      {session.lastUserMessage ? (
        <div className="bg-slate-800/60 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-600 mb-0.5">Last prompt</p>
          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
            {session.lastUserMessage}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-600 italic">No recent messages</p>
        </div>
      )}
    </div>
  )
}

// ── Sessions Panel ──────────────────────────────────────────────────────────

function BroadcastBar() {
  const [message, setMessage] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const { toast } = useToast()

  const presets = [
    { label: 'Commit', msg: '/commit' },
    { label: 'Status', msg: 'what are you working on right now? give me a one-line summary' },
    { label: 'Pause', msg: 'pause what you are doing and wait for further instructions' },
  ]

  const handleBroadcast = async (msg: string) => {
    if (!msg.trim() || broadcasting) return
    setBroadcasting(true)
    try {
      const res = await window.api.broadcastToSessions(msg.trim())
      toast(
        `Sent to ${res.sent} session${res.sent !== 1 ? 's' : ''}${res.failed > 0 ? `, ${res.failed} failed` : ''}`,
        res.failed > 0 ? 'error' : 'success',
      )
      if (res.sent > 0) EventBus.emit(EVENTS.BROADCAST, msg.trim())
      setMessage('')
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-slate-500 uppercase font-medium">Broadcast</span>
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => handleBroadcast(p.msg)}
            disabled={broadcasting}
            className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400 transition-colors disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Send a message to all sessions..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBroadcast(message)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600"
        />
        <button
          onClick={() => handleBroadcast(message)}
          disabled={broadcasting || !message.trim()}
          className="px-3 py-1.5 text-[10px] bg-amber-600 hover:bg-amber-500 rounded-md text-white transition-colors disabled:opacity-40"
        >
          {broadcasting ? 'Sending...' : 'Send All'}
        </button>
      </div>
    </div>
  )
}

export function SessionsPanel() {
  const { data: sessions, loading, refresh } = usePolling<ClaudeSession[]>(
    () => window.api.getClaudeSessions(),
    10000,
  )

  const [activeSession, setActiveSession] = useState<ClaudeSession | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)

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
  const activeSessions = sessions?.filter(s => parseFloat(s.cpu) >= 1) || []
  const cursorCount = sessions?.filter(s => s.source === 'cursor').length || 0
  const claudeCount = (sessions?.length || 0) - cursorCount

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">AI Sessions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {sessions?.length || 0} sessions
            {claudeCount > 0 && cursorCount > 0 && (
              <span className="text-slate-600 ml-1">
                ({claudeCount} Claude, {cursorCount} Cursor)
              </span>
            )}
            {activeSessions.length > 0 && (
              <span className="text-emerald-400 ml-1">({activeSessions.length} active)</span>
            )}
            {totalMem > 0 && <span className="ml-2 text-slate-600">{(totalMem / 1024).toFixed(1)} GB</span>}
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

      {/* Broadcast bar */}
      {sessions && sessions.length > 1 && <BroadcastBar />}

      {/* Cards grid */}
      {!sessions || sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">No active Claude sessions found.</p>
          <button
            onClick={() => setShowNewSession(true)}
            className="mt-3 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
          >
            Launch one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sessions.map(session => (
            <SessionCard
              key={session.pid}
              session={session}
              onClick={() => setActiveSession(session)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
