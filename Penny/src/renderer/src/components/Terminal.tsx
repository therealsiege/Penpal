import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  ptyId: string
  onClose: () => void
  title?: string
}

export function Terminal({ ptyId, onClose, title }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [exited, setExited] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: 'var(--c-bg-chrome)',
        foreground: '#c8ccd4',
        cursor: '#528bff',
        cursorAccent: 'var(--c-bg-chrome)',
        selectionBackground: '#3e4451',
        black: '#1e2127',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    // Fit after a frame so the container has dimensions
    requestAnimationFrame(() => {
      fit.fit()
      window.pty.resize(ptyId, term.cols, term.rows)
    })

    // Forward input to PTY
    term.onData(data => {
      window.pty.write(ptyId, data)
    })

    // Receive output from PTY
    const removeData = window.pty.onData((id, data) => {
      if (id === ptyId) term.write(data)
    })

    const removeExit = window.pty.onExit((id, exitCode) => {
      if (id === ptyId) {
        setExited(true)
        const isCrash = exitCode !== 0 && exitCode !== -1
        const msg = isCrash
          ? `\r\n\x1b[31m[Process crashed with exit code ${exitCode}]\x1b[0m\r\n`
          : '\r\n\x1b[90m[Process exited]\x1b[0m\r\n'
        term.write(msg)
      }
    })

    // Handle resize
    const resizeObs = new ResizeObserver(() => {
      try {
        fit.fit()
        window.pty.resize(ptyId, term.cols, term.rows)
      } catch { /* ignore during teardown */ }
    })
    resizeObs.observe(containerRef.current)

    termRef.current = term
    fitRef.current = fit

    // Focus terminal
    term.focus()

    return () => {
      resizeObs.disconnect()
      removeData()
      removeExit()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [ptyId])

  return (
    <div className="flex flex-col h-full">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--c-bg-surface)] border-b border-[var(--c-border)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--c-text-muted)] font-mono">{title || ptyId}</span>
          {exited && (
            <span className="text-[9px] text-[var(--c-border)] bg-[var(--c-bg-elevated)] px-1.5 py-0.5 rounded">exited</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[var(--c-border-hover)] hover:text-[var(--c-text-secondary)] text-sm leading-none px-1"
          title="Close terminal"
        >
          ×
        </button>
      </div>
      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 bg-[var(--c-bg-chrome)]" />
    </div>
  )
}
