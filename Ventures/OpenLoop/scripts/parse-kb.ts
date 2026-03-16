// scripts/parse-kb.ts
import { readFileSync, readdirSync } from "fs";
import { join, basename, dirname } from "path";

const KB_ROOT = join(process.env.HOME!, "Workspace", "KB");

export interface ParsedDocument {
  type: "Document" | "MeetingNote";
  title: string;
  summary: string;
  filePath: string;
  folder: string;
  urls: string[];
  crossRefs: string[];
  date?: string;
  topic?: string;
  actionItems?: ActionItemRaw[];
  topics?: string[];  // extracted from ### headers in summary sections
}

export interface ActionItemRaw {
  description: string;
  assignee: string;
  status: "open" | "done";
}

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "scripts" || entry.name === "docs") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function extractTitle(content: string, filename: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return basename(filename, ".md");
}

function extractSummary(content: string): string {
  const bq = content.match(/^>\s*(.+)$/m);
  if (bq) return bq[1].trim();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith(">") && !trimmed.startsWith("---")) {
      return trimmed.slice(0, 200);
    }
  }
  return "";
}

function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s)>\]"]+/g;
  const matches = content.match(urlRegex) || [];
  return [...new Set(matches)];
}

function extractCrossRefs(content: string): string[] {
  const linkRegex = /\[([^\]]*)\]\(([^)]+\.md)\)/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    refs.push(decodeURIComponent(match[2]));
  }
  return refs;
}

function extractMeetingDate(filename: string): string | undefined {
  const base = basename(filename);
  // YYYY-MM-DD format
  const isoMatch = base.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // M-D-YYYY format (e.g., 3-9-2026.md)
  const mdyMatch = base.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return undefined;
}

function extractMeetingTopic(filename: string): string | undefined {
  const base = basename(filename, ".md");
  // YYYY-MM-DD - topic
  const isoMatch = base.match(/^\d{4}-\d{2}-\d{2}\s*-\s*(.+)/);
  if (isoMatch) return isoMatch[1].trim();
  // M-D-YYYY - topic
  const mdyMatch = base.match(/^\d{1,2}-\d{1,2}-\d{4}\s*-\s*(.+)/);
  if (mdyMatch) return mdyMatch[1].trim();
  return undefined;
}

function extractMeetingSummary(content: string): string {
  const contextMatch = content.match(/###\s*Meeting Context\s*\n([\s\S]*?)(?=\n###|\n---|\n$)/);
  if (contextMatch) return contextMatch[1].trim().slice(0, 500);
  return extractSummary(content);
}

function extractTopics(content: string): string[] {
  // Extract ### headers from summary sections (before Notes/Transcript)
  const summarySection = content.split(/^(?:Notes|Transcript)\s*$/m)[0] || content;
  const headerRegex = /^###\s+(.+)$/gm;
  const topics: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(summarySection)) !== null) {
    const topic = match[1].trim();
    // Skip generic headers
    if (topic === "Action Items" || topic === "Action Items & Next Steps" || topic === "Meeting Context") continue;
    topics.push(topic);
  }
  return [...new Set(topics)];
}

function extractActionItems(content: string): ActionItemRaw[] {
  const items: ActionItemRaw[] = [];
  const itemRegex = /^-\s*\[([ x])\]\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(content)) !== null) {
    const status: "open" | "done" = match[1] === "x" ? "done" : "open";
    const text = match[2].trim();
    const assigneeMatch = text.match(/^(\w+)\s+to\s+/i);
    const assignee = assigneeMatch ? assigneeMatch[1] : "";
    items.push({ description: text, assignee, status });
  }
  return items;
}

export function parseKB(): ParsedDocument[] {
  const files = findMarkdownFiles(KB_ROOT);
  const docs: ParsedDocument[] = [];

  for (const filePath of files) {
    if (filePath.includes("/docs/")) continue;

    const content = readFileSync(filePath, "utf-8");
    const folder = basename(dirname(filePath));
    const isCampfire = filePath.includes("/Campfire/");

    if (isCampfire) {
      docs.push({
        type: "MeetingNote",
        title: extractMeetingTopic(filePath) || basename(filePath, ".md"),
        summary: extractMeetingSummary(content),
        filePath,
        folder: "Campfire",
        urls: extractUrls(content),
        crossRefs: extractCrossRefs(content),
        date: extractMeetingDate(filePath),
        topic: extractMeetingTopic(filePath),
        actionItems: extractActionItems(content),
        topics: extractTopics(content),
      });
    } else {
      docs.push({
        type: "Document",
        title: extractTitle(content, filePath),
        summary: extractSummary(content),
        filePath,
        folder: folder === "KB" ? "" : folder,
        urls: extractUrls(content),
        crossRefs: extractCrossRefs(content),
      });
    }
  }

  return docs;
}
