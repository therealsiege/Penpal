# The Disconnect Between AI Research and Application in Healthcare with Girish Nadkarni of Mount Sinai Health System

**Date:** November 7, 2025  
**Author:** Bobby Guelich, Research and Application in Healthcare with Girish Nadkarni of Mount Sinai Health System

---

CEO, Elion

_This is part of our executive insights series where Elion CEO Bobby Guelich speaks with healthcare leaders about their tech priorities and learnings. For more, become a member and sign up for our_ [_email list_](https://elion.health/#signup) _._

**Name:** [Girish Nadkarni](https://www.linkedin.com/in/girish-nadkarni-653b0564/)

**Role:** Chair, Windreich Department of AI and Human Health; Chief AI Officer; Director, Hasso Plattner Institute for Digital Health at Mount Sinai

**Organization:** [Mount Sinai Health System](https://www.mountsinai.org/)

**Can you start with an overview of your role at Mount Sinai?** I wear a few hats. Mount Sinai was the first medical school to establish a Department of AI and Human Health—the Windreich Department—and I chair it. We focus both on advancing next-generation AI technologies—like foundation models in pathology or cardiology—and ensuring they’re deployed safely, effectively, and responsibly. We also lead educational programs to make AI literacy universal across Mount Sinai.

I also direct the [Hasso Plattner Institute for Digital Health](https://www.hpims.org/), where we’re building two flagship programs:

- **AI-Ready Mount Sinai**, which unifies multimodal data in a privacy-protected, linked environment for research and deployment.

- **The Digital Discovery Program**, focused on the next frontier of medicine—wearables, augmented reality, and data-driven clinical innovation.

Lastly, on the operations side, I serve as the Chief AI Officer, responsible for our enterprise AI deployment, monitoring, assurance, and overall strategy.

**What areas are you most focused on right now?** AI assurance and AI monitoring. We face what my colleague [Karandeep Singh](https://profiles.ucsd.edu/karandeep.singh) calls the _healthcare AI paradox_: Academics produce a huge volume of AI research that never makes it into practice, while the tools that are deployed clinically often lack rigorous evaluation. That’s risky—we don’t always know how these models perform in real-world populations, whether they’re safe or effective, or even if they deliver ROI.

My focus is on bridging that gap, bringing academic rigor into operational AI use. Assurance is central to that. FDA clearance doesn’t necessarily mean a model will perform the same way in your population, so we test locally before deployment to confirm it works as intended. Then we monitor over time, since both models and the underlying data change, including clinician behavior, population characteristics, workflows. The monitoring cadence should match risk level: high-risk clinical models get tighter oversight than lower-risk operational ones.

**How have you operationalized that at Mount Sinai?** We’ve already established an AI Assurance Lab, led by [Ankit Sakhuja](https://www.linkedin.com/in/ankit-sakhuja-mbbs-ms-facp-fasn-fccp-fccm-famia-4445ba6/), one of the first in the country. We’ve stratified all models in use across the health system using a standardized risk rubric adapted from national frameworks. The highest-risk models go through full assurance first, and we expect to have every model in clinical care assured by next year.

We’ve also aligned our governance infrastructure so that digital and AI governance sit on the same platform. It’s organized around use-case categories, such as patient-facing, workforce, research, and other. The assurance process produces a report on model performance and suitability, which feeds into governance decisions about whether a tool remains active or is paused.

There’s also a Risk, Ethics, and Policy (REP) Committee, mostly ethicists and operational leaders, that reviews responsible AI use. Final decisions and escalations go to the executive committee, which includes our CEO, Dean, and Chief Digital Information Officer.

**Does assurance cover both in-house and third-party tools?** Yes, though it’s easier for some than others. Predictive models are relatively straightforward; we can validate performance quantitatively. Generative AI is more challenging because it’s nondeterministic, but we still apply structure. We use emerging benchmarks like _HealthBench_ and maintain mechanisms for surfacing issues or complaints, followed by a root-cause review to decide whether to retrain, continue monitoring, or turn the tool off.

**What does assurance look like in practice?** Take bias testing, for example. You can run a model on your own representative data and alter only the demographic variables—gender, race, age—to see if outcomes shift. We’ve built an open-source pipeline for this, published in [_Nature Medicine_](https://pubmed.ncbi.nlm.nih.gov/40195448/). But that requires a strong clinical informatics network—people trained in both medicine, informatics and AI—to interpret results.

Assurance isn’t static; you repeat it at regular intervals, especially for high-risk cases. Vendors also need to provide model cards or equivalent transparency artifacts. Policy is catching up too. States like California have already passed AI laws requiring auditability and transparency across sectors, and healthcare will be part of that. We maintain a [non-partisan policy tracker](https://www.healthaipolicy.org/) that tracks policies state by state.

**Given the resource intensity of that process, how do you think it scales?** In the long run, much of it will be automated or semi-automated. Predictive AI models can be containerized and tested in zero-trust environments using standardized data layers, so assurance can be run continuously and reproducibly. Generative models are harder, but even there, AI agents can help flag anomalies or outliers for human review. We’re moving toward a future where assurance is AI-augmented, faster, and less labor-intensive, especially for lower-risk models.

**How might smaller or less resourced health systems participate?** Most won’t build their own assurance labs, and that’s okay. I think we’ll see regional or national assurance consortia emerge: shared labs that smaller systems can rely on, potentially funded by vendors or as a public good. Vendors might even pay for assurance as part of implementation readiness. Ultimately, this benefits everyone. Assurance builds trust—clinicians are more willing to use AI if they know it’s been validated on their population, and patients benefit from safer, higher-quality tools.

---
*Source: [Elion Health](https://elion.health/resources/ai-research-healthcare-girish-nadkarni-mount-sinai-health-system)*