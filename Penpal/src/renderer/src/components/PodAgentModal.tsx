import type { AgentState } from '../types'

const AGENT_AVATARS: Record<string, string> = {
  'fullstack-dev': './sprites/avatars/WuKong.png',
  'nextjs-frontend': './sprites/avatars/ErlangShen.png',
  'electron-dev': './sprites/avatars/ShaWujing.png',
  'backend-arch': './sprites/avatars/Guanyin.png',
  'expo-mobile': './sprites/avatars/Nezha.png',
  'embedded-dev': './sprites/avatars/BullDemonKing.png',
  'videogame-dev': './sprites/avatars/RedBoy.png',
  'ui-designer': './sprites/avatars/AoGuang.png',
  'product-mgr': './sprites/avatars/Tripitaka.png',
  'product-marketer': './sprites/avatars/AoRun.png',
  'exec-assistant': './sprites/avatars/ZhuBajie.png',
  'issue-planner': './sprites/avatars/Tripitaka.png',
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  working: { color: 'bg-emerald-400', label: 'Working' },
  idle: { color: 'bg-amber-400', label: 'Idle' },
  blocked: { color: 'bg-red-400', label: 'Blocked' },
  done: { color: 'bg-sky-400', label: 'Done' },
}

interface Props {
  agent: AgentState
  onClose: () => void
}

export function PodAgentModal({ agent, onClose }: Props) {
  const config = agent.config
  const avatarSrc = AGENT_AVATARS[config.id]
  const status = STATUS_DOT[agent.status] ?? STATUS_DOT.idle

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Card — no full-screen dim, just the card with its own shadow */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10"
        style={{ width: 320, height: 400 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Avatar fills the card */}
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={config.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--c-bg-elevated)] to-[var(--c-bg-app)]" />
        )}

        {/* Gradient fade at bottom for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />

        {/* Name + status pinned to bottom */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-center">
          <h2 className="text-lg font-bold text-white drop-shadow-lg">{config.name}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${status.color} shadow-sm`} />
            <span className="text-sm text-white/70">{status.label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
