import { useCallback, useEffect, useState } from 'react'
import type { VeritasServiceStatus } from '../types'
import { useAppearanceStore, type ThemeName } from '../stores/appearance-store'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// Theme palette definitions — used both in cards and for visual identity
const THEME_PALETTES: Record<ThemeName, {
  label: string
  bg: string
  room: string
  accent: string
  dot1: string
  dot2: string
  dot3: string
  textColor: string
}> = {
  dark: {
    label: 'Dark',
    bg: '#020617',
    room: '#0f172a',
    accent: '#2563eb',
    dot1: '#3b82f6',
    dot2: '#6366f1',
    dot3: '#22d3ee',
    textColor: '#e2e8f0',
  },
  light: {
    label: 'Light',
    bg: '#f8fafc',
    room: '#e2e8f0',
    accent: '#2563eb',
    dot1: '#3b82f6',
    dot2: '#6366f1',
    dot3: '#0ea5e9',
    textColor: '#1e293b',
  },
  neon: {
    label: 'Neon',
    bg: '#03001a',
    room: '#0a0030',
    accent: '#00ffff',
    dot1: '#00ffff',
    dot2: '#7f00ff',
    dot3: '#ff00c8',
    textColor: '#e0faff',
  },
}

const ANIM_STORAGE_KEY = 'sidekick-animation-prefs'

interface AnimPrefs {
  ambientParticles: boolean
  rainEffects: boolean
  agentAnimations: boolean
}

function loadAnimPrefs(): AnimPrefs {
  try {
    const raw = localStorage.getItem(ANIM_STORAGE_KEY)
    if (raw) return { ambientParticles: true, rainEffects: false, agentAnimations: true, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ambientParticles: true, rainEffects: false, agentAnimations: true }
}

function saveAnimPrefs(prefs: AnimPrefs) {
  try { localStorage.setItem(ANIM_STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function ThemeCard({ themeName, isActive, onSelect }: {
  themeName: ThemeName
  isActive: boolean
  onSelect: () => void
}) {
  const p = THEME_PALETTES[themeName]
  return (
    <button
      onClick={onSelect}
      aria-label={`Switch to ${p.label} theme`}
      aria-pressed={isActive}
      className={[
        'stagger-item relative rounded-lg overflow-hidden cursor-pointer outline-none',
        'hover:scale-[1.02] transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-blue-500',
        isActive
          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
          : 'ring-1 ring-slate-700 hover:ring-slate-500',
      ].join(' ')}
      style={{ width: 120, height: 80, background: p.bg, flexShrink: 0 }}
    >
      {/* Room rect */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 10,
          right: 10,
          bottom: 22,
          background: p.room,
          borderRadius: 4,
          border: `1px solid ${p.accent}22`,
        }}
      />
      {/* Accent dots */}
      <div style={{ position: 'absolute', bottom: 8, left: 12, display: 'flex', gap: 4 }}>
        {[p.dot1, p.dot2, p.dot3].map((color, i) => (
          <div
            key={i}
            style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
          />
        ))}
      </div>
      {/* Active checkmark */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          bottom: 5,
          right: 8,
          fontSize: 9,
          fontWeight: 600,
          color: p.textColor,
          opacity: 0.7,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {p.label}
      </div>
    </button>
  )
}

function ToggleSwitch({ enabled, onToggle, label, description }: {
  enabled: boolean
  onToggle: () => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          enabled ? 'bg-blue-600' : 'bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150',
            enabled ? 'translate-x-[18px]' : 'translate-x-[3px]',
          ].join(' ')}
        />
      </button>
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

// ── Main panel ─────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const {
    theme, setTheme,
    uiFontFamily, setUiFontFamily, uiFontSize, setUiFontSize,
    editorFontFamily, setEditorFontFamily, editorFontSize, setEditorFontSize,
    editorLineHeight, setEditorLineHeight,
    zoom, setZoom,
  } = useAppearanceStore()

  const [animPrefs, setAnimPrefs] = useState<AnimPrefs>(loadAnimPrefs)

  const updateAnim = (key: keyof AnimPrefs) => {
    setAnimPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveAnimPrefs(next)
      return next
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto py-8 px-6">
        <h1 className="text-lg font-semibold text-slate-200 mb-6">Settings</h1>

        {/* Appearance — Theme picker */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Appearance</h2>
          <div className="space-y-5 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">

            {/* Theme preview cards */}
            <div>
              <p className="text-sm text-slate-300 mb-3">Theme</p>
              <div className="flex items-center gap-3 flex-wrap">
                {(['dark', 'light', 'neon'] as ThemeName[]).map(t => (
                  <ThemeCard
                    key={t}
                    themeName={t}
                    isActive={theme === t}
                    onSelect={() => setTheme(t)}
                  />
                ))}
              </div>
            </div>

            <NumberStepper label="Zoom Level" value={+(zoom * 100).toFixed(0)} onChange={v => setZoom(v / 100)} min={70} max={200} step={10} />
            <div className="text-xs text-slate-600">Tip: Use Cmd+= / Cmd+- in the Vault to zoom quickly</div>
          </div>
        </section>

        {/* Animation toggles */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Animations</h2>
          <div className="space-y-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800/60">
            <ToggleSwitch
              label="Ambient particles"
              description="Floating particle effects in the background"
              enabled={animPrefs.ambientParticles}
              onToggle={() => updateAnim('ambientParticles')}
            />
            <ToggleSwitch
              label="Rain effects"
              description="Animated rain overlay on the office scene"
              enabled={animPrefs.rainEffects}
              onToggle={() => updateAnim('rainEffects')}
            />
            <ToggleSwitch
              label="Agent animations"
              description="Avatar movement and idle animations"
              enabled={animPrefs.agentAnimations}
              onToggle={() => updateAnim('agentAnimations')}
            />
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

        {/* About */}
        <section className="mb-4">
          <div className="animate-card-enter bg-slate-900/50 rounded-lg p-5 border border-slate-800/60 flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Penny v0.1.0</span>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-rose-500"
              >
                <path
                  d="M7 12.25C7 12.25 1.25 8.75 1.25 5C1.25 3.20507 2.70507 1.75 4.5 1.75C5.5 1.75 6.375 2.25 7 3C7.625 2.25 8.5 1.75 9.5 1.75C11.2949 1.75 12.75 3.20507 12.75 5C12.75 8.75 7 12.25 7 12.25Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <p className="text-xs text-slate-500">Built with Electron + Phaser + React</p>
          </div>
        </section>

      </div>
    </div>
  )
}
