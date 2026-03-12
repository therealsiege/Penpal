import fs from "fs";
import path from "path";
import { createHash } from "crypto";

interface CacheEntry {
  contentHash: string;
  embedding: number[];
}

interface CacheData {
  version: number;
  entries: Record<string, CacheEntry>;
}

const CACHE_VERSION = 1;

export class EmbeddingCache {
  private data: CacheData;
  private dirty = false;

  constructor(private cachePath: string) {
    this.data = this.load();
  }

  private load(): CacheData {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, "utf-8");
        const parsed = JSON.parse(raw) as CacheData;
        if (parsed.version === CACHE_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Corrupted cache — start fresh
    }
    return { version: CACHE_VERSION, entries: {} };
  }

  save(): void {
    if (!this.dirty) return;
    const dir = path.dirname(this.cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.cachePath, JSON.stringify(this.data));
    this.dirty = false;
  }

  static contentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  get(key: string, contentHash: string): number[] | null {
    const entry = this.data.entries[key];
    if (entry && entry.contentHash === contentHash) {
      return entry.embedding;
    }
    return null;
  }

  set(key: string, contentHash: string, embedding: number[]): void {
    this.data.entries[key] = { contentHash, embedding };
    this.dirty = true;
  }

  get size(): number {
    return Object.keys(this.data.entries).length;
  }
}
