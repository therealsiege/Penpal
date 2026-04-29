/** Normalize a name for matching: lowercase, trim, collapse whitespace */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Normalize a tag: lowercase, trim, strip # prefix */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/^#/, "").trim();
}

/** Strip emoji prefixes like 🔥, 🔵, 🟢 from values */
export function stripEmoji(value: string): string {
  return value.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/gu, "").trim();
}
