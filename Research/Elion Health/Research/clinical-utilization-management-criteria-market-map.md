# Clinical & Utilization Management Criteria Mapping Markets: The logic layer no one talks about

**Date:** January 20, 2026

**Categories:** Clinical and Utilization Management Criteria Datasets

---

Colin DuRant

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email [here](https://elion.health/#signup)._

The healthcare IT market is awash in [prior authorization automation platforms](https://elion.health/categories/prior-authorization/products), [AI-driven denial prevention tools](https://elion.health/categories/denials-management/products), and EHR-integrated [clinical decision support](https://elion.health/categories/clinical-decision-support-cds/products). But every one of these systems shares a critical dependency: They require clinical criteria content to function. Without licensed access to InterQual, MCG, or similar datasets, these tools are empty shells with no logic to execute.

As a result, hospitals pay substantial licensing fees to access the same criteria datasets their payers use. The rationale is that if [utilization review](https://elion.health/categories/provider-utilization-review/products) (UR) nurses apply the same rulebook the payer will use during claims review, denials decrease. With national hospital denial rates at [11%,](https://www.ama-assn.org/practice-management/prior-authorization/health-systems-plagued-payer-takeback-schemes-110000) each percentage point represents meaningful lost revenue for large systems. And while many denials are preventable and recoverable on appeal, both outcomes generally require demonstrating the case met recognized clinical criteria in the first place.

# Defining the Clinical & UM Criteria Category

[Clinical and UM criteria datasets](https://elion.health/categories/clinical-and-utilization-management-criteria-datasets/products) are machine-consumable libraries encoding evidence-based rules for medical necessity determinations. These datasets define when patients meet clinical thresholds for specific services, care settings, or interventions, from inpatient admission versus observation to complex surgical procedure authorization. They serve as the knowledge layer that powers utilization review, prior authorization, and claims adjudication workflows for both providers and payers.

Solutions we consider to be within the bounds of this category are curated content libraries delivered as APIs, files, or embedded knowledge bases. These include nationally recognized criteria sets and specialty-specific guidelines (ASAM for addiction medicine, NCCN for oncology). The datasets themselves typically include diagnosis and procedure code mappings, clinical indication requirements, decision logic with rationale text, and versioning with change logs.

Criteria access models vary, often requiring licensing for commercial use, regulatory compliance, or integration. Implementation occurs via direct API, file delivery, or vendor partnerships for EHR integration. Organizations using EHR-integrated versions generally need content rights from the criteria owner and a platform agreement with the software vendor.

# **Current State: The Criteria Fragmentation Problem**

The central tension in this market is that payer-specific criteria create a fragmented landscape, forcing providers into defensive licensing strategies. Different plans require different standards: Many payers use MCG, while others may mandate InterQual, and some plans develop internal guidelines.

For Medicare, the framework is meaningfully different. As an example, traditional Medicare determines inpatient vs. outpatient status using the [Two-Midnight Rule](https://www.cms.gov/newsroom/fact-sheets/fact-sheet-two-midnight-rule-0) and related CMS guidance, rather than commercial medical-necessity criteria, and [coverage](https://www.cms.gov/medicare/coverage/determination-process) itself is governed by statute, National Coverage Determinations (NCDs), Local Coverage Determinations (LCDs), and longstanding “reasonable and necessary” standards. Medicare Advantage plans are required to provide coverage that is no more restrictive than traditional Medicare and must base medical-necessity decisions on the same Medicare coverage policies.

This payer-by-payer variation creates operational chaos. A hospital's largest commercial payer might use MCG while their Medicaid contract requires InterQual, forcing UR departments to maintain proficiency in multiple criteria sets simultaneously. When UnitedHealthcare [switched](https://www.hbma.org/news/commercial-payor-news/insurance-company-news/united/n_june-unitedhealthcare-news-reminder-we-transitioned-to-interqual-on-may-1) from MCG to InterQual in 2021, hospitals [faced](https://revenuecycleadvisor.com/news-analysis/qa-new-unitedhealthcare-guidelines) retraining of UR staff on different clinical benchmarks and decision trees.

The January 2026 CMS [mandate](https://elion.health/resources/cms-2026-prior-authorization-rule-explained) on payers for FHIR-based prior authorization APIs (Coverage Requirements Discovery and Documentation Templates and Rules) will expose this misalignment more acutely. The APIs return structured questionnaires specifying what documentation payers need: diagnosis codes, recent vitals, proof of conservative therapy trials. But these new APIs still don’t expose the underlying criteria logic used to evaluate medical necessity. Providers still need to: license criteria to understand what "meets criteria" looks like, document proactively rather than reactively, and train automation systems to predict denials before submission.

For hospitals, criteria licensing represents insurance against revenue loss. An annual license for guidelines licensing is negligible compared to millions in preventable denials.

# **Market Landscape**

**Comprehensive criteria vendors** maintain foundational evidence-based libraries spanning the care continuum. [InterQual](https://elion.health/products/optum-interqual-criteria) (Optum) serves over 3,700 healthcare organizations. [MCG](https://elion.health/products/mcg-care-guidelines) (Hearst Health) is used by over 1,900 hospitals and many of the largest U.S. health plans. [Apollo Managed Care](https://elion.health/products/apollo-managed-care) positions as a lower-cost alternative for smaller health plans and IPAs. These datasets form the baseline for payer-provider negotiations over medical necessity definitions and set the clinical thresholds that determine reimbursement.

**Specialty and niche criteria developers** produce authoritative guidelines for domains where general criteria fall short. Professional societies typically own and maintain these datasets, establishing them as de facto standards for specific service lines. [ASAM Criteria](https://elion.health/products/asam-criteria) covers substance use disorder level-of-care decisions across the addiction treatment continuum. [NCCN Guidelines](https://elion.health/products/nccn-guidelines) and NCCN Compendium provide oncology treatment appropriateness standards and drug/biologic evidence, with NCCN Templates offering chemotherapy order protocols. [ACR Appropriateness Criteria](https://elion.health/products/american-college-of-radiology) establishes imaging appropriateness standards for advanced diagnostic procedures. [LOCUS](https://elion.health/products/deerfield-solutions-locus-calocus) and CALOCUS-CASII guide behavioral health placement decisions for adults and children respectively.

# **Looking Ahead**

The 2026 CMS mandate will accelerate pressure for criteria standardization. When payer requirements become queryable in real-time, the absurdity of maintaining multiple criteria sets for the same clinical scenarios becomes operationally untenable. This foreshadows either greater transparency in criteria or further consolidation.

More fundamental is how criteria content must evolve. Current datasets focus on diagnosis codes, procedure codes, and clinical history. Next-generation criteria must incorporate social determinants of health for equity-adjusted guidelines and genomic or biomarker data for precision medicine treatments.

The underlying question for hospitals is changing from "Which criteria set minimizes our denials?" to "How do we build documentation and automation workflows that adapt to each payer's criteria requirements without drowning our UR staff in complexity?"

---
*Source: [Elion Health](https://elion.health/resources/clinical-utilization-management-criteria-market-map)*