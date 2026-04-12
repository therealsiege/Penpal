/**
 * Fleet Heartbeat — Penpal instance discovery via Slack.
 *
 * Each Penpal instance posts a structured heartbeat message to #sk-fleet every 60s.
 * Other instances read the channel to discover peers. One message per instance,
 * updated in-place via chat.update to keep the channel clean.
 *
 * Location is determined automatically via IP geolocation on startup.
 */

import os from 'os'
import crypto from 'crypto'
import type { WebClient } from '@slack/web-api'
import { getClaudeSessions } from './sessions'
import { checkHealth } from './health'
import { listPods } from './pods'

// ── Types ──────────────────────────────────────────────────────────────────

export interface FleetHeartbeat {
  instanceId: string
  hostname: string
  user: string
  platform: string
  timestamp: string
  health: 'healthy' | 'degraded' | 'down'
  sessions: { total: number; active: number; idle: number; waiting: number }
  pods: { active: number; total: number }
  repos: string[]
  uptime: number
  lat?: number
  lon?: number
  city?: string
}

export interface FleetInstance {
  instanceId: string
  hostname: string
  user: string
  platform: string
  lastSeen: string
  stale: boolean
  health: 'healthy' | 'degraded' | 'down'
  sessions: { total: number; active: number; idle: number; waiting: number }
  pods: { active: number; total: number }
  repos: string[]
  uptime: number
  isSelf: boolean
  lat?: number
  lon?: number
  city?: string
}

export interface FleetStatus {
  instances: FleetInstance[]
  channelName: string
  lastPollAt: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 60_000
const STALE_THRESHOLD = 180_000
const SENTINEL = '```penpal-heartbeat'
const CHANNEL_PREFIX = process.env.SLACK_CHANNEL_PREFIX || 'sk'
const FLEET_CHANNEL_NAME = `${CHANNEL_PREFIX}-fleet`

// ── Module state ───────────────────────────────────────────────────────────

const instanceId = crypto.randomUUID()
let fleetChannelId: string | null = null
let fleetMessageTs: string | null = null
let fleetTimer: ReturnType<typeof setInterval> | null = null
let client: WebClient | null = null

let cachedLocation: { lat: number; lon: number; city: string } | null = null

let lastFleetStatus: FleetStatus = {
  instances: [],
  channelName: FLEET_CHANNEL_NAME,
  lastPollAt: null,
}

// ── IP Geolocation ────────────────────────────────────────────────────────

async function geolocate(): Promise<{ lat: number; lon: number; city: string }> {
  if (cachedLocation) return cachedLocation

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName', {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json() as { lat?: number; lon?: number; city?: string; regionName?: string }
      if (typeof data.lat === 'number' && typeof data.lon === 'number') {
        cachedLocation = {
          lat: data.lat,
          lon: data.lon,
          city: data.city ? `${data.city}, ${data.regionName ?? ''}`.trim() : 'Unknown',
        }
        console.log(`[fleet] Geolocated: ${cachedLocation.city} (${cachedLocation.lat.toFixed(2)}, ${cachedLocation.lon.toFixed(2)})`)
        return cachedLocation
      }
    }
  } catch (err) {
    console.warn('[fleet] Geolocation failed, using default:', err)
  }

  // Fallback: Nashville
  cachedLocation = { lat: 36.16, lon: -86.78, city: 'Nashville, TN' }
  return cachedLocation
}

// ── Channel resolution ─────────────────────────────────────────────────────

async function resolveFleetChannel(): Promise<string | null> {
  if (fleetChannelId) return fleetChannelId
  if (!client) return null

  try {
    const result = await client.conversations.list({
      types: 'public_channel',
      limit: 1000,
      exclude_archived: true,
    })
    const ch = (result.channels || []).find(c => c.name === FLEET_CHANNEL_NAME && !c.is_archived)
    if (ch?.id) {
      fleetChannelId = ch.id
      await client.conversations.join({ channel: ch.id }).catch(() => {})
      console.log(`[fleet] Resolved existing channel #${FLEET_CHANNEL_NAME} (${ch.id})`)
      return fleetChannelId
    }

    console.log(`[fleet] Channel #${FLEET_CHANNEL_NAME} not found, creating...`)
    const created = await client.conversations.create({ name: FLEET_CHANNEL_NAME, is_private: false })
    if (created.channel?.id) {
      fleetChannelId = created.channel.id
      await client.conversations.join({ channel: fleetChannelId }).catch(() => {})
      await client.conversations.setTopic({
        channel: fleetChannelId,
        topic: 'Penpal fleet heartbeats — auto-managed, do not post here',
      }).catch(() => {})
      return fleetChannelId
    }
  } catch (err) {
    console.error('[fleet] Failed to resolve fleet channel:', err)
  }
  return null
}

// ── Heartbeat gathering ────────────────────────────────────────────────────

async function gatherHeartbeat(): Promise<FleetHeartbeat> {
  const [sessions, healthResult, pods, location] = await Promise.all([
    getClaudeSessions().catch(() => []),
    checkHealth().catch(() => ({ overall: 'down' as const })),
    Promise.resolve(listPods()),
    geolocate(),
  ])

  const active = sessions.filter(s => s.alive && s.sessionMode === 'working').length
  const idle = sessions.filter(s => s.alive && s.sessionMode === 'idle').length
  const waiting = sessions.filter(s => s.alive && s.waitingForInput).length
  const activePods = pods.filter(p => !['complete', 'failed'].includes(p.status)).length

  const repos = [...new Set(sessions.filter(s => s.alive).map(s => {
    const parts = s.cwd.replace(/\/+$/, '').split('/')
    return parts[parts.length - 1] || s.cwd
  }))]

  return {
    instanceId,
    hostname: os.hostname(),
    user: os.userInfo().username,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    health: healthResult.overall as FleetHeartbeat['health'],
    sessions: { total: sessions.filter(s => s.alive).length, active, idle, waiting },
    pods: { active: activePods, total: pods.length },
    repos,
    uptime: Math.round(process.uptime()),
    lat: location.lat,
    lon: location.lon,
    city: location.city,
  }
}

// ── Post / update heartbeat ────────────────────────────────────────────────

function formatHeartbeatMessage(hb: FleetHeartbeat): string {
  const json = JSON.stringify(hb)
  const locationStr = hb.city || `${hb.lat?.toFixed(2)}, ${hb.lon?.toFixed(2)}`
  const summary = [
    `*${hb.hostname}*`,
    locationStr,
    `${hb.sessions.total} agents (${hb.sessions.active} active)`,
    hb.health,
    hb.repos.length > 0 ? hb.repos.join(', ') : 'no repos',
  ].join(' \u00b7 ')

  return `${SENTINEL}\n${json}\n\`\`\`\n${summary}`
}

async function postOrUpdateHeartbeat(): Promise<void> {
  const channelId = await resolveFleetChannel()
  if (!channelId || !client) return

  const hb = await gatherHeartbeat()
  const text = formatHeartbeatMessage(hb)

  try {
    if (fleetMessageTs) {
      await client.chat.update({ channel: channelId, ts: fleetMessageTs, text })
    } else {
      const result = await client.chat.postMessage({
        channel: channelId,
        text,
        username: `Penny @ ${hb.hostname}`,
        icon_emoji: ':satellite:',
      })
      if (result.ts) {
        fleetMessageTs = result.ts
        console.log(`[fleet] Posted heartbeat (ts=${result.ts})`)
      }
    }
  } catch (err: unknown) {
    const code = (err as { data?: { error?: string } })?.data?.error
    if (code === 'message_not_found') {
      fleetMessageTs = null
    } else {
      console.error('[fleet] Failed to post heartbeat:', err)
    }
  }
}

// ── Read fleet channel ─────────────────────────────────────────────────────

function parseHeartbeats(messages: { text?: string; ts?: string }[]): FleetHeartbeat[] {
  const heartbeats: FleetHeartbeat[] = []
  const now = Date.now()

  for (const msg of messages) {
    const text = msg.text || ''
    const idx = text.indexOf(SENTINEL)
    if (idx === -1) continue

    const jsonStart = idx + SENTINEL.length
    const jsonEnd = text.indexOf('```', jsonStart)
    if (jsonEnd === -1) continue

    try {
      const hb = JSON.parse(text.slice(jsonStart, jsonEnd).trim()) as FleetHeartbeat
      const age = now - new Date(hb.timestamp).getTime()
      if (age < 86_400_000) heartbeats.push(hb)
    } catch { /* skip malformed */ }
  }

  return heartbeats
}

async function pollFleetChannel(): Promise<void> {
  const channelId = await resolveFleetChannel()
  if (!channelId || !client) return

  try {
    const result = await client.conversations.history({ channel: channelId, limit: 30 })
    const heartbeats = parseHeartbeats(result.messages || [])
    const now = Date.now()

    lastFleetStatus = {
      instances: heartbeats.map(hb => ({
        ...hb,
        lastSeen: hb.timestamp,
        stale: (now - new Date(hb.timestamp).getTime()) > STALE_THRESHOLD,
        isSelf: hb.instanceId === instanceId,
      })),
      channelName: FLEET_CHANNEL_NAME,
      lastPollAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[fleet] Failed to poll fleet channel:', err)
  }
}

// ── Tick ────────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  await postOrUpdateHeartbeat()
  await pollFleetChannel()
  const count = lastFleetStatus.instances.length
  console.log(`[fleet] tick complete — ${count} instance(s) found, channel=${fleetChannelId ?? 'none'}, ownMsg=${fleetMessageTs ?? 'none'}`)
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function startFleetHeartbeat(slackClient: WebClient): Promise<void> {
  client = slackClient
  console.log(`[fleet] Starting heartbeat (instance ${instanceId.slice(0, 8)}, host ${os.hostname()})`)

  await tick().catch(err => console.error('[fleet] Initial tick failed:', err))

  fleetTimer = setInterval(() => {
    void tick().catch(err => console.error('[fleet] Tick failed:', err))
  }, HEARTBEAT_INTERVAL)
}

export async function stopFleetHeartbeat(): Promise<void> {
  if (fleetTimer) {
    clearInterval(fleetTimer)
    fleetTimer = null
  }

  if (fleetMessageTs && fleetChannelId && client) {
    try {
      await client.chat.delete({ channel: fleetChannelId, ts: fleetMessageTs })
    } catch { /* message may already be gone */ }
  }

  fleetMessageTs = null
  fleetChannelId = null
  client = null
  lastFleetStatus = { instances: [], channelName: FLEET_CHANNEL_NAME, lastPollAt: null }
  console.log('[fleet] Stopped')
}

export function getFleetStatus(): FleetStatus {
  return lastFleetStatus
}
