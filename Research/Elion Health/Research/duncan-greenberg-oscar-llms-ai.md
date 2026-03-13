# LLMs’ Impact on Startup Roadmaps with Duncan Greenberg, formerly of Oscar Health

**Date:** February 13, 2025  
**Author:** Bobby Guelich, CEO, Elion

**Categories:** Foundation Model Platforms and APIs

---

_This is part of our weekly executive insights series where Elion CEO Bobby Guelich speaks with healthcare leaders about their tech priorities and learnings. For more, become a member and sign up for our email_ [_here_](https://elion.health/#signup) _._

**Can you briefly introduce yourself and your role at Oscar?**

Until very recently, I was SVP of Product at Oscar where I worked for eight years. I oversaw product management, product design, and user research, which means I was responsible for much of the technology roadmap. During the time I was there, we scaled the company from 80,000 members to nearly 1.8 million across 18 states. In the last couple of years, a major focus was on our AI initiatives, which was about integrating LLMs into our tech stack and workflows to unlock efficiencies and improve our member experience. This work spanned both the insurance business as well as Oscar Medical Group, which is the practice that powers Oscar’s virtual care offerings.

**How do you see LLM adoption playing out across different types of companies?**

The arrival of LLMs has affected companies differently depending on the stage they’re at. It’s created a bit of a technology cliff in that way.

For example, early-stage startups that were in the market already had to very quickly assess whether LLMs were an accelerant or posed a threat by lowering the bar for competition. Also, in making it easier to solve some technology problems, they suddenly put even more emphasis on workflow integration, distribution, and the ability to show measurable impact.

For the big incumbents, they’ve been slowest to adopt but have the biggest opportunity. Many still rely on paper-heavy workflows that are ripe for automation, so their success will depend on choosing the right partners, and overcoming organizational inertia rather than trying to build solutions themselves.

For growth-stage startups (e.g., Oscar), they both have the benefit of scale and the potential to meaningfully impact costs and the tech capacity to actually implement AI quickly. But they still face complex build vs. buy decisions, and have to constantly evaluate whether to solve something in-house, and if so with what model, or integrate with vendors in what continues to be a fast evolving landscape.

**For those growth-stage startups, how do you see LLMs impacting the build vs. buy decision?**

The rapid evolution of models makes vendor selection tricky. Companies risk investing in a startup only to see a better one emerge mid-integration. Similarly, off-the-shelf models, both closed and open source, keep improving, with a growing number of tools and libraries to make them easy to deploy and monitor, raising questions about whether the added value from a vendor’s wrapper is worth the lock-in especially since you’re in effect paying not only for the compute but also for the vendor’s sales team, ops team, legal team, profit margin, etc. Companies need to monitor the market constantly and will probably have to be comfortable hitting the reset button on their decision making framework a few times before this phase of the AI trend has played out over the next 10 years.

**How would you say that differs for more established incumbents?**

If you’re not especially technologically adaptable, then it makes sense to essentially hitch your wagon to a startup or implementation partner that you’ve vetted both for their ability to react to new technologies and their long term viability as a business. It just so happens that the funding environment is very favorable right now, such that it’s unlikely today’s standouts are going to suddenly cease to exist in the next few years. But we could find ourselves in a different environment in a few years, where things are a bit more volatile, and that’s when vendor selection will become even more of a delicate process.

**Has vendor evaluation changed in this AI-driven environment?**

I would say it’s 80% the same, 20% different. You still assess vendor risk and product quality, ideally using competitive bake-offs. But with GenAI:

- Outputs are non-deterministic, so even in setting up and running a pilot, there’s more effort required on the client’s part to determine whether the outputs are up to snuff, whether the team using the outputs is succumbing to automation bias, whether the occasional errors you get are tolerable or highly problematic, etc

- Pricing models are shifting; a good number of AI startups now charge based on performance rather than fixed fees, aligning cost with measurable impact, which is a positive development but sometimes it can take time to agree on the attribution methodology that will be used in this case

- There’s heightened sensitivity to data privacy and breach liability in the contracting and BAA process, especially if client data is being used to train a model, since in theory, if someone was really careless, a version of your data could show up in another client’s model outputs

- New vendors emerge frequently, forcing constant reassessment. Related to this, long-term contracts are risky. The AI landscape is evolving too fast to commit to multi-year deals.

**What AI trends are you excited about in 2025?**

There are a couple things I’m really intrigued by:

- **Voice Agents:** This year is shaping up to be the year of the AI voice agent. While inbound call centers are an obvious use case, there are also significant opportunities for voice AI in outbound patient engagement and B2B use cases, such as provider-to-provider or provider-to-pharmacy interactions.

- **Self-Learning AI Models:** Today’s LLM agents don’t learn from past interactions in real time. But new reinforcement learning techniques (like those used to incentivize reasoning in DeepSeek) could eventually allow AI models to improve continuously based on their success or failure in completing a task. This will be especially impactful in areas like call centers where AI agents can learn based on whether the patient’s question was resolved or the patient scheduled an appointment, if that was the goal. These are examples of single interaction conversion but you could imagine extending this concept to more clinically complex scenarios with lagging outcomes as well _\[Editor’s note: We’ve previously shared some conjecture around AI model learning in the context of RCM in our_ [_State of AI in RCM 2024 Report_](https://elion.health/resources/2024-ai-in-rcm-report) _.\]_

**Are there any learnings you can share based on your experience implementing AI within the products you were building?**

One is that it’s significantly harder than people assume to measure, validate, and iterate on results on the path to production. LLM-based products in particular require subject matter experts—doctors, nurses, billing analysts—folks who may have to be pulled away from patient care or daily task queues to review the outputs for accuracy, adding significant time and cost to the development process. Many companies underestimate this.

Another is that people often hold AI to a higher standard than human performance. For example, self-driving cars get scrutinized for rare accidents, even though human drivers crash far more frequently. AI in healthcare faces a similar perception challenge—companies need to define what’s “good enough” at the outset, long before you get to the point of pushing something to production to avoid delays. Ideally the threshold you set corrects for the tendency to hold AI to a super-human standard. Also, for consistency you should try to align AI evaluation with existing quality control processes (e.g., chart reviews, call note audits) rather than reinventing quality benchmarks and sampling procedures.

---
*Source: [Elion Health](https://elion.health/resources/duncan-greenberg-oscar-llms-ai)*