/**
 * ACGME Residency Program Scraper
 *
 * Scrapes the ACGME Accreditation Data System (ADS) for residency programs
 * in target states and specialties. Each program yields:
 *   - Program name, org code, address, phone, email, website
 *   - Program Director name + appointment date
 *   - Coordinator name, phone, email
 *   - Accreditation status, approved/filled positions
 *   - Participating site names
 *
 * Data source: https://apps.acgme.org/ads/Public/Programs/Search
 *
 * Usage:
 *   npm run acgme:scrape
 *   npm run acgme:scrape -- --dry-run
 *   npm run acgme:scrape -- --state TX --specialty fm
 */
import "dotenv/config";
export interface ACGMEProgram {
    orgCode: string;
    programName: string;
    specialty: string;
    city: string;
    state: string;
    address: string;
    zip: string;
    website: string;
    phone: string;
    email: string;
    directorName: string;
    directorSince: string;
    coordinatorName: string;
    coordinatorPhone: string;
    coordinatorEmail: string;
    accreditationStatus: string;
    accreditationDate: string;
    approvedPositions: number;
    filledPositions: number;
    trainYears: number;
    participatingSites: string[];
    sponsoringInstitution: string;
    scrapedAt: string;
}
export declare function scrapeACGME(opts?: {
    states?: string[];
    specialties?: string[];
    dryRun?: boolean;
}): Promise<ACGMEProgram[]>;
/** Save scraped data to JSON for caching / inspection. */
export declare function saveACGMEData(programs: ACGMEProgram[], outPath: string): void;
