import { getTargetVentures } from "./venture-config.js";
import { ingestAlerts } from "./google-alerts-ingester.js";
import { ingestRss } from "./rss-ingester.js";
function parseSourceFlag() {
    const idx = process.argv.indexOf("--source");
    if (idx === -1 || idx + 1 >= process.argv.length)
        return null;
    return process.argv[idx + 1].toLowerCase();
}
async function main() {
    const ventures = getTargetVentures();
    const sourceFilter = parseSourceFlag();
    console.log("╔══════════════════════════════════════╗");
    console.log("║   Unified Lead Ingestion Runner      ║");
    console.log("╚══════════════════════════════════════╝");
    console.log(`  Ventures: ${ventures.map((v) => v.name).join(", ")}`);
    console.log(`  Source: ${sourceFilter || "all"}\n`);
    const runAlerts = !sourceFilter || sourceFilter === "alerts";
    const runRss = !sourceFilter || sourceFilter === "rss";
    let alertStats = { emailsFetched: 0, redditPosts: 0, hnPosts: 0, articlesParsed: 0, companiesFound: 0, leadsWritten: 0, emailsArchived: 0 };
    let rssStats = { feedsFetched: 0, articlesTotal: 0, articlesNew: 0, companiesFound: 0, leadsWritten: 0 };
    if (runAlerts) {
        console.log("\n━━━ Google Alerts + Reddit + HN ━━━\n");
        alertStats = await ingestAlerts(ventures);
    }
    if (runRss) {
        console.log("\n━━━ RSS Feeds ━━━\n");
        rssStats = await ingestRss(ventures);
    }
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║          Summary                     ║");
    console.log("╚══════════════════════════════════════╝");
    if (runAlerts) {
        console.log(`  Alerts: ${alertStats.emailsFetched} emails, ${alertStats.redditPosts} reddit, ${alertStats.hnPosts} HN → ${alertStats.leadsWritten} leads`);
    }
    if (runRss) {
        console.log(`  RSS: ${rssStats.feedsFetched} feeds, ${rssStats.articlesNew} new articles → ${rssStats.leadsWritten} leads`);
    }
    console.log(`  Total leads written: ${alertStats.leadsWritten + rssStats.leadsWritten}`);
}
main().catch((err) => {
    console.error("Unified ingestion failed:", err);
    process.exit(1);
});
