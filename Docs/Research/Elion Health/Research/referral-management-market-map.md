# Referral Management Mapping Markets: Recovering the 65% of referrals that are never completed

**Date:** March 5, 2026

**Categories:** Referral Management

---

Colin DuRant

_This is part of Elion's weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email [here](https://elion.health/#signup)._

In what remains the largest published analysis of referral completion, researchers tracked over 100,000 referral scheduling attempts across a major health system and found that [only 34.8% resulted in a documented, complete appointment](https://link.springer.com/article/10.1007/s11606-018-4392-z) (meaning the specialist's report actually made it back to the referring clinician). The other two-thirds were scheduled but never completed, completed but never documented, or simply lost somewhere between the referring provider's outbox and the specialist's inbox.

Health systems have spent heavily on EHR infrastructure that can _create_ referral orders with a few clicks. But everything that happens after that remains a challenge: the printed fax that sits in a tray for three days, the prior authorization that stays pending indefinitely for missing documentation, the patient who never even gets scheduled, and the specialist's consult note that never makes it back to the referring clinician's chart. Each of these breakdowns compounds, and the result is a workflow where the majority of referrals enter what can sometimes feel like an operational void.

[Referral management](https://elion.health/categories/referral-management/products) solutions handle the operational work of executing and tracking referrals end-to-end, including routing to the right destination, ensuring the receiving team has complete clinical and administrative information, and closing the loop with visibility into whether the referral was accepted, scheduled, completed, and documented. Most EHRs support basic referral orders, but purpose-built platforms improve performance at scale by standardizing intake, digitizing document exchange, orchestrating outreach and scheduling, and reporting on turnaround times, access bottlenecks, and network leakage.

This category is distinct from [patient scheduling](https://elion.health/categories/patient-scheduling/products) (appointment booking with or without a referral), [electronic consults](https://elion.health/categories/electronic-consults/products) (clinician-to-clinician guidance where the output is specialist advice, not a scheduled visit), and [post-acute transitional care](https://elion.health/categories/post-acute-transitional-care/products) (discharge placement workflows). We’ve also excluded broader [Clinical Workflow Management](https://elion.health/categories/clinical-workflow-management/products) or agentic automation solutions from our definition though many of these platforms support referrals as one of many supported use-cases.

# The referral return-path problem

CMS tracks a quality measure called ["Closing the Referral Loop: Receipt of Specialist Report"](https://www.cms.gov/priorities/innovation/files/x/tcpi-san-pp-loop.pdf) for a reason. A referral isn't considered clinically closed until the specialist's findings are back in the referring clinician's hands and indexed in their chart.

Without that return communication, the PCP is making future treatment decisions without knowing what the specialist found, what they changed, or what follow-up they recommended. The specialist may have only seen the patient for a narrow issue over a brief period, but their findings shape long-term management decisions that fall back to primary care. When that information doesn't come back, the referring clinician is left filling in gaps from assumptions rather than data. These failures are a direct contributor to [an estimated 12 million diagnostic errors annually](https://psnet.ahrq.gov/node/46565/psn-pdf) in U.S. ambulatory care.

The solution to the return-path problem, at a technical level, already exists. The [IHE 360X profile](https://ihe.net/uploadedFiles/Documents/PCC/IHE_PCC_Suppl_360X.pdf) treats a referral as a state machine with defined stages (created, accepted, scheduled, completed) and bidirectional status exchange between the sending and receiving organizations. Rather than a referral being a fax that disappears into a void, 360X makes it a trackable transaction where both sides can see what stage it's in and whether the consult note has been returned. The standard is mature enough to implement, and [some EHRs have shipped support for it](https://www.nextgen.com/). But many organizations still operate in a physical document-centric model, and that gap between what's technically possible and what's operationally real is where the value destruction happens.

# Telehealth made referral follow-through worse

Here's the part that surprised me during research: Telehealth, which was supposed to reduce referral friction by making access easier, actually degrades completion rates.

A [2023 JAMA Network Open study](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2811870) of over 4,000 diagnostic tests and referrals ordered in primary care found that referrals ordered during in-person visits completed at 58%, while those ordered during telehealth visits completed at just 43%. Once you look at the operational details, the difference makes sense. In a physical clinic, patients pass through a checkout process where staff help schedule the next step before the patient leaves. That human involvement disappears in a virtual visit. The patient ends the video call, and the referral order sits in a queue until someone follows up, if they follow up at all.

For health systems that have expanded telehealth access significantly, this creates a quiet problem. Referral volume goes up, but follow-through goes down. The referral was "placed" in the EHR, but without automated outreach (persistent SMS, voice, or email contact within hours of the order), telehealth becomes a high-access, low-completion channel. The operational implication seems to be that any organization running significant telehealth volume needs referral automation not as a convenience but as a clinical safety measure.

# The referral management vendor landscape

The referral management market segments by which part of the problem vendors prioritize. Because the referral workflow spans intake, coordination, scheduling, and loop closure, most vendors have chosen a primary intervention point and expanded from there.

## The EHR baseline

Both [Epic](https://elion.health/products/epic) and [Oracle Health](https://elion.health/products/oracle-cerner) provide native referral orders, workqueues, and status tracking. For internal referrals within a single EHR instance, these modules work: a PCP creates a referral order, it routes to a scheduling workqueue, staff manage it through to completion, and the consultant report gets attached to close the loop. The challenge is that referrals frequently cross organizational boundaries, and that's where the EHR-native approach hits its limits. External referrals still rely heavily on fax and document exchange. Workqueue management is manual and labor-intensive, and there's no bidirectional status visibility with the receiving organization.

## Inbound intake automation

The receiving side's problem is volume and data quality. Specialty clinics and imaging centers still receive hundreds of referrals monthly via fax and unstructured documents, and manually processing each one takes 25-30 minutes of coordinator time. Intake automation vendors use AI document processing to extract patient data from faxes and other unstructured sources, validate insurance eligibility, flag missing information, and create structured EHR records. Some also bundle automated patient outreach to accelerate first-contact after referral receipt. Examples include [Tennr](https://elion.health/products/tennr), [Dexit (314e)](https://elion.health/products/314e-dexit), [Titan Intake](https://elion.health/products/titan-intake), [Calvient](https://elion.health/products/calvient), [Plena Health](https://elion.health/products/plena-health-autoflow-referral), [Janus Health](https://elion.health/products/janus-health-referral-management), [Valerie Health](https://elion.health/products/valerie-health), and [Linear Health](https://elion.health/products/linear-health).

## Outbound coordination and network integrity

The referring side's problem is different: matching patients to the right in-network specialist, managing prior authorization, and tracking whether the patient actually completed the visit. Leakage, where patients leave the network because the referral process was too slow or opaque, is the central concern. For health systems operating under value-based contracts, every leaked referral is both lost revenue and a care gap that hits quality scores. Vendors in this segment focus on various combinations of EHR-embedded referral routing, value-based specialist matching, PA automation, and leakage analytics. Examples include [Arrowhealth](https://elion.health/products/arrowhealth), [Linear Health](https://elion.health/products/linear-health), [PicassoMD](https://elion.health/products/picassomd), [Lightbeam Health Solutions](https://elion.health/products/lightbeam-health-solutions), [ReferWell](https://elion.health/products/referwell), [Valer Health](https://elion.health/products/valer-health), and [Claim Health](https://elion.health/products/claim-health).

## Scheduling orchestration and patient access

The highest point of attrition is between the referral order and the kept appointment. These vendors treat access as a logistics and engagement problem, matching patient demand to specialist supply, automating outreach through multiple channels (SMS, voice, email), and providing self-scheduling to reduce staff burden. The goal is to replicate the "checkout staff" function that keeps completion rates higher for in-person visits. Examples include [Alluvium (formerly BlockIt)](https://elion.health/products/blockit), [Luma Health](https://elion.health/products/luma), [Promptly](https://elion.health/products/promptly), [Notable](https://elion.health/products/notable), and [Phreesia](https://elion.health/products/phreesia).

## Full-lifecycle and cross-enterprise platforms

A smaller group of vendors aims to manage the entire referral process across organizational boundaries, from initiation through loop closure, with emphasis on the bidirectional visibility that neither the sending nor receiving EHR provides alone. These platforms typically combine intake, routing, status tracking, and consult-note return into a single workflow. Examples include [LeadingReach](https://elion.health/products/leadingreach), [ReferralMD](https://elion.health/products/referralmd), [HealthViewX](https://elion.health/products/healthviewx), [Dock Health](https://elion.health/products/dock-health), and [Locata](https://elion.health/products/locata-ai).

Several vendors sit at the edges of the category where "referral" takes on a specialized meaning. [Oler Health](https://elion.health/products/oler-health) automates admissions intake for skilled nursing facilities. [Mandolin](https://elion.health/products/mandolin) handles referral-like coordination for infusion centers.

---
*Source: [Elion Health](https://elion.health/resources/referral-management-market-map)*