import { createHash } from "crypto";
export function stableId(label, ...parts) {
    const input = [label, ...parts].join("|");
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
