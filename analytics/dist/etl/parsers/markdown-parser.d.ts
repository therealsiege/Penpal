export interface ParsedDocument {
    title: string;
    relativePath: string;
    absolutePath: string;
    documentType: string;
    createdAt: string | null;
    updatedAt: string | null;
    tags: string[];
    contentPreview: string;
    wordCount: number;
    rawContent: string;
    metadata: Record<string, string>;
}
export declare function parseMarkdownFile(absolutePath: string): ParsedDocument;
