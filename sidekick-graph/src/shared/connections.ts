import neo4j, { Driver, Session } from "neo4j-driver";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let driver: Driver | null = null;
let qdrant: QdrantClient | null = null;
let openai: OpenAI | null = null;
let anthropic: Anthropic | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.MEMGRAPH_URI || "bolt://localhost:7687";
    const user = process.env.MEMGRAPH_USER || "";
    const password = process.env.MEMGRAPH_PASSWORD || "";
    driver = neo4j.driver(uri, user ? neo4j.auth.basic(user, password) : undefined);
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export function getQdrant(): QdrantClient {
  if (!qdrant) {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    qdrant = new QdrantClient({ url });
  }
  return qdrant;
}

export function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

export async function verifyConnection(): Promise<void> {
  const session = getSession();
  try {
    await session.run("RETURN 1 AS ping");
    console.log("Connected to Memgraph");
  } finally {
    await session.close();
  }
}

export async function closeConnections(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
