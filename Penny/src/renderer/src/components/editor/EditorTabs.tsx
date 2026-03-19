import { useEditorStore, type EditorTab } from '../../stores/editor-store'

export function EditorTabs() {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const setActiveTab = useEditorStore(s => s.setActiveTab)
  const closeTab = useEditorStore(s => s.closeTab)

  if (tabs.length === 0) return null

  const handleClose = (e: React.MouseEvent, tab: EditorTab) => {
    e.stopPropagation()
    closeTab(tab.id)
  }

  return (
    <div className="flex items-center overflow-x-auto shrink-0 border-b border-slate-800/60 bg-slate-900/60 no-drag">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId
        const fileName = tab.path.split('/').pop() || tab.path
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-slate-800/40 shrink-0 transition-colors ${
              isActive
                ? 'bg-slate-800/50 text-slate-200'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
            }`}
          >
            {tab.dirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            )}
            <span className="truncate max-w-[140px]">{fileName}</span>
            <span
              onClick={(e) => handleClose(e, tab)}
              className="ml-1 text-slate-600 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
            >
              x
            </span>
          </button>
        )
      })}
    </div>
  )
}
