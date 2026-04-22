import fs from "fs";
import path from "path";
import { createHash } from "crypto";
const CACHE_VERSION = 1;
export class EmbeddingCache {
    cachePath;
    data;
    dirty = false;
    constructor(cachePath) {
        this.cachePath = cachePath;
        this.data = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const raw = fs.readFileSync(this.cachePath, "utf-8");
                const parsed = JSON.parse(raw);
                if (parsed.version === CACHE_VERSION) {
                    return parsed;
                }
            }
        }
        catch {
            // Corrupted cache — start fresh
        }
        return { version: CACHE_VERSION, entries: {} };
    }
    save() {
        if (!this.dirty)
            return;
        const dir = path.dirname(this.cachePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.cachePath, JSON.stringify(this.data));
        this.dirty = false;
    }
    static contentHash(content) {
        return createHash("sha256").update(content).digest("hex");
    }
    get(key, contentHash) {
        const entry = this.data.entries[key];
        if (entry && entry.contentHash === contentHash) {
            return entry.embedding;
        }
        return null;
    }
    set(key, contentHash, embedding) {
        this.data.entries[key] = { contentHash, embedding };
        this.dirty = true;
    }
    get size() {
        return Object.keys(this.data.entries).length;
    }
}
