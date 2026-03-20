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

// Inline keyframe animation style blocks injected once per mount
const ANIMATION_STYLES = `
  @keyframes sparkFlicker {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }
  @keyframes thoughtPulse {
    0%, 100% { opacity: 0.3; r: 1.2px; }
    50% { opacity: 1; r: 1.8px; }
  }
  @keyframes steamRise {
    0% { stroke-dashoffset: 0; opacity: 0.7; }
    100% { stroke-dashoffset: -14; opacity: 0; }
  }
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected) return
  stylesInjected = true
  const el = document.createElement('style')
  el.textContent = ANIMATION_STYLES
  document.head.appendChild(el)
}

export function AgentAvatar({ name, status, sessionMode, needsInteraction, size = 'md' }: AgentAvatarProps) {
  ensureStyles()

  const colors = hashColor(name)
  const dims = size === 'sm' ? 48 : size === 'md' ? 72 : 96

  const isWorking = sessionMode === 'working' || sessionMode === 'plan'
  const isWaiting = needsInteraction || sessionMode === 'waiting' || sessionMode === 'accept-edits'
  const isIdle = status === 'idle' || status === 'sleeping'

  const animClass = isWaiting ? 'avatar-wave' : isWorking ? 'avatar-typing' : 'avatar-idle'

  const glowColor = isWaiting ? 'rgba(251,191,36,0.4)' : isWorking ? 'rgba(52,211,153,0.3)' : 'transparent'

  // Unique gradient ID per avatar to avoid SVG defs collisions
  const gradId = `monitorGlow-${name.replace(/\s+/g, '')}`

  return (
    <div
      className={`relative ${animClass}`}
      style={{ width: dims, height: dims }}
    >
      <div
        className="absolute inset-0 rounded-full blur-md transition-all duration-1000"
        style={{ backgroundColor: glowColor }}
      />

      <svg viewBox="0 0 64 80" width={dims} height={dims} className="relative z-10">

        {/* --- SVG defs: monitor screen gradient (always declared, only applied when isWorking) --- */}
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.1" />
            {isWorking && (
              <>
                <animate
                  attributeName="x1"
                  from="-100%"
                  to="100%"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  from="0%"
                  to="200%"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Desk surface */}
        <rect x="8" y="58" width="48" height="6" rx="2" fill="#334155" />
        <rect x="12" y="56" width="12" height="4" rx="1" fill="#475569" />

        {/* Monitor */}
        <rect x="10" y="42" width="16" height="14" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        {/* Monitor screen — base color */}
        <rect
          x="12"
          y="44"
          width="12"
          height="9"
          rx="1"
          fill={isWorking ? '#0ea5e9' : isIdle ? '#1e293b' : '#f59e0b'}
          opacity={isWorking ? 0.8 : 0.3}
        />
        {/* Monitor screen glow overlay (working only) */}
        {isWorking && (
          <rect
            x="12"
            y="44"
            width="12"
            height="9"
            rx="1"
            fill={`url(#${gradId})`}
          />
        )}

        {/* Keyboard */}
        <rect x="30" y="54" width="18" height="3" rx="1" fill="#374151" />
        <rect x="31" y="49" width="16" height="6" rx="1" fill="#1f2937" stroke="#4b5563" strokeWidth="0.5" />

        {/* Typing sparks near keyboard (isWorking) */}
        {isWorking && (
          <g>
            <circle
              cx="14"
              cy="51"
              r="1"
              fill="#34d399"
              style={{
                animation: 'sparkFlicker 0.55s ease-in-out infinite',
                animationDelay: '0s',
              }}
            />
            <circle
              cx="19"
              cy="50"
              r="0.9"
              fill="#7dd3fc"
              style={{
                animation: 'sparkFlicker 0.7s ease-in-out infinite',
                animationDelay: '0.18s',
              }}
            />
            <circle
              cx="24"
              cy="51.5"
              r="0.8"
              fill="#a78bfa"
              style={{
                animation: 'sparkFlicker 0.6s ease-in-out infinite',
                animationDelay: '0.34s',
              }}
            />
          </g>
        )}

        {/* Coffee mug (always present) */}
        {/* Mug body */}
        <rect x="29" y="51" width="6" height="5" rx="1" fill="#475569" />
        {/* Mug handle */}
        <path d="M35 52.5 Q38 52.5 38 54 Q38 55.5 35 55.5" fill="none" stroke="#475569" strokeWidth="0.8" />
        {/* Mug liquid top */}
        <rect x="29.5" y="51" width="5" height="1.2" rx="0.5" fill="#7c3aed" opacity="0.7" />

        {/* Coffee steam (isIdle) */}
        {isIdle && (
          <g>
            {/* Left steam wisp */}
            <path
              d="M31 50 Q30 47.5 31.5 45 Q33 42.5 31.5 40"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeDasharray="7"
              strokeDashoffset="0"
              style={{
                animation: 'steamRise 1.4s ease-in infinite',
                animationDelay: '0s',
              }}
            />
            {/* Right steam wisp */}
            <path
              d="M34 50 Q35 47 33.5 44.5 Q32 42 33.5 39.5"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeDasharray="7"
              strokeDashoffset="0"
              style={{
                animation: 'steamRise 1.6s ease-in infinite',
                animationDelay: '0.5s',
              }}
            />
          </g>
        )}

        {/* Shirt / body */}
        <rect x="22" y="40" width="20" height="18" rx="4" fill={colors.shirt} />

        {/* Arms */}
        <g className={isWorking ? 'avatar-arms-typing' : isWaiting ? 'avatar-arms-wave' : ''}>
          <rect x="16" y="42" width="8" height="4" rx="2" fill={colors.shirt} />
          <rect x="40" y="42" width="8" height="4" rx="2" fill={colors.shirt} />
          <circle cx="16" cy="44" r="2.5" fill="#fbbf24" />
          <circle cx="48" cy="44" r="2.5" fill="#fbbf24" />
        </g>

        {/* Head */}
        <circle cx="32" cy="30" r="10" fill="#fde68a" />

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

        {/* Thought bubble (isWaiting) */}
        {isWaiting && (
          <g>
            {/* Bubble body */}
            <rect x="38" y="7" width="20" height="10" rx="4" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.6" opacity="0.92" />
            {/* Stem dots */}
            <circle cx="39" cy="19" r="1.1" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.4" opacity="0.8" />
            <circle cx="37" cy="22" r="0.7" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.4" opacity="0.6" />
            {/* Three pulsing dots inside bubble */}
            <circle cx="44" cy="12" r="1.4" fill="#fbbf24"
              style={{ animation: 'thoughtPulse 0.9s ease-in-out infinite', animationDelay: '0s' }}
            />
            <circle cx="48" cy="12" r="1.4" fill="#fbbf24"
              style={{ animation: 'thoughtPulse 0.9s ease-in-out infinite', animationDelay: '0.3s' }}
            />
            <circle cx="52" cy="12" r="1.4" fill="#fbbf24"
              style={{ animation: 'thoughtPulse 0.9s ease-in-out infinite', animationDelay: '0.6s' }}
            />
          </g>
        )}

        {/* Status dot */}
        <circle
          cx="52"
          cy="18"
          r="4"
          fill={isWaiting ? '#fbbf24' : isWorking ? '#34d399' : '#64748b'}
          className={isWaiting ? 'avatar-status-pulse' : ''}
        />

        {isWaiting && (
          <text x="50" y="12" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold">!</text>
        )}
      </svg>

      {/* Name tag with drop-shadow polish */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800/90 border border-slate-700/50 rounded text-[10px] text-slate-300 whitespace-nowrap truncate max-w-[80px] text-center"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
      >
        {name.split(' ')[0]}
      </div>
    </div>
  )
}
