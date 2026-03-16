
> Event-driven serverless architecture on AWS with TypeScript as the primary language.

**See also:** [Company Overview](Company%20Overview.md) | [Medplum Self-Hosting](Self-Hosting%20on%20AWS.md) | [Migration Architecture](Architecture.md)

## Languages

| Language | Usage |
|----------|-------|
| TypeScript | Primary — all engineering teams |
| Python | Data teams |

## Cloud & Infrastructure

| Layer | Technology |
|-------|-----------|
| Cloud provider | **AWS** |
| IaC | **AWS CDK** |
| Compute | **AWS Lambda** (serverless) |
| API (REST) | **API Gateway** |
| API (GraphQL) | **AppSync** |
| Primary database | **DynamoDB** |
| Complex queries | **Aurora PostgreSQL** |
| Event bus | **EventBridge** |
| Queuing | **SQS** |
| Pub/sub | **SNS** |
| Orchestration | **Step Functions** |
| Data lake | **S3** |
| Query engine | **Athena** (bronze layer) |

## Compliance

- SOC 2 Type I (achieved late 2024)
- HIPAA

## Integration Ecosystem

| Integration | Details |
|------------|---------|
| Payer network | 600+ contracts incl. Medicare/Medicaid |
| Pharmacy | Network partners for medication fulfillment |
| Lab | Order, referral, and results integration |
| E-Prescribe | **Current:** DoseSpot (via Healthie) / **Target:** EPCS via Medplum |
| Video/Telehealth | **Migrating** from Doxy.me → proprietary system using **Amazon Chime SDK** + **Amazon Connect** |
| Payments | **Stripe** (primary, $1B+), **ChargeBee** (~12 customers). Centralizing via ESL. |

## Data & Analytics Strategy

- **Current:** S3 + Athena as bronze layer; Zello Analytics for BI (looking to replace)
- **Evaluating:** Databricks, Snowflake, or similar data warehouse
- Medplum has an AWS Athena guide that aligns with the current analytics stack
- Python used by data teams for analytics workloads

## Developer Tools

| Tool | Purpose |
|------|---------|
| **Cursor** | AI-assisted IDE (available to all engineers) |
| **Claude Code** | Anthropic CLI (seats being procured) |
| **OpenCode + Bedrock** | Claude via AWS Bedrock — better performance, 10% cheaper via enterprise contract |
| **LocalStack** | AWS emulation for local development (rolling out) |
| **Excalidraw** | Working diagrams (shared across team) |
| **Figma** | Polished board-level / audit diagrams |
| **WIZ** | Cloud security posture management — IDE extensions for IaC misconfigurations |
| **Linear** | Project management (dev teams; platform team uses Jira) |
| **Healthie MCP Server** | Local dev tool for GraphQL API + additional tools |

## Architecture Patterns

- **Macro services** — broad domains with subdomains (not microservices)
- **Separate repos per domain** — migrating from monorepo to enforce boundaries
- **Separate AWS accounts per domain** — prevents cross-domain dependencies
- **Enterprise Service Bus** (EventBridge) — primary inter-domain communication
- **Event Gateway** — transforms vendor events into canonical OpenLoop events

## Stack Alignment with Medplum

| OpenLoop | Medplum |
|----------|---------|
| TypeScript | TypeScript/Node.js |
| AWS CDK | AWS CDK deployment |
| Lambda serverless | Bots (serverless functions) |
| EventBridge events | FHIR Subscriptions |
| Aurora PostgreSQL | PostgreSQL (native) |
| S3 + Athena | AWS Athena guide available |
