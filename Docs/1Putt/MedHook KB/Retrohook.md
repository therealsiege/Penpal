_You wake up in a cold sweat._

_You’re the Head of Product and you have overcome mountains. You’ve identified use cases, built something that meaningfully solves problems, found your first customers, and even raised a bit of money._

_Yet tonight is the night you wake up at 2:44 AM, drenched and shivering as you face your biggest challenge yet, one that could stop all that success in its tracks._

_Integration._

_- Brendan Keeler_

---
![[Pasted image 20260308171751.png|307]]

Healthcare technology (payors, providers and digital health companies) often need to access patient records, but this isn’t as straightforward as one would expect.

_One of the main challenges is the industry still relies on a multi faceted approach that revolves around a technology that pre-dates trusted protocols like HTTP (circa 1995)._

This legacy technology called **HL7/MLLP** (circa 1987) has its own nuances and shortcomings that make it challenging to work with but so widely used.

One of the biggest challenges modern technology teams face is connecting to multiple providers efficiently.

😣 So what choices do organizations have when they need to interact with HL7 event messaging?
# **Classic Buy vs Build**

1. Manage an integration team and build custom integrations
2. Partner with a managed service provider
3. Limited data strategy and feel the FOMO

### Death by 1000 paper cuts…

![[Pasted image 20260308165922.png|243]]

Building healthcare integrations often leads to slippery slope ventures driven by multiple modalities and legacy technologies.

## 😬 Building Integrations
---
Supporting EHR connectivity requires navigating the vast array of formats, standards, and connectivity you might need to accommodate.
![[Pasted image 20260308170001.png|136]]
HL7(v2) data feeds are full of value, but not visible to modern tools and standards.
![[Pasted image 20260308170027.png|247]]
### **FHIR**

---
![[Pasted image 20260308170109.png|242]]
- New, runs over HTTPS
- Built in security mechanisms
- Lacks support for event driven (outside of single subscriptions)
- Driven by regulatory push, technologies like CDS Hook are not mandated until 2028
- Gated by the EHR vendors
### Nationwide Network On-ramps

---
![[Pasted image 20260308170140.png|344]]
- Talk of the town
- Technical and scaling challenges
- Used to augment data not meant as a full solution
- TPO, Particle Health debacle, payment and operations not supported.
- HTI-2 may help in the long term
### Then There's **HL7v2**

---
![[Pasted image 20260308170208.png|257]]
The most ubiquitous clinical information communication standard

- communicates in real-time
- event driven
- used in 95% of organizations.

While it’s used most of the time, it’s legacy nature comes with baggage…

- Point to point bespoke connectivity
- Requires separate security layer
- Antiquated mapping with custom logic
![[Pasted image 20260308170231.png|349]]
## 💲Accelerators For Hire (There’s Hope)



Generally, these options don’t fully alleviate the pain of integration; they just might make the work faster by virtue of hyper-specialized tooling, services, and support.

![[Pasted image 20260308170341.png]]

### **Cloud Tools**

---

1. DIY with engineering resources… blog posts to guide
2. Marketplace partnerships with tech enabled services.
3. DIY accelerators
  
- Off the shelf
    1. 🤨 HL7 complexity: Steep learning curve
    2. 💵 Costly project based endeavors
    3. 🔐 Additional security and compliance (VPN) Separate
- Cloud Tools
    - **Retrohook `v1.5.7` (No-Code, Handles VPN, Single Tenant, AWS Only)**
    - Google Cloud (Requires Code, Handles VPN, GCP Only)
    - Microsoft (Mirth Connect is commonly used, VPN Separate) 

<aside> ⏱️

HL7 integrations are not going away, and they are more than a technical problem. They engulf the business and require multiple stakeholders with time consuming responsibilities orchestrated to meet a go live that rarely happens on time.

</aside>

# **Retrohook Changes This**

---

<aside>

With Retrohook, everything can be done by one person with a few clicks allowing you to implement nimble data strategies with ease.

</aside>

![[Pasted image 20260308170442.png|344]]

![[Pasted image 20260308170502.png|422]]

1. Leverage existing provider EHR feeds to ingest referrals into your modern technology stack.
2. Further automate the office, and remove duplicate patient intake documentation.
3. Bidirectionally ****extend native EHR scheduling with your modern technology stack.
4. Add native EHR connectivity to your best in class analytic solution such as Snowflake or AWS Health Lake. 

## Main Features

---
No Code IPSec Tunneling
![[Pasted image 20260308170623.png|437]]
![[Pasted image 20260308170633.png|420]]
![[Pasted image 20260308170644.png|405]]
![[Pasted image 20260308170701.png|400]]
## AI Workflow Builder

---

Let’s take a look at a simple notification automation
![[Pasted image 20260308170805.png]]
## Message filtering is used to cut out noise

![[Pasted image 20260308170823.png]]
## The sample message allows our models to present all of the options available when building the data map.

![[Pasted image 20260308170849.png]]

## Retrohook handles nuanced logic and sets you up for repeatable mapping

![[Pasted image 20260308170909.png]]

Setup lookup codes, transformations and default values

![[Pasted image 20260308170923.png]]
Set Your destination and check the preview

![[Pasted image 20260308170938.png]]

## Workflow Templates

![[Pasted image 20260308171008.png]]

## Automated Self Hosting

![[Pasted image 20260308171100.png]]

![[Pasted image 20260308171113.png]]
## Team Mode

![[Pasted image 20260308171140.png]]

## Dashboards

![[Pasted image 20260308171204.png]]

## Getting started is easy!

### Environment Setup

---

1. Download role template from [retrohook.com](http://retrohook.com)
2. Execute the downloaded CloudFormation to generate secure credentials in your AWS
3. Create a Retrohook environment in the desired AWS account via [retrohook.com](http://retrohook.com) and using the credentials from above
4. Deploy the 3 stacks into the environment using [retrohook.com](http://retrohook.com)

### Provider EHR Security Setup

---

1. Navigate to the Tunnels module of [retrohook.com](http://retrohook.com)
2. Locate the public and private IP addresses of the desired server
3. Fill in the details above and click generate to create a secure tunnel
4. Download the connection agent for your EHR server
5. Run the connection agent on the EHR server to validate and ensure connection

### EHR Message Event Automation

---

1. Navigate to the Workflows module of [retrohook.com](http://retrohook.com)
2. Choose adapters and upload a sample message
3. Create a filter criteria to ensure only the right messages trigger action
4. Map desired data in Retrohook to your system
5. Set the destination and copy the entry point address for Retrohook
6. Save the workflow (for reusability save it as a template too)
7. Add the entry point to the EHR outbound interface

# Common destinations

Retrohook was originally built to hydrate applications using HTTPS and JSON. We have since extended this to other common destinations helping ensure your favorite modern tools can communicate with EHR events natively.
### ❄️ Snowflake
[https://www.youtube.com/watch?v=QYO088hHfCM](https://www.youtube.com/watch?v=QYO088hHfCM)
### Amazon 🪣 S3
[https://www.youtube.com/watch?v=5GkcPShUO5w](https://www.youtube.com/watch?v=5GkcPShUO5w)

## Guides (more soon)
- https://docs.retrohook.com/docs/guides/s3

## Links & Reference

---

- [https://retrohook.com/](https://retrohook.com/)
- [https://docs.retrohook.com/docs/intro](https://docs.retrohook.com/docs/intro)
- [https://www.youtube.com/channel/UCsgby_S_K27scdBlvvOJK8A](https://www.youtube.com/channel/UCsgby_S_K27scdBlvvOJK8A)
- [https://calendly.com/clint_johnson](https://calendly.com/clint_johnson)
- [Retrohook on LinkedIn](https://www.linkedin.com/company/77638106)
- [https://healthapiguy.substack.com/p/how-to-win-friends-and-integrate](https://healthapiguy.substack.com/p/how-to-win-friends-and-integrate)

## Release Notes

---

**Launch of `1.0` (February 1, 2024)**

- Uni-directional workflows
- AI-powered message parsing
- IPSec security module
- Team mode implementation
- Single tenant infrastructure

**`v1.1` (March 1, 2024)**

- Added support for S3 buckets

**`v1.2` (April 1, 2024)**

- Launched FHIR R4 Workflows with genai capabilities
- Introduced SFTP polling triggers
- Rolled out Cost of Ownership Calculator

**`v1.3` (May 1, 2024)**

- Enabled Workflow Templates feature
- Enhanced IPSec with advanced appliance connectivity

**`v1.5` (July 1, 2024)**

- Implemented bi-directional capabilities
- 2-factor, social and other advanced security features

## Infrastructure

--- 
![[Pasted image 20260308171516.png]]