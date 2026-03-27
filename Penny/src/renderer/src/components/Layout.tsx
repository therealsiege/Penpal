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
        className={`no-drag relative w-full min-h-[2.75rem] rounded-2xl flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 transition-all duration-300 overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff88]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e14] active:scale-[0.98] ${
          active
            ? 'text-[#00ff88] bg-[linear-gradient(105deg,rgba(0,255,136,0.16)_0%,rgba(0,255,136,0.05)_42%,transparent_100%)] shadow-[inset_0_0_0_1px_rgba(0,255,136,0.22),0_8px_32px_-12px_rgba(0,255,136,0.25)]'
            : 'text-[#4a5c6e] hover:text-[#b8c4d0] hover:bg-[rgba(10,18,28,0.85)] hover:shadow-[inset_0_0_0_1px_rgba(42,52,64,0.55)]'
        }`}
      >
        <span
          className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-[#00ff88] transition-all duration-300 origin-center ${
            active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
          }`}
          style={active ? { boxShadow: '0 0 12px rgba(0,255,136,0.65)' } : undefined}
        />

        <span
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
            active
              ? 'bg-[#00ff88]/14 text-[#00ff88] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_14px_-4px_rgba(0,255,136,0.35)]'
              : 'bg-[#0c141c]/90 text-current group-hover:bg-[#121c28] group-hover:text-[#d4dce6]'
          }`}
        >
          <span className="transition-transform duration-300 group-hover:scale-105 flex items-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
            {icon}
          </span>
        </span>

        <span className="text-[14px] font-semibold tracking-tight text-left flex-1 leading-snug">{label}</span>
      </button>

      {!active && (
        <span
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
            px-3 py-2 rounded-xl bg-[#0c1018]/98 backdrop-blur-md text-[#a8b4c4] text-xs font-medium whitespace-nowrap
            shadow-[0_12px_40px_rgba(0,0,0,0.55)] border border-[#2a3440]/90
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
    <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-[#5a6a7a] via-[#8a96a4] to-[#5a6a7a]">
      {children}
    </p>
  )
}

export function Layout({ activePanel, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-[#040608] text-slate-100 select-none overflow-hidden">
      <aside
        aria-label="Primary navigation"
        className="
          shell-sidebar
          w-[188px] shrink-0 flex flex-col items-stretch
          border-r border-[#1a2230]
          bg-[linear-gradient(180deg,#090d14_0%,#0c1018_38%,#070a0f_100%)]
          shadow-[4px_0_40px_-18px_rgba(0,0,0,0.75)]
        "
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px z-0 bg-gradient-to-b from-transparent via-[#00ff88]/22 to-transparent opacity-95"
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col flex-1 min-h-0">
          <div className="drag-region w-full pt-11 pb-1 shrink-0" />

          <div className="px-3 mb-2 shrink-0">
            <div
              className="
                relative flex flex-col items-center gap-2.5 py-3.5 px-3 rounded-[1.35rem]
                overflow-hidden
                bg-[linear-gradient(155deg,rgba(18,26,36,0.96)_0%,rgba(8,12,18,0.99)_55%,rgba(6,9,14,1)_100%)]
                border border-[#2a3440]/80
                shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_48px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(0,0,0,0.35)]
              "
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(232,184,75,0.12),transparent_60%)]"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ff88]/30 to-transparent" aria-hidden />

              <div className="relative w-full flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-[#5a6a7a] font-semibold">
                <span>PenPal OS</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#00ff88]/35 bg-[#00ff88]/10 px-2 py-0.5 text-[#7fffc7]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.75)]" />
                  Online
                </span>
              </div>

              <div className="relative">
                <div
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#e8b84b]/35 via-transparent to-[#00ff88]/10 opacity-75 blur-[2px]"
                  aria-hidden
                />
                <img
                  src="logo.png"
                  alt=""
                  className="relative w-[3.3rem] h-[3.3rem] rounded-2xl shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
                  draggable={false}
                  style={{ animation: 'bounce 0.6s ease-out 0.3s 1 both' }}
                />
              </div>

              <div className="relative text-center">
                <span
                  className="block uppercase leading-none"
                  style={{
                    fontFamily: "'Monogram', monospace",
                    fontSize: '35px',
                    letterSpacing: '0.2em',
                    color: '#e8b84b',
                    textShadow: '0 0 12px rgba(232,184,75,0.5), 0 0 36px rgba(232,184,75,0.2)',
                  }}
                >
                  PenPal
                </span>
                <span className="mt-1 block text-[10px] text-[#6a7a8c] tracking-[0.22em] uppercase font-semibold">
                  Mission Control
                </span>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#2a3440]/90 to-transparent" />
              <div className="relative w-full flex items-center justify-between text-[9px] text-[#5a6a7a] font-mono tracking-wide">
                <span>v0.1.0</span>
                <span className="text-[#4a5c6e]">Sector-7</span>
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

          <div className="my-3 mx-2 h-px bg-gradient-to-r from-transparent via-[#2a3440]/90 to-transparent" role="presentation" />

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

        <div className="shrink-0 px-2.5 pb-4 pt-3 mt-auto border-t border-[#1a2230]/90 bg-[linear-gradient(180deg,rgba(8,10,14,0.2)_0%,rgba(4,6,10,0.85)_100%)]">
          <div className="relative group">
            <button
              type="button"
              title="Command Palette (⌘K)"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="no-drag w-full rounded-2xl flex items-center gap-3 px-3 py-2.5 text-[#6a7a8c] hover:text-[#00ff88] transition-all duration-300 border border-[#2a3440]/50 bg-[linear-gradient(145deg,rgba(12,18,26,0.9)_0%,rgba(6,10,14,0.95)_100%)] hover:border-[#00ff88]/35 hover:shadow-[0_0_24px_-8px_rgba(0,255,136,0.35),inset_0_1px_0_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff88]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f] active:scale-[0.98]"
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0a121a] border border-[#2a3440]/60 text-[#5a6a7a] group-hover:text-[#00ff88] group-hover:border-[#00ff88]/30 transition-colors shadow-inner">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <span className="flex flex-col items-start min-w-0 text-left">
                <span className="text-[12px] font-semibold text-[#8a96a4] group-hover:text-[#dce4ec] transition-colors">Quick search</span>
                <span className="text-[10px] text-[#4a5c6e] font-mono tracking-wide">⌘K</span>
              </span>
            </button>
            <span
              className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                px-3 py-2 rounded-xl bg-[#0c1018]/98 backdrop-blur-md text-[#a8b4c4] text-xs font-medium whitespace-nowrap
                shadow-[0_12px_40px_rgba(0,0,0,0.55)] border border-[#2a3440]/90
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

      <main className="shell-main flex-1 min-h-0 overflow-hidden flex flex-col min-w-0 bg-[#06080c]">
        {children}
      </main>
    </div>
  )
}
