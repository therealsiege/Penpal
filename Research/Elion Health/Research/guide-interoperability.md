# The Digital Health Provider’s Guide to Interoperability

**Date:** December 6, 2022  
**Author:** Bobby Guelich, CEO, Elion

**Categories:** Interoperability

---

_(Note: this is a follow-up piece from our recent_ [_webinar_](https://elion.health/resources/webinar-interoperability) _on this topic)_

A lot is being written about interoperability these days.

It’s an exciting time in healthcare data, with new regulations and emerging companies coming together to make it easier for patients, providers, and other stakeholders to access and exchange health information.

But for healthcare builders who aren’t steeped in this world, it can be difficult to figure out what any of it means for them.

For good reason, too: interoperability is an incredibly complicated area. It’s an ill-defined term that covers a broad swath of topics. It’s extremely nuanced and technical, requiring an understanding of arcane data standards and mind-numbing legislation and regulation. Additionally, what matters from an interoperability perspective differs significantly based on what type of organization you are, and what your business is trying to accomplish. For instance, the needs of provider organizations differ from provider-facing software companies, which differ from companies enabling patients access to their health information.

The reality is not everyone needs to be an interoperability expert. Most builders don’t need to know about specific data formats or government rules; they just need to understand how interoperability can help solve their business problems.

‍ **Our goal in this article is to help digital health provider organizations understand what interoperability means for them so they can develop a tactical strategy to address their specific needs.** In particular, we want digital health providers to walk away knowing answers to the following:

‍What does “interoperability” actually mean?

1. How do I figure out my specific interoperability needs?

2. What are my options for solving these needs?

3. How do I evaluate vendors in this space?

‍Let’s get started.

## Defining interoperability

‍Interoperability is a catch-all term. Broadly speaking, it covers the exchange of data between organizations to support workflows common across an industry. Examples of interoperability use cases in healthcare include gathering clinical history from other providers, sending e-prescriptions to pharmacies, and submitting claims to health insurers.

‍For our purposes, we’re defining interoperability as distinct from [integration](https://twitter.com/healthapiguy/status/1534901021217988608), which enables data exchange between systems within an organization or highly customized, bi-directional exchanges between two organizations (such as a referral process between two provider groups). Integrations are critical for many organizations, but the ways of solving these challenges are different than the solutions used for interoperability problems and thus out of scope for this guide. (For a deep dive on integrations, see this [article](https://healthapiguy.substack.com/p/how-to-win-friends-and-integrate).)

## Interoperability needs for digital health providers

As a digital health provider organization, your interoperability needs are driven by the defining elements of your business: your patient population, specialty, care model, and reimbursement strategy.

‍Defining your interoperability requirements starts with articulating what you need to accomplish to run your business and then determining the implications for data exchange between your organization and other external parties. Questions to answer for yourself include:

1. **What are the specific workflows required to deliver my care model and receive reimbursement, and what data do I need to enable them?** For example, do I need to prescribe medications or order labs? Do I need to manage transitions between sites of care? Is it important to see data from prior encounters my patient population has had with other healthcare organizations?

2. **How will that data be consumed, and what implications does this have for how it’s delivered?** For example, will it be an input to an automated process or algorithm or used as clinical context to be reviewed by the care team?

Answering these questions gives you a clear understanding of the data you need to be able to send and receive, including:

- The individual data points involved

- The format of the data

- The amount of historical data needed

- The degree of cleaning and transformation required to make the data usable

To help you think through your interoperability needs, we’ve put together a breakdown of the most common data exchanges used by digital health provider organizations, along with the relevant networks and data formats — and a list of some of the vendors that operate in that area.

## Prioritizing your interoperability needs

Most likely you won’t be able to tackle all your interoperability needs at once. Deciding which needs to prioritize will depend on the specifics of your business. That said, we often see digital health provider organizations address their interoperability requirements in the following order:

1. **What connections do I need to enable reimbursement?** A common starting point is establishing the financial data exchanges required for reimbursements, such as eligibility and claims processing in a fee-for-service context.

2. **What workflows do I need to make my care delivery more efficient and less manual?** Most often, this means common workflows such as ordering prescriptions and labs.

3. **What data do I want to improve further how I provide care, such as patient onboarding and triage?** This typically means obtaining clinical history from previous providers the patient has seen. **‍**

4. **How do I optimize the care I give and the populations I serve?** This tier can vary widely across different care organizations. For instance, creating referral feeds with close health system partners may be important to some, while optimizing cost-of-care predictions via claims data may be important to others.

## Solving your interoperability needs

Now that you’ve identified your interoperability needs, it’s time to figure out how to solve them.

While the best approach for your company varies based on the data exchange you’re looking to enable, your organization’s technical sophistication, and the level of differentiated value you can create by building vs. buying, from a conceptual standpoint a few options exist:

1. You can leverage the network connections built into your core technology solutions, such as your electronic health record (EHR) or revenue cycle management (RCM) tools

2. You can build directly onto the relevant data exchange network(s)

3. You can work with “on-ramp” vendors who specialize in enabling efficient connection to various data exchange networks

Let’s take a quick look at each.

### **Option 1) Utilize the network connections embedded in your core technology**

Nearly all EHRs and RCM solutions have some degree of network connectivity built in. For example, most EHRs enable e-prescriptions through a built-in connection to the Surescripts network and electronic lab ordering through direct integrations with the big national labs (i.e., Quest and Labcorp). Some EHRs leverage an on-ramp vendor on the backend — which we’ll get to below. EHRs also typically provide connectivity to the national health information exchanges (HIEs), including Carequality, CommonWell, and eHealth Exchange. Similarly, RCM solutions are tied into the major clearinghouses to enable eligibility determination and claims submission.

### **Option 2) Build directly on the networks**

For data exchanges that involve networks, you can, in most cases, build your own connections. At a certain scale, building directly to the network can save on margin and allow for more control close to the wire — which can be useful when taking advantage of cutting-edge network features. However, this approach doesn’t make sense for most digital health provider organizations. It’s time-consuming in terms of gaining access to the network and technical implementation. The latter often requires detailed knowledge of the legacy data standards and allocates valuable developer resources to building non-differentiated technical solutions, such as record locator services, to use the network effectively.

### **Option 3) Leverage interoperability-focused network on-ramp vendors**

For many provider organizations, the built-in connectivity in their core tools is sufficient. However, some may find there are additional value-added services they want to add that are only available by working directly with the on-ramp vendors, or fine-grained control of retrieved data that is impossible to access when stored in the EHR. Companies developing their core infrastructure in-house (e.g., building their own EHR) will almost certainly want to work with an on-ramp vendor to meet their data exchange needs.

At their core, on-ramp vendors do several things:

- Streamline the application process for joining a network (e.g., helping providers become a part of the Carequality, CommonWell, and eHealth Exchange networks)

- Simplify the technical implementation and enable bi-directionality of data exchange where relevant

- Provide network search functionality (i.e., record locator and identity verification services) to maximize an organization’s ability to utilize the network

- Consolidate access to multiple networks through a single application programming interface (API)

- Offer value-added services, in particular helping to aggregate and clean the data found through the network and translate it into a more useful format, such as fast healthcare interoperability resources (FHIR)

As noted earlier, these vendors are most relevant when your interoperability needs aren’t fully met by your existing core technology solutions, or you’re building your own EHR or RCM solutions in-house.

## Evaluating interoperability vendors

Interoperability vendors can be tricky to evaluate. Many companies operating in this space seem to purposely make it difficult to understand what they’re doing.

Part of the reason it’s so difficult is that these companies break down into a few different archetypes. And unless you know the space well, it’s hard to understand which type they are.

In his two-part [API Bible series](https://healthapiguy.substack.com/p/the-previously-undiscovered-bible), the Health API Guy Brendan Keeler gives a helpful overview of the four types of API companies‍

1. Headless businesses — Companies that build an underlying asset (e.g., some sort of software solution) and expose it via API

2. On-ramps — Companies that provide developer-friendly access to legacy data exchange networks

3. Open aggregators — Companies that aggregate disparate, messy, non-proprietary data resources and expose them via API

4. Closed aggregators — Companies that build network connections between organizations (note: there is significant variation across these businesses in terms of whether they’re truly building a ubiquitous network or simply a series of adapters)

Most of the interoperability vendors that are relevant for digital health provider organizations fall into the on-ramp category, so we’ll focus on how to evaluate these types of companies. That said, there are a few organizations we’ve covered that do represent other archetypes.

### Evaluating on-ramp vendors

On-ramp vendors, by definition, provide access to a pre-existing network. As such, there’s really no material difference in the data they’re able to access.

Instead, these types of companies tend to differentiate along the dimensions of pricing — which becomes more commodity-like over time — and usability, specifically:

- The ability to adequately find relevant data (hit rate) — In most cases, there is no central record locator service that knows where each patient’s records reside. Instead, on-ramps ensure their query strategies account for all of the places where a patient’s record might be

- Data processing capabilities — The ability of the vendor to aggregate, clean, filter, and translate the data into your preferred format (for example, FHIR)

- The usability of the API — The ease of building against the API to bring the data into your system

- The usability of the user interface (UI) — An important factor to consider if you care more about presenting the data visually (for example, allowing a provider to view clinical history)

Some of these companies have also begun to branch out into other services and secondary data sources — however, these only factor into the decision-making process if they’re relevant to your business.

Ultimately, the key to evaluating an interoperability vendor is ensuring that the vendor meets your specific use case well. In other words, ensuring the vendor can deliver the data you need, in the format you want, in a way that’s easy to access and supports your workflows, and at a price you can afford. We highly recommend leveraging developer sandboxes and pilots to ensure any vendor you’re evaluating meets your needs.

## Your new interoperability strategy

If we did our job with this article, you should now have all the background you need to develop your interoperability strategy.

‍Specifically, if you’re a digital health provider organization, you should know what interoperability means for your context, what your specific interoperability needs are, what type of solution(s) to consider, and, at a high level, how to evaluate vendors in the space.

‍All that remains is for you to go out and assess the solutions and vendors you’re considering!

---
*Source: [Elion Health](https://elion.health/resources/guide-interoperability)*