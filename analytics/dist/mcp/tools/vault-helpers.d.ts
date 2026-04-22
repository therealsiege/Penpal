/** Resolve a relative vault path and validate it stays within the vault root. */
export declare function validateVaultPath(relativePath: string): string;
/** Parse YAML frontmatter from markdown content. */
export declare function parseFrontmatter(content: string): Record<string, unknown>;
/** Find all files that contain a wikilink to the given file. */
export declare function findBacklinks(relativePath: string): {
    title: string;
    path: string;
    snippet: string;
}[];
/** List .md sibling files in the same folder. */
export declare function listSiblingFiles(relativePath: string): string[];
/** Extract tags from frontmatter and inline #tags in file header. */
export declare function extractTags(content: string): string[];
