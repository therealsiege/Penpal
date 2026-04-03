import type { ReactNode } from 'react'

interface LayoutProps {
  activePanel: string
  onNavigate: (panel: string) => void
  children: ReactNode
}

function NavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-current={active ? 'page' : undefined}
        className={`no-drag relative w-full min-h-[length:calc(2.75rem*var(--penny-ui-nav-scale))] rounded-2xl flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 transition-all duration-300 overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-chrome)] active:scale-[0.98] ${
          active
            ? 'text-[var(--c-accent)] bg-[linear-gradient(105deg,rgba(0,255,136,0.16)_0%,rgba(0,255,136,0.05)_42%,transparent_100%)] shadow-[inset_0_0_0_1px_rgba(0,255,136,0.22),0_8px_32px_-12px_rgba(0,255,136,0.25)]'
            : 'text-[var(--c-text-faint)] hover:text-[var(--c-text-primary)] hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_85%,transparent)] hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-border)_55%,transparent)]'
        }`}
      >
        <span
          className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-[var(--c-accent)] transition-all duration-300 origin-center ${
            active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
          }`}
          style={active ? { boxShadow: '0 0 12px rgba(0,255,136,0.65)' } : undefined}
        />

        <span
          className={`shrink-0 w-[length:calc(2.25rem*var(--penny-ui-nav-scale))] h-[length:calc(2.25rem*var(--penny-ui-nav-scale))] rounded-xl flex items-center justify-center transition-all duration-300 ${
            active
              ? 'bg-[color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_14px_-4px_color-mix(in_srgb,var(--c-accent)_35%,transparent)]'
              : 'bg-[color-mix(in_srgb,var(--c-bg-surface)_90%,transparent)] text-current group-hover:bg-[var(--c-bg-elevated)] group-hover:text-[var(--c-text-heading)]'
          }`}
        >
          <span className="transition-transform duration-300 group-hover:scale-105 flex items-center [&>svg]:w-[length:calc(18px*var(--penny-ui-nav-scale))] [&>svg]:h-[length:calc(18px*var(--penny-ui-nav-scale))]">
            {icon}
          </span>
        </span>

        <span className="text-[length:calc(14px*var(--penny-ui-nav-scale))] font-semibold tracking-tight text-left flex-1 leading-snug">{label}</span>
      </button>

      {!active && (
        <span
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
            px-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--c-bg-surface)_98%,transparent)] backdrop-blur-md text-[var(--c-text-secondary)] text-[length:calc(12px*var(--penny-ui-nav-scale))] font-medium whitespace-nowrap
            shadow-[0_12px_40px_rgba(0,0,0,0.55)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]
            opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-200
          "
        >
          {label}
        </span>
      )}
    </div>
  )
}

function NavSectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pt-5 pb-2 text-[length:calc(10px*var(--penny-ui-nav-scale))] font-bold uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-[var(--c-text-muted)] via-[var(--c-text-secondary)] to-[var(--c-text-muted)]">
      {children}
    </p>
  )
}

export function Layout({ activePanel, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-[var(--c-bg-deep)] text-[var(--c-text-primary)] select-none overflow-hidden">
      <aside
        aria-label="Primary navigation"
        className="
          shell-sidebar
          w-[length:var(--penny-shell-rail-width)] shrink-0 flex flex-col items-stretch
          border-r border-[var(--c-bg-hover)]
          bg-[linear-gradient(180deg,var(--c-bg-deep)_0%,var(--c-bg-surface)_38%,var(--c-bg-deep)_100%)]
          shadow-[4px_0_40px_-18px_rgba(0,0,0,0.75)]
        "
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px z-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--c-accent)_22%,transparent)] to-transparent opacity-95"
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col flex-1 min-h-0">
          <div className="drag-region w-full pt-11 pb-1 shrink-0" />

          <div className="px-3 mb-2 shrink-0">
            <div
              className="
                relative flex flex-col items-center gap-2.5 py-3.5 px-3 rounded-[1.35rem]
                overflow-hidden
                bg-[linear-gradient(155deg,color-mix(in_srgb,var(--c-bg-elevated)_96%,transparent)_0%,color-mix(in_srgb,var(--c-bg-chrome)_99%,transparent)_55%,var(--c-bg-deep)_100%)]
                border border-[color-mix(in_srgb,var(--c-border)_80%,transparent)]
                shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_48px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(0,0,0,0.35)]
              "
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(232,184,75,0.12),transparent_60%)]"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] to-transparent" aria-hidden />

              <div className="relative w-full flex items-center justify-between text-[length:calc(9px*var(--penny-ui-nav-scale))] uppercase tracking-[0.18em] text-[var(--c-text-muted)] font-semibold">
                <span>PenPal OS</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-accent)_10%,transparent)] px-2 py-0.5 text-[var(--c-accent)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-accent)] shadow-[0_0_8px_rgba(0,255,136,0.75)]" />
                  Online
                </span>
              </div>

              <div className="relative">
                <div
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#e8b84b]/35 via-transparent to-[color-mix(in_srgb,var(--c-accent)_10%,transparent)] opacity-75 blur-[2px]"
                  aria-hidden
                />
                <img
                  src="logo.png"
                  alt=""
                  className="relative w-[length:calc(3.3rem*var(--penny-ui-nav-scale))] h-[length:calc(3.3rem*var(--penny-ui-nav-scale))] rounded-2xl shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
                  draggable={false}
                  style={{ animation: 'bounce 0.6s ease-out 0.3s 1 both' }}
                />
              </div>

              <div className="relative text-center">
                <span
                  className="block uppercase leading-none"
                  style={{
                    fontFamily: "'Monogram', monospace",
                    fontSize: 'calc(35px * var(--penny-ui-nav-scale))',
                    letterSpacing: '0.2em',
                    color: '#e8b84b',
                    textShadow: '0 0 12px rgba(232,184,75,0.5), 0 0 36px rgba(232,184,75,0.2)',
                  }}
                >
                  PenPal
                </span>
                <span className="mt-1 block text-[length:calc(10px*var(--penny-ui-nav-scale))] text-[var(--c-text-dim)] tracking-[0.22em] uppercase font-semibold">
                  Mission Control
                </span>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--c-border)_90%,transparent)] to-transparent" />
              <div className="relative w-full flex items-center justify-between text-[length:calc(9px*var(--penny-ui-nav-scale))] text-[var(--c-text-muted)] font-mono tracking-wide">
                <span>v0.1.0</span>
                <span className="text-[var(--c-text-faint)]">Sector-7</span>
              </div>
            </div>
          </div>

          <nav
            className="scrollbar-penpal flex-1 flex flex-col min-h-0 w-full px-2.5 gap-0.5 overflow-y-auto overflow-x-hidden pb-2"
          >
          <NavSectionLabel>Workspace</NavSectionLabel>
          <NavButton
            label="Office"
            active={activePanel === 'office'}
            onClick={() => onNavigate('office')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
          />
          <NavButton
            label="Tasks"
            active={activePanel === 'tasks'}
            onClick={() => onNavigate('tasks')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="17" width="18" height="4" rx="1" />
              </svg>
            }
          />
          <NavButton
            label="Data"
            active={activePanel === 'data'}
            onClick={() => onNavigate('data')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            }
          />
          <NavButton
            label="Vault"
            active={activePanel === 'vault'}
            onClick={() => onNavigate('vault')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />

          <div className="my-3 mx-2 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--c-border)_90%,transparent)] to-transparent" role="presentation" />

          <NavSectionLabel>Tools</NavSectionLabel>
          <NavButton
            label="Evals"
            active={activePanel === 'evals'}
            onClick={() => onNavigate('evals')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            }
          />
          <NavButton
            label="Soundboard"
            active={activePanel === 'soundboard'}
            onClick={() => onNavigate('soundboard')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 5a10 10 0 0 1 0 14" />
              </svg>
            }
          />
          <NavButton
            label="Settings"
            active={activePanel === 'settings'}
            onClick={() => onNavigate('settings')}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
          />
        </nav>

        <div className="shrink-0 px-2.5 pb-4 pt-3 mt-auto border-t border-[color-mix(in_srgb,var(--c-bg-hover)_90%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-bg-app)_20%,transparent)_0%,color-mix(in_srgb,var(--c-bg-deep)_85%,transparent)_100%)]">
          <div className="relative group">
            <button
              type="button"
              title="Command Palette (⌘K)"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="no-drag w-full rounded-2xl flex items-center gap-3 px-3 py-2.5 text-[var(--c-text-dim)] hover:text-[var(--c-accent)] transition-all duration-300 border border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--c-bg-surface)_90%,transparent)_0%,color-mix(in_srgb,var(--c-bg-deep)_95%,transparent)_100%)] hover:border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] hover:shadow-[0_0_24px_-8px_rgba(0,255,136,0.35),inset_0_1px_0_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-deep)] active:scale-[0.98]"
            >
              <span className="w-[length:calc(2.25rem*var(--penny-ui-nav-scale))] h-[length:calc(2.25rem*var(--penny-ui-nav-scale))] rounded-xl flex items-center justify-center bg-[var(--c-bg-chrome)] border border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] text-[var(--c-text-muted)] group-hover:text-[var(--c-accent)] group-hover:border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] transition-colors shadow-inner">
                <svg className="w-[length:calc(18px*var(--penny-ui-nav-scale))] h-[length:calc(18px*var(--penny-ui-nav-scale))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <span className="flex flex-col items-start min-w-0 text-left">
                <span className="text-[length:calc(12px*var(--penny-ui-nav-scale))] font-semibold text-[var(--c-text-secondary)] group-hover:text-[var(--c-text-heading)] transition-colors">Quick search</span>
                <span className="text-[length:calc(10px*var(--penny-ui-nav-scale))] text-[var(--c-text-faint)] font-mono tracking-wide">⌘K</span>
              </span>
            </button>
            <span
              className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                px-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--c-bg-surface)_98%,transparent)] backdrop-blur-md text-[var(--c-text-secondary)] text-[length:calc(12px*var(--penny-ui-nav-scale))] font-medium whitespace-nowrap
                shadow-[0_12px_40px_rgba(0,0,0,0.55)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]
                opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                transition-all duration-200
              "
            >
              Command palette
            </span>
          </div>
        </div>
        </div>
      </aside>

      <main className="shell-main flex-1 min-h-0 overflow-hidden flex flex-col min-w-0 bg-[var(--c-bg-deep)]">
        {children}
      </main>
    </div>
  )
}
