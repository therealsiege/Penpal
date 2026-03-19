# Guide to TEFCA & QHINs

**Date:** March 22, 2023  
**Author:** Bobby Guelich, CEO, Elion

**Categories:** Interoperability

---

On February 13th, 2023, the Office of the National Coordinator for Health IT (ONC) [announced](https://www.healthit.gov/buzz-blog/electronic-health-and-medical-records/interoperability-electronic-health-and-medical-records/building-tefca) that six organizations were approved to implement TEFCA as prospective QHINs.

Some interoperability experts believe this could mark the beginning of a major change in the clinical data exchange landscape in the US. For others, [the jury is still out](https://ovsecondopinion.substack.com/p/regulatory-games-2023).

Regardless of where things shake out, it’s certain that TEFCA will continue to dominate interoperability conversations over the coming months.

However, unless you’re plugged into the interoperability space, you likely have little idea what all of this means. You’re almost certainly unaware of the practical implications for your organization.

This article is our attempt to unpack all of this. We’ll provide background on what TEFCA is and what it’s trying to accomplish. We’ll cover the practical implications, including what it means for different types of healthcare organizations. And finally we’ll wrap up with a quick overview of the initial candidate QHINs and how to differentiate amongst them.

## Background on TEFCA

### What is TEFCA?

The Trusted Exchange Framework and Common Agreement (TEFCA) was initiated by the 21st Century Cures Act in 2016. As [described](https://rce.sequoiaproject.org/tefca/) by the Recognized Coordinating Entity (aka the RCE – we’ll explain more what this is in a bit), TEFCA “outlines a common set of principles, terms, and conditions to support the development of a Common Agreement that would help enable nationwide exchange of electronic health information (EHI) across disparate health information networks (HINs).”

**Said more simply, TEFCA is a collection of documents that specify the legal, technical, and functional requirements for the nationwide exchange of clinical records** (more precisely, for creating and participating in a network of health information networks). It represents the latest effort by the federal government to stand up a nationwide framework or network for health information exchange, which began with the National Health Information Network (NHIN) Collaborative in 2007.

TEFCA is composed of two parts: 1) the Trusted Exchange Framework, and 2) the Common Agreement. The former establishes the foundational principles and technical requirements for data sharing across health information networks (HINs), while the latter is a legal agreement between the RCE and the participating HINs that governs how data is to be exchanged.1

### What problems is TEFCA addressing?

At a base level, there are several key problems with clinical data exchange today in the U.S. that TEFCA is attempting to address.

#### **1) True nationwide interoperability**

[Clinical data interoperability](https://www.elion.health/resources/guide-interoperability) today is accomplished through a patchwork of national, state and regional HINs that do not consistently exchange data with one another. While technically interoperability exists between some of the major HINs, limitations exist in practice and thus most organizations must connect to multiple HINs in order to engage in broad clinical data exchange.

TEFCA is addressing this issue through the creation of _Qualified Health Information Networks_ (QHINs). Each QHIN is a network of networks. That is, each is a network in itself composed of participants and subparticipants, such as providers, healthcare IT organizations, and government entities. Additionally, each QHIN must connect to each other to create a network of QHINs that facilitate data exchange amongst one another.

_Adapted from original visual found in the_ [_RCE Monthly Informational Call, July 2022_](https://rce.sequoiaproject.org/wp-content/uploads/2022/07/RCE-Monthly-Info-Call-7-19-2022-FINAL.pdf)

‍

Effectively, TEFCA enables the nationwide exchange of clinical information by 1) setting the technical and policy floor for interoperability, and 2) requiring participating QHINs to exchange data with each other.

#### **2) Increased participation in data exchange networks**

While interoperability has come a long way in the last decade with the expansion of electronic health records and the growth of nationwide HINs such as [CommonWell](https://www.elion.health/vendors/commonwell) and [eHealth Exchange](https://www.elion.health/vendors/ehealth-exchange), as well as existing interoperability framework [Carequality](https://www.elion.health/vendors/carequality), the reality is that there’s still a gap to be closed. Something on the order of 25-30% of hospitals are still not connected to a nationwide network, particularly those in rural settings.2 The hope is that with the weight of the federal government, TEFCA will help to close this gap by simplifying connectivity requirements and increasing trust among participants given the strict requirements that must be met to become a QHIN.

#### **3) Expanding data sharing to additional exchange “purposes of use”**

Today, the only purpose of use consistently supported by participants of the major nationwide networks is [treatment](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/disclosures-treatment-payment-health-care-operations/index.html) – providers can share data with one another to support patient care. However, other stakeholders are largely left out. For example:

1. Patients can’t access their data via these exchanges (some exchanges technically support it, but in practice network participants don’t respond to patient access queries).‍

2. Payers are unable to access member data to support healthcare operations or payment use cases‍

3. Public health agencies have difficulty gaining access to the clinical information they need to pursue their mandates

TEFCA lays the groundwork for additional use cases by authorizing six purposes of use:

1. Treatment‍

2. Individual access services‍

3. Payment‍

4. Healthcare operations‍

5. Public health‍

6. Government benefits determination

Treatment and individual access services are the two that will be supported from the start; however, the intent is to operationalize additional purposes of use in short order, including public health, payment, and healthcare operations.3

#### **4) Allowing for push-based transactions in addition to queries**

Existing popular health information networks have focused on querying – sending demographic information and receiving a response if a match is found. This is a powerful capability, but there are also many workflows where organizations may wish to send patient data to other groups proactively, such as transitions of care from hospitals to skilled nursing facilities.

TEFCA represents a significant advancement, in that it allows for pushing clinical documents to a desired recipient. With both query and push capabilities harmonized to a single framework, TEFCA may allow for more robust data exchange.

### What are TEFCA’s limitations?

While TEFCA has the potential to catalyze a large step forward in clinical data interoperability, questions still remain about its ultimate impact. There are a couple of reasons for this:

#### **1) The voluntary nature of TEFCA**

The first is that **TEFCA is a voluntary framework**. There is nothing that requires participants or subparticipants to join a QHIN. And for TEFCA to be successful in driving true nationwide interoperability, there needs to be widespread participation.

Today the main stakeholders in existing networks, providers, have a limited amount to gain with the switch to TEFCA, but have increased risk of accidental protected health information (PHI) disclosure (something we touch on further in a bit). Additionally, some may be reluctant to accept the flow-down provisions of the Common Agreement, at least at first. As a result, the road to full adoption may be slow.

Fortunately, there are good reasons to believe that participation will be broad over time.

**1) Government support** – The government is strongly behind the effort, with clear signs of buy-in from the ONC, the White House, CMS, CDC, and the VA, as evidenced by their vocal support at the February 13th QHIN announcement event. If these agencies all participate in TEFCA, it will provide a significant boost for other organizations to join.

**2) Incentives for participation** – There are carrots being developed to incentivize participation. For example, as part of the FY 2023 Inpatient Prospective Payment System (IPPS) final rule, CMS is allowing eligible hospitals and critical access hospitals to satisfy the health information exchange objective under the Medicare Promoting Interoperability Program via a new measure [“Enabling Exchange under TEFCA.”](https://www.healthit.gov/buzz-blog/blog-series-cms-ipps-rule/interoperability-in-action-cms-rule-builds-on-onc-initiatives-to-simplify-health-information-exchange) The reporting requirements for this measure simply require attesting that they are engaged in bi-directional participation via TEFCA, which is much less burdensome than the existing means of meeting this objective.

**3) Additional purposes of use** – The expanded purposes of use, if successfully rolled out, will provide a compelling reason for participation by entities not engaging in health information exchange today, including payers and public health agencies, streamlining the way data is exchanged across the healthcare ecosystem.

**4) QHIN-driven participation** – The QHINs themselves, which for the most part represent the largest HINs in existence today, are strongly incentivized to work with their existing participants to get them onboarded.

#### **2) The use of legacy standards**

A second headwind for TEFCA is that, in its first iteration, it relies heavily on legacy standards such as [C-CDA and IHE XDS](https://healthapiguy.substack.com/p/a-brief-and-opinionated-history-of). While these formats have the advantage of being broadly used today in existing HINs like Carequality and CommonWell, they are antiquated, adding cognitive load to organizations trying to live in an API and FHIR-based world. The use of ubiquitous standards also means that TEFCA will see many of the same limitations seen in HINs today in terms of content payloads.

As we’ll discuss in a bit, this was an intentional decision by the ONC to ease the transition to TEFCA. The objective is to introduce FHIR-based exchange in the coming years, though whether this will be successful remains to be seen.

### The practical implications of TEFCA and the QHINs

As of February 13th, 2023, six candidate QHINs have been accepted to move forward with the testing and onboarding process under TEFCA. Upon completion, they will be officially designated as QHINs and ready for production data exchange. While the candidate QHINs technically have 12 months to complete this process, the hope is to be up and running by the end of 2023.

#### Short-term implications of TEFCA (next 12 months)

As discussed earlier, the TEFCA will be going live with two purposes of use: treatment and individual access services.

#### **Purpose of use \#1: Treatment**

Treatment largely replicates what already exists today within the major HINs, such as CommonWell and eHealth Exchange, as well as the Carequality interoperability framework. In itself this is not a major step forward, however the fact that TEFCA _requires_ QHINs to exchange data amongst one another is technically quite significant as it represents the first true government-sponsored nationwide network of networks.

In practice, it will take some time for participants and subparticipants to join the QHINs. Even if there is broad uptake (which is still a question, as noted earlier), there are practical steps that need to be taken from a technical and contractual standpoint to begin exchanging data as part of a QHIN. As a result, there will be some period of time where the existing HINs coexist alongside the QHINs, with network participants utilizing both.

#### **Purpose of use \#2: Individual Access Services (IAS)**

The big deal at launch is the enablement of patient access via the IAS purpose of use. For the first time, patients will be able to access their health records across providers they’ve seen nationwide via a single source (e.g., through a patient-facing application that is connected to one of the QHINs). This is a massive improvement over the status quo, which requires patients to remember which physicians they’ve seen and track down their records via patient portals or manual outreach to the physician practices themselves.

IAS not only allows patients to access the medical records for their own use, it also gives them the ability to share their records with other organizations as they see fit, such as life insurance companies for underwriting purposes or clinical trial recruitment companies to help them find relevant trial opportunities.

However, despite the promise of IAS, significant questions remain about how successful it will be in practice.

Based on the [Individual Access Services Implementation Standard Operating Procedure (SOP)](https://rce.sequoiaproject.org/wp-content/uploads/2022/09/Final-SOP-IAS-Exchange-Purpose-Implementation.pdf), TEFCA seems to give providers that participate in QHINs the flexibility to set their own policies around what constitutes a “match” when they receive a patient access query (see item 5 under the “Procedure” section in the above SOP). This means they may be able to deny patient access requests based on their own policies, though whether this occurs in practice remains to be seen (it’s worth noting that smart people who know a lot about this space [seem to be concerned](https://twitter.com/HITpolicywonk/status/1572690049086488576))‍

In fairness to providers (who would be the ones refusing the IAS requests), there are legitimate concerns. In particular, given the broad interest in IAS they are likely to be fielding a large number of patient access queries. It’s inevitable some patient matches will be incorrect and the wrong data will be shared, resulting in HIPAA breaches. Without greater protections, providers may look for ways to reduce this risk by avoiding sharing data (via exceedingly stringent matching criteria).

#### Medium-term implications of TEFCA (12 to 36 months)

While patient access is the near-term implication most are excited about, there are a number of other aspects of TEFCA that could be very impactful in the medium term.

#### **Additional purposes of use**

Perhaps the biggest is the support for additional purposes of use beyond treatment and individual access services. Per the National Coordinator for Health Information Technology, [Micky Tripathi](https://www.linkedin.com/in/micky-tripathi-890a335/), the SOPs for public health, payment, and healthcare operations will be released in the next several months, with the target of exchanging data under these purposes of use sometime in 2024.4

The impact of data exchange under these purposes would be far ranging. Public health agencies today are largely unable to connect to the existing national HINs and have difficulty sharing information amongst each other – an issue that significantly impacted the public health response during the pandemic. Similarly, clinical data exchange between payers and providers today for payment and healthcare operations purposes is not possible via existing HINs, leading to a variety of [costly and often manual workarounds](https://americanretrieval.com/release-of-information-importance/). If TEFCA successfully facilitates these types of data exchanges, it could have a significant impact on how payers and providers partner across a variety of use cases, including care coordination, prior authorization, and risk adjustment.

### **Transitioning to FHIR-based exchange**

In order to ease the transition to TEFCA, initial data exchange will be accomplished leveraging the standards supported by the existing HINs today, namely the [Consolidated Clinical Document Architecture (C-CDA)](https://www.particlehealth.com/blog/what-is-ccda-consolidated-clinical-document-architecture).

The ONC recognizes, however, that [Fast Healthcare Interoperability Resources (FHIR)](https://www.healthit.gov/sites/default/files/2019-08/ONCFHIRFSWhatIsFHIR.pdf) are rapidly gaining momentum across the industry due to the standard’s improvements over existing means of exchange and the ONC’s own efforts to promote adoption (e.g., via the certified EHR FHIR APIs mandated by the Cures Rule). Accordingly, the ONC and RCE have released a [FHIR Roadmap for TEFCA Exchange](https://rce.sequoiaproject.org/wp-content/uploads/2022/01/FHIR-Roadmap-v1.0_updated.pdf) that will require QHINs to support FHIR-based exchange over the next couple of years‍.

In short, while FHIR won’t be the standard for exchange from day one, there’s a defined path to get there and a strong belief that TEFCA can be a major driver of FHIR adoption across the industry more broadly. The main challenge will be providing the right incentives to overcome the calcification inherent to network effects – existing networks are slow to upgrade and hard to displace.

### A (brief) overview of the first six QHINs

As mentioned up front, six organizations recently had their applications approved to implement TEFCA as prospective QHINs.

For the most part, these are existing HINs that have signed on to meet the requirements to be officially designated as QHINs. Aside from that, it’s a somewhat varied group, composed of both nonprofit and for-profit entities and supporting a number of different constituencies. They also vary in terms of the services they offer, with some simply providing network access (and thus requiring significant build capabilities from their participants) and others offering additional value-add services, such as streamlined network connectivity via API, as well as data cleaning and transformation to make the data easier to use (for more on options for connecting to HINs, see our [previous interoperability article](https://www.elion.health/resources/guide-interoperability)).

### Wrapping up

It’s an exciting yet uncertain time in the world of clinical data exchange. TEFCA has the promise to fulfill a number of long-term interoperability ambitions – true nationwide exchange, greater network participation, and additional purposes of use, most notably patient access.

At the same time, there are still questions about whether TEFCA will be able to deliver on some of these promises given its voluntary nature and the risk that true patient access will not be achieved.

Momentum, however, is high across the industry. Between the strong government support, broad private sector participation, and aggressive timeline for implementation, there’s optimism that by the end of 2023 data exchange via TEFCA will be a reality.

#### **Footnotes**

1. [RCE Monthly Information Call, Jan 2022](https://rce.sequoiaproject.org/wp-content/uploads/2022/01/RCE-Monthly-Informational-Call-Jan-18-2022-FINALV2.pdf) ‍

2. [Sequoia Project - Prospective QHINs](https://rce.sequoiaproject.org/meet-the-prospective-qhins/) ‍

3. [Sequoia Project - Prospective QHINs](https://rce.sequoiaproject.org/meet-the-prospective-qhins/) ‍

4. [Sequoia Project - Prospective QHINs](https://rce.sequoiaproject.org/meet-the-prospective-qhins/)

---
*Source: [Elion Health](https://elion.health/resources/tefca-qhins-guide)*