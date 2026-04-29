import Phaser from 'phaser'
import type { Room, McpConnectionInfo } from './office-types'
import {
  MCP_SERVER_COLORS,
  MCP_SERVER_COLOR_DEFAULT,
  MCP_ICON_CLUSTER_OFFSET_X,
  MCP_ICON_CLUSTER_SPACING_Y,
  MCP_DASH_LENGTH,
  MCP_DASH_GAP,
  scaledFontSize,
} from './office-constants'
import { drawDashedLine, hashToken } from './office-helpers'
import { SPRITESHEET_KEYS, ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Short labels for MCP server names (displayed next to icon dots)
// ---------------------------------------------------------------------------

const SERVER_SHORT_LABELS: Record<string, string> = {
  penny:     'PN',
  serena:    'SR',
  context7:  'C7',
  github:    'GH',
  neon:      'NE',
  magic:     'MG',
  linear:    'LN',
  firecrawl: 'FC',
  memory:    'ME',
  notion:    'NO',
  'phaser-editor': 'PE',
  'ddg-search':    'DD',
  'sequential-thinking': 'ST',
}

function getServerColor(name: string): number {
  return MCP_SERVER_COLORS[name.toLowerCase()] ?? MCP_SERVER_COLOR_DEFAULT
}

function getServerLabel(name: string): string {
  const normalized = name.toLowerCase()
  return SERVER_SHORT_LABELS[normalized] ?? normalized.slice(0, 2).toUpperCase()
}

/** Extract unique MCP server names from an agent's allowedTools list. */
function extractMcpServers(allowedTools: string[]): string[] {
  const servers = new Set<string>()
  for (const tool of allowedTools) {
    const m = tool.match(/^mcp__([^_]+)__/)
    if (m) servers.add(m[1].toLowerCase())
  }
  return Array.from(servers)
}

// ---------------------------------------------------------------------------
// OfficeMcp — MCP server connection lines from workstations to icon clusters
// ---------------------------------------------------------------------------

export class OfficeMcp {
  private scene: Phaser.Scene

  private mcpGraphics: Phaser.GameObjects.Graphics | null = null
  private iconSprites: Phaser.GameObjects.Sprite[] = []
  private labelTexts: Phaser.GameObjects.Text[] = []
  private pulseSprites: Phaser.GameObjects.Sprite[] = []

  private dirty = true
  private lastDrawAt = 0
  private visible = true

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  init(): void {
    this.mcpGraphics = this.scene.add.graphics().setDepth(199)
  }

  markDirty(): void { this.dirty = true }
  isDirty(): boolean { return this.dirty }
  clearDirty(): void { this.dirty = false }
  getLastDrawAt(): number { return this.lastDrawAt }
  setLastDrawAt(t: number): void { this.lastDrawAt = t }

  // ---------------------------------------------------------------------------
  // Connection computation
  // ---------------------------------------------------------------------------

  /** Build McpConnectionInfo[] for all agents in a room. */
  private computeRoomConnections(room: Room): McpConnectionInfo[] {
    const connections: McpConnectionInfo[] = []
    for (const ws of room.workstations.values()) {
      if (!ws.state) continue
      const servers = extractMcpServers(ws.state.config.allowedTools ?? [])
      const isActive = ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan'
      for (const srv of servers) {
        connections.push({
          agentId: ws.state.config.id,
          serverName: srv,
          color: getServerColor(srv),
          active: isActive && !ws.state.needsInteraction,
        })
      }
    }
    return connections
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  drawMcpLines(timeMs: number, rooms: Map<string, Room>): void {
    if (!this.mcpGraphics) return
    this.mcpGraphics.clear()

    // Recycle old sprites/texts
    for (const s of this.iconSprites) s.destroy()
    this.iconSprites = []
    for (const s of this.labelTexts) s.destroy()
    this.labelTexts = []
    for (const s of this.pulseSprites) s.destroy()
    this.pulseSprites = []

    if (!this.visible) return

    for (const room of rooms.values()) {
      const connections = this.computeRoomConnections(room)
      if (connections.length === 0) continue

      // Collect unique servers in this room
      const uniqueServers = [...new Set(connections.map(c => c.serverName))].sort()

      // Icon cluster position — right edge of the room, vertically centered
      const clusterX = room.x + room.width / 2 + MCP_ICON_CLUSTER_OFFSET_X
      const clusterBaseY = room.y - ((uniqueServers.length - 1) * MCP_ICON_CLUSTER_SPACING_Y) / 2

      // Draw icons for each unique server
      for (let i = 0; i < uniqueServers.length; i++) {
        const srv = uniqueServers[i]
        const color = getServerColor(srv)
        const iconY = clusterBaseY + i * MCP_ICON_CLUSTER_SPACING_Y

        // Icon dot (tinted circle sprite)
        const icon = this.scene.add.sprite(clusterX, iconY, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
          .setScale(0.09)
          .setTint(color)
          .setAlpha(0.7)
          .setDepth(200)
        this.iconSprites.push(icon)

        // Short label
        const label = this.scene.add.text(clusterX + 7, iconY - 4, getServerLabel(srv), {
          fontSize: scaledFontSize(7),
          fontFamily: 'monospace',
          color: '#' + color.toString(16).padStart(6, '0'),
          resolution: 2,
        }).setAlpha(0.6).setDepth(200)
        this.labelTexts.push(label)

        // Draw lines from each agent connected to this server
        const srvConnections = connections.filter(c => c.serverName === srv)
        for (const conn of srvConnections) {
          const ws = room.workstations.get(conn.agentId)
          if (!ws) continue

          const wsX = room.x + ws.container.x
          const wsY = room.y + ws.container.y

          const alpha = conn.active ? 0.5 : 0.25
          this.mcpGraphics.lineStyle(1.5, color, alpha)
          drawDashedLine(this.mcpGraphics, wsX, wsY, clusterX, iconY, MCP_DASH_LENGTH, MCP_DASH_GAP)

          // Animated traveling dot for active connections
          if (conn.active) {
            const speed = 0.0006
            const seed = hashToken(`${conn.agentId}:${srv}`) % 1000
            const t = (timeMs * speed + seed * 0.001) % 1

            const px = Phaser.Math.Linear(wsX, clusterX, t)
            const py = Phaser.Math.Linear(wsY, iconY, t)

            const dot = this.scene.add.sprite(px, py, SPRITESHEET_KEYS.GAME_ICONS, ICON_FRAMES.CIRCLE_GREY)
              .setScale(0.12)
              .setTint(color)
              .setAlpha(0.7)
              .setDepth(200)
            this.pulseSprites.push(dot)

            // Subtle glow halo behind the dot
            this.mcpGraphics.fillStyle(color, 0.1)
            this.mcpGraphics.fillCircle(px, py, 5)
          }
        }
      }
    }
  }

  /** Check if any room has active MCP connections (for continuous animation). */
  hasActiveConnections(rooms: Map<string, Room>): boolean {
    for (const room of rooms.values()) {
      for (const ws of room.workstations.values()) {
        if (!ws.state) continue
        if (ws.state.config.allowedTools.some(t => t.startsWith('mcp__'))) {
          if ((ws.state.sessionMode === 'working' || ws.state.sessionMode === 'plan') && !ws.state.needsInteraction) {
            return true
          }
        }
      }
    }
    return false
  }

  // ---------------------------------------------------------------------------
  // Visibility (LOD control)
  // ---------------------------------------------------------------------------

  setVisible(v: boolean): void {
    if (this.visible === v) return
    this.visible = v
    if (!v) {
      this.mcpGraphics?.clear()
      for (const s of this.iconSprites) s.setVisible(false)
      for (const s of this.labelTexts) s.setVisible(false)
      for (const s of this.pulseSprites) s.setVisible(false)
    } else {
      for (const s of this.iconSprites) s.setVisible(true)
      for (const s of this.labelTexts) s.setVisible(true)
      for (const s of this.pulseSprites) s.setVisible(true)
      this.dirty = true
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.mcpGraphics?.destroy()
    this.mcpGraphics = null
    for (const s of this.iconSprites) s.destroy()
    this.iconSprites = []
    for (const s of this.labelTexts) s.destroy()
    this.labelTexts = []
    for (const s of this.pulseSprites) s.destroy()
    this.pulseSprites = []
  }
}
