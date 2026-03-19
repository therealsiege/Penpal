# Headless EHRs: A Primer

**Date:** July 17, 2023  
**Author:** Bobby Guelich, Headless EHRs: A Primer

**Categories:** Headless EHR, Electronic Health Record (EHR)

---

CEO, Elion

_For an in-depth overview on how to select an EHR as a digital health provider, see our_ [_comprehensive guide._](https://www.elion.health/resources/the-digital-health-providers-guide-to-selecting-an-ehr)

Historically, the EHR decision has often been boiled down to a binary choice: build or buy.

For digital health providers, both paths were suboptimal. Building your own EHR, while attractive for many startups given their build-first mentality, ultimately resulted in resources going towards commoditized technology, particularly given the high bar required to achieve compliance benchmarks (e.g., ONC certification) and payment workflows (e.g., coding and claims submission). Buying had major drawbacks as well, often limiting digital health companies’ ability to create the workflows and patient experiences they needed to differentiate their offering.

In recent years, however, a third approach has emerged – that of the headless EHR. First popularized by Brendan Keeler’s seminal [_To E(HR) or not to E(HR)_](https://healthapiguy.substack.com/p/to-ehr-or-not-to-ehr) article, the idea refers to an API-driven EHR that is purpose-built to enable custom development and easy integration.

For digital health providers working through the build vs. buy decision, this path can be seen as a best of both worlds: it takes the hard work of building the full EHR feature suite off the engineering team’s plate, while still providing the flexibility to tailor workflows and user experiences to the nuances of the care model‍

Until recently, the headless EHR was more of a concept than a viable alternative. Today, however, we’re seeing true headless EHRs emerge – both those built natively to be headless, as well as some established EHRs that are rapidly making their underlying functionality available via a broad suite of APIs.

Given the progress that’s been made, it’s a good time to bring more clarity to this space. Since there’s no established consensus on what constitutes a headless EHR, we’ve taken an initial cut at characterizing the category.

As part of this effort, we’ve also attempted to offer a high level categorization of the various EHR solutions that often come up in the headless EHR conversation. We’ll note up front that this is dynamic space and that the vendors mentioned are rapidly evolving their capabilities – so take this as a point in time snapshot rather than a fixed perspective.

## Defining “headlessness”

A useful starting point for defining the concept of headlessness is to outline the core components of a typical ambulatory EHR. In very rough terms, you can break it down as follows:‍

1. **Backend infrastructure:** Secure servers and database infrastructure configured to be HIPAA compliant‍

2. **Authentication:** Ensuring that users are permitted to access the system.‍

3. **Data model:** Historically, each EHR has developed its own proprietary model, however more recent solutions are frequently building on top of the [FHIR](http://hl7.org/fhir/) standard.‍

4. **Access control:** Defining which users have access to specific data elements and functionality. ‍

5. **Core EHR workflow functionality:** The underlying backend functions that enable the core workflows of the EHR, such as scheduling, patient intake, charting, orders, and billing.‍

6. **Integrations with third parties:** Integrations to support workflows involving various external parties, such as sending e-prescriptions and receiving clinical history summaries.‍

7. **Internal-facing UI:** The user interface (UI) that administrative and clinical staff use to interact with data and manage workflows.‍

8. **External-facing UI:** The user interface that patients use to access their information and take specific actions (e.g. scheduling an appointment or paying a bill).

So given this breakdown, what constitutes a headless EHR? In short, a truly headless version takes the underlying infrastructure and backend functionality of the EHR (1 through 5 above), and combines it with a robust set of APIs with extensive read / write capabilities in place of the internal and external UIs. In effect, you get the core capabilities of an EHR out of the box, while retaining the ability to customize the workflows and user experiences to fit your model.

## Headless EHRs in the wild

What we’re seeing in the market today looks slightly different than the textbook definition of headless EHRs above. Broadly speaking, we see this space segmenting into two main categories, one that’s more headless in nature (FHIR-based application development platforms) and one that’s slightly less so (Decoupled EHRs).

### 1) FHIR-based application development platforms

FHIR-based application development platforms are purpose-built to enable the creation of compliant healthcare applications, including, but not limited to, EHRs. Like a headless EHR, they take on the burden of the underlying infrastructure, the data model, authentication and access controls. They also are API-first, offering lots of flexibility but little to no UI out of the box.

Where they differ, however, is in the relatively limited core backend EHR functionality they provide. Instead, these platforms focus on making it as easy as possible for their customers to build, offering a high degree of programmability and robust SDKs. It’s worth noting that some of these solutions are also supporting the development of open source reference applications that builders can use to accelerate their efforts.

### 2) Decoupled EHRs

Decoupled EHRs refer to those that include frontend UIs in their offering, but connect it to their backend via APIs. This architecture means that they’re able to offer 1) a more traditional fully functional EHR with provider, patient, and administrator-facing UIs; 2) a headless version that is simply the backend + APIs; and 3) in-between options that incorporate a mix of their UIs and custom builds.

Vendors in this category tend to vary in how decoupled they truly are and the extent of their core EHR functionality. Some started out as traditional EHRs, and have exposed more of their data and workflows via API over time. Others have built with a headless approach in mind, but are still on the road to feature parity with the more established options.

The headless EHR space is still in its early days and will continue to evolve rapidly. Ultimately, exact definitions matter less than knowing the key differences between various vendor solutions you might consider.

If you want to go deeper on EHR selection best practices, check out our [Digital Health Provider’s Guide to Selecting an EHR](https://www.elion.health/resources/the-digital-health-providers-guide-to-selecting-an-ehr) for much more on this topic

---
*Source: [Elion Health](https://elion.health/resources/headless-ehrs)*