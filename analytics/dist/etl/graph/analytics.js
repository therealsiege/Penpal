import { getSession } from "../../shared/connections.js";
/** Run MAGE community detection and store communityId on nodes */
export async function runCommunityDetection() {
    const session = getSession();
    try {
        // Use Louvain community detection from MAGE
        await session.run(`
      CALL community_detection.get()
      YIELD node, community_id
      SET node.communityId = community_id
    `);
        console.log("  Community detection complete");
    }
    catch (err) {
        console.warn("  Warning: Community detection failed (MAGE may not be available):", err);
    }
    finally {
        await session.close();
    }
}
/** Run PageRank and store pageRank score on nodes */
export async function runPageRank() {
    const session = getSession();
    try {
        await session.run(`
      CALL pagerank.get()
      YIELD node, rank
      SET node.pageRank = rank
    `);
        console.log("  PageRank complete");
    }
    catch (err) {
        console.warn("  Warning: PageRank failed (MAGE may not be available):", err);
    }
    finally {
        await session.close();
    }
}
/** Run betweenness centrality and store centrality score on nodes */
export async function runBetweennessCentrality() {
    const session = getSession();
    try {
        await session.run(`
      CALL betweenness_centrality.get(FALSE, FALSE)
      YIELD node, betweenness_centrality
      SET node.centrality = betweenness_centrality
    `);
        console.log("  Betweenness centrality complete");
    }
    catch (err) {
        console.warn("  Warning: Betweenness centrality failed (MAGE may not be available):", err);
    }
    finally {
        await session.close();
    }
}
/** Run all MAGE analytics post-import */
export async function runAllAnalytics() {
    console.log("\n--- Running MAGE graph analytics ---");
    await runCommunityDetection();
    await runPageRank();
    await runBetweennessCentrality();
}
