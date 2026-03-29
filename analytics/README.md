# Analytics (graph ETL, sales ingest, MCP)

Sibling to `Penny/`. Full stack overview lives in the repo root [README.md](../README.md).

## Prerequisites

- Node 18+, `npm install` in this directory
- Docker (Memgraph + Qdrant): `npm run infra:up`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in `.env` (LLM extraction / RAG)
- [gog](https://github.com/steipete/gog) Gmail CLI for Google Alerts mining (`brew install` or set `GOG_CLI` to the binary path)
- `GOOGLE_ALERTS_ACCOUNT` or `GMAIL_ACCOUNT` (defaults in code if unset)

## Email mining (Google Alerts)

Fetches messages labeled **Google Alerts**, parses article links, pulls Reddit + HN, then runs Claude to extract companies and write leads to the graph. **Processed alert messages are removed from the inbox** (archived) only after a **successful** full run—if the pipeline errors (e.g. API billing), emails stay in the inbox so you can retry.

```bash
npm run alerts:ingest              # default --newer 7d
npm run alerts:ingest -- --newer 14d
npm run alerts:ingest -- --no-archive   # parse only; do not archive Gmail
```

Unified runner (alerts ± RSS):

```bash
npm run ingest:all
npm run ingest:all -- --source alerts
npm run ingest:all -- --source rss
```

## Vault / knowledge ETL

```bash
npm run etl                  # full vault → graph + Qdrant
npm run etl:clean            # destructive: drop and reimport
npm run etl -- --venture 1putt
```

## Scheduler & MCP

```bash
npm run scheduler:status
npm run mcp:dev
```

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Anthropic `credit balance is too low` | Add credits at [Plans & Billing](https://console.anthropic.com/), then re-run ingest. |
| `port 3003 already allocated` | Another service uses the port; `docker compose` still starts Memgraph/Qdrant—adjust `docker-compose.yml` for `analytics-lab` if you need that UI. |
| Gmail / `gog` not found | Install `gog` or set `GOG_CLI=/path/to/gog`. |
