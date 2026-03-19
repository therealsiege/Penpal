const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/**
 * Parse dates in formats:
 * - "February 14, 2026 10:33 PM"
 * - "March 6, 2026"
 * - "February 2026"
 * - "2026-03-06"
 * Returns ISO string or null.
 */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // "Month Day, Year Time" or "Month Day, Year" or "Month Year"
  const full = s.match(
    /^(\w+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i
  );
  if (full) {
    const month = MONTH_MAP[full[1].toLowerCase()];
    if (!month) return null;
    const day = full[2].padStart(2, "0");
    let hour = parseInt(full[4] || "0", 10);
    const min = full[5] || "00";
    const ampm = full[6]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${full[3]}-${month}-${day}T${String(hour).padStart(2, "0")}:${min}:00.000Z`;
  }

  // "Month Year" only
  const monthYear = s.match(/^(\w+)\s+(\d{4})$/i);
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1].toLowerCase()];
    if (!month) return null;
    return `${monthYear[2]}-${month}-01T00:00:00.000Z`;
  }

  return null;
}
