/**
 * wiki-synthesizer.ts
 *
 * Uses Claude to synthesize actual intelligence pages from graph data
 * and source document chunks — not just formatted property dumps.
 * Each entity type gets opinionated sections that answer "so what?"
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, getOpenAI, getQdrant } from "../../shared/connections.js";
import type {
  WikiCompany,
  WikiPerson,
  WikiTechnology,
  WikiLead,
  WikiProduct,
} from "./wiki-queries.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;
const CHUNK_SEARCH_LIMIT = 5;

// ---------------------------------------------------------------------------
// Qdrant helper — fetch relevant source chunks for context
// ---------------------------------------------------------------------------

async function fetchRelevantChunks(query: string, limit = CHUNK_SEARCH_LIMIT): Promise<string[]> {
  try {
    const openai = getOpenAI();
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVector = embResponse.data[0].embedding;

    const qdrant = getQdrant();
    const results = await qdrant.search("document_chunks", {
      vector: queryVector,
      limit,
      with_payload: true,
    });

    return results
      .filter((r) => r.payload?.text)
      .map((r) => r.payload!.text as string);
  } catch {
    // Qdrant or OpenAI may not be available — degrade gracefully
    return [];
  }
}

// ---------------------------------------------------------------------------
// Claude synthesis call
// ---------------------------------------------------------------------------

async function synthesize(
  systemPrompt: string,
  userContent: string,
  retries = 2,
): Promise<string> {
  const anthropic = getAnthropic();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });
      const block = response.content[0];
      if (block.type === "text") return block.text;
      return "";
    } catch (err: unknown) {
      const isRetryable =
        (err instanceof Error && err.message.includes("Overloaded")) ||
        (err instanceof Error && err.message.includes("529")) ||
        (err instanceof Error && err.message.includes("rate"));
      if (isRetryable && attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Frontmatter helper
// ---------------------------------------------------------------------------

function frontmatter(type: string, name: string, tags: string[]): string {
  return `---
type: ${type}
aliases: [${name}]
tags: [${tags.filter(Boolean).join(", ")}]
updated: ${new Date().toISOString()}
source: auto-generated from knowledge graph + Claude synthesis
---

`;
}

// ---------------------------------------------------------------------------
// Entity synthesizers
// ---------------------------------------------------------------------------

export async function synthesizeCompany(c: WikiCompany): Promise<string> {
  const chunks = await fetchRelevantChunks(`${c.name} company healthcare`);

  const graphContext = JSON.stringify({
    name: c.name, type: c.type, funding: c.funding, hq: c.hq,
    people: c.people, products: c.products,
    competitors: c.competitors, technologies: c.technologies,
    mentionedInDocCount: c.documents.length,
    documentTitles: c.documents.slice(0, 8).map((d) => d.title),
  }, null, 2);

  const sourceContext = chunks.length > 0
    ? `\n\nSource document excerpts:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const body = await synthesize(
    `You are writing a knowledge base page about a company for a healthcare startup founder.
Write in direct, analytical prose. No filler. Every sentence should be actionable intelligence.
Output pure markdown (no frontmatter — that's added separately).
Start with an H1 heading with the company name, then these sections:
## Overview — 2-3 sentences: what they do, scale, market position
## Competitive Position — how they compare to alternatives, strengths/weaknesses
## Relevance to Us — why this company matters to our business (MedScrub clinical screening, MedHook EHR integration, 1Putt consulting)
## Key People — notable contacts with their roles and why they matter (use [[Name]] wikilinks)
## Open Questions — what we still need to learn about them
If a section has no useful content, omit it entirely.`,
    `Company graph data:\n${graphContext}${sourceContext}`,
  );

  const tags = ["entity", "company", c.type?.toLowerCase()].filter(Boolean);
  return frontmatter("company", c.name, tags) + body;
}

export async function synthesizePerson(p: WikiPerson): Promise<string> {
  const chunks = await fetchRelevantChunks(`${p.name} ${p.company || ""} healthcare`);

  const graphContext = JSON.stringify({
    name: p.name, company: p.company, role: p.role, title: p.title,
    companies: p.companies,
    mentionedInDocCount: p.documents.length,
    documentTitles: p.documents.slice(0, 8).map((d) => d.title),
  }, null, 2);

  const sourceContext = chunks.length > 0
    ? `\n\nSource document excerpts:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const body = await synthesize(
    `You are writing a knowledge base page about a person for a healthcare startup founder.
Write in direct, analytical prose. This person is a contact, advisor, or industry figure.
Output pure markdown (no frontmatter). Start with H1 heading with their name, then:
## Who They Are — role, background, expertise in 2-3 sentences
## Why They Matter — what they bring to the table, how they connect to our work
## Relationship History — interactions, introductions, pending follow-ups
## Organizations — companies they're connected to (use [[Company]] wikilinks)
## Open Threads — pending conversations, questions to ask, next steps
If a section has no useful content, omit it entirely.`,
    `Person graph data:\n${graphContext}${sourceContext}`,
  );

  const tags = ["entity", "person"];
  return frontmatter("person", p.name, tags) + body;
}

export async function synthesizeTechnology(t: WikiTechnology): Promise<string> {
  const chunks = await fetchRelevantChunks(`${t.name} technology healthcare integration`);

  const graphContext = JSON.stringify({
    name: t.name, category: t.category,
    companies: t.companies,
    mentionedInDocCount: t.documents.length,
    documentTitles: t.documents.slice(0, 8).map((d) => d.title),
  }, null, 2);

  const sourceContext = chunks.length > 0
    ? `\n\nSource document excerpts:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const body = await synthesize(
    `You are writing a knowledge base page about a technology/standard for a healthcare startup.
Output pure markdown (no frontmatter). Start with H1, then:
## What It Is — brief technical description, 2-3 sentences
## Who Uses It — companies and products built on this (use [[Company]] wikilinks)
## Relevance to Us — how this tech matters for MedScrub (clinical screening) or MedHook (EHR integration)
If a section has no useful content, omit it entirely. Be concise.`,
    `Technology graph data:\n${graphContext}${sourceContext}`,
  );

  const tags = ["entity", "technology", t.category?.toLowerCase()].filter(Boolean);
  return frontmatter("technology", t.name, tags) + body;
}

export async function synthesizeLead(l: WikiLead): Promise<string> {
  const chunks = await fetchRelevantChunks(`${l.name} ${l.company || ""} lead healthcare`);

  const graphContext = JSON.stringify({
    name: l.name, company: l.company, location: l.location,
    jobTitle: l.jobTitle, type: l.type, emr: l.emr,
    leadScore: l.leadScore, businessArm: l.businessArm,
    stage: l.stage, nextAction: l.nextAction, notes: l.notes,
    createdAt: l.createdAt,
    practices: l.practices, events: l.events,
  }, null, 2);

  const sourceContext = chunks.length > 0
    ? `\n\nSource document excerpts:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const body = await synthesize(
    `You are writing a knowledge base page about a sales lead for a healthcare startup.
This is a potential customer or partner. Write actionable intelligence, not a data dump.
Output pure markdown (no frontmatter). Start with H1, then:
## Profile — who they are, their practice, what they do (2-3 sentences)
## Fit Assessment — why they're a good/bad fit for our products, based on their EMR, specialty, location
## Pipeline Status — current stage, score, what needs to happen next
## Engagement Strategy — recommended approach, talking points, timing
## Practice Details — if we have NPI/practice data, summarize it
If a section has no useful content, omit it entirely.`,
    `Lead graph data:\n${graphContext}${sourceContext}`,
  );

  const tags = ["entity", "lead", l.businessArm?.toLowerCase(), l.stage?.toLowerCase().replace(/\s+/g, "-")].filter(Boolean);
  return frontmatter("lead", l.name, tags) + body;
}

export async function synthesizeProduct(p: WikiProduct): Promise<string> {
  const chunks = await fetchRelevantChunks(`${p.name} ${p.company || ""} product competitor healthcare`);

  const graphContext = JSON.stringify({
    name: p.name, company: p.company, category: p.category,
    pricing: p.pricing, features: p.features,
    customerCount: p.customerCount, positioning: p.positioning,
    funding: p.funding,
  }, null, 2);

  const sourceContext = chunks.length > 0
    ? `\n\nSource document excerpts:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
    : "";

  const body = await synthesize(
    `You are writing a competitive intelligence page about a product for a healthcare startup founder.
Output pure markdown (no frontmatter). Start with H1, then:
## What It Does — product description, key capabilities (2-3 sentences)
## Market Position — pricing, customer base, funding, competitive moat
## How We Compare — our advantages and disadvantages vs this product (for MedScrub clinical screening or MedHook integration)
## Takeaways — what we can learn from them, what to watch for
If a section has no useful content, omit it entirely.`,
    `Product graph data:\n${graphContext}${sourceContext}`,
  );

  const tags = ["entity", "product", p.category?.toLowerCase()].filter(Boolean);
  return frontmatter("product", p.name, tags) + body;
}

