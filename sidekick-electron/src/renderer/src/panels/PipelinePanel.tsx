import { usePolling } from '../hooks/usePolling'
import type { StageSummary, HotLead, TerritoryData } from '../types'

function scoreColor(score: number): string {
  if (score >= 50) return 'text-emerald-400'
  if (score >= 30) return 'text-amber-400'
  return 'text-slate-400'
}

export function PipelinePanel() {
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
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Sales Pipeline</h2>
        <p className="text-xs text-slate-500 mt-0.5">{totalLeads.toLocaleString()} total leads</p>
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
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
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
