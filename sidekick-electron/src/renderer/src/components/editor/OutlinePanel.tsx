import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editor-store'

interface HeadingItem {
  level: number
  text: string
  line: number
}

export function OutlinePanel() {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const headings = useMemo(() => {
    if (!activeTab?.content) return []
    const items: HeadingItem[] = []
    const lines = activeTab.content.split('\n')

    // Skip frontmatter
    let inFrontmatter = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (i === 0 && line.trim() === '---') { inFrontmatter = true; continue }
      if (inFrontmatter) {
        if (line.trim() === '---') { inFrontmatter = false }
        continue
      }

      const match = line.match(/^(#{1,6})\s+(.+)/)
      if (match) {
        items.push({
          level: match[1].length,
          text: match[2].trim(),
          line: i,
        })
      }
    }
    return items
  }, [activeTab?.content])

  if (!activeTab) {
    return (
      <div className="p-3 text-xs text-slate-600">No file open</div>
    )
  }

  if (headings.length === 0) {
    return (
      <div className="p-3 text-xs text-slate-600">No headings found</div>
    )
  }

  return (
    <div className="overflow-y-auto h-full py-2">
      {headings.map((h, i) => (
        <div
          key={i}
          className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 cursor-pointer transition-colors truncate"
          style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
          title={h.text}
        >
          <span className={h.level === 1 ? 'font-semibold text-slate-300' : ''}>
            {h.text}
          </span>
        </div>
      ))}
    </div>
  )
}
