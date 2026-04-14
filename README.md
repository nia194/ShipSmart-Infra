# ShipSmart-Infra

Infrastructure, deployment configs, Supabase migrations/edge functions, and documentation for the ShipSmart system.

## Repo layout

ShipSmart is split across four repos. Clone them as siblings under the same parent directory:

```
parent/
├── ShipSmart-Web/            React + Vite frontend
├── ShipSmart-Orchestrator/   Spring Boot Java API
├── ShipSmart-API/            FastAPI Python + MCP tools
└── ShipSmart-Infra/          (this repo)
```

| Repo | GitHub | Render service(s) |
|---|---|---|
| ShipSmart-Web | https://github.com/nia194/ShipSmart-Web | `shipsmart-web` (static site) |
| ShipSmart-Orchestrator | https://github.com/nia194/ShipSmart-Orchestrator | `shipsmart-api-java` |
| ShipSmart-API | https://github.com/nia194/ShipSmart-API | `shipsmart-api-python`, `shipsmart-mcp-tools` |
| ShipSmart-Infra | https://github.com/nia194/ShipSmart-Infra | — (no Render service) |

## Contents

- `supabase/` — migrations, edge functions (14), config.toml.
- `scripts/` — `dev-start.sh`, `check-env.sh`, `run-mcp-server.sh` (adapted for sibling-repo layout).
- `docs/` — architecture, migration plans, phase notes, study guides.
- `docs-ui/` — UI screenshots.
- Root MDs — deployment runbooks, credential gathering, env-var references.
- `render.yaml.legacy` — archived copy of the pre-split monorepo Render blueprint (reference only).
- `.env.example` — aggregated env vars across all 3 services.

## Local development

1. Clone all 4 repos as siblings.
2. Copy `.env.example` sections into each service repo's own `.env` file (or `.env.local` for Web).
3. From this repo, run `bash scripts/check-env.sh` to validate.
4. Run `bash scripts/dev-start.sh all` to start all 3 services.

## Deployment

Each service repo owns its own `render.yaml`. Render reads the blueprint from the repo the service is linked to:

- `ShipSmart-Web/render.yaml` → 1 static-site service
- `ShipSmart-Orchestrator/render.yaml` → 1 Java web service
- `ShipSmart-API/render.yaml` → 2 Python web services (FastAPI + MCP tools, same codebase)

Supabase migrations and edge functions are deployed via the Supabase CLI from `supabase/` in this repo.
