export interface CRMRecord {
    name: string;
    company: string | null;
    location: string | null;
    jobTitle: string | null;
    type: string | null;
    salesFunnel: string | null;
    priority: string | null;
    emr: string | null;
    leadSource: string | null;
    bio: string | null;
    notes: string | null;
    nextAction: string | null;
    businessArm: string | null;
    htnMember: boolean;
    dealSize: string | null;
    email: string | null;
    linkedIn: string | null;
    createdAt: string | null;
}
export declare function parseCRMCsv(filePath: string): CRMRecord[];
export interface ReferenceRecord {
    name: string;
    category: string | null;
    url: string | null;
    status: string | null;
    tags: string | null;
    notes: string | null;
    employment: boolean;
    createdAt: string | null;
}
export declare function parseReferencesCsv(filePath: string): ReferenceRecord[];
