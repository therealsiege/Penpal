import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PENNY_DIR = path.resolve(__dirname, "..", "..", "..", "..", "Penny");
// Read presets from YAML to validate and suggest
const PRESETS_PATH = path.resolve(PENNY_DIR, "agents", "agent-types.yaml");
export const podsCreateSchema = {
    name: "pods_create",
    description: "Create a new pod workflow. A pod is a 3-agent team (Solver/Reviewer/Executor) that implements, reviews, and tests a task with feedback loops. Optionally specify a preset team configuration.",
    inputSchema: {
        type: "object",
        properties: {
            task: {
                type: "string",
                description: "The task description for the pod to implement",
            },
            preset: {
                type: "string",
                description: 'Team preset ID (e.g., "frontend-feature", "backend-feature", "full-stack", "content-pipeline"). Omit for default team.',
            },
            cwd: {
                type: "string",
                description: "Working directory for the pod. Defaults to the solver agent's default repo.",
            },
            priority: {
                type: "string",
                enum: ["critical", "high", "normal", "low"],
                description: 'Task priority level. Controls compute allocation: critical gets best-of-3 sampling, normal gets single-shot. Defaults to "normal".',
            },
            candidates: {
                type: "number",
                description: "Number of solver candidates to generate (best-of-N sampling). Overrides the priority-based default. Higher values improve quality at the cost of more compute.",
            },
            maxSelfFixes: {
                type: "number",
                description: "Max self-fix attempts the executor can make before escalating to solver. Overrides the priority-based default. 0 = no self-fixes (immediate escalation).",
            },
        },
        required: ["task"],
    },
};
function loadPresets() {
    try {
        if (!fs.existsSync(PRESETS_PATH))
            return [];
        const raw = fs.readFileSync(PRESETS_PATH, "utf-8");
        // Simple YAML parsing for pod_presets section — avoid adding yaml dependency
        const match = raw.match(/pod_presets:\n([\s\S]*?)(?:\n\S|\n*$)/);
        if (!match)
            return [];
        const presets = [];
        const block = match[1];
        const presetBlocks = block.split(/\n  (?=\S)/);
        for (const pb of presetBlocks) {
            const lines = pb.trim().split("\n");
            if (!lines[0])
                continue;
            const id = lines[0].replace(":", "").trim();
            const get = (key) => {
                const line = lines.find((l) => l.trim().startsWith(`${key}:`));
                return line
                    ? line
                        .split(":")[1]
                        .trim()
                        .replace(/^["']|["']$/g, "")
                    : "";
            };
            presets.push({
                id,
                solver: get("solver"),
                reviewer: get("reviewer"),
                executor: get("executor"),
                description: get("description"),
            });
        }
        return presets;
    }
    catch {
        return [];
    }
}
export async function podsCreate(args) {
    const presets = loadPresets();
    // Validate preset if provided
    if (args.preset) {
        const valid = presets.find((p) => p.id === args.preset);
        if (!valid) {
            return JSON.stringify({
                error: `Unknown preset: ${args.preset}`,
                available_presets: presets.map((p) => ({
                    id: p.id,
                    description: p.description,
                    team: `${p.solver} / ${p.reviewer} / ${p.executor}`,
                })),
                suggestions: [
                    "Choose from the available presets above",
                    "Omit the preset parameter to use the default team (fullstack-dev / backend-arch / electron-dev)",
                ],
                related_tools: ["pods_list", "pods_status"],
            }, null, 2);
        }
    }
    // Shell out to pod-cli.ts in the Penny directory
    const cliScript = path.resolve(PENNY_DIR, "src", "main", "pod-cli.ts");
    if (!fs.existsSync(cliScript)) {
        return JSON.stringify({
            error: "Pod CLI script not found. Ensure Penny/src/main/pod-cli.ts exists.",
            related_tools: ["pods_list", "pods_status"],
        }, null, 2);
    }
    const cliArgs = ["--import", "tsx", cliScript, "--task", args.task];
    if (args.preset)
        cliArgs.push("--preset", args.preset);
    if (args.cwd)
        cliArgs.push("--cwd", args.cwd);
    if (args.priority)
        cliArgs.push("--priority", args.priority);
    if (args.candidates && args.candidates > 0)
        cliArgs.push("--candidates", String(args.candidates));
    if (args.maxSelfFixes != null)
        cliArgs.push("--max-self-fixes", String(args.maxSelfFixes));
    return new Promise((resolve) => {
        execFile("node", cliArgs, {
            cwd: PENNY_DIR,
            timeout: 30_000,
            env: { ...process.env, NODE_NO_WARNINGS: "1" },
        }, (error, stdout, stderr) => {
            if (error) {
                resolve(JSON.stringify({
                    error: `Failed to create pod: ${error.message}`,
                    stderr: stderr?.slice(0, 500),
                    suggestions: [
                        "Check that the Penny app dependencies are installed (cd Penny && npm install)",
                        "Verify the preset and agent configurations in agents/agent-types.yaml",
                    ],
                    related_tools: ["pods_list", "pods_status"],
                }, null, 2));
                return;
            }
            try {
                const workflow = JSON.parse(stdout.trim());
                const preset = args.preset
                    ? presets.find((p) => p.id === args.preset)
                    : null;
                resolve(JSON.stringify({
                    workflow: {
                        id: workflow.id,
                        name: workflow.name,
                        status: workflow.status,
                        task: workflow.task,
                        cwd: workflow.cwd,
                        team: {
                            solver: workflow.solver?.agentId,
                            reviewer: workflow.reviewer?.agentId,
                            executor: workflow.executor?.agentId,
                        },
                        iteration: workflow.iteration,
                        maxIterations: workflow.maxIterations,
                        priority: workflow.priority ?? "normal",
                        maxSelfFixes: workflow.maxSelfFixes ?? 0,
                        phaseConfig: workflow.phaseConfig,
                        createdAt: new Date(workflow.createdAt).toISOString(),
                    },
                    _meta: {
                        phase: "Workflow created and solver is starting implementation",
                        ...(preset
                            ? { preset: { id: preset.id, description: preset.description } }
                            : {}),
                    },
                    suggestions: [
                        `Monitor progress with pods_status using workflowId: ${workflow.id}`,
                        "The solver agent will implement the task, then a reviewer designs tests, then an executor verifies",
                        `Maximum ${workflow.maxIterations} iterations with feedback loops`,
                    ],
                    related_tools: ["pods_status", "pods_list"],
                }, null, 2));
            }
            catch {
                resolve(JSON.stringify({
                    error: "Failed to parse pod creation output",
                    raw_output: stdout?.slice(0, 500),
                    related_tools: ["pods_list", "pods_status"],
                }, null, 2));
            }
        });
    });
}
