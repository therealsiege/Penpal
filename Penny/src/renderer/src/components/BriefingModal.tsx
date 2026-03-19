import { useState, useEffect, useCallback } from 'react'
import { useToast } from './Toast'

// ── Minimal markdown-to-HTML converter (same as Docs modal) ───────────

function mdToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trimEnd()}</code></pre>`,
  )

  const lines = html.split('\n')
  const out: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    if (line.includes('<pre class="md-code-block">')) {
      out.push(line)
      while (!line.includes('</pre>') && i < lines.length - 1) {
        i++
        line = lines[i]
        out.push(line)
      }
      continue
    }

    if (line.startsWith('### ')) { closePendingList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## ')) { closePendingList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# ')) { closePendingList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue }

    if (/^---+$/.test(line.trim())) { closePendingList(); out.push('<hr />'); continue }

    if (/^[-*] /.test(line.trim())) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.trim().slice(2))}</li>`)
      continue
    }

    if (/^\d+\. /.test(line.trim())) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.trim().replace(/^\d+\.\s/, ''))}</li>`)
      continue
    }

    closePendingList()
    if (line.trim() === '') { out.push(''); continue }
    out.push(`<p>${inline(line)}</p>`)
  }

  closePendingList()
  return out.join('\n')

  function closePendingList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  function inline(text: string): string {
    text = text.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>')
    text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="md-wikilink">$2</span>')
    text = text.replace(/\[\[([^\]]+)\]\]/g, '<span class="md-wikilink">$1</span>')
    return text
  }
}

interface BriefingModalProps {
  onClose: () => void
}

export function BriefingModal({ onClose }: BriefingModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [briefingDate, setBriefingDate] = useState<string | null>(null)
  const [allDates, setAllDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  const loadLatest = useCallback(async () => {
    setLoading(true)
    try {
      const [latest, dates] = await Promise.all([
        window.api.getLatestBriefing(),
        window.api.listBriefings(),
      ])
      setAllDates(dates)
      if (latest) {
        setContent(latest.content)
        setBriefingDate(latest.date)
      } else {
        setContent(null)
        setBriefingDate(null)
      }
    } catch {
      setContent(null)
      setBriefingDate(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLatest() }, [loadLatest])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const loadBriefing = async (date: string) => {
    setLoading(true)
    try {
      const text = await window.api.getBriefing(date)
      if (text) {
        setContent(text)
        setBriefingDate(date)
      }
    } catch {
      toast('Failed to load briefing', 'error')
    }
    setLoading(false)
  }

  const generateNow = async () => {
    setGenerating(true)
    toast('Generating daily briefing...', 'info')
    try {
      await window.api.runJob('daily-briefing')
      toast('Briefing generated', 'success')
      await loadLatest()
    } catch {
      toast('Failed to generate briefing', 'error')
    }
    setGenerating(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl w-[820px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Mission Control</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400">
              BRIEFING
            </span>
            {briefingDate && (
              <span className="text-xs text-slate-500 ml-2">{briefingDate}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateNow}
              disabled={generating}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded border border-blue-500 text-white transition-colors disabled:opacity-40"
            >
              {generating ? 'Generating...' : 'Generate Now'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors text-lg leading-none px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Sidebar — past briefings */}
          <div className="w-[180px] border-r border-slate-200 dark:border-slate-800 overflow-auto shrink-0">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-medium">History</p>
            </div>
            {allDates.length === 0 && !loading && (
              <p className="text-xs text-slate-400 dark:text-slate-600 px-3 py-2">No briefings yet</p>
            )}
            {allDates.map(date => (
              <button
                key={date}
                onClick={() => loadBriefing(date)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-200/70 dark:border-slate-800/50 ${
                  briefingDate === date ? 'bg-slate-200/80 dark:bg-slate-800/80 text-blue-500 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {date}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500 text-xs">Loading briefing...</p>
              </div>
            )}
            {!loading && !content && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-center">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">No briefings found</p>
                  <p className="text-slate-400 dark:text-slate-600 text-xs">Generate your first daily briefing to get started.</p>
                </div>
                <button
                  onClick={generateNow}
                  disabled={generating}
                  className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors disabled:opacity-40"
                >
                  {generating ? 'Generating...' : 'Generate Daily Briefing'}
                </button>
              </div>
            )}
            {!loading && content && (
              <div className="briefing-md">
                <div
                  className="md-content"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            {allDates.length} briefing{allDates.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={loadLatest}
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
