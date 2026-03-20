// Usage:
//   <StatusBadge status="ok" label="Connected" />
//   <StatusBadge status="warn" label="Degraded" size="md" />
//   <StatusBadge status="fail" label="Offline" />
//   <StatusBadge status="none" label="Unknown" />

const KEYFRAMES = `
@keyframes badge-enter {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ok-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes warn-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
`

// Inject keyframes once into the document head.
// Safe to call multiple times — guard via dataset flag.
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('status-badge-keyframes')) return
  const style = document.createElement('style')
  style.id = 'status-badge-keyframes'
  style.textContent = KEYFRAMES
  document.head.appendChild(style)
}

interface StatusBadgeProps {
  status: 'ok' | 'fail' | 'warn' | 'none'
  label?: string
  size?: 'sm' | 'md'
}

const DOT_COLORS = {
  ok: 'bg-emerald-500',
  fail: 'bg-red-500',
  warn: 'bg-amber-500',
  none: 'bg-slate-600',
}

const TEXT_COLORS = {
  ok: 'text-emerald-400',
  fail: 'text-red-400',
  warn: 'text-amber-400',
  none: 'text-slate-500',
}

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  ensureKeyframes()

  const dotPx = size === 'sm' ? 8 : 10 // w-2 = 8px, w-2.5 = 10px
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  // --- dot inline style overrides (animation only; color stays in Tailwind) ---
  const dotStyle: React.CSSProperties = (() => {
    switch (status) {
      case 'warn':
        return {
          animation: 'warn-pulse 1.5s ease-in-out infinite',
        }
      case 'fail':
        return {
          boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)',
        }
      default:
        return {}
    }
  })()

  // --- pulsing ring for 'ok' (absolutely-positioned sibling behind the dot) ---
  const ringEl =
    status === 'ok' ? (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: 'rgb(16 185 129)', // emerald-500
          animation: 'ok-ring 2s ease-out infinite',
        }}
      />
    ) : null

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ animation: 'badge-enter 0.3s ease-out' }}
    >
      {/* dot wrapper — relative so the ring can be absolutely positioned */}
      <span
        className="relative inline-flex items-center justify-center flex-shrink-0"
        style={{ width: dotPx, height: dotPx }}
      >
        {ringEl}
        <span
          className={`${dotSize} rounded-full ${DOT_COLORS[status]} relative`}
          style={dotStyle}
        />
      </span>

      {label && (
        <span className={`text-xs ${TEXT_COLORS[status]}`}>{label}</span>
      )}
    </span>
  )
}
