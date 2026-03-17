import { useState } from 'react'
import { OutlinePanel } from './OutlinePanel'

type SidePanelTab = 'outline' | 'backlinks'

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('outline')

  return (
    <div className="h-full flex flex-col border-l border-slate-800/60 bg-slate-950/50">
      {/* Tab switcher */}
      <div className="shrink-0 flex border-b border-slate-800/60">
        {(['outline', 'backlinks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1.5 text-[10px] capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-300 border-b border-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'outline' && <OutlinePanel />}
        {activeTab === 'backlinks' && (
          <div className="p-3 text-xs text-slate-600">Backlinks coming soon</div>
        )}
      </div>
    </div>
  )
}
