# Platform Packages — @olh/* Ecosystem

> The `@olh/*` package ecosystem is the shared foundation for all OpenLoop domain services. 9 packages covering CDK infrastructure, EHR abstraction, event sourcing, SDK wrappers, error handling, and developer tooling.

**See also:** [Tech Stack](Tech%20Stack.md) | [Platform Infrastructure](Platform%20Infrastructure.md) | [Architecture](../Migration/Architecture.md)

## Monorepo Structure

The packages live in `olh-packages/` — a pnpm workspace with Turborepo for task orchestration.

```
olh-packages/
├── package.json            # Root: TypeScript 5.9.3, Turbo 2.8.10, Biome 2.4.4
├── pnpm-workspace.yaml     # Supply chain security policies
├── .npmrc                  # CodeArtifact registry
├── turbo.json              # Build/test/lint pipeline
├── scripts/
│   ├── setup-codeartifact.sh
│   └── publish-version.sh
└── src/
    ├── constructs/         # @olh/constructs  v1.22.4
    ├── ehr-client/         # @olh/ehr-client  v1.3.0
    ├── events/             # @olh/events      v1.11.13
    ├── sdk/                # @olh/sdk         v1.12.12
    ├── error-handler/      # @olh/error-handler v1.4.2
    ├── envcheck/           # @olh/envcheck    v1.3.9
    ├── utils/              # @olh/utils       v1.4.2
    ├── presets/            # @olh/presets     v1.12.2
    └── cli-repository-generator/  # @olh/cli-repository-generator v1.2.8
```

## Package Inventory

### @olh/constructs (v1.22.4)

AWS CDK L2+ construct library. 22 construct families covering the full serverless stack.

| Family | Key Exports | Purpose |
|--------|-------------|---------|
| **app** | `SecureApp`, `NagSuppressions` | CDK app wrapper with cdk-nag security compliance |
| **api-gateway** | `RestApi`, `ProducerRestApi` | REST APIs with producer/consumer cross-account pattern |
| **event-bus** | `EventBus`, `EventBusArchive`, `CrossAccountEventBus`, `LogGroupTarget` | EventBridge multi-account with KMS encryption |
| **function** | `NodeFunction`, `LlrtFunction`, `Layers`, `Extensions` | Lambda with LLRT (Low Latency Runtime) support |
| **network** | `Network`, VPC, Subnets | VPC infrastructure with private API endpoints |
| **patterns** | `ApiGatewayToSqs`, `DynamoStreamToTopic`, `DynamoStreamTopicToEventBridge` | Serverless integration patterns |
| **stack** | `SubDomainStack` | Nested stack patterns for multi-domain architectures |
| **waf** | WAF constructs | Web Application Firewall (CloudFront + API Gateway) |
| **table** | DynamoDB Table | Table with security defaults |
| **bucket** | S3 Bucket | Bucket with encryption/versioning defaults |
| **step-function** | Step Functions | Workflow orchestration |
| **queue** | SQS Queue | Message queue patterns |
| **topic** | SNS Topic | Pub/sub messaging |
| **iam** | `IntegrationRole` | Cross-account IAM roles |
| **kms** | KMS Key | Encryption key management |
| **cloudfront** | CloudFront | CDN distribution patterns |
| **pipe** | EventBridge Pipes | Event transformation and routing |
| **rule** | EventBridge Rule | Event routing rules |
| **logs** | LogGroup | CloudWatch Logs configuration |
| **custom-resource** | Custom Resource | Lambda-backed custom resources |
| **third-party-integrations** | PagerDuty | External service integrations |
| **match** | Match patterns | CDK assertion/comparison helpers |

Dependencies: `aws-cdk-lib ^2.243.0`, `@olh/sdk`, `@olh/events`

### @olh/ehr-client (v1.3.0)

**The migration bridge.** Dual-provider EHR client with a builder pattern that lets domain services call the same API surface regardless of whether the backing provider is Healthie or Medplum.

```
ehr-client/src/
├── ehr-client-builder.ts       # Builder pattern entry point
├── ehr-client.ts               # Main client facade
├── endpoint-executor.ts        # Endpoint execution engine
├── adapters/
│   ├── medplum-adapter.ts      # REST, GraphQL, SDK transports
│   └── healthie-adapter.ts     # GraphQL transport only
├── auth/
│   ├── oauth2-auth-provider.ts # Medplum OAuth2 with token caching
│   └── api-key-auth-provider.ts# Healthie API key auth
├── types/
│   ├── endpoint.ts             # BuilderRestEndpoint, BuilderGraphQLEndpoint, BuilderSdkEndpoint
│   ├── provider.ts             # Provider enum (Medplum, Healthie)
│   └── transport.ts            # Transport types: REST, GraphQL, SDK
└── domains/
    ├── domain-registry.ts      # Central endpoint registry
    ├── patient/
    │   ├── medplum/            # Medplum patient endpoints
    │   └── healthie/           # Healthie patient endpoints
    └── questionnaire-responses/
        ├── medplum/
        └── healthie/
```

**How it works:**

1. **Builder** configures providers with auth credentials
2. **Adapters** handle transport differences (Medplum REST/GraphQL/SDK vs. Healthie GraphQL-only)
3. **Domain endpoints** define `toProviderRequest` / `fromProviderResponse` transforms per provider
4. At runtime, the PartnerApi authorizer resolves which provider to use (via `x-ehr-source` header), and the client dispatches to the correct adapter

**Builder pattern:**
```typescript
EhrClientBuilder
  .provider(Provider.Medplum, { baseUrl, clientId, clientSecret })
  .provider(Provider.Healthie, { baseUrl, apiKey })
  .endpoint('getPatient', { medplum: restEndpoint, healthie: graphqlEndpoint })
  .compoundEndpoint('getPatientWithNotes', handler)
  .build()
```

**Adapter comparison:**

| | Medplum | Healthie |
|---|---------|---------|
| Transports | REST, GraphQL, SDK | GraphQL only |
| Auth | OAuth2 (token caching) | API Key |
| SDK | `@medplum/core` v5.1.1 | N/A |
| Extras | FHIR path, custom token URL | AuthorizationSource/Shard headers |

### @olh/events (v1.11.13)

Typed event sourcing with auto-generated JSON schemas. 38 event sources covering all domains.

**Event sources include:** appointments, auth, charting-notes, clinical-ai-assistant, compound-ordering, documents, healthie-integration, junction, orders, organizations, patients, payments, photon, prescription-orders, programs, provider-clinician, stripe, tenant-events, ticketing, users, white-label, and more.

**Schema generation** (`pnpm --filter @olh/events run generate:schemas`):
1. `ts-json-schema-generator` introspects TypeScript event detail types
2. For each source/detailType pair, generates a JSON Schema
3. Output: `src/schemas.generated.ts` — exported as `eventSchemas[source][detailType]`

Used by `@olh/constructs` for EventBridge rule matching and `@olh/sdk` for type-safe event publishing.

### @olh/sdk (v1.12.12)

Thin AWS SDK wrappers with caching and type-safe interfaces.

| Wrapper | Service | Key Features |
|---------|---------|--------------|
| **EventBridge** | `@aws-sdk/client-eventbridge` | Type-safe `putEventCommand` with `AppEvent<S,D>` generics |
| **DynamoDB** | `@aws-sdk/client-dynamodb` | Singleton client pattern |
| **Secrets Manager** | `@aws-sdk/client-secrets-manager` | 5-min TTL cache, multi-region client pooling |
| **SSM** | `@aws-sdk/client-ssm` | Parameter store access |
| **Stripe** | `stripe` v20.4.1 | Third-party payment SDK wrapper |

### @olh/error-handler (v1.4.2)

Comprehensive error type hierarchy: `ValidationError`, `AuthenticationError`, `NotFoundError`, `ProviderError`, `NetworkError`, `GraphQLError`, `ConflictError`, `ResponseError`, `UnsupportedMediaTypeError`.

### @olh/envcheck (v1.3.9)

Environment variable validator with AST-grep integration for dependency analysis. CLI tool (`olh-envcheck`) for validating env vars across monorepo and single-repo deployments.

### @olh/presets (v1.12.2)

Shared configuration presets: Biome config, TypeScript `tsconfig` bases, Bun test presets, React types. Dev-only — not published to consumers.

### @olh/cli-repository-generator (v1.2.8)

CLI scaffolding tool (`olh-repo`) for generating new domain repos with OpenLoop standards. Uses Commander + Inquirer for interactive prompts.

### @olh/utils (v1.4.2)

Shared utility constants and helpers.

## Publishing & Distribution

**Registry:** AWS CodeArtifact
- Domain: `openloop-artifacts` (account `770961405630`)
- Repository: `npm-entry-point-packages`
- Region: `us-east-2`

**Versioning:**
- Per-package semantic versioning (not monorepo-wide)
- NPM tags: `beta` (on merge to main), `latest` (on GitHub Release)
- Internal dependencies use `workspace:*` protocol

**CI/CD pipeline:**
1. **PR Check** — lint, typecheck, test
2. **Merge to main** — `publish-beta.yml` publishes beta tags
3. **GitHub Release** — `publish.yml` publishes latest tags

**Dependency triggers** (`publish-config.json`): Changes to `@olh/presets` trigger republish of all 8 consumer packages. Changes to `@olh/events` trigger republish of `@olh/constructs` and `@olh/sdk`.

## How Domain Repos Consume Packages

Domain repos (e.g., `customer-remedymeds`, `olh-ehr-facade`) declare `@olh/*` dependencies and authenticate to CodeArtifact via `.npmrc`:

```
registry=https://openloop-artifacts-770961405630.d.codeartifact.us-east-2.amazonaws.com/npm/npm-entry-point-packages/
```

Key consumption patterns:
- `@olh/constructs` — CDK stacks use `SecureApp`, `ProducerRestApi`, `NodeFunction`/`LlrtFunction`, `EventBus`
- `@olh/ehr-client` — Lambda handlers build an EHR client from the `x-ehr-source` header
- `@olh/events` — type-safe event publishing via `@olh/sdk` EventBridge wrapper
- `@olh/error-handler` — consistent error responses across all APIs
- `@olh/presets` — shared Biome/TypeScript/Bun configs
