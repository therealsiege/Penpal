# Risk Adjustment and HCC Capture Mapping Markets: Why every provider should care about risk adjustment

**Date:** February 6, 2026

**Categories:** Risk Adjustment and HCC Capture

---

Colin DuRant

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email [here](https://elion.health/#signup)._

What was once considered primarily a population health function now sits at the center of modern care economics: Risk adjustment determines how CMS and health plans pay for patient complexity, so for Medicare Advantage plans and risk-bearing providers, accurate Hierarchical Condition Category (HCC) capture drives billions in revenue. But for traditional fee-for-service providers, it also now affects network participation, quality scores, and administrative burden.

The financial impact is direct and measurable. Medicare Advantage now [covers](https://www.kff.org/medicare/medicare-advantage-in-2024-enrollment-update-and-key-trends/) over half of Medicare beneficiaries in a $462 billion market. A single patient's documented severity can [swing](https://www.commonwealthfund.org/publications/explainer/2026/jan/how-risk-adjustment-affects-payment-medicare-advantage-plans) annual capitated payments dramatically based on HCC specificity. For ACOs, risk scores set spending benchmarks. Fail to re-document chronic conditions each year and your benchmark drops by thousands of dollars per patient, making shared savings nearly impossible to achieve.

The opportunity comes with significant compliance risk. Federal audits [identified](https://www.cms.gov/newsroom/fact-sheets/fiscal-year-2025-improper-payments-fact-sheet) over $15 billion in improper MA payments from unsupported diagnoses. Kaiser Permanente's $556 million False Claims Act [settlement](https://www.justice.gov/opa/pr/kaiser-permanente-affiliates-pay-556m-resolve-false-claims-act-allegations) demonstrated the legal consequences of documentation failures. This creates the central tension: Providers must capture every legitimate diagnosis to secure appropriate reimbursement, but documentation must withstand audit scrutiny or expose the organization to recoupment and penalties.

Even providers without direct financial risk cannot ignore HCC documentation. If you treat MA patients but fail to document their chronic conditions, payer analytics show you consuming resources on apparently healthy patients, making you look inefficient compared to peers. In competitive markets, plans [use](https://www.mckinsey.com/industries/healthcare/our-insights/maximizing-the-value-in-value-networks-and-value-based-payment) these metrics to narrow networks. For traditional Medicare providers, the [Merit-based Incentive Payment System](https://qpp.cms.gov/get-started/what-is-mips/about-mips) (MIPS) uses HCC-based risk adjustment in cost measures, affecting Part B payment adjustments. Poor documentation also invites administrative interference through frequent chart requests and retrospective audits.

[Risk Adjustment and HCC Capture](https://elion.health/categories/risk-adjustment-and-hcc-capture/products) solutions help provider organizations identify and close these documentation gaps across Medicare Advantage and other risk-based programs (MSSP/ACOs, ACO REACH, Medicaid managed care, commercial risk arrangements). These platforms surface suspected or unrecaptured chronic conditions using clinical and administrative signals: prior-year diagnoses requiring annual recapture, medication fills suggesting undocumented conditions (insulin without diabetes codes), lab results indicating disease progression. They support the workflows needed to confirm supporting evidence and close gaps through pre-visit planning tools, point-of-care prompts embedded in clinical workflows, and coding validation queues with traceable documentation support.

# How risk adjustment works

Risk adjustment translates a patient's documented medical conditions into a numeric score predicting healthcare costs. While a number of risk adjustment schemes exist, the primary system used is the [HCC model](https://www.aafp.org/family-physician/practice-and-career/getting-paid/coding/hierarchical-condition-category.html). Hierarchical Condition Categories (HCCs) map ICD-10 diagnosis codes to risk weights. The "hierarchical" structure means if multiple diagnosis codes fall within the same disease family, only the most severe condition counts toward the patient's [Risk Adjustment Factor](https://currents.neurocriticalcare.org/Leading-Insights/Article/the-business-of-neurocritical-care-understanding-risk-adjustment-factor-raf-scores-and-their-impact-on-reimbursement) (RAF) score. For instance, "diabetes with chronic complications" (HCC 18, coefficient 0.318) supersedes "diabetes without complication" (HCC 19, coefficient 0.104). This RAF score determines capitated payments and shared savings benchmarks.

The critical compliance requirement: Every HCC must be supported by documentation showing the condition was assessed and managed during a face-to-face encounter. The industry anchors on [MEAT](https://www.aapc.com/blog/41212-include-meat-in-your-risk-adjustment-documentation/) criteria (Monitor, Evaluate, Assess, Treat) as the standard for audit defense. A federal audit found approximately 70% of certain MA diagnosis codes lacked required supporting documentation, the primary source of improper payments and [False Claims Act exposure](https://www.cms.gov/outreach-and-education/medicare-learning-network-mln/mlnproducts/downloads/fraud-abuse-mln4649244.pdf).

# The V28 transition and RADV tightening reshape the market

CMS's new [HCC Model V28](https://keebler.health/understanding-hcc-v28/) phases in through 2026 and represents the most significant regulatory change in the category. The model removes roughly 2,300 diagnosis codes that previously contributed to risk scores, including stable angina, remission-stage depression, and other common conditions.

For MA plans, this creates immediate financial pressure as legacy codes stop generating revenue. Plans are responding by demanding more rigorous documentation from network providers and conducting aggressive gap closure campaigns. Provider organizations participating in MA networks or operating their own plans face a choice: invest now in analytics mapping patient populations to V28 impacts and identifying compliant alternative documentation pathways, or accept revenue declines when the transition completes.

The regulatory environment is tightening simultaneously. CMS's 2023 [Risk Adjustment Data Validation](https://www.cms.gov/data-research/monitoring-programs/medicare-risk-adjustment-data-validation-program)(RADV) audit rule allows the agency to extrapolate overpayment findings from sample audits to an organization's entire book of business. Previously, plans could argue for statistical adjustments that limited liability. Now, unsupported codes in a sample can trigger recoupment demands worth millions across the full population. This increases compliance pressure on providers to maintain audit-ready documentation trails.

Technology capabilities are maturing to meet these demands. Natural language processing can now scan unstructured EHR notes to identify clinical evidence of undocumented conditions. The [HL7 Da Vinci Risk Adjustment FHIR Implementation Guide](https://build.fhir.org/ig/HL7/davinci-ra/) creates standardized pathways for payers and providers to exchange gap information, moving away from proprietary file formats and enabling real-time collaboration.

# Vendor landscape

The market divides into three primary solution types based on where they intervene in the risk adjustment workflow and who they serve. Despite vendor consolidation, most platforms retain core strength in their original category, and organizations often deploy multiple solutions to address different workflow stages. Many vendors also combine risk adjustment capabilities with quality and care gap closure solutions for HEDIS and Stars programs, recognizing that the workflows overlap significantly.

## **Retrospective coding and audit defense platforms**

**What they solve:** These platforms support medical coders and compliance teams in post-encounter workflows. They provide AI-assisted chart review to validate that submitted diagnosis codes are fully supported by clinical documentation and prepare organizations for RADV audits.

**How they work:** Coders access patient charts through the platform, which uses NLP to highlight text supporting specific HCC codes or flag documentation gaps. If clinical notes mention a condition without treatment evidence (like "history of heart failure" without current management details), the system prompts coders to query the provider for clarification. The platforms maintain audit trails linking every submitted code to supporting documentation.

These solutions excel at year-end "sweep" activities where teams re-review closed charts to find documented but uncoded conditions before final submission deadlines. They defend revenue already captured but address symptoms (missed codes) rather than root causes (point-of-care documentation quality).

**Notable vendors:** [Edifecs Risk Adjustment Suite](https://elion.health/products/edifecs), [Reveleer](https://elion.health/products/reveleer), [Episource](https://elion.health/products/episource), [Advantmed](https://elion.health/products/advantmed)

## **Prospective point-of-care workflow tools**

**What they solve:** These clinician-facing platforms surface suspected or unrecaptured diagnoses directly within EHR workflows, enabling physicians to address and document conditions in real time during patient visits.

**How they work:** Before or during encounters, the system displays suspected conditions with supporting clinical evidence (recent labs, medication fills, prior notes) so providers can evaluate and document without leaving their normal workflow. The technical challenge is avoiding alert fatigue. Platforms generating too many false positives or cluttering screens with low-value prompts get ignored. Successful tools build provider trust by showing the evidence behind each suggestion rather than just asserting a patient "may have diabetes."

Integration depth matters significantly. [Best Practice Alerts](https://healthjournalism.org/glossary-terms/best-practice-alert-bpa/) firing during active encounters drive higher adoption than post-visit tools requiring physicians to re-open charts. Provider adoption increases when workflows feel like clinical decision support rather than administrative burden.

**Notable vendors:** [Navina](https://elion.health/products/navina), [ForeSee Medical](https://elion.health/products/foresee-medical), [Persivia](https://elion.health/products/persivia-carespace), [Vatica Health](https://elion.health/products/vatica-health)

## **End-to-end analytics and population health platforms**

**What they solve:** These enterprise systems aggregate data from claims, EHRs, and health information exchanges to provide organization-wide visibility into risk adjustment performance. They generate suspect condition lists, track RAF score trends, and help Population Health executives identify at-risk populations.

**How they work:** The platforms pull data from multiple sources to create unified patient views, then apply algorithms to prioritize gaps by financial impact. Executives use dashboards to monitor gap closure rates by clinic and provider, model V28 transition impacts, and identify documentation improvement opportunities across service lines.

These platforms provide the population-level analytics and strategic visibility that drive decision-making. While they can surface suspected conditions through EHR alerts and notifications, organizations often layer dedicated point-of-care workflow tools to achieve higher clinician engagement and gap closure rates.

**Notable vendors:** [Arcadia](https://elion.health/products/arcadia-io), [Innovaccer](https://elion.health/products/innovaccer), [Lightbeam Health Solutions](https://elion.health/products/lightbeam-health-solutions)

## **Additional market segments**

Beyond these core software platforms, several adjacent categories support risk adjustment operations:

**Services-based solutions:** Some organizations outsource chart retrieval, offshore coding teams, or in-home health assessments. These services-heavy models appeal to smaller practices or systems with severe resource constraints, though they typically carry higher per-encounter costs than software-only approaches.

**Clinical Documentation Improvement (CDI) vendors:** Traditional [CDI](https://elion.health/categories/clinical-documentation-integrity-cdi/products) platforms are increasingly adding HCC capture capabilities, recognizing the overlap in documentation quality improvement workflows.

---
*Source: [Elion Health](https://elion.health/resources/risk-adjustment-hcc-capture-market-map)*