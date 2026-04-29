// ---------------------------------------------------------------------------
// office-helpers.ts
// Pure stateless utility functions extracted from OfficeScene.ts.
// ---------------------------------------------------------------------------

import Phaser from 'phaser'
import type { AgentState } from '../types'
import {
  CHAR_COLS, NUM_CHARS,
  POSE_IDLE, POSE_INTERACT, POSE_SIT, POSE_SURPRISE, POSE_HURT, POSE_WALK,
} from './office-constants'
import { activeTheme } from './office-theme'

/** Minimal room shape needed for door-Y calculation */
export interface DoorRoom {
  y: number
  height: number
  doorSide: 'top' | 'bottom'
}

// ---------------------------------------------------------------------------
// Sprite / pose helpers
// ---------------------------------------------------------------------------

export function getPoseFrame(charIdx: number, agent: AgentState): number {
  const base = charIdx * CHAR_COLS

  // Priority: interaction needs > error/compress > working > idle/default
  if (agent.needsInteraction) {
    // Surprise for questions or edits pending
    if (agent.interactionType === 'question' || agent.interactionType === 'accept-edits') {
      return base + POSE_SURPRISE
    }
    // Hurt/panic animation for tool approvals that need attention
    if (agent.interactionType === 'tool-approval') {
      return base + POSE_HURT
    }
    // Default wait state
    return base + POSE_WALK
  }

  // Working states
  if (agent.sessionMode === 'working' || agent.sessionMode === 'plan') {
    return base + POSE_INTERACT
  }

  // Special states
  if (agent.sessionMode === 'compressing') {
    return base + POSE_HURT  // Struggle animation for compression
  }

  if (agent.sessionMode === 'accept-edits') {
    return base + POSE_SURPRISE  // Alert about pending edits
  }

  if (agent.sessionMode === 'waiting') {
    return base + POSE_WALK  // Waiting/moving animation
  }

  // Idle or default
  if (agent.sessionMode === 'idle' || !agent.sessionMode) {
    return base + POSE_SIT
  }

  return base + POSE_IDLE
}

// ---------------------------------------------------------------------------
// Room helpers
// ---------------------------------------------------------------------------

/** World-space Y of the room's door opening. */
export function getRoomDoorY(room: DoorRoom): number {
  return room.doorSide === 'top'
    ? room.y - room.height / 2
    : room.y + room.height / 2
}

// ---------------------------------------------------------------------------
// Agent status helpers
// ---------------------------------------------------------------------------

export function getStatusColor(agent: AgentState): number {
  // Orchestrator headless tasks — stage-colored
  if (agent.isOrchestratorTask) {
    if (agent.taskStage === 'planning')    return activeTheme.thoughtPlan  // Purple
    if (agent.taskStage === 'validating')  return activeTheme.stageValidating  // Cyan
    return activeTheme.stageExecuting  // Orange for executing (default)
  }
  if (agent.needsInteraction) {
    if (agent.interactionType === 'tool-approval') return activeTheme.stageExecuting  // Red-ish for approval needed
    return activeTheme.statusWaiting  // Yellow for other interactions
  }
  if (agent.sessionMode === 'working')       return activeTheme.statusWorking  // Green for working
  if (agent.sessionMode === 'plan')          return activeTheme.thoughtPlan  // Purple for planning
  if (agent.sessionMode === 'accept-edits')  return activeTheme.stageValidating  // Blue for pending edits
  if (agent.sessionMode === 'compressing')   return activeTheme.stageExecuting  // Red for compressing
  if (agent.sessionMode === 'waiting')       return activeTheme.statusWaiting  // Yellow for waiting
  return activeTheme.deskStrokeIdle  // Gray for idle
}

export function isCursorAgent(agent: AgentState): boolean {
  return agent.config.model === 'cursor-agent'
}

export function isOpencodeAgent(agent: AgentState): boolean {
  const model = agent.config.model
  return model === 'opencode' ||
    model === 'openclaw' ||
    model === 'nemoclaw' ||
    agent.config.id.startsWith('opencode-') ||
    agent.config.id.startsWith('openclaw-') ||
    agent.config.id.startsWith('nemoclaw-')
}

export function isOrchestratorTask(agent: AgentState): boolean {
  return agent.config.model === 'orchestrator-task'
}

// ---------------------------------------------------------------------------
// Hash / character helpers
// ---------------------------------------------------------------------------

export function hashToken(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getCharacterIndex(name: string): number {
  return hashToken(name) % NUM_CHARS
}

export function getAgentCharacterIndex(agent: AgentState): number {
  if (isCursorAgent(agent)) return 1
  if (isOpencodeAgent(agent)) return 2  // Tinted character sprite
  if (isOrchestratorTask(agent)) return 0  // Character 0, tinted warm orange
  return getCharacterIndex(agent.config.name)
}

// ---------------------------------------------------------------------------
// Team / cwd helpers
// ---------------------------------------------------------------------------

export function getTeamInfo(cwd: string): { key: string; label: string } {
  if (cwd === '__unassigned__') return { key: '__unassigned__', label: 'Unassigned' }
  const parts = cwd.replace(/\/$/, '').split('/').filter(Boolean)
  const leaf = parts[parts.length - 1] || cwd
  const parent = parts.length >= 3 ? parts[parts.length - 2] : leaf
  return { key: parent, label: parent }
}

export function getTeamColor(teamKey: string): number {
  if (teamKey === '__unassigned__') return 0x94a3b8
  const palette = [0x3b82f6, 0x14b8a6, 0x8b5cf6, 0xf59e0b, 0x22c55e, 0xec4899]
  return palette[hashToken(teamKey) % palette.length]
}

export function cwdToLabel(cwd: string): string {
  if (cwd === '__unassigned__') return 'Unassigned'
  const parts = cwd.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || cwd
}

// ---------------------------------------------------------------------------
// Label / display helpers
// ---------------------------------------------------------------------------

export function formatLabel(label: string): string {
  return label
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Draw a dashed line on a Phaser Graphics object. Pure geometry, no scene dependency. */
export function drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return
  const ux = dx / len
  const uy = dy / len
  let d = 0
  let drawing = true
  g.beginPath()
  g.moveTo(x1, y1)
  while (d < len) {
    const step = drawing ? dashLen : gapLen
    d = Math.min(d + step, len)
    const px = x1 + ux * d
    const py = y1 + uy * d
    if (drawing) g.lineTo(px, py)
    else g.moveTo(px, py)
    drawing = !drawing
  }
  g.strokePath()
}

