import fs from "fs";
import { validateVaultPath, parseFrontmatter, findBacklinks, listSiblingFiles, } from "./vault-helpers.js";
export const vaultReadSchema = {
    name: "vault_read",
    description: "Read a file from the Obsidian vault. Returns file content, parsed YAML frontmatter, backlinks (files linking to this one), and related files in the same folder.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative path within the vault (e.g. '1Putt/MedScrub KB/Sales/Leads/Acme.md')",
            },
        },
        required: ["path"],
    },
};
export async function vaultRead(args) {
    const fullPath = validateVaultPath(args.path);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${args.path}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        throw new Error(`Path is a directory, not a file: ${args.path}`);
    }
    if (stat.size > 5 * 1024 * 1024) {
        throw new Error(`File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const backlinks = findBacklinks(args.path);
    const relatedFiles = listSiblingFiles(args.path);
    return JSON.stringify({
        path: args.path,
        content,
        frontmatter,
        backlinks,
        relatedFiles: relatedFiles.slice(0, 20),
    });
}
