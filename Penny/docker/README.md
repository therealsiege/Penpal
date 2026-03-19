# Penny Control Plane

This folder hosts Penny-managed infrastructure definitions.

## Veritas Kanban

`compose.control-plane.yml` runs a local Veritas Kanban instance with:

- loopback-only host binding (default `127.0.0.1:47832`)
- isolated compose project/network names
- persistent Docker volumes for task/runtime data
- env-driven source/image, ports, and auth keys

## Quick Setup

1. Copy the env template:
   - `cp Penny/docker/env.control-plane.example Penny/docker/.env.control-plane`
2. Update `PENNY_VERITAS_SOURCE_DIR` and keys.
3. Start service:
   - `docker compose --env-file Penny/docker/.env.control-plane -f Penny/docker/compose.control-plane.yml --project-name penny up -d --build`
4. Verify:
   - `curl http://127.0.0.1:47832/health`

Penny app controls this stack via IPC (`veritas:*`) once the main-process service manager is enabled.
