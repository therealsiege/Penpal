const DEFAULT_VERITAS_API_URL = 'http://127.0.0.1:47832/api'

export type VeritasTaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type VeritasTaskPriority = 'low' | 'medium' | 'high'

export interface VeritasTaskSummary {
  id: string
  title: string
  description?: string
  status: VeritasTaskStatus
  priority: VeritasTaskPriority
  type?: string
  project?: string
  sprint?: string
  agent?: string
  created?: string
  updated?: string
  blockedBy?: string[]
}

export interface VeritasTaskCounts {
  backlog: number
  todo: number
  'in-progress': number
  blocked: number
  done: number
  archived: number
}

function getVeritasApiUrl(): string {
  return (process.env.PENNY_VERITAS_API_URL || DEFAULT_VERITAS_API_URL).replace(/\/+$/, '')
}

function getApiHeaders(includeJson = false): Record<string, string> {
  const apiKey =
    process.env.PENNY_VERITAS_AGENT_KEY ||
    process.env.PENNY_VERITAS_ADMIN_KEY ||
    process.env.VERITAS_ADMIN_KEY
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  }
}

async function veritasRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const baseUrl = getVeritasApiUrl()
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const res = await fetch(`${baseUrl}${normalized}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...getApiHeaders(Boolean(init?.body)),
      ...(init?.headers || {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(12_000),
  })

  const raw = await res.text()
  let payload: unknown = null
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `${res.status} ${res.statusText}`
    throw new Error(`Veritas API request failed: ${message}`)
  }

  return payload as T
}

function normalizeTask(task: unknown): VeritasTaskSummary | null {
  if (!task || typeof task !== 'object') return null
  const record = task as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  const title = typeof record.title === 'string' ? record.title : ''
  const status = typeof record.status === 'string' ? record.status : ''
  const priority = typeof record.priority === 'string' ? record.priority : ''
  if (!id || !title || !['todo', 'in-progress', 'blocked', 'done'].includes(status)) return null
  if (!['low', 'medium', 'high'].includes(priority)) return null

  return {
    id,
    title,
    description: typeof record.description === 'string' ? record.description : undefined,
    status: status as VeritasTaskStatus,
    priority: priority as VeritasTaskPriority,
    type: typeof record.type === 'string' ? record.type : undefined,
    project: typeof record.project === 'string' ? record.project : undefined,
    sprint: typeof record.sprint === 'string' ? record.sprint : undefined,
    agent: typeof record.agent === 'string' ? record.agent : undefined,
    created: typeof record.created === 'string' ? record.created : undefined,
    updated: typeof record.updated === 'string' ? record.updated : undefined,
    blockedBy: Array.isArray(record.blockedBy)
      ? record.blockedBy.filter((v): v is string => typeof v === 'string')
      : undefined,
  }
}

function normalizeTaskList(payload: unknown): VeritasTaskSummary[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeTask).filter((t): t is VeritasTaskSummary => Boolean(t))
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.tasks)) {
      return record.tasks.map(normalizeTask).filter((t): t is VeritasTaskSummary => Boolean(t))
    }
    if (Array.isArray(record.data)) {
      return record.data.map(normalizeTask).filter((t): t is VeritasTaskSummary => Boolean(t))
    }
  }
  return []
}

export async function listVeritasTasks(status?: VeritasTaskStatus): Promise<VeritasTaskSummary[]> {
  const params = new URLSearchParams({ view: 'summary' })
  if (status) params.set('status', status)
  const payload = await veritasRequest<unknown>(`/tasks?${params.toString()}`)
  const tasks = normalizeTaskList(payload)
  return tasks.sort((a, b) => {
    const aTime = new Date(a.updated || a.created || 0).getTime()
    const bTime = new Date(b.updated || b.created || 0).getTime()
    return bTime - aTime
  })
}

export async function getVeritasTaskCounts(): Promise<VeritasTaskCounts> {
  const payload = await veritasRequest<unknown>('/tasks/counts')
  const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  return {
    backlog: Number(record.backlog || 0),
    todo: Number(record.todo || 0),
    'in-progress': Number(record['in-progress'] || 0),
    blocked: Number(record.blocked || 0),
    done: Number(record.done || 0),
    archived: Number(record.archived || 0),
  }
}

export async function createVeritasTask(input: {
  title: string
  description?: string
  project?: string
  priority?: VeritasTaskPriority
  type?: string
}): Promise<VeritasTaskSummary> {
  const payload = await veritasRequest<unknown>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      description: input.description || '',
      project: input.project,
      priority: input.priority || 'medium',
      type: input.type || 'code',
    }),
  })
  const task = normalizeTask(payload)
  if (!task) throw new Error('Unexpected response while creating Veritas task.')
  return task
}

export async function updateVeritasTaskStatus(
  taskId: string,
  status: VeritasTaskStatus,
): Promise<VeritasTaskSummary> {
  const payload = await veritasRequest<unknown>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  const task = normalizeTask(payload)
  if (!task) throw new Error('Unexpected response while updating Veritas task status.')
  return task
}
