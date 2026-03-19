import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { config } from "../../shared/config.js";
import { getAnthropic } from "../../shared/connections.js";

export interface ExtractedEntity {
  name: string;
  type: "company" | "person" | "technology" | "regulation" | "market" | "ehr_system";
  confidence: number;
  context: string;
}

export interface ExtractedRelationship {
  sourceEntity: string;
  sourceType: string;
  targetEntity: string;
  targetType: string;
  relationship: string;
  confidence: number;
}

export interface ExtractedEvent {
  type: "funding" | "launch" | "partnership" | "acquisition" | "regulatory" | "other";
  description: string;
  date?: string;
  companies: string[];
  confidence: number;
}

export interface LLMExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  events: ExtractedEvent[];
  markets: string[];
}

const EXTRACTION_PROMPT = `You are an entity extraction system for a healthcare technology knowledge base. Analyze the following document and extract structured information.

Return a JSON object with these fields:

{
  "entities": [
    {
      "name": "exact entity name",
      "type": "company|person|technology|regulation|market|ehr_system",
      "confidence": 0.0-1.0,
      "context": "brief context of how the entity is mentioned"
    }
  ],
  "relationships": [
    {
      "sourceEntity": "entity name",
      "sourceType": "company|person|technology",
      "targetEntity": "entity name",
      "targetType": "company|person|technology",
      "relationship": "COMPETES_WITH|PARTNERS_WITH|INTEGRATES_WITH|USES|WORKS_AT|INVESTED_IN",
      "confidence": 0.0-1.0
    }
  ],
  "events": [
    {
      "type": "funding|launch|partnership|acquisition|regulatory|other",
      "description": "brief event description",
      "date": "YYYY-MM-DD or null",
      "companies": ["company names involved"],
      "confidence": 0.0-1.0
    }
  ],
  "markets": ["market segment names like 'AI Ambient Scribes', 'Prior Authorization', 'Revenue Cycle Management'"]
}

Focus on healthcare technology entities. Only include entities with confidence >= 0.5.
Return ONLY the JSON object, no other text.

Document:
`;

interface ExtractionCache {
  version: number;
  entries: Record<string, { contentHash: string; result: LLMExtractionResult }>;
}

let extractionCache: ExtractionCache | null = null;

function loadExtractionCache(): ExtractionCache {
  if (extractionCache) return extractionCache;
  try {
    if (fs.existsSync(config.extractionCachePath)) {
      const raw = fs.readFileSync(config.extractionCachePath, "utf-8");
      extractionCache = JSON.parse(raw);
      if (extractionCache!.version === 1) return extractionCache!;
    }
  } catch {
    // Corrupted — start fresh
  }
  extractionCache = { version: 1, entries: {} };
  return extractionCache;
}

export function saveExtractionCache(): void {
  if (!extractionCache) return;
  const dir = path.dirname(config.extractionCachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(config.extractionCachePath, JSON.stringify(extractionCache));
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function callWithRetry(
  anthropic: Anthropic,
  truncated: string,
  retries = 3,
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: EXTRACTION_PROMPT + truncated,
          },
        ],
      });
    } catch (err: unknown) {
      const isOverloaded =
        (err instanceof Error && err.message.includes("Overloaded")) ||
        (err instanceof Error && err.message.includes("529")) ||
        (err instanceof Error && err.message.includes("rate"));
      if (isOverloaded && attempt < retries - 1) {
        const delay = 2000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Exhausted retries");
}

/** Extract entities, relationships, and events from a document using Claude Haiku */
export async function extractWithLLM(
  documentPath: string,
  content: string,
): Promise<LLMExtractionResult> {
  const cache = loadExtractionCache();
  const hash = contentHash(content);

  // Check cache
  const cached = cache.entries[documentPath];
  if (cached && cached.contentHash === hash) {
    return cached.result;
  }

  // Truncate very long documents to ~8000 tokens worth of text
  const truncated = content.slice(0, 32000);

  const anthropic = getAnthropic();
  const response = await callWithRetry(anthropic, truncated);

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let result: LLMExtractionResult;
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      result = { entities: [], relationships: [], events: [], markets: [] };
    } else {
      result = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.warn(`  Warning: Failed to parse LLM extraction for ${documentPath}`);
    result = { entities: [], relationships: [], events: [], markets: [] };
  }

  // Validate and filter
  result.entities = (result.entities || []).filter((e) => e.confidence >= 0.5);
  result.relationships = (result.relationships || []).filter((r) => r.confidence >= 0.5);
  result.events = (result.events || []).filter((e) => e.confidence >= 0.5);
  result.markets = result.markets || [];

  // Cache result
  cache.entries[documentPath] = { contentHash: hash, result };

  return result;
}
