# Synthetic Data Mapping Markets: Unlocking Innovation Without Exposing PHI

**Date:** May 28, 2025

**Categories:** Synthetic Data

---

Colin DuRant

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email_ [_here_](https://elion.health/#signup) _._

The promise of data-driven healthcare frequently runs headfirst into the reality of patient privacy. For health systems under pressure to accelerate AI initiatives, test new digital tools, and collaborate across institutions, getting access to usable patient data remains a serious barrier that often slows innovation and potentially even drives users to work in unapproved, non-compliant tools.

[Synthetic data](https://elion.health/categories/synthetic-data/products) offers a third path: artificial patient-level data that statistically mirrors real clinical or operational data without including any identifiable patient information. These tools are used by clinical informatics, data science, IT, and digital innovation teams to safely build, test, and analyze solutions without the compliance risks or access barriers associated with real-world data.

# What are synthetic data platforms?

At a high level, synthetic data solutions allow:

- **Data science teams** **to develop and test digital tools** (e.g. CDS systems, machine learning models, or data pipelines) in environments that replicate real data without exposing PHI.

- **IT, innovation, or procurement teams to evaluate and validate vendor solutions** in procurement or sandbox environments.

- **Clinical researchers to perform analyses and collaborate across institutions** (e.g. in academic consortia or system partnerships) without navigating complex data use agreements.

Unlike general-purpose de-identification tools, synthetic data platforms do not mask or remove identifiers from existing data—they generate entirely new, artificial datasets that retain the utility and complexity of the source data while eliminating re-identification risk. This makes them distinct from de-identification software and [clinical datasets](https://elion.health/categories/clinical-datasets/products) or [claims data](https://elion.health/categories/claims-data/products) offerings.

# How do synthetic data tools work?

Synthetic data tools use machine learning models—most commonly generative adversarial networks (GANs), variational autoencoders (VAEs), or Bayesian networks—to learn the joint distributions, temporal patterns, and conditional dependencies within real datasets and generate statistically similar but non-identifiable records.

A typical user logs into a web interface or local instance, selects a dataset (such as EHR, claims, or operational data), and configures generation parameters, like cohort filters, output schema, or privacy settings. The tool then trains a model on the source data and produces a synthetic dataset for download or in-platform analysis.

Most tools support longitudinal and time-series data, enabling simulation of patient journeys, billing cycles, or resource utilization. To ensure safety, vendors apply differential privacy, membership inference testing, or re-identification risk scoring.

Synthetic outputs are validated through statistical comparison to the source (e.g. diagnosis distributions, utilization curves) and model fidelity checks to confirm that downstream analytics perform similarly.

Beyond healthcare provider applications, these tools are also frequently used by pharmaceutical companies, health tech vendors, and academic researchers to support clinical trial design, algorithm development, and cross-institutional data sharing.

# Vendor differentiation

Vendors in this space segment along two main axes: whether they offer a platform for custom data generation or pre-generated datasets, and the level of healthcare-specific functionality (e.g. cohort simulation, EHR schema support, time-series data generation).

**Synthetic Data Generation Platforms (custom, privacy-preserving):** These platforms, which allow health systems to generate synthetic versions of their own data, with controls for statistical accuracy and privacy, are best for teams that need ongoing, flexible generation. _Examples:_ [Syntho](https://elion.health/products/syntho), [Syntegra](https://elion.health/products/syntegra), [MDClone](https://elion.health/products/mdclone), [Gretel](https://elion.health/products/gretel), [Tonic.ai](https://elion.health/products/tonic-ai), [Syntheticus](https://elion.health/products/syntheticus), [YData](https://elion.health/products/ydata), [MOSTLY AI,](https://elion.health/products/mostly-ai) [MakeData.ai](https://elion.health/products/makedata-ai).

**Pre-Generated or Open-Source Datasets (out-of-the-box testing):** These tools offer representative synthetic datasets, often for testing or educational use cases. They can be useful when real-world fidelity is less important than quick access. _Examples:_ [Synthea](https://elion.health/products/synthea), [Interoperability Institute Synthetic Data](https://elion.health/products/interoperability-institute).Some vendors, like Syntegra and MDClone, may straddle both categories, offering generation tools as well as reference datasets.

# Where the market is going

Initial results from research ( [here](https://www.cprd.com/sites/default/files/2022-04/Wang%20et%20al%20preprint.pdf), [here](https://bmjopen.bmj.com/content/11/4/e043497), and [here](https://arxiv.org/abs/2311.09402), for example) and real-world use suggest synthetic data can be surprisingly effective. Models trained on synthetic datasets often perform comparably to those trained on real data, and statistical fidelity is generally strong. But synthetic data isn’t magic; it can still carry forward bias, degrade under strong privacy constraints, or underperform if not validated rigorously.

The key to responsible adoption is clear use case alignment. Synthetic data works best for prototyping, testing, and exploratory research—not final model deployment or high-stakes clinical decisions. Organizations should evaluate both privacy risk and downstream model performance, and treat synthetic datasets with the same scrutiny as real ones.

As privacy and data access become growing concerns, we expect synthetic data to become foundational infrastructure for model development, vendor validation, and inter-institutional collaboration. But long-term success depends less on the novelty of the tools—and more on how well health systems govern and evaluate them.

---
*Source: [Elion Health](https://elion.health/resources/synthetic-data-market-map)*