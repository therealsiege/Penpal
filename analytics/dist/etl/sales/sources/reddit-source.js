// Reddit source module — fetches posts from healthcare subreddits via public JSON API
const SUBREDDITS = ["healthIT", "medicine", "EHR", "healthinformatics"];
const SEARCH_TERMS = [
    "AI HIPAA",
    "PHI AI",
    "AI documentation physician",
    "FHIR startup",
    "EHR integration",
    "clinical AI",
    "ambient scribe",
];
const USER_AGENT = "sidekick-lead-ingester/1.0";
const DELAY_MS = 200;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
export async function fetchRedditPosts() {
    const seen = new Set();
    const posts = [];
    for (const subreddit of SUBREDDITS) {
        for (const query of SEARCH_TERMS) {
            try {
                const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25&t=week`;
                const res = await fetch(url, {
                    headers: { "User-Agent": USER_AGENT },
                });
                if (!res.ok) {
                    console.warn(`  Reddit search failed (${res.status}): r/${subreddit} "${query}"`);
                    await sleep(DELAY_MS);
                    continue;
                }
                const data = (await res.json());
                const children = data?.data?.children || [];
                for (const child of children) {
                    const d = child.data;
                    if (seen.has(d.id))
                        continue;
                    seen.add(d.id);
                    posts.push({
                        title: d.title,
                        url: `https://www.reddit.com${d.permalink}`,
                        externalUrl: d.is_self ? "" : d.url,
                        subreddit: d.subreddit,
                        author: d.author,
                        score: d.score,
                        selftext: d.selftext,
                        createdAt: new Date(d.created_utc * 1000).toISOString(),
                        keyword: query,
                    });
                }
            }
            catch (err) {
                console.warn(`  Reddit fetch error for r/${subreddit} "${query}":`, err.message);
            }
            await sleep(DELAY_MS);
        }
    }
    console.log(`  Reddit: ${posts.length} posts from ${SUBREDDITS.length} subreddits`);
    return posts;
}
