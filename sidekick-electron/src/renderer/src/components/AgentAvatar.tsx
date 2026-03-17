import { type AgentStatus, type SessionMode } from '../types'

interface AgentAvatarProps {
  name: string
  status: AgentStatus
  sessionMode?: SessionMode
  needsInteraction?: boolean
  size?: 'sm' | 'md' | 'lg'
  avatarColor?: string
}

// Simple color palette for different agents
const AVATAR_COLORS = [
  { hair: '#6366f1', shirt: '#4f46e5' },  // indigo
  { hair: '#f59e0b', shirt: '#d97706' },  // amber
  { hair: '#10b981', shirt: '#059669' },  // emerald
  { hair: '#ef4444', shirt: '#dc2626' },  // red
  { hair: '#8b5cf6', shirt: '#7c3aed' },  // violet
  { hair: '#06b6d4', shirt: '#0891b2' },  // cyan
  { hair: '#f97316', shirt: '#ea580c' },  // orange
  { hair: '#ec4899', shirt: '#db2777' },  // pink
]

function hashColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function AgentAvatar({ name, status, sessionMode, needsInteraction, size = 'md' }: AgentAvatarProps) {
  const colors = hashColor(name)
  const dims = size === 'sm' ? 48 : size === 'md' ? 72 : 96

  // Determine animation class
  const isWorking = sessionMode === 'working' || sessionMode === 'plan'
  const isWaiting = needsInteraction || sessionMode === 'waiting' || sessionMode === 'accept-edits'
  const isIdle = status === 'idle' || status === 'sleeping'

  const animClass = isWaiting ? 'avatar-wave' : isWorking ? 'avatar-typing' : 'avatar-idle'

  // Status glow
  const glowColor = isWaiting ? 'rgba(251,191,36,0.4)' : isWorking ? 'rgba(52,211,153,0.3)' : 'transparent'

  return (
    <div
      className={`relative ${animClass}`}
      style={{ width: dims, height: dims }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-md transition-all duration-1000"
        style={{ backgroundColor: glowColor }}
      />

      {/* Character SVG */}
      <svg viewBox="0 0 64 80" width={dims} height={dims} className="relative z-10">
        {/* Desk */}
        <rect x="8" y="58" width="48" height="6" rx="2" fill="#334155" />
        <rect x="12" y="56" width="12" height="4" rx="1" fill="#475569" /> {/* monitor base */}
        <rect x="10" y="42" width="16" height="14" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" /> {/* monitor */}
        <rect x="12" y="44" width="12" height="9" rx="1" fill={isWorking ? '#0ea5e9' : isIdle ? '#1e293b' : '#f59e0b'} opacity={isWorking ? 0.8 : 0.3} /> {/* screen */}

        {/* Laptop on desk */}
        <rect x="30" y="54" width="18" height="3" rx="1" fill="#374151" />
        <rect x="31" y="49" width="16" height="6" rx="1" fill="#1f2937" stroke="#4b5563" strokeWidth="0.5" />

        {/* Body/Shirt */}
        <rect x="22" y="40" width="20" height="18" rx="4" fill={colors.shirt} />

        {/* Arms */}
        <g className={isWorking ? 'avatar-arms-typing' : isWaiting ? 'avatar-arms-wave' : ''}>
          {/* Left arm */}
          <rect x="16" y="42" width="8" height="4" rx="2" fill={colors.shirt} />
          {/* Right arm */}
          <rect x="40" y="42" width="8" height="4" rx="2" fill={colors.shirt} />
          {/* Hands */}
          <circle cx="16" cy="44" r="2.5" fill="#fbbf24" />
          <circle cx="48" cy="44" r="2.5" fill="#fbbf24" />
        </g>

        {/* Head */}
        <circle cx="32" cy="30" r="10" fill="#fde68a" /> {/* face */}

        {/* Hair */}
        <path d="M22 28 Q22 18 32 18 Q42 18 42 28 L42 24 Q42 16 32 16 Q22 16 22 24 Z" fill={colors.hair} />

        {/* Eyes */}
        <g className={isIdle ? 'avatar-eyes-blink' : ''}>
          <circle cx="28" cy="30" r="1.5" fill="#1e293b" />
          <circle cx="36" cy="30" r="1.5" fill="#1e293b" />
        </g>

        {/* Mouth */}
        {isWaiting ? (
          <circle cx="32" cy="35" r="2" fill="#1e293b" />
        ) : isWorking ? (
          <line x1="29" y1="35" x2="35" y2="35" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <path d="M29 34 Q32 37 35 34" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        )}

        {/* Status indicator */}
        <circle cx="52" cy="18" r="4" fill={isWaiting ? '#fbbf24' : isWorking ? '#34d399' : '#64748b'} className={isWaiting ? 'avatar-status-pulse' : ''} />

        {/* Exclamation for needs interaction */}
        {isWaiting && (
          <g>
            <text x="50" y="12" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold">!</text>
          </g>
        )}
      </svg>

      {/* Name plate */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800/90 border border-slate-700/50 rounded text-[10px] text-slate-300 whitespace-nowrap truncate max-w-[80px] text-center">
        {name.split(' ')[0]}
      </div>
    </div>
  )
}
