import { useState, useEffect, useRef, useCallback } from 'react'
import { PanelBackground } from '../components/PanelBackground'

interface ScriptCard {
  id: string
  label: string
  description: string
  script: string
  needsDirectory?: boolean
  group: string
}

const SCRIPT_CARDS: ScriptCard[] = [
  // Knowledge Graph
  {
    id: 'etl',
    label: 'Rebuild Knowledge Graph',
    description: 'Parse vault, generate embeddings, push to Qdrant + Memgraph',
    script: 'etl',
    needsDirectory: true,
    group: 'Knowledge Graph',
  },
  {
    id: 'etl-clean',
    label: 'Clean Rebuild',
    description: 'Wipe all data and rebuild from scratch',
    script: 'etl:clean',
    needsDirectory: true,
    group: 'Knowledge Graph',
  },
  // Intelligence
  {
    id: 'ingest-all',
    label: 'Ingest News & Alerts',
    description: 'Pull Google Alerts + RSS feeds for all ventures',
    script: 'ingest:all',
    group: 'Intelligence',
  },
  {
    id: 'npi-enrich',
    label: 'Enrich NPI Leads',
    description: 'Firecrawl enrichment of practice websites',
    script: 'npi:enrich',
    group: 'Intelligence',
  },
  {
    id: 'npi-activate',
    label: 'Activate NPI Leads',
    description: 'Convert NPI Practice nodes to lead files',
    script: 'npi:activate',
    group: 'Intelligence',
  },
]

interface RunState {
  runId: string
  script: string
  status: 'running' | 'done' | 'error'
  lines: string[]
  exitCode?: number
  durationMs?: number
  startedAt: number
}

const MAX_LOG_LINES = 500

const GROUP_ICONS: Record<string, JSX.Element> = {
  'Knowledge Graph': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="4" cy="6" r="2" />
      <circle cx="20" cy="6" r="2" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="20" cy="18" r="2" />
      <line x1="6" y1="7" x2="10" y2="10" />
      <line x1="18" y1="7" x2="14" y2="10" />
      <line x1="6" y1="17" x2="10" y2="14" />
      <line x1="18" y1="17" x2="14" y2="14" />
    </svg>
  ),
  'Intelligence': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  'Briefing': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}m ${rs}s`
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function DataPanel() {
  const [runs, setRuns] = useState<Map<string, RunState>>(new Map())
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [selectedDirs, setSelectedDirs] = useState<Record<string, string>>({})
  const [briefingSchedule, setBriefingSchedule] = useState<{ cron: string; enabled: boolean } | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Load briefing schedule on mount
  useEffect(() => {
    window.api.getBriefingSchedule().then(setBriefingSchedule).catch(() => {})
  }, [])

  // Subscribe to script output/done events
  useEffect(() => {
    const offOutput = window.api.onScriptOutput((data) => {
      setRuns(prev => {
        const next = new Map(prev)
        const run = next.get(data.id)
        if (!run) return prev
        const lines = [...run.lines, data.line]
        if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES)
        next.set(data.id, { ...run, lines })
        return next
      })
    })

    const offDone = window.api.onScriptDone((data) => {
      setRuns(prev => {
        const next = new Map(prev)
        const run = next.get(data.id)
        if (!run) return prev
        next.set(data.id, {
          ...run,
          status: data.exitCode === 0 ? 'done' : 'error',
          exitCode: data.exitCode,
          durationMs: data.durationMs,
        })
        return next
      })
    })

    return () => { offOutput(); offDone() }
  }, [])

  // Auto-scroll log output
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [runs, expandedRun])

  const handleRun = useCallback(async (card: ScriptCard) => {
    const opts: { rootDir?: string } = {}
    if (card.needsDirectory && selectedDirs[card.id]) {
      opts.rootDir = selectedDirs[card.id]
    }
    try {
      const runId = await window.api.runDataScript(card.script, opts)
      const newRun: RunState = {
        runId,
        script: card.script,
        status: 'running',
        lines: [],
        startedAt: Date.now(),
      }
      setRuns(prev => new Map(prev).set(runId, newRun))
      setExpandedRun(runId)
    } catch (err) {
      // Script already running or other error — ignore
    }
  }, [selectedDirs])

  const handleCancel = useCallback((runId: string) => {
    window.api.cancelDataScript(runId)
  }, [])

  const handlePickDir = useCallback(async (cardId: string) => {
    const dir = await window.api.pickDirectory()
    if (dir) setSelectedDirs(prev => ({ ...prev, [cardId]: dir }))
  }, [])

  // Find active run for a card
  const getRunForCard = (card: ScriptCard): RunState | undefined => {
    for (const [, run] of runs) {
      if (run.script === card.script) return run
    }
    return undefined
  }

  // Group cards
  const groups = SCRIPT_CARDS.reduce<Record<string, ScriptCard[]>>((acc, card) => {
    ;(acc[card.group] ||= []).push(card)
    return acc
  }, {})

  const handleScheduleToggle = async () => {
    if (!briefingSchedule) return
    const next = { ...briefingSchedule, enabled: !briefingSchedule.enabled }
    await window.api.setBriefingSchedule(next.cron, next.enabled)
    setBriefingSchedule(next)
  }

  const handleCronChange = async (cron: string) => {
    if (!briefingSchedule) return
    const next = { ...briefingSchedule, cron }
    setBriefingSchedule(next)
    await window.api.setBriefingSchedule(next.cron, next.enabled)
  }

  return (
    <PanelBackground>
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-[#2a3440]">
        <h1 className="text-lg font-semibold text-slate-100">Data Pipeline</h1>
        <p className="text-xs text-[#5a6878] mt-0.5">Run ETL, ingestion, and enrichment scripts</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {Object.entries(groups).map(([groupName, cards]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#00ff88]">{GROUP_ICONS[groupName]}</span>
              <h2 className="text-sm font-medium text-[#8a96a4] uppercase tracking-wider">{groupName}</h2>
            </div>
            <div className="space-y-2">
              {cards.map(card => {
                const run = getRunForCard(card)
                const isRunning = run?.status === 'running'
                const isExpanded = expandedRun && run && expandedRun === run.runId

                return (
                  <div key={card.id} className="bg-[#0c1018]/90 border border-[#2a3440] rounded-lg overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Status indicator */}
                      <div className="shrink-0">
                        {isRunning ? (
                          <Spinner />
                        ) : run?.status === 'done' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : run?.status === 'error' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-[#2a3440]" />
                        )}
                      </div>

                      {/* Card info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200">{card.label}</div>
                        <div className="text-xs text-[#5a6878] mt-0.5">{card.description}</div>
                        {run?.durationMs != null && (
                          <div className="text-xs text-[#3a4858] mt-0.5">
                            Completed in {formatDuration(run.durationMs)}
                          </div>
                        )}
                      </div>

                      {/* Directory picker */}
                      {card.needsDirectory && (
                        <button
                          onClick={() => handlePickDir(card.id)}
                          className="shrink-0 text-xs text-[#5a6878] hover:text-[#00ff88] border border-[#2a3440] hover:border-[#00ff88]/30 rounded px-2 py-1 transition-colors"
                          title={selectedDirs[card.id] || 'Choose root directory'}
                        >
                          {selectedDirs[card.id]
                            ? selectedDirs[card.id].split('/').pop()
                            : 'Choose Dir'}
                        </button>
                      )}

                      {/* Action buttons */}
                      {isRunning ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => run && setExpandedRun(isExpanded ? null : run.runId)}
                            className="text-xs text-[#5a6878] hover:text-slate-300 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Logs'}
                          </button>
                          <button
                            onClick={() => run && handleCancel(run.runId)}
                            className="text-xs text-[#ff4444]/70 hover:text-[#ff4444] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {run && (
                            <button
                              onClick={() => setExpandedRun(isExpanded ? null : run.runId)}
                              className="text-xs text-[#5a6878] hover:text-slate-300 transition-colors"
                            >
                              {isExpanded ? 'Hide' : 'Logs'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRun(card)}
                            className="shrink-0 text-xs font-medium text-[#00ff88] bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/20 hover:border-[#00ff88]/40 rounded px-3 py-1.5 transition-colors"
                          >
                            Run
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Log output */}
                    {isExpanded && run && (
                      <div className="border-t border-[#2a3440] bg-[#060810]/90 px-4 py-2 max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-[#6a7888]">
                        {run.lines.length === 0 && run.status === 'running' && (
                          <div className="text-[#3a4858] italic">Waiting for output...</div>
                        )}
                        {run.lines.map((line, i) => (
                          <div key={i} className={line.includes('ERR') || line.includes('Error') ? 'text-[#ff4444]/80' : ''}>
                            {line}
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Briefing Schedule */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00ff88]">{GROUP_ICONS['Briefing']}</span>
            <h2 className="text-sm font-medium text-[#8a96a4] uppercase tracking-wider">Briefing</h2>
          </div>
          <div className="bg-[#0c1018]/90 border border-[#2a3440] rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">Configure Briefing Schedule</div>
                <div className="text-xs text-[#5a6878] mt-0.5">
                  Set when the daily intelligence briefing generates
                </div>
              </div>
              {briefingSchedule && (
                <button
                  onClick={handleScheduleToggle}
                  className={`shrink-0 w-10 h-5 rounded-full transition-colors relative ${
                    briefingSchedule.enabled ? 'bg-[#00ff88]/30' : 'bg-[#2a3440]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      briefingSchedule.enabled
                        ? 'left-5 bg-[#00ff88]'
                        : 'left-0.5 bg-[#5a6878]'
                    }`}
                  />
                </button>
              )}
            </div>
            {briefingSchedule && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-[#5a6878]">Cron:</label>
                <input
                  type="text"
                  value={briefingSchedule.cron}
                  onChange={(e) => handleCronChange(e.target.value)}
                  className="flex-1 bg-[#060810] border border-[#2a3440] rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-[#00ff88]/40"
                  placeholder="30 6 * * 1-5"
                />
                <span className="text-[10px] text-[#3a4858]">
                  {briefingSchedule.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PanelBackground>
  )
}
