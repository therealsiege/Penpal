// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { EvalsPanel } from '../../../src/renderer/src/panels/EvalsPanel'
import type { EvalAgentReport, EvalStats } from '../../../src/renderer/src/types'

const mockReports: EvalAgentReport[] = [
  {
    agentId: 'agent-green',
    agentName: 'Green Agent',
    totalTasks: 12,
    successCount: 11,
    successRate: 0.92,
    avgDurationMs: 1200,
    streak: 4,
    trend: 'up',
    recentOutcomes: Array.from({ length: 20 }, (_, i) => i % 5 !== 0),
  },
  {
    agentId: 'agent-amber',
    agentName: 'Amber Agent',
    totalTasks: 10,
    successCount: 7,
    successRate: 0.7,
    avgDurationMs: 2100,
    streak: 1,
    trend: 'flat',
    recentOutcomes: Array.from({ length: 20 }, (_, i) => i % 3 !== 0),
  },
  {
    agentId: 'agent-red',
    agentName: 'Red Agent',
    totalTasks: 8,
    successCount: 3,
    successRate: 0.375,
    avgDurationMs: 3300,
    streak: -2,
    trend: 'down',
    recentOutcomes: Array.from({ length: 20 }, (_, i) => i % 2 === 0),
  },
]

const mockStats: EvalStats = {
  totalTasks: 42,
  overallSuccessRate: 0.78,
  experimentVelocity: 3,
  weekStart: '2026-03-22',
}

vi.mock('../../../src/renderer/src/hooks/usePolling', () => {
  const usePolling = vi.fn()
  return { usePolling }
})

describe('EvalsPanel', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    const { usePolling } = await import('../../../src/renderer/src/hooks/usePolling')
    ;(usePolling as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ data: mockReports, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: mockStats, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false, error: null, errorCount: 0, refresh: vi.fn() })
      .mockReturnValueOnce({ data: { total: 0, agreed: 0, rate: 0 }, loading: false, error: null, errorCount: 0, refresh: vi.fn() })
  })

  it('renders summary, rows, success colors, and sparkline dots', async () => {
    await act(async () => {
      root.render(<EvalsPanel />)
    })

    expect(container.textContent).toContain('42')
    expect(container.textContent).toContain('tasks this week')
    expect(container.textContent).toContain('78%')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('experiments')

    expect(container.textContent).toContain('Green Agent')
    expect(container.textContent).toContain('Amber Agent')
    expect(container.textContent).toContain('Red Agent')

    const greenRate = Array.from(container.querySelectorAll('td')).find((el) => el.textContent?.trim() === '92%')
    const amberRate = Array.from(container.querySelectorAll('td')).find((el) => el.textContent?.trim() === '70%')
    const redRate = Array.from(container.querySelectorAll('td')).find((el) => el.textContent?.trim() === '38%')

    expect(greenRate?.className).toContain('text-emerald-400')
    expect(amberRate?.className).toContain('text-amber-400')
    expect(redRate?.className).toContain('text-red-400')

    const dots = container.querySelectorAll('[data-testid="sparkline-dot"]')
    expect(dots.length).toBe(60)
  })
})
