/**
 * Penny Scheduler Runner
 *
 * Reads schedule.yaml, checks what's due, and executes jobs.
 * Designed to be invoked every minute by a single crontab entry:
 *
 *   * * * * * cd "$HOME/sidekick/analytics" && ./node_modules/.bin/tsx src/scheduler/runner.ts >> logs/scheduler.log 2>&1
 *
 * Can also be run manually:
 *   npm run scheduler          # check & run what's due
 *   npm run scheduler:status   # show job status
 *   npm run scheduler:run -- --job rss-ingest   # force-run a specific job
 *
 * Exports functions for future Electron dashboard integration.
 */

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { isDue, nextCronMatch } from "./cron.js";
import type { JobDefinition, ScheduleFile, JobRun, SchedulerState } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SCHEDULE_PATH = path.join(PROJECT_ROOT, "schedule.yaml");
const STATE_PATH = path.join(PROJECT_ROOT, "data", "scheduler-state.json");
const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
const HISTORY_CAP = 200;

// ─── YAML Parser (minimal, no dependency) ──────────────────────────────────

function parseYaml(text: string): ScheduleFile {
  const jobs: Record<string, JobDefinition> = {};
  let currentJob: string | null = null;
  let currentDef: Partial<JobDefinition> = {};
  let inDependsOn = false;
  const dependsList: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, ""); // strip comments
    if (!line.trim()) continue;

    // Top-level "jobs:" key
    if (line.match(/^jobs:\s*$/)) continue;

    // Job name (2-space indent)
    const jobMatch = line.match(/^  ([a-z0-9_-]+):\s*$/);
    if (jobMatch) {
      // Save previous job
      if (currentJob && currentDef.command) {
        if (dependsList.length > 0) currentDef.depends_on = [...dependsList];
        jobs[currentJob] = currentDef as JobDefinition;
      }
      currentJob = jobMatch[1];
      currentDef = { enabled: true, timeout: 120 };
      inDependsOn = false;
      dependsList.length = 0;
      continue;
    }

    // Job properties (4-space indent)
    const propMatch = line.match(/^\s{4}([a-z_]+):\s*(.+)$/);
    if (propMatch && currentJob) {
      inDependsOn = false;
      const [, key, rawVal] = propMatch;
      const val = rawVal.replace(/^["']|["']$/g, "").trim();

      switch (key) {
        case "description": currentDef.description = val; break;
        case "command": currentDef.command = val; break;
        case "cron": currentDef.cron = val; break;
        case "timeout": currentDef.timeout = parseInt(val, 10); break;
        case "enabled": currentDef.enabled = val === "true"; break;
        case "depends_on":
          inDependsOn = true;
          break;
      }
      continue;
    }

    // depends_on list start
    if (line.match(/^\s{4}depends_on:\s*$/) && currentJob) {
      inDependsOn = true;
      continue;
    }

    // depends_on list items (6-space indent with -)
    const listMatch = line.match(/^\s{6}-\s*(.+)$/);
    if (listMatch && inDependsOn) {
      dependsList.push(listMatch[1].trim());
      continue;
    }
  }

  // Save last job
  if (currentJob && currentDef.command) {
    if (dependsList.length > 0) currentDef.depends_on = [...dependsList];
    jobs[currentJob] = currentDef as JobDefinition;
  }

  return { jobs };
}

// ─── State Management ──────────────────────────────────────────────────────

export function loadState(): SchedulerState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    }
  } catch { /* corrupted — start fresh */ }
  return { last_run: {}, history: [] };
}

export function saveState(state: SchedulerState): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Cap history
  if (state.history.length > HISTORY_CAP) {
    state.history = state.history.slice(-HISTORY_CAP);
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Schedule Loading ──────────────────────────────────────────────────────

export function loadSchedule(): ScheduleFile {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    throw new Error(`Schedule file not found: ${SCHEDULE_PATH}`);
  }
  const text = fs.readFileSync(SCHEDULE_PATH, "utf-8");
  return parseYaml(text);
}

// ─── Job Execution ─────────────────────────────────────────────────────────

export function executeJob(jobName: string, job: JobDefinition): JobRun {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

  const logFile = path.join(LOGS_DIR, `${jobName}.log`);

  try {
    const output = execSync(job.command, {
      cwd: PROJECT_ROOT,
      timeout: job.timeout * 1000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const finishedAt = new Date().toISOString();
    const run: JobRun = {
      job: jobName,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: Date.now() - start,
      exit_code: 0,
      success: true,
      stdout_tail: tail(output, 50),
      stderr_tail: "",
    };

    // Append to job-specific log
    fs.appendFileSync(logFile, `\n--- ${startedAt} (OK, ${run.duration_ms}ms) ---\n${output}\n`);
    return run;
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const execErr = err as { stdout?: string; stderr?: string; status?: number; message?: string };

    const run: JobRun = {
      job: jobName,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: Date.now() - start,
      exit_code: execErr.status ?? 1,
      success: false,
      stdout_tail: tail(execErr.stdout || "", 50),
      stderr_tail: tail(execErr.stderr || execErr.message || "", 50),
    };

    fs.appendFileSync(logFile, `\n--- ${startedAt} (FAIL, exit ${run.exit_code}, ${run.duration_ms}ms) ---\n${execErr.stdout || ""}\n${execErr.stderr || ""}\n`);
    return run;
  }
}

function tail(text: string, lines: number): string {
  const allLines = text.split("\n");
  return allLines.slice(-lines).join("\n").trim();
}

// ─── Dependency Resolution ─────────────────────────────────────────────────

function dependenciesMet(job: JobDefinition, state: SchedulerState, now: Date): boolean {
  if (!job.depends_on || job.depends_on.length === 0) return true;

  for (const dep of job.depends_on) {
    const lastRun = state.last_run[dep];
    if (!lastRun) return false;

    // Dependency must have run today (same calendar day)
    const lastDate = new Date(lastRun);
    if (
      lastDate.getFullYear() !== now.getFullYear() ||
      lastDate.getMonth() !== now.getMonth() ||
      lastDate.getDate() !== now.getDate()
    ) {
      return false;
    }
  }

  return true;
}

// ─── Public API (for Electron dashboard) ───────────────────────────────────

export interface JobStatus {
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  last_run: string | null;
  last_success: boolean | null;
  next_run: string;
  depends_on: string[];
}

export function getJobStatuses(): JobStatus[] {
  const schedule = loadSchedule();
  const state = loadState();
  const now = new Date();

  return Object.entries(schedule.jobs).map(([name, job]) => {
    const lastRunTime = state.last_run[name] || null;
    const lastResult = state.history.filter((h) => h.job === name).pop();

    let nextRun: string;
    try {
      nextRun = nextCronMatch(job.cron, now).toISOString();
    } catch {
      nextRun = "unknown";
    }

    return {
      name,
      description: job.description,
      cron: job.cron,
      enabled: job.enabled,
      last_run: lastRunTime,
      last_success: lastResult?.success ?? null,
      next_run: nextRun,
      depends_on: job.depends_on || [],
    };
  });
}

export function getJobHistory(jobName?: string, limit = 20): JobRun[] {
  const state = loadState();
  const runs = jobName
    ? state.history.filter((h) => h.job === jobName)
    : state.history;
  return runs.slice(-limit);
}

export function forceRunJob(jobName: string): JobRun {
  const schedule = loadSchedule();
  const job = schedule.jobs[jobName];
  if (!job) throw new Error(`Unknown job: ${jobName}`);

  const state = loadState();
  const run = executeJob(jobName, job);
  state.last_run[jobName] = run.started_at;
  state.history.push(run);
  saveState(state);
  return run;
}

// ─── Main: Tick ────────────────────────────────────────────────────────────

export function tick(): JobRun[] {
  const schedule = loadSchedule();
  const state = loadState();
  const now = new Date();
  const runs: JobRun[] = [];

  for (const [name, job] of Object.entries(schedule.jobs)) {
    if (!job.enabled) continue;
    if (!isDue(job.cron, now, state.last_run[name])) continue;
    if (!dependenciesMet(job, state, now)) {
      console.log(`[${now.toISOString()}] SKIP ${name} — dependencies not met`);
      continue;
    }

    console.log(`[${now.toISOString()}] RUN  ${name} — "${job.command}"`);
    const run = executeJob(name, job);
    state.last_run[name] = run.started_at;
    state.history.push(run);

    const statusLabel = run.success ? "OK" : "FAIL";
    console.log(`[${new Date().toISOString()}] ${statusLabel} ${name} (${run.duration_ms}ms)`);

    runs.push(run);
  }

  saveState(state);
  return runs;
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function printStatus() {
  const statuses = getJobStatuses();

  console.log("\nPenny Scheduler Status");
  console.log("=".repeat(70));

  for (const s of statuses) {
    const icon = !s.enabled ? "  " : s.last_success === null ? "--" : s.last_success ? "OK" : "!!";
    const lastStr = s.last_run
      ? new Date(s.last_run).toLocaleString()
      : "never";
    const nextStr = s.next_run !== "unknown"
      ? new Date(s.next_run).toLocaleString()
      : "unknown";

    console.log(`\n  [${icon}] ${s.name}${s.enabled ? "" : " (disabled)"}`);
    console.log(`       ${s.description}`);
    console.log(`       Cron: ${s.cron}  |  Last: ${lastStr}  |  Next: ${nextStr}`);
    if (s.depends_on.length > 0) {
      console.log(`       Depends on: ${s.depends_on.join(", ")}`);
    }
  }
  console.log();
}

function printHistory() {
  const jobFilter = process.argv.includes("--job")
    ? process.argv[process.argv.indexOf("--job") + 1]
    : undefined;
  const history = getJobHistory(jobFilter, 20);

  console.log(`\nRecent Runs${jobFilter ? ` (${jobFilter})` : ""}`);
  console.log("-".repeat(70));

  if (history.length === 0) {
    console.log("  No runs recorded yet.");
    return;
  }

  for (const run of history) {
    const icon = run.success ? "OK" : "!!";
    const dur = run.duration_ms < 1000
      ? `${run.duration_ms}ms`
      : `${(run.duration_ms / 1000).toFixed(1)}s`;
    console.log(`  [${icon}] ${run.job}  ${new Date(run.started_at).toLocaleString()}  (${dur})`);
    if (!run.success && run.stderr_tail) {
      console.log(`       ${run.stderr_tail.split("\n")[0]}`);
    }
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    printStatus();
    printHistory();
    return;
  }

  if (args.includes("--run")) {
    const jobIdx = args.indexOf("--job");
    const jobName = jobIdx !== -1 ? args[jobIdx + 1] : null;
    if (!jobName) {
      console.error("Usage: --run --job <job-name>");
      process.exit(1);
    }
    console.log(`Force-running: ${jobName}`);
    const run = forceRunJob(jobName);
    console.log(`Result: ${run.success ? "OK" : "FAIL"} (${run.duration_ms}ms)`);
    if (!run.success) {
      console.log(run.stderr_tail);
      process.exit(1);
    }
    return;
  }

  if (args.includes("--history")) {
    printHistory();
    return;
  }

  // Default: tick (check what's due and run it)
  const runs = tick();
  if (runs.length === 0) {
    // Only log when something notable happens to keep cron logs clean
    // Uncomment for debugging: console.log(`[${new Date().toISOString()}] No jobs due`);
  }
}

main().catch((err) => {
  console.error("Scheduler error:", err);
  process.exit(1);
});
