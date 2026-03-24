import type { ReactNode } from 'react'

interface LayoutProps {
  activePanel: string
  onNavigate: (panel: string) => void
  onOpenTasks?: () => void
  children: ReactNode
}

// Nav button config — label, panel key, SVG path(s)
interface NavItem {
  panel: string
  label: string
  icon: ReactNode
}

function NavButton({
  panel,
  label,
  icon,
  active,
  onClick,
}: {
  panel: string
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    // group wrapper enables group-hover: variants on children
    <div className="relative group">
      <button
        onClick={onClick}
        title={label}
        className={`no-drag relative w-full h-9 rounded-lg flex items-center gap-2 px-3 transition-all overflow-visible ${
          active
            ? 'bg-slate-700/80 text-white shadow-inner'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
        }`}
      >
        {/* Active indicator bar — left edge */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-500 transition-transform duration-200 origin-center ${
            active ? 'scale-y-100' : 'scale-y-0'
          }`}
        />

        {/* Icon — scales on hover via group */}
        <span className="shrink-0 transition-transform duration-150 group-hover:scale-110 flex items-center">
          {icon}
        </span>

        <span className="text-sm font-medium">{label}</span>
      </button>

      {/* Tooltip — only visible when not active, slides in from left */}
      {!active && (
        <span
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
            px-2 py-1 rounded-md bg-slate-800 text-slate-200 text-xs font-medium whitespace-nowrap
            shadow-lg border border-slate-700/60
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

export function Layout({ activePanel, onNavigate, onOpenTasks, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[160px] bg-slate-900/80 border-r border-slate-800/60 flex flex-col shrink-0 items-center">
        {/* Drag region for macOS traffic lights */}
        <div className="drag-region w-full pt-8 pb-2" />

        {/* Logo + Name */}
        <div className="mb-4 flex items-center gap-2 px-3">
          <img
            src="logo.png"
            alt="Penny"
            className="w-10 h-10 rounded-lg shadow-lg shrink-0"
            draggable={false}
            // Single bounce on mount: 0.6s ease-out, 0.3s delay, 1 iteration, keep end state
            style={{ animation: 'bounce 0.6s ease-out 0.3s 1 both' }}
          />
          <span
            className="text-2xl font-light text-slate-200 tracking-wide"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: '0.08em',
            }}
          >
            Penny
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col w-full px-2 gap-1">
          <NavButton
            panel="office"
            label="Office"
            active={activePanel === 'office'}
            onClick={() => onNavigate('office')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
          />

          <NavButton
            panel="vault"
            label="Vault"
            active={activePanel === 'vault'}
            onClick={() => onNavigate('vault')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />

          <NavButton
            panel="graph"
            label="Graph"
            active={activePanel === 'graph'}
            onClick={() => onNavigate('graph')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <circle cx="18" cy="6" r="3" />
                <line x1="8.5" y1="7.5" x2="15.5" y2="16.5" />
                <line x1="15.5" y1="7.5" x2="8.5" y2="16.5" />
              </svg>
            }
          />

          <NavButton
            panel="soundboard"
            label="Soundboard"
            active={activePanel === 'soundboard'}
            onClick={() => onNavigate('soundboard')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 5a10 10 0 0 1 0 14" />
              </svg>
            }
          />

          {onOpenTasks && (
            <div className="relative group">
              <button
                onClick={onOpenTasks}
                title="Tasks"
                className="no-drag w-full h-9 rounded-lg flex items-center gap-2 px-3 transition-all text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
              >
                <span className="shrink-0 transition-transform duration-150 group-hover:scale-110 flex items-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="4" rx="1" />
                    <rect x="3" y="10" width="18" height="4" rx="1" />
                    <rect x="3" y="17" width="18" height="4" rx="1" />
                  </svg>
                </span>
                <span className="text-sm font-medium">Tasks</span>
              </button>
              {/* Tasks tooltip */}
              <span
                className="
                  pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                  px-2 py-1 rounded-md bg-slate-800 text-slate-200 text-xs font-medium whitespace-nowrap
                  shadow-lg border border-slate-700/60
                  opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                  transition-all duration-200
                "
              >
                Tasks
              </span>
            </div>
          )}

          <NavButton
            panel="settings"
            label="Settings"
            active={activePanel === 'settings'}
            onClick={() => onNavigate('settings')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
          />
        </nav>

        {/* Command palette hint */}
        <div className="pb-3">
          <div className="relative group">
            <button
              title="Command Palette (⌘K)"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="no-drag w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-400 hover:bg-slate-800/60 transition-all"
            >
              <span className="transition-transform duration-150 group-hover:scale-110 flex items-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            </button>
            {/* Tooltip for command palette */}
            <span
              className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                px-2 py-1 rounded-md bg-slate-800 text-slate-200 text-xs font-medium whitespace-nowrap
                shadow-lg border border-slate-700/60
                opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                transition-all duration-200
              "
            >
              Command Palette (⌘K)
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
