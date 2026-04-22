/**
 * Minimal cron expression matcher.
 * Supports: numbers, ranges (1-5), steps (x/2), lists (1,3,5), and wildcards (*).
 * Fields: minute hour day-of-month month day-of-week
 */
function parseField(field, min, max) {
    const values = new Set();
    for (const part of field.split(",")) {
        if (part === "*") {
            for (let i = min; i <= max; i++)
                values.add(i);
        }
        else if (part.includes("/")) {
            const [range, stepStr] = part.split("/");
            const step = parseInt(stepStr, 10);
            let start = min;
            let end = max;
            if (range !== "*") {
                if (range.includes("-")) {
                    [start, end] = range.split("-").map(Number);
                }
                else {
                    start = parseInt(range, 10);
                }
            }
            for (let i = start; i <= end; i += step)
                values.add(i);
        }
        else if (part.includes("-")) {
            const [start, end] = part.split("-").map(Number);
            for (let i = start; i <= end; i++)
                values.add(i);
        }
        else {
            values.add(parseInt(part, 10));
        }
    }
    return [...values];
}
export function parseCron(expression) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error(`Invalid cron expression: "${expression}" (expected 5 fields)`);
    }
    return {
        minute: parseField(parts[0], 0, 59),
        hour: parseField(parts[1], 0, 23),
        dayOfMonth: parseField(parts[2], 1, 31),
        month: parseField(parts[3], 1, 12),
        dayOfWeek: parseField(parts[4], 0, 6),
    };
}
/** Check if a cron expression matches the given date (compared at minute precision). */
export function cronMatches(expression, date) {
    const fields = parseCron(expression);
    return (fields.minute.includes(date.getMinutes()) &&
        fields.hour.includes(date.getHours()) &&
        fields.dayOfMonth.includes(date.getDate()) &&
        fields.month.includes(date.getMonth() + 1) &&
        fields.dayOfWeek.includes(date.getDay()));
}
/** Get the next matching minute for a cron expression after the given date. */
export function nextCronMatch(expression, after) {
    const candidate = new Date(after);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);
    // Search up to 366 days ahead
    const limit = 366 * 24 * 60;
    for (let i = 0; i < limit; i++) {
        if (cronMatches(expression, candidate))
            return candidate;
        candidate.setMinutes(candidate.getMinutes() + 1);
    }
    throw new Error(`No match found for "${expression}" within 366 days`);
}
/** Check if a job is due to run: cron matches now AND hasn't run in this minute window. */
export function isDue(cronExpr, now, lastRun) {
    if (!cronMatches(cronExpr, now))
        return false;
    if (!lastRun)
        return true;
    // Don't re-run if already ran in this same minute
    const lastRunDate = new Date(lastRun);
    const sameMinute = lastRunDate.getFullYear() === now.getFullYear() &&
        lastRunDate.getMonth() === now.getMonth() &&
        lastRunDate.getDate() === now.getDate() &&
        lastRunDate.getHours() === now.getHours() &&
        lastRunDate.getMinutes() === now.getMinutes();
    return !sameMinute;
}
