import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POD_WORKFLOWS_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "pod-workflows.json",
);

const LEGACY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "triplet-workflows.json",
);

export const podsStatusSchema = {
  name: "pods_status",
  description:
    "Get detailed status of a specific pod workflow including current phase, role statuses, stage history, artifacts, and completion estimates.",
  inputSchema: {
    type: "object" as const,
    properties: {
      workflowId: {
        type: "string",
        description: "The pod workflow ID (e.g., pod-1711234567890-1)",
      },
    },
    required: ["workflowId"],
  },
};

interface PodWorkflow {
  id: string;
  name: string;
  status: string;
  task: string;
  cwd: string;
  solver: { agentId: string; status: string; output?: string };
  reviewer: { agentId: string; status: string; output?: string };
  executor: { agentId: string; status: string; output?: string };
  iteration: number;
  maxIterations: number;
  artifacts: { stage: string; path: string; iteration: number; timestamp: number }[];
  selfFixAttempts?: number;
  maxSelfFixes?: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
  stageHistory: { stage: string; enteredAt: number }[];
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  pending: "Workflow is queued and waiting to start",
  solving: "Solver agent is implementing the task",
  reviewing: "Reviewer agent is designing independent test criteria",
  executing: "Executor agent is verifying the implementation against the test plan",
  "self-fixing": "Executor is attempting a self-diagnosis and minimal fix before escalating to solver",
  feedback: "Tests failed — preparing feedback for solver before next iteration",
  complete: "All tests passed — workflow completed successfully",
  failed: "Workflow failed — check error details",
  paused: "Workflow is paused — can be resumed from the Penpal dashboard",
};

function loadWorkflows(): PodWorkflow[] {
  const filePath = fs.existsSync(POD_WORKFLOWS_PATH)
    ? POD_WORKFLOWS_PATH
    : fs.existsSync(LEGACY_PATH)
      ? LEGACY_PATH
      : null;

  if (!filePath) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw;
  } catch {
    return [];
  }
}

function estimateCompletion(wf: PodWorkflow): string | null {
  if (wf.status === "complete" || wf.status === "failed") return null;

  const history = wf.stageHistory || [];
  if (history.length < 2) return "Insufficient data for estimate";

  // Calculate average stage duration from history
  const durations: number[] = [];
  for (let i = 1; i < history.length; i++) {
    durations.push(history[i].enteredAt - history[i - 1].enteredAt);
  }
  const avgStageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Estimate remaining stages: each iteration has 3 stages (solve, review, execute)
  // First iteration: 3 stages. Subsequent: 2 stages (no re-review)
  const currentStageIndex = history.length;
  const firstIterStages = 3;
  const subsequentIterStages = 2;
  const totalStages =
    firstIterStages + (wf.maxIterations - 1) * subsequentIterStages;
  const remainingStages = Math.max(0, totalStages - currentStageIndex);

  const remainingMs = remainingStages * avgStageDuration;
  const remainingMins = Math.round(remainingMs / 60_000);

  if (remainingMins < 1) return "Less than a minute";
  if (remainingMins < 60) return `~${remainingMins} minutes`;
  return `~${Math.round(remainingMins / 60)} hours`;
}

export async function podsStatus(args: {
  workflowId: string;
}): Promise<string> {
  const all = loadWorkflows();
  const wf = all.find((w) => w.id === args.workflowId);

  if (!wf) {
    const available = all.slice(0, 10).map((w) => `${w.id} (${w.status})`);
    return JSON.stringify(
      {
        error: `Workflow not found: ${args.workflowId}`,
        available_workflows: available,
        suggestions: [
          "Use pods_list to see all available workflows",
          "Check the workflowId — it should look like pod-<timestamp>-<number>",
        ],
        related_tools: ["pods_list"],
      },
      null,
      2,
    );
  }

  const elapsed = wf.updatedAt - wf.createdAt;
  const elapsedMins = Math.round(elapsed / 60_000);

  const result = {
    workflow: {
      id: wf.id,
      name: wf.name,
      status: wf.status,
      task: wf.task,
      cwd: wf.cwd,
      iteration: wf.iteration,
      maxIterations: wf.maxIterations,
      selfFixAttempts: wf.selfFixAttempts ?? 0,
      maxSelfFixes: wf.maxSelfFixes ?? 0,
      createdAt: new Date(wf.createdAt).toISOString(),
      updatedAt: new Date(wf.updatedAt).toISOString(),
      ...(wf.error ? { error: wf.error } : {}),
    },
    roles: {
      solver: {
        agentId: wf.solver.agentId,
        status: wf.solver.status,
        ...(wf.solver.output
          ? { output: wf.solver.output.slice(0, 500) }
          : {}),
      },
      reviewer: {
        agentId: wf.reviewer.agentId,
        status: wf.reviewer.status,
        ...(wf.reviewer.output
          ? { output: wf.reviewer.output.slice(0, 500) }
          : {}),
      },
      executor: {
        agentId: wf.executor.agentId,
        status: wf.executor.status,
        ...(wf.executor.output
          ? { output: wf.executor.output.slice(0, 500) }
          : {}),
      },
    },
    artifacts: wf.artifacts || [],
    stageHistory: (wf.stageHistory || []).map((s) => ({
      stage: s.stage,
      enteredAt: new Date(s.enteredAt).toISOString(),
    })),
    _meta: {
      currentPhase: PHASE_DESCRIPTIONS[wf.status] || `Unknown phase: ${wf.status}`,
      elapsedTime:
        elapsedMins < 60
          ? `${elapsedMins} minutes`
          : `${Math.round(elapsedMins / 60)} hours`,
      estimatedCompletion: estimateCompletion(wf),
    },
    suggestions: [
      ...(wf.status === "paused"
        ? ["Workflow is paused — resume it from the Penpal dashboard"]
        : []),
      ...(["solving", "reviewing", "executing", "self-fixing"].includes(wf.status)
        ? ["Workflow is in progress — check back for updates"]
        : []),
      ...(wf.status === "complete"
        ? ["Workflow completed successfully — review solver output for implementation details"]
        : []),
      ...(wf.status === "failed"
        ? ["Check the error field and executor output for failure details"]
        : []),
      "Use pods_list to see all workflows",
    ],
    related_tools: ["pods_list", "pods_create"],
  };

  return JSON.stringify(result, null, 2);
}
