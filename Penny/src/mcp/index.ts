import { startMcpServer } from './server.js'

startMcpServer().catch((err) => {
  process.stderr.write(`penny-mcp failed to start: ${err}\n`)
  process.exit(1)
})
