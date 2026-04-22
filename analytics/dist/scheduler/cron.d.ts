/**
 * Minimal cron expression matcher.
 * Supports: numbers, ranges (1-5), steps (x/2), lists (1,3,5), and wildcards (*).
 * Fields: minute hour day-of-month month day-of-week
 */
interface CronFields {
    minute: number[];
    hour: number[];
    dayOfMonth: number[];
    month: number[];
    dayOfWeek: number[];
}
export declare function parseCron(expression: string): CronFields;
/** Check if a cron expression matches the given date (compared at minute precision). */
export declare function cronMatches(expression: string, date: Date): boolean;
/** Get the next matching minute for a cron expression after the given date. */
export declare function nextCronMatch(expression: string, after: Date): Date;
/** Check if a job is due to run: cron matches now AND hasn't run in this minute window. */
export declare function isDue(cronExpr: string, now: Date, lastRun: string | undefined): boolean;
export {};
