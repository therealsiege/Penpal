import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { verifyConnection, closeConnections } from "../../shared/connections.js";
import { GraphImporter } from "../graph/importer.js";
import { normalizeName } from "../../shared/utils/normalize.js";
import { getTargetVentures, routeAlertKeyword, } from "./venture-config.js";
import { extractCompanies, getExistingLeadNames, processCompanyForVenture, } from "./shared-pipeline.js";
import { fetchRedditPosts } from "./sources/reddit-source.js";
import { fetchHNPosts } from "./sources/hn-source.js";
const execAsync = promisify(exec);
const GOG = (() => {
    const fromEnv = process.env.GOG_CLI?.trim();
    if (fromEnv)
        return fromEnv;
    if (fs.existsSync("/opt/homebrew/bin/gog"))
        return "/opt/homebrew/bin/gog";
    if (fs.existsSync("/usr/local/bin/gog"))
        return "/usr/local/bin/gog";
    return "gog";
})();
const GOOGLE_ALERTS_ACCOUNT = process.env.GOOGLE_ALERTS_ACCOUNT
    || process.env.GMAIL_ACCOUNT
    || "fuzeelogik@gmail.com";
// ─── Step 1: Fetch Google Alert emails ───────────────────────────────────────
async function fetchAlertEmails(maxMessages = 50, newerThan = "2d") {
    console.log(`Fetching Google Alert emails (newer_than:${newerThan})...`);
    if (!GOOGLE_ALERTS_ACCOUNT) {
        console.warn("  GOOGLE_ALERTS_ACCOUNT is not set; skipping Gmail alert ingestion.");
        return [];
    }
    try {
        const { stdout } = await execAsync(`${GOG} gmail messages search 'label:"Google Alerts" newer_than:${newerThan}' --max ${maxMessages} --json --account ${GOOGLE_ALERTS_ACCOUNT}`, { timeout: 30000 });
        const parsed = JSON.parse(stdout);
        const messages = parsed?.messages || parsed || [];
        const ids = [];
        for (const msg of messages) {
            if (msg.id)
                ids.push(msg.id);
        }
        console.log(`  Found ${ids.length} alert emails`);
        return ids;
    }
    catch (err) {
        console.warn("  Failed to fetch alert emails:", err.message);
        return [];
    }
}
async function archiveEmails(messageIds) {
    if (!GOOGLE_ALERTS_ACCOUNT || messageIds.length === 0)
        return 0;
    console.log(`\nArchiving ${messageIds.length} processed alert emails...`);
    let archived = 0;
    for (const id of messageIds) {
        try {
            await execAsync(`${GOG} gmail messages modify ${id} --remove INBOX --force --account ${GOOGLE_ALERTS_ACCOUNT}`, { timeout: 10000 });
            archived++;
        }
        catch (err) {
            console.warn(`  Failed to archive ${id}:`, err.message);
        }
    }
    console.log(`  Archived ${archived}/${messageIds.length} emails`);
    return archived;
}
async function fetchMessageBody(messageId) {
    if (!GOOGLE_ALERTS_ACCOUNT)
        return null;
    try {
        const { stdout } = await execAsync(`${GOG} gmail get ${messageId} --json --account ${GOOGLE_ALERTS_ACCOUNT}`, { timeout: 15000 });
        const msg = JSON.parse(stdout);
        let subject = "";
        if (msg.headers && typeof msg.headers === "object" && !Array.isArray(msg.headers)) {
            subject = msg.headers.subject || "";
        }
        else if (Array.isArray(msg.headers)) {
            const subjectHeader = msg.headers.find((h) => h.name?.toLowerCase() === "subject");
            subject = subjectHeader?.value || "";
        }
        else if (msg.payload?.headers && Array.isArray(msg.payload.headers)) {
            const subjectHeader = msg.payload.headers.find((h) => h.name?.toLowerCase() === "subject");
            subject = subjectHeader?.value || "";
        }
        let body = "";
        if (typeof msg.body === "string") {
            body = msg.body;
        }
        else if (msg.payload?.body?.data) {
            body = Buffer.from(msg.payload.body.data, "base64url").toString("utf-8");
        }
        else if (msg.payload?.parts) {
            for (const part of msg.payload.parts) {
                if (part.mimeType === "text/html" && part.body?.data) {
                    body = Buffer.from(part.body.data, "base64url").toString("utf-8");
                    break;
                }
                if (part.mimeType === "text/plain" && part.body?.data && !body) {
                    body = Buffer.from(part.body.data, "base64url").toString("utf-8");
                }
            }
        }
        if (!body && msg.snippet) {
            body = msg.snippet;
        }
        return { subject, body };
    }
    catch (err) {
        console.warn(`  Failed to fetch message ${messageId}:`, err.message);
        return null;
    }
}
// ─── Step 2: Parse alert HTML ────────────────────────────────────────────────
function parseAlertEmail(subject, content) {
    const articles = [];
    const keywordMatch = subject.match(/Google Alert\s*[-–—]\s*(.+)/i);
    const keyword = keywordMatch ? keywordMatch[1].trim() : "unknown";
    const isHtml = content.includes("<a ") || content.includes("<html");
    if (!isHtml) {
        const blocks = content.split(/^-\s*-\s*-.*$/m);
        const mainBlock = blocks[0] || content;
        const urlPattern = /<(https?:\/\/www\.google\.com\/url\?[^>]+)>/g;
        let urlMatch;
        while ((urlMatch = urlPattern.exec(mainBlock)) !== null) {
            const rawUrl = urlMatch[1];
            const actualUrlMatch = rawUrl.match(/[?&]url=(https?[^&]+)/);
            const url = actualUrlMatch ? decodeURIComponent(actualUrlMatch[1]) : rawUrl;
            if (url.includes("google.com/alerts"))
                continue;
            const beforeUrl = mainBlock.slice(0, urlMatch.index);
            const lines = beforeUrl.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
            let title = "";
            let snippet = "";
            let sourceName = "";
            const relevantLines = [];
            for (let i = lines.length - 1; i >= 0 && relevantLines.length < 5; i--) {
                const line = lines[i];
                if (line.startsWith("===") || line.startsWith("---"))
                    break;
                relevantLines.unshift(line);
            }
            if (relevantLines.length >= 2) {
                const titleLine = relevantLines[0];
                const pipeIdx = titleLine.lastIndexOf(" | ");
                if (pipeIdx > 0) {
                    title = titleLine.slice(0, pipeIdx).trim();
                    sourceName = titleLine.slice(pipeIdx + 3).trim();
                }
                else {
                    title = titleLine;
                }
                if (!sourceName && relevantLines.length >= 3) {
                    sourceName = relevantLines[1];
                    snippet = relevantLines.slice(2).join(" ").trim();
                }
                else {
                    snippet = relevantLines.slice(1).join(" ").trim();
                }
            }
            else if (relevantLines.length === 1) {
                title = relevantLines[0];
            }
            if (title.length < 10)
                continue;
            if (title.toLowerCase().includes("google alert"))
                continue;
            let source = sourceName;
            if (!source) {
                try {
                    source = new URL(url).hostname.replace(/^www\./, "");
                }
                catch {
                    source = url;
                }
            }
            articles.push({ title, url, source, snippet, keyword });
        }
        if (articles.length === 0) {
            const directUrlPattern = /<(https?:\/\/(?!www\.google\.com)[^>]+)>/g;
            let directMatch;
            while ((directMatch = directUrlPattern.exec(mainBlock)) !== null) {
                const url = directMatch[1];
                if (url.includes("google.com"))
                    continue;
                let source = "";
                try {
                    source = new URL(url).hostname.replace(/^www\./, "");
                }
                catch {
                    source = url;
                }
                articles.push({ title: url, url, source, snippet: "", keyword });
            }
        }
    }
    else {
        const linkPattern = /<a[^>]*href="(https?:\/\/www\.google\.com\/url\?[^"]*)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkPattern.exec(content)) !== null) {
            const rawUrl = match[1];
            const title = match[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
            if (title.toLowerCase().includes("google alert") || title === "flag as irrelevant")
                continue;
            if (title.length < 10)
                continue;
            const urlMatch = rawUrl.match(/[?&]url=(https?[^&]+)/);
            const url = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
            let source = "";
            try {
                source = new URL(url).hostname.replace(/^www\./, "");
            }
            catch {
                source = url;
            }
            const afterLink = content.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 500);
            const snippetMatch = afterLink.match(/>([^<]{20,300})</);
            const snippet = snippetMatch
                ? snippetMatch[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
                : "";
            articles.push({ title, url, source, snippet, keyword });
        }
        if (articles.length === 0) {
            const directPattern = /<a[^>]*href="(https?:\/\/(?!www\.google\.com)[^"]+)"[^>]*>([^<]{10,})<\/a>/gi;
            let match;
            while ((match = directPattern.exec(content)) !== null) {
                const url = match[1].replace(/&amp;/g, "&");
                const title = match[2].replace(/&amp;/g, "&").trim();
                if (title.toLowerCase().includes("unsubscribe") || title.toLowerCase().includes("google"))
                    continue;
                let source = "";
                try {
                    source = new URL(url).hostname.replace(/^www\./, "");
                }
                catch {
                    source = url;
                }
                articles.push({ title, url, source, snippet: "", keyword });
            }
        }
    }
    return articles;
}
// ─── Main ────────────────────────────────────────────────────────────────────
export async function ingestAlerts(targetVentures, options) {
    const ventures = targetVentures || getTargetVentures();
    const newerThan = options?.newerThan || "2d";
    const shouldArchive = options?.archive ?? true;
    const stats = { emailsFetched: 0, redditPosts: 0, hnPosts: 0, articlesParsed: 0, companiesFound: 0, leadsWritten: 0, emailsArchived: 0 };
    console.log("=== Lead Ingestion (Google Alerts + Reddit + HN) ===");
    console.log(`  Ventures: ${ventures.map((v) => v.name).join(", ")}`);
    console.log(`  Window: ${newerThan}, Archive: ${shouldArchive}\n`);
    // 1. Fetch alert emails
    const messageIds = await fetchAlertEmails(50, newerThan);
    stats.emailsFetched = messageIds.length;
    // 2. Fetch and parse each email
    console.log("\nParsing alert emails...");
    const allArticles = [];
    for (const id of messageIds) {
        const msg = await fetchMessageBody(id);
        if (!msg)
            continue;
        const articles = parseAlertEmail(msg.subject, msg.body);
        allArticles.push(...articles);
    }
    console.log(`  Extracted ${allArticles.length} articles from ${messageIds.length} emails`);
    // 3. Fetch Reddit posts
    console.log("\nFetching Reddit posts...");
    const redditPostsList = await fetchRedditPosts();
    stats.redditPosts = redditPostsList.length;
    const redditArticles = redditPostsList.map((p) => ({
        title: p.title,
        url: p.url,
        source: "reddit.com",
        snippet: p.selftext.slice(0, 300),
        keyword: p.keyword,
    }));
    allArticles.push(...redditArticles);
    // 4. Fetch HN posts
    console.log("\nFetching HN posts...");
    const hnPostsList = await fetchHNPosts();
    stats.hnPosts = hnPostsList.length;
    const hnArticles = hnPostsList.map((p) => ({
        title: p.title,
        url: p.url,
        source: "news.ycombinator.com",
        snippet: "",
        keyword: p.keyword,
    }));
    allArticles.push(...hnArticles);
    stats.articlesParsed = allArticles.length;
    if (allArticles.length === 0) {
        console.log("No articles found from any source.");
        return stats;
    }
    // 5. Route articles to ventures by keyword
    const ventureArticles = new Map();
    for (const article of allArticles) {
        const matchedVentures = routeAlertKeyword(article.keyword);
        for (const venture of matchedVentures) {
            if (!ventures.some((v) => v.slug === venture.slug))
                continue;
            const existing = ventureArticles.get(venture.slug) || [];
            existing.push(article);
            ventureArticles.set(venture.slug, existing);
        }
    }
    // 6. Process each venture
    await verifyConnection();
    const importer = new GraphImporter();
    for (const venture of ventures) {
        // Use routed articles if available, fall back to all articles
        const articles = ventureArticles.get(venture.slug) || allArticles;
        console.log(`\n── ${venture.name} (${articles.length} articles) ──`);
        // Extract companies via Claude (venture-specific prompt)
        console.log("  Extracting companies via Claude...");
        const companyMap = await extractCompanies(articles, venture);
        console.log(`  Found ${companyMap.size} potential companies`);
        stats.companiesFound += companyMap.size;
        if (companyMap.size === 0)
            continue;
        // Deduplicate against existing leads for this venture
        const existingLeads = getExistingLeadNames(venture);
        const newCompanies = new Map();
        for (const [name, arts] of companyMap) {
            if (!existingLeads.has(normalizeName(name))) {
                newCompanies.set(name, arts);
            }
            else {
                console.log(`  Skipping existing lead: ${name}`);
            }
        }
        console.log(`  ${newCompanies.size} new companies after dedup`);
        // Enrich + Score + Write
        for (const [companyName, arts] of newCompanies) {
            const ok = await processCompanyForVenture(companyName, arts, venture, importer, "Google Alerts");
            if (ok)
                stats.leadsWritten++;
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    if (stats.leadsWritten > 0) {
        await importer.flush();
    }
    // Archive processed emails
    if (shouldArchive && messageIds.length > 0) {
        stats.emailsArchived = await archiveEmails(messageIds);
    }
    await closeConnections();
    return stats;
}
// ─── CLI Entry Point ─────────────────────────────────────────────────────────
async function main() {
    const newerIdx = process.argv.indexOf("--newer");
    const newerThan = newerIdx !== -1 && process.argv[newerIdx + 1] ? process.argv[newerIdx + 1] : "7d";
    const noArchive = process.argv.includes("--no-archive");
    const stats = await ingestAlerts(undefined, { newerThan, archive: !noArchive });
    console.log(`\n=== Done ===`);
    console.log(`  Alert emails fetched: ${stats.emailsFetched}`);
    console.log(`  Reddit posts fetched: ${stats.redditPosts}`);
    console.log(`  HN posts fetched: ${stats.hnPosts}`);
    console.log(`  Articles total: ${stats.articlesParsed}`);
    console.log(`  Companies found: ${stats.companiesFound}`);
    console.log(`  New leads written: ${stats.leadsWritten}`);
    console.log(`  Emails archived: ${stats.emailsArchived}`);
}
// Only run main() when invoked directly (not imported by ingest-all)
const isDirectRun = process.argv[1]?.includes("google-alerts-ingester");
if (isDirectRun) {
    main().catch((err) => {
        console.error("Google Alerts ingestion failed:", err);
        process.exit(1);
    });
}
