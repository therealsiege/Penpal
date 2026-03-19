# Oscar Built A New Claims System From Scratch—Here’s What We Think About It

**Date:** October 1, 2024  
**Author:** Patrick Wingo, Head of Research, Elion

---

# Oscar Built A New Claims System From Scratch—Here’s What We Think About It

Claims rules have evolved enormously in complexity over time, and payers require nearly 100% uptime on these systems. As a result, these systems at large payers and third party administrators (TPAs) have become a patchwork of technologies, often running on COBOL and other legacy codebases.

In many instances, eligibility, prior auth, and claims logic are run partially in-house and partially delegated to third parties who provide their own sets of rules and adjudication for certain conditions and patient populations. As a result, most systems tend to be slow, have high administrative costs, and lack transparency. Consequently, many processes in revenue cycle management have evolved to accommodate these issues.

For example, payers often can’t determine in advance if a given procedure will be covered using the same logic as the claims system. Instead, they have duplicative pathways to represent eligibility rules, which can sometimes differ from the underlying claims logic. Prior authorization requires manual intervention, often outside of the claims system itself, using a parallel set of rules and guidelines for medical necessity. It’s also challenging to detect fraud, waste, and abuse when the claims processing logic is a complex black box distributed across a variety of systems.

This week, we read Oscar’s [claims system technical deep dive](https://medium.com/oscar-tech/tackling-the-challenge-of-a-new-claims-system-part-1-1e551326bbda). Over several years, their team re-architected their claims infrastructure, building a standalone, monolithic platform from scratch. In doing so—with the ability to integrate AI for better data structuring and non-clinical decision-making—Oscar claims to have unlocked key use cases:

1. **Enable real-time claims operations:** The new system supports dynamic claims processing, allowing for point-of-sale integrations and instant reactions to fraud, waste, and abuse signals. Counterfactual adjudication lets Oscar test contracts and benefits against a “golden set” of claims to ensure accuracy and compliance.

2. **Enhance visibility into claims and benefits:** Oscar’s system produces accurate, real-time cost estimates based on member plans and provider contracts, while detailed adjudication tracing helps pinpoint why claims are approved or denied. This transparency empowers both members and service representatives to make more informed decisions about benefit changes, supported by a domain-specific language (DSL).

3. **Unify analytics for better decision-making:** Oscar’s unified system keeps production and analytics data in sync, enabling consistent reporting and real-time actuarial analysis. The system’s “time machine” analytics provide historical data for audit and reporting purposes, powered by central data models and temporal stores.

4. **Remove legacy system limitations:** By building a clean, modular system from scratch, Oscar eliminated “black box” code, making the platform more flexible and understandable. The modular design also allows for services beyond claims processing, such as eligibility determinations and, in the future, prior auth.

From Oscar’s perspective, all of these systems will help them operate more efficiently within their medical loss ratio (MLR) requirements. It stands to help them negotiate more favorable contracts with providers as well, if they can provide faster and more accurate eligibility checks, prior auth, and claims processing than other payers. Perhaps more importantly, it will allow them to become more affordable and capture a much higher market share—after all, in the individual market, the single most important factor for consumer choice is the price of the premium.

From my perspective, the most interesting aspect is Oscar’s stated intention to externalize the claims platform over time, making it accessible to other payers. The entire revenue cycle is built around asynchronous communications and long-running processes of requests and approvals, itemized receipts, and payments. As more payers gain the ability to process requests accurately and in real-time, it’s possible that providers will see a reduction in days for accounts receivable, less back-and-forth with payers, and a smoother patient payment process.

While we’re excited about all the technology helping providers improve their half of the revenue cycle, much of it compensates for problems on the payer side. This investment into a real-time claims system is a glimmer of hope for how things might improve.

---
*Source: [Elion Health](https://elion.health/resources/oscar-payer-claims-system)*