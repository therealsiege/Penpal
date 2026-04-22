import { GraphImporter } from "../graph/importer.js";
import type { VentureProfile } from "./venture-config.js";
export interface SourceArticle {
    title: string;
    url: string;
    source: string;
    snippet: string;
    keyword: string;
}
export interface EnrichedLead {
    companyName: string;
    description: string;
    fundingStage: string;
    employeeCount: string;
    techStack: string[];
    decisionMaker: string;
    sourceArticles: SourceArticle[];
    score: number;
    priority: string;
    venture: VentureProfile;
}
export interface EnrichmentResult {
    description: string;
    fundingStage: string;
    employeeCount: string;
    techStack: string[];
    decisionMaker: string;
    location: string;
}
export declare function extractCompanies(articles: SourceArticle[], venture: VentureProfile): Promise<Map<string, SourceArticle[]>>;
export declare function getExistingLeadNames(venture: VentureProfile): Set<string>;
export declare function enrichWithFirecrawl(companyName: string): Promise<EnrichmentResult>;
export declare function writeLeadMarkdown(lead: EnrichedLead, leadSource: string): string;
export declare function pushLeadToGraph(importer: GraphImporter, lead: EnrichedLead, docRelPath: string, leadSource: string): Promise<void>;
export declare function processCompanyForVenture(companyName: string, articles: SourceArticle[], venture: VentureProfile, importer: GraphImporter, leadSource: string): Promise<boolean>;
