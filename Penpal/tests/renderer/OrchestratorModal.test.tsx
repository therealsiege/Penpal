// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// ── Module mocks (must be hoisted before component import) ───────────────────

vi.mock('../../src/renderer/src/hooks/usePolling', () => ({
  usePolling: vi.fn().mockReturnValue({ data: [], loading: false, error: null, errorCount: 0, refresh: vi.fn() }),
}))

vi.mock('../../src/renderer/src/stores/appearance-store', () => ({
  useAppearanceStore: vi.fn().mockReturnValue('dark'),
}))

vi.mock('../../src/renderer/src/components/SourcesModal', () => ({
  GithubPollStatusBadge: () => null,
  SourcesModal: () => null,
}))

vi.mock('../../src/renderer/src/components/Toast', () => ({
  useToast: vi.fn().mockReturnValue({ toast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { TasksPanel } from '../../src/renderer/src/components/OrchestratorModal'
import type { GitHubIssueCard, LinearIssueCard } from '../../src/renderer/src/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGitHubCard(overrides: Partial<GitHubIssueCard> = {}): GitHubIssueCard {
  return {
    issueNumber: 123,
    repo: 'org/my-repo',
    title: 'Fix the bug',
    taskId: 'task-gh-1',
    taskStatus: 'queued',
    taskStage: null,
    priority: 'normal',
    assignedAgent: null,
    ingestedAt: Date.now() - 60_000,
    url: 'https://github.com/org/my-repo/issues/123',
    ...overrides,
  }
}

function makeLinearCard(overrides: Partial<LinearIssueCard> = {}): LinearIssueCard {
  return {
    source: 'linear',
    issueId: 'linear-issue-1',
    issueNumber: 42,
    identifier: 'META-42',
    repo: 'META',
    title: 'Linear task',
    taskId: 'task-lin-1',
    taskStatus: 'queued',
    taskStage: null,
    priority: 'normal',
    assignedAgent: null,
    ingestedAt: Date.now() - 120_000,
    url: 'https://linear.app/meta/issue/META-42',
    ...overrides,
  }
}

// ── cardLane logic (extracted inline — not exported from module) ─────────────

type LaneId = 'planning' | 'executing' | 'validating' | 'done' | 'failed'

function cardLane(card: { taskStatus: string; taskStage: string | null }): LaneId {
  const status = card.taskStatus
  const stage = (card.taskStage || '').toLowerCase()

  if (status === 'failed' || status === 'cancelled' || stage === 'failed') return 'failed'
  if (status === 'completed' || stage === 'done' || stage === 'complete') return 'done'
  if (stage === 'solving' || stage === 'feedback' || stage === 'planning') return 'planning'
  if (stage === 'reviewing') return 'validating'
  if (stage === 'executing' || stage === 'self-fixing') return 'executing'
  if (stage === 'validating') return 'validating'
  if (stage === 'awaiting-answer' || stage === 'queued') return 'planning'
  if (status === 'queued' || status === 'assigned') return 'planning'
  if (status === 'active') return 'executing'
  return 'planning'
}

// ── Mock api factory ──────────────────────────────────────────────────────────

function makeMockApi(overrides: Record<string, unknown> = {}) {
  return {
    githubIssueCards: vi.fn().mockResolvedValue([]),
    githubPollerStatus: vi.fn().mockResolvedValue({ running: false, polling: false, repos: [], seenCount: 0, lastPoll: null, pollIntervalMs: 30000 }),
    githubListRepos: vi.fn().mockResolvedValue([]),
    githubPollNow: vi.fn().mockResolvedValue(undefined),
    linearIssueCards: vi.fn().mockResolvedValue([]),
    linearPollerStatus: vi.fn().mockResolvedValue({ running: false, polling: false }),
    linearListTeams: vi.fn().mockResolvedValue([]),
    linearPollNow: vi.fn().mockResolvedValue(undefined),
    linearAddTeam: vi.fn().mockResolvedValue(undefined),
    linearRemoveTeam: vi.fn().mockResolvedValue(undefined),
    listPods: vi.fn().mockResolvedValue([]),
    orchestratorQueue: vi.fn().mockResolvedValue([]),
    orchestratorGetProvider: vi.fn().mockResolvedValue({ provider: 'anthropic', ollamaAvailable: false }),
    orchestratorRetryTask: vi.fn().mockResolvedValue(undefined),
    pausePod: vi.fn().mockResolvedValue(undefined),
    resumePod: vi.fn().mockResolvedValue(undefined),
    cancelPod: vi.fn().mockResolvedValue(undefined),
    overridePod: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('cardLane — pure logic', () => {
  it('queued taskStatus → planning lane', () => {
    expect(cardLane({ taskStatus: 'queued', taskStage: null })).toBe('planning')
  })

  it('running taskStatus + solver taskStage → executing lane', () => {
    // 'active' maps to executing; 'solver' is not a known stage so falls through to active check
    expect(cardLane({ taskStatus: 'active', taskStage: 'solver' })).toBe('executing')
  })

  it('running taskStatus + reviewer taskStage → validating lane', () => {
    expect(cardLane({ taskStatus: 'active', taskStage: 'reviewing' })).toBe('validating')
  })

  it('completed taskStatus → done lane', () => {
    expect(cardLane({ taskStatus: 'completed', taskStage: null })).toBe('done')
  })

  it('failed taskStatus → failed lane', () => {
    expect(cardLane({ taskStatus: 'failed', taskStage: null })).toBe('failed')
  })

  it('running taskStatus + executor taskStage → executing lane', () => {
    expect(cardLane({ taskStatus: 'active', taskStage: 'executing' })).toBe('executing')
  })

  it('cancelled taskStatus → failed lane', () => {
    expect(cardLane({ taskStatus: 'cancelled', taskStage: null })).toBe('failed')
  })

  it('assigned taskStatus → planning lane', () => {
    expect(cardLane({ taskStatus: 'assigned', taskStage: null })).toBe('planning')
  })

  it('done taskStage → done lane', () => {
    expect(cardLane({ taskStatus: 'active', taskStage: 'done' })).toBe('done')
  })

  it('validating taskStage → validating lane', () => {
    expect(cardLane({ taskStatus: 'active', taskStage: 'validating' })).toBe('validating')
  })

  it('planning taskStage → planning lane', () => {
    expect(cardLane({ taskStatus: 'active', taskStage: 'planning' })).toBe('planning')
  })
})

// ── DisplayCard union + rendered output tests ─────────────────────────────────

describe('TasksPanel — rendered output', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.useRealTimers()
  })

  async function render(apiOverrides: Record<string, unknown> = {}) {
    const mockApi = makeMockApi(apiOverrides)
    Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })

    await act(async () => {
      root.render(<TasksPanel />)
    })
    // Flush all promises so the initial useEffect tick resolves
    await act(async () => {
      await Promise.resolve()
    })
    return mockApi
  }

  // ── Render sanity ──────────────────────────────────────────────────────────

  it('test 14 — TasksPanel renders without crashing with all API calls returning empty arrays', async () => {
    await render()
    expect(container.innerHTML).toBeTruthy()
  })

  it('test 15 — lane labels Planning, Executing, Validating are all present', async () => {
    await render({
      githubIssueCards: vi.fn().mockResolvedValue([makeGitHubCard()]),
    })
    expect(container.textContent).toContain('Planning')
    expect(container.textContent).toContain('Executing')
    expect(container.textContent).toContain('Validating')
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('test 13 — empty allCards shows "No issues in queue" empty state', async () => {
    await render()
    expect(container.textContent).toContain('No issues in queue')
  })

  it('planning lane empty state message appears when cards exist but planning lane is empty', async () => {
    // Provide a card that lands in 'done' so the board renders but planning lane is empty
    await render({
      githubIssueCards: vi.fn().mockResolvedValue([
        makeGitHubCard({ taskStatus: 'completed', taskStage: null }),
      ]),
    })
    expect(container.textContent).toContain('No issues yet')
  })

  // ── GitHubIssueCard rendering ──────────────────────────────────────────────

  it('test 7 — GitHubIssueCard renders with #123 identifier format', async () => {
    await render({
      githubIssueCards: vi.fn().mockResolvedValue([makeGitHubCard({ issueNumber: 123 })]),
    })
    expect(container.textContent).toContain('#123')
  })

  it('test 10 — GitHubIssueCard shows the "GH" source badge', async () => {
    await render({
      githubIssueCards: vi.fn().mockResolvedValue([makeGitHubCard()]),
    })
    expect(container.textContent).toContain('GH')
  })

  // ── LinearIssueCard rendering ──────────────────────────────────────────────

  it('test 8 — LinearIssueCard renders with META-42 identifier', async () => {
    await render({
      linearIssueCards: vi.fn().mockResolvedValue([makeLinearCard({ identifier: 'META-42' })]),
    })
    expect(container.textContent).toContain('META-42')
  })

  it('test 9 — LinearIssueCard shows the "L" source badge', async () => {
    await render({
      linearIssueCards: vi.fn().mockResolvedValue([makeLinearCard()]),
    })
    // The "L" badge is rendered for cards with source === 'linear'
    const badges = container.querySelectorAll('span')
    const lBadge = Array.from(badges).find(el => el.textContent?.trim() === 'L')
    expect(lBadge).toBeTruthy()
  })

  // ── Error states ───────────────────────────────────────────────────────────

  it('test 11 — GitHub API rejection shows "GitHub connection failed" warning', async () => {
    await render({
      githubIssueCards: vi.fn().mockRejectedValue(new Error('network error')),
      githubPollerStatus: vi.fn().mockRejectedValue(new Error('network error')),
    })
    expect(container.textContent).toContain('GitHub connection failed')
  })

  it('test 12 — Linear API rejection shows "Linear connection failed" warning', async () => {
    await render({
      linearIssueCards: vi.fn().mockRejectedValue(new Error('network error')),
      linearPollerStatus: vi.fn().mockRejectedValue(new Error('network error')),
      linearListTeams: vi.fn().mockRejectedValue(new Error('network error')),
    })
    expect(container.textContent).toContain('Linear connection failed')
  })

  // ── Mixed card type merging ────────────────────────────────────────────────

  it('both GitHub and Linear cards render together in the board', async () => {
    await render({
      githubIssueCards: vi.fn().mockResolvedValue([makeGitHubCard({ title: 'GitHub Issue Title' })]),
      linearIssueCards: vi.fn().mockResolvedValue([makeLinearCard({ title: 'Linear Issue Title' })]),
    })
    expect(container.textContent).toContain('GitHub Issue Title')
    expect(container.textContent).toContain('Linear Issue Title')
  })
})
