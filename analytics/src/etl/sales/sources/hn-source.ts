// Hacker News source module — fetches posts via Algolia API (no auth)

export interface HNPost {
  title: string;
  url: string;
  author: string;
  points: number;
  createdAt: string;
  keyword: string;
  type: "job" | "story";
}

interface HNQuery {
  query: string;
  tag: "job" | "story";
}

const QUERIES: HNQuery[] = [
  { query: "healthcare FHIR", tag: "job" },
  { query: "health tech HIPAA", tag: "story" },
  { query: "clinical AI startup", tag: "story" },
  { query: "EHR integration startup", tag: "story" },
  { query: "digital health FHIR", tag: "story" },
];

export async function fetchHNPosts(): Promise<HNPost[]> {
  const seen = new Set<string>();
  const posts: HNPost[] = [];

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  for (const { query, tag } of QUERIES) {
    try {
      const cutoff = tag === "job" ? thirtyDaysAgo : sevenDaysAgo;
      const endpoint =
        tag === "job"
          ? "https://hn.algolia.com/api/v1/search_by_date"
          : "https://hn.algolia.com/api/v1/search";

      const url = `${endpoint}?query=${encodeURIComponent(query)}&tags=${tag}&numericFilters=created_at_i>=${cutoff}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.warn(`  HN search failed (${res.status}): "${query}" [${tag}]`);
        continue;
      }

      const data = (await res.json()) as {
        hits?: Array<{
          objectID: string;
          title: string;
          url: string;
          author: string;
          points: number;
          created_at: string;
        }>;
      };

      for (const hit of data.hits || []) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);

        posts.push({
          title: hit.title || "",
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          author: hit.author || "",
          points: hit.points || 0,
          createdAt: hit.created_at || "",
          keyword: query,
          type: tag,
        });
      }
    } catch (err) {
      console.warn(`  HN fetch error for "${query}" [${tag}]:`, (err as Error).message);
    }
  }

  console.log(`  HN: ${posts.length} posts (${QUERIES.filter((q) => q.tag === "job").length} job queries, ${QUERIES.filter((q) => q.tag === "story").length} story queries)`);
  return posts;
}
