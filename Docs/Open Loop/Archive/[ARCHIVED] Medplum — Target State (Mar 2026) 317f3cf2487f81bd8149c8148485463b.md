# [ARCHIVED] Medplum — Target State (Mar 2026)

<aside>
🎯 Medplum is the target EMR — an open-source (Apache 2.0) healthcare developer platform, FHIR R4-native, API-first. Built on TypeScript/Node.js/PostgreSQL, aligning with OpenLoop's stack.

</aside>

## Platform Overview

- Open-source (Apache 2.0) healthcare developer platform
- FHIR R4-native, API-first architecture
- Tech stack: TypeScript, Node.js, PostgreSQL

## Core Capabilities

- **FHIR Datastore** — CRUD operations on all FHIR resources
- **Custom EHR building** — Build tailored EHR applications
- **Bots** — Serverless automation/workflows (similar to Lambda)
- **Subscriptions** — Webhook-equivalent event system
- **Scheduling** — FHIR Schedule/Slot/Appointment
- **Medications** — FHIR MedicationRequest
- **Care plans** — FHIR CarePlan
- **Access control** — Multi-tenant policies

## Self-Hosting on AWS (Recommended Path)

AWS CDK templates provided — matches OpenLoop's existing CDK usage. Includes ECS clusters, VPCs, load balancers, CloudFormation.

- **AWS (CDK)** — Recommended, best alignment with OpenLoop stack
- **Also supports:** GCP (Terraform), Azure (Terraform), Ubuntu, Docker, bare metal
- **Monitoring:** Datadog, OpenTelemetry integrations
- AWS Athena guide available — matches OpenLoop's analytics stack

## Compliance

- HIPAA
- SOC 2 Type II
- ONC Certified (HTI-4)
- EPCS
- ISO 9001
- CFR Part 11

## Ecosystem Connectors

- Labs, Medications, Billing/RCM, Health Exchange (HL7/FHIR), FHIRcast, Plugins

## AI/MCP Integration

- fhir-request tool for CRUD operations
- search tool and fetch tool
- OAuth 2.0 authentication

## Key Links

- [Main Docs](https://www.medplum.com/docs)
- [Self-Hosting Guide](https://www.medplum.com/docs/self-hosting)
- [AWS Install (Recommended)](https://www.medplum.com/docs/self-hosting/install-on-aws)
- [CDK Settings](https://www.medplum.com/docs/self-hosting/aws-cdk-settings)
- [Migration Guides](https://www.medplum.com/docs/migration)
- [MCP Integration](https://www.medplum.com/docs/ai/mcp)
- [FHIR Fundamentals](https://www.medplum.com/docs/fhir-basics)
- [GitHub Repo](https://github.com/medplum/medplum)