import { getOpenAI } from "../../shared/connections.js";
import { config } from "../../shared/config.js";
import { EmbeddingCache } from "./embedding-cache.js";

const BATCH_SIZE = 100;
const MODEL = "text-embedding-3-small";

export interface EmbeddingResult {
  key: string;
  embedding: number[];
  cached: boolean;
}

/** Generate embeddings for a batch of texts, using cache when available */
export async function generateEmbeddings(
  items: { key: string; text: string }[],
  cache: EmbeddingCache,
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const toEmbed: { key: string; text: string; contentHash: string; index: number }[] = [];

  // Check cache first
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const contentHash = EmbeddingCache.contentHash(item.text);
    const cached = cache.get(item.key, contentHash);

    if (cached) {
      results.push({ key: item.key, embedding: cached, cached: true });
    } else {
      toEmbed.push({ ...item, contentHash, index: i });
    }
  }

  if (toEmbed.length === 0) {
    return results;
  }

  // Batch embed uncached items
  const openai = getOpenAI();
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map((b) => b.text);

    const response = await openai.embeddings.create({
      model: MODEL,
      input: texts,
    });

    for (let j = 0; j < response.data.length; j++) {
      const embedding = response.data[j].embedding;
      const item = batch[j];
      cache.set(item.key, item.contentHash, embedding);
      results.push({ key: item.key, embedding, cached: false });
    }

    if (i + BATCH_SIZE < toEmbed.length) {
      // Brief pause between batches to avoid rate limits
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}

/** Generate a single embedding (convenience wrapper) */
export async function generateEmbedding(
  text: string,
  cache: EmbeddingCache,
  key: string,
): Promise<number[]> {
  const results = await generateEmbeddings([{ key, text }], cache);
  return results[0].embedding;
}
