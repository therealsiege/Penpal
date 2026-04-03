import { useCallback, useMemo, useRef, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useVaultIndex } from '../../stores/vault-index'
import { EditorTabs } from './EditorTabs'
import { MarkdownEditor } from './MarkdownEditor'
import { useToast } from '../Toast'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import matter from 'gray-matter'
import { FrontmatterEditor } from './FrontmatterEditor'
import { TemplateInserter } from './TemplateInserter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function readingTime(words: number): string {
  const mins = Math.max(1, Math.ceil(words / 230))
  return `${mins} min read`
}

/** Resolve an image src to a vault:// URL if it's a local path */
function resolveImageSrc(src: string): string {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('vault://')) return src
  // Local vault path — encode components, keep slashes
  const encoded = src.split('/').map(s => encodeURIComponent(s)).join('/')
  return `vault://${encoded}`
}

/** Turn a heading text into a slug for anchor linking */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ---------------------------------------------------------------------------
// Custom ReactMarkdown components for preview
// ---------------------------------------------------------------------------

function useMarkdownComponents(onNavigate: (target: string) => void): Components {
  return useMemo<Components>(() => ({
    // Images: resolve local paths via vault:// protocol
    img: ({ src, alt, ...props }) => (
      <img
        {...props}
        src={resolveImageSrc(src ?? '')}
        alt={alt ?? ''}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          // Hide broken images gracefully
          img.style.display = 'none'
        }}
        style={{ maxWidth: '100%', borderRadius: 6, margin: '12px 0' }}
      />
    ),

    // Headings: add id anchors for TOC scroll-to
    h1: ({ children, ...props }) => {
      const text = typeof children === 'string' ? children : String(children)
      return <h1 id={slugify(text)} {...props}>{children}</h1>
    },
    h2: ({ children, ...props }) => {
      const text = typeof children === 'string' ? children : String(children)
      return <h2 id={slugify(text)} {...props}>{children}</h2>
    },
    h3: ({ children, ...props }) => {
      const text = typeof children === 'string' ? children : String(children)
      return <h3 id={slugify(text)} {...props}>{children}</h3>
    },

    // Links: handle wikilink-style navigation for internal links
    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith('http://') || href?.startsWith('https://')
      if (isExternal) {
        return (
          <a
            {...props}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            {children}
          </a>
        )
      }
      // Internal link — navigate in vault
      return (
        <a
          {...props}
          href={href}
          className="text-[var(--c-accent-blue)] underline underline-offset-2 hover:text-[var(--c-accent)] cursor-pointer"
          onClick={(e) => {
            e.preventDefault()
            if (href) onNavigate(href.replace(/\.md$/, ''))
          }}
        >
          {children}
        </a>
      )
    },
  }), [onNavigate])
}

// ---------------------------------------------------------------------------
// EditorPane
// ---------------------------------------------------------------------------

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
  const previewRef = useRef<HTMLDivElement>(null)

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

  // Listen for outline-scroll events (TOC clicks) in preview mode
  useEffect(() => {
    const handler = (e: Event) => {
      if (viewMode !== 'preview' || !previewRef.current) return
      const { line } = (e as CustomEvent).detail
      if (typeof line !== 'number') return
      // Find the heading at that line index and scroll to its anchor
      const headings = previewRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
      // Build heading index from content to match line numbers
      const contentHeadings: string[] = []
      if (activeTab?.content) {
        const lines = activeTab.content.split('\n')
        let inFm = false
        for (const l of lines) {
          if (l.trim() === '---' && !inFm && contentHeadings.length === 0) { inFm = true; continue }
          if (inFm) { if (l.trim() === '---') inFm = false; continue }
          const m = l.match(/^#{1,6}\s+(.+)/)
          if (m) contentHeadings.push(m[1].trim())
        }
      }
      // Find the Nth heading that matches
      let headingIdx = 0
      if (activeTab?.content) {
        const lines = activeTab.content.split('\n')
        let inFm = false
        for (let i = 0; i < lines.length && i <= line; i++) {
          const l = lines[i]
          if (l.trim() === '---' && !inFm && i === 0) { inFm = true; continue }
          if (inFm) { if (l.trim() === '---') inFm = false; continue }
          if (l.match(/^#{1,6}\s+/) && i < line) headingIdx++
        }
      }
      const target = headings[headingIdx]
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    document.addEventListener('outline-scroll', handler)
    return () => document.removeEventListener('outline-scroll', handler)
  }, [viewMode, activeTab?.content])

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

  // Process wikilinks into clickable markdown links
  const processedBody = useMemo(() => {
    return body.replace(/\[\[([^\]]+)\]\]/g, (_, link: string) => {
      const parts = link.split('|')
      const target = parts[0].trim()
      const display = (parts[1] || parts[0]).trim()
      return `[${display}](${target})`
    })
  }, [body])

  // Stats
  const words = useMemo(() => wordCount(body), [body])
  const readTime = useMemo(() => readingTime(words), [words])

  const components = useMarkdownComponents(handleNavigate)

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--c-text-faint)]">
        <div className="text-center">
          <div className="text-2xl mb-2">Select a file</div>
          <div className="text-sm text-[var(--c-text-muted)]">Click to preview, double-click to edit</div>
        </div>
      </div>
    )
  }

  const isMarkdown = activeTab?.path.endsWith('.md')
  const title = activeTab?.path.split('/').pop()?.replace(/\.md$/, '') ?? ''

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <EditorTabs />

      {activeTab && (
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--c-bg-surface)_40%,transparent)]">
          <div className="flex items-center gap-3 truncate mr-4">
            <span className="text-sm text-[var(--c-text-muted)] truncate">{activeTab.path}</span>
            {isMarkdown && (
              <span className="text-[10px] text-[var(--c-border)] tabular-nums shrink-0">
                {words.toLocaleString()} words &middot; {readTime}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TemplateInserter onInsert={(content) => { if (activeTabId && activeTab?.content != null) setDirty(activeTabId, true, activeTab.content + '\n' + content) }} />
            <div className="flex items-center gap-1">
            {(['source', 'preview'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent-blue)]'
                    : 'text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)]'
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
          <div ref={previewRef} className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-6">
              {/* Article title */}
              {isMarkdown && title && (
                <h1 className="text-2xl font-bold text-[var(--c-text-heading)] mb-1 leading-tight">{title}</h1>
              )}
              {/* Reading stats */}
              {isMarkdown && (
                <div className="text-xs text-[var(--c-border-hover)] mb-6">
                  {words.toLocaleString()} words &middot; {readTime}
                </div>
              )}

              <FrontmatterEditor />

              {isMarkdown ? (
                <div className="vault-markdown prose prose-invert max-w-none text-[15px] leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={components}
                  >
                    {processedBody}
                  </ReactMarkdown>
                </div>
              ) : (
                <pre className="text-xs text-[var(--c-text-primary)] font-mono whitespace-pre-wrap break-words">
                  {activeTab.content}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
