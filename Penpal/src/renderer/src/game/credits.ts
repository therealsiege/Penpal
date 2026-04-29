// ---------------------------------------------------------------------------
// credits.ts
// Cosmetic credits economy — earned from quest completions, spent on
// decorative customizations (room themes, desk colors, particle effects).
// ---------------------------------------------------------------------------

import { EventBus, EVENTS } from './events'
import { ICON_FRAMES } from './office-asset-keys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CosmeticCategory = 'room_theme' | 'desk_color' | 'particle_effect' | 'name_color'

export interface CosmeticItem {
  id: string
  name: string
  description: string
  category: CosmeticCategory
  price: number
  icon: string
  // Applied value (hex color, theme key, etc.)
  value: string
  /** Sprite frame index in game-icons spritesheet for visual preview */
  previewFrame: number
  /** Optional tint color applied to the preview sprite (e.g. LED color items) */
  previewTint?: number
  /** When false, item is reward-only and omitted from the shop list. */
  shopVisible?: boolean
}

export interface CreditAccount {
  balance: number
  totalEarned: number
  totalSpent: number
  purchasedItems: string[] // item ids
}

// ---------------------------------------------------------------------------
// Shop catalog
// ---------------------------------------------------------------------------

const SHOP_CATALOG: CosmeticItem[] = [
  // Room themes — use BUTTON_ROUND sprite with theme-specific tints
  { id: 'theme_neon',       name: 'Neon Nights',     description: 'Neon glow room accent',     category: 'room_theme',      price: 100, icon: '\uD83C\uDF03', value: 'neon',    previewFrame: ICON_FRAMES.BUTTON_ROUND,      previewTint: 0xa855f7 },
  { id: 'theme_forest',     name: 'Forest Floor',    description: 'Green nature accent',        category: 'room_theme',      price: 100, icon: '\uD83C\uDF3F', value: 'forest',  previewFrame: ICON_FRAMES.BUTTON_ROUND,      previewTint: 0x34d399 },
  { id: 'theme_ocean',      name: 'Deep Ocean',      description: 'Deep blue room accent',      category: 'room_theme',      price: 100, icon: '\uD83C\uDF0A', value: 'ocean',   previewFrame: ICON_FRAMES.BUTTON_ROUND,      previewTint: 0x3b82f6 },
  { id: 'theme_sunset',     name: 'Sunset Glow',     description: 'Warm orange accent',         category: 'room_theme',      price: 150, icon: '\uD83C\uDF05', value: 'sunset',  previewFrame: ICON_FRAMES.BUTTON_ROUND,      previewTint: 0xf59e0b },

  // Desk colors — use colored circle sprites matching the LED color
  { id: 'desk_blue',        name: 'Cool Blue',       description: 'Blue desk LED strip',        category: 'desk_color',      price: 50,  icon: '\uD83D\uDD35', value: '#3b82f6', previewFrame: ICON_FRAMES.CIRCLE_BLUE },
  { id: 'desk_purple',      name: 'Royal Purple',    description: 'Purple desk LED strip',      category: 'desk_color',      price: 50,  icon: '\uD83D\uDFE3', value: '#a855f7', previewFrame: ICON_FRAMES.CIRCLE_BLUE,       previewTint: 0xa855f7 },
  { id: 'desk_green',       name: 'Emerald',         description: 'Green desk LED strip',       category: 'desk_color',      price: 50,  icon: '\uD83D\uDFE2', value: '#34d399', previewFrame: ICON_FRAMES.CIRCLE_GREEN },
  { id: 'desk_gold',        name: 'Gold Rush',       description: 'Gold desk LED strip',        category: 'desk_color',      price: 75,  icon: '\uD83D\uDFE1', value: '#fbbf24', previewFrame: ICON_FRAMES.CIRCLE_YELLOW },
  { id: 'desk_red',         name: 'Hot Red',         description: 'Red desk LED strip',         category: 'desk_color',      price: 75,  icon: '\uD83D\uDD34', value: '#ef4444', previewFrame: ICON_FRAMES.CIRCLE_RED },

  // Particle effects — use star sprites
  { id: 'particle_sparkle', name: 'Sparkle Trail',   description: 'Sparkles follow the agent',  category: 'particle_effect', price: 200, icon: '\u2728',       value: 'sparkle', previewFrame: ICON_FRAMES.STAR_YELLOW },
  { id: 'particle_fire',    name: 'Fire Aura',       description: 'Flame particles around desk', category: 'particle_effect', price: 250, icon: '\uD83D\uDD25', value: 'fire',    previewFrame: ICON_FRAMES.STAR_RED },
  { id: 'particle_snow',    name: 'Snowfall',        description: 'Gentle snow around desk',    category: 'particle_effect', price: 200, icon: '\u2744\uFE0F', value: 'snow',    previewFrame: ICON_FRAMES.STAR_BLUE },

  // Name colors — use achievement badge sprites with color tints
  { id: 'name_cyan',        name: 'Cyan Name',       description: 'Cyan agent name color',      category: 'name_color',      price: 30,  icon: '\uD83D\uDCDB', value: '#00e5ff', previewFrame: ICON_FRAMES.ACHIEVEMENT_BADGE, previewTint: 0x00e5ff },
  { id: 'name_pink',        name: 'Pink Name',       description: 'Pink agent name color',      category: 'name_color',      price: 30,  icon: '\uD83D\uDCDB', value: '#f43f5e', previewFrame: ICON_FRAMES.ACHIEVEMENT_BADGE, previewTint: 0xf43f5e },
  { id: 'name_gold',        name: 'Gold Name',       description: 'Gold agent name color',      category: 'name_color',      price: 50,  icon: '\uD83D\uDCDB', value: '#fbbf24', previewFrame: ICON_FRAMES.ACHIEVEMENT_BADGE, previewTint: 0xfbbf24 },

  { id: 'season_badge_gold',   name: 'Season Gold',   description: 'Top season finisher badge', category: 'particle_effect', price: 0, icon: '\u2B50', value: 'season_badge_gold',   previewFrame: ICON_FRAMES.MEDAL_GOLD,   shopVisible: false },
  { id: 'season_badge_silver', name: 'Season Silver', description: '2nd place season badge',    category: 'particle_effect', price: 0, icon: '\u2B50', value: 'season_badge_silver', previewFrame: ICON_FRAMES.MEDAL_SILVER, shopVisible: false },
  { id: 'season_badge_bronze', name: 'Season Bronze', description: '3rd place season badge',    category: 'particle_effect', price: 0, icon: '\u2B50', value: 'season_badge_bronze', previewFrame: ICON_FRAMES.MEDAL_BRONZE, shopVisible: false },
]

// ---------------------------------------------------------------------------
// CreditManager
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'penpal:credits'

export class CreditManager {
  private _account: CreditAccount = {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    purchasedItems: [],
  }

  // Per-agent equipped cosmetics: agentId -> itemId per category
  private _equipped = new Map<string, Map<CosmeticCategory, string>>()

  constructor() {
    this.load()
  }

  // -------------------------------------------------------------------------
  // Earning
  // -------------------------------------------------------------------------

  /** Add credits (from quest completion). */
  earn(amount: number): void {
    this._account.balance += amount
    this._account.totalEarned += amount
    this.save()
    EventBus.emit(EVENTS.CREDITS_EARNED, amount, this._account.balance)
  }

  // -------------------------------------------------------------------------
  // Spending
  // -------------------------------------------------------------------------

  /** Purchase a cosmetic item. Returns true on success. */
  purchase(itemId: string): boolean {
    const item = SHOP_CATALOG.find(i => i.id === itemId)
    if (!item) return false
    if (this._account.purchasedItems.includes(itemId)) return false // already owned
    if (this._account.balance < item.price) return false

    this._account.balance -= item.price
    this._account.totalSpent += item.price
    this._account.purchasedItems.push(itemId)
    this.save()

    EventBus.emit(
      EVENTS.NOTIFICATION,
      `Purchased: ${item.icon} ${item.name}`,
      'info',
    )
    return true
  }

  /** Equip a purchased cosmetic for an agent. */
  equip(agentId: string, itemId: string): boolean {
    if (!this._account.purchasedItems.includes(itemId)) return false
    const item = SHOP_CATALOG.find(i => i.id === itemId)
    if (!item) return false

    if (!this._equipped.has(agentId)) {
      this._equipped.set(agentId, new Map())
    }
    this._equipped.get(agentId)!.set(item.category, itemId)
    this.save()
    return true
  }

  /** Get the equipped item for an agent in a given category. */
  getEquipped(agentId: string, category: CosmeticCategory): CosmeticItem | null {
    const agentEquip = this._equipped.get(agentId)
    if (!agentEquip) return null
    const itemId = agentEquip.get(category)
    if (!itemId) return null
    return SHOP_CATALOG.find(i => i.id === itemId) ?? null
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getBalance(): number {
    return this._account.balance
  }

  getTotalEarned(): number {
    return this._account.totalEarned
  }

  getAccount(): Readonly<CreditAccount> {
    return this._account
  }

  getCatalog(): readonly CosmeticItem[] {
    return SHOP_CATALOG.filter(i => i.shopVisible !== false)
  }

  grantSeasonRewardItem(agentId: string, itemId: string, doEquip = true): boolean {
    const item = SHOP_CATALOG.find(i => i.id === itemId)
    if (!item) return false
    if (!this._account.purchasedItems.includes(itemId)) {
      this._account.purchasedItems.push(itemId)
    }
    this.save()
    if (doEquip) return this.equip(agentId, itemId)
    return true
  }

  getOwnedItems(): CosmeticItem[] {
    return SHOP_CATALOG.filter(i => this._account.purchasedItems.includes(i.id))
  }

  isOwned(itemId: string): boolean {
    return this._account.purchasedItems.includes(itemId)
  }

  canAfford(itemId: string): boolean {
    const item = SHOP_CATALOG.find(i => i.id === itemId)
    return item ? this._account.balance >= item.price : false
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      const equipped: Record<string, Record<string, string>> = {}
      for (const [agentId, catMap] of this._equipped) {
        equipped[agentId] = Object.fromEntries(catMap)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        account: this._account,
        equipped,
      }))
    } catch { /* noop */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)

      if (data.account) {
        this._account = {
          balance: data.account.balance ?? 0,
          totalEarned: data.account.totalEarned ?? 0,
          totalSpent: data.account.totalSpent ?? 0,
          purchasedItems: Array.isArray(data.account.purchasedItems) ? data.account.purchasedItems : [],
        }
      }
      if (data.equipped && typeof data.equipped === 'object') {
        for (const [agentId, cats] of Object.entries(data.equipped)) {
          const catMap = new Map<CosmeticCategory, string>()
          for (const [cat, itemId] of Object.entries(cats as Record<string, string>)) {
            catMap.set(cat as CosmeticCategory, itemId)
          }
          this._equipped.set(agentId, catMap)
        }
      }
    } catch { /* corrupt — start fresh */ }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const creditManager = new CreditManager()
