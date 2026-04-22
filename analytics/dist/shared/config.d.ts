export interface VentureConfig {
    name: string;
    enabled: boolean;
    directories: string[];
    crmCsvPath?: string;
    referencesCsvPaths?: string[];
}
export declare const ventures: Record<string, VentureConfig>;
export declare const config: {
    readonly vaultPath: string;
    readonly memgraphUri: string;
    readonly memgraphUser: string;
    readonly memgraphPassword: string;
    readonly batchSize: 100;
    readonly skipDirs: readonly [".obsidian", ".trash", "node_modules", "game-assets"];
    readonly ventures: Record<string, VentureConfig>;
    readonly qdrantUrl: string;
    readonly openaiApiKey: string;
    readonly embeddingModel: "text-embedding-3-small";
    readonly embeddingDimensions: 1536;
    readonly anthropicApiKey: string;
    readonly firecrawlApiKey: string;
    readonly embeddingCachePath: string;
    readonly extractionCachePath: string;
    readonly npiFilePath: string;
    readonly npiCachePath: string;
    readonly npiApiBaseUrl: "https://npiregistry.cms.hhs.gov/api/";
    readonly braveApiKey: string;
    readonly webIntelPath: string;
    readonly llmExtractionDocTypes: readonly ["competitor", "engineering", "integration", "product", "skill", "reference", "general"];
};
export declare function resolveVaultPath(relativePath: string): string;
/** Get enabled ventures, optionally filtered by CLI --venture flag */
export declare function getActiveVentures(filterKeys?: string[]): VentureConfig[];
/** Get the flat list of all included directories across active ventures */
export declare function getActiveDirectories(filterKeys?: string[]): string[];
/** Check if a file path belongs to any active venture directory */
export declare function isInActiveVenture(relPath: string, filterKeys?: string[]): boolean;
/** Resolve a relative file path to its venture key */
export declare function resolveVenture(relPath: string): string;
