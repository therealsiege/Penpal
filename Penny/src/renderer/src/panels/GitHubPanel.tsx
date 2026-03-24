import { useState, useEffect, useCallback } from 'react'
import type { GitHubIssueCard } from '../types'

interface PollerStatus {
  running: boolean
  repos: string[]
  seenCount: number
  lastPoll: number | null
  pollIntervalMs: number
}

const COLUMNS = [
  { key: 'queued', label: 'Queued', color: 'bg-slate-700', dot: 'bg-slate-400' },
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-900/40', dot: 'bg-blue-400' },
  { key: 'active', label: 'In Progress', color: 'bg-amber-900/40', dot: 'bg-amber-400' },
  { key: 'completed', label: 'Done', color: 'bg-emerald-900/40', dot: 'bg-emerald-400' },
  { key: 'failed', label: 'Failed', color: 'bg-red-900/40', dot: 'bg-red-400' },
]

function classifyCard(card: GitHubIssueCard): string {
  const s = card.taskStatus?.toLowerCase() || 'queued'
  if (s === 'completed' || s === 'done') return 'completed'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  if (s === 'active' || s === 'executing' || s === 'validating') return 'active'
  if (s === 'assigned' || s === 'planning') return 'assigned'
  return 'queued'
}

function priorityBadge(priority: string) {
  const p = priority?.toLowerCase() || 'normal'
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    normal: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    low: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[p] || colors.normal}`}>
      {p}
    </span>
  )
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function GitHubPanel() {
  const [cards, setCards] = useState<GitHubIssueCard[]>([])
  const [status, setStatus] = useState<PollerStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        window.api.githubIssueCards(),
        window.api.githubPollerStatus(),
      ])
      setCards(c || [])
      setStatus(s || null)
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const pollNow = async () => {
    try {
      await window.api.githubPollNow()
      setTimeout(refresh, 1500)
    } catch { /* */ }
  }

  const grouped = new Map<string, GitHubIssueCard[]>()
  for (const col of COLUMNS) grouped.set(col.key, [])
  for (const card of cards) {
    const col = classifyCard(card)
    grouped.get(col)?.push(card)
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <h1 className="text-xl font-semibold">GitHub Dispatch</h1>
            <span className="text-sm text-slate-500">{cards.length} issues</span>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {status.repos.join(', ') || 'No repos'}
              </div>
            )}
            <button
              onClick={pollNow}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition-colors"
            >
              Poll Now
            </button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <p className="text-sm">No GitHub issues tracked yet</p>
            <p className="text-xs text-slate-600">Issues from watched repos will appear here</p>
          </div>
        ) : (
          <div className="flex gap-3 h-full min-w-max">
            {COLUMNS.map(col => {
              const colCards = grouped.get(col.key) || []
              return (
                <div key={col.key} className="w-64 flex flex-col shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-medium text-slate-300">{col.label}</span>
                    <span className="text-xs text-slate-500 ml-auto">{colCards.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 px-1">
                    {colCards.map(card => (
                      <button
                        key={card.taskId}
                        onClick={() => card.url && window.open(card.url, '_blank')}
                        className={`w-full text-left p-3 rounded-lg border border-slate-700/40 ${col.color} hover:border-slate-600/60 transition-colors cursor-pointer`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs text-slate-500 font-mono">#{card.issueNumber}</span>
                          {priorityBadge(card.priority)}
                        </div>
                        <p className="text-sm text-slate-200 leading-snug mb-2 line-clamp-2">{card.title}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[120px]">{card.repo}</span>
                          <span>{timeAgo(card.ingestedAt)}</span>
                        </div>
                        {card.assignedAgent && (
                          <div className="mt-1.5 text-[11px] text-blue-400 truncate">
                            {card.assignedAgent}
                          </div>
                        )}
                      </button>
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
