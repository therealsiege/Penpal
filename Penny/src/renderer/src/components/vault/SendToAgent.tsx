import { useState, useEffect, useRef } from 'react'
import type { AgentState, SystemPaths } from '../../types'
import { useToast } from '../Toast'
import { getPathPresets } from '../../utils/path-presets'

interface SendToAgentProps {
  selectedFiles: Set<string>
}

export function SendToAgent({ selectedFiles }: SendToAgentProps) {
  const [open, setOpen] = useState(false)
  const [agents, setAgents] = useState<AgentState[]>([])
  const [sending, setSending] = useState(false)
  const [systemPaths, setSystemPaths] = useState<SystemPaths | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    window.api.getAgentStatuses().then(setAgents).catch(() => {})
  }, [open])

  useEffect(() => {
    let cancelled = false
    window.api.getSystemPaths()
      .then(paths => {
        if (!cancelled) setSystemPaths(paths)
      })
      .catch(() => {
        // Keep fallback behavior if IPC call fails.
      })
    return () => { cancelled = true }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSend = async (agent: AgentState) => {
    if (!agent.tty || selectedFiles.size === 0) return
    setSending(true)

    let pathsConfig = systemPaths
    if (!pathsConfig) {
      try {
        pathsConfig = await window.api.getSystemPaths()
        setSystemPaths(pathsConfig)
      } catch {
        pathsConfig = null
      }
    }
    const presets = getPathPresets(pathsConfig)
    const filePaths = [...selectedFiles].map(p => `${presets.sidekickRoot.replace(/\/$/, '')}/${p}`)
    const message = `Read and use these files for context:\n${filePaths.join('\n')}`

    try {
      await window.api.sendToSession(agent.tty, message)
      toast(`${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} sent to ${agent.config.name}`, 'success')
      setOpen(false)
    } catch (err) {
      toast(`Failed to send to ${agent.config.name}`, 'error')
    }
    setSending(false)
  }

  const activeAgents = agents.filter(a => a.tty)

  if (selectedFiles.size === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={sending}
        className="px-3 py-1.5 bg-blue-600/20 border border-blue-600/40 text-blue-300 rounded text-xs hover:bg-blue-600/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        Send to Agent
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-64 bg-[#0c1018] border border-[#2a3440]/50 rounded shadow-xl z-50 max-h-64 overflow-y-auto">
          {activeAgents.length === 0 && (
            <div className="px-3 py-2 text-xs text-[#2a3440]">No agents with active sessions</div>
          )}
          {activeAgents.map(agent => (
            <button
              key={agent.config.id}
              onClick={() => handleSend(agent)}
              disabled={sending}
              className="w-full text-left px-3 py-2 hover:bg-[#141a22]/60 transition-colors flex items-center gap-2"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                agent.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#8a96a4] truncate">{agent.config.name}</div>
                <div className="text-[10px] text-[#2a3440] truncate">{agent.cwd?.split('/').pop()}</div>
              </div>
              <span className="text-[10px] text-[#2a3440] shrink-0">{agent.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
