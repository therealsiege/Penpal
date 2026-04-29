import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOllamaApiBase } from '../../src/main/ollama-client'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getOllamaApiBase', () => {
  it('defaults to local Ollama port', () => {
    vi.stubEnv('PENNY_OLLAMA_BASE_URL', '')
    vi.stubEnv('PENNY_NEMOCLAW_OLLAMA_URL', '')
    vi.stubEnv('PENNY_OPENCLAW_OLLAMA_URL', '')
    expect(getOllamaApiBase()).toBe('http://127.0.0.1:11434')
  })

  it('prefers PENNY_OLLAMA_BASE_URL and strips trailing slash', () => {
    vi.stubEnv('PENNY_OLLAMA_BASE_URL', 'https://claw.example.com/ollama/')
    expect(getOllamaApiBase()).toBe('https://claw.example.com/ollama')
  })

  it('falls back to NemoClaw / OpenClaw aliases', () => {
    vi.stubEnv('PENNY_OLLAMA_BASE_URL', '')
    vi.stubEnv('PENNY_NEMOCLAW_OLLAMA_URL', 'http://nemoclaw.local:9000')
    expect(getOllamaApiBase()).toBe('http://nemoclaw.local:9000')

    vi.stubEnv('PENNY_NEMOCLAW_OLLAMA_URL', '')
    vi.stubEnv('PENNY_OPENCLAW_OLLAMA_URL', 'http://openclaw:11434')
    expect(getOllamaApiBase()).toBe('http://openclaw:11434')
  })
})
