import { useState } from 'react'
import { useAppearanceStore, type ThemePreference } from '../stores/appearance-store'
import { PanelBackground } from '../components/PanelBackground'

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
      {/* System icon overlay */}
      {p.icon === 'system' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', opacity: 0.5 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
      )}
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
      {/* Label */}
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


// ── Main panel ─────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const {
    themePreference, setTheme,
    uiFontFamily, setUiFontFamily, uiFontSize, setUiFontSize,
    editorFontFamily, setEditorFontFamily, editorFontSize, setEditorFontSize,
    editorLineHeight, setEditorLineHeight,
    zoom, setZoom,
    scanlinesOverlay, setScanlinesOverlay,
    crtVignette, setCrtVignette,
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
    <PanelBackground>
    <div className="h-full overflow-y-auto relative z-[1]">
      <div className="max-w-xl mx-auto py-8 px-6">
        <h1 className="text-[1.35rem] font-semibold text-[var(--c-text-heading)] mb-6">Settings</h1>

        {/* Appearance — Theme picker */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Appearance</h2>
          <div className="space-y-5 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">

            {/* Theme preview cards */}
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
            <div className="text-[0.9rem] text-[var(--c-text-faint)]">Tip: Use Cmd+= / Cmd+- in the Vault to zoom quickly</div>

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

        {/* Animation toggles */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Animations</h2>
          <div className="space-y-4 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
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

        {/* UI Font */}
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

        {/* Editor Font */}
        <section className="mb-8">
          <h2 className="text-[0.9rem] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-4">Editor Font</h2>
          <div className="space-y-4 bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-4 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]">
            <FontSelect label="Font Family" value={editorFontFamily} onChange={setEditorFontFamily} options={MONO_FONT_OPTIONS} />
            <NumberStepper label="Font Size" value={editorFontSize} onChange={setEditorFontSize} min={10} max={28} />
            <NumberStepper label="Line Height" value={editorLineHeight} onChange={setEditorLineHeight} min={1.0} max={2.5} step={0.1} />
            <div className="mt-3 p-3 rounded bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] overflow-hidden">
              <pre className="text-[var(--c-text-secondary)]" style={{ fontFamily: editorFontFamily, fontSize: `${editorFontSize}px`, lineHeight: editorLineHeight }}>
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
          <div className="animate-card-enter bg-[color-mix(in_srgb,var(--c-bg-surface)_85%,transparent)] rounded-lg p-5 border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-2">
              <span className="text-[1.05rem] font-semibold text-[var(--c-text-heading)]">Penny v0.1.0</span>
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
            <p className="text-[0.9rem] text-[var(--c-text-muted)]">Built with Electron + Phaser + React</p>
          </div>
        </section>

      </div>
    </div>
    </PanelBackground>
  )
}
