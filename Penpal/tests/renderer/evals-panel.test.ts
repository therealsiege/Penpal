import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockUsePolling = vi.fn()

vi.mock('../../src/renderer/src/hooks/usePolling', () => ({
  usePolling: (...args: unknown[]) => mockUsePolling(...args),
}))

import { EvalsPanel } from '../../src/renderer/src/panels/EvalsPanel'

describe('EvalsPanel', () => {
  beforeEach(() => {
    mockUsePolling.mockReset()
    const reports = [
      {
        agentId: 'a-green',
        agentName: 'Green Agent',
        totalTasks: 12,
        successCount: 10,
        successRate: 0.81,
        avgDurationMs: 5000,
        streak: 3,
        recentOutcomes: [false, false, ...Array.from({ length: 20 }, (_, i) => i % 2 === 0)],
        trend: 'up' as const,
      },
      {
        agentId: 'a-amber',
        agentName: 'Amber Agent',
        totalTasks: 10,
        successCount: 8,
        successRate: 0.8,
        avgDurationMs: 6000,
        streak: 1,
        recentOutcomes: [true, false, true],
        trend: 'flat' as const,
      },
      {
        agentId: 'a-red',
        agentName: 'Red Agent',
        totalTasks: 10,
        successCount: 5,
        successRate: 0.59,
        avgDurationMs: 7000,
        streak: -2,
        recentOutcomes: [false, false, true],
        trend: 'down' as const,
      },
    ]

    const stats = {
      totalTasks: 42,
      overallSuccessRate: 0.78,
      experimentVelocity: 3,
      weekStart: '2026-03-22',
    }

    mockUsePolling
      .mockReturnValueOnce({ data: reports, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: stats, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: { total: 0, agreed: 0, rate: 0 }, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
  })

  it('renders required summary text and table headers', () => {
    const html = renderToStaticMarkup(createElement(EvalsPanel))
    expect(html).toMatch(/3<\/span>\s+tasks this week/)
    expect(html).toMatch(/78%/)
    expect(html).toMatch(/42<\/span>\s+experiments/)
    expect(html).toContain('Agent Name')
    expect(html).toContain('Tasks')
    expect(html).toContain('Success Rate')
    expect(html).toContain('Avg Duration')
    expect(html).toContain('Streak')
    expect(html).toContain('Trend')
  })

  it('uses exact rate thresholds and limits sparkline to 20 outcomes', () => {
    const html = renderToStaticMarkup(createElement(EvalsPanel))
    expect(html).toContain('81%')
    expect(html).toContain('80%')
    expect(html).toContain('59%')
    expect(html).toContain('text-emerald-400')
    expect(html).toContain('text-amber-400')
    expect(html).toContain('text-red-400')

    const dotCount = (html.match(/data-testid="sparkline-dot"/g) || []).length
    expect(dotCount).toBe(26)
  })
})
