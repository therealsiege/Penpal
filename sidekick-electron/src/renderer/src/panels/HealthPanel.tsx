import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import type { HealthResult, GraphStats } from '../types'

const OVERALL_STYLES = {
  healthy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  degraded: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  down: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
}

const INFRA_NAMES: Record<string, string> = {
  memgraph: 'Memgraph',
  qdrant: 'Qdrant',
  docker: 'Docker',
  openai_key: 'OpenAI',
  anthropic_key: 'Anthropic',
  firecrawl_key: 'Firecrawl',
}

export function HealthPanel() {
  const { data, loading, error, refresh } = usePolling<HealthResult>(
    () => window.api.getHealth(),
    30000,
  )
  const { data: graphStats } = usePolling<GraphStats>(
    () => window.api.getGraphStats(),
    60000,
  )

  if (loading) {
    return <div className="text-slate-500 text-sm">Checking infrastructure...</div>
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400 text-sm">Health check failed: {error}</p>
      </div>
    )
  }

  if (!data) return null

  const style = OVERALL_STYLES[data.overall]
  const infraChecks = data.checks.filter(c => ['memgraph', 'qdrant', 'docker'].includes(c.name))
  const keyChecks = data.checks.filter(c => !['memgraph', 'qdrant', 'docker'].includes(c.name))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Infrastructure Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Last checked {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`rounded-lg border p-4 mb-6 ${style.bg}`}>
        <span className={`text-sm font-medium ${style.color}`}>
          System {data.overall.toUpperCase()}
        </span>
        <span className="text-xs text-slate-500 ml-3">
          {data.checks.filter(c => c.status === 'ok').length}/{data.checks.length} checks passing
        </span>
      </div>

      {/* Infrastructure services */}
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Services</h3>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {infraChecks.map(check => (
          <div key={check.name} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{INFRA_NAMES[check.name] || check.name}</span>
              <StatusBadge status={check.status} size="md" />
            </div>
            <p className="text-xs text-slate-400">{check.message || '-'}</p>
            {check.latency_ms > 0 && (
              <p className="text-[10px] text-slate-600 mt-1">{check.latency_ms}ms</p>
            )}
          </div>
        ))}
      </div>

      {/* API Keys */}
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">API Keys</h3>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {keyChecks.map(check => (
          <div key={check.name} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{INFRA_NAMES[check.name] || check.name}</span>
              <StatusBadge status={check.status} label={check.message} />
            </div>
          </div>
        ))}
      </div>

      {/* Knowledge Graph Stats */}
      {graphStats && (
        <>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            Knowledge Graph
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-white">{graphStats.totalNodes.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 uppercase">Nodes</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-white">{graphStats.totalRelationships.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 uppercase">Relationships</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase mb-2">Nodes by Type</p>
              <div className="space-y-1">
                {Object.entries(graphStats.nodesByLabel)
                  .slice(0, 10)
                  .map(([label, count]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-300 font-mono">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase mb-2">Top Relationships</p>
              <div className="space-y-1">
                {Object.entries(graphStats.relsByType)
                  .slice(0, 10)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-slate-400">{type}</span>
                      <span className="text-slate-300 font-mono">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
