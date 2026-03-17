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
              className={`px-2 py-0.5 text-[10px] rounded transition-colors capitalize ${
                scope === s ? 'bg-blue-600/30 text-blue-300' : 'text-slate-500 hover:text-slate-300'
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
          className="bg-slate-900 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700/50 outline-none focus:border-blue-500 w-36"
        />
        <div className="text-[10px] text-slate-600">
          {graphData.nodes.length} nodes, {graphData.links.length} edges
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 animate-pulse">
            Loading graph...
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs">
            No graph data. Is Memgraph running?
          </div>
        ) : (
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
