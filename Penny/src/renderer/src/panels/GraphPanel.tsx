import { useState, useEffect, useCallback, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

interface GraphNode {
  id: string
  label: string
  type: string
  path?: string
  x?: number
  y?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

const NODE_COLORS: Record<string, string> = {
  Document: '#3b82f6',
  Tag: '#22c55e',
  Person: '#f97316',
  Company: '#a855f7',
  Technology: '#06b6d4',
  EHRSystem: '#ec4899',
  Lead: '#eab308',
  Territory: '#64748b',
  Folder: '#475569',
}

type Scope = 'full' | 'local' | 'tag'

export function GraphPanel({ onOpenFile }: { onOpenFile?: (path: string) => void }) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('tag')
  const [search, setSearch] = useState('')
  const graphRef = useRef<any>(null)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.vaultGraphData(scope)
      setGraphData(data)
    } catch {
      setGraphData({ nodes: [], links: [] })
    }
    setLoading(false)
  }, [scope])

  useEffect(() => { loadGraph() }, [loadGraph])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.path && onOpenFile) {
      onOpenFile(node.path)
    }
  }, [onOpenFile])

  const nodeColor = useCallback((node: GraphNode) => {
    return NODE_COLORS[node.type] || '#64748b'
  }, [])

  const nodeLabel = useCallback((node: GraphNode) => {
    return `${node.label} (${node.type})`
  }, [])

  const filteredData = search.trim()
    ? {
        nodes: graphData.nodes.filter(n =>
          n.label.toLowerCase().includes(search.toLowerCase()) ||
          n.type.toLowerCase().includes(search.toLowerCase())
        ),
        links: graphData.links,
      }
    : graphData

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950">
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <div className="drag-region flex-1 h-2" />
        <div className="flex items-center gap-1">
          {(['tag', 'full', 'local'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-2 py-0.5 text-[10px] rounded transition-all duration-150 capitalize ${
                scope === s
                  ? 'bg-blue-600/30 text-blue-300 scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-300 hover:scale-[1.02]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter nodes..."
          className="bg-slate-900 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 w-36"
        />
        <div className="text-[10px] text-slate-600 tabular-nums">
          {graphData.links.length} edges
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin-smooth" />
            <span className="text-[11px] text-slate-500">Loading graph...</span>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 animate-card-enter">
            <svg
              className="w-16 h-16 text-slate-700/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5" cy="5" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="12" cy="19" r="2" />
              <line x1="7" y1="5" x2="17" y2="5" />
              <line x1="6" y1="7" x2="11" y2="17" />
              <line x1="18" y1="7" x2="13" y2="17" />
            </svg>
            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium">No graph data</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Is Memgraph running?</p>
            </div>
          </div>
        ) : (
          <>
            <div className="animate-card-enter">
              <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                nodeId="id"
                nodeLabel={nodeLabel}
                nodeColor={nodeColor}
                nodeRelSize={4}
                linkColor={() => 'rgba(100, 116, 139, 0.2)'}
                linkWidth={0.5}
                onNodeClick={handleNodeClick}
                backgroundColor="#020617"
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const label = node.label as string
                  const fontSize = Math.max(10 / globalScale, 1.5)
                  const color = NODE_COLORS[node.type as string] || '#64748b'
                  const size = node.type === 'Tag' ? 5 : 3

                  ctx.beginPath()
                  ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI)
                  ctx.fillStyle = color
                  ctx.fill()

                  if (globalScale > 0.8) {
                    ctx.font = `${fontSize}px -apple-system, sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'top'
                    ctx.fillStyle = 'rgba(226, 232, 240, 0.7)'
                    const shortLabel = label.length > 20 ? label.slice(0, 19) + '..' : label
                    ctx.fillText(shortLabel, node.x!, node.y! + size + 2)
                  }
                }}
              />
            </div>
            {/* Node count badge */}
            <div className="absolute top-3 right-3 animate-fade-slide-down">
              <span className="text-[10px] text-slate-400 bg-slate-900/80 border border-slate-700/50 rounded-full px-2.5 py-0.5">
                {graphData.nodes.length} nodes
              </span>
            </div>
          </>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 rounded border border-slate-800/60 px-2 py-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(NODE_COLORS).slice(0, 6).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1 text-[9px] text-slate-400">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                {type}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
