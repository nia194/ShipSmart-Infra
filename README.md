# ShipSmart — Infrastructure (`infra`)

[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![pgvector](https://img.shields.io/badge/pgvector-RAG%20store-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Flyway](https://img.shields.io/badge/Flyway-Validate%20Mode-CC0200?logo=flyway&logoColor=white)](https://flywaydb.org/)
[![Deno](https://img.shields.io/badge/Deno-Edge%20Functions-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)](https://render.com/)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue)](./LICENSE)

Single-source-of-truth repo for everything that lives *between* the four
ShipSmart services: Supabase schema migrations, edge functions, local
dev scripts, environment matrices, deployment runbooks, and the
architectural docs that describe how the five repos fit together.

This repo has **no Render service of its own** — it ships database
schema, edge functions, and the documentation that the other four
repos consume.

**Stack:** Supabase (Postgres 15 + Auth) · pgvector · Deno edge functions · Bash dev tooling · Markdown docs · Render Blueprints (per-service, referenced from here)

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [What this repo owns](#what-this-repo-owns)
- [Repo layout](#repo-layout)
- [Supabase: migrations and edge functions](#supabase-migrations-and-edge-functions)
- [Scripts](#scripts)
- [Documentation map](#documentation-map)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [Operational notes](#operational-notes)
- [License](#license)

---

## The ShipSmart ecosystem

ShipSmart is split across five sibling repositories. Clone them under
the same parent directory so the dev scripts in this repo can find them
by relative path.

| Repo | Role | Stack | Render service |
|---|---|---|---|
| [ShipSmart-Web](https://github.com/nia194/ShipSmart-Web) | React SPA — user-facing UI | React 19, Vite, TypeScript | `shipsmart-web` (static site) |
| [ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator) | Java transactional API — **single writer** to Supabase Postgres; quotes, bookings, saved options, carrier integration | Spring Boot 3.4, Java 17 | `shipsmart-api-java` |
| [ShipSmart-API](https://github.com/nia194/ShipSmart-API) | Python AI/orchestration service — RAG, advisors, recommendations, compliance (UC2), multi-agent workflow (UC3/UC4) | FastAPI, Python 3.13 | `shipsmart-api-python` |
| [ShipSmart-MCP](https://github.com/nia194/ShipSmart-MCP) | MCP tool server — `validate_address`, `get_quote_preview` (provider-pluggable) | FastAPI + MCP | `shipsmart-mcp` |
| **[ShipSmart-Infra](https://github.com/nia194/ShipSmart-Infra)** *(this repo)* | Supabase schema + edge functions + deployment configs + docs | Supabase, Deno, Bash, Markdown | — (no Render service) |

```
              ┌──────────────────────────────┐
              │       ShipSmart-Web          │
              │       React SPA · Vite       │
              └──────────────┬───────────────┘
                             │  Authorization: Bearer <Supabase JWT>
                ┌────────────┴────────────┐
                ▼                         ▼
  ┌──────────────────────────────┐   ┌──────────────────────────────┐
  │  ShipSmart-Orchestrator      │◀──│        ShipSmart-API         │
  │  Java / Spring Boot          │   │       Python / FastAPI       │
  │  Sole writer to Postgres     │   │   RAG · advisors · recs      │
  │  Carrier integration (FedEx) │   │   Forwards JWT to Java for   │
  │                              │   │   quote hydration            │
  └──────────────┬───────────────┘   └──────────────┬───────────────┘
                 │                                  │
                 │                                  ▼
                 │                   ┌──────────────────────────────┐
                 │                   │        ShipSmart-MCP         │
                 │                   │   shipping tools (HTTP/MCP)  │
                 │                   │   validate_address, quotes   │
                 │                   └──────────────────────────────┘
                 ▼
  ┌──────────────────────────────┐         ┌──────────────────────────────┐
  │   Supabase Postgres + Auth   │ ◀────── │      ShipSmart-Infra         │
  │   (managed cluster)          │         │   migrations · edge fns      │
  └──────────────────────────────┘         │   docs · scripts · env       │
                                           └──────────────────────────────┘
```

This repo never receives runtime traffic. It defines the schema the
Java orchestrator validates against (Flyway in validate-mode), the
pgvector table the Python service reads, and the edge functions the
frontend can still fall back to via feature flags.

---

## What this repo owns

| Concern | Lives in | Consumed by |
|---|---|---|
| Postgres schema (tables, RLS, triggers) | `supabase/migrations/` | Java Orchestrator (Flyway validate at boot); Web fallback edge fns |
| `idempotency_keys`, `audit_log`, optimistic-locking, soft-delete, `status` columns | `supabase/migrations/20260417120000_interview_upgrade.sql` | Java Orchestrator (writes); Web reads via Java |
| `rag_chunks` pgvector table | `supabase/migrations/20260408034204_create_rag_chunks.sql` | Python `ShipSmart-API` (RAG retrieval) |
| Legacy/fallback edge functions (14) | `supabase/functions/` | Web SPA when `VITE_USE_JAVA_*=false` |
| Local dev orchestration (multi-repo) | `scripts/dev-start.sh`, `check-env.sh`, `verify-post-deployment.sh` | Engineer workstations |
| Aggregated env-var matrix | `.env.example`, `docs/env/` | All four service repos |
| Deployment runbooks, cutover plans, smoke tests | `docs/deployment/`, `docs/post-deployment/` | Release engineering |
| Architecture & system docs | `docs/architecture/`, `docs/architecture-summary.md`, `docs/gap-audit.md` | Engineers, reviewers, onboarding |
| Per-carrier provider notes (UPS/FedEx/DHL/USPS) | `docs/providers/` | Anyone wiring carrier credentials |
| Roadmap & phase history | `docs/roadmap/` | Project planning |

---

## Repo layout

```
ShipSmart-Infra/
├── supabase/
│   ├── config.toml                  Supabase CLI project config (project_id, ports, auth, functions)
│   ├── migrations/                  Versioned SQL (Flyway-compatible naming)
│   │   ├── 20260404030225_*.sql     Initial schema
│   │   ├── 20260404030242_*.sql     Schema follow-up
│   │   ├── 20260408034204_create_rag_chunks.sql        pgvector table for Python RAG
│   │   └── 20260417120000_interview_upgrade.sql        version/updated_at/deleted_at/status
│   │                                                   + idempotency_keys + audit_log
│   ├── functions/                   14 Deno edge functions (see table below)
│   └── snippets/                    Reference SQL snippets (not auto-applied)
│
├── scripts/
│   ├── dev-start.sh                 Start web/java/python siblings (one or all)
│   ├── check-env.sh                 Validate every repo's .env before dev-start
│   ├── run-mcp-server.sh            Legacy: still cd's into ShipSmart-API
│   ├── verify-post-deployment.sh    Smoke-test deployed services
│   └── build_study_guide.py         Generate study-guide artifacts under docs/assets/
│
├── docs/                            See "Documentation map" below
├── legacy/
│   └── render.yaml.legacy           Pre-split monorepo Render blueprint (reference only)
├── .env.example                     Aggregated env vars across all 4 services
├── LICENSE
└── README.md                        (this file)
```

---

## Supabase: migrations and edge functions

### Migrations

Migrations live under `supabase/migrations/` and are named with a
`YYYYMMDDHHMMSS_description.sql` prefix so both the Supabase CLI and
Flyway (in the Java Orchestrator) order them identically.

| Migration | Adds |
|---|---|
| `20260404030225_…sql` | Initial baseline schema. |
| `20260404030242_…sql` | Schema follow-up corrections. |
| `20260408034204_create_rag_chunks.sql` | `rag_chunks` table with `vector(1536)` column for `ShipSmart-API`'s pgvector RAG store. |
| `20260417120000_interview_upgrade.sql` | Optimistic-locking (`version`, `updated_at`), soft-delete (`deleted_at`), `status` columns, plus new `idempotency_keys` and `audit_log` tables consumed by the Java Orchestrator. Flyway runs in *validate* mode and mirrors this file 1:1. |

> **Schema contract:** the Java Orchestrator boots with
> `FlywayValidationRunner` in validate-mode — a pending or drifted
> migration is fatal at startup. When changing schema, land the
> migration here first, copy the same `.sql` file into
> `ShipSmart-Orchestrator/src/main/resources/db/migration/`, then ship
> both repos together. The Python service does not write to these
> tables; it only reads `rag_chunks`.

Apply locally:

```bash
supabase db push                       # apply pending migrations
supabase migration new <description>   # scaffold a new migration
```

### Edge functions (legacy fallback)

All 14 functions under `supabase/functions/` predate the
Java/Python split. Most are still wired into the React app as
fallbacks behind `VITE_USE_JAVA_*` flags — set the flag to `false` to
re-route a given feature through the edge function instead of the Java
API.

| Function | Status | Modern equivalent |
|---|---|---|
| `get-shipping-quotes` | Fallback | Java `POST /api/v1/quotes` |
| `get-saved-options` | Fallback | Java `GET /api/v1/saved-options` |
| `save-option` | Fallback | Java `POST /api/v1/saved-options` |
| `remove-saved-option` | Fallback | Java `DELETE /api/v1/saved-options/{id}` |
| `generate-book-redirect` | Fallback | Java `POST /api/v1/bookings/redirect` |
| `validate-address` | Fallback | MCP `validate_address` tool |
| `ai-shipping-advisor` | Fallback | Python `POST /api/v1/advisor/shipping` |
| `ai-tracking-advisor` | Fallback | Python `POST /api/v1/advisor/tracking` |
| `ai-priority-interpreter` | Legacy | (no current equivalent — flagged in `docs/roadmap/`) |
| `ai-notification-generator` | Legacy | (no current equivalent) |
| `find-dropoff-locations` | Legacy | (no current equivalent) |
| `escalate-tracking-issue` | Legacy | (no current equivalent) |
| `import-tracking-from-email` | Legacy | (no current equivalent) |
| `create-shipment-reminders` | Legacy | (no current equivalent) |

See `docs/roadmap/` for the classification of each function and the
plan for retiring vs. keeping them.

Deploy / update from this repo:

```bash
supabase functions deploy <function-name>
supabase functions deploy --all   # all 14
```

---

## Scripts

All scripts live in `scripts/` and assume the four service repos are
cloned as siblings of this one.

| Script | Purpose |
|---|---|
| `dev-start.sh [web\|java\|python\|all]` | Start one or all sibling services with their expected ports (web 5173, java 8080, python 8000). Checks `.env` presence before launching. |
| `check-env.sh` | Validate that each sibling repo has its `.env`/`.env.local` and that required keys are non-empty. Run this before `dev-start.sh`. |
| `validate-infra.sh` | **This repo's test.** Greps the migrations + edge functions for the contract invariants downstream services depend on, and exits non-zero on drift. Run before deploying a schema/function change. |
| `run-mcp-server.sh` | **Legacy** — still `cd`s into `ShipSmart-API`. The MCP code now lives in `ShipSmart-MCP`; start it with `cd ../ShipSmart-MCP && uv run uvicorn app.main:app --reload --port 8001` instead. |
| `verify-post-deployment.sh` | Hit live `/health` endpoints across the deployed Render services and report status. Use after every promotion. |
| `build_study_guide.py` | Compile architectural docs into `.docx`/`.pdf` study guides under `docs/assets/` (gitignored). |

### Validation

This repo has no application code to unit-test, so `validate-infra.sh` is its
test suite — a lightweight guard for the invariants that, if they drift, silently
break a consumer:

```bash
bash scripts/validate-infra.sh
```

It asserts (1) the hybrid-RAG `match_rag_chunks_lexical(...)` function exists and
`RETURNS TABLE (id, source, chunk_index, text, score)` — the exact shape
`ShipSmart-API`'s `pgvector_store.search_lexical()` unpacks and `ShipSmart-Test`'s
contract test asserts; (2) every `supabase/functions/*/index.ts` registers a
`Deno.serve` handler; (3) every migration filename is timestamp-orderable.

---

## Documentation map

The `docs/` tree is topic-organized. Snapshot docs at the root capture
the *current* state of the system; subdirectories carry historical and
specialized material.

### Start here

| Doc | What it is |
|---|---|
| `docs/architecture-summary.md` | Current truth of the 5-service system. |
| `docs/gap-audit.md` | Per-topic *Implement / Partial / Reject* verdicts. |
| `docs/implementation-plan.md` | Phase A → D delivery plan. |
| `docs/interview-upgrade-summary.md` | Cross-repo change summary for the latest schema/contract update. |

### By topic

| Folder | Contents |
|---|---|
| `docs/architecture/` | System flow, AI-feature architecture, MCP tooling architecture, service boundaries, advisor flows, current-system-state, full-system-integration. |
| `docs/backend/` | FastAPI foundations + backend phases 1–4. |
| `docs/frontend/` | Migration plan, AI integration, runtime checklist, status. |
| `docs/llm/` | LLM integration, provider setup, runtime modes, model routing/selection. |
| `docs/rag/` | RAG architecture, content structure, retrieval quality, knowledge-base guide. |
| `docs/providers/` | `FEDEX_INTEGRATION_SUMMARY.md` + UPS/FedEx/DHL/USPS setup, runtime modes, capability matrix. |
| `docs/deployment/` | `DEPLOYMENT-DAY-RUNBOOK.md`, cutover/launch plans, pre-deployment checklist, smoke tests. |
| `docs/post-deployment/` | Post-deploy smoke tests, stabilization notes, post-phase13 next steps. |
| `docs/env/` | Production env matrix/reference; `ENV-VARS-COPY-PASTE.md` and `CREDENTIALS-GATHERING-GUIDE.md` (local-only, gitignored). |
| `docs/roadmap/` | `OPTION-B1-START-HERE.md`, automation index, interview/next-iteration roadmaps, phase history, migration checklist, known limitations, what-not-to-build, legacy edge functions. |
| `docs/guides/` | `local-development.md` and other how-tos. |
| `docs/assets/` | UI screenshots (`images/`), study-guide outputs (`.docx`/`.pdf`, gitignored). |

---

## Local development

### Prerequisites

- **Node.js 22+** and **pnpm 9+** (for `ShipSmart-Web`)
- **Java 17+** (for `ShipSmart-Orchestrator`)
- **Python 3.13** and [`uv`](https://docs.astral.sh/uv/) 0.6.5+ (for `ShipSmart-API` and `ShipSmart-MCP`)
- **Supabase CLI** (for migrations + edge functions)
- All 5 repos cloned as siblings under the same parent directory

```
parent/
├── ShipSmart-Web/
├── ShipSmart-Orchestrator/
├── ShipSmart-API/
├── ShipSmart-MCP/
└── ShipSmart-Infra/   (you are here)
```

### One-time setup

```bash
# 1. From ShipSmart-Infra: copy aggregated env-var template into each repo
cp .env.example ../ShipSmart-Web/.env.local           # keep VITE_* lines
cp .env.example ../ShipSmart-Orchestrator/.env        # keep Java / FedEx / DB lines
cp .env.example ../ShipSmart-API/.env                 # keep Python / LLM / RAG lines
cp .env.example ../ShipSmart-MCP/.env                 # keep MCP_API_KEY + SHIPPING_PROVIDER lines

# 2. Validate that every repo has its env wired up
bash scripts/check-env.sh

# 3. Apply Supabase migrations (against your local or remote project)
supabase db push
```

### Day-to-day

```bash
# Start web + java + python in three labeled tabs
bash scripts/dev-start.sh all

# Or start one at a time
bash scripts/dev-start.sh web      # http://localhost:5173
bash scripts/dev-start.sh java     # http://localhost:8080
bash scripts/dev-start.sh python   # http://localhost:8000

# MCP server is started separately (the script's run-mcp-server.sh helper is legacy):
cd ../ShipSmart-MCP && uv run uvicorn app.main:app --reload --port 8001
```

### After deploying

```bash
bash scripts/verify-post-deployment.sh    # /health on all live services
```

---

## Deployment

There is **no Render service for this repo**. Each application repo
owns its own `render.yaml`, and Render reads the blueprint from the
repo a service is linked to:

| Blueprint | Service on Render |
|---|---|
| `ShipSmart-Web/render.yaml` | `shipsmart-web` — Static site |
| `ShipSmart-Orchestrator/render.yaml` | `shipsmart-api-java` — Java web service |
| `ShipSmart-API/render.yaml` | `shipsmart-api-python` — Python web service (FastAPI AI/advisory) |
| `ShipSmart-MCP/render.yaml` | `shipsmart-mcp` — Python web service (MCP tool server) |

Supabase migrations and edge functions are deployed via the Supabase
CLI from this repo:

```bash
supabase db push                    # apply pending migrations
supabase functions deploy --all     # deploy all 14 edge functions
```

`legacy/render.yaml.legacy` is the pre-split monorepo blueprint, kept
only for reference. Do not deploy from it.

### Release order

When promoting a schema-changing release, the safe order is:

1. **Apply migrations** (`supabase db push`) so the column/table exists.
2. **Promote `ShipSmart-Orchestrator`** — Flyway boots against the new schema in validate mode.
3. **Promote `ShipSmart-API`** — only matters if `rag_chunks` shape changed.
4. **Promote `ShipSmart-MCP`** if its contract changed.
5. **Promote `ShipSmart-Web`** last so the UI never reaches a backend that hasn't yet seen the schema.
6. **Run `bash scripts/verify-post-deployment.sh`** and follow `docs/post-deployment/`.

See `docs/deployment/DEPLOYMENT-DAY-RUNBOOK.md` for the full checklist.

---

## Environment variables

`.env.example` at the repo root is the **canonical, aggregated** list
of every env var used across the four service repos. Each section is
labeled with the consuming repo and the file it should land in:

| Section in `.env.example` | Destination file |
|---|---|
| `# Web (ShipSmart-Web/.env.local)` | `../ShipSmart-Web/.env.local` |
| `# Orchestrator / Java (ShipSmart-Orchestrator/.env)` | `../ShipSmart-Orchestrator/.env` |
| `# API / Python (ShipSmart-API/.env)` | `../ShipSmart-API/.env` |
| `# MCP (ShipSmart-MCP/.env)` | `../ShipSmart-MCP/.env` |

Production values never live in these files — they are set on the
Render dashboard, marked `sync: false` in each service's `render.yaml`,
and recorded in `docs/env/ENV-VARS-COPY-PASTE.md` (gitignored, local
only).

The two values that consistently bite new contributors:

- **`VITE_SUPABASE_ANON_KEY`** — without it the React app builds and
  serves successfully but every auth-gated page is broken.
- **`SUPABASE_JWT_SECRET`** — without it, the Java Orchestrator
  rejects every authenticated request with `401`.

Both come from the Supabase dashboard (Settings → API).

---

## Operational notes

- **Schema drift between repos.** This repo and
  `ShipSmart-Orchestrator/src/main/resources/db/migration/` must hold
  byte-identical migration files. Flyway in validate mode is the
  enforcement mechanism; if Java refuses to boot on a fresh deploy,
  diff the two folders first.
- **Edge functions vs. Java API.** Both are live and reachable. The
  React app picks between them via `VITE_USE_JAVA_*` flags — use this
  as a fast rollback path if a Java endpoint regresses.
- **`config.toml` `project_id`.** Points to the production Supabase
  project. Override with `SUPABASE_PROJECT_REF` env when working
  against a personal Supabase instance to avoid accidental writes.
- **`docs/assets/` artifacts.** `.docx`/`.pdf` outputs from
  `build_study_guide.py` are gitignored on purpose — regenerate
  locally rather than committing.
- **`legacy/` is reference-only.** Don't deploy `render.yaml.legacy`;
  it predates the four-repo split and will collide with the live
  per-repo blueprints.

---

## License

See [LICENSE](./LICENSE) for the full text.
