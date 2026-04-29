// ---------------------------------------------------------------------------
// Room theming — directory-based procedural color themes
// ---------------------------------------------------------------------------

export type RoomType =
  | 'design-studio'
  | 'server-room'
  | 'mobile-lab'
  | 'game-den'
  | 'creative-suite'
  | 'ops-center'
  | 'qa-lab'
  | 'standard'

export interface RoomTemplate {
  type: RoomType
  accentColor: number
  floorColor: number
  rugColor: number
}

// Lab facility floor: light blue-grey base matching the hex tileset aesthetic.
// All room types share the same facility floor — accent colors differentiate zones.
const TEMPLATES: Record<RoomType, RoomTemplate> = {
  'design-studio': { type: 'design-studio', accentColor: 0x14b8a6, rugColor: 0x0f766e, floorColor: 0x8fb8c8 },
  'server-room':   { type: 'server-room',   accentColor: 0x3b82f6, rugColor: 0x1d4ed8, floorColor: 0x8fb8c8 },
  'mobile-lab':    { type: 'mobile-lab',     accentColor: 0x22c55e, rugColor: 0x15803d, floorColor: 0x8fb8c8 },
  'game-den':      { type: 'game-den',       accentColor: 0x8b5cf6, rugColor: 0x6d28d9, floorColor: 0x8fb8c8 },
  'creative-suite':{ type: 'creative-suite', accentColor: 0xf59e0b, rugColor: 0xb45309, floorColor: 0x8fb8c8 },
  'ops-center':    { type: 'ops-center',     accentColor: 0xef4444, rugColor: 0xb91c1c, floorColor: 0x8fb8c8 },
  'qa-lab':        { type: 'qa-lab',         accentColor: 0x06b6d4, rugColor: 0x0e7490, floorColor: 0x8fb8c8 },
  standard:        { type: 'standard',       accentColor: 0x3b82f6, rugColor: 0x1d4ed8, floorColor: 0x8fb8c8 },
}

const ROOM_TYPE_KEYWORDS: [string[], RoomType][] = [
  [['renderer', 'frontend', 'ui', 'web', 'nextjs'], 'design-studio'],
  [['backend', 'api', 'server', 'graph', 'etl'], 'server-room'],
  [['mobile', 'expo', 'ios', 'android'], 'mobile-lab'],
  [['game', 'phaser', 'unity'], 'game-den'],
  [['docs', 'content', 'blog', 'marketing'], 'creative-suite'],
  [['infra', 'deploy', 'ci', 'docker'], 'ops-center'],
  [['test', 'qa', 'spec'], 'qa-lab'],
]

export function getRoomType(cwd: string): RoomType {
  const lower = cwd.toLowerCase()
  const segments = lower.split(/[\\/]/)
  for (const [keywords, type] of ROOM_TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (segments.some((seg) => seg.includes(kw))) return type
    }
  }
  return 'standard'
}

export function getTemplate(type: RoomType): RoomTemplate {
  return TEMPLATES[type]
}
