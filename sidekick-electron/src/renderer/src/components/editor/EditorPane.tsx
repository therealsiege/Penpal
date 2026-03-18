import { useCallback, useMemo } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useVaultIndex } from '../../stores/vault-index'
import { EditorTabs } from './EditorTabs'
import { MarkdownEditor } from './MarkdownEditor'
import { useToast } from '../Toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import matter from 'gray-matter'
import { FrontmatterEditor } from './FrontmatterEditor'
import { TemplateInserter } from './TemplateInserter'

export function EditorPane() {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const viewMode = useEditorStore(s => s.viewMode)
  const setDirty = useEditorStore(s => s.setDirty)
  const setViewMode = useEditorStore(s => s.setViewMode)
  const updateTabContent = useEditorStore(s => s.updateTabContent)
  const openFile = useEditorStore(s => s.openFile)
  const resolveWikilink = useVaultIndex(s => s.resolveWikilink)
  const { toast } = useToast()

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const handleChange = useCallback((content: string) => {
    if (!activeTabId) return
    setDirty(activeTabId, true, content)
  }, [activeTabId, setDirty])

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.dirty || activeTab.content === null) return
    try {
      const result = await window.api.vaultWrite(activeTab.path, activeTab.content)
      if (result?.error) {
        toast(result.error, 'error')
        return
      }
      updateTabContent(activeTab.id, activeTab.content, result.mtime)
      toast('Saved', 'success')
    } catch (err) {
      toast('Save failed: ' + (err as Error).message, 'error')
    }
  }, [activeTab, updateTabContent, toast])

  const handleNavigate = useCallback(async (target: string) => {
    const entry = resolveWikilink(target)
    if (!entry) {
      toast(`"${target}" not found in vault`, 'error')
      return
    }
    try {
      const result = await window.api.vaultRead(entry.path)
      if (result?.content != null) {
        openFile(entry.path, result.content, result.mtime)
      }
    } catch { /* skip */ }
  }, [resolveWikilink, openFile, toast])

  const { frontmatter, body } = useMemo(() => {
    if (!activeTab?.content) return { frontmatter: null, body: '' }
    try {
      const parsed = matter(activeTab.content)
      const fm = Object.keys(parsed.data).length > 0 ? parsed.data : null
      return { frontmatter: fm, body: parsed.content }
    } catch {
      return { frontmatter: null, body: activeTab.content }
    }
  }, [activeTab?.content])

  const processedBody = useMemo(() => {
    return body.replace(/\[\[([^\]]+)\]\]/g, (_, link: string) => {
      const parts = link.split('|')
      const display = (parts[1] || parts[0]).trim()
      return `**${display}**`
    })
  }, [body])

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600">
        <div className="text-center">
          <div className="text-2xl mb-2">Select a file</div>
          <div className="text-sm text-slate-700">Click to preview, double-click to edit</div>
        </div>
      </div>
    )
  }

  const isMarkdown = activeTab?.path.endsWith('.md')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <EditorTabs />

      {activeTab && (
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40">
          <div className="text-sm text-slate-500 truncate mr-4">{activeTab.path}</div>
          <div className="flex items-center gap-2 shrink-0">
            <TemplateInserter onInsert={(content) => { if (activeTabId && activeTab?.content != null) setDirty(activeTabId, true, activeTab.content + '\n' + content) }} />
            <div className="flex items-center gap-1">
            {(['source', 'preview'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-600/30 text-blue-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode === 'source' ? 'Edit' : 'Preview'}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab && viewMode === 'source' && activeTab.content !== null && (
          <MarkdownEditor
            key={activeTab.id}
            content={activeTab.content}
            onChange={handleChange}
            onSave={handleSave}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab && viewMode === 'preview' && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <FrontmatterEditor />
            {isMarkdown ? (
              <div className="vault-markdown prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {processedBody}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                {activeTab.content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
