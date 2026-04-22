export declare class EmbeddingCache {
    private cachePath;
    private data;
    private dirty;
    constructor(cachePath: string);
    private load;
    save(): void;
    static contentHash(content: string): string;
    get(key: string, contentHash: string): number[] | null;
    set(key: string, contentHash: string, embedding: number[]): void;
    get size(): number;
}
