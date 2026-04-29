import { loadAnalyticsEnvForMemgraph } from '../main/graph-env.js'
import { startMcpServer } from './server.js'

loadAnalyticsEnvForMemgraph()

startMcpServer().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`penny-mcp startup failed: ${message}\n`)
  process.exit(1)
})
