/**
 * Ollama-compatible HTTP API client (uses `fetch` for http/https).
 *
 * Used by the orchestrator for Plan & Validate when provider is `ollama`, and by
 * headless `runAgentHeadless` when the backend is `ollama` / `local`.
 *
 * Point `PENNY_OLLAMA_BASE_URL` at your NemoClaw/OpenClaw tunnel or gateway that
 * exposes an Ollama-compatible `/api/tags` and `/api/generate` (default remains
 * local `http://127.0.0.1:11434`).
 */

export interface OllamaResult {
  success: boolean
  output: string
  error?: string
  durationMs: number
}

/** Strip trailing slashes. */
export function getOllamaApiBase(): string {
  const raw =
    process.env.PENNY_OLLAMA_BASE_URL?.trim() ||
    process.env.PENNY_NEMOCLAW_OLLAMA_URL?.trim() ||
    process.env.PENNY_OPENCLAW_OLLAMA_URL?.trim()
  if (raw) return raw.replace(/\/+$/, '')
  return 'http://127.0.0.1:11434'
}

async function ollamaHttp(
  path: string,
  opts: { method: string; body?: string; timeoutMs: number },
): Promise<{ status: number; body: string }> {
  const base = getOllamaApiBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const headers: Record<string, string> = {}
    if (opts.body) {
      headers['Content-Type'] = 'application/json'
    }
    const apiKey = process.env.PENNY_OLLAMA_API_KEY?.trim()
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body,
      signal: controller.signal,
    })
    const body = await res.text()
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

function formatConnectionError(err: unknown, baseUrl: string): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Request timed out'
  }
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    const local = /127\.0\.0\.1|localhost/i.test(baseUrl)
    return local ? 'Ollama not running (local)' : `Ollama endpoint unreachable (${baseUrl})`
  }
  return (err as Error).message
}

export async function checkOllamaAvailable(): Promise<boolean> {
  const base = getOllamaApiBase()
  try {
    const res = await ollamaHttp('/api/tags', { method: 'GET', timeoutMs: 5000 })
    return res.status === 200
  } catch {
    return false
  }
}

export async function runOllama(
  prompt: string,
  opts?: { systemPrompt?: string; timeoutMs?: number; model?: string },
): Promise<OllamaResult> {
  const timeoutMs = opts?.timeoutMs ?? 300_000 // 5 min default
  const start = Date.now()
  const base = getOllamaApiBase()

  try {
    const model = opts?.model || process.env.PENNY_OLLAMA_MODEL?.trim() || 'qwen3-coder:30b'
    const body = JSON.stringify({
      model,
      prompt,
      system: opts?.systemPrompt,
      stream: false,
    })

    const res = await ollamaHttp('/api/generate', {
      method: 'POST',
      body,
      timeoutMs,
    })

    const durationMs = Date.now() - start

    if (res.status !== 200) {
      return {
        success: false,
        output: '',
        error: `Ollama API returned status ${res.status} (${base})`,
        durationMs,
      }
    }

    const parsed = JSON.parse(res.body) as { response?: string; error?: string }
    if (parsed.error) {
      return { success: false, output: '', error: parsed.error, durationMs }
    }

    return { success: true, output: parsed.response ?? '', durationMs }
  } catch (err) {
    const durationMs = Date.now() - start
    return {
      success: false,
      output: '',
      error: formatConnectionError(err, base),
      durationMs,
    }
  }
}
