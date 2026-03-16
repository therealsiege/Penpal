import type { ReactNode } from 'react'

const NAV_ITEMS = [
  { id: 'health', label: 'Health', icon: 'H', shortcut: '1' },
  { id: 'sessions', label: 'Sessions', icon: 'C', shortcut: '2' },
  { id: 'scheduler', label: 'Scheduler', icon: 'S', shortcut: '3' },
  { id: 'pipeline', label: 'Pipeline', icon: 'P', shortcut: '4' },
  { id: 'activity', label: 'Activity', icon: 'A', shortcut: '5' },
]

interface LayoutProps {
  activePanel: string
  onNavigate: (panel: string) => void
  children: ReactNode
}

export function Layout({ activePanel, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 select-none">
      {/* Sidebar */}
      <aside className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Title bar / drag region */}
        <div className="drag-region pt-10 px-4 pb-3 border-b border-slate-800">
          <h1 className="text-base font-bold tracking-tight">Sidekick</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Command Center</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`no-drag w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors ${
                activePanel === item.id
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                activePanel === item.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              <kbd className="text-[9px] text-slate-600 font-mono">{item.shortcut}</kbd>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
            <span>Command Palette</span>
          </div>
          <p className="text-[10px] text-slate-600 text-center">v0.2.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="drag-region h-10 shrink-0" />
        <div className="px-6 pb-6">
          {children}
        </div>
      </main>
    </div>
  )
}
