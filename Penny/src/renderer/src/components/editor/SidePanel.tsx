import { useState, useEffect } from 'react'
import { OutlinePanel } from './OutlinePanel'
import { useEditorStore } from '../../stores/editor-store'

type SidePanelTab = 'outline' | 'backlinks'

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('outline')

  return (
    <div className="h-full flex flex-col border-l border-[#2a3440]/60 bg-[#06080c]/50">
      {/* Tab switcher */}
      <div className="shrink-0 flex border-b border-[#2a3440]/60">
        {(['outline', 'backlinks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1.5 text-xs capitalize transition-colors ${
              activeTab === tab
                ? 'text-[#00e5ff] border-b border-[#00ff88]/60'
                : 'text-[#5a6a7a] hover:text-[#c4ccd6]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'outline' && <OutlinePanel />}
        {activeTab === 'backlinks' && <BacklinksContent />}
      </div>
    </div>
  )
}

interface Backlink {
  title: string
  path: string
  snippet: string
}

function BacklinksContent() {
  const activeTab = useEditorStore(s => s.getActiveTab())
  const activePath = activeTab?.path ?? null
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activePath) {
      setBacklinks([])
      return
    }
    setLoading(true)
    window.api
      .vaultBacklinks(activePath)
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
      .finally(() => setLoading(false))
  }, [activePath])

  if (!activePath) {
    return <div className="p-3 text-xs text-[#4a5c6e]">No file open</div>
  }

  if (loading) {
    return <div className="p-3 text-xs text-[#5a6a7a] animate-pulse">Loading backlinks...</div>
  }

  if (backlinks.length === 0) {
    return <div className="p-3 text-xs text-[#4a5c6e]">No backlinks found</div>
  }

  return (
    <div className="overflow-y-auto h-full">
      {backlinks.map(bl => (
        <div
          key={bl.path}
          className="px-3 py-1.5 cursor-pointer hover:bg-[#141a22]/50 transition-colors border-b border-[#2a3440]/30"
          title={bl.path}
        >
          <div className="text-sm text-[#c4ccd6] truncate">
            {bl.title || bl.path.split('/').pop()?.replace(/\.md$/, '') || bl.path}
          </div>
          <div className="text-[10px] text-[#4a5c6e] truncate">{bl.path}</div>
        </div>
      ))}
    </div>
  )
}
