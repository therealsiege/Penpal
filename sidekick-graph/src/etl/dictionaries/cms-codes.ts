export interface BillingCodeEntry {
  code: string;
  description: string;
  rate: number; // CMS national average reimbursement in USD
  program: string; // parent program key
  frequency: "monthly" | "per-visit" | "annual" | "quarterly" | "per-episode";
  eligibility: string; // brief eligibility note
}

export const billingCodes: BillingCodeEntry[] = [
  // --- Chronic Care Management (CCM) ---
  {
    code: "99490",
    description: "CCM — first 20 min/month of clinical staff time",
    rate: 66.3,
    program: "ccm",
    frequency: "monthly",
    eligibility: "2+ chronic conditions expected to last 12+ months",
  },
  {
    code: "99439",
    description: "CCM — each additional 20 min/month",
    rate: 50.16,
    program: "ccm",
    frequency: "monthly",
    eligibility: "2+ chronic conditions, add-on to 99490",
  },
  {
    code: "99491",
    description: "CCM — first 30 min/month, physician-directed",
    rate: 97.56,
    program: "ccm",
    frequency: "monthly",
    eligibility: "2+ chronic conditions, physician-led (higher reimbursement)",
  },

  // --- Remote Patient Monitoring (RPM) ---
  {
    code: "99453",
    description: "RPM — initial device setup & patient education",
    rate: 19.32,
    program: "rpm",
    frequency: "per-episode",
    eligibility: "Acute or chronic condition requiring device monitoring",
  },
  {
    code: "99454",
    description: "RPM — device supply with daily recordings (30 days)",
    rate: 55.72,
    program: "rpm",
    frequency: "monthly",
    eligibility: "16+ days of data transmission per 30-day period",
  },
  {
    code: "99457",
    description: "RPM — first 20 min/month clinical staff time",
    rate: 50.94,
    program: "rpm",
    frequency: "monthly",
    eligibility: "Interactive communication with patient/caregiver",
  },
  {
    code: "99458",
    description: "RPM — each additional 20 min/month",
    rate: 42.22,
    program: "rpm",
    frequency: "monthly",
    eligibility: "Add-on to 99457",
  },
  {
    code: "99445",
    description: "RPM — lower-threshold remote monitoring (new 2025)",
    rate: 44.0,
    program: "rpm",
    frequency: "monthly",
    eligibility: "Reduced data-day threshold for qualifying practices",
  },

  // --- Advanced Primary Care Management (APCM) ---
  {
    code: "G0556",
    description: "APCM — low complexity, monthly",
    rate: 18.0,
    program: "apcm",
    frequency: "monthly",
    eligibility: "Primary care practice, 0-1 chronic conditions",
  },
  {
    code: "G0557",
    description: "APCM — moderate complexity, monthly",
    rate: 52.0,
    program: "apcm",
    frequency: "monthly",
    eligibility: "Primary care practice, 2+ chronic conditions, no CCM overlap",
  },
  {
    code: "G0558",
    description: "APCM — high complexity, monthly",
    rate: 86.0,
    program: "apcm",
    frequency: "monthly",
    eligibility: "Primary care practice, 2+ high-risk chronic conditions",
  },

  // --- Transitional Care Management (TCM) ---
  {
    code: "99495",
    description: "TCM — moderate complexity (14-day follow-up)",
    rate: 168.28,
    program: "tcm",
    frequency: "per-episode",
    eligibility: "Hospital/facility discharge, face-to-face within 14 days",
  },
  {
    code: "99496",
    description: "TCM — high complexity (7-day follow-up)",
    rate: 240.04,
    program: "tcm",
    frequency: "per-episode",
    eligibility: "Hospital/facility discharge, face-to-face within 7 days",
  },

  // --- Annual Wellness Visit (AWV) ---
  {
    code: "G0438",
    description: "AWV — initial visit (new Medicare patient)",
    rate: 185.64,
    program: "awv",
    frequency: "annual",
    eligibility: "Medicare beneficiary, first AWV",
  },
  {
    code: "G0439",
    description: "AWV — subsequent annual visit",
    rate: 130.65,
    program: "awv",
    frequency: "annual",
    eligibility: "Medicare beneficiary, prior AWV on file",
  },

  // --- MIPS Quality Measures (selected high-impact) ---
  {
    code: "MIPS-001",
    description: "MIPS — Diabetes HbA1c Poor Control (quality measure)",
    rate: 0,
    program: "mips",
    frequency: "annual",
    eligibility: "Diabetes patients, HbA1c > 9% (inverse measure)",
  },
  {
    code: "MIPS-236",
    description: "MIPS — Controlling High Blood Pressure",
    rate: 0,
    program: "mips",
    frequency: "annual",
    eligibility: "Hypertension patients 18-85",
  },
  {
    code: "MIPS-COST",
    description: "MIPS — Payment adjustment (up to +/- 9%)",
    rate: 0,
    program: "mips",
    frequency: "annual",
    eligibility: "All Medicare Part B clinicians above low-volume threshold",
  },
];
