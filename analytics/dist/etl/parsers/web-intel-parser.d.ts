export interface WebIntelRecord {
    source: string;
    scrapedAt: string;
    company: string;
    product?: string;
    category: "ambient_scribe" | "revenue_cycle" | "clinical_ai" | "safe_ai" | "health_it" | "research";
    pricing?: string;
    features?: string[];
    doesNotDo?: string[];
    customerCount?: string;
    notableCustomers?: string[];
    positioning?: string;
    fundingInfo?: string;
}
export declare function parseWebIntel(): WebIntelRecord[];
