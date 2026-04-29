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
  // Bump this key whenever the directory changes so stagger items re-animate
  const [listKey, setListKey] = useState(0)
  // Bump on each file selection so the preview pane re-animates
  const [previewKey, setPreviewKey] = useState(0)

  const loadDir = useCallback(async (relativePath: string) => {
    setLoading(true)
    setEntries([]) // clear list so stagger re-fires on new entries
    try {
      const items = await window.api.listVentures(relativePath)
      setEntries(items)
      setCurrentPath(relativePath)
      setListKey(k => k + 1)
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
    setFileContent(null) // clear so preview re-animates
    setLoading(true)
    try {
      const content = await window.api.readVentureFile(entry.path)
      setFileContent(content)
      setPreviewKey(k => k + 1)
    } catch {
      setFileContent(null)
    }
    setLoading(false)
  }

  // Breadcrumb segments
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []
  const breadcrumbs = [
    { label: 'Docs', path: '' },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl w-[780px] max-h-[80vh] overflow-hidden flex flex-col animate-modal-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-white">File Cabinet</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400">
              DOCS
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-border-hover)] hover:text-white transition-colors text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="px-5 py-2 border-b border-[var(--c-border)] flex items-center gap-1 text-[11px] overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span
              key={crumb.path}
              className="flex items-center gap-1 shrink-0 transition-all duration-150"
            >
              {i > 0 && <span className="text-[var(--c-border)]">/</span>}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`transition-all duration-150 hover:text-[var(--c-bg-surface)] hover:text-white ${
                  i === breadcrumbs.length - 1
                    ? 'text-[var(--c-text-primary)] font-medium'
                    : 'text-[var(--c-border-hover)]'
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
          <div className="w-[280px] border-r border-[var(--c-border)] overflow-auto">
            {/* Loading skeleton */}
            {loading && entries.length === 0 && (
              <div className="px-4 py-3 space-y-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded animate-shimmer bg-[color-mix(in_srgb,var(--c-border)_40%,transparent)] shrink-0" />
                    <div
                      className="h-2.5 rounded animate-shimmer bg-[color-mix(in_srgb,var(--c-border)_40%,transparent)]"
                      style={{ width: `${55 + (i % 3) * 15}%` }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && entries.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 animate-card-enter">
                <span className="text-2xl opacity-30">📂</span>
                <p className="text-[var(--c-border)] text-xs">Empty directory</p>
              </div>
            )}

            {/* File / folder rows */}
            <div key={listKey}>
              {entries.map((entry, idx) => (
                <button
                  key={entry.path}
                  onClick={() => openFile(entry)}
                  style={{ animationDelay: `${Math.min(idx, 19) * 0.03}s` }}
                  className={`stagger-item w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)] transition-colors border-b border-[color-mix(in_srgb,var(--c-border)_50%,transparent)] ${
                    selectedFile === entry.path ? 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_80%,transparent)]' : ''
                  }`}
                >
                  <span className="text-sm shrink-0 hover:scale-110 transition-transform duration-100 inline-block">
                    {fileIcon(entry)}
                  </span>
                  <span className="text-xs text-[var(--c-text-secondary)] truncate">{entry.name}</span>
                  {entry.isDirectory && (
                    <span className="text-xs text-[var(--c-border)] ml-auto shrink-0">&rsaquo;</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: file content */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {/* File loading skeleton */}
            {loading && selectedFile && (
              <div className="space-y-3 pt-1">
                <div className="h-3 w-1/2 rounded animate-shimmer bg-[color-mix(in_srgb,var(--c-border)_40%,transparent)]" />
                <div className="h-px w-full bg-[color-mix(in_srgb,var(--c-bg-elevated)_60%,transparent)]" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 rounded animate-shimmer bg-[color-mix(in_srgb,var(--c-border)_30%,transparent)]"
                    style={{ width: `${40 + (i % 5) * 12}%` }}
                  />
                ))}
              </div>
            )}

            {/* Empty prompt */}
            {!selectedFile && !fileContent && !loading && (
              <div className="flex items-center justify-center h-full">
                <p className="text-[var(--c-border)] text-xs">Select a file to preview</p>
              </div>
            )}

            {/* File preview */}
            {fileContent !== null && selectedFile && !loading && (
              <div key={previewKey} className="ventures-md animate-card-enter">
                <div className="mb-3 pb-2 border-b border-[var(--c-border)]">
                  <p className="text-xs text-[var(--c-border-hover)] font-mono truncate">{selectedFile}</p>
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--c-border)]">
          <p className="text-xs text-[var(--c-border)]">
            {entries.length} items {currentPath ? `in ${currentPath}` : ''}
          </p>
          <button
            onClick={() => loadDir(currentPath)}
            className="px-3 py-1 text-xs bg-[var(--c-bg-elevated)] hover:bg-[var(--c-border)] rounded border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors"
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

        /* Theme-aware markdown */
        .md-content h1 { color: var(--c-text-bright); }
        .md-content h2 { color: var(--c-text-heading); }
        .md-content h3 { color: var(--c-text-primary); }
        .md-content p, .md-content li { color: var(--c-text-secondary); }
        .md-content hr { border-top: 1px solid var(--c-border); }
        .md-content strong { color: var(--c-text-bright); }
        .md-content em { color: var(--c-text-primary); }
        .md-content .md-inline-code { background: var(--c-bg-elevated); color: var(--c-accent-blue); }
        .md-content .md-code-block { background: var(--c-bg-chrome); border: 1px solid var(--c-border); color: var(--c-accent-blue); }
        .md-content .md-link { color: var(--c-accent-blue); }
        .md-content .md-wikilink { color: #a78bfa; }
      `}</style>
    </div>
  )
}
