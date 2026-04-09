Now I have all the context. Here's the implementation plan:

---

## Implementation Plan — sidekick#153: Move laser door positions to lab-map.json

**Note:** The laser door rendering code does not yet exist in `gds-scene-renderer.ts`. The issue establishes this as a greenfield data-driven feature — define the positions in JSON from the start, then read them in code.

---

### 1. `Penny/public/sprites/lab-map.json` — Add `doors` array

After the closing `]` of `"walkableTiles"`, add a new top-level `"doors"` array before the final `}`:

```json
"doors": [
  { "id": "door-top-room",     "type": "laser", "gdsX": 1596, "gdsY": 203,  "width": 30,  "height": 260, "color": "0xc084fc", "proximityPx": 50 },
  { "id": "door-bot-center",   "type": "laser", "gdsX": 1811, "gdsY": 1821, "width": 30,  "height": 151, "color": "0xc084fc", "proximityPx": 50 },
  { "id": "door-bot-left-h",   "type": "laser", "gdsX": 973,  "gdsY": 1397, "width": 179, "height": 30,  "color": "0xc084fc", "proximityPx": 50 },
  { "id": "door-mid-right",    "type": "laser", "gdsX": 2324, "gdsY": 579,  "width": 30,  "height": 169, "color": "0xc084fc", "proximityPx": 50 },
  { "id": "door-mid-h",        "type": "laser", "gdsX": 1857, "gdsY": 510,  "width": 185, "height": 30,  "color": "0xc084fc", "proximityPx": 50 }
]
```

---

### 2. `Penny/src/renderer/src/game/gds-scene-renderer.ts` — Add types, rendering, and animation

**2a. Add `LabMapDoor` interface** (after `LabMapRoom`):

```ts
export interface LabMapDoor {
  id: string
  type: 'laser' | 'sliding'
  gdsX: number
  gdsY: number
  width: number
  height: number
  color: string       // hex string e.g. "0xc084fc"
  proximityPx: number // world-space radius to trigger open
}
```

**2b. Add `doors` to `LabMapJson`**:

```ts
doors?: LabMapDoor[]
```

**2c. Add door state tracking** to the class (alongside `baristaContainers`):

```ts
private doorRects: Map<string, { rect: Phaser.GameObjects.Rectangle; open: boolean }> = new Map()
```

**2d. Add `renderDoors()` private method** — call it from the end of `render()` after `this.placeBaristas()`:

```ts
private renderDoors(): void {
  for (const [, d] of this.doorRects) d.rect.destroy()
  this.doorRects.clear()

  const doors = this.labMap.doors ?? []
  for (const door of doors) {
    if (door.type !== 'laser') continue
    const wx = this.originX + door.gdsX * this.scale
    const wy = this.originY + door.gdsY * this.scale
    const color = parseInt(door.color, 16)
    const rect = this.scene.add.rectangle(
      wx, wy,
      door.width * this.scale,
      door.height * this.scale,
      color, 0.75
    ).setOrigin(0, 0).setDepth(SCENE_DEPTH + 1)
    this.doorRects.set(door.id, { rect, open: false })
  }
}
```

**2e. Add `updateDoors(agentWorldPositions: { x: number; y: number }[])` public method** — called by OfficeScene's update loop:

```ts
updateDoors(agentWorldPositions: { x: number; y: number }[]): void {
  const doors = this.labMap.doors ?? []
  for (const door of doors) {
    const entry = this.doorRects.get(door.id)
    if (!entry) continue
    const wx = this.originX + door.gdsX * this.scale
    const wy = this.originY + door.gdsY * this.scale
    const threshold = door.proximityPx * this.scale

    const agentNear = agentWorldPositions.some(pos =>
      Math.abs(pos.x - (wx + door.width * this.scale / 2)) < threshold &&
      Math.abs(pos.y - (wy + door.height * this.scale / 2)) < threshold
    )

    if (agentNear && !entry.open) {
      entry.open = true
      this.scene.tweens.add({ targets: entry.rect, alpha: 0, duration: 200 })
    } else if (!agentNear && entry.open) {
      entry.open = false
      this.scene.tweens.add({ targets: entry.rect, alpha: 0.75, duration: 200 })
    }
  }
}
```

**2f. Update `cleanup()`** to destroy door rects:

```ts
for (const [, d] of this.doorRects) d.rect.destroy()
this.doorRects.clear()
```

---

### 3. Call site — wherever OfficeScene's update loop ticks

Grep for `gdsRenderer` or the `GdsSceneRenderer` instance in `OfficeScene.ts`. In the throttled update tick, add:

```ts
const agentPositions = [...this.workstations.values()].map(w => ({ x: w.sprite.x, y: w.sprite.y }))
this.gdsRenderer.updateDoors(agentPositions)
```

Frequency: can share the 1s or 5s throttle bucket — proximity detection does not need per-frame accuracy.