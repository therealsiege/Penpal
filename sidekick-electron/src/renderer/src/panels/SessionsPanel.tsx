import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import type { ClaudeSession } from '../types'

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

export function SessionsPanel() {
  const { data: sessions, loading, refresh } = usePolling<ClaudeSession[]>(
    () => window.api.getClaudeSessions(),
    10000,
  )

  if (loading) {
    return <div className="text-slate-500 text-sm">Scanning for Claude sessions...</div>
  }

  const totalMem = sessions?.reduce((sum, s) => sum + s.memoryMB, 0) || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Claude Sessions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {sessions?.length || 0} active sessions
            {totalMem > 0 && <span className="ml-2">({(totalMem / 1024).toFixed(1)} GB total)</span>}
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center">
          <p className="text-slate-500 text-sm">No active Claude sessions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.pid}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
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
                </div>
              </div>

              {/* CWD */}
              <div className="text-[11px] text-slate-600 font-mono mb-2 truncate">
                {session.cwd}
              </div>

              {/* Last message */}
              {session.lastUserMessage && (
                <div className="bg-slate-800/50 rounded px-3 py-2 mt-2">
                  <p className="text-[10px] text-slate-600 mb-0.5">Last prompt</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {session.lastUserMessage}
                  </p>
                </div>
              )}

              {/* TTY badge */}
              {session.tty && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                    {session.tty}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {sessions && sessions.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
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
