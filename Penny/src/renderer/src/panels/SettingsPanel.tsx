import { useCallback, useEffect, useState } from 'react'
import type { VeritasServiceStatus } from '../types'
import { useAppearanceStore } from '../stores/appearance-store'

const FONT_OPTIONS = [
  { label: 'System Default', value: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'SF Pro', value: "'SF Pro Display', 'SF Pro', system-ui, sans-serif" },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
]

const MONO_FONT_OPTIONS = [
  { label: 'System Mono', value: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace" },
  { label: 'SF Mono', value: "'SF Mono', ui-monospace, monospace" },
  { label: 'Fira Code', value: "'Fira Code', ui-monospace, monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', ui-monospace, monospace" },
  { label: 'Menlo', value: "Menlo, ui-monospace, monospace" },
]

function NumberStepper({ value, onChange, min, max, step = 1, label }: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
        >-</button>
        <span className="text-sm text-slate-200 w-10 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center transition-colors"
        >+</button>
      </div>
    </div>
  )
}

function FontSelect({ value, onChange, options, label }: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500 max-w-[200px]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function VeritasControlPanel() {
  const [status, setStatus] = useState<VeritasServiceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parseStatus = (payload: unknown): VeritasServiceStatus => {
    if (
      payload &&
      typeof payload === 'object' &&
      'configured' in payload &&
      typeof (payload as { configured: unknown }).configured === 'boolean'
    ) {
      return payload as VeritasServiceStatus
    }
    const msg = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error || 'Unknown error')
      : 'Unexpected response from Veritas service manager.'
    throw new Error(msg)
  }

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.veritasStatus()
      setStatus(parseStatus(result))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runAction = useCallback(async (
    label: 'start' | 'stop' | 'restart',
    fn: () => Promise<unknown>,
  ) => {
    setAction(label)
    setError(null)
    try {
      const result = await fn()
      setStatus(parseStatus(result))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAction(null)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setAction('logs')
    setError(null)
    try {
      const result = await window.api.veritasLogs(140)
      if (result.success) {
        setLogs(result.output || '(No logs returned)')
      } else {
        throw new Error(result.error || 'Unable to load Veritas logs.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAction(null)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const timer = setInterval(() => {
      refreshStatus().catch(() => {})
    }, 12_000)
    return () => clearInterval(timer)
  }, [refreshStatus])

  const statusTone = status?.running
    ? status.healthy && status.apiReachable ? 'text-emerald-400' : 'text-amber-400'
    : 'text-slate-400'
  const sourceDirInvalid = status?.sourceDirValid === false
  const startDisabled = !!action || sourceDirInvalid
  const startDisabledReason = sourceDirInvalid
    ? 'Set PENNY_VERITAS_SOURCE_DIR to a valid veritas-kanban folder in Penny/docker/.env.control-plane'
    : ''

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Veritas Control Plane</h2>
      <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Service Status</p>
            <p className={`text-xs ${statusTone}`}>
              {loading && !status
                ? 'Checking...'
                : status?.running
                  ? `Running (${status.health || 'unknown'})`
                  : 'Stopped'}
            </p>
          </div>
          <button
            onClick={() => refreshStatus()}
            disabled={loading || !!action}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">Docker</span>
            <p className={status?.dockerAvailable ? 'text-emerald-400' : 'text-red-400'}>
              {status?.dockerAvailable ? 'Available' : 'Unavailable'}
            </p>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">Compose</span>
            <p className={status?.composeAvailable ? 'text-emerald-400' : 'text-red-400'}>
              {status?.composeAvailable ? 'Available' : 'Unavailable'}
            </p>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">API URL</span>
            <p className="text-slate-300 truncate">{status?.apiUrl || '-'}</p>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">Compose File</span>
            <p className="text-slate-300 truncate">{status?.composeFile || '-'}</p>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">Source Dir</span>
            <p className={status?.sourceDirValid ? 'text-emerald-400 truncate' : 'text-red-400 truncate'}>
              {status?.sourceDir || '-'}
            </p>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5">
            <span className="text-slate-500">Source Config</span>
            <p className={status?.sourceDirConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              {status?.sourceDirConfigured ? 'Explicit path set' : 'Using default path'}
            </p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
            {error}
          </div>
        )}
        {!!status?.warnings?.length && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 space-y-1">
            {status.warnings.map((w, idx) => (
              <p key={`${w}-${idx}`}>- {w}</p>
            ))}
          </div>
        )}
        {status?.error && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
            {status.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <span title={startDisabledReason} className="inline-flex">
            <button
              onClick={() => runAction('start', () => window.api.veritasStart())}
              disabled={startDisabled}
              className="px-3 py-1.5 rounded bg-emerald-700/80 hover:bg-emerald-600 text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={sourceDirInvalid ? `Start disabled: ${startDisabledReason}` : 'Start Veritas'}
            >
              {action === 'start' ? 'Starting...' : 'Start'}
            </button>
          </span>
          <button
            onClick={() => runAction('stop', () => window.api.veritasStop())}
            disabled={!!action}
            className="px-3 py-1.5 rounded bg-red-700/80 hover:bg-red-600 text-sm text-white transition-colors disabled:opacity-50"
          >
            {action === 'stop' ? 'Stopping...' : 'Stop'}
          </button>
          <button
            onClick={() => runAction('restart', () => window.api.veritasRestart())}
            disabled={!!action}
            className="px-3 py-1.5 rounded bg-blue-700/80 hover:bg-blue-600 text-sm text-white transition-colors disabled:opacity-50"
          >
            {action === 'restart' ? 'Restarting...' : 'Restart'}
          </button>
          <button
            onClick={() => loadLogs()}
            disabled={!!action}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors disabled:opacity-50"
          >
            {action === 'logs' ? 'Loading Logs...' : 'Tail Logs'}
          </button>
          <button
            onClick={() => {
              setAction('open')
              setError(null)
              window.api.veritasOpen()
                .then((result: unknown) => {
                  if (result && typeof result === 'object' && 'error' in result) {
                    throw new Error(String((result as { error: unknown }).error || 'Failed to open Veritas UI.'))
                  }
                })
                .catch(err => setError((err as Error).message))
                .finally(() => setAction(null))
            }}
            disabled={!!action || !status?.webUrl}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors disabled:opacity-50"
          >
            {action === 'open' ? 'Opening...' : 'Open Veritas UI'}
          </button>
        </div>

        {logs && (
          <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
            <p className="text-[11px] text-slate-500 mb-1">Latest container logs</p>
            <pre className="text-[11px] text-slate-300 max-h-52 overflow-auto whitespace-pre-wrap break-words">{logs}</pre>
          </div>
        )}
      </div>
    </section>
  )
}

export function SettingsPanel() {
  const {
    theme, toggleTheme,
    uiFontFamily, setUiFontFamily, uiFontSize, setUiFontSize,
    editorFontFamily, setEditorFontFamily, editorFontSize, setEditorFontSize,
    editorLineHeight, setEditorLineHeight,
    zoom, setZoom,
  } = useAppearanceStore()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto py-8 px-6">
        <h1 className="text-lg font-semibold text-slate-200 mb-6">Settings</h1>

        {/* Appearance */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Appearance</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Theme</span>
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              >
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
            <NumberStepper label="Zoom Level" value={+(zoom * 100).toFixed(0)} onChange={v => setZoom(v / 100)} min={70} max={200} step={10} />
            <div className="text-xs text-slate-600">Tip: Use Cmd+= / Cmd+- in the Vault to zoom quickly</div>
          </div>
        </section>

        <VeritasControlPanel />

        {/* UI Font */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Interface Font</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <FontSelect label="Font Family" value={uiFontFamily} onChange={setUiFontFamily} options={FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={uiFontSize} onChange={setUiFontSize} min={10} max={24} />
            <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-700/40">
              <p className="text-slate-400" style={{ fontFamily: uiFontFamily, fontSize: `${uiFontSize}px` }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
        </section>

        {/* Editor Font */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Editor Font</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <FontSelect label="Font Family" value={editorFontFamily} onChange={setEditorFontFamily} options={MONO_FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={editorFontSize} onChange={setEditorFontSize} min={10} max={28} />
            <NumberStepper label="Line Height" value={editorLineHeight} onChange={setEditorLineHeight} min={1.0} max={2.5} step={0.1} />
            <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-700/40 overflow-hidden">
              <pre className="text-slate-400" style={{ fontFamily: editorFontFamily, fontSize: `${editorFontSize}px`, lineHeight: editorLineHeight }}>
{`# Heading
The quick brown fox jumps
over the lazy dog.

- Item one
- Item two`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
