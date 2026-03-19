# Image Exchange Mapping Markets: Getting images from A to B, easy as ABC

**Date:** February 10, 2026

**Categories:** Image Exchange

---

Colin DuRant

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email [here](https://elion.health/#signup)._

Despite spending billions on EHR infrastructure, most U.S. hospitals still rely on patients to physically transport radiology studies between facilities. Patients forget discs, deliver damaged media, or arrive at facilities without CD drives, resulting in a failure rate that’s measurable: Duplicate imaging rates [are](https://www.jacr.org/article/S1546-1440(25)00449-1/abstract) often at least 12%.

And the costs aren’t just financial. For trauma and stroke cases transferred between facilities, imaging delays create immediate clinical risk. A patient stabilized at a community hospital emergency department and then transferred for surgery may arrive with incomplete imaging history. The receiving surgeon faces a choice: wait for CD transport and upload, order redundant scans, or proceed with limited information.

# What are image exchange platforms?

[**Image exchange platforms**](https://elion.health/categories/image-exchange/products) aim to solve this problem. These platforms move [DICOM](https://www.dicomstandard.org/) studies between organizations without physical media or point-to-point VPN configurations.

These platforms differ from foundational imaging IT—like [Picture Archiving and Communication Systems (PACS),](https://en.wikipedia.org/wiki/Picture_archiving_and_communication_system) [Vendor Neutral Archives (VNAs)](https://en.wikipedia.org/wiki/Vendor_Neutral_Archive), and enterprise imaging platforms that store, manage, and display images within a single organization—in their ability to resolve cross-organizational patient identity conflicts. When an external study arrives, image exchange platforms match it to the correct local Medical Record Number (MRN) and normalize DICOM metadata to match internal conventions, ensuring that the image appears in the right chart at the right time.

# Image exchange workflows

The workflow begins when a patient schedules an appointment:

- **Automated prefetching**: AI-powered systems scan EHR schedules for upcoming appointments, identify patients with relevant external imaging history, and retrieve those studies before the clinician opens the chart. A patient booking an orthopedic consultation triggers a search for previous knee imaging across connected facilities. The system finds relevant priors and initiates retrieval overnight, ensuring data availability when the appointment begins. This eliminates the manual search process that previously consumed 15-30 minutes of administrative time per referral.

- **Query and transfer**: The system needs specific information to search effectively. In most workflows, the platform knows the patient's demographic information (name, date of birth, sometimes Social Security number) from the local EHR. It uses these identifiers to query external archives across connected networks, looking for studies associated with that patient. The search returns a list of available imaging, and depending on the software configuration, the clinician or automated rules determine which studies to retrieve. Systems then initiate secure transfers using [DICOMweb](https://www.dicomstandard.org/using/dicomweb) protocols over standard HTTPS connections rather than requiring legacy point-to-point VPN tunnels.

- **Ingestion and patient metadata normalization**: Once the images are received, the system reconciles external patient identifiers with local MRNs and standardizes DICOM tags (study descriptions, procedure codes, anatomical markers) to match the receiving facility's conventions, ensuring the study routes correctly into correct local PACS or VNA storage.

- **EHR-embedded viewing**: Rather than forcing clinicians to log into separate portals, modern platforms embed DICOM viewers directly into the patient chart using SMART on FHIR applications or similar integration standards. The clinician clicks a link in the EHR and the viewer launches in-context, often with server-side rendering that eliminates local software installation.

# What makes image exchange difficult?

Medical images create technical challenges that don't exist with other health data. A typical chest CT [generates](https://radiology.ucsf.edu/research/core-services/imaging-data-101) 300-500 individual image slices totaling 150-250 megabytes, roughly 1,000 times larger than a text-based lab result. Transferring these files over standard internet connections takes time, and many organizations historically relied on point-to-point VPN tunnels configured individually for each partner facility, an approach that doesn't scale beyond a handful of relationships.

The data density problem compounds with volume. A mid-size radiology department might produce 50,000-100,000 studies annually. Maintaining VPN connections, bandwidth allocation, and firewall rules for dozens of referring hospitals requires dedicated network engineering resources that smaller facilities cannot afford.

Beyond infrastructure, images arrive with incompatible patient identifiers. An outside hospital's MRN means nothing to the receiving facility's PACS. If the external study for "John A. Doe, MRN 123456" cannot match to the local system's "Doe, John Andrew, MRN 987654," the image either fails to import or creates a duplicate patient record that breaks the archive's data integrity.

There have already been significant strides in improved image exchange through EHR-specific functionality, such as the support seen through [Epic’s](https://elion.health/products/epic) Care Everywhere. However, these benefits remain limited to only systems within those networks. Health systems that wish to access imaging from, for example, community hospitals or radiology networks need an additional route to access imaging from outside their EHR’s network.

# The regulatory mandate for image exchange

There’s a pressing regulatory aspect to the growth in image exchange solutions as well. The [21st Century Cures Act](https://www.fda.gov/regulatory-information/selected-amendments-fdc-act/21st-century-cures-act) reclassified medical imaging as Electronic Health Information (EHI) in October 2022, making it subject to information blocking rules. Organizations that restrict access to imaging data, including those requiring patients to physically retrieve CDs, face potential regulatory penalties.

The Office of the National Coordinator's HTI-2 rule creates a more specific deadline. By 2028, certified EHRs must support imaging exchange through URL-based links. While the rule doesn’t directly impact PACS vendors, they too will need to support modern interoperability standards or risk losing hospital customers who use these certified EHRs. As EHR and PACS technology more readily facilitate seamless digital image exchange, the expectation for providers will shift away from sending standalone image files via encrypted email or expecting patients to courier discs.

# How image exchange vendors segment around buyer needs

## **Enterprise-scale networks**

[Microsoft PowerShare](https://elion.health/products/powershare-image-sharing) (via the Nuance acquisition) and GE HealthCare (following its [announced](https://investor.gehealthcare.com/news-releases/news-release-details/ge-healthcare-acquire-intelerad-advancing-cloud-enabled) $2.3 billion acquisition of [Intelerad](https://elion.health/products/inteleshare)) operate the largest imaging exchange networks. PowerShare connects over 19,000 facilities, processing 4 million studies per month and managing 2 billion images annually. Intelerad's combined network with Ambra and Life Image manages over 80 billion images globally.

The value proposition is network density. When a health system joins PowerShare or Intelerad, 70-80% of its referring partners are often already on the platform, eliminating the "last mile" connectivity problem. A patient scheduling an orthopedic consultation triggers an automated query; the system finds a knee MRI from an urgent care visit six months ago and pre-fetches it overnight. The orthopedist opens the chart the next morning and sees both current and historical imaging without requesting records.

These platforms handle routine referrals efficiently, but the downside is that they struggle with complex oncology workflows requiring pathology correlation across multiple institutions, or trauma scenarios needing synchronized multi-site review.

## **Transit and normalization specialists**

Medicom, eHealth Technologies, Founda, and Medicai focus on the data reconciliation problem, the automated processes that transform external studies into locally-compatible formats.

[Medicom](https://elion.health/products/medicom) builds federated infrastructure that indexes where studies exist across distributed networks and retrieves them on-demand, performing "tag morphing" to rewrite DICOM headers matching local PACS requirements. SMART on FHIR applications embed viewers directly into Epic's chart interface, eliminating context switching.

[eHealth Technologies](https://elion.health/products/ehealth-tech-images-exchange) combines automation with human intervention when automated retrieval fails, staff manually contact facilities, retrieve records, and organize them into clinical chronologies. This concierge model handles oncology and transplant cases requiring correlation of imaging, pathology reports, and treatment histories from multiple institutions.

[Founda](https://elion.health/products/founda-health-image-availability) operates as API-first middleware translating between legacy XDS registries (used in many HIEs) and modern FHIR APIs, with hybrid deployment keeping PHI processing on-premise while orchestration runs in the cloud.

[Medicai](https://elion.health/products/medicai) offers modular building blocks (DICOM storage, DICOMweb servers, lightweight gateways, viewer SDKs) that developers integrate into custom applications, handling the DICOM complexities so telemedicine platforms and AI diagnostic companies don't build PACS infrastructure from scratch.

These platforms are complementary to enterprise-scale networks and serve health systems with complex specialty programs or in-house development teams. A transplant surgeon needing complete imaging and pathology from three different hospitals over five years can use these solutions to navigate different release processes, reconcile identifiers, and deliver a chronologically-organized packet in 48 hours rather than waiting weeks.

## **Patient-mediated platforms**

While not directly competitive with the above solutions, it’s worth noting that there is a consumer-facing model that achieves similar outcomes. For example, [PocketHealth](https://elion.health/products/pockethealth-image-exchange) aims to give patients control of their own imaging records; users create accounts, request studies from providers, and receive secure cloud links they can share with new doctors. This shifts the workflow burden from provider IT departments to patients. Hospitals upload studies when requested rather than maintaining CD-burning services or configuring exchange relationships with every referral destination.

The model works for elective care with engaged patients but fails in acute scenarios where patients are unconscious, cognitively impaired, or lack technical literacy. A patient relocating to a new city can log in, locate imaging, and share a time-limited link with their new primary care physician for review during the initial visit.

# The future of image exchange

Given the overall improvement in interoperability already facilitated by the major EHRs, and likely to only improve as HTI-2 deadlines near, one might wonder whether imaging-specific networks will become obsolete. While we can’t see the answer to that question in our crystal ball, there are at least a couple outcomes that would cause these solutions to remain viable despite the ability to exchange images over EHR interop rails:

- **The workflow pain point:** Even if EHRs can manage the actual exchange of images, they don’t (yet) handle workflow elements like recognizing incoming referrals or upcoming appointments to kick off the search for relevant files. Data normalization is also a meaningful opportunity for these vendors. The function of image exchange vendors in this context is akin to on-ramps like [Particle](https://elion.health/products/particle), [Zus](https://elion.health/products/zus-aggregated-profile-zap), Health Gorilla and others that support access to health records via HIEs, Carequality or TEFCA.

- **The last mile pain point:** While vendors like Epic may have the IDN market cornered, there will always be radiology networks or community hospitals on other EHR systems. Until and unless broader EHR-to-EHR interoperability is a reality, image exchange vendors bridge these "last mile" gaps.

---
*Source: [Elion Health](https://elion.health/resources/image-exchange-market-map)*