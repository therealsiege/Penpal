
> Event-driven serverless architecture on AWS with TypeScript as the primary language.

**See also:** [Company Overview](Company%20Overview.md) | [Platform Packages](Platform%20Packages.md) | [Platform Infrastructure](Platform%20Infrastructure.md) | [Migration Architecture](../Migration/Architecture.md)

## Languages & Versions

| Language/Runtime | Version | Usage |
|-----------------|---------|-------|
| TypeScript | 5.9.3 | Primary — all engineering teams |
| Node.js | >= 22.20.0 | Lambda + local dev |
| Python | — | Data teams |
| pnpm | 10.26.1 | Package manager (workspace protocol) |
| Bun | @types/bun 1.3.10 | Test runner (replaces Jest) |

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

## Build Tooling & CI/CD

| Tool | Version | Purpose |
|------|---------|---------|
| **Turborepo** | 2.8.10 | Monorepo task orchestration (build/test/lint pipeline) |
| **Biome** | 2.4.4 | Linting + formatting (replaced ESLint/Prettier) |
| **Husky** | 9.1.7 | Git hooks (pre-commit, commit-msg) |
| **commitlint** | — | Conventional commit message enforcement |
| **Bun** | — | Test runner (co-located `*.test.ts` files) |
| **esbuild** | — | Lambda bundling |

**CI/CD pipeline:** CodeBuild runners on GitHub Actions.
1. **PR Check** — lint, typecheck, test
2. **Merge to main** — `publish-beta.yml` publishes `@olh/*` beta tags to CodeArtifact
3. **GitHub Release** — `publish.yml` publishes `@olh/*` latest tags

**Local dev:** LocalStack Pro Docker (`ls:start`, `ls:deploy`, etc.) for AWS emulation.

## Supply Chain Security

Driven by a real NPM supply chain attack that motivated the separate-repos-per-domain architecture.

| Policy | Value | Effect |
|--------|-------|--------|
| `minimumReleaseAge` | 1440 min (24h) | Quarantine: no package installed until 24h after publish |
| `trustPolicy` | `no-downgrade` | Prevents installing packages with decreased trust levels |
| `strictDepBuilds` | `true` | Fails if dependencies have unreviewed build scripts |
| `blockExoticSubdeps` | `true` | Only direct dependencies may use git/tarball sources |
| `strictPeerDependencies` | `true` | Peer dependency mismatches are errors |
| `nodeLinker` | `isolated` | Strict node_modules isolation |

**Exclusions:** `ts-node`, `typescript`, `@types/node`, `@olh/*` (internal packages exempt from release age).

## Package Registry

`@olh/*` packages published to **AWS CodeArtifact**:
- Domain: `openloop-artifacts` (account `770961405630`)
- Repository: `npm-entry-point-packages`
- Region: `us-east-2`
- Per-package semantic versioning with dependency triggers

See [Platform Packages](Platform%20Packages.md) for package inventory and details.

## Lambda Runtimes

| Runtime | Construct | Use Case |
|---------|-----------|----------|
| **Node.js 22** | `NodeFunction` | Standard Lambda functions |
| **LLRT** (Low Latency Runtime) | `LlrtFunction` | Cold-start-sensitive functions (sub-ms startup) |

Both from `@olh/constructs`. Bundled with esbuild.

## Developer Tools

| Tool | Purpose |
|------|---------|
| **Cursor** | AI-assisted IDE (available to all engineers) |
| **Claude Code** | Anthropic CLI (seats being procured) |
| **OpenCode + Bedrock** | Claude via AWS Bedrock — better performance, 10% cheaper via enterprise contract |
| **LocalStack Pro** | AWS emulation for local development (`ls:start`, `ls:deploy`) |
| **Biome** | Linting + formatting (replaced ESLint/Prettier) |
| **Bun** | Test runner (replaced Jest) |
| **Turborepo** | Monorepo build orchestration |
| **Husky + commitlint** | Git hooks + conventional commit enforcement |
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
