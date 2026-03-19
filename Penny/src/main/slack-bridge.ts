/**
 * Slack Bridge — Per-project channels for interacting with Claude agents
 *
 * One Slack bot, per-project channels (e.g. #sk-sidekick, #sk-medscrub).
 * Multiple agents on the same project share a channel, distinguished by username.
 * @mention an agent name to target it; if only one agent, no mention needed.
 *
 * Env vars (in analytics/.env):
 *   SLACK_BOT_TOKEN    — xoxb-... Bot User OAuth Token
 *   SLACK_APP_TOKEN    — xapp-... Socket Mode token
 *   SLACK_CHANNEL_PREFIX — channel name prefix (default: "sk")
 */

import { App, LogLevel } from '@slack/bolt'
import { getClaudeSessions, sendToSession, getSessionConversation, type ClaudeSession } from './sessions'
import { getAgentConfigs, loadAgentSessionMap, type AgentConfig } from './agents'
import { enqueueTask, orchestratorEvents, type Task } from './orchestrator'

// ── Types ───────────────────────────────────────────────────────────────────

interface ProjectChannel {
  channelId: string
  project: string              // directory basename
  cwd: string                  // full path
  threadTs?: string            // optional: status thread
}

interface SessionSnapshot {
  sessionId: string
  lineCount: number            // last known JSONL line count for diff
  lastPostedIndex: number      // last conversation index posted to Slack
}

// ── State ───────────────────────────────────────────────────────────────────

let slackApp: App | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
const channelMap = new Map<string, ProjectChannel>()   // cwd → channel info
const sessionSnapshots = new Map<string, SessionSnapshot>()
const CHANNEL_PREFIX = process.env.SLACK_CHANNEL_PREFIX || 'sk'
const POLL_INTERVAL = 5000
const AUTO_ARCHIVE_INACTIVE =
  (process.env.SLACK_ARCHIVE_INACTIVE_CHANNELS || 'false').toLowerCase() === 'true'
const MAX_CHANNEL_NAME = 80
const MAX_CHANNEL_SUFFIX = 99

// ── Helpers ─────────────────────────────────────────────────────────────────

function projectSlug(cwd: string): string {
  return cwd.split('/').pop()?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'unknown'
}

function channelName(cwd: string): string {
  return `${CHANNEL_PREFIX}-${projectSlug(cwd)}`.slice(0, MAX_CHANNEL_NAME)
}

function getSlackErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const data = (err as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  const code = (data as { error?: unknown }).error
  return typeof code === 'string' && code.trim() ? code : null
}

function channelNameWithSuffix(base: string, suffix: number): string {
  if (suffix <= 1) return base.slice(0, MAX_CHANNEL_NAME)
  const tail = `-${suffix}`
  const head = base.slice(0, Math.max(1, MAX_CHANNEL_NAME - tail.length))
  return `${head}${tail}`
}

function nextAvailableChannelName(base: string, existingNames: Set<string>): string | null {
  for (let suffix = 1; suffix <= MAX_CHANNEL_SUFFIX; suffix++) {
    const candidate = channelNameWithSuffix(base, suffix)
    if (!existingNames.has(candidate)) return candidate
  }
  return null
}

async function createProjectChannel(
  baseName: string,
  cwd: string,
  existingNames: Set<string>,
): Promise<ProjectChannel | null> {
  if (!slackApp) return null

  let candidate = nextAvailableChannelName(baseName, existingNames)
  while (candidate) {
    try {
      const createResult = await slackApp.client.conversations.create({
        name: candidate,
        is_private: false,
      })
      if (!createResult.channel?.id) return null

      const channelId = createResult.channel.id
      await slackApp.client.conversations.join({ channel: channelId }).catch(() => {})
      await slackApp.client.conversations.setTopic({
        channel: channelId,
        topic: `Agents working on ${cwd}`,
      }).catch(() => {})

      console.log(`[slack-bridge] Created #${candidate} (${channelId})`)
      return { channelId, project: projectSlug(cwd), cwd }
    } catch (err) {
      const code = getSlackErrorCode(err)
      if (code === 'name_taken') {
        existingNames.add(candidate)
        candidate = nextAvailableChannelName(baseName, existingNames)
        continue
      }
      throw err
    }
  }

  return null
}

function resolveAgentName(session: ClaudeSession): string {
  const configs = getAgentConfigs()
  const savedMap = loadAgentSessionMap()

  for (const config of configs) {
    const saved = savedMap[config.id]
    if (saved && saved.pid > 0 && session.pid === saved.pid) {
      return config.name
    }
    if (config.defaultRepos.some(repo => session.cwd === repo)) {
      return config.name
    }
  }

  return session.terminalName || session.project || 'Agent'
}

function agentEmoji(status: string): string {
  switch (status) {
    case 'working': return ':hammer_and_wrench:'
    case 'waiting': return ':hourglass_flowing_sand:'
    case 'plan': return ':memo:'
    case 'idle': return ':zzz:'
    default: return ':robot_face:'
  }
}

// ── Channel Management ──────────────────────────────────────────────────────

async function ensureChannel(cwd: string): Promise<ProjectChannel | null> {
  if (!slackApp) return null

  const existing = channelMap.get(cwd)
  if (existing) return existing

  const name = channelName(cwd)

  try {
    // Try to find existing channel first
    const listResult = await slackApp.client.conversations.list({
      types: 'public_channel',
      limit: 1000,
      exclude_archived: false,
    })

    const channels = listResult.channels || []
    const activeExact = channels.find(c =>
      Boolean(c.id) && c.name === name && !c.is_archived,
    )
    const activeFallback = channels.find(c =>
      Boolean(c.id) && Boolean(c.name) && c.name !== name && c.name!.startsWith(`${name}-`) && !c.is_archived,
    )

    const reusable = activeExact || activeFallback
    if (reusable?.id) {
      await slackApp.client.conversations.join({ channel: reusable.id }).catch(() => {})
      if (reusable.name && reusable.name !== name) {
        console.log(`[slack-bridge] Reusing #${reusable.name} for ${cwd}`)
      }

      const channel: ProjectChannel = { channelId: reusable.id, project: projectSlug(cwd), cwd }
      channelMap.set(cwd, channel)
      return channel
    }

    const archivedExact = channels.find(c =>
      Boolean(c.id) && c.name === name && c.is_archived,
    )
    if (archivedExact?.id) {
      try {
        await slackApp.client.conversations.unarchive({ channel: archivedExact.id })
        await slackApp.client.conversations.join({ channel: archivedExact.id }).catch(() => {})
        console.log(`[slack-bridge] Unarchived #${name}`)

        const channel: ProjectChannel = { channelId: archivedExact.id, project: projectSlug(cwd), cwd }
        channelMap.set(cwd, channel)
        return channel
      } catch (err) {
        const code = getSlackErrorCode(err)
        if (code === 'not_in_channel') {
          console.warn(
            `[slack-bridge] Cannot unarchive #${name}: bot is not in the archived channel. Creating replacement channel.`,
          )
        } else {
          console.warn(`[slack-bridge] Failed to unarchive #${name}: ${code || (err as Error).message}`)
        }
      }
    }

    const existingNames = new Set(
      channels
        .map(c => c.name)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    )
    const created = await createProjectChannel(name, cwd, existingNames)
    if (!created) return null

    channelMap.set(cwd, created)
    return created
  } catch (err) {
    console.error(`[slack-bridge] Failed to ensure channel #${name}:`, err)
    return null
  }
}

async function archiveEmptyChannels(activeCwds: Set<string>): Promise<void> {
  if (!slackApp) return
  if (!AUTO_ARCHIVE_INACTIVE) return

  for (const [cwd, channel] of channelMap) {
    if (!activeCwds.has(cwd)) {
      try {
        await slackApp.client.chat.postMessage({
          channel: channel.channelId,
          text: '_All agents on this project have exited. Archiving channel._',
          username: 'Penny',
          icon_emoji: ':file_cabinet:',
        })
        await slackApp.client.conversations.archive({ channel: channel.channelId })
        console.log(`[slack-bridge] Archived #${CHANNEL_PREFIX}-${channel.project}`)
      } catch { /* already archived or permission issue */ }
      channelMap.delete(cwd)
    }
  }
}

// ── Message Posting ─────────────────────────────────────────────────────────

async function postAgentMessage(
  channelId: string,
  agentName: string,
  text: string,
  mode?: string,
): Promise<void> {
  if (!slackApp) return

  // Truncate very long messages for Slack (max ~4000 chars for good UX)
  const truncated = text.length > 3500
    ? text.slice(0, 3500) + '\n_...truncated_'
    : text

  try {
    await slackApp.client.chat.postMessage({
      channel: channelId,
      text: truncated,
      username: agentName,
      icon_emoji: agentEmoji(mode || 'working'),
    })
  } catch (err) {
    console.error(`[slack-bridge] Failed to post as ${agentName}:`, err)
  }
}

async function postStatusUpdate(
  channelId: string,
  agentName: string,
  session: ClaudeSession,
): Promise<void> {
  if (!slackApp) return

  const iType = session.interactionType || 'none'
  let statusText = ''

  switch (iType) {
    case 'tool-approval':
      statusText = ':warning: *Waiting for tool approval*'
      break
    case 'question':
      statusText = ':question: *Asked a question — needs your response*'
      break
    case 'accept-edits':
      statusText = ':pencil2: *File edits pending review*'
      break
    case 'idle-prompt':
      statusText = ':white_check_mark: *Task complete — ready for next instruction*'
      break
  }

  if (statusText) {
    try {
      await slackApp.client.chat.postMessage({
        channel: channelId,
        text: statusText,
        username: agentName,
        icon_emoji: agentEmoji(session.sessionMode),
      })
    } catch { /* */ }
  }
}

// ── Inbound Message Routing ─────────────────────────────────────────────────

function findTargetSession(
  text: string,
  cwd: string,
  sessions: ClaudeSession[],
): ClaudeSession | null {
  const projectSessions = sessions.filter(s => s.cwd === cwd)
  if (projectSessions.length === 0) return null
  if (projectSessions.length === 1) return projectSessions[0]

  // Multiple agents — check for @mention
  const configs = getAgentConfigs()
  const lowerText = text.toLowerCase()

  for (const session of projectSessions) {
    const name = resolveAgentName(session).toLowerCase()
    if (lowerText.includes(`@${name}`) || lowerText.includes(name)) {
      return session
    }
  }

  // No match — return null so we can prompt the user
  return null
}

// ── Poll Loop ───────────────────────────────────────────────────────────────

// Track last known interaction type per session to detect transitions
const lastInteractionType = new Map<string, string>()

async function pollAndSync(): Promise<void> {
  if (!slackApp) return

  let sessions: ClaudeSession[]
  try {
    sessions = await getClaudeSessions()
  } catch {
    return
  }

  const activeCwds = new Set(sessions.map(s => s.cwd))

  // Ensure channels exist for all active projects
  for (const cwd of activeCwds) {
    await ensureChannel(cwd)
  }

  // Archive channels for projects with no active agents
  await archiveEmptyChannels(activeCwds)

  // Post new assistant messages and status changes
  for (const session of sessions) {
    const channel = channelMap.get(session.cwd)
    if (!channel) continue

    const agentName = resolveAgentName(session)
    const snapshotKey = session.sessionId

    // Get conversation and diff against last posted
    const conversation = getSessionConversation(session.sessionId, 100)
    const snapshot = sessionSnapshots.get(snapshotKey)

    if (!snapshot) {
      // First time seeing this session — snapshot current position, don't replay history
      sessionSnapshots.set(snapshotKey, {
        sessionId: session.sessionId,
        lineCount: conversation.length,
        lastPostedIndex: conversation.length - 1,
      })
      console.log(`[slack-bridge] Initialized snapshot for ${agentName} (${session.sessionId}) at index ${conversation.length - 1}`)
      continue
    }

    const lastIndex = snapshot.lastPostedIndex

    // Post any new assistant messages since last poll
    for (let i = lastIndex + 1; i < conversation.length; i++) {
      const msg = conversation[i]
      if (msg.role === 'assistant') {
        console.log(`[slack-bridge] Posting new message from ${agentName} to #${channel.project} (index ${i})`)
        await postAgentMessage(channel.channelId, agentName, msg.text, session.sessionMode)
      }
    }

    // Update snapshot
    if (conversation.length > 0) {
      snapshot.lineCount = conversation.length
      snapshot.lastPostedIndex = conversation.length - 1
    }

    // Detect interaction type changes (e.g. started waiting for approval)
    const prevIType = lastInteractionType.get(snapshotKey) || 'none'
    const currIType = session.interactionType || 'none'
    if (currIType !== prevIType && currIType !== 'none') {
      await postStatusUpdate(channel.channelId, agentName, session)
    }
    lastInteractionType.set(snapshotKey, currIType)
  }

  // Clean up snapshots for dead sessions
  for (const key of sessionSnapshots.keys()) {
    if (!sessions.some(s => s.sessionId === key)) {
      sessionSnapshots.delete(key)
      lastInteractionType.delete(key)
    }
  }
}

// ── Task Command Parser ─────────────────────────────────────────────────────

function parseTaskCommand(text: string): {
  description: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  agent?: string
} {
  let priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  let agent: string | undefined
  let description = text

  // Extract priority:X
  const priorityMatch = description.match(/\bpriority:(\w+)\b/i)
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase()
    if (['critical', 'high', 'normal', 'low'].includes(p)) {
      priority = p as typeof priority
    }
    description = description.replace(priorityMatch[0], '').trim()
  }

  // Extract agent:X
  const agentMatch = description.match(/\bagent:(\w[\w-]*)\b/i)
  if (agentMatch) {
    agent = agentMatch[1]
    description = description.replace(agentMatch[0], '').trim()
  }

  return { description, priority, agent }
}

// ── Slack Task Status Updates ───────────────────────────────────────────────

function setupTaskStatusPosting(): void {
  orchestratorEvents.on('task-updated', async (task: Task) => {
    if (!slackApp || !task.slackChannelId) return

    const statusMessages: Record<string, string> = {
      assigned: `:robot_face: Assigned to ${task.assignedAgent || 'an agent'}`,
      completed: `:white_check_mark: Done! ${(task.result || '').slice(0, 200)}`,
      failed: `:x: Failed: ${(task.error || 'Unknown error').slice(0, 200)}`,
      cancelled: `:no_entry_sign: Task cancelled`,
    }

    const msg = statusMessages[task.status]
    if (!msg) return

    try {
      await slackApp.client.chat.postMessage({
        channel: task.slackChannelId,
        text: msg,
        thread_ts: task.slackThreadTs,
        username: 'Penny',
        icon_emoji: ':clipboard:',
      })
    } catch (err) {
      console.error(`[slack-bridge] Failed to post task status:`, err)
    }
  })
}

// ── Init / Shutdown ─────────────────────────────────────────────────────────

export async function startSlackBridge(): Promise<boolean> {
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN

  if (!botToken || !appToken) {
    console.log('[slack-bridge] SLACK_BOT_TOKEN or SLACK_APP_TOKEN not set — bridge disabled')
    return false
  }

  try {
    slackApp = new App({
      token: botToken,
      appToken,
      socketMode: true,
      logLevel: LogLevel.WARN,
    })

    // Handle incoming messages — route to the correct agent
    slackApp.message(async ({ message, say }) => {
      // Ignore bot messages (our own posts)
      if (!('text' in message) || ('bot_id' in message)) return
      const text = (message as { text?: string }).text || ''
      const channelId = (message as { channel: string }).channel
      console.log(`[slack-bridge] Received message in ${channelId}: "${text.slice(0, 80)}"`)

      // ── !task prefix — enqueue to orchestrator ──
      if (text.startsWith('!task ')) {
        const taskText = text.slice(6).trim()
        const parsed = parseTaskCommand(taskText)

        // Resolve project from channel
        let taskProject = ''
        for (const [cwd, ch] of channelMap) {
          if (ch.channelId === channelId) { taskProject = cwd; break }
        }
        if (!taskProject) taskProject = process.env.HOME || '/tmp'

        const task = enqueueTask({
          title: parsed.description.slice(0, 80),
          description: parsed.description,
          project: taskProject,
          priority: parsed.priority,
          preferredAgent: parsed.agent,
          source: 'slack',
          slackChannelId: channelId,
          slackThreadTs: (message as { ts?: string }).ts,
        })

        await say({
          text: `:clipboard: Task #${task.id.split('-').pop()} queued (${task.priority} priority)`,
          username: 'Penny',
          icon_emoji: ':clipboard:',
        })
        return
      }

      // Find which project this channel maps to
      let targetCwd: string | null = null
      for (const [cwd, ch] of channelMap) {
        if (ch.channelId === channelId) {
          targetCwd = cwd
          break
        }
      }

      if (!targetCwd) return

      const sessions = await getClaudeSessions()
      const target = findTargetSession(text, targetCwd, sessions)

      if (!target) {
        const projectSessions = sessions.filter(s => s.cwd === targetCwd)
        if (projectSessions.length === 0) {
          await say({ text: '_No active agents on this project._', username: 'Penny', icon_emoji: ':x:' })
        } else {
          const names = projectSessions.map(s => `*${resolveAgentName(s)}*`).join(', ')
          await say({
            text: `_Multiple agents on this project. Mention one by name: ${names}_`,
            username: 'Penny',
            icon_emoji: ':point_up:',
          })
        }
        return
      }

      if (!target.tty) {
        await say({ text: `_${resolveAgentName(target)} has no terminal attached._`, username: 'Penny', icon_emoji: ':warning:' })
        return
      }

      // Strip any @mentions of agent names before sending
      let cleanText = text
      const configs = getAgentConfigs()
      for (const config of configs) {
        cleanText = cleanText.replace(new RegExp(`@?${config.name}`, 'gi'), '').trim()
      }

      if (!cleanText) return

      const result = await sendToSession(target.tty, cleanText)
      if (!result.success) {
        await say({ text: `_Failed to send to ${resolveAgentName(target)}: ${result.error}_`, username: 'Penny', icon_emoji: ':x:' })
      }
    })

    await slackApp.start()
    console.log('[slack-bridge] Connected to Slack (Socket Mode)')

    // Wire up orchestrator task status updates to Slack
    setupTaskStatusPosting()

    // Start polling for agent output
    pollTimer = setInterval(pollAndSync, POLL_INTERVAL)
    // Run initial sync
    await pollAndSync()

    return true
  } catch (err) {
    console.error('[slack-bridge] Failed to start:', err)
    slackApp = null
    return false
  }
}

export async function stopSlackBridge(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (slackApp) {
    await slackApp.stop()
    slackApp = null
  }
  channelMap.clear()
  sessionSnapshots.clear()
  lastInteractionType.clear()
  console.log('[slack-bridge] Stopped')
}

export function isSlackBridgeRunning(): boolean {
  return slackApp !== null
}
