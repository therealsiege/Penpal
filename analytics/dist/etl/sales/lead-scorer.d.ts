import type { ScoringProfile } from "./venture-config.js";
export interface LeadScoreInput {
    createdAt: string;
    notes: string;
    bio: string;
    emr: string;
    htnMember: boolean;
    businessArm: string;
    salesFunnel: string;
    priority: string;
    jobTitle?: string;
    type?: string;
    location?: string;
}
/** Score a lead based on multiple signals. Returns 0-100. */
export declare function scoreLead(input: LeadScoreInput, profile?: ScoringProfile): number;
