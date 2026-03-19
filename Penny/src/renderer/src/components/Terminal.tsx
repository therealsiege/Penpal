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
        background: '#0a0e1a',
        foreground: '#c8ccd4',
        cursor: '#528bff',
        cursorAccent: '#0a0e1a',
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

    const removeExit = window.pty.onExit((id, _exitCode) => {
      if (id === ptyId) {
        setExited(true)
        term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
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
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">{title || ptyId}</span>
          {exited && (
            <span className="text-[9px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">exited</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-sm leading-none px-1"
          title="Close terminal"
        >
          ×
        </button>
      </div>
      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 bg-[#0a0e1a]" />
    </div>
  )
}
