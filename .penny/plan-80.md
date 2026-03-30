Here is the implementation plan for sidekick#80.

---

## Implementation Plan — Agent Personality: Unique Idle Behaviors + Visual Identity

### 1. `Penny/agents/agent-types.yaml` — Add `animationProfile` per persona

For each of the 11 named agent types, add an `animationProfile` block under `persona`:

```yaml
animationProfile:
  typingSpeed: 1.35          # multiplier: >1 = faster typing tween, <1 = slower
  idleFrequency: restless    # 'focused' | 'restless' | 'social' — controls timer intervals
  accentColor: 0x10b981      # hex number for nameText color
  signatureBehavior: coffee  # key identifying the unique idle action
```

| Agent | `typingSpeed` | `idleFrequency` | `accentColor` | `signatureBehavior` |
|---|---|---|---|---|
| Marcus Chen | 1.35 | restless | 0x10b981 | coffee |
| Lena Park | 1.0 | focused | 0x818cf8 | whiteboard |
| Kai Tanaka | 1.1 | restless | 0x38bdf8 | monitor-pan |
| Ravi Patel | 0.8 | focused | 0xf59e0b | eureka |
| Sofia Ruiz | 1.15 | restless | 0xfb923c | phone-glow |
| Oleg Volkov | 0.9 | focused | 0x6ee7b7 | eureka |
| Zara Kim | 1.2 | restless | 0xc084fc | typing-burst |
| Ava Reyes | 1.0 | social | 0xf472b6 | color-pick |
| Jordan Miles | 0.9 | social | 0x34d399 | note-check |
| Dana Webb | 1.25 | restless | 0xfbbf24 | typing-burst |
| Sam Torres | 0.85 | social | 0x60a5fa | pace |

---

### 2. `Penny/src/renderer/src/game/animation-config.ts` — Add `persona` section

Add to the `AnimationConfig` interface and the `AnimConfig` default object:

```ts
persona: {
  /** Per-frequency idle timer interval ranges (seconds). */
  idleIntervals: {
    focused:  { lookAround: [15, 25], walkBreak: [18, 28], stretch: [30, 45] }
    restless: { lookAround: [5,  10], walkBreak: [7,  12], stretch: [12, 20] }
    social:   { lookAround: [6,  11], walkBreak: [10, 16], stretch: [18, 25] }
  }
  /** Delay range (ms) between signature behavior triggers. */
  signatureBehaviorInterval: [18000, 28000]
}
```

---

### 3. `Penny/src/renderer/src/game/office-helpers.ts` — Add persona profile lookup

**Add** `PersonaProfile` interface and `PERSONA_PROFILES` map, and export `getPersonaProfile(agentName: string): PersonaProfile`:

```ts
export interface PersonaProfile {
  typingSpeed: number
  idleFrequency: 'focused' | 'restless' | 'social'
  accentColor: number
  signatureBehavior: string
}

const PERSONA_PROFILES: Record<string, PersonaProfile> = {
  'Marcus Chen':  { typingSpeed: 1.35, idleFrequency: 'restless', accentColor: 0x10b981, signatureBehavior: 'coffee' },
  // ... all 11 agents
}

const DEFAULT_PERSONA: PersonaProfile = {
  typingSpeed: 1.0, idleFrequency: 'restless', accentColor: 0x64748b, signatureBehavior: 'none',
}

export function getPersonaProfile(agentName: string): PersonaProfile {
  return PERSONA_PROFILES[agentName] ?? DEFAULT_PERSONA
}
```

The values here must **match** what's in `agent-types.yaml` step 1 — single source of truth for the executor is the map in this file; yaml values are documentation only.

---

### 4. `Penny/src/renderer/src/game/office-types.ts` — Add 3 fields to `WorkstationSprite`

```ts
signatureTimer?: Phaser.Time.TimerEvent
signatureTween?: Phaser.Tweens.Tween
personaAccentColor?: number  // cached hex color for nameText, set once at creation
```

---

### 5. `Penny/src/renderer/src/game/workstation-animation.ts` — Core changes (5 sub-steps)

**5a. Imports** — Add at top:
```ts
import { getPersonaProfile } from './office-helpers'
import { AnimConfig } from './animation-config'
```
(`AnimConfig` is likely already imported; `getPersonaProfile` is new.)

---

**5b. Name text accent color** — In the animation update path, after the `lastAnimMode` guard (the early-exit check that prevents re-running setup on same mode), apply accent color to the name text **once per mode transition**:

```ts
const profile = getPersonaProfile(ws.state.name)
if (ws.nameText) {
  const hex = '#' + profile.accentColor.toString(16).padStart(6, '0')
  ws.nameText.setColor(hex)
}
```

Place this immediately after the guard, before the mode-specific branch, so it fires on every mode transition for all three modes (waiting, working, idle).

---

**5c. Working mode — persona typing speed** — In the section that creates `typingTween` (currently uses `cfg.working.typingDuration` and `cfg.working.typingAmplitude`):

```ts
const profile = getPersonaProfile(ws.state.name)
const typingDuration = Math.round(cfg.working.typingDuration / profile.typingSpeed)
const typingAmplitude = cfg.working.typingAmplitude * (profile.typingSpeed >= 1.2 ? 1.25 : profile.typingSpeed <= 0.85 ? 0.75 : 1.0)
// use typingDuration and typingAmplitude in the tween instead of cfg values directly
```

This makes Marcus visibly type faster with wider shakes; Ravi types slower with tighter/quieter motion.

---

**5d. Idle mode — persona-driven timer intervals** — Replace the four hardcoded interval ranges in idle setup:

Currently (example):
```ts
delay: Phaser.Math.Between(8000, 15000)  // lookAround
delay: Phaser.Math.Between(9000, 16000)  // walkBreak
delay: Phaser.Math.Between(20000, 30000) // stretch
```

Replace with:
```ts
const profile = getPersonaProfile(ws.state.name)
const intervals = AnimConfig.persona.idleIntervals[profile.idleFrequency]
// lookAround
delay: Phaser.Math.Between(intervals.lookAround[0] * 1000, intervals.lookAround[1] * 1000)
// walkBreak
delay: Phaser.Math.Between(intervals.walkBreak[0] * 1000, intervals.walkBreak[1] * 1000)
// stretch
delay: Phaser.Math.Between(intervals.stretch[0] * 1000, intervals.stretch[1] * 1000)
```

`focused` agents (Ravi, Lena, Oleg) sit still much longer; `restless` agents (Marcus, Kai, Sofia, Zara, Dana) look around and walk more; `social` agents (Ava, Jordan, Sam) look at neighbors most frequently.

---

**5e. Idle mode — signature behavior timer** — Add after the existing idle timers are registered:

```ts
// Signature behavior — fires once then re-arms inside triggerSignatureBehavior
if (ws.signatureTimer) { ws.signatureTimer.destroy(); ws.signatureTimer = undefined }
const [sigMin, sigMax] = AnimConfig.persona.signatureBehaviorInterval
ws.signatureTimer = this.scene.time.addEvent({
  delay: Phaser.Math.Between(sigMin, sigMax),
  callback: () => this.triggerSignatureBehavior(ws),
  callbackScope: this,
})
```

**Cleanup** — In the mode-transition teardown (when `lastAnimMode` changes away from 'idle'), add:
```ts
if (ws.signatureTimer) { ws.signatureTimer.destroy(); ws.signatureTimer = undefined }
if (ws.signatureTween) { ws.signatureTween.destroy(); ws.signatureTween = undefined }
```

---

### 6. `Penny/src/renderer/src/game/workstation-animation.ts` — Add `triggerSignatureBehavior` method

Add as a private method on the animator class. After it fires, it **re-arms itself** with a new random delay so behavior repeats continuously while in idle mode:

```ts
private triggerSignatureBehavior(ws: WorkstationSprite): void {
  if (ws.lastAnimMode !== 'idle') return  // guard: agent may have started working
  const profile = getPersonaProfile(ws.state.name)

  switch (profile.signatureBehavior) {
    case 'coffee':
      // Marcus — brief coffee sip. Bobs the coffeeIndicator if visible, or does a
      // quick sprite scaleY 1→0.96→1 (lean-forward sip gesture), 600ms.
      this.scene.tweens.add({ targets: ws.sprite, scaleY: ws.sprite.scaleY * 0.96,
        duration: 300, yoyo: true, ease: 'Sine.easeInOut' })
      break

    case 'whiteboard':
      // Lena — arm-reach gesture: brief scaleX expand 1→1.06→1 over 1200ms.
      this.scene.tweens.add({ targets: ws.sprite, scaleX: ws.sprite.scaleX * 1.06,
        duration: 600, yoyo: true, ease: 'Sine.easeInOut' })
      break

    case 'monitor-pan':
      // Kai — multi-monitor scan: angle sweep -7° → +7° → 0 in sequence.
      this.scene.tweens.chain({ targets: ws.sprite, tweens: [
        { angle: -7, duration: 400, ease: 'Sine.easeInOut' },
        { angle:  7, duration: 800, ease: 'Sine.easeInOut' },
        { angle:  0, duration: 400, ease: 'Sine.easeInOut' },
      ]})
      break

    case 'eureka':
      // Ravi / Oleg — sudden upward bounce + LED flash.
      this.scene.tweens.add({ targets: ws.container, y: ws.container.y - 8,
        duration: 200, yoyo: true, ease: 'Quad.easeOut' })
      if (ws.ledGlow) { ws.ledGlow.setAlpha(1); this.scene.time.delayedCall(200,
        () => ws.ledGlow?.setAlpha(0.4)) }
      break

    case 'phone-glow':
      // Sofia — phone screen glow pulse. Use phoneLight if it exists.
      if (ws.phoneLight) {
        ws.phoneLightTween?.destroy()
        ws.phoneLightTween = this.scene.tweens.add({ targets: ws.phoneLight,
          alpha: 0.85, duration: 400, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
          onComplete: () => { ws.phoneLight?.setAlpha(0) } })
      }
      break

    case 'color-pick':
      // Ava — stare at screen (monitor brightness pulse, squinting gesture).
      if (ws.monitorSprite) {
        this.scene.tweens.add({ targets: ws.monitorSprite, alpha: 0.55,
          duration: 300, yoyo: true, ease: 'Sine.easeInOut' })
      }
      break

    case 'note-check':
      // Jordan — exaggerated look at neighbor: double-amplitude head tilt ±9°, hold.
      this.scene.tweens.chain({ targets: ws.sprite, tweens: [
        { angle: 9,  duration: 500, ease: 'Sine.easeInOut' },
        { angle: 9,  duration: 1000 },   // hold
        { angle: 0,  duration: 500, ease: 'Sine.easeInOut' },
      ]})
      break

    case 'typing-burst':
      // Dana / Zara — rapid x-shake burst (typing sprint), 1.5s.
      ws.signatureTween?.destroy()
      ws.signatureTween = this.scene.tweens.add({ targets: ws.sprite,
        x: { from: ws.sprite.x - 2, to: ws.sprite.x + 2 },
        duration: 80, yoyo: true, repeat: 9, ease: 'Linear' })
      break

    case 'pace':
      // Sam — walk-break with extended distance. Skip if already on a walk.
      // Re-use whatever walk-break logic triggers normally but target 80-120px distance.
      // Implementation: set ws.onCoffeeRun temporarily to prevent double-walk,
      // then trigger the existing walkBreak path with wider random offset.
      // If walk-break is not easily callable, do a simpler x-sway: ±4px over 3s.
      this.scene.tweens.add({ targets: ws.container,
        x: ws.container.x + Phaser.Math.Between(-4, 4) * 10,
        duration: 1500, yoyo: true, ease: 'Sine.easeInOut' })
      break

    default:
      break
  }

  // Re-arm for next occurrence
  const [sigMin, sigMax] = AnimConfig.persona.signatureBehaviorInterval
  ws.signatureTimer = this.scene.time.addEvent({
    delay: Phaser.Math.Between(sigMin, sigMax),
    callback: () => this.triggerSignatureBehavior(ws),
    callbackScope: this,
  })
}
```

> **Note on `pace`**: If `ws.container.x` movement would conflict with navmesh walking, simplify to a slow sway of the sprite only, not the container.

---

### Acceptance Verification

- **3+ visually distinct personas**: Marcus (fast typing + coffee lean), Kai (monitor pan sweep), Ravi (slow typing + eureka jump), Sofia (phone glow) — all clearly different.
- **Working animation speed**: `typingDuration` scaled by `typingSpeed` ensures Marcus's `typingTween` fires ~35% faster and Ravi's ~20% slower.
- **`PH.scenario('busy-office')` screenshots**: Name text accent colors are applied on every mode entry, so they're visible immediately. At least one signature behavior per agent will fire within 18–28s of scenario start.