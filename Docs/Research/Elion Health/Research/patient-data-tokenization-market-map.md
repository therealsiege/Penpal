# Patient Data Tokenization Market Map: Leveraging Real World Evidence While Protecting Patient Data

**Date:** May 7, 2025

**Categories:** Patient Data Tokenization

---

Colin DuRant

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email_ [_here_](https://elion.health/#signup) _._

Real-world data is gaining momentum in healthcare—not just because there’s more of it, but because it offers a clearer view of what’s actually happening across the patient journey. From EHRs and medical claims to imaging and genomics, these data sources are helping providers, health systems, and researchers spot patterns, close care gaps, and make more informed decisions at scale.

However, the sensitive and highly-regulated nature of health data means there are barriers to compliantly using this data to develop AI/ML models both internally or externally, analyze health system performance utilizing external benchmarking data, or engage in novel partnerships requiring in external sources of data.

There are many cases where patient-identifiable data sharing is not feasible, but analyses on linked datasets still need to be executed at the patient-level. [Patient data tokenization](https://elion.health/categories/patient-data-tokenization/products) emerges as a critical solution, opening up options for sharing and linking while maintaining security and compliance.

# What Is Patient Data Tokenization (and Why Is It Necessary)?

Patient data tokenization is a “...sophisticated solution for safeguarding sensitive healthcare information by replacing identifiable data elements with unique tokens. This process ensures the confidentiality of patient data while maintaining data integrity and complying with regulatory requirements” ( [Selvaraj, 2022](https://www.ijsr.net/archive/v13i6/SR24611163737.pdf)). Once a dataset has been tokenized, that dataset can then be shared externally with trusted partners for use and linkage with other tokenized datasets.

# HIPAA & Patient Data De-identification

While the [HIPAA Privacy Rule](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html) always allowed for de-identification, as part of the HITECH Act in 2009, Congress [required](https://www.congress.gov/bill/111th-congress/house-bill/1#:~:text=Requires%20the%20Secretary%20to%20issue%20guidance%20on%20how%20best%20to%20implement%20the%20requirements%20for%20the%20de%2Didentification%20of%20protected%20health%20information.) HHS to provide clearer guidance on the two approved methods: Safe Harbor and Expert Determination. Data de-identified through [Safe Harbor](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html#safeharborguidance)—removal of names, most geographic information, dates tied to an individual, and more—loses significant research utility, so most patient data tokenization will de-identify data to meet expert determination requirements. [Expert Determination](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html#guidancedetermination) does not designate specific data elements for removal, but instead, requires an expert to certify a dataset has a “very small” risk of allowing patient re-identification.

# How Does Patient Data Tokenization Work?

Let’s use an example of a health system in partnership with an external data partner who may want to combine external utilization data with their own data to perform a [leakage](https://www.definitivehc.com/resources/glossary/patient-leakage) analysis. Using a patient data tokenization service will allow the health system and data partner to combine datasets without exposing PHI.

1. Patient data tokenization services take a patient-identifiable dataset as an input.

2. Then, a tokenization algorithm will be run using some set of patient-identifiable fields: name, gender, date of birth, other identifiers like member ID or SSN, or even geographic details.

3. From these variables, a patient token (really an identifier) will be created per patient and appended to each associated record.

4. Identifiable details will then be removed or obfuscated to the level required to meet the expert determination standard listed above.

5. The output datasets can now be combined and linked via the token, but each individual token cannot be linked back to specific, identifiable patient information.

6. In our example, analysts can use the merged and linked dataset to perform their health system leakage analysis.

Prior to export, most patient data tokenization partners will require a second hashing or encryption of tokens to close the loop of de-identification and prevent reverse linking of tokens back to identifiable data.

# Vendor Landscape

The attributes that differentiate patient data tokenization vendors are: Are they a closed ecosystem, semi-open, or fully open-source; do they handle expert determination in addition to tokenization; and are they part of a larger health data platform?

- [IQVIA Privacy Analytics](https://elion.health/products/iqvia) and [LexisNexis Gravitas](https://elion.health/products/lexisnexis-gravitas) represent closed ecosystem options using tokenization schemes designed to work only within the vendor ecosystem and platform. Generally speaking, these options work when you want to connect with data and services owned and operated by IQVIA or LexisNexis.

- [Datavant Connect](https://elion.health/products/datavant) and [HealthVerity Identity Manager](https://elion.health/products/healthverity-identity-manager) represent the semi-open model where Datavant or HealthVerity acts as an intermediary for different parties looking to exchange and link de-identified data across sites and use-cases. The vendor owns the tokenization algorithm and token management, but parties can use the data in their own environment.

- Relative newcomer [Spindle Health](https://elion.health/products/spindle-health) represents the fully [open-source](https://spindle-health.github.io/carduus/) option for tokenization but also offers additional products and services for risk management and compliance.

Other products in the category, like [Glendor PHI Sanitizer](https://elion.health/products/glendor), focus on de-identification and tokenization of multi-modal data like images or video or act more as data vaults, like [Protecto Data Privacy Vault](https://elion.health/products/protecto-data-privacy-vault) or [Skyflow’s Health Care Data Privacy Vault](https://elion.health/products/skyflow%E2%80%99s-healthcare-data-privacy-vault).

# What’s Next

As data privacy and cybersecurity concerns grow in healthcare IT, patient data tokenization vendors must stay atop a changing regulatory landscape. Additionally, as [synthetic data](https://www.nature.com/articles/s41746-023-00927-3) becomes viable for healthcare research and analytics, we expect vendors to expand beyond traditional de-identification offerings into “lookalike” synthetic data generation.

---
*Source: [Elion Health](https://elion.health/resources/patient-data-tokenization-market-map)*