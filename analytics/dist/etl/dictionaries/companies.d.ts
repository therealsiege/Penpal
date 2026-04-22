export interface CompanyEntry {
    name: string;
    type: "competitor" | "ehr_vendor" | "platform" | "partner" | "own" | "employer";
    aliases?: string[];
    funding?: string;
    hq?: string;
}
export declare const companies: CompanyEntry[];
