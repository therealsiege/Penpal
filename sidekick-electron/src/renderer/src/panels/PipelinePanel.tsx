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
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-slate-950 border-l border-slate-800 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100 truncate">{name}</h2>
            {lead && <p className="text-sm text-slate-400">{lead.company}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-slate-500 hover:text-slate-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading lead details...</div>
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
                <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">
                  {lead.stage}
                </span>
              )}
              {lead.businessArm && (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">
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
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
                  <div className="text-sm text-slate-200 mt-0.5 truncate">{value}</div>
                </div>
              ))}
            </div>

            {lead.website && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Website</div>
                <div className="text-sm text-blue-400 mt-0.5 truncate">{lead.website}</div>
              </div>
            )}

            {/* Next Action */}
            {lead.nextAction && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Next Action</div>
                <div className="text-sm text-slate-200">{lead.nextAction}</div>
              </div>
            )}

            {/* Stage History */}
            {lead.stageHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Stage History</h3>
                <div className="space-y-1">
                  {lead.stageHistory.map((sh, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs">
                      <span className="text-slate-300">{sh.stage}</span>
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
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">{ev.type}</span>
                        <span className="text-[10px] text-slate-500">{ev.date ? new Date(ev.date).toLocaleDateString() : ''}</span>
                      </div>
                      {ev.detail && <p className="text-xs text-slate-400 mt-1">{ev.detail}</p>}
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
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300">
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
    return <div className="text-slate-500 text-sm">Loading pipeline data...</div>
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
            className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600"
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
              className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {searchResults !== null && (
          <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800">
              <span className="text-xs text-slate-500">
                {searchResults.length} results for "{searchQuery}"
              </span>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500 p-4">No leads found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs">
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
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => setSelectedLead(lead.name)}
                    >
                      <td className="px-4 py-2.5 text-slate-200 font-medium">{lead.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{lead.businessArm}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(lead.score)}`}>{lead.score}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{lead.stage || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{lead.location || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{lead.ehr || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 max-w-40 truncate">{lead.nextAction || '-'}</td>
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
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs">
                  <th className="text-left px-4 py-2 font-medium">Stage</th>
                  <th className="text-right px-4 py-2 font-medium">Count</th>
                  <th className="text-right px-4 py-2 font-medium">Avg Score</th>
                  <th className="text-left px-4 py-2 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {stages?.map(s => (
                  <tr key={s.stage} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-200">{s.stage}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{s.total}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(s.avgScore)}`}>
                      {s.avgScore}
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
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {!territories || territories.length === 0 ? (
              <p className="text-xs text-slate-500 p-4">No territory data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs">
                    <th className="text-left px-4 py-2 font-medium">Territory</th>
                    <th className="text-right px-4 py-2 font-medium">Leads</th>
                    <th className="text-right px-4 py-2 font-medium">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {territories.map(t => (
                    <tr key={t.territory} className="border-b border-slate-800/50">
                      <td className="px-4 py-2.5 text-slate-200">{t.territory}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.leads}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(t.avgScore)}`}>
                        {t.avgScore}
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
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {!hotLeads || hotLeads.length === 0 ? (
          <p className="text-xs text-slate-500 p-4">No hot leads.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs">
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
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                  onClick={() => setSelectedLead(lead.name)}
                >
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{lead.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{lead.businessArm}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(lead.score)}`}>
                    {lead.score}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{lead.stage || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{lead.ehr || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-48 truncate">
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
