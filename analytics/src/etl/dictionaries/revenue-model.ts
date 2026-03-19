export interface ProgramEntry {
  programId: string;
  name: string;
  fullName: string;
  annualRevenuePerPatient: number; // estimated annual $ per eligible patient
  eligibleSpecialties: string[]; // specialties most likely to qualify
  payerRequirement: string; // "medicare" | "medicare+commercial" | "all"
  description: string;
}

export const programs: ProgramEntry[] = [
  {
    programId: "ccm",
    name: "CCM",
    fullName: "Chronic Care Management",
    annualRevenuePerPatient: 795.6, // $66.30/mo x 12
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "geriatrics",
      "endocrinology",
      "cardiology",
      "pulmonology",
      "nephrology",
    ],
    payerRequirement: "medicare+commercial",
    description:
      "Monthly care management for patients with 2+ chronic conditions. Billable for non-face-to-face clinical staff time (care plans, medication management, coordination).",
  },
  {
    programId: "rpm",
    name: "RPM",
    fullName: "Remote Patient Monitoring",
    annualRevenuePerPatient: 1570.56, // device + monitoring + clinical time
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "cardiology",
      "endocrinology",
      "pulmonology",
      "nephrology",
    ],
    payerRequirement: "medicare+commercial",
    description:
      "Continuous remote monitoring of patient physiological data (BP, glucose, weight, SpO2). Requires FDA-cleared device and 16+ days of data/month.",
  },
  {
    programId: "apcm",
    name: "APCM",
    fullName: "Advanced Primary Care Management",
    annualRevenuePerPatient: 624.0, // avg $52/mo x 12 (moderate complexity)
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "geriatrics",
      "pediatrics",
    ],
    payerRequirement: "medicare",
    description:
      "New CMS program (2025) rewarding primary care for longitudinal patient management. Cannot be billed alongside CCM. Tiered by complexity (G0556/G0557/G0558).",
  },
  {
    programId: "tcm",
    name: "TCM",
    fullName: "Transitional Care Management",
    annualRevenuePerPatient: 480.08, // ~2 transitions/year avg
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "geriatrics",
      "hospitalist",
    ],
    payerRequirement: "medicare+commercial",
    description:
      "Post-discharge care coordination. Contact within 2 business days, face-to-face within 7 or 14 days. High reimbursement ($168-$240/episode).",
  },
  {
    programId: "awv",
    name: "AWV",
    fullName: "Annual Wellness Visit",
    annualRevenuePerPatient: 130.65, // subsequent visit rate
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "geriatrics",
    ],
    payerRequirement: "medicare",
    description:
      "Preventive visit with health risk assessment, screening schedule review, and advance care planning. Not a physical exam — focused on prevention plan.",
  },
  {
    programId: "mips",
    name: "MIPS",
    fullName: "Merit-based Incentive Payment System",
    annualRevenuePerPatient: 0, // adjustment, not direct revenue
    eligibleSpecialties: [
      "family medicine",
      "internal medicine",
      "geriatrics",
      "cardiology",
      "endocrinology",
      "orthopedic",
      "psychiatry",
      "surgery",
      "neurology",
      "ent",
      "pediatrics",
    ],
    payerRequirement: "medicare",
    description:
      "Performance-based payment adjustment of up to +/- 9% on Medicare Part B. Scored on Quality (30%), Cost (30%), Improvement Activities (15%), Promoting Interoperability (25%).",
  },
];

/** Maps skillId → program IDs that the skill supports or enables */
export interface SkillRevenueBridge {
  skillId: string;
  programs: string[];
  billingCodes: string[]; // codes this skill directly supports
  revenueRole: "enables" | "supports" | "automates";
}

export const skillRevenueMap: SkillRevenueBridge[] = [
  // -- CCM enablers --
  {
    skillId: "chronic-care-management",
    programs: ["ccm"],
    billingCodes: ["99490", "99439", "99491"],
    revenueRole: "enables",
  },
  {
    skillId: "care-plan-diabetes",
    programs: ["ccm"],
    billingCodes: ["99490"],
    revenueRole: "supports",
  },
  {
    skillId: "message-care-gap",
    programs: ["ccm", "awv", "mips"],
    billingCodes: ["99490", "G0439"],
    revenueRole: "supports",
  },

  // -- RPM enablers --
  // No shipped RPM skills yet — this maps future potential

  // -- APCM enablers --
  {
    skillId: "pre-visit-summary",
    programs: ["apcm", "awv"],
    billingCodes: ["G0556", "G0557", "G0558", "G0439"],
    revenueRole: "supports",
  },
  {
    skillId: "daily-briefing-header",
    programs: ["apcm"],
    billingCodes: ["G0557"],
    revenueRole: "supports",
  },
  {
    skillId: "screening-gap-analyzer",
    programs: ["awv", "mips"],
    billingCodes: ["G0438", "G0439"],
    revenueRole: "supports",
  },

  // -- TCM enablers --
  {
    skillId: "message-post-visit",
    programs: ["tcm"],
    billingCodes: ["99495", "99496"],
    revenueRole: "supports",
  },

  // -- Documentation / RCM --
  {
    skillId: "soap-note",
    programs: ["mips"],
    billingCodes: [],
    revenueRole: "supports",
  },
  {
    skillId: "icd10-suggester",
    programs: ["ccm", "mips"],
    billingCodes: [],
    revenueRole: "supports",
  },
  {
    skillId: "coding-optimization",
    programs: ["mips", "ccm"],
    billingCodes: [],
    revenueRole: "automates",
  },
  {
    skillId: "revenue-check",
    programs: ["ccm", "rpm", "apcm", "tcm", "awv", "mips"],
    billingCodes: [],
    revenueRole: "automates",
  },

  // -- Prior Auth --
  {
    skillId: "prior-auth-mri",
    programs: [],
    billingCodes: [],
    revenueRole: "automates",
  },
  {
    skillId: "prior-auth-specialty-drug",
    programs: [],
    billingCodes: [],
    revenueRole: "automates",
  },
  {
    skillId: "payer-policy-gap-finder",
    programs: [],
    billingCodes: [],
    revenueRole: "automates",
  },

  // -- Clinical --
  {
    skillId: "patient-education",
    programs: ["ccm", "awv"],
    billingCodes: [],
    revenueRole: "supports",
  },
  {
    skillId: "lab-results-explanation",
    programs: ["ccm"],
    billingCodes: [],
    revenueRole: "supports",
  },
];

/** Specialties dictionary for graph nodes */
export interface SpecialtyEntry {
  name: string;
  medicareHeavy: boolean; // high proportion of Medicare patients
  ccmPotential: "high" | "medium" | "low";
}

export const specialties: SpecialtyEntry[] = [
  { name: "Family Medicine", medicareHeavy: true, ccmPotential: "high" },
  { name: "Internal Medicine", medicareHeavy: true, ccmPotential: "high" },
  { name: "Geriatrics", medicareHeavy: true, ccmPotential: "high" },
  { name: "Cardiology", medicareHeavy: true, ccmPotential: "high" },
  { name: "Endocrinology", medicareHeavy: true, ccmPotential: "high" },
  { name: "Pulmonology", medicareHeavy: true, ccmPotential: "medium" },
  { name: "Nephrology", medicareHeavy: true, ccmPotential: "medium" },
  { name: "Psychiatry", medicareHeavy: false, ccmPotential: "medium" },
  { name: "Orthopedic", medicareHeavy: true, ccmPotential: "low" },
  { name: "Surgery", medicareHeavy: false, ccmPotential: "low" },
  { name: "ENT", medicareHeavy: false, ccmPotential: "low" },
  { name: "Neurology", medicareHeavy: true, ccmPotential: "medium" },
  { name: "Pediatrics", medicareHeavy: false, ccmPotential: "low" },
  { name: "Concierge", medicareHeavy: false, ccmPotential: "medium" },
  { name: "Hospitalist", medicareHeavy: true, ccmPotential: "low" },
];
