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
import type { JobDefinition, ScheduleFile, JobRun, SchedulerState } from "./types.js";
export declare function loadState(): SchedulerState;
export declare function saveState(state: SchedulerState): void;
export declare function loadSchedule(): ScheduleFile;
export declare function executeJob(jobName: string, job: JobDefinition): JobRun;
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
export declare function getJobStatuses(): JobStatus[];
export declare function getJobHistory(jobName?: string, limit?: number): JobRun[];
export declare function forceRunJob(jobName: string): JobRun;
export declare function tick(): JobRun[];
