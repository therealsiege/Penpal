import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the Penny data directory relative to analytics/src/mcp/tools/
const POD_WORKFLOWS_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "Penny",
  "data",
  "pod-workflows.json",
);

// Legacy fallback path
const LEGACY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "Penny",
  "data",
  "triplet-workflows.json",
);

export const podsListSchema = {
  name: "pods_list",
  description:
    "List all pod workflows. Returns workflows grouped by status with summary counts. Filter by status: active (pending/solving/reviewing/executing/feedback/paused), complete, or failed.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        description:
          'Filter by workflow status group: "active", "complete", or "failed". Omit for all workflows.',
        enum: ["active", "complete", "failed"],
      },
    },
    required: [],
  },
};

interface PodWorkflowSummary {
  id: string;
  name: string;
  status: string;
  task: string;
  iteration: number;
  maxIterations: number;
  createdAt: number;
  updatedAt: number;
  solver: string;
  reviewer: string;
  executor: string;
  error?: string;
}

const ACTIVE_STATUSES = new Set([
  "pending",
  "solving",
  "reviewing",
  "executing",
  "self-fixing",
  "feedback",
  "paused",
]);

function loadWorkflows(): PodWorkflowSummary[] {
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

export async function podsList(args: { status?: string }): Promise<string> {
  const all = loadWorkflows();

  // Filter by status group
  let filtered = all;
  if (args.status === "active") {
    filtered = all.filter((w) => ACTIVE_STATUSES.has(w.status));
  } else if (args.status === "complete") {
    filtered = all.filter((w) => w.status === "complete");
  } else if (args.status === "failed") {
    filtered = all.filter((w) => w.status === "failed");
  }

  // Sort by most recently updated
  filtered.sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );

  // Build status counts
  const statusCounts: Record<string, number> = {};
  for (const w of all) {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  }

  const workflows = filtered.map((w) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    task: w.task?.slice(0, 200),
    iteration: w.iteration,
    maxIterations: w.maxIterations,
    solver: w.solver,
    reviewer: w.reviewer,
    executor: w.executor,
    createdAt: w.createdAt ? new Date(w.createdAt).toISOString() : null,
    updatedAt: w.updatedAt ? new Date(w.updatedAt).toISOString() : null,
    ...(w.error ? { error: w.error } : {}),
  }));

  const result = {
    summary: {
      total: all.length,
      filtered: filtered.length,
      byStatus: statusCounts,
    },
    workflows,
    suggestions: [
      "Use pods_status with a workflowId for detailed phase info",
      "Use pods_create to start a new pod workflow",
      ...(statusCounts["paused"]
        ? ["Some workflows are paused — they can be resumed from the Penny dashboard"]
        : []),
    ],
    related_tools: ["pods_create", "pods_status"],
  };

  return JSON.stringify(result, null, 2);
}
