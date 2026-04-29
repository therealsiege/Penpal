import path from "path";
import { execFile } from "child_process";
import { config, resolveVenture } from "../../shared/config.js";
import { extractTags } from "./vault-helpers.js";
import fs from "fs";

export const vaultSearchSchema = {
  name: "vault_search",
  description:
    "Search the Obsidian vault for files matching a query. Returns ranked results with snippets, tag context, and folder hierarchy.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query (plain text, case-insensitive)",
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default 20)",
      },
      venture: {
        type: "string",
        description: "Filter by venture: openloop, 1putt. Omit for all.",
      },
    },
    required: ["query"],
  },
};

interface SearchResult {
  path: string;
  snippet: string;
  line: number;
  score: number;
  tags: string[];
  folder: string[];
}

export async function vaultSearch(args: {
  query: string;
  limit?: number;
  venture?: string;
}): Promise<string> {
  const query = args.query?.trim();
  if (!query) throw new Error("Query must not be empty");

  const limit = Math.min(args.limit || 20, 100);

  // Sanitize: allow word chars, spaces, hyphens, dots, underscores
  const sanitized = query.replace(/[^\w\s\-_.]/g, "").trim();
  if (!sanitized) throw new Error("Query contains no searchable characters");

  let results = await grepSearch(sanitized, args.venture ? limit * 3 : limit);

  // Filter by venture if specified
  if (args.venture) {
    results = results.filter((r) => resolveVenture(r.path) === args.venture).slice(0, limit);
  }

  return JSON.stringify(results);
}

function grepSearch(query: string, limit: number): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    // First pass: find matching files
    const args = [
      "-rn",
      "-i",
      "--max-count",
      "1",
      "--exclude-dir=.git",
      "--exclude-dir=node_modules",
      "--exclude-dir=.obsidian",
      "--exclude-dir=.trash",
      "--exclude-dir=out",
      "--exclude-dir=build",
      "--include",
      "*.md",
      "--",
      query,
      config.vaultPath,
    ];

    execFile(
      "grep",
      args,
      { maxBuffer: 2 * 1024 * 1024, timeout: 15000 },
      (err, stdout) => {
        if (err && !stdout) {
          resolve([]);
          return;
        }

        const results: SearchResult[] = [];
        const lines = stdout.trim().split("\n").filter(Boolean).slice(0, limit);

        for (const line of lines) {
          // Format: /path/to/file:linenum:text
          const firstColon = line.indexOf(":");
          const secondColon = line.indexOf(":", firstColon + 1);
          if (firstColon < 0 || secondColon < 0) continue;

          const filePath = line.slice(0, firstColon);
          const lineNum = parseInt(line.slice(firstColon + 1, secondColon), 10);
          const text = line.slice(secondColon + 1).trim().slice(0, 200);
          const relPath = path.relative(config.vaultPath, filePath);

          // Folder hierarchy
          const folder = path.dirname(relPath).split(path.sep).filter(Boolean);

          // Extract tags from file header
          let tags: string[] = [];
          try {
            const header = fs.readFileSync(filePath, "utf-8").slice(0, 1500);
            tags = extractTags(header);
          } catch {
            /* skip */
          }

          // Simple relevance score: filename match > content match
          const nameMatch = path.basename(relPath).toLowerCase().includes(query.toLowerCase())
            ? 2
            : 0;
          const score = 1 + nameMatch;

          results.push({
            path: relPath,
            snippet: text,
            line: lineNum,
            score,
            tags,
            folder,
          });
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        resolve(results);
      },
    );
  });
}
