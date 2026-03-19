import { getQdrant } from "../../shared/connections.js";
import { config } from "../../shared/config.js";

const EMBEDDING_DIM = 1536;

export const COLLECTIONS = {
  documentChunks: "document_chunks",
  documentSummaries: "document_summaries",
} as const;

export async function ensureCollections(): Promise<void> {
  const qdrant = getQdrant();
  const existing = await qdrant.getCollections();
  const names = new Set(existing.collections.map((c) => c.name));

  if (!names.has(COLLECTIONS.documentChunks)) {
    await qdrant.createCollection(COLLECTIONS.documentChunks, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    // Create payload indexes for filtering
    await qdrant.createPayloadIndex(COLLECTIONS.documentChunks, {
      field_name: "documentType",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTIONS.documentChunks, {
      field_name: "documentPath",
      field_schema: "keyword",
    });
    console.log(`  Created collection: ${COLLECTIONS.documentChunks}`);
  }

  if (!names.has(COLLECTIONS.documentSummaries)) {
    await qdrant.createCollection(COLLECTIONS.documentSummaries, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(COLLECTIONS.documentSummaries, {
      field_name: "documentType",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTIONS.documentSummaries, {
      field_name: "documentPath",
      field_schema: "keyword",
    });
    console.log(`  Created collection: ${COLLECTIONS.documentSummaries}`);
  }
}

export interface ChunkPoint {
  id: string;
  vector: number[];
  payload: {
    documentId: string;
    documentPath: string;
    documentType: string;
    headingPath: string;
    content: string;
    chunkIndex: number;
  };
}

export interface SummaryPoint {
  id: string;
  vector: number[];
  payload: {
    documentId: string;
    documentPath: string;
    documentType: string;
    title: string;
    contentPreview: string;
  };
}

/** Upsert chunk vectors into Qdrant */
export async function upsertChunks(points: ChunkPoint[]): Promise<void> {
  if (points.length === 0) return;
  const qdrant = getQdrant();

  // Qdrant requires numeric or UUID ids — use a hash
  const qdrantPoints = points.map((p) => ({
    id: hashToUuid(p.id),
    vector: p.vector,
    payload: p.payload,
  }));

  // Batch in groups of 100
  for (let i = 0; i < qdrantPoints.length; i += 100) {
    const batch = qdrantPoints.slice(i, i + 100);
    await qdrant.upsert(COLLECTIONS.documentChunks, {
      wait: true,
      points: batch,
    });
  }
}

/** Upsert document summary vectors into Qdrant */
export async function upsertSummaries(points: SummaryPoint[]): Promise<void> {
  if (points.length === 0) return;
  const qdrant = getQdrant();

  const qdrantPoints = points.map((p) => ({
    id: hashToUuid(p.id),
    vector: p.vector,
    payload: p.payload,
  }));

  for (let i = 0; i < qdrantPoints.length; i += 100) {
    const batch = qdrantPoints.slice(i, i + 100);
    await qdrant.upsert(COLLECTIONS.documentSummaries, {
      wait: true,
      points: batch,
    });
  }
}

export interface SearchResult {
  score: number;
  payload: Record<string, unknown>;
}

/** Search for similar chunks */
export async function searchChunks(
  vector: number[],
  limit: number = 10,
  filter?: Record<string, unknown>,
): Promise<SearchResult[]> {
  const qdrant = getQdrant();
  const results = await qdrant.search(COLLECTIONS.documentChunks, {
    vector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });
  return results.map((r) => ({
    score: r.score,
    payload: (r.payload || {}) as Record<string, unknown>,
  }));
}

/** Search for similar documents */
export async function searchSummaries(
  vector: number[],
  limit: number = 10,
  filter?: Record<string, unknown>,
): Promise<SearchResult[]> {
  const qdrant = getQdrant();
  const results = await qdrant.search(COLLECTIONS.documentSummaries, {
    vector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });
  return results.map((r) => ({
    score: r.score,
    payload: (r.payload || {}) as Record<string, unknown>,
  }));
}

/** Convert a hex string ID to a UUID-like format for Qdrant */
function hashToUuid(hexId: string): string {
  // Pad to 32 chars if needed
  const padded = hexId.padEnd(32, "0");
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    padded.slice(12, 16),
    padded.slice(16, 20),
    padded.slice(20, 32),
  ].join("-");
}
