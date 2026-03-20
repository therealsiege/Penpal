import { createContext, useContext, useState, useCallback, type ReactNode, type CSSProperties } from 'react'

// @keyframes toast-progress is injected once into the document head so we
// avoid a styled-components / emotion dependency while keeping the progress bar
// animation driven entirely by CSS (no JS timers per frame).
const PROGRESS_KEYFRAMES = `
@keyframes toast-progress {
  from { width: 100%; }
  to   { width: 0%; }
}
`

function ensureProgressKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById('toast-progress-keyframes')) return
  const style = document.createElement('style')
  style.id = 'toast-progress-keyframes'
  style.textContent = PROGRESS_KEYFRAMES
  document.head.appendChild(style)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  leaving: boolean
}

interface ToastContextType {
  toast: (message: string, type?: ToastItem['type']) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOAST_LIFETIME_MS = 3000
const EXIT_DURATION_MS  = 300
let nextId = 0

// Per-type colour classes (Tailwind, no dynamic strings)
const colors: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  error:   'bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400',
  info:    'bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-400',
}

const progressColor: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-400 dark:bg-emerald-500',
  error:   'bg-red-400 dark:bg-red-500',
  info:    'bg-blue-400 dark:bg-blue-500',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  ensureProgressKeyframes()

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    // 1. Mark as leaving — triggers exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    // 2. Remove from DOM after animation completes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, EXIT_DURATION_MS)
  }, [])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type, leaving: false }])
    setTimeout(() => dismiss(id), TOAST_LIFETIME_MS)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none"
          aria-live="polite"
          aria-label="Notifications"
        >
          {toasts.map((t, index) => (
            <ToastCard
              key={t.id}
              toast={t}
              leaving={t.leaving}
              index={index}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// ─── ToastCard ────────────────────────────────────────────────────────────────
// Separated so we can use a ref-callback trick to trigger the enter animation
// on mount without needing a useEffect + forceUpdate cycle in the provider.

interface ToastCardProps {
  toast: ToastItem
  leaving: boolean
  index: number
}

function ToastCard({ toast: t, leaving, index }: ToastCardProps) {
  // Mount off-screen, then flip `entered` on the next rAF so the browser has
  // painted the initial state and the CSS transition has something to animate from.
  const [entered, setEntered] = useState(false)

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    requestAnimationFrame(() => setEntered(true))
  }, [])

  // Subtle stagger: toasts higher in the stack shift up a few pixels
  const staggerY = index * -4

  const enterStyle: CSSProperties = entered
    ? {
        transform: leaving
          ? `translateX(110%) translateY(${staggerY}px)`
          : `translateX(0%)   translateY(${staggerY}px)`,
        opacity: leaving ? 0 : 1,
        transition: leaving
          ? `transform ${EXIT_DURATION_MS}ms ease-in, opacity ${EXIT_DURATION_MS}ms ease-in`
          : 'transform 300ms ease-out, opacity 300ms ease-out',
        pointerEvents: 'auto',
      }
    : {
        // Initial off-screen state — painted before first rAF
        transform: `translateX(110%) translateY(${staggerY}px)`,
        opacity: 0,
        transition: 'transform 300ms ease-out, opacity 300ms ease-out',
        pointerEvents: 'auto',
      }

  const progressStyle: CSSProperties = {
    animationName: 'toast-progress',
    animationDuration: `${TOAST_LIFETIME_MS}ms`,
    animationTimingFunction: 'linear',
    animationFillMode: 'forwards',
  }

  return (
    <div
      ref={refCallback}
      role="status"
      aria-live="polite"
      className={`relative w-72 px-4 py-2.5 rounded-lg border text-sm shadow-lg backdrop-blur overflow-hidden ${colors[t.type]}`}
      style={enterStyle}
    >
      {/* Message */}
      <span>{t.message}</span>

      {/* Progress bar — shrinks from full width to 0 over TOAST_LIFETIME_MS */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10 dark:bg-white/10">
        <div
          className={`h-full ${progressColor[t.type]}`}
          style={progressStyle}
        />
      </div>
    </div>
  )
}

