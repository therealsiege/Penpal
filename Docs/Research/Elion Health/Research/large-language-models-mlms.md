# Large Language Models Market Map: Unlocking the clinical use case

**Date:** September 24, 2024  
**Author:** Patrick Wingo, Head of Research, Elion

**Categories:** Foundation Model Platforms and APIs

---

_This is part of Elion_’ _s weekly market map series where we break down critical vendor categories and the key players in them. For more, become a member and sign up for our email_ [_here_](https://elion.health/#signup) _._

You can’t bake a cake without flour, sugar, and eggs, and you can’t build a GenAI application without an LLM underpinning it. While many AI vendors are developing their own models or using off-the-shelf models, there are an increasing number of innovative health systems and providers turning to LLMs in order to build critical, custom applications.

LLMs are large-scale deep learning or machine learning models trained on vast datasets to perform tasks like natural language understanding, text summarization, translation, question answering, and conversational interaction. They’re used in AI applications to ingest large amounts of data—such as medical datasets, research findings, or patient records—to generate summaries, recommendations, and responses. Examples include [ambient scribes](https://elion.health/categories/ai-ambient-scribes/products), [clinical decision support](https://elion.health/categories/point-of-care-clinical-decision-support/products), [intelligent contact center agents](https://elion.health/categories/ai-contact-center-intelligence/products), and more.

To be considered for our large language model category, vendors need to produce a specific model or mixture of models that’s available for direct consumption by other developers, as opposed to building a model used only within the confines of their application.

## Are LLMs Ready for Clinical Use?

While LLMs are already being used extensively in administrative functions [like revenue cycle management](https://elion.health/resources/2024-ai-in-rcm-report), the next frontier is their use in clinical settings. The key question is: When will LLMs be accurate and safe enough for clinical use, and what safeguards need to be in place?

While we’ve seen dramatic progress in [performance on tests like USMLE and MedQA](https://cloud.google.com/blog/topics/healthcare-life-sciences/sharing-google-med-palm-2-medical-large-language-model), indicating improved clinical reasoning on individual tasks, only 5% of studies in a [systematic review](https://hai.stanford.edu/news/large-language-models-healthcare-are-we-there-yet) of LLM performance evaluated the models on real data from patient care.

Some of the major challenges in applying these models to clinical scenarios include:

- **Accuracy and safety**: The models must handle rare clinical cases, dosage calculations, and complex drug names without making errors or producing hallucinations.

- **Regulatory compliance**: They must ensure HIPAA-compliant infrastructure, accurate patient identification, and robust privacy protections.

- **Bias and consistency**: These models need to incorporate demographic data in decision-making without introducing biases, and their outputs must be consistent.

- **Patient interaction**: The communication must be clear, non-leading, and adaptable to patient variability.

- **Workflow integration**: LLMs should integrate smoothly into clinical workflows, supporting clinician judgment rather than replacing it.

## Breaking Down the Large Language Model Market

Given the rate of progress with LLMs, we’re seeing a few different approaches in how vendors are producing and making these models consumable.

- **Frontier models**: AI research labs and hyperscalers, focused on building the most advanced general models, like [OpenAI](https://elion.health/products/openai), [Meta/Llama](https://elion.health/products/llama), [Gemini](https://blog.google/technology/ai/google-gemini-ai/), and [Anthropic](https://elion.health/products/anthropic-claude), are heavily investing in algorithmic research and infrastructure. These models, however, are geared toward broad use cases rather than healthcare-specific needs.

- **Fine-tuned models**: [John Snow Labs](https://elion.health/products/john-snow-labs)’ MedLlama3, [Gradient](https://elion.health/products/gradient)’s Nightingale, [ScienceIO](https://elion.health/products/scienceio), and [Insights AI](https://elion.health/products/insights-ai) are examples of frontier models fine-tuned for healthcare. As frontier models evolve, these specialized models need to be retrained to maintain their functionality, often incorporating compliance features for handling patient data.

- **Foundational models**: Some use-case-specific models, such as those from [GenHealth.ai](https://elion.health/products/genhealth-ai-lmm) (focused on population health) and [Harrison.ai](https://elion.health/products/harrison-rad-1q) (multimodal models for radiology), are built independently from frontier models to meet highly specialized needs.

- **Mixture of agents**: One of the most promising techniques for LLMs seems to be the use of multiple agents (models with specific instructions, context, and memory), each prompted or fine-tuned for specific tasks, where the output of one model can be processed and used as the input of other models. This approach has shown success in products like [Hippocratic AI](https://elion.health/products/hippocratic-ai) and [MedGemini](https://elion.health/products/medgemini).

Our bet is that progress in frontier models and in novel architectures like mixture of agents will continue to drive improved performance on benchmarks like the USMLE, MedQA, and other field-specific tests. However, determining whether a model is safe, accurate, consistent, and free of bias in real-world clinical settings remains challenging without rigorous testing on actual patient data.

When developing workflows, it’s crucial to evaluate several leading models side by side to compare their performance. It’s also wise to anticipate upgrading or replacing models within a year as they evolve and become more refined, potentially yielding even better results.

## Better LLMs=Better For Everybody

This is arguably one of the most exciting areas in healthcare technology, as a rising tide lifts all boats. Advancements at any level, whether in frontier models, fine-tuning, or architecture, can lead to significant improvements in model performance, unlocking more clinical use cases and driving broader adoption.

---
*Source: [Elion Health](https://elion.health/resources/large-language-models-mlms)*