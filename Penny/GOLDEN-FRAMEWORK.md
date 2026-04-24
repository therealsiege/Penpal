# The Golden Framework for Penny

> Penny is a sentient office — a living, breathing workspace where AI agents are visible,
> trustworthy colleagues you manage like a studio of engineers building your company.

---

## I. Core Identity

Penny is not a dashboard. Penny is not a chat UI. Penny is not a monitoring tool.

**Penny is the operating system for AI-augmented work.**

It answers one question: *"What are my agents doing right now, and how do I make them better?"*

Three pillars:
1. **Visibility** — See agents work in real-time (isometric office, game metaphor)
2. **Control** — Direct agents through structured interfaces (pods, orchestrator, MCP)
3. **Learning** — The system gets smarter from every interaction (evals, DPO, preference capture)

---

## II. Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  L5: GAME SURFACE                               │
│  Phaser 3 isometric office, LOD, particles,     │
│  seasons, quests, cosmetics, leaderboard        │
├─────────────────────────────────────────────────┤
│  L4: REACT SHELL                                │
│  CommandCenter, panels, modals, command palette  │
│  Zustand stores, xterm.js terminals             │
├─────────────────────────────────────────────────┤
│  L3: IPC BRIDGE                                 │
│  150+ typed handlers, wrapHandler() error layer  │
│  contextBridge (window.api / window.pty)         │
├─────────────────────────────────────────────────┤
│  L2: ORCHESTRATION ENGINE                       │
│  Pods (Solver→Reviewer→Executor), task queue,    │
│  XP/credits, agent health, session polling       │
├─────────────────────────────────────────────────┤
│  L1: INTELLIGENCE LAYER (NEW)                   │
│  MCP servers, eval harness, preference capture,  │
│  context engineering, local model inference       │
├─────────────────────────────────────────────────┤
│  L0: CONNECTORS                                 │
│  Claude sessions, Cursor, Memgraph, Qdrant,      │
│  Slack, GitHub, Veritas, file system, NPPES      │
└─────────────────────────────────────────────────┘
```

**What exists today**: All six layers are functional. L1 (Intelligence Layer) was built in Waves 7-8: MCP server with 5 tool groups, eval harness with spot-check queue and weekly digests, preference capture (approve/reject signals to JSONL), combo analytics tracking agent performance, scoped context injection, complexity-based model routing, and ReasoningBank pattern learning.

**What's next**: Closing the learning loop — DPO fine-tuning from preference data, TinyAgent local inference, and context rot detection.

---

## III. The Five Upgrades — Status

### Upgrade 1: MCP Server Layer — "Penny Speaks Agent" ✅ DONE
*Source: Kent Dodds (EpicAI), Eugene Yan (News Agents), Jason Liu (Context Engineering)*

**Shipped.** 5 tool groups (meta, orchestrator, pods, office, vault) with stdio transport. Any Claude session can query the office, dispatch tasks, and coordinate pods.

```
penny-mcp-server/
├── tools/
│   ├── orchestrator.ts    # enqueue-task, get-queue, get-agent-health
│   ├── pods.ts            # create-pod, pod-status, list-pods
│   ├── office.ts          # get-room-layout, agent-positions, game-state
│   ├── vault.ts           # read-file, search, write-file, backlinks
│   ├── graph.ts           # search-leads, lead-detail, graph-stats
│   └── meta.ts            # list-available-tools, describe-tool (self-documenting)
├── resources/
│   ├── agent-roster.ts    # Live agent configs + current states
│   ├── leaderboard.ts     # Current season rankings
│   └── task-queue.ts      # Active task list as resource
└── server.ts              # stdio transport, connects to Electron main via IPC
```

**Key design principle** (Jason Liu): Every tool response includes structured metadata about what other tools are relevant and what actions make sense next. The tools *teach* agents how to use Penny.

```typescript
// Example: orchestrator:enqueue response
{
  task: { id: "t-42", title: "Fix login bug", status: "queued", priority: "high" },
  _meta: {
    next_actions: ["pod:create to assign a team", "orchestrator:queue to see position"],
    related_tools: ["agents:health to check availability", "vault:search to find related code"],
    context: "3 agents idle, 1 pod active on frontend-feature preset"
  }
}
```

**Impact**: Any Claude session can become a Penny-aware agent. Pods can self-coordinate. External tools (scheduler, RSS ingester) can dispatch work through Penny.

---

### Upgrade 2: Eval Harness — "Measure Everything" ⚠️ BUILT BUT DORMANT
*Source: Hamel Husain (Field Guide, Evals FAQ), Eugene Yan (Product Evals, AlignEval)*

**Built but not recording.** The eval harness (`src/main/evals/harness.ts`) has `record()` and `reportAll()` methods, IPC handlers are registered, the EvalsPanel renders agent report cards — but nothing calls `evalHarness.record()`. The `data/eval-outcomes.jsonl` file stays empty. The weekly digest generator exists but has no data to consume.

**What works:** Pod quality collector (895 events), combo analytics (3 events), spot-check queue (functional), context-usage collector (active).

**What's dead:** The core harness that ties it all together. Need to wire `orchestrator.ts` task completions into `evalHarness.record()`.

```
src/main/evals/
├── harness.ts             # Core eval runner
├── collectors/
│   ├── task-outcomes.ts   # Pass/fail per task, time-to-complete, retry count
│   ├── pod-quality.ts     # Reviewer acceptance rate, executor test pass rate
│   ├── approval-rate.ts   # User approve vs reject ratio per agent
│   └── context-usage.ts   # Token counts, context rot detection
├── judges/
│   ├── llm-judge.ts       # LLM-as-judge for open-ended quality
│   ├── rubric-judge.ts    # Structured rubric scoring
│   └── human-judge.ts     # Manual spot-check queue (20-50 outputs)
├── reports/
│   ├── weekly-digest.ts   # Auto-generated quality report
│   └── experiment-log.ts  # Track config changes + quality deltas
└── dashboard.ts           # IPC handlers for eval panel in React
```

**The Three Metrics That Matter:**
1. **Experiment velocity** — How many agent configurations tested this week?
2. **Task success rate** — Pass/fail by agent, by task type, by priority
3. **Human alignment** — Does the LLM judge agree with your manual reviews?

**Implementation pattern** (Hamel's benevolent dictator): One domain expert (you) reviews 20-50 outputs after any significant change. This catches more bugs than any automated benchmark.

**New IPC handlers:**
- `evals:run(taskId)` — Run eval suite on a completed task
- `evals:report()` — Get weekly quality digest
- `evals:spot-check()` — Queue random outputs for manual review
- `evals:experiments()` — Log of config changes + quality impact

---

### Upgrade 3: Preference Capture — "Penny Learns From You" ⚠️ COLLECTING, NOT TRAINING
*Source: Phil Schmid (DPO), Lilian Weng (Why We Think), BAIR (TinyAgent)*

**Collecting.** 101 preference pairs in `data/preferences.jsonl` from approve/reject signals. The `PairGenerator` (`src/main/preferences/pairs.ts`) can convert these to DPO training format — but it's never called. No training pipeline exists yet.

**What works:** Signal capture (5 types: approve, reject, edit, complete, fail), JSONL persistence, IPC for UI review.

**What's dead:** `PairGenerator.generate()` — dead code. DPO training pipeline — not built. A/B eval — not built.

```
src/main/preferences/
├── collector.ts           # Hooks into approve/reject/edit IPC events
├── pairs.ts               # Generates (chosen, rejected) DPO pairs
├── store.ts               # Preference DB (SQLite or JSON)
├── trainer.ts             # DPO training pipeline trigger
└── feedback-loop.ts       # Close the loop: retrain → deploy → measure
```

**Preference signals already flowing through Penny:**
| Signal | Location | Strength |
|--------|----------|----------|
| Tool approval click | `sessions:approve` | Strong positive |
| Tool rejection | `sessions:reject` (implicit) | Strong negative |
| Message edit before send | `sessions:send` | Weak corrective |
| Pod reviewer accept | `pods.ts` reviewer phase | Strong positive |
| Pod reviewer reject + feedback | `pods.ts` feedback loop | Strong negative with reason |
| Task completion vs failure | `orchestrator.ts` | Binary outcome |
| Agent XP awards | `orchestrator.ts` | Quality weighted by priority |

**Phase 1** (no training required): Log all preference pairs to `data/preferences.jsonl`. Include full context (system prompt, conversation history, tool call, user decision).

**Phase 2** (DPO fine-tuning): When you have 500+ pairs, use Phil Schmid's TRL pipeline to DPO-train a small model (Qwen-7B or Llama-8B) on your preference data. Deploy via local inference.

**Phase 3** (TinyAgent): Fine-tune a dedicated 7B model for Penny's function calling patterns. Local inference at <100ms. The model learns *your* approval patterns.

---

### Upgrade 4: Context-Engineered Tool Responses — "Teach Agents to Think" ⚠️ PARTIAL
*Source: Jason Liu (Context Engineering), Hamel Husain (Context Rot)*

**Partially done.** Scoped context injection (`pod-context.ts`) is live and working — reduces CLAUDE.md from 3000+ tokens to ~1500 task-relevant tokens. Context-usage collector tracks token pressure. But most IPC handlers still return raw arrays — the "structured surfaces" pattern hasn't been applied broadly.

**Current pattern** (raw data):
```typescript
// orchestrator:queue handler returns
return tasks; // just the array
```

**Golden pattern** (context-engineered):
```typescript
// orchestrator:queue handler returns
return {
  tasks,
  summary: `${tasks.length} tasks: ${critical} critical, ${high} high. ${idle} agents idle.`,
  suggestions: critical > 0 && idle > 0
    ? ["Assign critical tasks to idle agents via pod:create"]
    : ["Queue is healthy, no action needed"],
  context: {
    idle_agents: idleAgents.map(a => ({ id: a.id, name: a.name, skills: a.config.skills })),
    active_pods: activePods.length,
    avg_completion_time: avgTime
  }
};
```

**Rules for context-engineered responses:**
1. Always include a human-readable `summary` (1 sentence)
2. Include `suggestions` — what should the caller do next?
3. Include `context` — related state the caller needs
4. Filter aggressively — less data beats more data (context rot)
5. Include `_tools` — what other tools are relevant right now

**Apply to all 150+ IPC handlers incrementally.** Start with the 10 most-called: `agents:statuses`, `orchestrator:queue`, `pod:list`, `vault:search`, `graph:search-leads`.

---

### Upgrade 5: Test-Time Compute for Pods — "Think Harder, Not Bigger" ✅ DONE
*Source: Lilian Weng (Why We Think), Sebastian Raschka (Inference-Time Scaling)*

**Shipped.** Best-of-N solver candidates with self-evaluation selection. Structured reviewer critiques with severity levels. Executor self-fix loop. PhaseConfig per priority tier. Confidence scoring. All integrated into `pods.ts` with runtime profiles (max/sonnet/economic).

**Current flow:**
```
Solver (1 attempt) → Reviewer (1 review) → Executor (1 test run)
                                                    ↓ fail
                                            Solver retry (max 3)
```

**Golden flow:**
```
Solver:
  1. Generate N candidate solutions (best-of-N sampling)
  2. Self-evaluate each candidate against task requirements
  3. Select best candidate with explicit reasoning
  4. Submit with confidence score

Reviewer:
  1. Independent analysis (never sees Solver's reasoning)
  2. Generate structured critique with severity levels
  3. If low-confidence: request Solver clarification before accept/reject
  4. Produce actionable feedback (not just pass/fail)

Executor:
  1. Run tests iteratively (not all-at-once)
  2. On failure: self-diagnose → generate fix → re-test (mini-loop)
  3. Report: what passed, what failed, what was fixed, what needs Solver
```

**Implementation in pods.ts:**
```typescript
interface PhaseConfig {
  candidates: number;        // best-of-N (default: 1, high-priority: 3)
  selfEvaluation: boolean;   // generate reasoning about own output
  confidenceThreshold: number; // 0-1, below this → request clarification
  maxSelfFixes: number;      // executor self-fix attempts before escalating
}

const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  'critical': { candidates: 3, selfEvaluation: true, confidenceThreshold: 0.8, maxSelfFixes: 2 },
  'high':     { candidates: 2, selfEvaluation: true, confidenceThreshold: 0.7, maxSelfFixes: 1 },
  'normal':   { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.5, maxSelfFixes: 1 },
  'low':      { candidates: 1, selfEvaluation: false, confidenceThreshold: 0.3, maxSelfFixes: 0 },
};
```

**Key insight** (Lilian Weng): Spending 3x compute on reasoning at inference time produces better results than using a 3x larger model. For critical tasks, generate 3 candidates and let the Solver self-select. For low-priority tasks, single-shot is fine.

---

## III-B. Data Flow — What's Wired vs What's Dead

The intelligence layer has three data loops. Two are dormant.

```
LOOP 1: REASONING BANK ✅ (wired end-to-end)
  Pod completes → storePodPattern() → reasoning-bank.json
  New pod starts → findSimilar(task) → inject past patterns into solver prompt
  Status: Working. 2+ patterns stored. Needs more pod runs to be useful.

LOOP 2: EVAL HARNESS ❌ (built but disconnected)
  [nothing] → evalHarness.record() → eval-outcomes.jsonl (empty)
  EvalsPanel → evalHarness.reportAll() → empty report
  Weekly digest → reads eval-outcomes.jsonl → nothing to read
  Fix: Wire orchestrator task completions into evalHarness.record()

LOOP 3: PREFERENCE → DPO ❌ (collecting, not training)
  Approve/reject clicks → preferences.jsonl (101 pairs)
  [nothing] → PairGenerator.generate() → DPO pairs (never called)
  [nothing] → TRL training pipeline → fine-tuned model (not built)
  Fix: Call PairGenerator on schedule, build training pipeline
```

**Combo analytics** are a special case — the collector records data but no decision logic reads the report to auto-route work to better-performing combos. Currently display-only in EvalsPanel.

---

## IV. Game Surface Evolution

The game isn't decoration — it's the primary interface for running the business.

### What the Game Communicates

| Visual Element | System State |
|---------------|-------------|
| Agent walking to desk | Session starting, agent connecting |
| Monitor glow intensity | CPU usage / active computation |
| Thought bubble emoji | Current mood / task type |
| Desk cosmetics (lamp, plant) | Agent rank / XP progression |
| Room size | Number of agents assigned to project |
| Pod connecting lines | Active pod workflow, phase colors |
| Particle effects | Task completion, rank-up, season events |
| Day/night cycle | Real clock, work intensity rhythm |
| Cafe occupancy | Idle agents socializing |
| Rivalry sparks | Agents within 5% XP of each other |

### Game Elements — Status

| Element | Status | Description |
|---------|--------|-------------|
| Eval glow | Done | Workstations pulse green/amber/red based on recent eval scores |
| Quality streak flames | Done | Flame effect on desk scales with consecutive successful tasks (3-tier hotness) |
| Pod spectator labels | Done | Real-time SOLVING/REVIEWING/EXECUTING stage labels on active workstations |
| Bestiary cards | Done | Full character cards with stats, lore, powers, rival/ally (I key) |
| Natural rivalry lines | Done | Crimson dashed lines between bestiary-defined rival pairs with clash VFX |
| Combo analytics panel | Done | Agent combo leaderboard + stage timing in EvalsPanel |
| Context meter | Done | Small bar showing agent context window utilization |
| Preference sparkles | Planned | Brief particle burst when you approve an agent action |
| Thinking animation | Planned | Visible multi-step reasoning (dots appearing in sequence) for best-of-N |
| MCP connection lines | Planned | Dashed lines showing which external tools an agent is connected to |
| Agent interaction (E key) | Planned | Walk to desk → context menu → assign task / view stats / dialog |
| Quest board at whiteboard | Planned | Click whiteboard → see GitHub issues as quests, drag-to-assign |

---

## V. Implementation Status & Roadmap

### Done: Foundation + Intelligence Layer

| Phase | Status | What Shipped |
|-------|--------|-------------|
| Preference capture | Done | Approve/reject signals → `data/preferences.jsonl`, DPO pair generation |
| Eval harness | Done | Task pass/fail tracking, spot-check queue, weekly digests, agent report cards |
| MCP server | Done | 5 tool groups (meta, orchestrator, pods, office, vault), stdio transport |
| Smart pods | Done | Best-of-N candidates, structured critique, self-fix loop, confidence scoring, PhaseConfig |
| Complexity routing | Done | Auto-select Sonnet/Opus/Opus+N by task signal scoring |
| ReasoningBank | Done | Pattern storage + similarity matching for solver injection |
| Governance | Done | Max files/diff/duration, forbidden paths, per-rule actions |
| Merge queue | Done | Sequential rebase → tsc → dupe-scan → ff-merge → push |
| Combo analytics | Done | Agent triple performance tracking (JSONL + EvalsPanel UI) |
| Pod spectator | Done | Real-time stage labels + glow rings during pod execution |

### Next: Three Frontiers

**Frontier 1: The Interactive Office**

The player character exists (WASD movement) but can't interact with the world. This frontier makes the office a place you *manage through*, not just watch.

```
Walk to desk → E key → Context Menu
  ├── View Stats (bestiary card, eval history, combo performance)
  ├── Assign Task (pick from GitHub issues, set priority)
  ├── Customize (cosmetics shop for this agent)
  └── Recent Work (last 5 completed tasks with PR links)

Walk to whiteboard → E key → Quest Board
  ├── Available Issues (agent-ready from GitHub, grouped by repo)
  ├── Drag issue onto agent to assign
  ├── See combo predictions (which team would work best?)
  └── Launch Pod (select 3 agents, see projected success rate)

Walk to cafe → E key → Team Briefing
  ├── Fleet status (who's idle, who's working, who's blocked)
  ├── Season progress (challenges, leaderboard, MVP)
  └── Daily briefing (from scheduler — new leads, RSS intel, alerts)
```

This isn't about adding game mechanics for fun. It's about making GitHub issues, agent stats, and pod formation accessible *through the world* instead of through panel menus. The office becomes the operating interface.

**Frontier 2: Scene Architecture**

Every scene is a `Phaser.Scene` subclass that follows the same pattern as OfficeScene — orchestrator + modules. The pod system generalizes: different scenes dispatch different *kinds* of work through the same Solver→Reviewer→Executor pipeline.

```
Scene Architecture:
  ┌─ WorldMap (CampusScene) ────────────────────────────┐
  │  Pins per Penpal instance. Double-click to enter.   │
  └─────────────────────────────────────────────────────┘
       │              │              │              │
  ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
  │ Dev Lab │   │  Call   │   │ Content │   │  War   │
  │         │   │ Center  │   │ Studio  │   │  Room  │
  └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

What's shared across all scenes:
- Agent roster + configs (agent-types.yaml)
- Pod pipeline (pods.ts — Solver→Reviewer→Executor)
- Eval harness (collectors, spot-check, digests)
- Leaderboard, XP, seasons, credits
- MCP server (tools work regardless of active scene)
- Fleet heartbeat + Slack bridge

What's scene-specific:
- **Visual layout** — each scene has its own tilemap, props, ambient animations
- **Agent presets** — the Call Center uses support-triage/specialist/qa presets, not frontend-feature
- **Work sources** — Dev Lab pulls from GitHub Issues; Call Center pulls from Zendesk/email; Content Studio pulls from content calendar
- **Workflow templates** — Dev Lab pods write code; Content Studio pods write blog posts; War Room pods write analysis docs
- **Game mechanics** — Call Center has queue visualization, hold music, escalation chains; Content Studio has mood boards, draft previews, publication animations

Scene registration in OfficeGame.ts:
```typescript
this.scene.add('campus', CampusScene)      // world map (done)
this.scene.add('dev-lab', OfficeScene)      // development (done)
this.scene.add('call-center', CallCenterScene)  // support (planned)
this.scene.add('content-studio', ContentStudioScene) // marketing (planned)
this.scene.add('war-room', WarRoomScene)    // intelligence (planned)
```

**How this maps to 1Putt Health:**
- **Dev Lab** → Building MedScrub, MedHook, Penpal itself
- **Content Studio** → Blog posts for 1putthealth.com, social campaigns, SEO content
- **War Room** → Competitive intelligence (the knowledge graph + RSS pipeline already feeds this)
- **Call Center** → Eventually: MedScrub customer support when the product ships

**Frontier 3: The Learning Loop**

The data pipeline is built. Preferences are captured. Combo analytics track which teams work best. What's missing is closing the loop — using this data to make agents autonomously better.

```
Current state (data collection):
  Click approve → preference signal → preferences.jsonl
  Pod completes → combo event → eval-pod-combos.jsonl
  Pod completes → pattern → reasoning-bank.json
  Complexity scorer → reads reasoning bank → routes to model tier

Near-term (data-driven routing):
  Combo analytics → auto-select best-performing preset for task type
  Reasoning bank → surface failure patterns as warnings in solver prompt
  Eval trends → alert when agent quality drops below threshold
  Fleet analytics → weekly digest with actionable recommendations

Mid-term (fine-tuning):
  500+ preference pairs → DPO training on Qwen-7B via TRL
  Deploy fine-tuned model via Ollama → economic profile uses it
  A/B eval: stock Sonnet vs DPO-tuned 7B on routine tasks
  Cost: $0 inference for 80% of tasks (routine), Opus for 20% (complex)

Long-term (self-improving):
  Continuous preference collection → monthly retrain
  TinyAgent: 7B model trained specifically on Penny's function calling patterns
  Context rot detection → auto-prune stale context, measure quality impact
  Agent skill trees → track what each agent is good at, route accordingly
```

The endgame isn't "pods that work." It's a workforce that gets measurably better every week, with the game surface showing you exactly where the improvements are happening and where attention is needed.

---

## V-B. Scene Deep Dives

Each scene is a business function with its own visual language, workflow templates, and game mechanics. The pod pipeline is shared. Everything else is scene-local.

### Dev Lab (Current — Operational)

**Business function:** Build software — MedScrub, MedHook, Penpal itself, 1putthealth.com.

**Visual language:** Isometric office with workstations, monitors, cafe. Dark industrial aesthetic. Agents sit at desks with status indicators. Rooms group agents by project (cwd).

**Workflow templates:**
- `frontend-feature` — Erlang Shen solves, Ao Guang reviews, Sha Wujing executes
- `backend-feature` — Sun Wukong solves, Guanyin reviews, Sha Wujing executes
- `game-feature` — Red Boy solves, Ao Guang reviews, Sha Wujing executes
- `content-pipeline` — Ao Run solves, Tripitaka reviews, Zhu Bajie executes

**Work sources:** GitHub Issues (`agent-ready` label), manual dispatch, MCP `pod:create`.

**Game mechanics unique to this scene:**
- Workstation cosmetics (desk items, RGB underglow, name glow) gated by XP rank
- Code-themed celebrations (checkmark sprites, confetti on PR merge)
- Monitor screen content changes by agent state (scrolling code lines vs plan dots vs amber warning)
- Quality streak flames on desk (consecutive successful tasks)
- Eval glow ring (green/amber/red based on recent success rate)

### Content Studio (Next — Planned)

**Business function:** Produce marketing content for 1Putt Health — blog posts, social media, SEO, email campaigns, documentation.

**Visual language:** Open-plan creative space. Drafting tables instead of desks. Mood boards on walls showing current campaign themes. Publication wall showing recently published pieces. Lighter, warmer palette than the Lab.

**Workflow templates:**
- `blog-post` — Writer (solver) drafts article → Editor (reviewer) checks tone/accuracy/SEO → Publisher (executor) formats and publishes via git commit to 1putthealth.com repo
- `social-campaign` — Strategist (solver) creates multi-platform content plan → Brand reviewer validates voice consistency → Scheduler (executor) formats for each platform
- `seo-audit` — Analyst (solver) crawls site, identifies gaps → Editor (reviewer) prioritizes → Writer (executor) produces optimized content

**Work sources:**
- Content calendar (markdown files in `Ventures/1Putt/Content Calendar/`)
- RSS-triggered responses (competitor publishes something → Content Studio drafts a response)
- Manual brief from Slack (`!content "Write a blog post about CRC screening compliance"`)

**Game mechanics unique to this scene:**
- Draft preview on "monitors" — shows actual markdown rendered as text blocks
- Mood board prop — click to see current campaign themes, brand colors, voice guidelines
- Publication wall — recently merged content PRs shown as framed thumbnails
- Social reach counter — tracks impressions/clicks via Fathom Analytics API
- Editing animation — agent's "monitor" shows red-line markup during review phase

**Scene-specific agents (extend agent-types.yaml):**
- `content-writer` — Specialized in blog/article writing, SEO awareness
- `brand-editor` — Reviews for voice consistency, factual accuracy, readability
- `social-strategist` — Multi-platform content planning, engagement optimization

### War Room (Planned)

**Business function:** Competitive intelligence, market analysis, strategic planning. Already partially powered by the sidekick-graph knowledge graph + RSS pipeline.

**Visual language:** Dark room with multiple screens. Data walls showing live feeds. Map table in center. Red/amber accent lighting. Feels like a SCIF or mission control.

**Workflow templates:**
- `intel-brief` — Analyst (solver) gathers data from knowledge graph + RSS feeds → Reviewer validates accuracy/sourcing → Briefer (executor) formats and delivers as markdown to `Ventures/1Putt/Daily Briefings/`
- `competitor-analysis` — Researcher (solver) deep-dives a competitor using web-intel.json + Firecrawl → Analyst (reviewer) identifies strategic implications → Writer (executor) produces Competitive Intelligence Matrix update
- `market-scan` — Scanner (solver) processes NPI data + CMS feeds → Analyst reviews for lead potential → Scorer (executor) updates lead scores in knowledge graph

**Work sources:**
- Scheduled jobs (daily briefing, weekly competitive scan — already running via scheduler)
- RSS feed triggers (new article about a competitor → auto-dispatch analysis pod)
- Manual request from Slack (`!intel "What's Athenahealth doing in the CRC screening space?"`)
- Knowledge graph queries via MCP

**Game mechanics unique to this scene:**
- Data wall screens show live RSS headlines, NPI enrichment progress, lead pipeline status
- Threat level indicator (green/amber/red) based on competitor activity volume
- Map table shows territory coverage (TX, TN, CO, NC, AL — the target states)
- Briefing animation — agent walks to map table, "presents" with pointer, document appears
- Intel quality score — tracks how many briefing recommendations led to action

### Call Center (Later)

**Business function:** Customer support for MedScrub when it launches. Ticket resolution, escalation, knowledge base maintenance.

**Visual language:** Cubicle farm. Agents wear headsets. Queue board shows waiting tickets. Escalation paths drawn as connecting lines between tiers. Hold music plays when queue is deep.

**Workflow templates:**
- `support-ticket` — Triage (solver) classifies and drafts response → Specialist (reviewer) validates accuracy → QA (executor) sends response and verifies resolution
- `escalation` — Tier-1 agent flags complex issue → Tier-2 specialist investigates → Resolution agent closes loop

**Work sources:**
- Email inbox (future — Zendesk/Intercom integration)
- In-app support widget (future — MedScrub ships with embedded support)
- Knowledge base gaps (agent couldn't answer → creates KB update ticket)

This scene is furthest out — depends on MedScrub having actual customers.

---

## V-C. Agent Progression System

Agents aren't interchangeable workers. They develop specializations over time based on real performance data.

### Skill Trees (Planned)

Each agent accumulates evidence of what they're good at:

```
Performance data (from combo analytics + eval harness):
  Agent X as solver:    85% success rate on frontend tasks, 60% on backend
  Agent X as reviewer:  92% first-pass accept rate on game code
  Agent X as executor:  70% pass rate overall

  → Agent X's skill profile: frontend-solver (strong), game-reviewer (strong)
```

**How skill data accumulates:**
- Every pod completion → combo analytics records agent + role + outcome
- Every eval → harness records agent + task type + pass/fail
- ReasoningBank → records which agent patterns succeeded
- Over time: statistical profile of each agent's strengths by role × task type

**How skill data is used:**
- Combo analytics `suggestBestCombo()` already uses success rate — extend to weight by task-type match
- Display skill bars in bestiary card (currently static from YAML; replace with computed stats)
- Season challenges: "Have Agent X reach 90% success rate as solver" — skill-based progression
- Alert when an agent's quality drops: "Sun Wukong's executor pass rate dropped from 80% to 55% this week"

### Agent Personality Evolution (Vision)

The Journey to the West personas aren't just flavor text. They should influence agent behavior:

```
Current: Static system prompts with persona injected once at pod creation
Future:  Dynamic system prompts that incorporate:
  - Agent's actual performance history ("You've been strong on frontend tasks")
  - Recent mistakes to avoid ("Last 3 executor runs on test files failed — be careful")
  - Rival's performance ("Erlang Shen is outperforming you on frontend tasks — step up")
  - Season challenge progress ("You need 3 more successful reviews to complete the challenge")
```

This doesn't require fine-tuning. It's context engineering — the system prompt adapts to include real performance data. The persona makes the data feel natural rather than clinical.

### Cosmetic Progression Tied to Performance

The cosmetic tier system (desk items gated by XP rank) is currently passive — agents earn XP just by completing tasks. Extend it so cosmetics reflect real achievement:

| Cosmetic | Current Gate | Proposed Gate |
|----------|-------------|---------------|
| Keyboard | L3 (Associate) | 50 tasks completed |
| Lamp | L4 (Senior) | 80% success rate sustained for 1 week |
| Plant | L6 (Staff) | Complete a season challenge |
| Phone | L7 (Principal) | Top 3 in seasonal leaderboard |
| Gold trim | L8 (Master) | 5+ consecutive successful pods |
| RGB underglow | L9 (Distinguished) | Complete 100 tasks with >85% success |

This makes desk appearance a reliable signal: a fully-decorated desk means the agent is genuinely performing well, not just accumulating XP from easy tasks.

---

## V-D. Operational Economics

Penpal's value is measured in leverage: how much business output per dollar of compute and hour of human attention.

### Cost Model

```
Current state:
  Sonnet profile: ~$0.05-0.20 per pod (3 phases, ~5K tokens each)
  Opus profile:   ~$0.50-2.00 per pod (3 phases, higher token usage)
  Economic:       ~$0.00 per pod (local Ollama, free)

  10 pods/day on Sonnet = ~$1-2/day
  10 pods/day on Opus   = ~$5-20/day

Target state (with DPO-tuned local model):
  80% of tasks → economic profile (DPO-tuned 7B) = $0
  20% of tasks → Opus profile (complex work)      = ~$1-4/day
  Total: ~$1-4/day for 10 pods

Long-term (TinyAgent):
  95% of tasks → TinyAgent (7B tuned on Penny patterns) = $0
  5% of tasks  → Opus (novel/complex)                    = ~$0.25-1/day
```

### Attention Model

The game surface exists to minimize human attention cost:

```
Without Penpal:
  Check each agent's terminal → read output → decide if it's good → approve/reject
  Time: 2-5 min per agent check × 10 agents × 3x/day = 60-150 min/day

With Penpal (current):
  Glance at the office → spot red/amber indicators → investigate only those
  Time: 30 sec glance + 5 min per flagged agent × 2 flags/day = ~11 min/day

With Penpal (vision — interactive office):
  Walk through office → E-key flagged agents → review in-game → approve/assign
  Time: 5 min game walkthrough including actions = ~5 min/day
  Plus: weekly 50-output spot-check review = ~30 min/week
```

The interactive office isn't about adding game mechanics for fun. It's about reducing the management overhead from 2+ hours/day to 5 minutes/day by making the information-dense actions (review, assign, approve) accessible through spatial navigation instead of panel-switching.

### Revenue Leverage

Each scene maps to a revenue-generating business function:

| Scene | Revenue Path | Current State |
|-------|-------------|---------------|
| Dev Lab | Ship MedScrub faster → first customers | Building product |
| Content Studio | SEO content → inbound leads → consulting revenue | Blog live, need volume |
| War Room | Intelligence → better positioning → win deals faster | RSS + NPI pipeline running |
| Call Center | Support at scale → retain customers → reduce churn | Waiting for customers |

Penpal's job is to make one person's attention go as far as a 10-person team's across all four functions. The game makes that possible by collapsing four monitoring surfaces into one spatial world.

---

## V-E. The Knowledge Graph as Operating Memory

The knowledge graph (`sidekick-graph/`) is Penpal's long-term memory — the persistent understanding of leads, competitors, markets, and relationships that agents draw on when doing real work. Currently read-only from Penny's perspective. That changes.

### What Exists Today

**Infrastructure:** Memgraph (graph DB) + Qdrant (vector embeddings), populated via ETL from the Vault markdown files.

**Node types (20):** Document, Folder, Tag, Person, Company, Technology, EHRSystem, Skill, Regulation, Lead, Market, Event, SalesStage, Territory, Practice, BillingCode, Program, Specialty, CompetitorProduct.

**Data sources feeding the graph:**
- Vault markdown files (parsed → entities extracted via Claude → nodes + relationships)
- NPPES CSV (11GB, streaming parse → Practice nodes with NPI, taxonomy, address)
- NPI API enrichment (Firecrawl scraping practice websites → EHR detection, specialty confirmation)
- RSS feeds (HIStalk, Becker's, Healthcare IT News, Fierce, ONC, CMS → intel nodes)
- Google Alerts (competitor mentions → event nodes)
- Web intelligence (`data/web-intel.json` → CompetitorProduct nodes)

**Queries Penny runs today** (10 Cypher queries in `src/main/graph.ts`):
- Pipeline summary (leads by stage × venture)
- Hot leads (score ≥45)
- Territory stats (lead count + avg score by state)
- New leads (last 24h)
- Full-text lead search with state/EHR/stage filters
- Lead detail with event timeline
- Graph stats with data freshness indicator

### How the Graph Connects to Scenes

```
                     Vault (markdown files)
                           │
                     ┌─────┴─────┐
                     │  ETL      │ ← sidekick-graph/src/etl/
                     │ (parse,   │
                     │  extract, │
                     │  embed)   │
                     └─────┬─────┘
                           │
                    ┌──────┴──────┐
                    │  Memgraph   │   ← graph DB
                    │  + Qdrant   │   ← vector store
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
         │ Dev Lab │ │War Room │ │ Content │
         │         │ │         │ │ Studio  │
         └─────────┘ └─────────┘ └─────────┘

  Dev Lab:      Lead detail in agent context → MedScrub features
  War Room:     Pipeline queries, territory maps, competitor data
  Content Stud: Lead personas for content targeting, SEO keyword data
```

### Where It's Going: Read-Write Graph

Today the graph is a data source. Agents query but never write. The next step is closing the loop:

**Agent → Graph writes:**
- Pod completes a lead enrichment task → writes enrichment data back to graph (EHR detected, contact found)
- Content Studio pod publishes blog post → creates Document node linked to leads it targets
- War Room pod produces competitor analysis → creates/updates CompetitorProduct nodes

**Graph → Agent context injection:**
- When a pod solver starts a MedScrub task, auto-inject relevant lead profiles from the graph
- When the Content Studio plans a blog post, query the graph for lead personas in the target market
- When the War Room analyzes a competitor, pull all existing intel nodes as context

**Graph as shared memory across scenes:**
- A lead identified by the War Room (RSS alert) → enriched by Dev Lab (NPI data) → targeted by Content Studio (SEO content) → supported by Call Center (when they sign up)
- The graph is the thread connecting all four scenes. Without it, scenes are isolated workflows. With it, they're a coordinated business.

---

## V-F. The Slack Command Surface

Slack is the remote control for Penpal. The game is for deep situational awareness. Slack is for quick actions from anywhere — your phone, your iPad, between meetings.

### What Works Today

**Channel structure:**
- `#sk-{project}` per workspace directory (e.g., `#sk-sidekick-2`, `#sk-medscrub`)
- `#sk-fleet` for instance heartbeats
- `#sk-pipeline` for GitHub issue workflow notifications

**Message routing:**
- Agent assistant messages → channel (every 5s poll, deduped by conversation index)
- User message in channel → agent TTY (via `sendToSession()`)
- Multi-agent channels require `@agent-name` mention; single-agent channels route implicitly
- Status emoji in agent messages: `:hammer_and_wrench:` working, `:hourglass_flowing_sand:` waiting, `:warning:` needs approval

**The one command that exists:**
```
!task Fix the login validation bug priority:high agent:fullstack-dev
```
Parses into: title, description, priority, preferred agent. Enqueues to orchestrator.

**DM alerts:**
- `dmOwner()` sends to `SLACK_OWNER_USER_ID` when pipeline escalates
- No DM on tool approval requests yet (status shown in channel, human approves in terminal)

### Where It's Going

The Slack surface needs to grow from 1 command to a full operating vocabulary. Each command maps to an existing IPC handler — the work is routing, not building:

```
Operations:
  !task "description" [priority:P] [agent:A]  → orchestrator:enqueue (exists)
  !queue                                       → orchestrator:queue (exists)
  !agents                                      → agents:statuses (exists)

Pods:
  !pod "task description" [preset:P]           → pod:create (exists)
  !pod status                                  → pod:list (exists)
  !pod cancel <id>                             → pod:cancel (exists)
  !pods                                        → pod:list with summary (exists)

Intelligence:
  !intel "query"                               → War Room pod dispatch (new)
  !brief                                       → Latest daily briefing from Vault (read file)
  !leads [state] [stage]                       → graph:search-leads (exists)
  !lead "Dr. Smith"                            → graph:lead-detail (exists)

Content:
  !content "brief description"                 → Content Studio pod dispatch (new)
  !publish                                     → List drafted content awaiting publish (new)

Fleet:
  !fleet                                       → fleet:status (exists)
  !health                                      → health:check (exists)

Evals:
  !eval                                        → This week's success rates + MVP (exists)
  !combos                                      → Top 3 agent combos by success rate (exists)
```

**DM escalation (planned):**
```
When an agent needs tool approval:
  → DM to owner: "Sun Wukong needs approval: delete-file on src/old-module.ts"
  → Slack action buttons: [Approve] [Reject] [View Context]
  → Tapping Approve → IPC sessions:approve → agent resumes

When a pod fails:
  → DM: "Pod #412 failed (executor: test timeout). Solver: Sun Wukong."
  → Action buttons: [Retry] [View PR] [Cancel]

When quality drops:
  → DM: "Erlang Shen's success rate dropped below 70% this week (was 85%)"
  → Action buttons: [View Stats] [Pause Agent] [Ignore]
```

This turns Slack into a genuine command line for the business. You can manage agents from your phone while walking the dog. The game is for depth; Slack is for speed.

### Approval Flow: Terminal vs Slack

Today: Agent shows tool call in terminal → human sees it in Penpal or iTerm → types approve/reject. Slack shows status but can't act.

Target: Slack interactive messages with action buttons that call IPC directly. This requires Slack Block Kit actions + a thin HTTP endpoint or Socket Mode handler. The `@slack/bolt` library (already installed) supports this natively — it's routing work, not infrastructure.

---

## V-G. The Fleet — Multiple Machines, One Workforce

Fleet is the simplest piece of Penpal — and the most underexplored. Today it's read-only discovery. The vision is coordinated work distribution.

### What Exists Today

Each Penpal instance posts a heartbeat to `#sk-fleet` every 60 seconds:
```json
{
  "instanceId": "a230eaf0",
  "hostname": "Clints-Mac-Studio-422",
  "user": "fuzeelogik",
  "status": "healthy",
  "sessions": { "total": 5, "active": 3, "idle": 1, "waiting": 1 },
  "pods": { "active": 2, "total": 45 },
  "repos": ["Penpal", "medscrub", "1putthealth.com"],
  "uptime": 43200,
  "geo": { "lat": 36.16, "lon": -86.86, "city": "Nashville, Tennessee" }
}
```

Heartbeats are updated in-place (`chat.update`) — one message per instance. The CampusScene world map renders pins for each instance: red for self, blue for remote, gray for stale (>5 min).

**Instances are fully independent.** No work-stealing, no shared task queue, no cross-instance pod execution. Each machine runs its own agents on its own repos.

### Where It's Going

**Phase 1: Visibility (already works)**
- See all instances on the world map
- Know which repos each instance is working on
- Spot unhealthy instances (degraded/down status)

**Phase 2: Specialization (planned)**
Each machine runs a different scene optimized for its hardware:

```
Mac Studio (Nashville):
  - Dev Lab (primary) — 12 agents, 3 concurrent pods
  - War Room — scheduled intelligence jobs
  - Ollama running locally → economic profile for routine tasks

MacBook Pro (mobile):
  - Content Studio — lightweight content pods
  - Slack-first operation (no game needed)
  - Sonnet profile only (no local GPU)

Cloud VM (optional):
  - Headless Penpal — no game, just pod engine + Slack bridge
  - Batch processing: NPI enrichment, RSS ingestion, ETL
  - Economic profile via cloud Ollama instance
```

**Phase 3: Work Distribution (vision)**
The fleet channel becomes a task queue, not just discovery:

```
Instance A has 3 idle agents, Instance B has 0 idle.
New issue labeled agent-ready.
Instance A's pipeline picks it up (it has capacity).
Instance B sees the heartbeat update — A claimed the issue.
No conflict, no coordination protocol needed beyond Slack message ordering.
```

This is lightweight distributed computing via Slack as the message bus. No gRPC, no central broker, no consensus protocol. Slack's message ordering is sufficient for a fleet of 2-5 instances. At scale, you'd need a real queue — but a solo founder doesn't need 50 instances.

**Fleet economics:**
- Mac Studio running 24/7: ~$0.10/day electricity, $0 compute (local Ollama)
- Cloud VM (if needed): ~$5-15/month for a GPU instance running Ollama
- Total fleet cost: <$20/month for 3 instances running 30+ agents across 4 business functions

---

## V-H. How Agents Actually Learn — The DPO Pipeline

The learning loop is the most important piece of the vision and the least built. Here's the concrete path from "101 preference pairs in a JSONL file" to "a fine-tuned model running locally at zero cost."

### What Exists Today

**Data collection (working):**
```
Human clicks approve → PreferenceCollector captures:
  { agentId, signal: "approve", strength: "strong",
    context: { toolCall, toolResult, recentMessages } }
  → appended to data/preferences.jsonl

101 events collected so far (approve, reject, edit, complete, fail)
```

**Pair generation (built, not called automatically):**
```
PairGenerator reads preferences.jsonl → yields DPO pairs:
  { prompt, chosen, rejected, source, agentId }

Three pair types:
  1. approve_reject — same agent, same session, approve vs reject
  2. complete_fail — same agent, complete vs fail on similar tasks
  3. edit_corrective — user's edit vs agent's original draft

Export: data/dpo-pairs.jsonl (TRL-compatible format)
```

**What's NOT built:**
- Training pipeline (nothing reads dpo-pairs.jsonl and produces a model)
- Model registry (no versioning of fine-tuned checkpoints)
- Deployment pipeline (no automatic Ollama model swap)
- A/B evaluation (no framework for running stock vs tuned side-by-side)

### The Concrete Pipeline (Vision)

```
Phase 1: Data Accumulation (NOW → 500 pairs)
  ┌─────────────────────────────────────────────┐
  │ Human uses Penpal normally                   │
  │ Approve/reject clicks → preferences.jsonl    │
  │ Pod outcomes → combo analytics               │
  │ Weekly: click "Generate Pairs" in EvalsPanel │
  │ → dpo-pairs.jsonl grows                      │
  └─────────────────────────────────────────────┘
  
  No training. No model changes. Just accumulate data.
  Target: 500 pairs over ~4-6 weeks of normal usage.

Phase 2: First Training Run (at 500 pairs)
  ┌─────────────────────────────────────────────┐
  │ Export dpo-pairs.jsonl to training machine   │
  │ Base model: Qwen-7B (or Qwen3-Coder-7B)    │
  │ Training: TRL DPOTrainer, QLoRA (4-bit)     │
  │ Hardware: Mac Studio M-series (MLX)          │
  │   or cloud GPU for ~2 hours ($2-5)          │
  │ Output: LoRA adapter weights (~50MB)         │
  │ → Merge into base model via mergekit         │
  │ → Create Ollama Modelfile                    │
  │ → ollama create penny-7b -f Modelfile        │
  └─────────────────────────────────────────────┘
  
  The fine-tuned model knows YOUR patterns:
  - Which tool calls you approve vs reject
  - What code quality you accept vs send back
  - How you phrase corrections

Phase 3: Deployment + A/B Eval (after training)
  ┌─────────────────────────────────────────────┐
  │ Update agent-types.yaml economic profile:    │
  │   model: "ollama:penny-7b"                   │
  │                                              │
  │ Run 20 tasks on Sonnet (control)             │
  │ Run 20 tasks on penny-7b (experiment)        │
  │ Compare: success rate, iteration count,      │
  │   human approval rate, duration              │
  │                                              │
  │ If penny-7b ≥ 90% of Sonnet quality:         │
  │   → Route routine tasks to penny-7b ($0)     │
  │   → Keep Opus/Sonnet for complex tasks       │
  │                                              │
  │ If penny-7b < 80% of Sonnet:                 │
  │   → Collect 500 more pairs, retrain          │
  └─────────────────────────────────────────────┘

Phase 4: Continuous Learning (ongoing)
  ┌─────────────────────────────────────────────┐
  │ Preferences accumulate continuously          │
  │ Monthly: export new pairs, retrain, redeploy │
  │ Version tracking: penny-7b-v1, v2, v3...    │
  │ A/B eval each version vs previous            │
  │ Skill specialization: train per-agent models │
  │   (penny-wukong-7b for fullstack work,       │
  │    penny-erlang-7b for frontend work)        │
  └─────────────────────────────────────────────┘
```

### What 500 Pairs Actually Gets You

DPO with 500 high-quality pairs on a 7B model is enough to learn:
- **Tool call patterns** — which MCP tools to reach for, in what order
- **Code style preferences** — formatting, naming, error handling patterns you approve
- **Scope discipline** — how much to change per task (you reject over-scoped PRs)
- **Communication style** — how to phrase PR descriptions, commit messages, reviewer comments

It's NOT enough to learn:
- Deep architectural decisions (need 2000+ pairs with rich context)
- Novel problem-solving (the base model handles this; DPO just aligns preferences)
- Multi-step planning (need chain-of-thought training data, not just preference pairs)

### The Economics of Learning

```
Cost to collect 500 pairs: $0 (captured passively during normal work)
Cost to train (QLoRA on 7B):
  - Mac Studio M2 Ultra: ~4 hours, $0 (local)
  - Cloud A100 GPU: ~2 hours, $3-5
Cost to deploy: $0 (Ollama local, ollama create + modelfile)
Cost to run inference: $0 (local)

Monthly retrain cycle:
  - Export pairs: 1 click in EvalsPanel
  - Train: 2-4 hours (can run overnight)
  - Deploy: ollama create, update agent-types.yaml
  - Eval: 40 tasks × 2 (A/B) = ~$4 in Sonnet for control group

Total monthly learning cost: ~$4-9
Value: 80% of pod inference drops to $0
```

The learning loop pays for itself within the first week of deployment. Every month it gets more accurate because it has more data about *your specific* preferences.

---

## V-I. A Day Running 1Putt Health Through Penpal

> Note: This section was written as V-E earlier. Renumbered after inserting infrastructure sections.

This is what the operating system looks like in practice. Not a product demo — a real workday.

### Morning (7:00 AM)

Open Penpal. The world map shows your Mac Studio pin in Nashville (green — healthy). No remote instances today.

Double-click to enter the Dev Lab. The office is in dawn phase — sky gradient shifting warm, ceiling lights flickering on. Glance at the room: 8 agents at desks, 2 in the cafe. Quick read:

- Sun Wukong's desk is glowing green with a 5-streak flame. He completed 3 issues overnight on MedScrub.
- Erlang Shen has an amber eval glow. His success rate dropped this week.
- There's a pod connecting line between Red Boy, Ao Guang, and Sha Wujing — a game-feature pod is actively solving.

Press `L` to check the leaderboard. Sun Wukong is MVP this week. Guanyin is within 5% — rivalry sparks between their desks.

Check Slack. The `#sk-sidekick-2` channel has overnight activity:
```
[Sun Wukong] Completed: Fix CRC screening date validation (#412) — PR merged
[Sun Wukong] Completed: Add MIPS measure 113 documentation (#413) — PR merged
[Sun Wukong] Blocked: Need approval on tool call (delete-file) for #414
[Erlang Shen] Failed: Theme component hydration mismatch (#410) — 2 attempts, gave up
```

The blocked notification was DM'd to you at 3 AM. Tap it in Slack → Penpal focuses Sun Wukong's terminal → see the tool call → approve. He resumes.

Erlang Shen's failure needs attention. Walk to his desk (WASD), press `E`:
- **View Stats**: 72% success rate this week (was 85% last week). 3 failures on Next.js hydration tasks.
- **Recent Work**: The failed PR shows a server/client component boundary error — consistent pattern.

This tells you something: Erlang Shen's system prompt needs a reminder about Next.js App Router server component rules. Open his agent config (`agents/agent-types.yaml`), add a line to his system prompt. This improvement applies to all future tasks — no fine-tuning needed.

### Mid-morning (9:30 AM)

Switch to checking the content pipeline. There's no Content Studio scene yet, so this runs through Slack and the Vault:

```
!content "Write a blog post about independent practices missing CRC screening revenue"
```

Slack routes this to the content-pipeline pod preset (Ao Run → Tripitaka → Zhu Bajie). A pod spins up in the Dev Lab — you can see the connecting lines between the three agents. Ao Run's monitor shows scrolling text as he drafts.

Meanwhile, check the War Room data (currently accessed via the Vault panel):
- Open `Ventures/1Putt/Daily Briefings/2026-04-24.md` — auto-generated by the scheduler overnight
- New lead from NPI enrichment: Dr. Sarah Chen, internal medicine, uses eClinicalWorks in Nashville
- Competitor alert: Athenahealth announced a population health screening module

The daily briefing was written by the intelligence pipeline (scheduler → RSS ingester → daily-briefing.ts). No human involvement. When the War Room scene exists, this briefing will be the "map table presentation" — an agent walks up and presents it visually.

### Midday (12:00 PM)

The overnight pods have been running. Check the Eval dashboard:
- Pod combo analytics show `fullstack-dev|backend-arch|electron-dev` at 85% success (12 runs)
- `videogame-dev|ui-designer|electron-dev` at 67% (6 runs) — Red Boy struggles with non-game code
- DPO pairs: 147 collected. Not enough for training yet, but growing.

The content pod finished. Check `Ventures/1Putt/Content Calendar/` — Ao Run drafted a blog post, Tripitaka edited for tone, Zhu Bajie formatted it with frontmatter. The post is in `src/content/blog/crc-screening-revenue.mdx` in the 1putthealth.com repo, ready to push.

Glance at the office. Three pods completed this morning. Five issues closed. Sun Wukong's streak is at 6. The seasonal challenge "Complete 50 tasks" is at 38/50.

### Afternoon (2:00 PM)

Time to focus on MedScrub product work. This is human-directed, not pod-automated:
- Review Sun Wukong's overnight PRs for the CRC screening module
- Test the date validation logic manually
- Write the USPSTF guideline integration spec as a new GitHub issue

Label the spec issue `agent-ready`. Within 60 seconds, the GitHub pipeline picks it up. A pod forms: Sun Wukong (solver — he's the strongest on MedScrub), Guanyin (reviewer — backend architecture), Sha Wujing (executor). You see the pod connecting lines appear in the office. Red Boy's desk goes dark — he's not on this one.

Press `I` on Sun Wukong to check his bestiary card. Realm: "The Heavenly Court." Signature move: "72 Transformations." Rival: Erlang Shen. The card shows his stats — speed 9, precision 7, creativity 10. Below that, his real performance data contradicts the lore: precision is actually his strongest suit at 92% first-pass acceptance.

### Evening (6:00 PM)

Check in one last time. The USPSTF pod is in the reviewing stage — Guanyin's monitor glows amber. Press the spectator mode and see "REVIEWING" floating above her desk.

The content blog post from this morning got 3 views from organic search already (Fathom Analytics). Not much, but it's content that didn't exist yesterday and cost $0.15 in API calls to produce.

Check fleet status. Your Mac Studio will run overnight. Label 3 more GitHub issues `agent-ready` for the pod fleet to work on while you sleep.

Close Penpal. The agents keep working.

### What this day required from you:

| Activity | Time | What happened |
|----------|------|---------------|
| Morning office walkthrough | 5 min | Spotted Erlang Shen's quality drop, fixed his prompt |
| Slack review + approve blocked tool | 3 min | Sun Wukong resumed overnight work |
| Content pod dispatch | 1 min | Blog post produced end-to-end |
| War Room briefing read | 3 min | New lead identified, competitor intel consumed |
| Eval dashboard check | 2 min | Combo performance validated |
| MedScrub PR review | 20 min | Human judgment on product quality |
| Spec writing + issue labeling | 15 min | Directed new pod work |
| Evening check-in | 3 min | Verified pods progressing, queued overnight work |
| **Total** | **~52 min** | 8 issues closed, 1 blog post, 1 competitor alert, 3 PRs |

52 minutes of human attention. 8 completed issues. One blog post published. A new lead identified. Three more issues queued for overnight. This is what a 10x leverage operating system looks like.

---

## V-J. The Three Surfaces — Game, Slack, GitHub

Penpal has three interaction surfaces. They're not alternatives — they're concurrent. Each handles what it's best at.

### Surface 1: The Game (Spatial Awareness)

**What it's for:** Understanding state at a glance. Spotting anomalies. Spatial navigation to where attention is needed.

**When you use it:** Morning walkthrough. Checking on pod progress. Investigating a flagged agent. Assigning work via E-key interaction. Watching celebrations when pods complete.

**What it shows that panels can't:** The *relationship* between agents — rivalry lines, pod connections, room groupings. The *rhythm* of work — day/night cycle, cafe visits, idle vs working balance. The *quality* of an agent's work — desk cosmetics, eval glow, streak flames. None of this is accessible in a table.

### Surface 2: Slack (Asynchronous Command)

**What it's for:** Receiving alerts when you're not looking at Penpal. Dispatching work without opening the app. Communicating with agents in natural language.

**How it works today:**
- Each project (cwd) gets a dedicated Slack channel (`#sk-sidekick-2`)
- Agent messages are forwarded to the channel in real-time
- DM alerts when an agent is blocked or needs tool approval
- Fleet heartbeat posts to `#sk-fleet` every 60 seconds

**Where it's going:**
```
!task "Fix the login bug on MedScrub"          → orchestrator:enqueue
!pod status                                     → list active pods with stage
!dispatch                                       → show queue with priorities
!intel "What's CareMessage doing?"              → War Room pod dispatch
!content "Blog post about MIPS quality measures" → Content Studio pod dispatch
!brief                                          → Latest daily briefing
!eval                                           → This week's success rate + MVP
```

Slack becomes the command line for the operating system. You can run your business from your phone. The game is for when you're at your desk and want the full picture; Slack is for when you're walking the dog and an agent needs a decision.

### Surface 3: GitHub (Work Interface)

**What it's for:** The source of truth for what needs to be done and what's been done.

**How it works today:**
- Issues labeled `agent-ready` → GitHub pipeline → pod → PR → merge queue → merged
- Each pod creates a PR with structured body (summary, test plan, team)
- Merge queue runs `tsc --noEmit` + duplicate scan before pushing to main
- Pod reflection is appended to agents/CLAUDE.md as team knowledge

**Where it's going:**
- Linear integration alongside GitHub Issues (different project boards, same pod pipeline)
- Issue templates with structured fields that feed directly into pod context
- PR review comments from human reviewers → preference capture → DPO training data
- Auto-labeling based on combo analytics ("this issue type performs best with game-feature preset")

### How the Three Surfaces Interact

```
                    ┌─────────────────┐
                    │    YOU          │
                    └───┬───┬───┬────┘
                        │   │   │
              ┌─────────┘   │   └─────────┐
              ▼             ▼             ▼
         ┌─────────┐  ┌─────────┐  ┌─────────┐
         │  Game   │  │  Slack  │  │ GitHub  │
         │ (see)   │  │ (talk)  │  │ (work)  │
         └────┬────┘  └────┬────┘  └────┬────┘
              │            │            │
              └────────┬───┘            │
                       ▼                │
              ┌──────────────┐          │
              │   Penpal     │◄─────────┘
              │  Main Process│
              │  (pods, orch,│
              │   evals, MCP)│
              └──────┬───────┘
                     │
              ┌──────┴───────┐
              │  Agents      │
              │  (Claude,    │
              │   Ollama,    │
              │   Cursor)    │
              └──────────────┘
```

You see through the game. You talk through Slack. Work moves through GitHub. All three feed into the same pod engine, eval harness, and learning loop. No surface is primary — they're three windows into one system.

---

## V-K. The Self-Building Machine

Penpal builds itself. This isn't a metaphor — it's the core operational loop.

### The Recursive Loop

```
1. You write a GitHub issue describing a Penpal feature
2. Label it `agent-ready`
3. The GitHub pipeline (running inside Penpal) picks it up
4. A pod forms (agents defined in Penpal's own agent-types.yaml)
5. The solver reads Penpal's CLAUDE.md (which describes Penpal's architecture)
6. The solver writes code that changes Penpal
7. The reviewer independently validates the code (also reading CLAUDE.md)
8. The executor runs `tsc --noEmit` on Penpal's own codebase
9. The merge queue rebases onto Penpal's main branch and pushes
10. The change improves Penpal — which improves the system that will run step 1-9 next time
```

Every improvement to the pod pipeline makes future pods better. Every improvement to the game makes the monitoring that catches pod failures clearer. Every improvement to the eval harness makes quality measurement more accurate, which makes routing better, which makes pods more successful.

### What This Looks Like in Practice

**Wave 6 (this week):** Pods extracted the tween lifecycle manager, fixed audio leaks, synced walk animation speed, added particle caps. These were refactoring tasks on Penpal's own game code — the pods improved the visual quality of the office that displays the pods.

**Wave 8 (this week):** We built the combo analytics collector, bestiary viewer, and pod spectator mode. The combo analytics will track how well future pods perform — including the pods that build more analytics features.

**Wave 9 (this week):** Pods activated the DPO pair generator and wired combo auto-routing. The DPO pairs come from approve/reject decisions on pod work. The auto-routing selects better pod teams. Both feed back into the next pod run.

### Where the Loop Breaks

The recursive loop has known failure modes. Acknowledging them prevents magical thinking:

1. **CLAUDE.md clobber** — Pods overwrite the documentation that future pods need to understand the codebase. *Fixed: pods now restore CLAUDE.md from git before committing.*

2. **Squash merge artifacts** — Parallel pods editing the same files produce duplicates when merged. *Fixed: MergeQueue now scans for duplicate class members.*

3. **Quality drift** — If pods ship code that passes `tsc` but crashes at runtime (like undefined constants), the codebase degrades silently. *Partially fixed: eval harness tracks outcomes, but runtime testing is still manual.*

4. **Context rot** — As the codebase grows, CLAUDE.md gets stale, scoped context misses relevant files, and pods make decisions based on outdated information. *Tracked: context-usage collector measures token pressure, but no auto-update mechanism.*

5. **Taste gap** — Pods can implement features correctly but not *well*. Code that passes tests but has bad UX, wrong abstractions, or missing edge cases. *Mitigation: human spot-check reviews (weekly 50 outputs), preference capture, eventually DPO training.*

The self-building machine works as long as the feedback loops are functioning and a human is periodically checking quality. The game surface is what makes that periodic check efficient — you spot the problem in the office before reading a single line of code.

### The Compounding Effect

Each week the system runs, it gets better at running:

```
Week 1:  Pods complete at 70% success. Manual rebase. No analytics.
Week 4:  Pods at 75%. Merge queue handles rebase. Combo analytics collecting.
Week 8:  Pods at 80%. Auto-routing to best combos. 500 preference pairs.
Week 12: Pods at 85%. DPO-tuned 7B handles routine tasks at $0. Opus only for complex.
Week 20: Pods at 90%. Skill trees route by task type. Content Studio operational.
Week 30: War Room running. 3 scenes. Self-improving workforce across 4 business functions.
```

This isn't a roadmap with deadlines. It's a description of what happens when a self-improving system runs long enough with consistent human oversight. The pods get better because they learn from their failures. The routing gets better because it learns from outcomes. The game gets better because the pods build it.

The question isn't "will this work?" — the pods are already shipping code. The question is "how fast does it compound?" That depends on three things: how often the feedback loops fire, how quickly you spot and fix broken loops, and how disciplined you are about the weekly spot-check review.

Penpal doesn't replace judgment. It amplifies it.

---

## VI. Design Principles

### 1. Visibility Over Abstraction
Every system state has a visual representation. If you can't see it in the office, it doesn't exist. Debug by watching the game, not reading logs.

### 2. Structured Surfaces Over Raw Data
Every tool response teaches the caller what to do next. Context-engineered responses are the API. Raw arrays are implementation details.

### 3. Eval Before Ship
No new agent capability ships without a baseline eval. The question is never "does it work?" but "is it measurably better than before?"

### 4. Learn From Every Click
Every human decision is training data. Approve, reject, edit, ignore — all are preference signals. Capture everything, train when ready.

### 5. Think Harder, Not Bigger
Spend compute on reasoning at serving time. Best-of-N, self-evaluation, iterative refinement. A 7B model that thinks for 10 seconds beats a 70B model that answers in 1.

### 6. Deterministic State Machine, Not Another LLM
The orchestrator, pod workflow, and eval harness are deterministic code, not LLM prompts. LLMs do the creative work inside phases. The framework around them is predictable and debuggable.

### 7. Progressive Enhancement
Start with what works today. Add one layer at a time. Phase 1 is just logging preference pairs — zero risk, immediate value. Each phase stands alone.

---

## VII. Success Metrics

| Metric | Current (Apr 2026) | Next Target | Long-term |
|--------|-------------------|-------------|-----------|
| Task success rate | ~70% (measured via eval harness) | 80% | 90%+ |
| Pod completion rate | 69.9% (895 recorded runs) | 80% | 90%+ |
| Combo analytics coverage | 3 real combos tracked | 20+ combos | All presets |
| Preference pairs collected | Collector running, ~50 pairs | 500 | 2000+ |
| Eval coverage | 100% of tasks (auto-tracked) | Maintained | Maintained |
| Agent self-fix rate | Available (tracked per pod) | 30% of failures | 50%+ |
| MCP-connected sessions | 5 tool groups active | All agents | All agents |
| ReasoningBank patterns | 2 entries | 50+ | 500+ |
| Context rot incidents | Tracked (context-usage collector) | <10% | <5% |
| Human review cadence | Ad-hoc spot-checks | Weekly 50 | Weekly 50 |
| Scenes operational | 1 (Dev Lab) | 2 (+ Content Studio) | 5 |
| Local model inference | Economic profile (qwen3-coder) | DPO-tuned 7B | TinyAgent |

---

## VIII. What This Is — And Isn't

Penpal is internal operating infrastructure for running 1Putt Health. It is not a product to sell.

- **Not a rewrite.** Every upgrade is additive to the existing codebase (now 25K+ lines across 50+ game modules).
- **Not dependent on training infra.** The intelligence layer works today with zero ML training. Fine-tuning amplifies what's already working.
- **Not a dashboard.** The game surface is the primary interface. If you have to open a panel to understand system state, the game has failed.
- **Not about model size.** A well-tuned 7B model with good evals and preference data beats Opus for routine tasks at zero cost.

**What it is:** The operating system for a one-person company running an AI workforce across multiple business functions — development, marketing, intelligence, support — visible in real-time through game scenes, improving with every interaction.

---

*Framework derived from: Lilian Weng, Jason Liu, Hamel Husain, Eugene Yan, Phil Schmid, Kent C. Dodds, Guillermo Rauch, Andrej Karpathy, Sebastian Raschka, Chip Huyen, Boris Cherny, BAIR — March 2026. Updated April 2026 to reflect Waves 5-8 implementation.*
