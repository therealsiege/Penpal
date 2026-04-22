import { type VentureProfile } from "./venture-config.js";
export declare function ingestAlerts(targetVentures?: VentureProfile[], options?: {
    newerThan?: string;
    archive?: boolean;
}): Promise<{
    emailsFetched: number;
    redditPosts: number;
    hnPosts: number;
    articlesParsed: number;
    companiesFound: number;
    leadsWritten: number;
    emailsArchived: number;
}>;
