I now have everything I need. Here's the implementation plan:

---

## Implementation Plan — Issue #76: Cosmetic Shop Buy/Equip Flow

**Current state**: Shop panel (`B` key) exists in `season-hud.ts` as a read-only display. `credits.ts` already has `purchase()`, `equip()`, `getEquipped()`. The gap is click interactivity, agent-awareness, and applying equipped cosmetics to workstations.

---

### 1. `Penny/src/renderer/src/game/events.ts`

Add two new event constants at the end of the `EVENTS` object:
```ts
COSMETIC_PURCHASED: 'cosmetic:purchased',  // (itemId: string, itemName: string)
COSMETIC_EQUIPPED:  'cosmetic:equipped',   // (agentId: string, itemId: string, category: CosmeticCategory)
```
Add corresponding entries to `EventPayloadMap` (import `CosmeticCategory` from `credits`).

---

### 2. `Penny/src/renderer/src/game/season-hud.ts` — Major changes

**A. Track selected agent**
- Add field: `private _selectedAgentId: string | null = null`
- In `init()`, add: `EventBus.on(EVENTS.SELECTION_CHANGED, (id) => { this._selectedAgentId = id as string | null })`
- In `destroy()`, unsubscribe the same handler

**B. Refactor `_renderShopItems()` — add interactive buy/equip buttons**

For each item row, after the name/description text, replace the static price/owned labels with an interactive zone on the right side:
- **Unowned + can afford**: render "BUY ¤N" text in yellow; add a `Rectangle` zone sized ~55×16 px over it; on `pointerdown` → call `this._handleBuy(item.id)`
- **Unowned + cannot afford**: render "¤N" in red (no zone, not interactive)
- **Owned + agent selected**: render "EQUIP" in cyan; add zone; on `pointerdown` → call `this._handleEquip(item.id)`
- **Owned + no agent selected**: render "OWNED" in green (dimmed); show tooltip hint "Select agent" on hover (reuse existing `NOTIFICATION` event)

Set `setInteractive()` on each zone with `useHandCursor: true`.

**C. Add `_handleBuy(itemId: string)`**
```ts
private _handleBuy(itemId: string): void {
  const ok = creditManager.purchase(itemId)
  if (!ok) return
  const item = creditManager.getCatalog().find(i => i.id === itemId)!
  EventBus.emit(EVENTS.COSMETIC_PURCHASED, itemId, item.name)
  this._refreshShop()  // rebuild item list + update title balance
}
```

**D. Add `_handleEquip(itemId: string)`**
```ts
private _handleEquip(itemId: string): void {
  if (!this._selectedAgentId) {
    EventBus.emit(EVENTS.NOTIFICATION, 'Select an agent first (Tab to cycle)', 'info')
    return
  }
  const ok = creditManager.equip(this._selectedAgentId, itemId)
  if (!ok) return
  const item = creditManager.getCatalog().find(i => i.id === itemId)!
  EventBus.emit(EVENTS.COSMETIC_EQUIPPED, this._selectedAgentId, itemId, item.category)
  this._refreshShop()
}
```

**E. Add `_refreshShop()`**
Rebuilds the item list and updates the balance in the title. Implementation: update the title `Text` object's content to `SHOP  ¤${creditManager.getBalance()}`, then call `_renderShopItems(...)` with current scroll window.

---

### 3. `Penny/src/renderer/src/game/office-types.ts`

Check if `WorkstationSprite` already has an `agentId` field. If not, add `agentId: string` to the interface (the executor should verify first; it likely exists or is accessible via `.container.getData('agentId')`).

---

### 4. `Penny/src/renderer/src/game/office-workstation.ts`

**A. Apply `name_color` cosmetic**

Import `creditManager` from `./credits`. In the block that computes `nameColor` (~line 499–521), after the status-based color is determined, add before `ws.nameText.setColor(...)`:
```ts
const nameCosmetic = creditManager.getEquipped(agentId, 'name_color')
if (nameCosmetic) nameColor = nameCosmetic.value
```
`agentId` is already available in the calling context (confirm from the surrounding code).

**B. Export `applyDeskColorCosmetic`**
```ts
export function applyDeskColorCosmetic(ws: WorkstationSprite, agentId: string): void {
  const item = creditManager.getEquipped(agentId, 'desk_color')
  if (item) {
    const hex = parseInt(item.value.replace('#', ''), 16)
    ws.deskBody.setStrokeStyle(2, hex, 0.9)
  } else {
    ws.deskBody.setStrokeStyle(1, activeTheme.deskStrokeIdle, 0.5)
  }
}
```

---

### 5. `Penny/src/renderer/src/game/workstation-creation.ts`

After `deskBody` is created (find the `fillRect` / `Rectangle` for the desk body), import and call:
```ts
import { applyDeskColorCosmetic } from './office-workstation'
// ... after deskBody is added to ws:
applyDeskColorCosmetic(ws, agent.id)
```
This ensures equipped desk colors are visible when a workstation is first built (e.g., on restart).

---

### 6. `Penny/src/renderer/src/game/OfficeScene.ts`

In `create()`, after other event subscriptions, add listeners for the new events:

```ts
EventBus.on(EVENTS.COSMETIC_EQUIPPED, (agentId, itemId, category) => {
  this._onCosmeticEquipped(agentId as string, itemId as string, category as CosmeticCategory)
})
EventBus.on(EVENTS.COSMETIC_PURCHASED, (_itemId, itemName) => {
  // Trigger purchase celebration at screen center
  const cx = this.cameras.main.width / 2
  const cy = this.cameras.main.height / 2
  this.celebrations.purchase(cx, cy, itemName as string)
})
```

Add `_onCosmeticEquipped(agentId, itemId, category)`:
- Get `ws = this.workstations.get(agentId)` — if not found, return
- **`'desk_color'`**: call `applyDeskColorCosmetic(ws, agentId)` (imported from office-workstation)
- **`'name_color'`**: call the same name-color update path already used in updateWorkstationState (or directly: `ws.nameText.setColor(item.value)`) — the next state update will reinforce it
- **`'particle_effect'`**: call `this.particles.spawnSparkle(ws.sprite.x, ws.sprite.y, 8)` or equivalent burst (check what office-particles.ts exposes)
- **`'room_theme'`**: look up the ws's room container (via `ws.container.getData('roomId')` or similar), find the room floor graphics, and apply a tint — this is the most complex; if the room graphics object isn't easily accessible, skip for now and only handle the other three categories

Unsubscribe both handlers in `shutdown()` / `destroy()` (follow the existing unsubscribe pattern).

---

### 7. Visual Preview on Hover (stretch — implement only if items 1–6 are complete)

In `_renderShopItems()`, on `pointerover` of each row zone:
- Emit `EVENTS.COSMETIC_PREVIEW` (add to events.ts) with `{ itemId, agentId }`
- OfficeScene handles it by temporarily applying the cosmetic (same logic as equip but flagged as preview)
- On `pointerout`, restore the original equipped state

This requires a "restore" snapshot — store the pre-preview state in a `_previewSnapshot` field in OfficeScene and restore it on preview cancel.

---

### Acceptance Checks
- `B` opens shop; balance shows live
- Clicking "BUY ¤50" on an affordable item deducts credits, shows purchase celebration, row changes to "EQUIP"
- Selecting agent (Tab), then clicking "EQUIP" on owned item applies it immediately to that workstation
- Closing and reopening the game restores equipped cosmetics (localStorage persistence already works via `creditManager`)
- Name color override is visible on the selected agent's nameplate
- Desk LED color change is visible as a colored stroke on the desk body