import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";
import { verifyConnection, closeConnections } from "../../shared/connections.js";
import { GraphImporter } from "../graph/importer.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import {
  type VentureProfile,
  getTargetVentures,
  routeArticleToVentures,
} from "./venture-config.js";
import {
  type SourceArticle,
  extractCompanies,
  getExistingLeadNames,
  processCompanyForVenture,
} from "./shared-pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = path.resolve(__dirname, "..", "..", "..", "data", "rss-seen.json");

// ─── Dedup Cache ─────────────────────────────────────────────────────────────

const SEEN_CAP = 500;
const POLLUTED_RE = /%3c|%22|%3e/i;

function loadSeenUrls(): Set<string> {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      const data: string[] = JSON.parse(fs.readFileSync(SEEN_PATH, "utf-8"));
      const clean = data.filter((u) => !POLLUTED_RE.test(u));
      const removed = data.length - clean.length;
      if (removed > 0) {
        console.log(`  Cleaned ${removed} polluted entries from seen cache`);
      }
      return new Set(clean);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return new Set();
}

function saveSeenUrls(seen: Set<string>): void {
  const dir = path.dirname(SEEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Cap at SEEN_CAP entries, keeping the most recent (Set insertion order)
  let entries = [...seen];
  if (entries.length > SEEN_CAP) {
    entries = entries.slice(entries.length - SEEN_CAP);
  }
  fs.writeFileSync(SEEN_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

function urlHash(url: string): string {
  // Simple hash for dedup — just normalize the URL
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase();
  }
}

/** Extract a clean URL from link values that may contain embedded HTML anchors. */
function cleanItemLink(raw: string, feedUrl: string): string {
  const trimmed = raw.trim();
  const anchorMatch = trimmed.match(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!anchorMatch) return trimmed;

  const href = anchorMatch[1];
  try {
    // Resolve relative URLs against the feed's origin
    return new URL(href, feedUrl).href;
  } catch {
    return href;
  }
}

// ─── RSS Fetching ────────────────────────────────────────────────────────────

interface RssArticle {
  title: string;
  url: string;
  source: string;
  snippet: string;
  feedName: string;
  pubDate?: string;
}

async function fetchFeed(feedUrl: string, feedName: string): Promise<RssArticle[]> {
  const parser = new Parser({
    timeout: 15000,
    headers: {
      "User-Agent": "Sidekick-Graph/1.0 (RSS Feed Reader)",
    },
  });

  async function attempt(): Promise<RssArticle[]> {
    const feed = await parser.parseURL(feedUrl);
    const articles: RssArticle[] = [];

    for (const item of feed.items || []) {
      const itemTitle = typeof item.title === "string" ? item.title : (item.title as any)?._ ?? JSON.stringify(item.title ?? "");
      const rawLink = typeof item.link === "string" ? item.link : (item.link as any)?.href ?? "";
      const itemLink = cleanItemLink(rawLink, feedUrl);
      if (!itemTitle || !itemLink) continue;

      // Only process articles from last 7 days
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (pubDate < weekAgo) continue;
      }

      articles.push({
        title: itemTitle,
        url: itemLink,
        source: feedName,
        snippet: String(item.contentSnippet || item.content || "").slice(0, 500).replace(/<[^>]*>/g, ""),
        feedName,
        pubDate: item.pubDate,
      });
    }

    return articles;
  }

  try {
    return await attempt();
  } catch (err) {
    console.warn(`  ${feedName}: fetch failed, retrying in 2s... (${(err as Error).message})`);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      return await attempt();
    } catch (retryErr) {
      console.warn(`  ${feedName}: retry failed, skipping. (${(retryErr as Error).message})`);
      return [];
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function ingestRss(targetVentures?: VentureProfile[]): Promise<{
  feedsFetched: number;
  articlesTotal: number;
  articlesNew: number;
  companiesFound: number;
  leadsWritten: number;
}> {
  const ventures = targetVentures || getTargetVentures();
  const stats = { feedsFetched: 0, articlesTotal: 0, articlesNew: 0, companiesFound: 0, leadsWritten: 0 };

  console.log("=== RSS Feed Lead Ingestion ===");
  console.log(`  Ventures: ${ventures.map((v) => v.name).join(", ")}\n`);

  // Collect all unique feeds across target ventures
  const feedMap = new Map<string, { url: string; name: string }>();
  for (const venture of ventures) {
    for (const feed of venture.rssFeeds) {
      feedMap.set(feed.url, feed);
    }
  }

  // 1. Fetch all feeds in parallel
  console.log(`Fetching ${feedMap.size} RSS feeds...`);
  const allArticles: RssArticle[] = [];
  const feeds = [...feedMap.values()];

  const results = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed.url, feed.name)),
  );

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    const result = results[i];
    const articles = result.status === "fulfilled" ? result.value : [];
    if (articles.length === 0) {
      console.warn(`  ⚠ ${feed.name}: 0 articles (possibly misconfigured URL)`);
    } else {
      console.log(`  ${feed.name}: ${articles.length} articles`);
    }
    allArticles.push(...articles);
    stats.feedsFetched++;
  }
  stats.articlesTotal = allArticles.length;
  console.log(`  Total: ${allArticles.length} articles across ${feedMap.size} feeds`);

  if (allArticles.length === 0) {
    console.log("No articles found in RSS feeds.");
    return stats;
  }

  // 2. Deduplicate against seen URLs
  const seenUrls = loadSeenUrls();
  const newArticles = allArticles.filter((a) => !seenUrls.has(urlHash(a.url)));
  stats.articlesNew = newArticles.length;
  console.log(`\n${newArticles.length} new articles (${allArticles.length - newArticles.length} already seen)`);

  if (newArticles.length === 0) {
    console.log("No new articles to process.");
    return stats;
  }

  // Mark all as seen now (even if we don't extract companies from them)
  for (const article of newArticles) {
    seenUrls.add(urlHash(article.url));
  }
  saveSeenUrls(seenUrls);

  // 3. Route articles to ventures and process per-venture
  await verifyConnection();
  const importer = new GraphImporter();

  for (const venture of ventures) {
    // Filter articles: must be from a feed this venture subscribes to, OR match by content routing
    const ventureFeedUrls = new Set(venture.rssFeeds.map((f) => f.url));
    const ventureArticles: SourceArticle[] = [];

    for (const article of newArticles) {
      // Check if from a subscribed feed
      const isSubscribedFeed = [...feedMap.entries()].some(
        ([url, feed]) => feed.name === article.feedName && ventureFeedUrls.has(url),
      );

      if (isSubscribedFeed) {
        // Also check content relevance
        const matchedVentures = routeArticleToVentures(article.title, article.snippet);
        if (matchedVentures.some((v) => v.slug === venture.slug)) {
          ventureArticles.push({
            title: article.title,
            url: article.url,
            source: article.source,
            snippet: article.snippet,
            keyword: article.feedName,
          });
        }
      }
    }

    if (ventureArticles.length === 0) {
      console.log(`\n── ${venture.name}: no relevant articles ──`);
      continue;
    }

    console.log(`\n── ${venture.name} (${ventureArticles.length} relevant articles) ──`);

    // Extract companies via Claude
    console.log("  Extracting companies via Claude...");
    const companyMap = await extractCompanies(ventureArticles, venture);
    console.log(`  Found ${companyMap.size} potential companies`);
    stats.companiesFound += companyMap.size;

    if (companyMap.size === 0) continue;

    // Deduplicate against existing leads
    const existingLeads = getExistingLeadNames(venture);
    const newCompanies = new Map<string, SourceArticle[]>();
    for (const [name, arts] of companyMap) {
      if (!existingLeads.has(normalizeName(name))) {
        newCompanies.set(name, arts);
      } else {
        console.log(`  Skipping existing lead: ${name}`);
      }
    }
    console.log(`  ${newCompanies.size} new companies after dedup`);

    // Enrich + Score + Write
    for (const [companyName, arts] of newCompanies) {
      const ok = await processCompanyForVenture(companyName, arts, venture, importer, "RSS Feed");
      if (ok) stats.leadsWritten++;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (stats.leadsWritten > 0) {
    await importer.flush();
  }

  await closeConnections();
  return stats;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const stats = await ingestRss();

  console.log(`\n=== Done ===`);
  console.log(`  Feeds fetched: ${stats.feedsFetched}`);
  console.log(`  Articles total: ${stats.articlesTotal}`);
  console.log(`  Articles new: ${stats.articlesNew}`);
  console.log(`  Companies found: ${stats.companiesFound}`);
  console.log(`  New leads written: ${stats.leadsWritten}`);
}

// Only run main() when invoked directly (not imported by ingest-all)
const isDirectRun = process.argv[1]?.includes("rss-ingester");
if (isDirectRun) {
  main().catch((err) => {
    console.error("RSS ingestion failed:", err);
    process.exit(1);
  });
}
