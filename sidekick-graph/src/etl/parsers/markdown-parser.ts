import fs from "fs";
import path from "path";
import { parseDate } from "../../shared/utils/dates.js";
import { normalizeTag, stripEmoji } from "../../shared/utils/normalize.js";
import { config } from "../../shared/config.js";

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

/** Classify document type based on directory path */
function classifyDocType(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.includes("sales/leads/")) return "lead";
  if (lower.includes("engineering/")) return "engineering";
  if (lower.includes("integrations/")) return "integration";
  if (lower.includes("advisors/")) return "advisor";
  if (lower.includes("competitors/")) return "competitor";
  if (lower.includes("product/skills/")) return "skill";
  if (lower.includes("product/")) return "product";
  if (lower.includes("meetings/")) return "meeting";
  if (lower.includes("archive/")) return "archive";
  if (lower.includes("references/")) return "reference";
  return "general";
}

/** Extract key-value metadata from the top of the file */
function extractMetadata(content: string): { metadata: Record<string, string>; bodyStart: number } {
  const lines = content.split("\n");
  const metadata: Record<string, string> = {};
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Title line — skip it
    if (line.startsWith("# ") && i === 0) {
      bodyStart = i + 1;
      continue;
    }

    // Blank line between metadata and body
    if (line.trim() === "" && Object.keys(metadata).length > 0) {
      bodyStart = i + 1;
      break;
    }

    // Key: Value patterns
    const kvMatch = line.match(/^([A-Za-z][\w\s]*?):\s*(.+)$/);
    if (kvMatch) {
      metadata[kvMatch[1].trim()] = kvMatch[2].trim();
      bodyStart = i + 1;
      continue;
    }

    // *Updated: value* pattern
    const updatedMatch = line.match(/^\*Updated:\s*(.+)\*$/);
    if (updatedMatch) {
      metadata["Updated"] = updatedMatch[1].trim();
      bodyStart = i + 1;
      continue;
    }

    // If we hit a non-metadata line and have no metadata yet, the whole file is body
    if (Object.keys(metadata).length === 0 && line.trim() !== "") {
      // Could be a title
      if (line.startsWith("# ")) {
        bodyStart = i + 1;
        continue;
      }
      break;
    }
  }

  return { metadata, bodyStart };
}

export function parseMarkdownFile(absolutePath: string): ParsedDocument {
  const content = fs.readFileSync(absolutePath, "utf-8");
  const relativePath = path.relative(config.vaultPath, absolutePath);

  // Extract title from filename (strip Notion ID suffix)
  const basename = path.basename(absolutePath, ".md");
  const title = basename.replace(/\s+[0-9a-f]{32}$/, "").trim();

  const { metadata } = extractMetadata(content);

  // Parse tags from metadata
  const tags: string[] = [];
  if (metadata["Tags"]) {
    tags.push(
      ...metadata["Tags"]
        .split(",")
        .map((t) => normalizeTag(t))
        .filter(Boolean)
    );
  }

  // Parse dates
  const createdAt =
    parseDate(metadata["Created"]) || parseDate(metadata["CreatedTime"]) || null;
  const updatedAt = parseDate(metadata["Updated"]) || null;

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const contentPreview = content.slice(0, 500).replace(/\n/g, " ").trim();

  return {
    title,
    relativePath,
    absolutePath,
    documentType: classifyDocType(relativePath),
    createdAt,
    updatedAt,
    tags,
    contentPreview,
    wordCount,
    rawContent: content,
    metadata,
  };
}
