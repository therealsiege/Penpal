import { useState, useEffect } from 'react'
import { PanelBackground } from '../components/PanelBackground'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  targets: Array<'claude-global' | 'claude-project' | 'cursor' | 'vscode'>
  notes?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function McpPanel() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const loadServers = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await window.api.listMcpServers()
      if (response.success && response.data) {
        setServers(response.data)
      } else {
        setLoadError(response.error || 'Failed to load servers')
      }
    } catch (err) {
      setLoadError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServers()
  }, [])

  const handleImport = async () => {
    setIsImporting(true)
    setActionError(null)
    try {
      const response = await window.api.importMcpConfigs()
      if (response.success) {
        const loadResponse = await window.api.listMcpServers()
        if (loadResponse.success && loadResponse.data) {
          setServers(loadResponse.data)
        } else if (loadResponse.error) {
          setActionError(loadResponse.error)
        }
      } else {
        setActionError(response.error || 'Import failed')
      }
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setIsImporting(false)
    }
  }

  const toggleServer = async (id: string, enabled: boolean) => {
    setPendingId(id)
    setActionError(null)
    try {
      const response = await window.api.toggleMcpServer(id, enabled)
      if (response.success) {
        setServers(prev => prev.map(server =>
          server.id === id ? { ...server, enabled } : server
        ))
      } else {
        setActionError(response.error || 'Failed to toggle server')
      }
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  const deleteServer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return

    setPendingId(id)
    setActionError(null)
    try {
      const response = await window.api.deleteMcpServer(id)
      if (response.success) {
        setServers(prev => prev.filter(server => server.id !== id))
        if (selectedServer?.id === id) {
          setSelectedServer(null)
        }
      } else {
        setActionError(response.error || 'Failed to delete server')
      }
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  if (loading) {
    return (
      <PanelBackground>
        <div className="h-full flex items-center justify-center">
          <div className="text-[1.1rem] text-[var(--c-text-primary)]">Loading MCP servers...</div>
        </div>
      </PanelBackground>
    )
  }

  if (loadError) {
    return (
      <PanelBackground>
        <div className="h-full flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="text-[1.1rem] text-[var(--c-text-primary)] mb-3">Failed to load MCP servers</div>
            <div className="text-sm text-[var(--c-text-muted)] mb-4 break-words">{loadError}</div>
            <button
              onClick={loadServers}
              className="px-4 py-2 bg-[var(--c-accent)] text-white rounded-lg hover:bg-[color-mix(in_srgb,var(--c-accent)_90%,transparent)] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </PanelBackground>
    )
  }

  return (
    <PanelBackground>
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[1.5rem] font-bold text-[var(--c-text-heading)]">MCP Server Management</h1>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="px-4 py-2 bg-[var(--c-accent)] text-white rounded-lg hover:bg-[color-mix(in_srgb,var(--c-accent)_90%,transparent)] transition-colors disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Import Existing Configs'}
            </button>
          </div>

          <div className="mb-6 text-[var(--c-text-primary)]">
            <p className="mb-2">Manage your MCP (Model Context Protocol) servers in one unified place.</p>
            <p>Configs are synced to target files (Claude, Cursor, etc.) when changed.</p>
          </div>

          {actionError && (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="break-words">{actionError}</div>
              <button
                onClick={() => setActionError(null)}
                className="shrink-0 px-2 py-1 text-xs text-red-700 hover:bg-red-100 rounded"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mb-6 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
            <h2 className="text-[1.2rem] font-semibold text-[var(--c-text-heading)] mb-3">Active Servers ({servers.filter(s => s.enabled).length})</h2>
            
            {servers.length === 0 ? (
              <div className="text-center py-8 text-[var(--c-text-muted)]">
                No MCP servers configured yet. Import existing configs or add new ones below.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servers.map(server => (
                  <div 
                    key={server.id} 
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedServer?.id === server.id 
                        ? 'border-[var(--c-accent)] bg-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]' 
                        : 'border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] bg-[var(--c-bg-surface)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_85%,transparent)]'
                    }`}
                    onClick={() => setSelectedServer(server)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-[var(--c-text-heading)]">{server.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          server.transport === 'stdio' 
                            ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                            : 'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {server.transport}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          server.enabled 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {server.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--c-text-muted)] mb-2 truncate">{server.command} {server.args.join(' ')}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-[var(--c-text-faint)]">
                        Targets: {server.targets.join(', ')}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleServer(server.id, !server.enabled)
                        }}
                        disabled={pendingId === server.id}
                        className={`px-3 py-1 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          server.enabled
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {pendingId === server.id ? '...' : server.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedServer && (
            <div className="mb-6 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-[1.2rem] font-semibold text-[var(--c-text-heading)]">Server Details: {selectedServer.name}</h2>
                <button
                  onClick={() => {
                    deleteServer(selectedServer.id)
                  }}
                  disabled={pendingId === selectedServer.id}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingId === selectedServer.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-[var(--c-text-heading)] mb-2">Configuration</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm text-[var(--c-text-muted)]">Name</label>
                      <div className="text-[var(--c-text-primary)]">{selectedServer.name}</div>
                    </div>
                    <div>
                      <label className="text-sm text-[var(--c-text-muted)]">Transport</label>
                      <div className="text-[var(--c-text-primary)]">{selectedServer.transport}</div>
                    </div>
                    <div>
                      <label className="text-sm text-[var(--c-text-muted)]">Command</label>
                      <div className="text-[var(--c-text-primary)] font-mono text-sm">{selectedServer.command}</div>
                    </div>
                    <div>
                      <label className="text-sm text-[var(--c-text-muted)]">Args</label>
                      <div className="text-[var(--c-text-primary)] font-mono text-sm break-all">
                        {selectedServer.args.join(' ')}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-[var(--c-text-heading)] mb-2">Targets</h3>
                  <div className="space-y-2">
                    {selectedServer.targets.map(target => (
                      <div key={target} className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-[color-mix(in_srgb,var(--c-bg-elevated)_85%,transparent)] rounded text-sm">
                          {target}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <h3 className="font-medium text-[var(--c-text-heading)] mb-2 mt-4">Environment Variables</h3>
                  <div className="space-y-2">
                    {Object.entries(selectedServer.env).length > 0 ? (
                      Object.entries(selectedServer.env).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-sm font-mono text-[var(--c-text-muted)] w-32 truncate">{key}</span>
                          <span className="text-sm font-mono text-[var(--c-text-primary)] truncate">
                            {value}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--c-text-muted)]">No environment variables configured</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
            <h2 className="text-[1.2rem] font-semibold text-[var(--c-text-heading)] mb-3">Add New Server</h2>
            <p className="text-[var(--c-text-primary)] mb-2">
              Add a new MCP server to your configuration. Templates are available to get you started.
            </p>
            <p className="text-sm text-[var(--c-text-muted)] mb-4">
              In-app server creation is not yet implemented. For now, add servers directly to <code className="font-mono">~/.mcp.json</code> or <code className="font-mono">~/sidekick/.mcp.json</code> and use Import Existing Configs above.
            </p>
            <div className="flex gap-4">
              <button
                disabled
                title="Coming soon"
                className="px-4 py-2 bg-[var(--c-accent)] text-white rounded-lg opacity-50 cursor-not-allowed"
              >
                Add from Template
              </button>
              <button
                disabled
                title="Coming soon"
                className="px-4 py-2 border border-[var(--c-border)] rounded-lg opacity-50 cursor-not-allowed"
              >
                Manual Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </PanelBackground>
  )
}