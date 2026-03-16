# Open Loop Tech Stack

Created: March 1, 2026 11:18 PM
employment: No

<aside>
⚡ Priority page — OpenLoop runs an event-driven serverless architecture on AWS with TypeScript as the primary language.

</aside>

## Languages

- **TypeScript** — Primary language across all engineering teams
- **Python** — Used by data teams

## Cloud & Infrastructure

- Cloud Provider: **AWS** — Event-driven serverless architecture
- Infrastructure as Code: **AWS CDK**

## Compute

- **AWS Lambda** — Serverless functions (primary compute)

## API Layer

- **API Gateway** — REST APIs
- **AppSync** — GraphQL APIs

## Databases

- **DynamoDB** — Primary database
- **Aurora PostgreSQL** — Complex access patterns

## Messaging & Events

- **EventBridge** — Enterprise service bus
- **SQS** — Message queuing
- **SNS** — Pub/sub notifications

## Orchestration

- **Step Functions** — Workflow orchestration

## Analytics

- **S3** — Data lake storage
- **Athena** — Query engine (bronze layer)

## Compliance

- **Compliance:** SOC 2 Type 1 (achieved late 2024), HIPAA

**INTEGRATION ECOSYSTEM**

**Payer Network** — 600+ payer contracts including Medicare and Medicaid. Broad insurance coverage enabling nationwide telehealth delivery.

**Pharmacy Partners** — Network of pharmacy partners for competitive medication costs and fulfillment.

**Lab Partners** — Lab order, referral, and results integration. Supports diagnostic workflows within the telehealth platform.

**E-Prescribe**

- **Current:** DoseSpot (via Healthie integration)
- **Target:** EPCS support via Medplum (EPCS-certified)

**Video/Telehealth** — Platform-native video consultation capabilities integrated into the white-label experience.

**DATA & ANALYTICS STRATEGY (from CTO interview)**

- **Current:** S3 + Athena as bronze layer; Zello Analytics for BI (looking to replace)
- **Evaluating:** Databricks, Snowflake, or similar data warehouse solutions
- Medplum has an AWS Athena guide that aligns with the current analytics stack
- Python used by data teams for analytics workloads