Here is the implementation plan for sidekick#98 T5.

---

## Implementation Plan: T5 — Lab Theme System

### 1. `Penny/src/renderer/src/game/office-theme.ts` — Replace theme definitions

**a. Update `ThemeName` type** (line 14)
```ts
export type ThemeName = 'lab'
```

**b. Replace the `THEMES` record** — remove `dark` and `light` entirely, replace with a single `lab` entry:

| Property | Value | Notes |
|---|---|---|
| `bg` | `0x0d1b2a` | Deep navy background |
| `roomFloor` | `0x1a2d3e` | Slightly lighter navy |
| `roomFloor2` | `0x1f3347` | Second floor variant |
| `wall` | `0x1b2838` | Dark blue-grey walls |
| `wallInner` | `0x263a4d` | Inner wall highlight |
| `deskBody` | `0x94a3b8` | Metallic grey equipment |
| `deskTop` | `0xa8b8c8` | Lighter metallic top |
| `headerBg` | `0x0d1b2a` | Room header bg |
| `doorFrame` | `0x4ade80` | Chemical green accent |
| `officeFloor` | `0x0d1b2a` | Office floor base |
| `officeGrid` | `0x1b2838` | Grid lines |
| `rugFill` | `0x1b2838` | Rug fill |
| `rugStroke` | `0x4ade80` | Chemical green border |
| `headerText` | `'#a8c4d4'` | Light hex blue-grey text |
| `badgeText` | `'#00e5ff'` | Cyan badge label |
| `badgeBg` | `'#1b2838'` | Badge background |
| `nameText` | `'#a8c4d4'` | Agent name text |
| `nameBg` | `'#0d1b2acc'` | Name plate bg |
| `tooltipBg` | `0x0d1b2a` | Tooltip background |
| `tooltipStroke` | `0x1b2838` | Tooltip border |
| `tooltipText` | `'#a8c4d4'` | Tooltip label |
| `panelBg` | `0x0d1b2a` | HUD panel bg |
| `panelStroke` | `0x1b2838` | Panel border |
| `separator` | `0x152230` | Separator bars |
| `accentText` | `'#00e5ff'` | Cyan accent text (unchanged from dark) |
| `subtleText` | `'#94a3b8'` | Equipment grey secondary text |
| `monitorGlowActive` | `0x00e5ff` | Cyan monitor glow |
| `monitorGlowIdle` | `0x1b2838` | Idle monitor dim |
| `thoughtDefault` | `0x1b2838` | Default bubble |
| `thoughtWorking` | `0x00e5ff` | Cyan working state |
| `thoughtPlan` | `0x4ade80` | Chemical green plan state |
| `thoughtAcceptEdits` | `0x00e5ff` | Cyan accept-edits |
| `deskStrokeIdle` | `0x1b2838` | Idle desk border |
| `deskStrokeWorking` | `0x00e5ff` | Cyan working border |
| `deskStrokeWaiting` | `0xf59e0b` | Amber hazard waiting |
| `deskStrokeHover` | `0x00e5ff` | Cyan hover |
| `particleColors` | `[0x00e5ff, 0x4ade80, 0xffffff]` | Cyan + chem green + white |
| `screenLineColors` | `[0x00e5ff, 0x4ade80]` | Cyan + chem green |
| `lampMetal` | `0x94a3b8` | Metallic silver lamp |
| `lampShade` | `0xf59e0b` | Amber hazard shade |
| `mugBody` | `0x4ade80` | Chemical green mug |
| `mugHandle` | `0x22c55e` | Slightly deeper green handle |
| `fogColor` | `0x0d1b2a` | Navy fog |
| `ventFill` | `0x1b2838` | Dark blue-grey vent fill |
| `shadowDark` | `0x070e18` | Deep shadow |

**c. Update `activeTheme` default** (line 180):
```ts
export let activeTheme: OfficeTheme = THEMES.lab
```

**d. Update `setActiveTheme`** — simplify to accept only `'lab'`, or keep the signature for future extensibility but remove the `dark`/`light` dead paths. Simplest change: keep function body as-is (it will still work with a single-key record), just update the return type/call sites if needed.

**e. Update the file-top comment** — change "Two themes: Dark … and Light … Press T to toggle" to "Single lab theme (sci-fi laboratory palette)".

---

### 2. `Penny/src/renderer/src/game/office-constants.ts` — Update hardcoded COLOR_* constants (lines 85–96)

These fallback/override constants must align with the lab palette:

| Constant | Old | New |
|---|---|---|
| `COLOR_BG` | `0x111827` | `0x0d1b2a` |
| `COLOR_WALL` | `0x334155` | `0x1b2838` |
| `COLOR_DESK_BODY` | `0x475569` | `0x94a3b8` |
| `COLOR_DESK_TOP` | `0x64748b` | `0xa8b8c8` |
| `COLOR_HEADER_BG` | `0x0f172a` | `0x0d1b2a` |
| `COLOR_DOOR_FRAME` | `0x3b82f6` | `0x4ade80` |
| `COLOR_DOOR_FILL` | `0x0f172a` | `0x0d1b2a` |
| `COLOR_DOOR_ACCENT` | `0x3b82f6` | `0x00e5ff` |
| `COLOR_LED_GREEN` | `0x34d399` | `0x4ade80` |
| `COLOR_LED_AMBER` | `0xfbbf24` | `0xf59e0b` |
| `COLOR_LED_GRAY` | `0x64748b` | `0x94a3b8` |

---

### No other files need changes for this task.

`room-renderer.ts` has procedural color templates — those are addressed in a later task (T6/T7 when tileset sprites replace drawn geometry). The `ThemeName` type change is safe: `setActiveTheme` is called only at runtime (T key handler in `OfficeScene.ts`); that call site should be updated to pass `'lab'` or removed if theme cycling is no longer desired — but that is out of scope for T5.