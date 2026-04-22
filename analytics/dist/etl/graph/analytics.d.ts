/** Run MAGE community detection and store communityId on nodes */
export declare function runCommunityDetection(): Promise<void>;
/** Run PageRank and store pageRank score on nodes */
export declare function runPageRank(): Promise<void>;
/** Run betweenness centrality and store centrality score on nodes */
export declare function runBetweennessCentrality(): Promise<void>;
/** Run all MAGE analytics post-import */
export declare function runAllAnalytics(): Promise<void>;
