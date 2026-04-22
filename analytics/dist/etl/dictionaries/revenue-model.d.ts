export interface ProgramEntry {
    programId: string;
    name: string;
    fullName: string;
    annualRevenuePerPatient: number;
    eligibleSpecialties: string[];
    payerRequirement: string;
    description: string;
}
export declare const programs: ProgramEntry[];
/** Maps skillId → program IDs that the skill supports or enables */
export interface SkillRevenueBridge {
    skillId: string;
    programs: string[];
    billingCodes: string[];
    revenueRole: "enables" | "supports" | "automates";
}
export declare const skillRevenueMap: SkillRevenueBridge[];
/** Specialties dictionary for graph nodes */
export interface SpecialtyEntry {
    name: string;
    medicareHeavy: boolean;
    ccmPotential: "high" | "medium" | "low";
}
export declare const specialties: SpecialtyEntry[];
