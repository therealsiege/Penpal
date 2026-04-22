import { EmbeddingCache } from "./embedding-cache.js";
export interface EmbeddingResult {
    key: string;
    embedding: number[];
    cached: boolean;
}
/** Generate embeddings for a batch of texts, using cache when available */
export declare function generateEmbeddings(items: {
    key: string;
    text: string;
}[], cache: EmbeddingCache): Promise<EmbeddingResult[]>;
/** Generate a single embedding (convenience wrapper) */
export declare function generateEmbedding(text: string, cache: EmbeddingCache, key: string): Promise<number[]>;
