import { beforeEach, describe, expect, it, vi } from 'vitest'

const handleMap = new Map<string, (...args: unknown[]) => Promise<unknown>>()

const mockGetClaudeSessions = vi.fn()
const mockGetCursorAgentSessions = vi.fn()
const mockGetTaskQueue = vi.fn()
const mockGetAgentHealthStatuses = vi.fn()
const mockListPods = vi.fn()
const mockGetPodStatus = vi.fn()
const mockSearchVault = vi.fn()
const mockReadVaultFile = vi.fn()
const mockGetBacklinks = vi.fn()
const mockSearchLeads = vi.fn()
const mockGetLeadDetail = vi.fn()
const mockGetAgentConfigs = vi.hoisted(() => vi.fn(() => []))

const mockComputeCapabilitiesStatus = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    updatedAt: '2020-01-01T00:00:00.000Z',
    overall: 'unknown',
    items: {},
    facets: { graph_orchestrator: {}, evals_vault: {} },
  }),
)

vi.mock('../../../src/main/capabilities-status', () => ({
  computeCapabilitiesStatus: mockComputeCapabilitiesStatus,
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handleMap.set(channel, handler)
    }),
  },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
}))

vi.mock('../../../src/main/health', () => ({ checkHealth: vi.fn() }))
vi.mock('../../../src/main/slack-bridge', () => ({ startSlackBridge: vi.fn(), stopSlackBridge: vi.fn(), isSlackBridgeRunning: vi.fn() }))
vi.mock('../../../src/main/scheduler-bridge', () => ({ getJobStatuses: vi.fn(), getJobHistory: vi.fn(), forceRunJob: vi.fn() }))
vi.mock('../../../src/main/graph', () => ({
  getPipelineSummary: vi.fn(),
  getHotLeads: vi.fn(),
  getTerritories: vi.fn(),
  getNewLeads: vi.fn(),
  getGraphStatsWithFreshness: vi.fn(),
  searchLeads: mockSearchLeads,
  getLeadDetail: mockGetLeadDetail,
}))
vi.mock('../../../src/main/sessions', () => ({
  getClaudeSessions: mockGetClaudeSessions,
  getSessionConversation: vi.fn(),
  sendToSession: vi.fn(),
  focusSession: vi.fn(),
  focusByName: vi.fn(),
  createNewSession: vi.fn(),
  createAgentSession: vi.fn(),
  broadcastToSessions: vi.fn(),
  getOpenClawInfo: vi.fn().mockResolvedValue({ supervised: false }),
  getITermStatus: vi.fn(),
}))
vi.mock('../../../src/main/cursor-sessions', () => ({
  getCursorAgentSessions: mockGetCursorAgentSessions,
  getCursorTranscriptConversation: vi.fn(),
  focusCursorIDE: vi.fn(),
}))
vi.mock('../../../src/main/opencode-sessions', () => ({ getOpencodeSessions: vi.fn() }))
vi.mock('../../../src/main/agents', () => ({
  getAgentConfigs: mockGetAgentConfigs,
  getAgentConfig: vi.fn(),
  loadAgentSessionMap: vi.fn(() => ({})),
  removeAgentSession: vi.fn(),
}))
vi.mock('../../../src/main/pods', () => ({
  createPod: vi.fn(),
  listPods: mockListPods,
  getPodStatus: mockGetPodStatus,
  pausePod: vi.fn(),
  resumePod: vi.fn(),
  cancelPod: vi.fn(),
  getPodPresets: vi.fn(),
}))
vi.mock('../../../src/main/vault', () => ({
  listVaultDir: vi.fn(),
  readVaultFile: mockReadVaultFile,
  writeVaultFile: vi.fn(),
  createVaultFile: vi.fn(),
  createVaultFolder: vi.fn(),
  renameVaultFile: vi.fn(),
  deleteVaultFile: vi.fn(),
  indexVault: vi.fn(),
  searchVault: mockSearchVault,
  getVaultTags: vi.fn(),
  getFilesByTag: vi.fn(),
  getBacklinks: mockGetBacklinks,
}))
vi.mock('../../../src/main/search-index', () => ({ buildSearchIndex: vi.fn(), searchIndexed: vi.fn() }))
vi.mock('../../../src/main/vault-graph', () => ({ getVaultGraph: vi.fn() }))
vi.mock('../../../src/main/orchestrator', () => ({
  enqueueTask: vi.fn(),
  getTaskQueue: mockGetTaskQueue,
  cancelTask: vi.fn(),
  retryTask: vi.fn(),
  getAgentHealthStatuses: mockGetAgentHealthStatuses,
  shutdownAgent: vi.fn(),
  getOrchestratorStats: vi.fn(),
  getAllAgentXP: vi.fn(),
  getAllAgentCredits: vi.fn(),
  setModelProvider: vi.fn(),
  getModelProvider: vi.fn(),
}))
vi.mock('../../../src/main/ollama-client', () => ({ checkOllamaAvailable: vi.fn() }))
vi.mock('../../../src/main/github-issues', () => ({
  getGithubIssuePollerStatus: vi.fn(),
  pollGithubIssuesNow: vi.fn(),
  getSeenIssues: vi.fn(),
  getGithubIssueCards: vi.fn(),
  addWatchedRepo: vi.fn(),
  removeWatchedRepo: vi.fn(),
  getWatchedRepos: vi.fn(),
  consolidateTrackedIssues: vi.fn(),
}))
vi.mock('../../../src/main/veritas-service', () => ({ getVeritasStatus: vi.fn(), startVeritasService: vi.fn(), stopVeritasService: vi.fn(), restartVeritasService: vi.fn(), getVeritasLogs: vi.fn() }))
vi.mock('../../../src/main/evals', () => ({ getEvalReportAll: vi.fn(), getEvalReportAgent: vi.fn(), getEvalStats: vi.fn(() => ({ totalTasks: 0, overallSuccessRate: 0, experimentVelocity: 0 })) }))
vi.mock('../../../src/main/evals/collectors/task-outcomes', () => ({ taskOutcomeCollector: { start: vi.fn() } }))
vi.mock('../../../src/main/evals/collectors/pod-quality', () => ({ podQualityCollector: { report: vi.fn() } }))
vi.mock('../../../src/main/evals/harness', () => ({ evalHarness: { reportByAgent: vi.fn(), reportAll: vi.fn() } }))
vi.mock('../../../src/main/evals/reports/weekly-digest', () => ({ generateWeeklyDigest: vi.fn() }))
vi.mock('../../../src/main/evals/collectors/context-usage', () => ({ contextMonitor: { checkAll: vi.fn(), check: vi.fn() } }))
vi.mock('../../../src/main/evals/judges/human-judge', () => ({ spotCheckQueue: { getPending: vi.fn(), sample: vi.fn(), review: vi.fn(), agreement: vi.fn() } }))
vi.mock('../../../src/main/soundboard', () => ({ listSoundboardClips: vi.fn() }))
vi.mock('../../../src/main/veritas-api', () => ({ listVeritasTasks: vi.fn(), getVeritasTaskCounts: vi.fn(), createVeritasTask: vi.fn(), updateVeritasTaskStatus: vi.fn() }))
vi.mock('../../../src/main/paths', () => ({ DOCS_ROOT: '/tmp', getSystemPaths: vi.fn() }))
vi.mock('../../../src/main/data-scripts', () => ({ registerDataScriptHandlers: vi.fn() }))
vi.mock('../../../src/main/config-reader', () => ({
  getConfigSnapshot: vi.fn(),
  addProjectMcpServer: vi.fn(),
  removeProjectMcpServer: vi.fn(),
  addProfileMcpServer: vi.fn(),
  removeProfileMcpServer: vi.fn(),
  updateAgentTools: vi.fn(),
}))

const { registerIpcHandlers } = await import('../../../src/main/ipc')
registerIpcHandlers()

/** Mirrors preload `unwrap` — renderer must keep receiving raw `.data` only. */
function unwrap<T>(result: T): T {
  return (result && typeof result === 'object' && 'data' in result && 'summary' in result)
    ? (result as { data: T }).data
    : result
}

function mockClaudeSession(overrides: Record<string, unknown> = {}) {
  return {
    pid: 1,
    sessionId: 's1',
    project: 'proj',
    cwd: '/tmp/proj',
    startedAt: Date.now(),
    uptime: '1m',
    cpu: '0',
    memoryMB: 100,
    alive: true,
    lastUserMessage: '',
    lastAssistantBlurb: '',
    tty: '/dev/ttys001',
    terminalName: 'term',
    waitingForInput: false,
    sessionMode: 'idle',
    interactionType: 'none',
    subAgentInvocations: [],
    ...overrides,
  }
}

describe('context engineered IPC handlers', () => {
  beforeEach(() => {
    mockGetAgentConfigs.mockReset()
    mockGetAgentConfigs.mockReturnValue([])
    mockGetClaudeSessions.mockReset()
    mockGetClaudeSessions.mockResolvedValue([])
    mockGetCursorAgentSessions.mockReset()
    mockGetCursorAgentSessions.mockResolvedValue([])
    mockGetTaskQueue.mockReset()
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockReset()
    mockListPods.mockReset()
    mockGetPodStatus.mockReset()
    mockSearchVault.mockReset()
    mockReadVaultFile.mockReset()
    mockGetBacklinks.mockReset()
    mockSearchLeads.mockReset()
    mockGetLeadDetail.mockReset()
  })

  it('returns context response shape for all 10 handlers', async () => {
    mockGetClaudeSessions.mockResolvedValue([])
    mockGetCursorAgentSessions.mockResolvedValue([])
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockResolvedValue([])
    mockListPods.mockResolvedValue([])
    mockGetPodStatus.mockResolvedValue({
      id: 'p1', name: 'pod', status: 'solving', iteration: 1, maxIterations: 3, createdAt: Date.now() - 60000, stageHistory: [{ enteredAt: Date.now() - 20000 }],
      solver: { agentId: 'a' }, reviewer: { agentId: 'b' }, executor: { agentId: 'c' },
    })
    mockSearchVault.mockResolvedValue([])
    mockReadVaultFile.mockResolvedValue({ path: 'a.md', content: '#hello [[b]] #tag', mtime: Date.now() })
    mockGetBacklinks.mockResolvedValue([{ title: 'b', path: 'b.md' }])
    mockSearchLeads.mockResolvedValue([{ name: 'Lead A', stage: 'prospecting', score: 72, businessArm: 'dental' }])
    mockGetLeadDetail.mockResolvedValue({ name: 'Lead A', company: 'Acme', score: 72, stage: 'prospecting', ehr: 'x', events: [], documents: [], stageHistory: [] })

    const targets: Array<[string, unknown[]]> = [
      ['agents:statuses', []],
      ['orchestrator:queue', []],
      ['pod:list', []],
      ['vault:search', ['hello']],
      ['orchestrator:agent-health', []],
      ['pod:status', ['p1']],
      ['vault:read', ['a.md']],
      ['sessions:list', []],
      ['leads:search', ['acme']],
      ['leads:detail', ['Lead A']],
    ]

    for (const [channel, args] of targets) {
      const handler = handleMap.get(channel)!
      const payload = await handler({} as never, ...args)
      const response = payload as Record<string, unknown>
      expect(response.data).toBeDefined()
      expect(typeof response.summary).toBe('string')
      const sentenceTerminators = (response.summary as string).match(/(?<!\d)[.!?](?!\d)(?:\s|$)/g) || []
      expect(sentenceTerminators.length, `${channel} summary: ${String(response.summary)}`).toBe(1)
      expect(Array.isArray(response.suggestions)).toBe(true)
      expect(Array.isArray(response.related_tools)).toBe(true)
      if (response.context !== undefined) {
        expect(response.context).toEqual(expect.any(Object))
      }
    }
  })

  it('graph:search-leads returns the same engineered shape as leads:search', async () => {
    mockSearchLeads.mockResolvedValue([])
    const graphHandler = handleMap.get('graph:search-leads')!
    const leadsHandler = handleMap.get('leads:search')!
    const g = await graphHandler({} as never, 'q') as Record<string, unknown>
    const l = await leadsHandler({} as never, 'q') as Record<string, unknown>
    expect(g.summary).toBe(l.summary)
    expect(g.suggestions).toEqual(l.suggestions)
  })

  it('varies queue suggestions based on idle capacity', async () => {
    const handler = handleMap.get('orchestrator:queue')!
    mockGetTaskQueue.mockReturnValue([{ priority: 'critical', status: 'queued', createdAt: Date.now() - 120000 }])
    mockGetAgentHealthStatuses.mockResolvedValue([{ agentId: 'a1', alive: true, activeTasks: 0 }])
    const withIdle = await handler({} as never) as { suggestions: string[] }

    mockGetTaskQueue.mockReturnValue([{ priority: 'critical', status: 'queued', createdAt: Date.now() - 120000 }])
    mockGetAgentHealthStatuses.mockResolvedValue([{ agentId: 'a1', alive: true, activeTasks: 2 }])
    const noIdle = await handler({} as never) as { suggestions: string[] }

    expect(withIdle.suggestions.join(' ')).toContain('pod:create')
    expect(noIdle.suggestions.join(' ').toLowerCase()).toContain('no idle agents')
  })

  it('registers graph channel aliases', () => {
    expect(handleMap.get('graph:search-leads')).toBeTruthy()
    expect(handleMap.get('graph:lead-detail')).toBeTruthy()
  })

  it('capabilities:status returns aggregator payload from computeCapabilitiesStatus', async () => {
    const handler = handleMap.get('capabilities:status')!
    const result = await handler({} as never) as {
      updatedAt: string
      overall: string
      items: Record<string, unknown>
      facets: { graph_orchestrator: Record<string, unknown>; evals_vault: Record<string, unknown> }
    }
    expect(result).not.toHaveProperty('error')
    expect(typeof result.updatedAt).toBe('string')
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.overall).toBe('unknown')
    expect(result.items).toEqual({})
    expect(Object.keys(result.items).length).toBe(0)
    expect(result.facets).toEqual({ graph_orchestrator: {}, evals_vault: {} })
    expect(mockComputeCapabilitiesStatus).toHaveBeenCalled()
  })

  it('unwrap yields legacy data for each target handler', async () => {
    mockGetClaudeSessions.mockResolvedValue([])
    mockGetCursorAgentSessions.mockResolvedValue([])
    mockGetTaskQueue.mockReturnValue([])
    mockGetAgentHealthStatuses.mockResolvedValue([])
    mockListPods.mockResolvedValue([])
    mockGetPodStatus.mockResolvedValue({
      id: 'p1', name: 'pod', status: 'solving', iteration: 1, maxIterations: 3, createdAt: Date.now() - 60000,
      stageHistory: [{ stage: 'solving', enteredAt: Date.now() - 20000 }],
      solver: { agentId: 'a' }, reviewer: { agentId: 'b' }, executor: { agentId: 'c' },
      task: 't', cwd: '/x', artifacts: [], solverCandidateCount: 0, selfFixAttempts: 0, maxSelfFixes: 0, updatedAt: Date.now(),
    })
    mockSearchVault.mockResolvedValue([])
    mockReadVaultFile.mockResolvedValue({ path: 'a.md', content: 'x', mtime: 1 })
    mockGetBacklinks.mockResolvedValue([])
    mockSearchLeads.mockResolvedValue([])
    mockGetLeadDetail.mockResolvedValue(null)

    const cases: Array<[string, unknown[], unknown]> = [
      ['agents:statuses', [], []],
      ['orchestrator:queue', [], []],
      ['pod:list', [], []],
      ['vault:search', ['q'], []],
      ['orchestrator:agent-health', [], []],
      ['vault:read', ['a.md'], { path: 'a.md', content: 'x', mtime: 1 }],
      ['sessions:list', [], []],
      ['leads:search', ['q'], []],
      ['leads:detail', ['n'], null],
    ]

    for (const [channel, args, expected] of cases) {
      const handler = handleMap.get(channel)!
      const payload = await handler({} as never, ...args)
      expect(unwrap(payload)).toEqual(expected)
    }

    const podHandler = handleMap.get('pod:status')!
    const podPayload = await podHandler({} as never, 'p1')
    const pod = unwrap(podPayload) as { id: string }
    expect(pod.id).toBe('p1')
  })

  it('agents:statuses suggestions differ for blocked vs all busy', async () => {
    const handler = handleMap.get('agents:statuses')!
    mockGetClaudeSessions.mockResolvedValue([
      mockClaudeSession({ pid: 1, cpu: '0', interactionType: 'tool-approval', tty: '/dev/tty1' }),
    ])
    const blocked = await handler({} as never) as { suggestions: string[] }
    expect(blocked.suggestions.some(s => s.includes('approval'))).toBe(true)

    mockGetClaudeSessions.mockResolvedValue([
      mockClaudeSession({ pid: 1, cpu: '5', interactionType: 'none' }),
      mockClaudeSession({ pid: 2, cpu: '8', interactionType: 'none' }),
    ])
    const allBusy = await handler({} as never) as { suggestions: string[] }
    expect(allBusy.suggestions.some(s => s.includes('All agents busy'))).toBe(true)
  })

  it('sessions:list suggestions differ for empty vs waiting-for-input', async () => {
    const handler = handleMap.get('sessions:list')!
    mockGetClaudeSessions.mockResolvedValue([])
    mockGetCursorAgentSessions.mockResolvedValue([])
    const empty = await handler({} as never) as { suggestions: string[] }
    expect(empty.suggestions.some(s => s.includes('No active sessions'))).toBe(true)

    mockGetClaudeSessions.mockResolvedValue([
      mockClaudeSession({ waitingForInput: true, tty: '/dev/tty1', cpu: '0.5' }),
    ])
    const waiting = await handler({} as never) as { suggestions: string[] }
    expect(waiting.suggestions.some(s => s.includes('waiting for input'))).toBe(true)
  })

  it('vault:search suggestions differ for empty vs multi-folder results', async () => {
    const handler = handleMap.get('vault:search')!
    mockSearchVault.mockResolvedValue([])
    const none = await handler({} as never, 'q') as { suggestions: string[] }
    expect(none.suggestions.some(s => s.includes('Read specific files'))).toBe(true)
    expect(none.suggestions.some(s => s.includes('Results span'))).toBe(false)

    mockSearchVault.mockResolvedValue([
      { path: 'A/x.md', line: 1, text: 'a #tag' },
      { path: 'B/y.md', line: 2, text: 'b' },
    ])
    const multi = await handler({} as never, 'q') as { suggestions: string[] }
    expect(multi.suggestions.some(s => s.includes('Results span'))).toBe(true)
  })

  it('leads:search suggestions differ for no results vs matches', async () => {
    const handler = handleMap.get('leads:search')!
    mockSearchLeads.mockResolvedValue([])
    const empty = await handler({} as never, 'zzz') as { suggestions: string[] }
    expect(empty.suggestions.some(s => s.includes('No results'))).toBe(true)

    mockSearchLeads.mockResolvedValue([{ name: 'L', stage: 'prospecting', score: 80, businessArm: 'dental' }])
    const hits = await handler({} as never, 'dental') as { suggestions: string[] }
    expect(hits.suggestions.some(s => s.includes('Top lead') || s.includes('high-scoring'))).toBe(true)
  })

  it('leads:detail suggestions differ for missing vs stale lead', async () => {
    const handler = handleMap.get('leads:detail')!
    mockGetLeadDetail.mockResolvedValue(null)
    const missing = await handler({} as never, 'nobody') as { suggestions: string[] }
    expect(missing.suggestions).toEqual(['Search via leads:search to find available leads.'])

    const staleDate = new Date(Date.now() - 20 * 86400000).toISOString()
    mockGetLeadDetail.mockResolvedValue({
      name: 'L', company: 'C', score: 50, stage: 'prospecting', ehr: '', location: '', nextAction: '', source: '', npi: '', phone: '', specialty: '', website: '',
      events: [{ type: 'note', date: staleDate, detail: 'x' }],
      documents: [],
      stageHistory: [],
    })
    const stale = await handler({} as never, 'L') as { suggestions: string[] }
    expect(stale.suggestions.some(s => s.includes('No activity') || s.includes('follow-up'))).toBe(true)
  })

  it('pod:list suggestions differ for empty vs failed pods', async () => {
    const handler = handleMap.get('pod:list')!
    mockListPods.mockResolvedValue([])
    const empty = await handler({} as never) as { suggestions: string[] }
    expect(empty.suggestions.some(s => s.includes('No active pods'))).toBe(true)

    mockListPods.mockResolvedValue([
      {
        id: '1', name: 'n', status: 'failed', task: 't', cwd: '/x', iteration: 2, maxIterations: 3,
        solver: { agentId: 'a' }, reviewer: { agentId: 'b' }, executor: { agentId: 'c' },
        artifacts: [], solverCandidateCount: 0, selfFixAttempts: 0, maxSelfFixes: 0, createdAt: 1, updatedAt: 1, stageHistory: [],
      },
    ])
    const failed = await handler({} as never) as { suggestions: string[] }
    expect(failed.suggestions.some(s => s.includes('failed pod'))).toBe(true)
  })

  it('orchestrator:agent-health suggestions differ when healthy vs dead', async () => {
    const handler = handleMap.get('orchestrator:agent-health')!
    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'a1', name: 'A', alive: true, activeTasks: 0, status: 'healthy', warnings: [] },
    ])
    const ok = await handler({} as never) as { suggestions: string[]; context: { recommendations: unknown[] } }
    expect(ok.suggestions.some(s => s.includes('All agents healthy'))).toBe(true)
    expect((ok.context.recommendations as unknown[]).length).toBe(0)

    mockGetAgentHealthStatuses.mockResolvedValue([
      { agentId: 'a1', name: 'A', alive: false, activeTasks: 0, status: 'dead', warnings: [] },
    ])
    const bad = await handler({} as never) as { suggestions: string[]; context: { recommendations: unknown[] } }
    expect(bad.suggestions.some(s => s.includes('restart'))).toBe(true)
    expect((bad.context.recommendations as unknown[]).length).toBeGreaterThan(0)
  })

  it('vault:read unwrap is null when file missing', async () => {
    const handler = handleMap.get('vault:read')!
    mockReadVaultFile.mockResolvedValue(null)
    mockGetBacklinks.mockResolvedValue([])
    const payload = await handler({} as never, 'missing.md')
    expect(unwrap(payload)).toBeNull()
  })

  it('pod:status unwrap is null when workflow missing', async () => {
    const handler = handleMap.get('pod:status')!
    mockGetPodStatus.mockResolvedValue(null)
    expect(unwrap(await handler({} as never, 'bad-id'))).toBeNull()
  })
})
