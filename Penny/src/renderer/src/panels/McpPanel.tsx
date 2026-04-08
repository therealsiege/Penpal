import { useState, useEffect, useCallback } from 'react'
import { PanelBackground } from '../components/PanelBackground'

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncTarget = 'claude-global' | 'claude-project' | 'cursor'
type Transport = 'stdio' | 'sse' | 'url'

interface McpServer {
  id: string
  name: string
  transport: Transport
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled: boolean
  targets: SyncTarget[]
  notes?: string
}

interface MasterConfig {
  version: number
  servers: McpServer[]
}

interface HealthResult {
  status: 'healthy' | 'unreachable' | 'error'
  latencyMs: number
  error?: string
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function maskValue(v: string): string {
  if (v.length <= 9) return '•'.repeat(v.length)
  return v.slice(0, 4) + '...' + v.slice(-5)
}

function generateId(): string {
  return `server-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-deep)] ${
        enabled ? 'bg-[var(--c-accent)]' : 'bg-[var(--c-bg-elevated)]'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function TransportBadge({ transport }: { transport: Transport }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${
        transport === 'stdio'
          ? 'bg-[color-mix(in_srgb,var(--c-accent)_15%,transparent)] text-[var(--c-accent)]'
          : 'bg-[color-mix(in_srgb,#f59e0b_15%,transparent)] text-[#f59e0b]'
      }`}
    >
      {transport}
    </span>
  )
}

function TargetBadge({ target }: { target: SyncTarget }) {
  const labels: Record<SyncTarget, string> = {
    'claude-global': 'global',
    'claude-project': 'project',
    cursor: 'cursor',
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono bg-[var(--c-bg-elevated)] text-[var(--c-text-dim)]">
      {labels[target]}
    </span>
  )
}

function HealthDot({ result }: { result?: HealthResult }) {
  if (!result) return <span className="w-2 h-2 rounded-full bg-[var(--c-bg-elevated)] inline-block" />
  const color =
    result.status === 'healthy'
      ? 'bg-green-500'
      : result.status === 'unreachable'
        ? 'bg-yellow-500'
        : 'bg-red-500'
  return (
    <span
      title={result.error ?? `${result.latencyMs}ms`}
      className={`w-2 h-2 rounded-full inline-block ${color}`}
    />
  )
}

// ── Env Var Editor ────────────────────────────────────────────────────────────

function EnvEditor({
  env,
  onChange,
}: {
  env: Record<string, string>
  onChange: (env: Record<string, string>) => void
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const entries = Object.entries(env)

  const toggleReveal = (k: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const updateKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(env)) {
      next[k === oldKey ? newKey : k] = v
    }
    onChange(next)
  }

  const updateVal = (k: string, v: string) => {
    onChange({ ...env, [k]: v })
  }

  const remove = (k: string) => {
    const next = { ...env }
    delete next[k]
    onChange(next)
  }

  const add = () => {
    onChange({ ...env, '': '' })
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            className="flex-1 rounded-lg bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-2.5 py-1.5 text-xs text-[var(--c-text-primary)] font-mono placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
            placeholder="KEY"
            value={k}
            onChange={(e) => updateKey(k, e.target.value)}
          />
          <input
            className="flex-[2] rounded-lg bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-2.5 py-1.5 text-xs text-[var(--c-text-primary)] font-mono placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
            placeholder="value"
            type={revealed.has(k) ? 'text' : 'password'}
            value={v}
            onChange={(e) => updateVal(k, e.target.value)}
          />
          <button
            type="button"
            onClick={() => toggleReveal(k)}
            title={revealed.has(k) ? 'Hide' : 'Reveal'}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--c-text-dim)] hover:text-[var(--c-text-primary)] hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            {revealed.has(k) ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => remove(k)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--c-text-dim)] hover:text-red-400 hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-[var(--c-accent)] hover:opacity-80 transition-opacity flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add variable
      </button>
    </div>
  )
}

// ── Template Picker ───────────────────────────────────────────────────────────

function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: McpServer[]
  onSelect: (t: McpServer) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 bg-[color-mix(in_srgb,var(--c-bg-deep)_85%,transparent)] backdrop-blur-sm flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-xl bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
          <h3 className="text-sm font-semibold text-[var(--c-text-primary)]">Add from Template</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--c-text-dim)] hover:text-[var(--c-text-primary)] hover:bg-[var(--c-bg-elevated)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--c-text-dim)] text-center">
            All templates are already added.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto p-3 grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className="text-left p-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-bg-elevated)] hover:border-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] transition-all group"
              >
                <div className="text-sm font-semibold text-[var(--c-text-primary)] group-hover:text-[var(--c-accent)] mb-1">
                  {t.name}
                </div>
                <div className="text-xs text-[var(--c-text-dim)] line-clamp-2">{t.notes}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

const ALL_TARGETS: SyncTarget[] = ['claude-global', 'claude-project', 'cursor']

const EMPTY_SERVER: Omit<McpServer, 'id'> = {
  name: '',
  transport: 'stdio',
  command: '',
  args: [],
  env: {},
  enabled: true,
  targets: ['claude-global'],
  notes: '',
}

export function McpPanel() {
  const [config, setConfig] = useState<MasterConfig>({ version: 1, servers: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<McpServer | null>(null)
  const [dirty, setDirty] = useState(false)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({})
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<McpServer[]>([])
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const cfg = await window.api.mcpList() as MasterConfig
    setConfig(cfg)
    setDirty(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectServer = (id: string) => {
    const server = config.servers.find((s) => s.id === id)
    if (!server) return
    setSelectedId(id)
    setEditForm({ ...server })
    setConfirmDelete(false)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await window.api.mcpImport() as { imported: number; skipped: number; conflicts: string[] }
      await load()
      if (result.imported > 0) {
        setSyncResult(`Imported ${result.imported} servers${result.conflicts.length > 0 ? ` (${result.conflicts.length} merged)` : ''}`)
      } else {
        setSyncResult('Nothing to import — master config already has entries')
      }
      setTimeout(() => setSyncResult(null), 4000)
    } finally {
      setImporting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await window.api.mcpSync() as Record<string, { written: number; path: string }>
      const total = Object.values(result).reduce((sum, r) => sum + r.written, 0)
      setSyncResult(`Synced ${total} server entries across ${Object.keys(result).length} targets`)
      setTimeout(() => setSyncResult(null), 4000)
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async () => {
    if (!editForm) return
    setSaving(true)
    try {
      const updatedServers = config.servers.map((s) => (s.id === editForm.id ? editForm : s))
      const newConfig: MasterConfig = { ...config, servers: updatedServers }
      await window.api.mcpSave(newConfig)
      setConfig(newConfig)
      setDirty(true)
      setSyncResult('Saved. Click Sync to push changes to config files.')
      setTimeout(() => setSyncResult(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  const handleAddNew = () => {
    const newServer: McpServer = { ...EMPTY_SERVER, id: generateId() }
    const newConfig: MasterConfig = { ...config, servers: [...config.servers, newServer] }
    setConfig(newConfig)
    setSelectedId(newServer.id)
    setEditForm({ ...newServer })
    setConfirmDelete(false)
  }

  const handleDelete = async () => {
    if (!editForm) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const newConfig: MasterConfig = {
      ...config,
      servers: config.servers.filter((s) => s.id !== editForm.id),
    }
    await window.api.mcpSave(newConfig)
    setConfig(newConfig)
    setSelectedId(null)
    setEditForm(null)
    setConfirmDelete(false)
    setDirty(true)
  }

  const handleToggle = async (id: string) => {
    const updated = config.servers.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s,
    )
    const newConfig: MasterConfig = { ...config, servers: updated }
    await window.api.mcpSave(newConfig)
    setConfig(newConfig)
    if (editForm?.id === id) setEditForm((f) => f ? { ...f, enabled: !f.enabled } : f)
    setDirty(true)
  }

  const handleHealthCheck = async () => {
    if (!selectedId) return
    setCheckingHealth(selectedId)
    try {
      const result = await window.api.mcpHealthCheck(selectedId) as HealthResult
      setHealthResults((prev) => ({ ...prev, [selectedId]: result }))
    } finally {
      setCheckingHealth(null)
    }
  }

  const handleOpenTemplates = async () => {
    const tmpl = await window.api.mcpTemplates() as McpServer[]
    setTemplates(tmpl)
    setShowTemplates(true)
  }

  const handleSelectTemplate = (t: McpServer) => {
    const newServer: McpServer = { ...t, id: generateId() }
    const newConfig: MasterConfig = { ...config, servers: [...config.servers, newServer] }
    setConfig(newConfig)
    setSelectedId(newServer.id)
    setEditForm({ ...newServer })
    setShowTemplates(false)
    setConfirmDelete(false)
  }

  const updateForm = (patch: Partial<McpServer>) => {
    setEditForm((f) => f ? { ...f, ...patch } : f)
  }

  const toggleTarget = (target: SyncTarget) => {
    if (!editForm) return
    const targets = editForm.targets.includes(target)
      ? editForm.targets.filter((t) => t !== target)
      : [...editForm.targets, target]
    updateForm({ targets })
  }

  return (
    <PanelBackground>
      <div className="relative flex h-full overflow-hidden">
        {/* ── Server List (left column) ── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-[var(--c-border)] bg-[var(--c-bg-deep)]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--c-text-primary)]">MCP Servers</h2>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--c-bg-elevated)] text-[10px] font-mono text-[var(--c-text-dim)]">
                {config.servers.length}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 border-b border-[var(--c-border)] flex gap-1.5">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              title="Import from ~/.mcp.json and ~/sidekick/.mcp.json"
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text-primary)] hover:border-[var(--c-accent)] transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              title="Push enabled servers to all target config files"
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-accent)] hover:border-[var(--c-accent)] transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync All'}
            </button>
          </div>

          {/* Status message */}
          {syncResult && (
            <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg bg-[color-mix(in_srgb,var(--c-accent)_10%,transparent)] text-[10px] text-[var(--c-accent)]">
              {syncResult}
            </div>
          )}

          {/* Dirty banner */}
          {dirty && (
            <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg bg-[color-mix(in_srgb,#f59e0b_10%,transparent)] text-[10px] text-[#f59e0b]">
              Unsaved changes — restart Claude Code to pick up new servers after Sync.
            </div>
          )}

          {/* Server list */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {config.servers.length === 0 && (
              <p className="px-4 py-6 text-xs text-[var(--c-text-dim)] text-center">
                No servers configured.<br />Click Import or Add Server.
              </p>
            )}
            {config.servers.map((server) => (
              <button
                key={server.id}
                type="button"
                onClick={() => selectServer(server.id)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${
                  selectedId === server.id
                    ? 'bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] border-l-2 border-[var(--c-accent)]'
                    : 'border-l-2 border-transparent hover:bg-[var(--c-bg-elevated)]'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  <ToggleSwitch
                    enabled={server.enabled}
                    onToggle={() => handleToggle(server.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--c-text-primary)] truncate">
                      {server.name || <span className="italic text-[var(--c-text-dim)]">unnamed</span>}
                    </span>
                    <HealthDot result={healthResults[server.id]} />
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <TransportBadge transport={server.transport} />
                    {server.targets.map((t) => (
                      <TargetBadge key={t} target={t} />
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="px-3 py-2 border-t border-[var(--c-border)] flex gap-1.5">
            <button
              type="button"
              onClick={handleAddNew}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-dashed border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-accent)] hover:border-[var(--c-accent)] transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Server
            </button>
            <button
              type="button"
              onClick={handleOpenTemplates}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-dashed border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-accent)] hover:border-[var(--c-accent)] transition-colors"
            >
              From Template
            </button>
          </div>
        </div>

        {/* ── Detail / Edit Column (right) ── */}
        <div className="flex-1 overflow-y-auto">
          {!editForm ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--c-text-dim)]">
              <svg className="w-12 h-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="M7 8h.01M11 8h.01M15 8h.01" />
              </svg>
              <p className="text-sm">Select a server to edit</p>
              <p className="text-xs mt-1 opacity-70">or click Add Server to create a new one</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
              {/* Name + Transport */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">Name</span>
                  <input
                    className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
                    placeholder="server-name"
                    value={editForm.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">Transport</span>
                  <select
                    className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] focus:outline-none focus:border-[var(--c-accent)]"
                    value={editForm.transport}
                    onChange={(e) => updateForm({ transport: e.target.value as Transport })}
                  >
                    <option value="stdio">stdio</option>
                    <option value="sse">sse / url</option>
                  </select>
                </label>
              </div>

              {/* Command / URL */}
              {editForm.transport === 'stdio' ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">Command</span>
                    <input
                      className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] font-mono placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
                      placeholder="npx"
                      value={editForm.command ?? ''}
                      onChange={(e) => updateForm({ command: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">Args (comma-separated)</span>
                    <input
                      className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] font-mono placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
                      placeholder="-y, @org/package-name"
                      value={(editForm.args ?? []).join(', ')}
                      onChange={(e) =>
                        updateForm({
                          args: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">URL</span>
                  <input
                    className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] font-mono placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)]"
                    placeholder="https://..."
                    value={editForm.url ?? ''}
                    onChange={(e) => updateForm({ url: e.target.value })}
                  />
                </label>
              )}

              {/* Env Vars */}
              <div>
                <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider block mb-2">
                  Environment Variables
                </span>
                <div className="rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] p-3">
                  <EnvEditor
                    env={editForm.env ?? {}}
                    onChange={(env) => updateForm({ env })}
                  />
                </div>
                {editForm.env && Object.keys(editForm.env).length > 0 && (
                  <p className="mt-1.5 text-[10px] text-[var(--c-text-dim)]">
                    Preview: {maskValue(Object.values(editForm.env)[0] ?? '')}
                  </p>
                )}
              </div>

              {/* Targets */}
              <div>
                <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider block mb-2">
                  Sync Targets
                </span>
                <div className="flex gap-3 flex-wrap">
                  {ALL_TARGETS.map((target) => (
                    <label key={target} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-[var(--c-accent)]"
                        checked={editForm.targets.includes(target)}
                        onChange={() => toggleTarget(target)}
                      />
                      <span className="text-xs text-[var(--c-text-primary)]">{target}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <label className="block">
                <span className="text-xs font-semibold text-[var(--c-text-dim)] uppercase tracking-wider">Notes</span>
                <textarea
                  className="mt-1.5 w-full rounded-xl bg-[var(--c-bg-deep)] border border-[var(--c-border)] px-3 py-2 text-sm text-[var(--c-text-primary)] placeholder:text-[var(--c-text-dim)] focus:outline-none focus:border-[var(--c-accent)] resize-none"
                  rows={2}
                  placeholder="Optional description or setup notes"
                  value={editForm.notes ?? ''}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                />
              </label>

              {/* Health check */}
              {editForm.transport === 'stdio' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleHealthCheck}
                    disabled={checkingHealth === selectedId}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text-primary)] hover:border-[var(--c-accent)] transition-colors disabled:opacity-50"
                  >
                    {checkingHealth === selectedId ? 'Checking…' : 'Health Check'}
                  </button>
                  {selectedId && healthResults[selectedId] && (
                    <div className="flex items-center gap-2">
                      <HealthDot result={healthResults[selectedId]} />
                      <span className="text-xs text-[var(--c-text-dim)]">
                        {healthResults[selectedId].status}
                        {healthResults[selectedId].latencyMs > 0 &&
                          ` · ${healthResults[selectedId].latencyMs}ms`}
                        {healthResults[selectedId].error &&
                          ` · ${healthResults[selectedId].error}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Save / Delete */}
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--c-border)]">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[var(--c-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    confirmDelete
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-red-400 hover:border-red-400'
                  }`}
                >
                  {confirmDelete ? 'Confirm Delete' : 'Delete'}
                </button>
                {confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-[var(--c-text-dim)] hover:text-[var(--c-text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Template Picker Overlay ── */}
        {showTemplates && (
          <TemplatePicker
            templates={templates}
            onSelect={handleSelectTemplate}
            onClose={() => setShowTemplates(false)}
          />
        )}
      </div>
    </PanelBackground>
  )
}
