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
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${dotSize} rounded-full ${DOT_COLORS[status]}`} />
      {label && <span className={`text-xs ${TEXT_COLORS[status]}`}>{label}</span>}
    </span>
  )
}
