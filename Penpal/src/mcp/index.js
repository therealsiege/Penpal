import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pennyRoot = resolve(__dirname, '..', '..')

const child = spawn(
  'npx',
  ['tsx', 'src/mcp/index.ts'],
  {
    cwd: pennyRoot,
    env: process.env,
    stdio: 'inherit',
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  process.stderr.write(`failed to spawn tsx MCP process: ${String(err)}\n`)
  process.exit(1)
})
