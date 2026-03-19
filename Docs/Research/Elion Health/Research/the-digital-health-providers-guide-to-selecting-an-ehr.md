# The Digital Health Provider’s Guide to Selecting an EHR

**Date:** June 27, 2023  
**Author:** Bobby Guelich, CEO, Elion

**Categories:** Electronic Health Record (EHR)

---

Dhruv Vasishtha

Advisor, Elion

“Should we build or buy our EHR? If we decide to buy, which one is best for our needs?”

At one time or another, every digital health provider organization has faced these questions.

In fact, from an operational and technical standpoint, selecting your electronic health records (EHR) solution may be the most daunting decision a digital health provider faces. It can significantly influence how you design the rest of your tech stack, what resources you need to hire, and the cost structure of your business as you scale. For those who haven’t been through the process before, the fear of getting it wrong can be paralyzing.

To make the decision a little less intimidating, we’ve put together this guide to help you through the process. In it we’ll cover:

1. What an EHR actually is and when it’s needed

2. How to define your requirements

3. Navigating the age-old build vs. buy decision

4. A step-by-step process for evaluating EHR vendors

Our goal is to help you walk away with a much clearer sense of how to make the right EHR decision for your situation, with the background you need to be able to make it quickly and confidently.

## What is an EHR and who needs one?

### Defining the EHR

If you ask people in healthcare if they know what an EHR is, nearly all of them will say yes. However, if you ask them to define what an EHR does, you’ll get a wide variety of answers, with less overlap than you might expect. So before we go any further, we want to briefly define what we mean when we say “EHR” and share some thoughts about who actually needs one.

Traditionally, the core function of an electronic medical records system is to document the clinical encounter, not only for the purposes of clinical care, but also as support for revenue collection. Collectively this includes the capture of the clinical notes, as well as the translation of these notes into specific diagnosis and procedure codes to enable medical billing workflows.

In addition to documentation, most general ambulatory (i.e., non-inpatient) EHRs include a number of other features as a standard part of their offering. Since these EHRs were originally developed to support traditional brick-and-mortar, encounter-based, fee-for-service care delivery models, their features tend to map directly to the various elements of this end-to-end workflow, including:

- Patient scheduling and intake

- Charting and documentation

- Orders – e-prescriptions, labs, imaging, and referrals

- Patient portals – including self-serve scheduling, billing, order results, and messaging

- Revenue cycle management

- Basic reporting and administrative controls

Outside of this core feature set, most EHRs also provide functionality to support other common clinical and administrative needs that arise along the care journey. There tends to be fairly wide variation in how well EHRs serve these needs, and it’s often in these areas where you see provider organizations start to invest in additional vendor solutions or custom development.

The table below outlines a high-level list of EHR features and functionality typically found in a general ambulatory EHR. We’ve starred (\*) those that we consider to be table stakes for most organizations. For a more granular view, see our [EHR category page](https://elion.health/categories/electronic-health-record/products?utm_source=resource&utm_medium=owned&utm_campaign=EHRLaunch&utm_content=Guide&utm_term=EHRSelection) which outlines 200+ detailed features, their definitions, which EHRs do or do not have them, and vendor-specific demos and documentation.

### When do you need an EHR?

While the answer to this question may seem obvious, we’ve seen companies purchase EHRs when they would have been better off with a simpler or less expensive solution.

Before diving into the EHR selection process we think it makes sense to take a beat and think through whether your situation truly requires an EHR. Specifically, we’d suggest answering the following for yourself: “Does my company need the key features found in a typical EHR, such as patient scheduling and intake, charting, electronic prescriptions, and billing?”

In most cases, the answer is pretty clear – if you’re running a healthcare business that is delivering encounter-based care as part of the model, you’re likely to need an EHR. For some care delivery companies, such as those focusing on a narrow set of conditions and interventions, this could be a very lightweight version (often with a good degree of extensibility to customize the patient and provider experiences).

Where we’ve seen this question get a bit trickier is when you’re running a business that is care-delivery adjacent – such as a care navigation or coaching organization. In these cases, you may be better off with a HIPAA-compliant solution that more closely maps to your workflows – for example a CRM, which is oftentimes better suited for managing longitudinal relationships.

The only other point we’d add is that it’s worth thinking about the likely direction of your company. If you anticipate delivering more clinical services over time, you may want to consider an EHR up front even if you don’t truly need it today. And if you’re thinking about providing care for anyone covered by government-sponsored insurance (such as Medicare or Medicaid), you’ll likely want to go with an ONC certified EHR.

## Figuring out your EHR requirements

If you’re new to selecting an EHR it’s tough to know where to start. Feature lists for EHRs are extensive, and if you’ve never gone through the process it’s easy to overlook critical elements as you’re putting together your own list of criteria.

In our experience, you can get most of the way towards defining your requirements based on 1) the stage of your company, and 2) the core workflows you need to support.

### Consider the stage of your company

If your company is at an early stage, you likely have much to learn about the needs of your patients and providers, and your care model is almost certain to evolve significantly. On the other hand, if your business is established, you probably have a good handle on what you need, and may even be looking to transition off your original EHR to one that better delivers against your exact requirements.

The difference between these stages is significant, and leads to distinct approaches in what to prioritize in an EHR:

### Map out your workflows

When it comes to pulling your specific requirements together, we suggest starting by mapping out the workflows required to power your business, with particular emphasis on the ones that are most important for your model. Your workflows drive your EHR needs, and by mapping them out you both surface the key components your solution needs to have, as well as areas where fuzziness remains.

One approach we’ve seen be effective is to start with your reimbursement archetype – direct to consumer, fee-for-service, or value-based. While there’s certainly overlap between these, each has particular workflows that are most critical to their model and can have significant implications for your tech decisions.

Your EHR is not going to be the solution for every workflow by any means. However, by mapping out these workflows, you’ll be able to determine as you go through the EHR evaluation process which are likely to be covered by most EHRs and where you’ll need to look for alternative solutions.

\[ **Quick Elion Plug:** Our [extensive list of EHR features and definitions](https://elion.health/categories/electronic-health-record/products?utm_source=resource&utm_medium=owned&utm_campaign=EHRLaunch&utm_content=Guide&utm_term=EHRSelection) can be a helpful reference as you’re going through this process. Once you’ve mapped out your workflows and taken an initial cut at translating them into requirements, this list can help you see which are likely to be met by an EHR, as well as help highlight any that you might have missed.\]

## Should you build or buy?

Once you’ve decided that you need an EHR and have a good handle on your requirements, the question becomes whether to build or buy.

Today, this question actually looks fairly different. Rather than a binary choice, it’s instead where you choose to fall along the build vs. buy spectrum, with full from-scratch build on one end and completely off-the-shelf purchase on the other. In between, we’re now starting to see varying degrees of “headless” options emerge, including fully headless FHIR-based application development platforms that allow complete customizability at the expense of out-of-the-box functionality, as well as more fully-featured EHRs offering significant extensibility via an expanding set of APIs.

**Given the growing set of headless options, we believe it rarely makes sense to build an EHR completely from scratch today.** The resources (staffing, time, and cost) associated with building the underlying infrastructure are almost always significantly greater than those required to build on one of the FHIR-based development platforms or to customize a modern, API-forward EHR – with limited benefit. This is even more true if you anticipate supporting Medicaid or Medicare patients, which require an ONC-certified solution for full reimbursement – something you almost certainly don’t want to take on given the [extensive requirements](https://www.healthit.gov/topic/certification-ehrs/2015-edition-test-method/2015-edition-cures-update-base-electronic-health-record-definition).

## A step-by-step process for evaluating EHRs

So what EHR should you go with? Here’s how we’d suggest approaching the decision.

### **Prework: Build your requirements list**

Going into your EHR evaluation process you should have an initial requirements list in place (see our advice on how to create this in the “Figuring out your EHR requirements” section above). This list will undoubtedly evolve as you research potential vendors, but it’s worthwhile to take the time up front to identify what features and functionality you think you’ll need, and which are most important in a potential solution.

Remember to solicit input from stakeholders across the organization as you build your list! The last thing you want is to get to the end of your selection process only to discover that you missed a critical requirement because you failed to connect with a key team member or department up front.

### **Step 1: Gather your list of potential vendors**

This is typically pretty quick to do. If you’re a digital health provider organization (i.e., the primary audience for this article), our [marketplace](https://elion.health/?utm_source=resource&utm_medium=owned&utm_campaign=EHRLaunch&utm_content=Guide&utm_term=EHRSelection) is a one-stop shop for pulling together your vendor list.

### **Step 2: Answer a few key questions to quickly whittle your list down**

In our experience there are a few questions that can help you reduce your list to a few options. By answering these, you can quickly narrow in on the vendors in which you’ll invest significant time assessing their capabilities:

_Do you (or do you intend to) see Medicare or Medicaid patients?_

If so, you’ll want an ONC certified EHR, as using certified EHR technology (CEHRT) is required to receive full reimbursement under Medicare and Medicaid.

_Do you have limited engineering resources and/or do you need your EHR to work for providers and patients out of the box?_

If so, you’ll want one of the solutions that provides fully featured patient and provider UIs and doesn’t require significant engineering work to stand up (i.e., not one of the headless platforms).

_Does the pricing model work for your business, both now and as you scale (i.e., increase the number of patients and providers using the platform)?_

Some vendor pricing models can be cost prohibitive, particularly for earlier stage provider organizations.

### **Step 3: Evaluate the short list against your key requirements**

Once you have your short list (typically 2-4 vendors), your next step is to evaluate them against your set of requirements.

The goal at this stage isn’t necessarily to cross any vendors off the list (though you can if there are any obvious “no’s”). Rather it is to develop a good understanding of the strengths, weaknesses, and open questions for each vendor. Remember to get input from key stakeholders across the organization at this step – you want to make sure you’re incorporating all relevant perspectives as part of your evaluation. This will empower you to go into the next step armed with information you need to fully evaluate your set of finalists.

**\[Another quick Elion plug:** This is the step where Elion can save you _a ton_ of time. Our [EHR comparison tool](https://elion.health/categories/electronic-health-record/products?utm_source=resource&utm_medium=owned&utm_campaign=EHRLaunch&utm_content=Guide&utm_term=EHRSelection) allows you to quickly see which vendors have which features, as well as view demo videos and API docs – saving you weeks of time sitting through vendor calls and building your own feature comparison spreadsheets.\]

### **Step 4: Go deep with your finalists**

Ultimately, there’s no replacement for spending a significant amount of time understanding the ins and outs of your finalists’ solutions. Get a demo account to see what the workflows truly look and feel like, and where you might experience limitations given your model. If they have one, gain access to their developer sandbox to understand how easy or difficult it is to customize the product.

This step can require a significant amount of work, but by moving quickly through steps 1-3 you should be able to spend some of that saved time going deeper with the solutions that are most likely to be a good fit.

### **Step 5: Conduct references with relevant companies**

Before making your final decision, take the time to do references with other companies that have used your preferred solution. Take the vendor up on their suggested references, but also make sure to backchannel with other users (note: this process is something we will be helping buyers with soon – if you’re interested [please reach out](https://forms.gle/SEcLtHLxfX5Sxz7s9)!).

It’s critical to keep in mind that just because another company had a poor experience doesn’t mean you will. It’s often due to a particular nuance of their business that isn’t well supported, and thus not relevant for your situation. Make sure you’re not just asking high level questions, but really digging into their experience with the features that matter most to your workflows.

## There is no perfect solution

If we can leave you with one piece of advice, it’s to remember that there is no perfect EHR solution. Inevitably whichever vendor you go with will have limitations and fail to support particular aspects of your model as well as you’d like. That’s ok. Your job is simply to figure out which meets your needs well enough, and what your plan is to mitigate the shortcomings.

Practically speaking, this means documenting the anticipated gaps and developing an action plan to address them. This could be manual workarounds, custom development, or integrated point solutions. The objective is to ensure that, to the best of your ability, you have thought through how you will leverage the EHR as part of your broader technology strategy to deliver the care model and patient experience that ultimately differentiates your business.

---
*Source: [Elion Health](https://elion.health/resources/the-digital-health-providers-guide-to-selecting-an-ehr)*