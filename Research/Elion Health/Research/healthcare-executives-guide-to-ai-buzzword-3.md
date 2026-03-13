# What's in a Name? A Healthcare Executive's Guide to AI Buzzwords: Part 3

**Date:** August 12, 2025

---

Colin DuRant

After a tour through the basics of machine learning, natural language processing (NLP), and computer vision (CV) in [Part 1](https://elion.health/resources/under-the-hood-ai-buzzwords) and neural networks, deep learning, and transformers in [Part 2](https://elion.health/resources/healthcare-executives-guide-to-ai-buzzwords-pt-2), we’ve finally reached the thing readers have been hearing everywhere: **generative AI**(or GenAI) and [**large-language models (LLM)**](https://aws.amazon.com/what-is/large-language-model/).

Think of GenAI as the ability for a trained system to synthesize new text, images, audio, or structured rows after learning patterns at scale. LLMs are a specific type of GenAI focused on processing and generating human-like text.

Under the hood, today’s GenAI systems are primarily [**neural networks**](https://developers.google.com/machine-learning/crash-course/neural-networks) built from [**transformer**](https://arxiv.org/abs/1706.03762) blocks. In basic terms, these systems learn to model the probability of sequences and then _sample_ from that distribution. In practice, that means predicting the next token again and again until a coherent output appears. That’s all an LLM is: a massive, very accurate “next word” prediction [engine](https://writings.stephenwolfram.com/2023/02/what-is-chatgpt-doing-and-why-does-it-work/).

### **Why the Explosion and Why Now?**

A quick lookback in history helps put this moment in context. For decades, real-word uses of AI in healthcare skewed [discriminative](https://www.datacamp.com/blog/generative-vs-discriminative-models) rather than generative. These models could make _judgements_: readmission risk, “yes” or “no”; sepsis alert, “on” or “off”; “likely denial” or “clean claim.” They dominated because they were tractable, benchmarkable, and useful on structured data.

While some generative modeling existed, the industry lacked the architecture, data, and compute to make it dependable at scale. As we covered in our previous [discussion](https://elion.health/resources/healthcare-executives-guide-to-ai-buzzwords-pt-2), the [introduction](https://arxiv.org/pdf/1706.03762) of transformers by Google in 2017 changed the math on all of the previous constraints.

Between 2018 and 2023, three ingredients converged:

1. **Architecture**: Transformers made it possible to keep an entire chart or a payer policy “in mind.”

2. **Compute**: The cloud abstracted the “plumbing”—scaling, scheduling, and reliability—so teams could focus on data and use cases, not hardware.

3. **Data**: Web-scale data plus industry-specific sources gave models broad linguistic fluency and a clinical vocabulary to work with.

Layer on [**instruction-tuning**](https://www.ibm.com/think/topics/instruction-tuning) (so the model follows directions), reinforcement learning from human feedback or [**RLHF**](https://huggingface.co/blog/rlhf) (so the model stays aligned with human preferences), and [**retrieval**](https://aws.amazon.com/what-is/retrieval-augmented-generation/) (so it can pull facts from your own corpus rather than guess), and all the ingredients are present for the massive leaps in capabilities we’ve seen.

As we touched upon earlier, LLMs are essentially just next word predictors, but all of the features above are what forced the dramatic improvement of getting the next word (or [token](https://seantrott.substack.com/p/tokenization-in-large-language-models)) correct.

### **What Have GenAI and LLMs Enabled in Healthcare, Concretely?**

In just a few short years, **ambient scribing** moved from novelty to near-ubiquity. While the idea of clinical transcription isn’t a new concept (just see how [long](https://www.nuance.com/asset/en_us/collateral/healthcare/infographic/ig-dmo-evolution-en-us.pdf?srsltid=AfmBOooXFgNlEstEJEWdmIRjf6pRA5dSRPhY_oWnRzEGJMVTDVF2t-8e) it took Nuance), LLMs can hold enough context to track a full encounter, disentangle speakers, and produce drafts clinicians could accept with minimal edits, thereby unlocking a much greater level of utility and adoption.

Revenue-cycle teams now see credible value from models that draft prior-auth letters, propose CPT/ICD codes for review, and summarize appeal rationales against payer policy.

Clinically, LLMs condense multi-day ICU notes, translate specialist jargon into plain-language portal messages, and generate de-identified synthetic data to augment sparse cohorts.

The common thread is speed to a quality first draft and then pairing the generative storyteller with discriminative checks for policy compliance, safety, and coding accuracy before anything is finalized.

### **Where This Points Next**

Generative models and LLMs shifted AI’s center of gravity from analysis to creation. Next month, we’ll follow the arc to agentic AI (voice agents that handle real conversations), how modern agents differ from classic RPA (planning, tool use, and memory vs. scripted keystrokes), and what multi-agent architectures mean for complex workflows like denials management and care coordination.

---
*Source: [Elion Health](https://elion.health/resources/healthcare-executives-guide-to-ai-buzzword-3)*