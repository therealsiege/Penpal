import { encoding_for_model } from "tiktoken";

export interface DocumentChunk {
  documentPath: string;
  chunkIndex: number;
  headingPath: string;
  content: string;
  tokenCount: number;
}

const MIN_CHUNK_TOKENS = 100;
const MAX_CHUNK_TOKENS = 600;
const TARGET_MAX_TOKENS = 800;

let encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model("gpt-4o");
  }
  return encoder;
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}

interface HeadingSection {
  headingPath: string;
  content: string;
}

/** Split markdown by ## and ### headings into sections with heading path context */
function splitByHeadings(content: string): HeadingSection[] {
  const lines = content.split("\n");
  const sections: HeadingSection[] = [];
  const headingStack: string[] = [];
  let currentContent: string[] = [];

  function flushSection() {
    const text = currentContent.join("\n").trim();
    if (text) {
      sections.push({
        headingPath: headingStack.join(" > ") || "Introduction",
        content: text,
      });
    }
    currentContent = [];
  }

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h2Match) {
      flushSection();
      headingStack.length = 0;
      headingStack.push(h2Match[1].trim());
    } else if (h3Match) {
      flushSection();
      // Keep h2 level, replace h3
      if (headingStack.length > 1) headingStack.length = 1;
      headingStack.push(h3Match[1].trim());
    } else {
      currentContent.push(line);
    }
  }

  flushSection();
  return sections;
}

/** Split a long section into paragraph-based chunks */
function splitByParagraphs(text: string, maxTokens: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    if (currentTokens + paraTokens > maxTokens && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentTokens = 0;
    }

    // If a single paragraph exceeds max, split by sentences
    if (paraTokens > maxTokens) {
      if (current.length > 0) {
        chunks.push(current.join("\n\n"));
        current = [];
        currentTokens = 0;
      }
      chunks.push(...splitBySentences(para, maxTokens));
    } else {
      current.push(para);
      currentTokens += paraTokens;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"));
  }

  return chunks;
}

/** Last-resort split for very long paragraphs */
function splitBySentences(text: string, maxTokens: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(""));
      current = [];
      currentTokens = 0;
    }

    current.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(""));
  }

  return chunks;
}

/** Chunk a markdown document into semantically coherent pieces */
export function chunkDocument(
  documentPath: string,
  rawContent: string,
): DocumentChunk[] {
  // Strip the title line (# heading) for chunking — it's metadata
  const contentWithoutTitle = rawContent.replace(/^#\s+.+\n/, "").trim();

  if (!contentWithoutTitle) return [];

  const sections = splitByHeadings(contentWithoutTitle);
  const rawChunks: { headingPath: string; content: string }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const tokens = countTokens(section.content);

    if (tokens > MAX_CHUNK_TOKENS) {
      // Split large sections by paragraph
      const subChunks = splitByParagraphs(section.content, MAX_CHUNK_TOKENS);
      for (const sub of subChunks) {
        rawChunks.push({ headingPath: section.headingPath, content: sub });
      }
    } else if (tokens < MIN_CHUNK_TOKENS && i + 1 < sections.length) {
      // Merge small sections with the next one
      sections[i + 1].content = section.content + "\n\n" + sections[i + 1].content;
      if (sections[i + 1].headingPath === "Introduction") {
        sections[i + 1].headingPath = section.headingPath;
      }
    } else {
      rawChunks.push(section);
    }
  }

  // Build final chunks with token counts
  return rawChunks.map((chunk, index) => ({
    documentPath,
    chunkIndex: index,
    headingPath: chunk.headingPath,
    content: chunk.content.trim(),
    tokenCount: countTokens(chunk.content),
  }));
}
