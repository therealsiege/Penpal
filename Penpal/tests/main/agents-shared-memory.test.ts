/**
 * Tests for issue #177: CLAUDE.md shared memory should be injected into headless pod agents.
 */

import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAgentTaggedSystemPrompt } from '../../src/main/agents'

const SHARED_MEMORY_MARKER = '--- SHARED TEAM KNOWLEDGE ---'
const FAKE_SHARED_MEMORY = 'Be concise. Prefer small PRs. Trust the type system.'

afterEach(() => {
  vi.restoreAllMocks()
})

function stubSharedMemory(content: string | null) {
  const existsSyncOrig = fs.existsSync.bind(fs)
  const readFileSyncOrig = fs.readFileSync.bind(fs)

  vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('CLAUDE.md')) {
      return content !== null
    }
    return existsSyncOrig(p)
  })

  vi.spyOn(fs, 'readFileSync').mockImplementation((p, ...args) => {
    if (typeof p === 'string' && p.endsWith('CLAUDE.md')) {
      return content ?? ''
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return readFileSyncOrig(p as any, ...(args as any))
  })
}

describe('buildAgentTaggedSystemPrompt — shared memory injection', () => {
  it('injects CLAUDE.md into a non-headless agent prompt', () => {
    stubSharedMemory(FAKE_SHARED_MEMORY)
    const result = buildAgentTaggedSystemPrompt('fullstack-dev', { headless: false })
    expect(result).toContain(SHARED_MEMORY_MARKER)
    expect(result).toContain(FAKE_SHARED_MEMORY)
  })

  it('injects CLAUDE.md into a headless agent prompt (fix for #177)', () => {
    stubSharedMemory(FAKE_SHARED_MEMORY)
    const result = buildAgentTaggedSystemPrompt('fullstack-dev', { headless: true })
    expect(result).toContain(SHARED_MEMORY_MARKER)
    expect(result).toContain(FAKE_SHARED_MEMORY)
  })

  it('does not include shared memory block when CLAUDE.md is absent', () => {
    stubSharedMemory(null)
    const result = buildAgentTaggedSystemPrompt('fullstack-dev', { headless: true })
    expect(result).not.toContain(SHARED_MEMORY_MARKER)
  })

  it('headless and non-headless produce the same shared memory section', () => {
    stubSharedMemory(FAKE_SHARED_MEMORY)
    const nonHeadless = buildAgentTaggedSystemPrompt('fullstack-dev', { headless: false })
    const headless = buildAgentTaggedSystemPrompt('fullstack-dev', { headless: true })

    const extractBlock = (s: string) => {
      const start = s.indexOf(SHARED_MEMORY_MARKER)
      const end = s.indexOf('--- END SHARED TEAM KNOWLEDGE ---')
      return start !== -1 && end !== -1 ? s.slice(start, end + '--- END SHARED TEAM KNOWLEDGE ---'.length) : null
    }

    expect(extractBlock(nonHeadless)).toBeTruthy()
    expect(extractBlock(headless)).toBeTruthy()
    expect(extractBlock(headless)).toEqual(extractBlock(nonHeadless))
  })
})
