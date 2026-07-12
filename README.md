# ShipSmart — Infrastructure (`infra`)

[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![pgvector](https://img.shields.io/badge/pgvector-hybrid%20RAG%20store-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![RLS](https://img.shields.io/badge/RLS-8%20core%20tables-0A7EA4)](#row-level-security)
[![WORM](https://img.shields.io/badge/audit-WORM%20%2B%20retention-FF8A5B)](#the-worm-audit-ledger)
[![Deno](https://img.shields.io/badge/Deno-14%20edge%20functions-000000?logo=deno&logoColor=white)](https://deno.land/)
[![Validator](https://img.shields.io/badge/CI-4--invariant%20validator-3FB950)](#the-four-invariant-validator)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue)](./LICENSE)

> The **data + serverless substrate** of the ShipSmart platform: 11 forward-only
> migrations, Row-Level Security on every core user-owned table, a **WORM audit
> ledger** whose tamper-evidence is a trigger and whose retention schedule is a
> reviewed SQL function, **hybrid (dense + lexical) vector search** whose column
> contract is CI-asserted against the API — all guarded by a custom
> **four-invariant validator**. The database doesn't just store the platform's
> data; it **enforces the platform's promises.**

This repo has **no Render service of its own** — it ships schema, edge
functions, dev scripts, and the invariants the other services depend on. (For
the live system, see the umbrella's live-mesh links.)

**Stack:** Supabase (Postgres 15 + Auth) · pgvector · tsvector/GIN lexical ·
Deno/TypeScript edge functions · Bash tooling · shellcheck + ruff CI

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [What this repo owns](#what-this-repo-owns)
- [Migrations](#migrations)
- [Row-Level Security](#row-level-security)
- [The WORM audit ledger](#the-worm-audit-ledger)
- [Hybrid vector search](#hybrid-vector-search)
- [Edge functions](#edge-functions)
- [The four-invariant validator](#the-four-invariant-validator)
- [Governance read side](#governance-read-side)
- [Scripts & local development](#scripts--local-development)
- [License](#license)

---

## The ShipSmart ecosystem

One of six sibling repositories — clone them under the same parent directory so
the dev scripts can find them by relative path. All six are also mirrored
together in **[ShipSmart](https://github.com/nia194/ShipSmart)** — the umbrella
repository that snapshots each component at a pinned commit (see its
`COMPONENTS.yml`).

| Repo | Role | Stack | Render service |
|---|---|---|---|
| [ShipSmart-Web](https://github.com/nia194/ShipSmart-Web) | React SPA — search-first UI | React 19, Vite, TS | `shipsmart-web` |
| [ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator) | Java system of record — single Postgres writer | Spring Boot 3.4, Java 17 | `shipsmart` |
| [ShipSmart-API](https://github.com/nia194/ShipSmart-API) | Python AI layer — RAG, guardrails, agents | FastAPI, Python 3.13 | `shipsmart-api-python` |
| [ShipSmart-MCP](https://github.com/nia194/ShipSmart-MCP) | Read-only MCP tool server | FastAPI + MCP | `shipsmart-mcp` |
| **[ShipSmart-Infra](https://github.com/nia194/ShipSmart-Infra)** *(this repo)* | Schema + RLS + WORM ledger + pgvector + edge functions | Supabase, Deno, Bash | — |
| [ShipSmart-Test](https://github.com/nia194/ShipSmart-Test) | Cross-repo contracts + evals + e2e | Python 3.13, pytest | — |

---

## What this repo owns

```
supabase/
  migrations/   11 timestamped, forward-only, idempotent .sql
  functions/    14 Deno/TypeScript edge functions (JWT-verifying)
  config.toml
scripts/        validate-infra.sh · check-env.sh · dev-start.sh ·
                verify-post-deployment.sh
```

Three runtimes consume this one schema — Java via JPA with
`ddl-auto: validate`, Python via asyncpg, the Web via edge functions — which is
exactly why it is treated as **contract-checked code**, not "the database."

## Migrations

**11 forward-only migrations** (2026-04 → 2026-07): core tables → pgvector RAG
store → idempotency/audit hardening → **hybrid lexical** (tsvector + GIN +
ranking function) → retrieval telemetry → concierge conversations → **WORM
`ai_audit_log`** → RAG governance columns (embedding version, tenant seam) →
guardrail metrics view → **retention schedule**.

Rules: timestamp-named, never edited after apply, idempotent
(`IF NOT EXISTS` / `CREATE OR REPLACE`), additive — the Java `validate` contract
keeps passing.

## Row-Level Security

RLS is **enabled on all 8 core user-owned tables** — `profiles`, `user_roles`,
`shipment_requests`, `quotes`, `saved_options`, `redirect_tracking`,
`idempotency_keys`, `audit_log` — with owner-scoped policies. Isolation is
enforced **inside the database**, so even a compromised app path can't read
across users. (The newer AI-plane tables are service-role-accessed by design;
their RLS hardening is tracked as a governance follow-up.)

## The WORM audit ledger

`ai_audit_log` is append-only by **trigger**, not by promise:

- `UPDATE` ⇒ `RAISE EXCEPTION` — always.
- `DELETE` ⇒ blocked **unless** the transaction-scoped GUC
  `shipsmart.retention_job = 'on'` — which only
  `ai_audit_log_apply_retention()` sets, for its own transaction.
- Identity is pseudonymized (`session_id_hash`); free text is redacted upstream.
- Retention classes: **`pii_short` 30 days · `standard` 13 months · `extended`
  24 months** — a `CASE` in a reviewed SQL function, designed for a daily call.

"Prove what the AI did" is a query — and the record can neither be silently
edited nor silently evaporate.

## Hybrid vector search

`rag_chunks` supports both retrieval modes **inside Postgres**:

- **Dense:** pgvector cosine over embeddings.
- **Lexical:** a `text_tsv` tsvector + **GIN** index ranked by `ts_rank_cd`
  against `websearch_to_tsquery('english', …)`, exposed as
  `match_rag_chunks_lexical(...) RETURNS TABLE (...)` — the exact-term signal
  the API fuses with dense scores.
- **Governance columns:** `embedding_model` / `embedding_version` (the API's
  fail-closed startup compatibility check reads these) + `tenant_id` /
  `user_role` (the multi-tenant seam). `rag_query_log` captures retrieval
  telemetry.

The lexical function's **column shape is CI-asserted** — the DB and the API
cannot drift on this contract.

## Edge functions

**14 Deno/TypeScript functions**, most verifying the Supabase bearer JWT
(`supabase.auth.getUser`) before acting:

| Group | Functions |
|---|---|
| AI advisories | `ai-shipping-advisor` · `ai-tracking-advisor` · `ai-priority-interpreter` · `ai-notification-generator` |
| Quotes & saved options | `get-shipping-quotes` · `get-saved-options` · `save-option` · `remove-saved-option` |
| Booking & address | `generate-book-redirect` · `validate-address` |
| Logistics helpers | `find-dropoff-locations` · `escalate-tracking-issue` · `create-shipment-reminders` · `import-tracking-from-email` |

## The four-invariant validator

`scripts/validate-infra.sh` fails CI (alongside **shellcheck** + **ruff**) when:

1. the **RAG lexical contract** breaks — `match_rag_chunks_lexical` missing, or
   its `RETURNS TABLE` no longer covers every column the API reads
   (checked column-by-column);
2. any edge function loses its **`Deno.serve`** handler;
3. any migration filename breaks the **timestamp convention**;
4. the **WORM append-only guard** itself is absent — the governance control is
   regression-tested.

On success it prints the live counts — the validator doubles as the inventory.

## Governance read side

`ai_guardrail_daily` is a SQL **view** — `unnest(decisions ||
guardrail_events)` over the ledger, filtered to the canonical `guardrail:*` /
`budget:*` vocabulary, grouped per (day, tag). Dashboards read the view; the
WORM log itself is never scanned or touched. It is the SQL twin of the API's
in-process guardrail metrics.

## Scripts & local development

```bash
./scripts/check-env.sh                 # env matrix sanity
./scripts/dev-start.sh                 # local supabase workflow
./scripts/validate-infra.sh            # the 4 invariants (run in CI)
./scripts/verify-post-deployment.sh    # post-deploy probes
```

## License

See [LICENSE](./LICENSE).
