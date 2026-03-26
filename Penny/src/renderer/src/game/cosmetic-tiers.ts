// ---------------------------------------------------------------------------
// cosmetic-tiers.ts
// Rank-based cosmetic tier definitions and unlock checks.
// Maps XP rank levels to visual desk upgrades, agent flair, and office effects.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CosmeticTier {
  level: number
  rank: string
  // Desk items visible at this rank
  deskItems: DeskItemKey[]
  // Agent visual effects
  agentFlair: AgentFlairKey[]
  // Office/room effects
  officeEffects: OfficeEffectKey[]
}

export type DeskItemKey =
  | 'keyboard'       // L3: basic keyboard
  | 'sticky'         // L3: sticky note
  | 'lamp'           // L4: desk lamp
  | 'monitor_dual'   // L5: second monitor placeholder
  | 'pet'            // L5: desk pet (composable monster body)
  | 'plant'          // L6: desk plant
  | 'pencil_holder'  // L6: pencil holder
  | 'phone'          // L7: desk phone
  | 'gold_trim'      // L8: gold desk outline
  | 'rgb_underglow'  // L9: RGB LED strip
  | 'executive_desk' // L10: premium desk color

export type AgentFlairKey =
  | 'name_glow'       // L3: subtle name text glow
  | 'badge_shimmer'   // L4: role badge shimmer
  | 'particle_trail'  // L5: walk particle trail
  | 'status_ring'     // L6: glowing ring around status dot
  | 'crown'           // L7: crown icon above name
  | 'aura'            // L8: idle aura effect
  | 'legendary_burst' // L9: particle burst on task complete
  | 'title_banner'    // L10: persistent title banner

export type OfficeEffectKey =
  | 'desk_led_color'   // L5: desk LED changes color
  | 'floor_mat'        // L6: floor mat under desk
  | 'bookshelf'        // L7: small bookshelf behind desk
  | 'whiteboard'       // L8: personal whiteboard
  | 'trophy_shelf'     // L9: trophy display
  | 'corner_office'    // L10: expanded desk area

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const COSMETIC_TIERS: CosmeticTier[] = [
  {
    level: 1,
    rank: 'Intern',
    deskItems: [],
    agentFlair: [],
    officeEffects: [],
  },
  {
    level: 2,
    rank: 'Junior',
    deskItems: [],
    agentFlair: [],
    officeEffects: [],
  },
  {
    level: 3,
    rank: 'Associate',
    deskItems: ['keyboard', 'sticky'],
    agentFlair: ['name_glow'],
    officeEffects: [],
  },
  {
    level: 4,
    rank: 'Agent',
    deskItems: ['keyboard', 'sticky', 'lamp'],
    agentFlair: ['name_glow', 'badge_shimmer'],
    officeEffects: [],
  },
  {
    level: 5,
    rank: 'Senior',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail'],
    officeEffects: ['desk_led_color'],
  },
  {
    level: 6,
    rank: 'Lead',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet', 'plant', 'pencil_holder'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail', 'status_ring'],
    officeEffects: ['desk_led_color', 'floor_mat'],
  },
  {
    level: 7,
    rank: 'Expert',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet', 'plant', 'pencil_holder', 'phone'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail', 'status_ring', 'crown'],
    officeEffects: ['desk_led_color', 'floor_mat', 'bookshelf'],
  },
  {
    level: 8,
    rank: 'Master',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet', 'plant', 'pencil_holder', 'phone', 'gold_trim'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail', 'status_ring', 'crown', 'aura'],
    officeEffects: ['desk_led_color', 'floor_mat', 'bookshelf', 'whiteboard'],
  },
  {
    level: 9,
    rank: 'Grandmaster',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet', 'plant', 'pencil_holder', 'phone', 'gold_trim', 'rgb_underglow'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail', 'status_ring', 'crown', 'aura', 'legendary_burst'],
    officeEffects: ['desk_led_color', 'floor_mat', 'bookshelf', 'whiteboard', 'trophy_shelf'],
  },
  {
    level: 10,
    rank: 'Legend',
    deskItems: ['keyboard', 'sticky', 'lamp', 'monitor_dual', 'pet', 'plant', 'pencil_holder', 'phone', 'gold_trim', 'rgb_underglow', 'executive_desk'],
    agentFlair: ['name_glow', 'badge_shimmer', 'particle_trail', 'status_ring', 'crown', 'aura', 'legendary_burst', 'title_banner'],
    officeEffects: ['desk_led_color', 'floor_mat', 'bookshelf', 'whiteboard', 'trophy_shelf', 'corner_office'],
  },
]

// Lookup map by level
const TIER_MAP = new Map(COSMETIC_TIERS.map(t => [t.level, t]))

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/** Get the cosmetic tier for a given rank level (1-10). */
export function getTierForLevel(level: number): CosmeticTier {
  return TIER_MAP.get(Math.min(10, Math.max(1, level))) ?? COSMETIC_TIERS[0]
}

/** Check if a specific desk item is unlocked at the given level. */
export function isDeskItemUnlocked(level: number, item: DeskItemKey): boolean {
  const tier = getTierForLevel(level)
  return tier.deskItems.includes(item)
}

/** Check if a specific agent flair is unlocked at the given level. */
export function isFlairUnlocked(level: number, flair: AgentFlairKey): boolean {
  const tier = getTierForLevel(level)
  return tier.agentFlair.includes(flair)
}

/** Check if a specific office effect is unlocked at the given level. */
export function isOfficeEffectUnlocked(level: number, effect: OfficeEffectKey): boolean {
  const tier = getTierForLevel(level)
  return tier.officeEffects.includes(effect)
}

/** Get all tiers for display purposes. */
export function getAllTiers(): readonly CosmeticTier[] {
  return COSMETIC_TIERS
}

/** Get the minimum level required for a desk item. */
export function getMinLevelForDeskItem(item: DeskItemKey): number {
  for (const tier of COSMETIC_TIERS) {
    if (tier.deskItems.includes(item)) return tier.level
  }
  return 11 // unreachable
}

/** Get the minimum level required for an agent flair. */
export function getMinLevelForFlair(flair: AgentFlairKey): number {
  for (const tier of COSMETIC_TIERS) {
    if (tier.agentFlair.includes(flair)) return tier.level
  }
  return 11
}

// ---------------------------------------------------------------------------
// Rank color helpers
// ---------------------------------------------------------------------------

/** Get a display color for the rank level (used for desk trim, name glow, etc.). */
export function getRankColor(level: number): number {
  if (level >= 10) return 0xfbbf24  // gold
  if (level >= 8)  return 0xf59e0b  // amber
  if (level >= 6)  return 0xa855f7  // purple
  if (level >= 4)  return 0x3b82f6  // blue
  if (level >= 3)  return 0x34d399  // green
  return 0x6b7280                   // gray
}

/** Get a CSS color string for the rank level. */
export function getRankColorCSS(level: number): string {
  if (level >= 10) return '#fbbf24'
  if (level >= 8)  return '#f59e0b'
  if (level >= 6)  return '#a855f7'
  if (level >= 4)  return '#3b82f6'
  if (level >= 3)  return '#34d399'
  return '#6b7280'
}
