/**
 * office-types.ts — Shared types and reader for the game-state.json snapshot
 * written by Penny's main process.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, "..", "..", "..", "data", "game-state.json");
// ── Reader ──────────────────────────────────────────────────────────────────
const STALE_THRESHOLD_MS = 60_000; // 1 minute
export function readGameState() {
    try {
        if (!fs.existsSync(SNAPSHOT_PATH)) {
            return { snapshot: null, error: "Game state snapshot not found. Is Penny running? The Electron app writes this file every 5 seconds.", stale: false };
        }
        const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
        const snapshot = JSON.parse(raw);
        const age = Date.now() - snapshot.timestamp;
        const stale = age > STALE_THRESHOLD_MS;
        return { snapshot, error: null, stale };
    }
    catch (err) {
        return { snapshot: null, error: `Failed to read game state: ${err instanceof Error ? err.message : String(err)}`, stale: false };
    }
}
