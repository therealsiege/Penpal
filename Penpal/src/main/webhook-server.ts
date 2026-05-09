import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { triggerWebhookPoll } from './github-issues'
import { getDataDir } from './data-paths'

const DEFAULT_PORT = 3141
const MAX_BODY_BYTES = 1024 * 1024
const SIGNATURE_PREFIX = 'sha256='

let server: http.Server | null = null
let listeningPort: number | null = null

function resolvePort(): number {
  const raw = process.env.PENPAL_WEBHOOK_PORT
  if (!raw) return DEFAULT_PORT
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    console.warn(`[webhook-server] Invalid PENPAL_WEBHOOK_PORT="${raw}" — falling back to ${DEFAULT_PORT}`)
    return DEFAULT_PORT
  }
  return parsed
}

function loadSecretFromConfig(): string | null {
  try {
    const cfgPath = path.join(getDataDir(), 'webhook-config.json')
    if (!fs.existsSync(cfgPath)) return null
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
    if (raw && typeof raw.secret === 'string' && raw.secret.trim().length > 0) {
      return raw.secret
    }
  } catch (err) {
    console.error('[webhook-server] Failed to load webhook-config.json:', (err as Error).message)
  }
  return null
}

function getSecret(): string | null {
  const env = process.env.PENPAL_WEBHOOK_SECRET
  if (env && env.trim().length > 0) return env
  return loadSecretFromConfig()
}

export function isSecretConfigured(): boolean {
  return getSecret() !== null
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8')
  const bBuf = Buffer.from(b, 'utf-8')
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function verifySignature(secret: string, body: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) return false
  const expected = SIGNATURE_PREFIX + crypto.createHmac('sha256', secret).update(body).digest('hex')
  return safeCompare(expected, signatureHeader)
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

interface IssuesPayload {
  action?: string
  label?: { name?: string }
  repository?: { name?: string; owner?: { login?: string } }
}

function handleIssuesEvent(payload: IssuesPayload): { handled: boolean; reason: string } {
  if (payload.action !== 'labeled') {
    return { handled: false, reason: `action=${payload.action ?? 'unknown'}` }
  }
  const labelName = payload.label?.name
  if (labelName !== 'agent-ready') {
    return { handled: false, reason: `label=${labelName ?? 'none'}` }
  }
  const owner = payload.repository?.owner?.login
  const repo = payload.repository?.name
  if (!owner || !repo) {
    return { handled: false, reason: 'missing repository owner/name' }
  }
  triggerWebhookPoll(owner, repo)
  return { handled: true, reason: `${owner}/${repo}` }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  let body: Buffer
  try {
    body = await readBody(req)
  } catch (err) {
    res.statusCode = 413
    res.end((err as Error).message)
    return
  }

  const event = (req.headers['x-github-event'] as string | undefined) ?? ''
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  const delivery = (req.headers['x-github-delivery'] as string | undefined) ?? 'no-delivery-id'

  const secret = getSecret()
  if (!secret) {
    console.error('[webhook-server] PENPAL_WEBHOOK_SECRET is not set — rejecting webhook')
    res.statusCode = 500
    res.end('Webhook secret not configured')
    return
  }

  if (!verifySignature(secret, body, signature)) {
    console.warn(`[webhook-server] Invalid signature on event=${event} delivery=${delivery}`)
    res.statusCode = 401
    res.end('Invalid signature')
    return
  }

  if (event === 'ping') {
    console.log(`[webhook-server] ping received delivery=${delivery}`)
    res.statusCode = 200
    res.end('pong')
    return
  }

  if (event !== 'issues') {
    res.statusCode = 200
    res.end('ignored')
    return
  }

  let payload: IssuesPayload
  try {
    payload = JSON.parse(body.toString('utf-8')) as IssuesPayload
  } catch {
    res.statusCode = 400
    res.end('Invalid JSON')
    return
  }

  const result = handleIssuesEvent(payload)
  if (result.handled) {
    console.log(`[webhook-server] issues:labeled triggered poll for ${result.reason} delivery=${delivery}`)
    res.statusCode = 202
    res.end('accepted')
  } else {
    console.log(`[webhook-server] issues event ignored (${result.reason}) delivery=${delivery}`)
    res.statusCode = 200
    res.end('ignored')
  }
}

export function startWebhookServer(): void {
  if (server) return
  const port = resolvePort()
  server = http.createServer((req, res) => {
    handleRequest(req, res).catch(err => {
      console.error('[webhook-server] Unhandled request error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal error')
      }
    })
  })
  server.on('error', err => {
    console.error('[webhook-server] Server error:', err)
  })
  server.listen(port, '127.0.0.1', () => {
    listeningPort = port
    const secretMsg = isSecretConfigured() ? 'secret configured' : 'NO SECRET — set PENPAL_WEBHOOK_SECRET'
    console.log(`[webhook-server] Listening on http://127.0.0.1:${port}/webhook (${secretMsg})`)
  })
}

export function stopWebhookServer(): void {
  if (!server) return
  const s = server
  server = null
  listeningPort = null
  s.close(err => {
    if (err) console.error('[webhook-server] close error:', err)
    else console.log('[webhook-server] Stopped')
  })
}

export function getWebhookStatus(): { port: number; running: boolean; url: string; secretConfigured: boolean } {
  const port = listeningPort ?? resolvePort()
  return {
    port,
    running: server !== null,
    url: `http://localhost:${port}/webhook`,
    secretConfigured: isSecretConfigured(),
  }
}
