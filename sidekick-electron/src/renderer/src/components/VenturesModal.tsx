import { useState, useEffect, useCallback } from 'react'

interface VentureEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface VenturesModalProps {
  onClose: () => void
}

// ── Minimal markdown-to-HTML converter ──────────────────────────────────

function mdToHtml(md: string): string {
  // Escape HTML entities first
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trimEnd()}</code></pre>`,
  )

  // Split into lines for block-level processing
  const lines = html.split('\n')
  const out: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Skip lines inside pre blocks (already handled)
    if (line.includes('<pre class="md-code-block">')) {
      // Find closing tag on same or later lines
      out.push(line)
      while (!line.includes('</pre>') && i < lines.length - 1) {
        i++
        line = lines[i]
        out.push(line)
      }
      continue
    }

    // Headers
    if (line.startsWith('### ')) { closePendingList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## ')) { closePendingList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# ')) { closePendingList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { closePendingList(); out.push('<hr />'); continue }

    // Unordered list items
    if (/^[-*] /.test(line.trim())) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.trim().slice(2))}</li>`)
      continue
    }

    // Ordered list items
    if (/^\d+\. /.test(line.trim())) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.trim().replace(/^\d+\.\s/, ''))}</li>`)
      continue
    }

    // Close list if we hit a non-list line
    closePendingList()

    // Empty line
    if (line.trim() === '') { out.push(''); continue }

    // Paragraph
    out.push(`<p>${inline(line)}</p>`)
  }

  closePendingList()
  return out.join('\n')

  function closePendingList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  function inline(text: string): string {
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links — markdown style
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>')
    // Wikilinks — [[target|label]] or [[target]]
    text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="md-wikilink">$2</span>')
    text = text.replace(/\[\[([^\]]+)\]\]/g, '<span class="md-wikilink">$1</span>')
    return text
  }
}

export function VenturesModal({ onClose }: VenturesModalProps) {
  const [entries, setEntries] = useState<VentureEntry[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDir = useCallback(async (relativePath: string) => {
    setLoading(true)
    try {
      const items = await window.api.listVentures(relativePath)
      setEntries(items)
      setCurrentPath(relativePath)
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadDir('') }, [loadDir])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const navigateTo = (relativePath: string) => {
    setFileContent(null)
    setSelectedFile(null)
    loadDir(relativePath)
  }

  const openFile = async (entry: VentureEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path)
      return
    }
    setSelectedFile(entry.path)
    setLoading(true)
    try {
      const content = await window.api.readVentureFile(entry.path)
      setFileContent(content)
    } catch {
      setFileContent(null)
    }
    setLoading(false)
  }

  // Breadcrumb segments
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []
  const breadcrumbs = [
    { label: 'Ventures', path: '' },
    ...segments.map((seg, i) => ({
      label: seg,
      path: segments.slice(0, i + 1).join('/'),
    })),
  ]

  const fileIcon = (entry: VentureEntry) => {
    if (entry.isDirectory) return '\u{1F4C1}'
    if (entry.name.endsWith('.md')) return '\u{1F4C4}'
    if (entry.name.endsWith('.json')) return '\u{1F4CA}'
    return '\u{1F4CE}'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl w-[780px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">File Cabinet</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
              VENTURES
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 text-[11px] overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-slate-400 dark:text-slate-600">/</span>}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`hover:text-slate-900 dark:hover:text-white transition-colors ${
                  i === breadcrumbs.length - 1 ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500'
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Body — two-panel layout */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left: file list */}
          <div className="w-[280px] border-r border-slate-200 dark:border-slate-800 overflow-auto">
            {loading && !fileContent && (
              <p className="text-slate-500 text-xs px-4 py-3">Loading...</p>
            )}
            {!loading && entries.length === 0 && (
              <p className="text-slate-500 text-xs px-4 py-3">Empty directory</p>
            )}
            {entries.map(entry => (
              <button
                key={entry.path}
                onClick={() => openFile(entry)}
                className={`w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-200/70 dark:border-slate-800/50 ${
                  selectedFile === entry.path ? 'bg-slate-200/80 dark:bg-slate-800/80' : ''
                }`}
              >
                <span className="text-sm shrink-0">{fileIcon(entry)}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{entry.name}</span>
                {entry.isDirectory && (
                  <span className="text-xs text-slate-400 dark:text-slate-600 ml-auto shrink-0">&rsaquo;</span>
                )}
              </button>
            ))}
          </div>

          {/* Right: file content */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {loading && selectedFile && (
              <p className="text-slate-500 text-xs">Loading file...</p>
            )}
            {!selectedFile && !fileContent && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 dark:text-slate-600 text-xs">Select a file to preview</p>
              </div>
            )}
            {fileContent !== null && selectedFile && (
              <div className="ventures-md">
                <div className="mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-mono truncate">{selectedFile}</p>
                </div>
                <div
                  className="md-content"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(fileContent) }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            {entries.length} items {currentPath ? `in ${currentPath}` : ''}
          </p>
          <button
            onClick={() => loadDir(currentPath)}
            className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Markdown styles — light and dark variants */}
      <style>{`
        .md-content h1 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .md-content h2 { font-size: 1.1rem; font-weight: 600; margin: 0.875rem 0 0.375rem; }
        .md-content h3 { font-size: 0.95rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
        .md-content p { font-size: 0.875rem; line-height: 1.6; margin: 0.375rem 0; }
        .md-content ul { padding-left: 1.25rem; margin: 0.375rem 0; }
        .md-content li { font-size: 0.875rem; line-height: 1.6; list-style: disc; }
        .md-content hr { border: none; margin: 0.75rem 0; }
        .md-content strong { font-weight: 600; }
        .md-content em { font-style: italic; }
        .md-content .md-inline-code {
          padding: 0.1rem 0.35rem; border-radius: 3px;
          font-family: ui-monospace, monospace; font-size: 0.7rem;
        }
        .md-content .md-code-block {
          border-radius: 6px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5rem 0;
          font-family: ui-monospace, monospace; font-size: 0.7rem; line-height: 1.5;
        }
        .md-content .md-link { text-decoration: underline; text-underline-offset: 2px; }

        /* Dark theme (always active) */
        .md-content h1 { color: #f1f5f9; }
        .md-content h2 { color: #e2e8f0; }
        .md-content h3 { color: #cbd5e1; }
        .md-content p, .md-content li { color: #94a3b8; }
        .md-content hr { border-top: 1px solid #334155; }
        .md-content strong { color: #e2e8f0; }
        .md-content em { color: #a5b4c8; }
        .md-content .md-inline-code { background: #1e293b; color: #93c5fd; }
        .md-content .md-code-block { background: #0f172a; border: 1px solid #1e293b; color: #93c5fd; }
        .md-content .md-link { color: #60a5fa; }
        .md-content .md-wikilink { color: #a78bfa; }
      `}</style>
    </div>
  )
}
