# Price Transparency Market Map: From “WTF” to MRFs

**Date:** August 6, 2024  
**Author:** Patrick Wingo, Head of Research, Elion

**Categories:** Price Transparency Data

---

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email_ [_here_](https://elion.health/#signup) _._

A crucial part of the payer contracting process involves competitive intelligence around pricing, as it informs providers and payers on going market rates across different services codes and geographies. This has led to the rise of vendors in the [price transparency](https://elion.health/categories/price-transparency-data/products) category.

## The History of Price Transparency

Prior to [2021](https://www.cms.gov/priorities/key-initiatives/hospital-price-transparency), price transparency data primarily came from anonymized claims (and some electronic remittance advice) data aggregated at various geographic levels (zip code, city, and state) by vendors and non-profits like [Clarify](https://elion.health/products/clarify-atlas) and [FAIR Health](https://elion.health/products/fair-health). This allowed practices and health systems to understand average rates for services across their geography for a set of payers, but there were some fundamental limits to the data. These averages often reflected the “charged amount” rather than the “allowable amount,” which is what the payer has actually agreed to pay for a service. Additionally, the anonymity of the aggregated claims made it harder to be specific in any competitive analysis.

## An Influx of Information

To address these issues, CMS stepped in a few years ago to require both hospitals and payers to publish “machine-readable files” (MRFs) that contain charges, charge descriptions, and rates for insured and self-pay patients across a wide range of service codes. In other words, each line of these files contains the charge code, a description, the provider, the payer, and the negotiated price between the two. While many hospitals did not rush to publish those rates, CMS increased enforcement with steeper fines and set high penalties for insurers who did not comply with these rules.

In response to the influx of hospital- and payer-provided MRFs, a number of companies, including [Mathematica](https://elion.health/products/mathematica-price-transparency), [PayerSet](https://elion.health/products/payerset), [Serif](https://elion.health/products/serif-health), [SumHealth](https://elion.health/products/sumhealth), [Talon,](https://elion.health/products/talon) [Trek Health](https://elion.health/products/trek-health-payer-transparency), [Turquoise Health](https://elion.health/products/turquoise-health), and [Visible Charges](https://elion.health/products/visible-charges), prepared to ingest this data and actually make it legible across a range of use cases by aggregating and cleaning the data, identifying data quality issues, and transforming it into usable datasets for downstream applications.

The differentiation between price transparency vendors often comes down to the quality and accuracy of the data—how well they pare down illegitimate codes and remove “bad rates” by comparing them to ERAs and other sources of truth. However, the data changes monthly, and accuracy can vary across specialties and payers, making quality measurement a challenging, moving target.

In addition to data quality, the sheer quantity of data is a huge challenge. When payers started publishing their data, the scale of these MRFs grew to the order of petabytes, surpassing the annual clinical data production of every hospital in the US. This growth is partly due to payers publishing a price for each service code for each NPI in the country. In response to this data scale, vendors built robust pipelines using heuristics and data science to filter out irrelevant data.

## Making Data Actionable

While writing complex pipelines and processing huge quantities of data is costly, there is less proprietary advantage here than in other types of businesses. MRFs are public and accessible to anyone. Vendors are aware that more competitors could drive down prices for high-quality data and are focused on moving downstream to build products and services incorporating price data for useful applications.

These applications include:

- Understanding contracts and prices for bundled services

- Calculating true out-of-pocket costs for patients

- Optimizing referrals for value-based care

- Running more effective contract negotiations

- Enabling consumers to compare prices across services and providers.

The goal is for vendors to leverage high-quality price transparency data to become the system of record for negotiating contracts between payers and providers, which looks to be a higher-margin business than data processing. To succeed in this space, vendors need to marry data quality with the requisite tooling for contract negotiations. But it seems the real winners here will ultimately be providers and payers, who stand to benefit from streamlined processes and less reliance on contracting consultants.

---
*Source: [Elion Health](https://elion.health/resources/price-transparency)*