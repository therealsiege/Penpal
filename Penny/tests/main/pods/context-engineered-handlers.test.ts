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
  getGraphStats: vi.fn(),
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
vi.mock('../../../src/main/agents', () => ({ getAgentConfigs: vi.fn(() => []), getAgentConfig: vi.fn(), loadAgentSessionMap: vi.fn(() => ({})), removeAgentSession: vi.fn() }))
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

describe('context engineered IPC handlers', () => {
  beforeEach(() => {
    mockGetClaudeSessions.mockReset()
    mockGetCursorAgentSessions.mockReset()
    mockGetTaskQueue.mockReset()
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
    mockGetTaskQueue.mockResolvedValue([])
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
      expect((response.summary as string).split('.').filter(Boolean).length).toBe(1)
      expect(Array.isArray(response.suggestions)).toBe(true)
      expect(Array.isArray(response.related_tools)).toBe(true)
    }
  })

  it('varies queue suggestions based on idle capacity', async () => {
    const handler = handleMap.get('orchestrator:queue')!
    mockGetTaskQueue.mockResolvedValue([{ priority: 'critical', status: 'queued', createdAt: Date.now() - 120000 }])
    mockGetAgentHealthStatuses.mockResolvedValue([{ agentId: 'a1', alive: true, activeTasks: 0 }])
    const withIdle = await handler({} as never) as { suggestions: string[] }

    mockGetTaskQueue.mockResolvedValue([{ priority: 'critical', status: 'queued', createdAt: Date.now() - 120000 }])
    mockGetAgentHealthStatuses.mockResolvedValue([{ agentId: 'a1', alive: true, activeTasks: 2 }])
    const noIdle = await handler({} as never) as { suggestions: string[] }

    expect(withIdle.suggestions.join(' ')).toContain('pod:create')
    expect(noIdle.suggestions.join(' ').toLowerCase()).toContain('no idle agents')
  })

  it('registers graph channel aliases', () => {
    expect(handleMap.get('graph:search-leads')).toBeTruthy()
    expect(handleMap.get('graph:lead-detail')).toBeTruthy()
  })
})
