---
tags: [medhook, product, overview]
created: 2026-03-08
---

# MedHook

**Healthcare Data Integration Platform — AI at its Core**

MedHook is the next generation of [[Retrohook]], rebuilt from the ground up as an AI-native, self-hosted, multi-cloud integration platform for healthcare.

Where Retrohook proved the market — no-code HL7v2 workflows on AWS — MedHook expands the vision: a visual DAG workflow engine that handles FHIR, HL7v2, X12, REST, and SFTP with AI-assisted data mapping, all deployable on any cloud or on-prem via Docker.

## What Changed from Retrohook

| Dimension | Retrohook v1.5 | MedHook |
|-----------|----------------|---------|
| Architecture | AWS-only, single-tenant SaaS | Self-hosted Docker + multi-cloud (AWS, Azure, GCP) |
| Workflow Model | Linear pipelines | DAG (directed acyclic graph) with parallel, loop, condition nodes |
| Protocols | HL7v2/MLLP + FHIR (basic) | HL7v2/MLLP + FHIR R4 + X12 EDI + REST + SFTP + Webhooks |
| EHR Adapters | Generic MLLP | Epic, Athena, Oracle, Medplum + generic FHIR |
| AI | AI-powered message parsing | Claude-powered field mapping suggestions with confidence scores |
| Data Mapping | Manual with AI suggestions | Visual mapping UI + AI-assisted + code tables + custom JavaScript |
| Transforms | Basic field mapping | Field mapping, JavaScript (sandboxed), HL7v2-to-FHIR, FHIR-to-HL7v2, X12, templates |
| Security | IPSec tunnels, AWS-managed | AES-256-GCM encryption, JWT auth, sandboxed code execution, RBAC |
| Deployment | AWS CloudFormation only | Docker Compose + Terraform (AWS Fargate, Azure ACI, GCP Cloud Run) |
| Client | Web-only | Desktop app (Electron) + Web app + Engine UI |
| Pricing | SaaS subscription | Nonprofit (free), Credit Bundles ($299+), Enterprise |

## Three-Component Architecture

MedHook is a **two-product system** with a desktop control center:

1. **[[Engine]]** — The self-hosted integration runtime. Visual workflow builder, 10 adapters, DAG execution engine, Redis + PostgreSQL. Runs via Docker on customer infrastructure.

2. **[[Web App]]** — The SaaS platform at medhook.dev. User accounts, license management, analytics dashboard, billing. Deployed on Vercel.

3. **[[Desktop App]]** — Electron app that manages the Docker stack locally. Visual workflow designer, service monitoring, OAuth with the web app.

## Core Value Proposition

1. **AI-First Mapping** — Claude API suggests field mappings between any healthcare format with confidence scores
2. **Self-Hosted Control** — Customer owns their infrastructure and data (HIPAA-friendly)
3. **Visual + Code** — No-code DAG designer with optional JavaScript transforms (sandboxed)
4. **Healthcare-Native** — Purpose-built for FHIR, HL7v2, X12, and EHR-specific APIs
5. **Multi-Cloud** — Deploy to AWS, Azure, or GCP with Terraform templates

## Key Links

- [[Architecture]]
- [[Adapters]]
- [[Security and Compliance]]
- [[Deployment]]
- [[API Reference]]
- [[Roadmap]]
- [[Development Guide]]
- [[Competitive Landscape]]
