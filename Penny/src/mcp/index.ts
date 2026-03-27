import { startMcpServer } from './server.js'

startMcpServer().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`penny-mcp startup failed: ${message}\n`)
  process.exit(1)
})
