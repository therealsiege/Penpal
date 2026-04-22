import { type VentureProfile } from "./venture-config.js";
export declare function ingestRss(targetVentures?: VentureProfile[]): Promise<{
    feedsFetched: number;
    articlesTotal: number;
    articlesNew: number;
    companiesFound: number;
    leadsWritten: number;
}>;
