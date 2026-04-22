export interface NPIRecord {
    npi: string;
    entityType: string;
    organizationName: string;
    providerLastName: string;
    providerFirstName: string;
    taxonomyCode: string;
    taxonomyDescription: string;
    practiceCity: string;
    practiceState: string;
    practiceZip: string;
    practiceAddress: string;
    isSoleProprietor: string;
    enumerationDate: string;
}
/**
 * Stream the NPPES CSV and collect records matching target taxonomies + states.
 * Used for sourcing new design partner prospects.
 */
export declare function streamNPIProspects(): Promise<NPIRecord[]>;
/**
 * Stream the NPPES CSV and attempt to match existing leads by org name + state.
 * Returns a map of normalized key -> NPIRecord for enrichment.
 */
export declare function enrichLeadsFromNPI(leads: Array<{
    name: string;
    company: string;
    state: string;
}>): Promise<Map<string, NPIRecord>>;
/**
 * Query the NPI Registry API for real-time enrichment.
 */
export declare function queryNPIApi(params: {
    organizationName?: string;
    firstName?: string;
    lastName?: string;
    state?: string;
    taxonomyDescription?: string;
    enumerationType?: string;
}): Promise<NPIRecord[]>;
/**
 * Batch query NPI API for a list of leads with 200ms delay between requests.
 */
export declare function batchQueryNPIApi(leads: Array<{
    name: string;
    company: string;
    state: string;
}>): Promise<Map<string, NPIRecord>>;
