export interface BillingCodeEntry {
    code: string;
    description: string;
    rate: number;
    program: string;
    frequency: "monthly" | "per-visit" | "annual" | "quarterly" | "per-episode";
    eligibility: string;
}
export declare const billingCodes: BillingCodeEntry[];
