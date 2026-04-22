import fs from "fs";
import path from "path";
import { config } from "../../shared/config.js";
const HIDDEN_DIRS = new Set([".obsidian", ".git", ".trash", "node_modules"]);
/** Resolve a relative vault path and validate it stays within the vault root. */
export function validateVaultPath(relativePath) {
    const resolved = path.resolve(config.vaultPath, relativePath);
    if (!resolved.startsWith(config.vaultPath)) {
        throw new Error("Path traversal denied");
    }
    return resolved;
}
/** Parse YAML frontmatter from markdown content. */
export function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const yaml = match[1];
    const result = {};
    for (const line of yaml.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx < 0)
            continue;
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        // Parse arrays (simple inline YAML: [a, b, c])
        if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
            value = value.slice(1, -1).split(",").map((s) => s.trim());
        }
        if (key)
            result[key] = value;
    }
    return result;
}
/** Find all files that contain a wikilink to the given file. */
export function findBacklinks(relativePath) {
    const targetName = path.basename(relativePath, ".md");
    const results = [];
    const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\[\\[${escaped}(\\|[^\\]]*)?\\]\\]`, "i");
    function walk(dir, relDir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            if (HIDDEN_DIRS.has(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            const rel = relDir ? path.join(relDir, entry.name) : entry.name;
            if (entry.isDirectory()) {
                walk(full, rel);
                continue;
            }
            if (!entry.name.endsWith(".md") || rel === relativePath)
                continue;
            try {
                const content = fs.readFileSync(full, "utf-8").slice(0, 5000);
                const match = content.match(regex);
                if (match) {
                    const lineIdx = content.slice(0, match.index).split("\n").length - 1;
                    const lines = content.split("\n");
                    const snippet = lines[lineIdx]?.trim().slice(0, 120) || "";
                    const title = entry.name.replace(/\.md$/, "");
                    results.push({ title, path: rel, snippet });
                }
            }
            catch {
                /* skip unreadable files */
            }
        }
    }
    walk(config.vaultPath, "");
    return results.sort((a, b) => a.title.localeCompare(b.title)).slice(0, 30);
}
/** List .md sibling files in the same folder. */
export function listSiblingFiles(relativePath) {
    const fullPath = validateVaultPath(relativePath);
    const dir = path.dirname(fullPath);
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith(".md") && f !== path.basename(relativePath))
            .map((f) => path.join(path.dirname(relativePath), f));
    }
    catch {
        return [];
    }
}
/** Extract tags from frontmatter and inline #tags in file header. */
export function extractTags(content) {
    const tags = [];
    const fm = parseFrontmatter(content);
    if (Array.isArray(fm.tags)) {
        tags.push(...fm.tags.map(String));
    }
    else if (typeof fm.tags === "string") {
        tags.push(...fm.tags.split(",").map((t) => t.trim()));
    }
    // Scan first 1000 chars for inline #tags
    const header = content.slice(0, 1000);
    const inlineTags = header.match(/#[a-zA-Z][\w/-]*/g);
    if (inlineTags) {
        for (const t of inlineTags) {
            const tag = t.slice(1);
            if (!tags.includes(tag))
                tags.push(tag);
        }
    }
    return tags;
}
