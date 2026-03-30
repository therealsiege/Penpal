I have enough context. Here is the implementation plan:

---

## Implementation Plan: `workstation-animator.test.ts`

**File to create:** `Penny/tests/renderer/game/workstation-animator.test.ts`

---

### 1. Set up mock infrastructure (top of file)

Copy the `makeFakeScene` pattern from the smoke test, but extend it to support:
- `scene.add.graphics()` — returns a stub with `clear/fillStyle/fillRoundedRect/lineStyle/beginPath/arc/strokePath/setAlpha/strokeRoundedRect` as `vi.fn()`
- `scene.add.text()` — returns stub with `setText/setOrigin/setData/getData/width/height/active`
- `scene.add.container()` — returns stub with `add/setAlpha/setVisible/active`
- `scene.cameras.main.zoom` — settable number (default 1.0)
- `scene.scene.isActive()` — returns `true`
- `scene.time.delayedCall` — `vi.fn()` (immediately callable)

Build a `makeWorkstationStub(agentId)` that provides all fields accessed by the methods under test:
- `lastAnimMode`, `sprite` (with `setFrame/setScale/setAngle/x/y`), `statusDot`, `monitorGlowFx` (with `color/outerStrength`), `moodEmoji` (Text stub with `getData/setData/setText/setScale/setAlpha/y/active`), `moodBadge` (sprite stub), `blockedIndicator/blockedIndicatorBadge/blockedIndicatorPulse/blockedIndicatorStem/blockedIndicatorText` (each with relevant setters), `speechBubble`, `deskBody.setStrokeStyle`, `lodLevel3Objects`, `container`
- All tween handle fields (`bounceTween`, `typingTween`, etc.) start `undefined`

Build `makeAgentState(overrides)` — minimal `AgentState` with `sessionMode:'idle'`, no `needsInteraction`.

Build `makeMinimalHost()` — implements `WorkstationHost` interface with:
- `getRooms: () => new Map()`
- `getAgentCharacterIndex: () => 0`
- `clearSteamParticles: vi.fn()`

---

### 2. `describe('updateAnimation — state machine')`

**2a. idle → working transition**
- Create animator + ws stub with `lastAnimMode = undefined`
- Call `updateAnimation(ws, agentWorking)`
- Assert `ws.lastAnimMode === 'working'`
- Assert `ws.bounceTween` defined (set by working branch)
- Assert `ws.typingTween` defined
- Assert `ws.headTiltTween` defined
- Assert `scene.tweens.add` was called with `repeat: -1` (persistent tween)

**2b. working → idle transition clears tweens**
- Set `ws.lastAnimMode = 'working'`, assign mock tween objects to `ws.bounceTween`, `ws.typingTween`, `ws.headTiltTween`
- Call `updateAnimation(ws, agentIdle)`
- Assert all three tweens had `.destroy()` called
- Assert `ws.bounceTween === undefined`
- Assert `ws.lastAnimMode === 'idle'`

**2c. idle → waiting transition**
- Call `updateAnimation(ws, agentWaiting)` where `agentWaiting.needsInteraction = true`
- Assert `ws.lastAnimMode === 'waiting'`
- Assert `ws.pulseTween` defined
- Assert `ws.dotPulseTween` defined

**2d. same mode is a no-op**
- Set `ws.lastAnimMode = 'idle'`
- Spy on `scene.tweens.add`
- Call `updateAnimation(ws, agentIdle)` again
- Assert `tweens.add` was NOT called

**2e. working → waiting clears working tweens**
- Populate working tweens on `ws`, set `lastAnimMode = 'working'`
- Call `updateAnimation(ws, agentWaiting)`
- Assert `.destroy()` called on all populated tweens

---

### 3. `describe('updateMonitorGlow — color selection')`

**3a. working → cyan glow**
- Call `updateMonitorGlow(ws, true, false)`
- Assert `ws.monitorGlowFx.color === 0x0ea5e9`
- Assert tween with `repeat: -1` was added

**3b. waiting → yellow glow**
- Call `updateMonitorGlow(ws, false, true)` 
- Assert `ws.monitorGlowFx.color === 0xfbbf24`

**3c. idle → uses `activeTheme.deskBody`**
- Call `updateMonitorGlow(ws, false, false)`
- Assert `ws.monitorGlowFx.color === activeTheme.deskBody`

**3d. orchestrator executing → orange**
- Set `ws.state.isOrchestratorTask = true`, `ws.state.taskStage = 'executing'`
- Call `updateMonitorGlow(ws, true, false)`
- Assert `ws.monitorGlowFx.color === 0xf97316`

**3e. orchestrator planning → purple**
- `taskStage = 'planning'` → assert `0xa78bfa`

**3f. orchestrator validating → cyan**
- `taskStage = 'validating'` → assert `0x06b6d4`

**3g. no monitorGlowFx → returns early (no throw)**
- `ws.monitorGlowFx = undefined`, call updateMonitorGlow — expect no error

---

### 4. `describe('updateBlockedIndicator')`

**4a. needsInteraction=false → hides indicator**
- Set `ws.blockedIndicator.visible = true`
- Call `updateBlockedIndicator(ws, agentNotBlocked)`
- Assert `ws.blockedIndicator.setVisible(false)` was called

**4b. tool-approval → orange/! glyph**
- `agent.needsInteraction = true`, `agent.interactionType = 'tool-approval'`
- Call `updateBlockedIndicator`
- Assert `blockedIndicatorText.setText` called with `'!'`
- Assert `blockedIndicatorBadge.setFrame` called with `ICON_FRAMES.CIRCLE_RED`
- Assert `ws.blockedIndicatorTween` defined

**4c. question → blue/? glyph**
- `interactionType = 'question'`
- Assert glyph `'?'`, badge `ICON_FRAMES.CIRCLE_BLUE`

**4d. accept-edits → blue/~ glyph**
- `interactionType = 'accept-edits'`
- Assert glyph `'~'`, badge `ICON_FRAMES.CIRCLE_BLUE`

**4e. existing tween is destroyed before setting new one**
- Pre-assign `ws.blockedIndicatorTween = { destroy: vi.fn() }`
- Call with `needsInteraction = true`
- Assert `.destroy()` was called on the old tween

---

### 5. `describe('getAgentMood — mood selection')`

**5a. tool-approval → 😤**
- `agent.needsInteraction = true, interactionType = 'tool-approval'`
- Assert `emoji === '😤'`

**5b. question → 🤔**
- `interactionType = 'question'`
- Assert `emoji === '🤔'`

**5c. working → 💻**
- `sessionMode = 'working'`
- Assert `emoji === '💻'`

**5d. plan → 🧠**
- `sessionMode = 'plan'`
- Assert `emoji === '🧠'`

**5e. compressing → 😵**
- `sessionMode = 'compressing'`
- Assert `emoji === '😵'`

**5f. idle → ☕**
- Default idle state
- Assert `emoji === '☕'`

---

### 6. `describe('updateMood — bubble visibility')`

**6a. same emoji → no-op (no tween added)**
- Stub `ws.moodEmoji.getData('currentEmoji')` to return `'💻'`
- Set `agent.sessionMode = 'working'`
- Spy on `scene.tweens.add`
- Call `updateMood(ws, agent)`
- Assert `tweens.add` NOT called

**6b. different emoji → fade-out tween initiated**
- `currentEmoji = '☕'`, agent is working (`💻`)
- Call `updateMood`
- Assert `tweens.add` called (fade-out)

**6c. no moodEmoji → returns early (no throw)**
- `ws.moodEmoji = undefined`
- Call `updateMood` — no error

---

### 7. `describe('showSpeechBubble (via updateAnimation working branch)')`

**7a. working mode triggers speech bubble creation**
- Agent with `lastAssistantBlurb = 'Hello world'`, `sessionMode = 'working'`
- Call `updateAnimation(ws, agent)` (ws.lastAnimMode different from 'working')
- Assert `scene.add.graphics` was called (lazy bubble creation)
- Assert `scene.add.text` was called
- Assert `ws.speechBubble` is set

**7b. orchestrator task uses taskTitle over blurb**
- `agent.isOrchestratorTask = true`, `agent.taskTitle = 'Deploy service'`, `agent.lastAssistantBlurb = 'ignored'`
- Trigger working mode
- Assert the text stub had `setText` called with something containing `'[Task]'` or `'Deploy service'`
- (Inspect the tween `onUpdate` callback to verify)

**7c. empty blurb → no bubble created**
- `agent.lastAssistantBlurb = ''`, `agent.isOrchestratorTask = false`
- Call updateAnimation in working mode
- Assert `scene.add.graphics` was NOT called

---

### Notes for executor

- The smoke test imports show the correct path pattern: `../../src/renderer/src/game/...`
- The new test directory `tests/renderer/game/` does not yet exist — create it with the test file
- Keep the Phaser mock at top identical to the smoke test (`vi.mock('phaser', ...)`)
- `scene.tweens.add` in the fake scene must NOT call `onComplete` immediately for tests that only check tween creation (use a plain `vi.fn()` returning a mock tween object with `destroy: vi.fn()`); only fire `onComplete` when the test specifically triggers it
- Use `vi.spyOn` where needed rather than replacing the whole fake scene