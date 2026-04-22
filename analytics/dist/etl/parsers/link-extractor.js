import path from "path";
import fs from "fs";
import { config } from "../../shared/config.js";
// Lazy-initialized filename index for Obsidian-style "shortest path" resolution
let filenameIndex = null;
/** Build an index mapping lowercase filename (without .md) → relative path */
export function buildFilenameIndex(allRelPaths) {
    filenameIndex = new Map();
    for (const relPath of allRelPaths) {
        const basename = path.basename(relPath, ".md").toLowerCase();
        // If there are duplicates, first wins (could be refined)
        if (!filenameIndex.has(basename)) {
            filenameIndex.set(basename, relPath);
        }
    }
}
function resolveByFilename(targetName) {
    if (!filenameIndex)
        return null;
    let name = targetName;
    if (name.endsWith(".md"))
        name = name.slice(0, -3);
    name = decodeURIComponent(name).toLowerCase();
    return filenameIndex.get(name) || null;
}
export function extractLinks(content, sourceRelativePath) {
    const internal = [];
    const external = [];
    // Match markdown links: [text](target)
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const text = match[1];
        const target = match[2];
        if (target.startsWith("http://") || target.startsWith("https://")) {
            external.push({ text, url: target });
        }
        else if (target.endsWith(".md") || !target.includes("://")) {
            // Internal link — first try relative resolution
            const sourceDir = path.dirname(path.join(config.vaultPath, sourceRelativePath));
            let resolvedTarget = target;
            if (!resolvedTarget.endsWith(".md")) {
                resolvedTarget += ".md";
            }
            resolvedTarget = decodeURIComponent(resolvedTarget);
            const absoluteTarget = path.resolve(sourceDir, resolvedTarget);
            if (fs.existsSync(absoluteTarget)) {
                const relativeTarget = path.relative(config.vaultPath, absoluteTarget);
                internal.push({ text, target: relativeTarget });
            }
            else {
                // Fallback: vault-wide filename search (Obsidian style)
                const resolved = resolveByFilename(target);
                if (resolved) {
                    internal.push({ text, target: resolved });
                }
            }
        }
    }
    // Also match Obsidian wiki-links: [[target]] or [[target|display]]
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
        const target = match[1].trim();
        const text = match[2]?.trim() || target;
        // Try relative first
        const sourceDir = path.dirname(path.join(config.vaultPath, sourceRelativePath));
        const targetFile = target.endsWith(".md") ? target : `${target}.md`;
        const absoluteTarget = path.resolve(sourceDir, decodeURIComponent(targetFile));
        if (fs.existsSync(absoluteTarget)) {
            const relativeTarget = path.relative(config.vaultPath, absoluteTarget);
            internal.push({ text, target: relativeTarget });
        }
        else {
            // Fallback: vault-wide filename search
            const resolved = resolveByFilename(target);
            if (resolved) {
                internal.push({ text, target: resolved });
            }
        }
    }
    return { internal, external };
}
