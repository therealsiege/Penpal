Now I have everything I need. Here is the implementation plan:

---

## Implementation Plan: sidekick#154 — Workstation Terminal/Monitor Animations

### Findings

- `screenTween` (counter tween, `workstation-creation.ts:268-317`) already handles `'idle'` / `'working'` / `'plan'` / `'compressing'` via the `screenState` mutable ref — but has **no `'waiting'` branch**.
- `screenState.mode` is set in `office-workstation.ts:766` — also missing the `'waiting'` case.
- Monitor glow idle pulse is already wired (`updateMonitorGlow` with `idleBaseStrength`/`idlePeakStrength`). ✅
- LED idle is **static** alpha 0.1 (no blink). Waiting is **static** amber 0.5. Only working has a `ledPulseTween`.
- Keyboard has `kbGlowTween` (alpha only). No scale pulse. `setScale(1)` is never called on teardown.
- `monitorText` working + waiting states already exist. Idle text is set but has no cursor blink.
- Terminal text scrolling when working is already implemented (`monitorTextTween`). ✅
- Day/night: `atmosphere.currentTimePhase` is public on `OfficeAtmosphere`; `WorkstationHost` has no accessor for it yet.

---

### Step 1 — `workstation-creation.ts`: Add `'waiting'` branch to screenTween callback

**Location**: the `onUpdate` callback inside `screenTween = this.scene.tweens.addCounter(...)` (lines ~276-314).

Add a new branch before the `else if (mode === 'idle')` block:

```ts
} else if (mode === 'waiting') {
  // Amber warning flash — alternating filled rect lines that strobe
  const flash = Math.sin(v * Math.PI * 4) > 0 // 4 strobes per cycle
  if (flash) {
    for (let i = 0; i < 3; i++) {
      const y = WS_MONITOR_Y - 3 + i * 3.5
      screenLines.fillStyle(0xfbbf24, 0.55)
      screenLines.fillRect(-7, y, 14, 1.5)
    }
    // Small amber dot in center
    screenLines.fillStyle(0xfbbf24, 0.7)
    screenLines.fillRect(-1, WS_MONITOR_Y - 1, 2, 2)
  }
}
```

Also change the `screenTween.pause()` call at line 317 to keep it running at all times — do **not** pause it; instead remove the `.pause()` call and set `timeScale` from `office-workstation.ts` to 0 when truly idle or drive visibility via `screenLines.setVisible`.

**Actually easier**: keep the `pause()`/`resume()` model. Just add the branch; the pause/resume is controlled externally.

---

### Step 2 — `office-workstation.ts`: Wire `'waiting'` screenMode

**Location**: line ~766, inside `if (ws.screenLines && ws.screenTween)` block.

Change:
```ts
const screenMode = isWorking ? (isPlan ? 'plan' : 'working') : isCompressing ? 'compressing' : 'idle'
```
To:
```ts
const screenMode = isWaiting ? 'waiting' : isWorking ? (isPlan ? 'plan' : 'working') : isCompressing ? 'compressing' : 'idle'
```

Set `screenTween.setTimeScale` for waiting — use a fast strobe rate (e.g. `1.5`):
```ts
if (screenMode === 'waiting') ws.screenTween.setTimeScale(1.5)
```

---

### Step 3 — `office-workstation.ts`: Cursor blink in idle monitorText

**Location**: the idle branch in the `monitorText` update block (~line 822).

After setting `ws.monitorText.setText(idleText)`:
1. Append `_` to the idle text: `ws.monitorText.setText(idleText + '_')`
2. Add a blink tween using `ws.monitorTextTween`:
```ts
ws.monitorTextTween = this.scene.tweens.add({
  targets: ws.monitorText,
  alpha: 0,
  duration: 500,
  yoyo: true,
  repeat: -1,
  ease: 'Stepped',  // hard cut, not gradual
  hold: 400,
})
```

---

### Step 4 — `workstation-animation.ts`: LED blink rates

**Location**: `updateAnimation` method.

**Teardown block** (~line 182): The `ledPulseTween` teardown already exists. No change needed.

**Idle branch** (~line 548-551): Replace the static `tweens.add({ alpha: 0.1 })` with a slow blink:
```ts
if (ws.ledGlow) {
  ws.ledGlow.clear()
  ws.ledGlow.fillStyle(activeTheme.deskStrokeIdle, 1)
  ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
  ws.ledGlow.setAlpha(0.08)
  // Slow heartbeat blink
  ws.ledPulseTween = this.scene.tweens.add({
    targets: ws.ledGlow,
    alpha: 0.18,
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}
```

**Waiting branch** (~line 280-285): Replace static amber fade with an amber blink:
```ts
if (ws.ledGlow) {
  ws.ledGlow.clear()
  ws.ledGlow.fillStyle(activeTheme.deskStrokeWaiting, 1)
  ws.ledGlow.fillRoundedRect(-26, WS_DESK_Y + 4, 52, 2, 1)
  ws.ledGlow.setAlpha(0.35)
  ws.ledPulseTween = this.scene.tweens.add({
    targets: ws.ledGlow,
    alpha: 0.7,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}
```

---

### Step 5 — `workstation-animation.ts`: Keyboard scale pulse (working)

**Location**: working branch, keyboard glow section (~line 311-324).

Extend the `kbGlowTween` to include a scale pulse:
```ts
ws.kbGlowTween = this.scene.tweens.add({
  targets: ws.keyboard,
  alpha: { from: AnimConfig.working.keyboardGlowAlphaMin, to: AnimConfig.working.keyboardGlowAlphaMax },
  scaleX: { from: 0.99, to: 1.01 },
  scaleY: { from: 0.99, to: 1.01 },
  duration: AnimConfig.working.keyboardGlowDuration,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut',
})
```

**Idle branch cleanup** (~line 542-543): Add `setScale(1)` after removing the glow to reset any mid-cycle scale:
```ts
if (ws.kbGlowTween) { ws.kbGlowTween.destroy(); ws.kbGlowTween = undefined }
if (ws.keyboard) ws.keyboard.setStrokeStyle(0, 0, 0).setAlpha(0.8).setScale(1)
```

---

### Step 6 — `office-workstation.ts` + `WorkstationHost`: Day/night screen brightness (stretch)

**`office-workstation.ts`** `WorkstationHost` interface (~line 60): Add:
```ts
getTimePhase?(): 'morning' | 'day' | 'evening' | 'night'
```

**`OfficeScene.ts`**: Implement by returning `this.atmosphere.currentTimePhase`.

**`office-workstation.ts`** screen content block (~line 768): After setting `timeScale`, adjust `screenLines` alpha based on phase:
```ts
const phase = this.host.getTimePhase?.() ?? 'day'
const nightDim = phase === 'night' ? 0.6 : phase === 'evening' ? 0.8 : 1.0
ws.screenLines.setAlpha(nightDim)  // screen glows more relative to dark room at night
```

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `workstation-creation.ts` | Add `'waiting'` branch in screenTween callback |
| `office-workstation.ts` | (1) `screenMode` includes `'waiting'`; (2) idle cursor blink via monitorTextTween; (3) day/night screenLines alpha |
| `workstation-animation.ts` | (1) Idle LED slow blink; (2) Waiting LED amber blink; (3) Keyboard scale+alpha in kbGlowTween; (4) `setScale(1)` on keyboard teardown |
| `office-workstation.ts` | `WorkstationHost`: add `getTimePhase?()` |
| `OfficeScene.ts` | Implement `getTimePhase()` |

No new fields needed on `WorkstationSprite`. All tweens reuse existing handles (`ledPulseTween`, `kbGlowTween`, `monitorTextTween`).