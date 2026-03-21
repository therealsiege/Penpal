import { useState, useCallback, useEffect } from 'react'
import { usePolling } from '../hooks/usePolling'
import type { StageSummary, HotLead, TerritoryData, LeadSearchResult, LeadDetail } from '../types'

function scoreColor(score: number): string {
  if (score >= 50) return 'text-emerald-400'
  if (score >= 30) return 'text-amber-400'
  return 'text-slate-400'
}

function scoreBadge(score: number): string {
  if (score >= 50) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  if (score >= 30) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

// ── Lead Detail Drawer ──────────────────────────────────────────────────────

function LeadDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.api.getLeadDetail(name).then(d => {
      setLead(d)
      setLoading(false)
    })
  }, [name])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</h2>
            {lead && <p className="text-sm text-slate-500 dark:text-slate-400">{lead.company}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-6 w-2/3 rounded-md bg-slate-200 dark:bg-slate-800 animate-shimmer" />
            <div className="h-4 w-1/3 rounded-md bg-slate-200 dark:bg-slate-800 animate-shimmer" style={{ animationDelay: '0.1s' }} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" style={{ animationDelay: `${0.05 * i}s` }} />
              ))}
            </div>
            <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" style={{ animationDelay: '0.25s' }} />
          </div>
        ) : !lead ? (
          <div className="p-6 text-sm text-slate-500">Lead not found in graph.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Score & Stage */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full border text-sm font-mono font-semibold ${scoreBadge(lead.score)}`}>
                {lead.score}
              </span>
              {lead.stage && (
                <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 text-xs">
                  {lead.stage}
                </span>
              )}
              {lead.businessArm && (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs">
                  {lead.businessArm}
                </span>
              )}
            </div>

            {/* Properties */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Location', lead.location],
                ['EHR', lead.ehr],
                ['NPI', lead.npi],
                ['Phone', lead.phone],
                ['Specialty', lead.specialty],
                ['Source', lead.source],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
                  <div className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 truncate">{value}</div>
                </div>
              ))}
            </div>

            {lead.website && (
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Website</div>
                <div className="text-sm text-blue-500 dark:text-blue-400 mt-0.5 truncate">{lead.website}</div>
              </div>
            )}

            {/* Next Action */}
            {lead.nextAction && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                <div className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">Next Action</div>
                <div className="text-sm text-slate-800 dark:text-slate-200">{lead.nextAction}</div>
              </div>
            )}

            {/* Stage History */}
            {lead.stageHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Stage History</h3>
                <div className="space-y-1">
                  {lead.stageHistory.map((sh, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs">
                      <span className="text-slate-700 dark:text-slate-300">{sh.stage}</span>
                      <span className="text-slate-500">{sh.enteredAt ? new Date(sh.enteredAt).toLocaleDateString() : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {lead.events.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Events</h3>
                <div className="space-y-1.5">
                  {lead.events.map((ev, i) => (
                    <div key={i} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{ev.type}</span>
                        <span className="text-[10px] text-slate-500">{ev.date ? new Date(ev.date).toLocaleDateString() : ''}</span>
                      </div>
                      {ev.detail && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ev.detail}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Documents */}
            {lead.documents.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Related Documents</h3>
                <div className="space-y-1">
                  {lead.documents.map((doc, i) => (
                    <div key={i} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                      {doc.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export function PipelinePanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LeadSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selectedLead, setSelectedLead] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const results = await window.api.searchLeads(searchQuery.trim())
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const { data: stages, loading: loadingStages } = usePolling<StageSummary[]>(
    () => window.api.getPipelineSummary(),
    30000,
  )
  const { data: hotLeads, loading: loadingHot } = usePolling<HotLead[]>(
    () => window.api.getHotLeads(),
    30000,
  )
  const { data: territories } = usePolling<TerritoryData[]>(
    () => window.api.getTerritories(),
    60000,
  )

  if (loadingStages || loadingHot) {
    return (
      <div className="space-y-3 py-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-md bg-slate-800 animate-shimmer"
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    )
  }

  const totalLeads = stages?.reduce((sum, s) => sum + s.total, 0) || 0

  return (
    <div>
      {selectedLead && (
        <LeadDrawer name={selectedLead} onClose={() => setSelectedLead(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Sales Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">{totalLeads.toLocaleString()} total leads</p>
        </div>
      </div>

      {/* Lead Search */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search leads by name, company, or location..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          {searchResults !== null && (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery('') }}
              className="px-3 py-2 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {searchResults !== null && (
          <div className="mt-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                {searchResults.length} results for "{searchQuery}"
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 px-4 animate-card-enter">
                <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <p className="text-xs text-slate-500">No leads found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Arm</th>
                    <th className="text-right px-4 py-2 font-medium">Score</th>
                    <th className="text-left px-4 py-2 font-medium">Stage</th>
                    <th className="text-left px-4 py-2 font-medium">Location</th>
                    <th className="text-left px-4 py-2 font-medium">EHR</th>
                    <th className="text-left px-4 py-2 font-medium">Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((lead, i) => (
                    <tr
                      key={i}
                      className="stagger-item border-b border-slate-200/70 dark:border-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-100 cursor-pointer"
                      onClick={() => setSelectedLead(lead.name)}
                    >
                      <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium">{lead.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.businessArm}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-semibold animate-card-enter ${scoreBadge(lead.score)}`}>
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.stage || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.location || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.ehr || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 max-w-40 truncate">{lead.nextAction || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">By Stage</h3>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  <th className="text-left px-4 py-2 font-medium">Stage</th>
                  <th className="text-right px-4 py-2 font-medium">Count</th>
                  <th className="text-right px-4 py-2 font-medium">Avg Score</th>
                  <th className="text-left px-4 py-2 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {stages?.map(s => (
                  <tr key={s.stage} className="stagger-item border-b border-slate-200/70 dark:border-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{s.stage}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{s.total}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-semibold animate-card-enter ${scoreBadge(s.avgScore)}`}>
                        {s.avgScore}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {Object.entries(s.byArm).map(([arm, cnt]) => `${arm}: ${cnt}`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">By Territory</h3>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {!territories || territories.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 px-4 animate-card-enter">
                <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
                <p className="text-xs text-slate-500">No territory data.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                    <th className="text-left px-4 py-2 font-medium">Territory</th>
                    <th className="text-right px-4 py-2 font-medium">Leads</th>
                    <th className="text-right px-4 py-2 font-medium">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {territories.map(t => (
                    <tr key={t.territory} className="stagger-item border-b border-slate-200/70 dark:border-slate-800/50 hover:scale-[1.01] transition-all duration-150">
                      <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{t.territory}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.leads}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-semibold animate-card-enter ${scoreBadge(t.avgScore)}`}>
                          {t.avgScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Hot leads */}
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
        Hot Leads (score &gt;= 45)
      </h3>
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {!hotLeads || hotLeads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 px-4 animate-card-enter">
            <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
            </svg>
            <p className="text-xs text-slate-500">No hot leads.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Arm</th>
                <th className="text-right px-4 py-2 font-medium">Score</th>
                <th className="text-left px-4 py-2 font-medium">Stage</th>
                <th className="text-left px-4 py-2 font-medium">EHR</th>
                <th className="text-left px-4 py-2 font-medium">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {hotLeads.map((lead, i) => (
                <tr
                  key={i}
                  className="stagger-item border-b border-slate-200/70 dark:border-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-100 cursor-pointer"
                  onClick={() => setSelectedLead(lead.name)}
                >
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium">{lead.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.businessArm}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-semibold animate-card-enter ${scoreBadge(lead.score)}`}>
                      {lead.score}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.stage || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{lead.ehr || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 max-w-48 truncate">
                    {lead.nextAction || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
