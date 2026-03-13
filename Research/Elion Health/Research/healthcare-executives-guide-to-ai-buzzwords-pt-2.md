# Under the Hood: A Healthcare Executive's Guide to AI Buzzwords Pt. 2

**Date:** June 20, 2025

---

# Under the Hood: A Healthcare Executive's Guide to AI Buzzwords Pt. 2

Colin DuRant

_Editor’s Note: We’re excited to continue a new monthly series to demystify healthcare AI_ _concepts, empowering leaders to make informed decisions. This month continues our series providing a history and clear explanations of common AI acronyms and terms._

[Previously on “Under the Hood,”](https://elion.health/resources/under-the-hood-ai-buzzwords) we started unraveling the buzzword overload in vendor marketing and pitch decks. We discussed machine learning with an emphasis on natural language processing (NLP) and computer vision (CV).

This month, we’ll explore neural networks, deep learning, and transformers: the building blocks of generative AI and the rapid advancements seen over the last several years.

Let's start with **neural networks**, the core building blocks of modern AI. These computational models loosely imitate the brain's structure, using interconnected nodes ( [neurons](https://qbi.uq.edu.au/brain/brain-anatomy/what-neuron)) to process and transmit information.

[Geoffrey Hinton](https://en.wikipedia.org/wiki/Geoffrey_Hinton), the “godfather of deep learning,” [described](https://www.wired.com/story/ai-pioneer-explains-evolution-neural-networks/) neural networks as, “…models of neurons. They have connections coming in, each connection has a weight on it, and that weight can be changed through learning. And what a neuron does is take the activities on the connections times the weights, adds them all up, and then decides whether to send an output. If it gets a big enough sum, it sends an output.”

On their own, single-layer neural networks can recognize basic clinical patterns like determining if a patient's vital signs exceed predefined thresholds or [separating](https://ieeexplore.ieee.org/document/1287675) fetal ECG from a composite ECG of both maternal and fetal ECGs. However, many healthcare problems involve more complex patterns that are difficult to capture with just a single computational step.

**Deep learning** addresses this complexity by stacking multiple layers of neurons, each refining insights from the previous layers. This multi-layer—or “deep”—architecture helps models interpret complicated, real-world healthcare data like identifying early-stage tumors from medical imaging or predicting patient deterioration from subtle lab result changes.

Around 2010, two key developments propelled deep learning forward, rapidly accelerating progress and practical impact:

1. Researchers ( [including Hinton](https://www.newyorker.com/magazine/2023/12/04/how-jensen-huangs-nvidia-is-powering-the-ai-revolution)) realized that graphics processing units (GPUs), the specialized computer processors historically used mostly for video games, could train neural networks. This new processing power significantly sped up and reduced cost barriers, unlocking faster iteration and the ability to generate increasingly deeper networks.

2. [Web 2.0](https://en.wikipedia.org/wiki/Web_2.0) generated massive labeled datasets—especially images—transforming deep learning from niche experimentation into a practical toolkit. Models like [AlexNet](https://en.wikipedia.org/wiki/AlexNet), which revolutionized image recognition in 2012, and Facebook’s [DeepFace](https://en.wikipedia.org/wiki/DeepFace) in 2014 showcased this capability vividly.

Traditional neural networks and deep learning models effectively analyze structured data and uncover complex patterns in images or text. However, even deep neural networks [struggle](https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/s12874-022-01665-y) with long context sequences, which are required for tasks like understanding clinical notes, conversations, or lengthy patient histories.

In 2017, everything changed when Google published “ [Attention Is All You Need.”](https://arxiv.org/pdf/1706.03762) This paper introduced **transformers**: not the cartoon robot vehicles of the 1980s, but instead, a groundbreaking neural network architecture that handles sequential data exceptionally well, whether it’s text, time series, or patient trajectories, by employing what’s called _self-attention_.

Unlike previous models, self-attention allows **transformers** to weigh each data element dynamically against every other. This capability captures nuanced relationships across long distances in a sequence. Transformers excel at modeling context and nuance. This is the reason systems like GPT-4 can now generate coherent [clinical summaries](https://elion.health/categories/ai-clinical-summaries/products), engage in human-like dialogue via [voice agents](https://elion.health/categories/patient-facing-ai-phone-calls/products), or [interpret](https://elion.health/categories/clinical-pathways-and-reference/products) complex medical literature with striking precision.

Next month, we’ll detail generative AI and large language models (LLMs), connecting the fundamentals and applications now transforming healthcare from revenue cycle management to clinical workflows.

---
*Source: [Elion Health](https://elion.health/resources/healthcare-executives-guide-to-ai-buzzwords-pt-2)*