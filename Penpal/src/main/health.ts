import neo4j from 'neo4j-driver'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface HealthCheck {
  name: string
  status: 'ok' | 'fail'
  latency_ms: number
  message?: string
}

interface HealthResult {
  timestamp: string
  overall: 'healthy' | 'degraded' | 'down'
  checks: HealthCheck[]
}

async function timedCheck(name: string, fn: () => Promise<string>): Promise<HealthCheck> {
  const start = Date.now()
  try {
    const message = await fn()
    return { name, status: 'ok', latency_ms: Date.now() - start, message }
  } catch (err) {
    return { name, status: 'fail', latency_ms: Date.now() - start, message: (err as Error).message }
  }
}

export async function checkHealth(): Promise<HealthResult> {
  const checks: HealthCheck[] = []

  const [memgraph, qdrant, docker] = await Promise.allSettled([
    timedCheck('memgraph', async () => {
      const uri = process.env.MEMGRAPH_URI || 'bolt://localhost:7687'
      const user = process.env.MEMGRAPH_USER || ''
      const password = process.env.MEMGRAPH_PASSWORD || ''
      const d = user
        ? neo4j.driver(uri, neo4j.auth.basic(user, password))
        : neo4j.driver(uri)
      const s = d.session()
      try {
        const r = await s.run('MATCH (n) RETURN count(n) AS cnt')
        const cnt = r.records[0]?.get('cnt')
        const count = cnt && typeof cnt === 'object' && 'toNumber' in cnt
          ? (cnt as { toNumber(): number }).toNumber()
          : Number(cnt)
        return `${count.toLocaleString()} nodes`
      } finally {
        await s.close()
        await d.close()
      }
    }),
    timedCheck('qdrant', async () => {
      const url = process.env.QDRANT_URL || 'http://localhost:6333'
      const res = await fetch(`${url}/collections`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { result?: { collections?: unknown[] } }
      return `${data.result?.collections?.length ?? 0} collections`
    }),
    timedCheck('docker', async () => {
      const cwd = path.resolve(__dirname, '..', '..', 'analytics')
      const { stdout } = await execAsync(
        'docker compose ps --format json 2>/dev/null',
        { cwd, timeout: 10000 },
      )
      const lines = stdout.trim().split('\n').filter(Boolean)
      const services: Array<{ State?: string }> = []
      for (const line of lines) {
        try { services.push(JSON.parse(line)) } catch { /* skip */ }
      }
      const running = services.filter(s => s.State === 'running')
      if (running.length === 0) throw new Error('No containers running')
      return `${running.length}/${services.length} running`
    }),
  ])

  checks.push(
    memgraph.status === 'fulfilled' ? memgraph.value : { name: 'memgraph', status: 'fail', latency_ms: 0, message: 'Check threw' },
    qdrant.status === 'fulfilled' ? qdrant.value : { name: 'qdrant', status: 'fail', latency_ms: 0, message: 'Check threw' },
    docker.status === 'fulfilled' ? docker.value : { name: 'docker', status: 'fail', latency_ms: 0, message: 'Check threw' },
  )

  // API key checks
  const keys: [string, string][] = [
    ['openai_key', process.env.OPENAI_API_KEY || ''],
    ['anthropic_key', process.env.ANTHROPIC_API_KEY || ''],
    ['firecrawl_key', process.env.FIRECRAWL_API_KEY || ''],
  ]
  for (const [name, value] of keys) {
    checks.push({
      name,
      status: value.length > 8 ? 'ok' : 'fail',
      latency_ms: 0,
      message: value.length > 8 ? `...${value.slice(-4)}` : 'Not set',
    })
  }

  const failCount = checks.filter(c => c.status === 'fail').length
  const infraFails = checks.filter(c =>
    ['memgraph', 'qdrant', 'docker'].includes(c.name) && c.status === 'fail',
  ).length

  return {
    timestamp: new Date().toISOString(),
    overall: infraFails >= 2 ? 'down' : failCount > 0 ? 'degraded' : 'healthy',
    checks,
  }
}
