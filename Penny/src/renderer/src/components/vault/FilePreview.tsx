import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import matter from 'gray-matter'
import type { VaultBacklink } from '../../types'

interface FilePreviewProps {
  filePath: string | null
}

export function FilePreview({ filePath }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [backlinks, setBacklinks] = useState<VaultBacklink[]>([])
  const [showBacklinks, setShowBacklinks] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setContent(null)
      setBacklinks([])
      return
    }
    setLoading(true)
    Promise.all([
      window.api.vaultRead(filePath),
      window.api.vaultBacklinks(filePath).catch(() => []),
    ]).then(([fileResult, bl]) => {
      setContent(fileResult?.content ?? null)
      setBacklinks(bl)
      setLoading(false)
    }).catch(() => {
      setContent(null)
      setLoading(false)
    })
  }, [filePath])

  const { frontmatter, body } = useMemo(() => {
    if (!content) return { frontmatter: null, body: '' }
    try {
      const parsed = matter(content)
      const fm = Object.keys(parsed.data).length > 0 ? parsed.data : null
      return { frontmatter: fm, body: parsed.content }
    } catch {
      return { frontmatter: null, body: content }
    }
  }, [content])

  // Convert wikilinks [[link]] to markdown links for display
  const processedBody = useMemo(() => {
    return body.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
      const parts = link.split('|')
      const target = parts[0].trim()
      const display = (parts[1] || parts[0]).trim()
      return `**${display}**`
    })
  }, [body])

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600">
        <div className="text-center">
          <div className="text-2xl mb-2">Select a file to preview</div>
          <div className="text-xs text-slate-700">Click any file in the tree</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  const isMarkdown = filePath.endsWith('.md')
  const fileName = filePath.split('/').pop() || filePath

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* File header */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <div className="text-xs text-slate-500 truncate">{filePath}</div>
        <div className="text-sm text-slate-200 font-medium">{fileName}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Frontmatter */}
        {frontmatter && (
          <div className="mb-4 rounded bg-slate-800/50 border border-slate-700/50 px-3 py-2">
            {Object.entries(frontmatter as Record<string, unknown>).map(([key, val]) => (
              <div key={key} className="flex gap-2 text-xs py-0.5">
                <span className="text-slate-500 shrink-0">{key}:</span>
                <span className="text-slate-300 truncate">{String(val)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Markdown or raw */}
        {isMarkdown ? (
          <div className="vault-markdown prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {processedBody}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="mt-6 border-t border-slate-800/60 pt-3">
            <button
              onClick={() => setShowBacklinks(!showBacklinks)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              <span>{showBacklinks ? '\u25BC' : '\u25B6'}</span>
              Backlinks ({backlinks.length})
            </button>
            {showBacklinks && (
              <div className="mt-2 space-y-1">
                {backlinks.map((bl, i) => (
                  <div key={i} className="text-xs text-slate-400 pl-3">
                    {bl.title || bl.path}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
