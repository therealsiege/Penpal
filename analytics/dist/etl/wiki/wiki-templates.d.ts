/**
 * wiki-templates.ts
 *
 * Lightweight markdown templates for entity types that don't benefit
 * from LLM synthesis (practices, markets). High-value entities use
 * wiki-synthesizer.ts instead.
 */
export declare function practicePage(pr: {
    name: string;
    npi: string;
    address: string;
    specialty: string;
    practiceCity: string;
    practiceState: string;
    practiceZip: string;
    leads: string[];
    specialties: string[];
    programs: string[];
}): string;
export declare function marketPage(m: {
    name: string;
    description: string;
    documents: Array<{
        title: string;
    }>;
    companies: string[];
}): string;
