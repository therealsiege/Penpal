import { useEffect, useRef, useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from './StatusBadge'
import type { HealthResult, GraphStats, SystemPaths } from '../types'
import { getPathPresets } from '../utils/path-presets'

const INFRA_NAMES: Record<string, string> = {
  memgraph: 'Memgraph',
  qdrant: 'Qdrant',
  docker: 'Docker',
  openai_key: 'OpenAI',
  anthropic_key: 'Anthropic',
  firecrawl_key: 'Firecrawl',
}

const OVERALL_STYLES = {
  healthy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  degraded: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  down: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
}

// Counts from 0 to `target` over `duration` ms using requestAnimationFrame.
function AnimatedNumber({ target, duration = 800 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplay(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return <>{display.toLocaleString()}</>
}

interface HealthModalProps {
  onClose: () => void
}

export function HealthModal({ onClose }: HealthModalProps) {
  const [systemPaths, setSystemPaths] = useState<SystemPaths | null>(null)
  const { data, loading, error, refresh } = usePolling<HealthResult>(
    () => window.api.getHealth(),
    30000,
  )
  const { data: graphStats } = usePolling<GraphStats>(
    () => window.api.getGraphStats(),
    60000,
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    window.api.getSystemPaths()
      .then(paths => {
        if (!cancelled) setSystemPaths(paths)
      })
      .catch(() => {
        // Fallback display path is handled below.
      })
    return () => { cancelled = true }
  }, [])

  const infraChecks = data?.checks.filter(c => ['memgraph', 'qdrant', 'docker'].includes(c.name)) || []
  const keyChecks = data?.checks.filter(c => !['memgraph', 'qdrant', 'docker'].includes(c.name)) || []
  const style = data ? OVERALL_STYLES[data.overall] : null
  const paths = getPathPresets(systemPaths)

  const dotAnimClass = data?.overall === 'healthy' ? 'animate-breathe-glow' : 'animate-pulse'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col animate-modal-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${style?.dot || 'bg-slate-400 dark:bg-slate-600'} ${data ? dotAnimClass : ''}`} />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">System Status</h2>
            {data && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${style?.bg} ${style?.color}`}>
                {data.overall.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {loading && <p className="text-slate-500 text-xs">Checking infrastructure...</p>}
          {error && <p className="text-red-500 dark:text-red-400 text-xs">Health check failed: {error}</p>}

          {data && (
            <>
              {/* Services */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Services</h3>
                <div className="space-y-1.5">
                  {infraChecks.map((check, index) => (
                    <div
                      key={check.name}
                      className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2 animate-card-enter"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={check.status} size="md" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{INFRA_NAMES[check.name] || check.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {check.latency_ms > 0 && (
                          <span className="text-xs text-slate-500 font-mono">{check.latency_ms}ms</span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">{check.message || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Keys */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">API Keys</h3>
                <div className="space-y-1.5">
                  {keyChecks.map((check, index) => (
                    <div
                      key={check.name}
                      className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2 animate-card-enter"
                      style={{ animationDelay: `${(infraChecks.length + index) * 50}ms` }}
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={check.status} size="md" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{INFRA_NAMES[check.name] || check.name}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{check.message || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Graph Stats */}
              {graphStats && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Knowledge Graph</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500">Nodes</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        <AnimatedNumber target={graphStats.totalNodes} />
                      </p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500">Relationships</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        <AnimatedNumber target={graphStats.totalRelationships} />
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Config */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Config</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">Vault</span>
                    <span className="text-xs text-slate-500 font-mono">{paths.sidekickRoot}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">Graph DB</span>
                    <span className="text-xs text-slate-500 font-mono">bolt://localhost:7687</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">Vector DB</span>
                    <span className="text-xs text-slate-500 font-mono">http://localhost:6333</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            {data ? `Last checked ${new Date(data.timestamp).toLocaleTimeString()}` : ''}
          </p>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-3 h-3 ${loading ? 'animate-spin-smooth' : ''}`}
            >
              <path d="M13.5 8A5.5 5.5 0 1 1 10 3.07" />
              <polyline points="10 1 10 4 13 4" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
