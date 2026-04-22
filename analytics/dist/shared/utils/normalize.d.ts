/** Normalize a name for matching: lowercase, trim, collapse whitespace */
export declare function normalizeName(name: string): string;
/** Normalize a tag: lowercase, trim, strip # prefix */
export declare function normalizeTag(tag: string): string;
/** Strip emoji prefixes like 🔥, 🔵, 🟢 from values */
export declare function stripEmoji(value: string): string;
