import type { AgentState } from '../types'

// Same avatar map as OrchestratorModal — maps agent IDs to portrait PNGs
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

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  solver: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Solver' },
  reviewer: { bg: 'bg-violet-500/15', text: 'text-violet-400', label: 'Reviewer' },
  executor: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'Executor' },
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  executing: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  validating: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
}

function elapsed(startMs: number): string {
  const diff = Date.now() - startMs
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

interface Props {
  agent: AgentState
  onClose: () => void
}

export function PodAgentModal({ agent, onClose }: Props) {
  const config = agent.config
  const avatarSrc = AGENT_AVATARS[config.id]
  const role = ROLE_COLORS[config.podRole] ?? ROLE_COLORS.solver
  const stage = agent.taskStage ? STAGE_COLORS[agent.taskStage] : null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[var(--c-bg-surface)] to-[var(--c-bg-app)] border border-[var(--c-border)] rounded-xl p-5 w-[420px] shadow-2xl ring-1 ring-[color-mix(in_srgb,var(--c-accent)_10%,transparent)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header: Avatar + Name */}
        <div className="flex items-start gap-4 mb-4">
          {avatarSrc && (
            <img
              src={avatarSrc}
              alt={config.name}
              className="w-16 h-16 rounded-lg object-cover border border-[var(--c-border)]/40 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[var(--c-text-heading)]">{config.name}</h2>
            {config.title && (
              <p className="text-xs text-[var(--c-text-muted)] mt-0.5">{config.title}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${role.bg} ${role.text} border-current/20 font-medium`}>
                {role.label}
              </span>
              {agent.taskStage && stage && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${stage.bg} ${stage.text} border-current/20`}>
                  {agent.taskStage}
                </span>
              )}
              {config.model && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--c-bg-elevated)] text-[var(--c-text-secondary)] border border-[var(--c-border)]/30">
                  {config.model}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Task Info */}
        {agent.taskTitle && (
          <div className="mb-3 p-3 rounded-lg bg-[var(--c-bg-elevated)] border border-[var(--c-border)]/30">
            <p className="text-xs text-[var(--c-text-muted)] mb-1">Current Task</p>
            <p className="text-sm text-[var(--c-text-primary)] leading-snug">{agent.taskTitle}</p>
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-3 text-xs text-[var(--c-text-secondary)]">
          {agent.uptime && (
            <div>
              <span className="text-[var(--c-text-muted)]">Uptime: </span>
              <span className="font-mono">{agent.uptime}</span>
            </div>
          )}
          {agent.sessionMode && (
            <div>
              <span className="text-[var(--c-text-muted)]">Mode: </span>
              <span>{agent.sessionMode}</span>
            </div>
          )}
          {agent.cwd && (
            <div className="truncate">
              <span className="text-[var(--c-text-muted)]">Dir: </span>
              <span className="font-mono">{agent.cwd.split('/').pop()}</span>
            </div>
          )}
        </div>

        {/* Persona */}
        {config.persona?.catchphrase && (
          <p className="text-xs italic text-[var(--c-text-muted)] mb-3">
            &ldquo;{config.persona.catchphrase}&rdquo;
          </p>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full mt-2 px-4 py-2 text-xs rounded-lg bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)]/40 text-[var(--c-text-secondary)] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
