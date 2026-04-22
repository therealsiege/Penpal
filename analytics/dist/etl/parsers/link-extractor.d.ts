export interface InternalLink {
    text: string;
    target: string;
}
export interface ExternalLink {
    text: string;
    url: string;
}
export interface ExtractedLinks {
    internal: InternalLink[];
    external: ExternalLink[];
}
/** Build an index mapping lowercase filename (without .md) → relative path */
export declare function buildFilenameIndex(allRelPaths: string[]): void;
export declare function extractLinks(content: string, sourceRelativePath: string): ExtractedLinks;
