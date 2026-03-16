# Migration — Architecture & Abstraction Layer

> 85% of OpenLoop customers are performance marketers who'd "throw up" at FHIR. The Partners API abstracts FHIR behind a domain-friendly REST API. Future health system customers get direct FHIR access via API key to the MedPlum instance.

**See also:** [Tech Stack](Tech%20Stack.md) | [Payments & ESL](../OpenLoop/Payments%20&%20ESL.md) | [Access Control](../Medplum/Access%20Control%20&%20Multi-Tenancy.md) | [Phases](Phases.md)

## The Problem

OpenLoop's B2B2C clients are primarily performance marketers — non-technical, non-healthcare companies. They are good at patient acquisition and engagement but need an abstracted REST API, not FHIR. Only future health system customers (long sales cycle) will want FHIR directly.

## Partners API Design (formerly "Abstraction Layer")

The customer-facing API is called the **Partners API** internally. It serves as the single ingress point for all external integrations, abstracting both MedPlum (clinical) and the Payments ESL (financial).

```mermaid
graph TD
    P1["Partner Apps<br/><i>85% marketers</i>"]:::app
    HS["Health Systems<br/><i>future, FHIR-native</i>"]:::hs
    PA["Partners API<br/><i>REST</i>"]:::api
    EG["Event Gateway"]:::gw
    ESB["Enterprise Service Bus<br/><i>EventBridge</i>"]:::esb
    MP["MedPlum CDR<br/><i>FHIR R4</i>"]:::cdr
    ESL["Payments ESL<br/><i>Stripe / ChargeBee</i>"]:::esl

    P1 --> PA
    PA --> MP
    PA --> ESL
    HS -->|"API key to MedPlum"| MP
    MP --> EG
    ESL --> EG
    EG --> ESB

    classDef app fill:#3498DB,stroke:#2176AC,color:#fff
    classDef hs fill:#1ABC9C,stroke:#16A085,color:#fff
    classDef api fill:#F39C12,stroke:#D68910,color:#fff
    classDef gw fill:#E67E22,stroke:#D35400,color:#fff
    classDef esb fill:#9B59B6,stroke:#7D3C98,color:#fff
    classDef cdr fill:#2ECC71,stroke:#1FA84D,color:#fff
    classDef esl fill:#635BFF,stroke:#4B44C0,color:#fff
```

## Architectural Alignment

| Pattern | OpenLoop Current | Medplum Target |
|---------|-----------------|---------------|
| Serverless compute | Lambda | Medplum Bots (can run on Lambda) |
| Event system | EventBridge | FHIR Subscriptions → EventBridge bridge |
| API layer | API Gateway + AppSync | API Gateway (abstraction) + Medplum FHIR API (internal) |
| Orchestration | Step Functions | Step Functions (unchanged) + Medplum Bots |
| Database | DynamoDB + Aurora | Medplum PostgreSQL (FHIR) + DynamoDB (non-clinical) |

## Domain Organization

OpenLoop uses **macro services** (broad domains with subdomains) rather than microservices. Each domain is a bounded context owned by a team.

- Each domain has its **own repo** and **own AWS account** (migrating from monorepo)
- Domains communicate primarily through the **Enterprise Service Bus** (EventBridge)
- Some exceptions for data that doesn't make sense to replicate (e.g., organization service — direct calls)
- **Event Gateway** transforms events from disparate sources, removes vendor implementation details, publishes canonical OpenLoop events to the ESB

## Key Architectural Decisions

1. **MedPlum as internal FHIR layer** — not exposed directly to most customers
2. **Partners API as the product surface** — domain-friendly REST for the 85%
3. **Direct FHIR access for health systems** — API key to MedPlum instance for future enterprise customers
4. **Bots for integration logic** — maps to existing Lambda patterns
5. **Event Gateway → ESB** — canonical OpenLoop events, vendor-agnostic
6. **Multi-tenant via MedPlum Projects** — each client gets isolated data/access policies
7. **Payments replication into MedPlum** — ESL is SoR for payments, but data replicates to CDR for holistic view
8. **Separate repos + accounts per domain** — enforces boundaries, prevents cross-domain dependencies
