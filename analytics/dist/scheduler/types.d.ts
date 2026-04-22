export interface JobDefinition {
    description: string;
    command: string;
    cron: string;
    timeout: number;
    enabled: boolean;
    depends_on?: string[];
}
export interface ScheduleFile {
    jobs: Record<string, JobDefinition>;
}
export interface JobRun {
    job: string;
    started_at: string;
    finished_at: string;
    duration_ms: number;
    exit_code: number | null;
    success: boolean;
    stdout_tail: string;
    stderr_tail: string;
}
export interface SchedulerState {
    last_run: Record<string, string>;
    history: JobRun[];
}
export interface HealthResult {
    timestamp: string;
    overall: "healthy" | "degraded" | "down";
    checks: {
        name: string;
        status: "ok" | "fail";
        latency_ms: number;
        message?: string;
    }[];
}
