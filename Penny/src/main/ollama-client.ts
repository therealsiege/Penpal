/**
 * Ollama HTTP Client — lightweight wrapper using Node http module (no deps)
 *
 * Used by the orchestrator for Plan & Validate stages when provider is 'ollama'.
 */

import http from 'http'

export interface OllamaResult {
  success: boolean
  output: string
  error?: string
  durationMs: number
}

function httpRequest(
  url: string,
  opts: { method: string; body?: string; timeoutMs: number },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: opts.method,
        headers: opts.body
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(opts.body) }
          : undefined,
        timeout: opts.timeoutMs,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await httpRequest('http://localhost:11434/api/tags', {
      method: 'GET',
      timeoutMs: 5000,
    })
    return res.status === 200
  } catch {
    return false
  }
}

export async function runOllama(
  prompt: string,
  opts?: { systemPrompt?: string; timeoutMs?: number },
): Promise<OllamaResult> {
  const timeoutMs = opts?.timeoutMs ?? 300_000 // 5 min default
  const start = Date.now()

  try {
    const body = JSON.stringify({
      model: 'qwen3-coder:30b',
      prompt,
      system: opts?.systemPrompt,
      stream: false,
    })

    const res = await httpRequest('http://localhost:11434/api/generate', {
      method: 'POST',
      body,
      timeoutMs,
    })

    const durationMs = Date.now() - start

    if (res.status !== 200) {
      return { success: false, output: '', error: `Ollama returned status ${res.status}`, durationMs }
    }

    const parsed = JSON.parse(res.body) as { response?: string; error?: string }
    if (parsed.error) {
      return { success: false, output: '', error: parsed.error, durationMs }
    }

    return { success: true, output: parsed.response ?? '', durationMs }
  } catch (err) {
    const durationMs = Date.now() - start
    const message = (err as NodeJS.ErrnoException).code === 'ECONNREFUSED'
      ? 'Ollama not running'
      : (err as Error).message
    return { success: false, output: '', error: message, durationMs }
  }
}
