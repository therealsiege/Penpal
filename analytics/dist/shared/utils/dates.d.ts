/**
 * Parse dates in formats:
 * - "February 14, 2026 10:33 PM"
 * - "March 6, 2026"
 * - "February 2026"
 * - "2026-03-06"
 * Returns ISO string or null.
 */
export declare function parseDate(raw: string | undefined): string | null;
