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

**What exists today**: L0 through L5 — a fully functional game-office with 18 decomposed modules, pod workflows, XP system, 150+ IPC handlers.

**What's missing**: L1 — the intelligence layer that makes Penny learn and improve.

---

## III. The Five Upgrades

### Upgrade 1: MCP Server Layer — "Penny Speaks Agent"
*Source: Kent Dodds (EpicAI), Eugene Yan (News Agents), Jason Liu (Context Engineering)*

**Problem**: Agents interact with Penny through IPC handlers designed for React components. No agent can programmatically query the office state, dispatch tasks, or coordinate with siblings.

**Solution**: Expose Penny's core capabilities as MCP tool servers.

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

### Upgrade 2: Eval Harness — "Measure Everything"
*Source: Hamel Husain (Field Guide, Evals FAQ), Eugene Yan (Product Evals, AlignEval)*

**Problem**: No way to know if agent output quality is improving or degrading. Pod workflows run but quality is untracked. New features ship without baseline measurement.

**Solution**: Eval-driven development baked into the orchestrator.

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

### Upgrade 3: Preference Capture — "Penny Learns From You"
*Source: Phil Schmid (DPO), Lilian Weng (Why We Think), BAIR (TinyAgent)*

**Problem**: Every approve/reject click in CommandCenter is preference data being thrown away. Penny never learns from your decisions.

**Solution**: Capture implicit preference signals → generate training pairs → fine-tune agent behavior.

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

### Upgrade 4: Context-Engineered Tool Responses — "Teach Agents to Think"
*Source: Jason Liu (Context Engineering), Hamel Husain (Context Rot)*

**Problem**: IPC handlers return raw data. Agents getting tool results don't know what to do next, what's relevant, or what's noise. Long contexts rot quality.

**Solution**: Redesign all tool response schemas to be self-documenting and context-aware.

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

### Upgrade 5: Test-Time Compute for Pods — "Think Harder, Not Bigger"
*Source: Lilian Weng (Why We Think), Sebastian Raschka (Inference-Time Scaling)*

**Problem**: Pod agents get one shot per phase. Solver generates code → Reviewer approves/rejects → Executor runs tests. No iterative refinement within phases.

**Solution**: Add inference-time scaling to each pod phase.

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

## IV. Game Surface Evolution

The game isn't decoration — it's the primary interface for understanding system state at a glance.

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

### New Game Elements from Framework

1. **Eval glow** — Workstations pulse green/amber/red based on recent eval scores
2. **Context meter** — Small bar showing agent context window utilization (warns on rot)
3. **Preference sparkles** — Brief particle burst when you approve an agent action
4. **Thinking animation** — Visible multi-step reasoning (dots appearing in sequence) when best-of-N is running
5. **MCP connection lines** — Dashed lines showing which external tools an agent is connected to
6. **Quality streak** — Flame effect on desk when agent has 5+ consecutive successful tasks

---

## V. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Preference collector — hook into approve/reject/complete IPC events
- [ ] Preference store — write pairs to `data/preferences.jsonl`
- [ ] Basic eval harness — task pass/fail rate tracking
- [ ] Eval panel in React — show success rates by agent

### Phase 2: MCP Server (Week 3-4)
- [ ] `penny-mcp-server` package with stdio transport
- [ ] 5 core tool groups: orchestrator, pods, office, vault, graph
- [ ] Self-documenting `meta:list-tools` and `meta:describe-tool`
- [ ] Context-engineered responses for the 10 most-called handlers
- [ ] Wire into agent system prompts via `agents/shared-memory.md`

### Phase 3: Smart Pods (Week 5-6)
- [ ] PhaseConfig system in pods.ts
- [ ] Best-of-N for Solver (configurable per priority)
- [ ] Structured Reviewer critique format
- [ ] Executor self-fix mini-loop
- [ ] Confidence scoring + escalation thresholds

### Phase 4: Learning Loop (Week 7-8)
- [ ] DPO pair generation from preference store (500+ pairs)
- [ ] Q-LoRA training pipeline (TRL + bitsandbytes)
- [ ] TinyAgent experiment — fine-tune 7B for Penny function calling
- [ ] A/B eval: stock model vs DPO-trained on Penny tasks
- [ ] Context rot detection + automatic context pruning

### Phase 5: Game Polish (Ongoing)
- [ ] Eval glow on workstations
- [ ] Thinking animation for best-of-N
- [ ] MCP connection line rendering
- [ ] Quality streak flame effect
- [ ] Preference sparkle particles
- [ ] Context utilization meter

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

| Metric | Current | Phase 2 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| Task success rate | Unknown | 70% measured | 85%+ |
| Avg tasks/day/agent | ~3-5 | 5-8 | 10+ |
| Preference pairs collected | 0 | 200 | 1000+ |
| Eval coverage | 0% | 50% of tasks | 90% of tasks |
| Agent self-fix rate | 0% | N/A | 30% of failures |
| MCP-connected sessions | 0 | 5+ | All agents |
| Context rot incidents | Unknown | Tracked | <5% of tasks |
| Human review cadence | Ad-hoc | Weekly 50 outputs | Weekly 50 outputs |

---

## VIII. What This Isn't

- **Not a rewrite.** Every upgrade is additive to the existing 20K-line game codebase.
- **Not dependent on training infra.** Phases 1-3 work with zero ML training. Phase 4 is optional.
- **Not a new product.** This is Penny becoming what it was always meant to be — an intelligent workspace that learns.
- **Not about model size.** A well-tuned 7B model with good evals and preference data beats GPT-4 for your specific workflows.

---

*Framework derived from: Lilian Weng, Jason Liu, Hamel Husain, Eugene Yan, Phil Schmid, Kent C. Dodds, Guillermo Rauch, Andrej Karpathy, Sebastian Raschka, Chip Huyen, Boris Cherny, BAIR — March 2026*
