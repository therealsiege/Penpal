import { ParsedDocument } from "./markdown-parser.js";
export interface ParsedLead {
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
    previousAttempts: boolean;
    linkedIn: string | null;
    email: string | null;
    createdAt: string | null;
}
export declare function parseLeadFromDocument(doc: ParsedDocument): ParsedLead | null;
