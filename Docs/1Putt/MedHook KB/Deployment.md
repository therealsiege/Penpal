---
tags: [medhook, deployment, devops, infrastructure]
created: 2026-03-08
---

# Deployment

The [[Engine]] is self-hosted — customers deploy it on their own infrastructure. The [[Web App]] runs on Vercel. The [[Desktop App]] installs locally and manages the Docker stack.

## Deployment Options

### 1. Desktop App (Recommended for Getting Started)

The simplest path:

1. Install the [[Desktop App]]
2. Sign in via OAuth (creates account on medhook.dev)
3. License key auto-fetched from platform
4. Click "Start Stack" → Docker Compose spins up all 8 services
5. Build workflows in the visual designer

### 2. Docker Compose (Development / Small Deployments)

```bash
cd engine
cp .env.local.example .env.local
# Configure: ENCRYPTION_MASTER_KEY, LICENSE_KEY, DATABASE_URL, REDIS_URL
docker compose up -d
# Access engine at http://localhost:3000
```

**8 services:** Engine, Redis, Postgres, Medplum, MLLP, Prometheus, Grafana, IPSec (optional)

### 3. Docker Production (`docker-compose.prod.yml`)

Adds to dev compose:
- CPU/memory resource limits per service
- File-based secrets management
- Log rotation (10 MB/file, 3 files/service)
- PostgreSQL and Redis backup/restore procedures

### 4. AWS Fargate (Terraform)

**Architecture:** VPC with public subnet (ALB) + private subnet (Fargate tasks)

```bash
cd engine/terraform/aws
terraform init
terraform plan -var="license_key=mdh_live_xxx" -var="encryption_key=xxx"
terraform apply
```

- Multi-AZ deployment
- RDS PostgreSQL + ElastiCache Redis
- ACM certificates for custom domain
- Horizontal scaling (more tasks) + vertical scaling (more resources)
- **Cost:** Dev ~$84/mo, Production ~$261/mo

### 5. Azure Container Instances (Terraform)

```bash
cd engine/terraform/azure
terraform init && terraform apply
```

- Container Group deployment
- PostgreSQL Flexible Server + Azure Cache for Redis
- Key Vault for secrets
- Vertical scaling only
- **Cost:** Dev ~$65/mo, Production ~$298/mo

### 6. GCP Cloud Run (Terraform)

```bash
cd engine/terraform/gcp
terraform init && terraform apply
```

- Serverless architecture (autoscaling)
- Cloud SQL + Memorystore Redis
- VPC Access Connector for private DB
- Secret Manager for credentials
- Cloud Armor WAF (optional)
- **Cost:** Dev ~$70/mo, Production ~$562/mo

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_MASTER_KEY` | 64-char hex key for AES-256-GCM |
| `LICENSE_KEY` | License from medhook.dev |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

## Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_APP_URL` | `https://medhook.dev` | Web app for license validation |
| `ENGINE_AUTH_SECRET` | — | JWT signing secret |
| `ANTHROPIC_API_KEY` | — | Claude API for AI mapping |
| `PORT` | `3000` | Engine HTTP port |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `NODE_ENV` | `production` | Environment mode |
| `MAX_CONCURRENT_WORKFLOWS` | — | Concurrency limit |

## Health Checks

| Service | Endpoint/Method |
|---------|-----------------|
| Engine | `GET /api/health` |
| Redis | `redis-cli ping` |
| Postgres | `pg_isready` |
| Medplum | `GET /healthcheck` |
| MLLP | HTTP health endpoint |

## Monitoring

- **Prometheus** scrapes engine metrics at `/api/metrics`
- **Grafana** dashboards pre-configured
- Metrics tracked: workflow executions, adapter operations, HTTP requests, system health

## Related

- [[Engine]]
- [[Desktop App]]
- [[Architecture]]
- [[Security and Compliance]]
