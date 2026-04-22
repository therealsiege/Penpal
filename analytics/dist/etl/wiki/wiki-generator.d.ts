/**
 * wiki-generator.ts
 *
 * Generates high-value Knowledge Wiki pages using Claude synthesis.
 * Only creates pages for entities that actually matter — curated by
 * relationship count, lead score, or dictionary membership.
 *
 * Pages are LLM-synthesized intelligence, not formatted data dumps.
 */
import type { Session } from "neo4j-driver";
export interface WikiGeneratorOptions {
    clean?: boolean;
    types?: string[];
    /** Min relationships for companies (default: 3) */
    minCompanyRels?: number;
    /** Min lead score (default: 30) */
    minLeadScore?: number;
    /** Max leads to generate (default: 50) */
    maxLeads?: number;
}
export declare function generateWiki(session: Session, options?: WikiGeneratorOptions): Promise<{
    total: number;
    written: number;
    skipped: number;
}>;
