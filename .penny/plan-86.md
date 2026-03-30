Now I have everything needed. Here is the implementation plan:

---

## Implementation Plan: BootScene — Shared Asset Preloader (#86)

### 1. `Penny/src/renderer/src/game/office-asset-keys.ts` — Add BOOT to SCENE_KEYS

In the `SCENE_KEYS` object (line 359–362), add:
```ts
BOOT: 'BootScene',
```
alongside the existing `OFFICE` and `UI_SCENE` entries. Update the `SceneKey` type union — it derives automatically from `typeof SCENE_KEYS` so no change needed there.

---

### 2. Create `Penny/src/renderer/src/game/boot-scene.ts`

New file extending `BaseScene`. Structure:

```ts
import Phaser from 'phaser'
import { BaseScene } from './base-scene'
import { SCENE_KEYS, SPRITESHEET_KEYS, ANIM_KEYS, IMAGE_KEYS, AUDIO_KEYS,
         EFFECT_ANIM_KEYS, ANIMAL_IDLE_FRAMES, ANIMAL_SPECIES } from './office-asset-keys'
import { activeTheme } from './office-theme'
import { CHAR_FRAME_W, CHAR_FRAME_H, OFFICE_TILE_SIZE, ROOM_TILE_SIZE } from './office-constants'
```

**`constructor()`** — `super({ key: SCENE_KEYS.BOOT })`

**`onPreload()`** — Copy verbatim from `OfficeScene.preload()` lines 258–590:
- Loading screen UI setup (dark overlay, title, progress bar, glow, counter text, asset text, sprite preview area, dot timer, scan line)
- `assetDisplayNames` map
- `sheetPreviewKeys` set
- `this.load.on('progress', ...)`, `this.load.on('filecomplete', ...)`, `this.load.on('complete', ...)` handlers — **change `complete` handler**: instead of just fading out, after fade completes, call `this.scene.start(SCENE_KEYS.OFFICE)` 
- All `this.load.spritesheet(...)`, `this.load.image(...)`, `this.load.audio(...)` calls

**`onCreate()`** — Copy verbatim the animation registration block from `OfficeScene.create()` lines 984–1054:
- VFX anims (`FLASH`, `PUFF`, `EXPLOSION`, `SMOKE`, `FART`) with `!this.anims.exists()` guards
- Animal pet idle + blink animations loop

**`onUpdate()`** — empty no-op

---

### 3. `Penny/src/renderer/src/game/OfficeScene.ts` — Gut preload, remove anim registration

**a) `preload()` method (lines 258–590):** Replace entire body with a comment:
```ts
preload(): void {
  // Assets loaded by BootScene — Phaser TextureManager is global
}
```

**b) Remove the animation registration block in `create()`** (lines 980–1054): Delete the `// VFX sprite animations` block and `// Animal pet idle animations` block. The `!this.anims.exists()` guards mean double-registration is safe if left in, but they should be removed to keep OfficeScene clean.

> Note: `OfficeScene` extends `Phaser.Scene` directly (not `BaseScene`), so this is just editing the plain `preload()` and `create()` methods.

---

### 4. `Penny/src/renderer/src/game/OfficeGame.ts` — Register BootScene first

**a) Import:** Add `import { BootScene } from './boot-scene'`

**b) Scene array:** Change `scene: [scene, new UIScene()]` to `scene: [new BootScene(), scene, new UIScene()]`

- BootScene is first → auto-starts and runs `onPreload()` + `onCreate()`
- `scene` (OfficeScene) and `UIScene` are registered but not started
- BootScene's `complete` handler calls `this.scene.start(SCENE_KEYS.OFFICE)` → OfficeScene starts, which then calls `this.scene.launch(SCENE_KEYS.UI_SCENE)` at line 1215 as before

**c) Expose BootScene** (optional debug): The existing `(window as any).__PENNY_SCENE__ = scene` stays pointed at OfficeScene — no change needed.

---

### Summary of changes

| File | Change |
|---|---|
| `office-asset-keys.ts` | Add `BOOT: 'BootScene'` to `SCENE_KEYS` |
| `boot-scene.ts` | New file — all loading logic + animation registration |
| `OfficeScene.ts` | `preload()` → no-op; remove anim registration block from `create()` |
| `OfficeGame.ts` | Import + prepend `BootScene` to scene array |