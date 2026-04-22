export interface RssFeed {
    url: string;
    name: string;
}
export type ScoringProfile = "clinical" | "integration" | "consulting";
export interface VentureProfile {
    name: string;
    slug: string;
    leadsDir: string;
    alertKeywords: string[];
    rssFeeds: RssFeed[];
    scoringProfile: ScoringProfile;
    companyExtractionPrompt: string;
}
export declare const ventureProfiles: Record<string, VentureProfile>;
/** Get a venture profile by slug. Returns undefined if not found. */
export declare function getVentureProfile(slug: string): VentureProfile | undefined;
/** Get all venture slugs. */
export declare function getVentureSlugs(): string[];
/**
 * Route an alert keyword to matching venture(s).
 * Returns all ventures whose alertKeywords include a case-insensitive substring match.
 */
export declare function routeAlertKeyword(keyword: string): VentureProfile[];
export declare function routeArticleToVentures(title: unknown, content: unknown): VentureProfile[];
/** Business arm display string for a venture. */
export declare function businessArmLabel(profile: VentureProfile): string;
/** Parse --venture flag from process.argv */
export declare function parseVentureFlag(): string | null;
/** Get filtered venture profiles based on --venture flag. Returns all if no flag. */
export declare function getTargetVentures(): VentureProfile[];
