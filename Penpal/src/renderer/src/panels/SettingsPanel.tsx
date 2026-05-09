import { useState, useEffect, useCallback } from 'react'
import { useAppearanceStore, type ThemePreference } from '../stores/appearance-store'
import { PanelBackground } from '../components/PanelBackground'
import type { LinearTeamConfig } from '../types'

type WatchedRepoRow = { owner: string; repo: string; localPath: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: 'System Default', value: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'SF Pro', value: "'SF Pro Display', 'SF Pro', system-ui, sans-serif" },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
]

const THEME_PALETTES: Record<ThemePreference, {
  label: string
  bg: string
  room: string
  accent: string
  dot1: string
  dot2: string
  dot3: string
  textColor: string
  icon?: 'system'
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
    bg: '#f5f0e8',
    room: '#ebe4d8',
    accent: '#2a8c8c',
    dot1: '#5b9ea0',
    dot2: '#8b6bb0',
    dot3: '#c48a3f',
    textColor: '#3d3229',
  },
  system: {
    label: 'System',
    bg: 'linear-gradient(135deg, #020617 50%, #f5f0e8 50%)',
    room: 'linear-gradient(135deg, #0f172a 50%, #ebe4d8 50%)',
    accent: '#7c3aed',
    dot1: '#3b82f6',
    dot2: '#7c3aed',
    dot3: '#5b9ea0',
    textColor: '#94a3b8',
    icon: 'system',
  },
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
      <span className="text-[1.05rem] text-[var(--c-text-primary)]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
          className="w-7 h-7 rounded bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] text-[var(--c-text-primary)] text-[1.05rem] flex items-center justify-center transition-colors"
        >-</button>
        <span className="text-[1.05rem] text-[var(--c-text-heading)] w-10 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
          className="w-7 h-7 rounded bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] text-[var(--c-text-primary)] text-[1.05rem] flex items-center justify-center transition-colors"
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
      <span className="text-[1.05rem] text-[var(--c-text-primary)]">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded px-2 py-1.5 text-[1.05rem] text-[var(--c-text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] max-w-[200px]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function ThemeCard({ themeName, isActive, onSelect }: {
  themeName: ThemePreference
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
        'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_50%,transparent)]',
        isActive
          ? 'ring-2 ring-[var(--c-accent)] ring-offset-2 ring-offset-[var(--c-bg-app)]'
          : 'ring-1 ring-[var(--c-border)] hover:ring-[var(--c-border-hover)]',
      ].join(' ')}
      style={{ width: 120, height: 80, background: p.bg, flexShrink: 0 }}
    >
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
      {p.icon === 'system' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', opacity: 0.5 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 8, left: 12, display: 'flex', gap: 4 }}>
        {[p.dot1, p.dot2, p.dot3].map((color, i) => (
          <div
            key={i}
            style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
          />
        ))}
      </div>
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--c-accent)',
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
      <div
        style={{
          position: 'absolute',
          bottom: 5,
          right: 8,
          fontSize: 11,
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
        <p className="text-[1.05rem] text-[var(--c-text-primary)]">{label}</p>
        {description && <p className="text-[0.9rem] text-[var(--c-text-muted)] mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-app)]',
          enabled ? 'bg-[#00a868]' : 'bg-[var(--c-border)]',
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


// ── Sources section ────────────────────────────────────────────────────────────

function SourcesSection() {
  const [repos, setRepos] = useState<WatchedRepoRow[]>([])
  const [linearTeams, setLinearTeams] = useState<LinearTeamConfig[]>([])

  // GitHub add form
  const [addRepoOpen, setAddRepoOpen] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [repoError, setRepoError] = useState<string | null>(null)

  // Linear add form
  const [addTeamOpen, setAddTeamOpen] = useState(false)
  const [teamKey, setTeamKey] = useState('')
  const [teamPath, setTeamPath] = useState('')
  const [teamLabel, setTeamLabel] = useState('agent-ready')
  const [teamError, setTeamError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [r, t] = await Promise.all([
      window.api.githubListRepos().catch(() => []),
      window.api.linearListTeams().catch(() => []),
    ])
    if (Array.isArray(r)) setRepos(r)
    if (Array.isArray(t)) setLinearTeams(t)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const parsedRepo = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/) || repoUrl.match(/^([^/\s]+)\/([^/\s]+)$/)
  const parsedOwner = parsedRepo?.[1] || ''
  const parsedName = parsedRepo?.[2]?.replace(/\.git$/, '') || ''

  const inputCls = 'w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[1rem] text-[var(--c-text-primary)] placeholder-[var(--c-text-faint)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)]'
  const sectionCardCls = 'space-y-4 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]'

  return (
    <div className="space-y-6">
      {/* ── GitHub Repos ─────────────────────────────── */}
      <div className={sectionCardCls}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[1.05rem] text-[var(--c-text-primary)] font-medium">GitHub Repositories</p>
            <p className="text-[0.9rem] text-[var(--c-text-muted)] mt-0.5">
              Polled for <code className="px-1 py-0.5 rounded bg-[var(--c-bg-elevated)] text-emerald-400 text-[0.85rem]">agent-ready</code> issues.
            </p>
          </div>
          {!addRepoOpen && (
            <button
              type="button"
              onClick={() => setAddRepoOpen(true)}
              className="shrink-0 px-3 py-1.5 text-[0.9rem] rounded-md bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)] border border-[var(--c-border)] hover:bg-[var(--c-border-subtle)] transition-colors"
            >
              + Add repository
            </button>
          )}
        </div>

        {repos.length === 0 && !addRepoOpen && (
          <p className="text-[0.9rem] text-[var(--c-text-faint)]">No repositories yet.</p>
        )}

        {repos.length > 0 && (
          <ul className="space-y-2">
            {repos.map(r => (
              <li
                key={`${r.owner}/${r.repo}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-[color-mix(in_srgb,var(--c-bg-elevated)_70%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)]"
              >
                <div className="min-w-0">
                  <div className="text-[1rem] text-[var(--c-text-primary)] font-mono truncate">{r.owner}/{r.repo}</div>
                  {r.localPath && (
                    <div className="text-[0.85rem] text-[var(--c-text-muted)] truncate mt-0.5" title={r.localPath}>{r.localPath}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await window.api.githubRemoveRepo(r.owner, r.repo)
                    void refresh()
                  }}
                  className="shrink-0 text-[0.85rem] text-red-400/70 hover:text-red-400 px-2 py-1 rounded border border-transparent hover:border-red-500/30 transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {addRepoOpen && (
          <div className="space-y-3 pt-2 border-t border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]">
            <div>
              <label className="text-[0.875rem] text-[var(--c-text-muted)] mb-1 block">Repository (URL or owner/repo)</label>
              <input
                className={inputCls}
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="e.g. org/repo or https://github.com/org/repo"
                autoFocus
              />
              {parsedOwner && parsedName && (
                <p className="text-[0.85rem] text-[var(--c-accent-blue)] mt-1">{parsedOwner}/{parsedName}</p>
              )}
            </div>
            <div>
              <label className="text-[0.875rem] text-[var(--c-text-muted)] mb-1 block">Local clone path (for agent cwd)</label>
              <input
                className={inputCls}
                value={localPath}
                onChange={e => setLocalPath(e.target.value)}
                placeholder="e.g. ~/workspace/org/repo"
              />
            </div>
            {repoError && (
              <p className="text-[0.875rem] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{repoError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setAddRepoOpen(false); setRepoUrl(''); setLocalPath(''); setRepoError(null) }}
                className="px-4 py-2 text-[0.9rem] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!parsedOwner || !parsedName || !localPath.trim()}
                onClick={async () => {
                  const result = await window.api.githubAddRepo(parsedOwner, parsedName, localPath.trim()) as { ok?: boolean; error?: string }
                  if (result?.error) { setRepoError(result.error); return }
                  setAddRepoOpen(false); setRepoUrl(''); setLocalPath(''); setRepoError(null)
                  void refresh()
                }}
                className="px-4 py-2 text-[0.9rem] bg-[var(--c-accent)] hover:bg-[#00cc6e] disabled:opacity-30 text-[var(--c-bg-chrome)] font-medium rounded-lg transition-colors"
              >
                Watch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Linear Teams ─────────────────────────────── */}
      <div className={sectionCardCls}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[1.05rem] text-[var(--c-text-primary)] font-medium">Linear Teams</p>
            <p className="text-[0.9rem] text-[var(--c-text-muted)] mt-0.5">
              Polled for <code className="px-1 py-0.5 rounded bg-[var(--c-bg-elevated)] text-violet-400 text-[0.85rem]">agent-ready</code> labeled issues.
            </p>
          </div>
          {!addTeamOpen && (
            <button
              type="button"
              onClick={() => setAddTeamOpen(true)}
              className="shrink-0 px-3 py-1.5 text-[0.9rem] rounded-md bg-[var(--c-bg-elevated)] text-[var(--c-accent-blue)] border border-[var(--c-border)] hover:bg-[var(--c-border-subtle)] transition-colors"
            >
              + Add team
            </button>
          )}
        </div>

        {linearTeams.length === 0 && !addTeamOpen && (
          <p className="text-[0.9rem] text-[var(--c-text-faint)]">No Linear teams connected.</p>
        )}

        {linearTeams.length > 0 && (
          <ul className="space-y-2">
            {linearTeams.map(team => (
              <li
                key={team.teamKey}
                className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-[color-mix(in_srgb,var(--c-bg-elevated)_70%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_40%,transparent)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[1rem] font-semibold text-[var(--c-text-primary)] font-mono">{team.teamKey}</span>
                    <span className="text-[0.8rem] text-violet-400/80 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">{team.label}</span>
                  </div>
                  {team.localPath && (
                    <div className="text-[0.85rem] text-[var(--c-text-muted)] truncate mt-0.5" title={team.localPath}>{team.localPath}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await window.api.linearRemoveTeam(team.teamKey).catch(() => {})
                    void refresh()
                  }}
                  className="shrink-0 text-[0.85rem] text-red-400/70 hover:text-red-400 px-2 py-1 rounded border border-transparent hover:border-red-500/30 transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {addTeamOpen && (
          <div className="space-y-3 pt-2 border-t border-[color-mix(in_srgb,var(--c-border)_60%,transparent)]">
            <div>
              <label className="text-[0.875rem] text-[var(--c-text-muted)] mb-1 block">Team key</label>
              <input
                className={inputCls}
                value={teamKey}
                onChange={e => setTeamKey(e.target.value.toUpperCase())}
                placeholder="e.g. META"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[0.875rem] text-[var(--c-text-muted)] mb-1 block">Local repo path</label>
              <input
                className={inputCls}
                value={teamPath}
                onChange={e => setTeamPath(e.target.value)}
                placeholder="e.g. ~/projects/my-repo"
              />
            </div>
            <div>
              <label className="text-[0.875rem] text-[var(--c-text-muted)] mb-1 block">Trigger label</label>
              <input
                className={inputCls}
                value={teamLabel}
                onChange={e => setTeamLabel(e.target.value)}
                placeholder="agent-ready"
              />
            </div>
            {teamError && (
              <p className="text-[0.875rem] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{teamError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setAddTeamOpen(false); setTeamKey(''); setTeamPath(''); setTeamLabel('agent-ready'); setTeamError(null) }}
                className="px-4 py-2 text-[0.9rem] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!teamKey.trim() || !teamPath.trim()}
                onClick={async () => {
                  try {
                    await window.api.linearAddTeam(teamKey.trim(), teamPath.trim(), teamLabel.trim() || undefined)
                    setAddTeamOpen(false); setTeamKey(''); setTeamPath(''); setTeamLabel('agent-ready'); setTeamError(null)
                    void refresh()
                  } catch (e) {
                    setTeamError((e as Error).message || 'Failed to add team')
                  }
                }}
                className="px-4 py-2 text-[0.9rem] bg-[var(--c-accent)] hover:bg-[#00cc6e] disabled:opacity-30 text-[var(--c-bg-chrome)] font-medium rounded-lg transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Concurrency section ────────────────────────────────────────────────────────

function ConcurrencySection() {
  const [maxConcurrentPods, setMaxConcurrentPods] = useState<number>(2)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.governanceGet()
      .then(cfg => {
        if (cancelled) return
        setMaxConcurrentPods(cfg.maxConcurrentPods)
        setLoaded(true)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError((e as Error)?.message || 'Failed to load governance config')
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  const commit = useCallback(async (next: number) => {
    const clamped = Math.max(1, Math.min(8, Math.round(next)))
    setMaxConcurrentPods(clamped)
    setSaving(true)
    setError(null)
    try {
      const result = await window.api.governanceSet({ maxConcurrentPods: clamped })
      setMaxConcurrentPods(result.maxConcurrentPods)
    } catch (e) {
      setError((e as Error)?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [])

  const sectionCardCls = 'space-y-4 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]'

  return (
    <div className={sectionCardCls}>
      <div>
        <p className="text-[1.05rem] text-[var(--c-text-primary)] font-medium">Max parallel pods per repo</p>
        <p className="text-[0.9rem] text-[var(--c-text-muted)] mt-0.5">
          How many pod workflows can run simultaneously for a single repository.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={8}
          step={1}
          disabled={!loaded || saving}
          value={maxConcurrentPods}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (Number.isFinite(n)) setMaxConcurrentPods(n)
          }}
          onBlur={() => {
            if (loaded) void commit(maxConcurrentPods)
          }}
          className="w-20 px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[1rem] text-[var(--c-text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] disabled:opacity-50"
        />
        <span className="text-[0.85rem] text-[var(--c-text-muted)]">range 1–8 · default 2</span>
        {saving && <span className="text-[0.85rem] text-[var(--c-text-faint)]">saving…</span>}
      </div>
      {error && (
        <p className="text-[0.875rem] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const {
    themePreference, setTheme,
    uiFontFamily, setUiFontFamily, uiFontSize, setUiFontSize,
    zoom, setZoom,
    scanlinesOverlay, setScanlinesOverlay,
    crtVignette, setCrtVignette,
  } = useAppearanceStore()

  return (
    <PanelBackground>
    <div className="h-full overflow-y-auto relative z-[1]">
      <div className="max-w-xl mx-auto py-8 px-6">
        <h1 className="text-[1.35rem] font-semibold text-[var(--c-text-heading)] mb-6">Settings</h1>

        {/* Sources */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Sources</h2>
          <SourcesSection />
        </section>

        {/* Concurrency */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Concurrency</h2>
          <ConcurrencySection />
        </section>

        {/* Appearance */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Appearance</h2>
          <div className="space-y-5 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">

            <div>
              <p className="text-[1.05rem] text-[var(--c-text-primary)] mb-3">Theme</p>
              <div className="flex items-center gap-3 flex-wrap">
                {(['dark', 'light', 'system'] as ThemePreference[]).map(t => (
                  <ThemeCard
                    key={t}
                    themeName={t}
                    isActive={themePreference === t}
                    onSelect={() => setTheme(t)}
                  />
                ))}
              </div>
            </div>

            <NumberStepper label="Zoom Level" value={+(zoom * 100).toFixed(0)} onChange={v => setZoom(v / 100)} min={70} max={200} step={10} />

            <div className="pt-2 border-t border-[color-mix(in_srgb,var(--c-border)_80%,transparent)] space-y-4">
              <p className="text-[1.05rem] text-[var(--c-text-primary)]">Shell effects</p>
              <ToggleSwitch
                label="Scanline overlay"
                description="Subtle horizontal lines across the window (retro CRT look)"
                enabled={scanlinesOverlay}
                onToggle={() => setScanlinesOverlay(!scanlinesOverlay)}
              />
              <ToggleSwitch
                label="Edge vignette"
                description="Soft darkening and color wash at the screen edges"
                enabled={crtVignette}
                onToggle={() => setCrtVignette(!crtVignette)}
              />
            </div>
          </div>
        </section>

        {/* Interface Font */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Interface Font</h2>
          <div className="space-y-4 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
            <FontSelect label="Font Family" value={uiFontFamily} onChange={setUiFontFamily} options={FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={uiFontSize} onChange={setUiFontSize} min={10} max={24} />
            <div className="mt-3 p-3 rounded bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
              <p className="text-[var(--c-text-secondary)]" style={{ fontFamily: uiFontFamily, fontSize: `${uiFontSize}px` }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="mb-4">
          <div className="animate-card-enter bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-5 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-2">
              <span className="text-[1.05rem] font-semibold text-[var(--c-text-heading)]">Penpal v0.3.3</span>
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
            <p className="text-[0.9rem] text-[var(--c-text-muted)]">Built with Electron + React</p>
          </div>
        </section>

      </div>
    </div>
    </PanelBackground>
  )
}
