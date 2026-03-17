import type { ReactNode } from 'react'

interface LayoutProps {
  activePanel: string
  onNavigate: (panel: string) => void
  children: ReactNode
}

export function Layout({ activePanel, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[140px] bg-slate-900/80 border-r border-slate-800/60 flex flex-col shrink-0 items-center">
        {/* Drag region for macOS traffic lights */}
        <div className="drag-region w-full pt-8 pb-2" />

        {/* Logo + Name */}
        <div className="mb-4 flex items-center gap-2 px-3">
          <img src="/logo.png" alt="Gus" className="w-10 h-10 rounded-lg shadow-lg shrink-0" draggable={false} />
          <span className="text-2xl font-light text-slate-200 tracking-wide" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif", letterSpacing: '0.08em' }}>Gus</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col w-full px-2 gap-1">
          <button
            onClick={() => onNavigate('office')}
            title="Office"
            className={`no-drag w-full h-9 rounded-lg flex items-center gap-2 px-3 transition-all ${
              activePanel === 'office'
                ? 'bg-slate-700/80 text-white shadow-inner'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-xs font-medium">Office</span>
          </button>
          <button
            onClick={() => onNavigate('vault')}
            title="Vault"
            className={`no-drag w-full h-9 rounded-lg flex items-center gap-2 px-3 transition-all ${
              activePanel === 'vault'
                ? 'bg-slate-700/80 text-white shadow-inner'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="text-xs font-medium">Vault</span>
          </button>
          <button
            onClick={() => onNavigate('settings')}
            title="Settings"
            className={`no-drag w-full h-9 rounded-lg flex items-center gap-2 px-3 transition-all ${
              activePanel === 'settings'
                ? 'bg-slate-700/80 text-white shadow-inner'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-xs font-medium">Settings</span>
          </button>
        </nav>

        {/* Command palette hint */}
        <div className="pb-3">
          <button
            title="Command Palette (⌘K)"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="no-drag w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-400 hover:bg-slate-800/60 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
