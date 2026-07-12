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

> **Metric convention:** structural counts and retention classes are facts
> verified against the migrations; performance/durability figures are
> **(target)** / **(illustrative)**.

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [What this repo owns (HLD)](#what-this-repo-owns-hld)
- [Data model (ER)](#data-model-er)
- [Row-Level Security](#row-level-security)
- [The WORM audit ledger](#the-worm-audit-ledger)
- [Hybrid vector search](#hybrid-vector-search)
- [Migration timeline](#migration-timeline)
- [Edge functions](#edge-functions)
- [Governance read side](#governance-read-side)
- [The four-invariant validator](#the-four-invariant-validator)
- [Threat model](#threat-model)
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

## What this repo owns (HLD)

**Figure 1 — the substrate and its three consumers.** One schema serves three
runtimes — which is exactly why it is treated as **contract-checked code**, not
"the database."

```mermaid
flowchart TB
    subgraph EDGE["14 Deno edge functions"]
        EF1["ai-* advisories (4)"]
        EF2["quotes + saved options (4)"]
        EF3["booking / address / logistics (5)"]
        EF4[import-tracking-from-email]
    end
    subgraph PG["Supabase PostgreSQL"]
        CORE["core tables (RLS ×8): profiles · user_roles · shipment_requests · quotes · saved_options · redirect_tracking · idempotency_keys · audit_log"]
        RAGT["rag_chunks (pgvector + text_tsv GIN + governance cols) · rag_query_log"]
        CONV["conversations · conversation_messages"]
        WORM["ai_audit_log (WORM trigger + retention fn)"]
        VIEW["ai_guardrail_daily (view)"]
    end
    VAL["validate-infra.sh — 4 invariants (CI)"]
    JAVA["Java Orchestrator — JPA, ddl-auto: validate"] --> CORE
    API["Python API — asyncpg"] --> RAGT
    API --> WORM
    API --> CONV
    WEB["Web SPA"] --> EDGE --> CORE
    DASH["Dashboards / alerts"] --> VIEW
    VAL -.-> PG
    VAL -.-> EDGE
```

```
supabase/
  migrations/   11 timestamped, forward-only, idempotent .sql
  functions/    14 Deno/TypeScript edge functions (JWT-verifying)
  config.toml
scripts/        validate-infra.sh · check-env.sh · dev-start.sh ·
                verify-post-deployment.sh
```

---

## Data model (ER)

**Figure 2 — core + AI-plane entities (key fields).** Governance columns live
**on the data**: embedding version (feeds the API's fail-closed startup check),
tenant/role (the multi-tenant seam), retention class (drives the WORM delete
window).

```mermaid
erDiagram
    PROFILES ||--o{ SHIPMENT_REQUESTS : owns
    PROFILES ||--o{ SAVED_OPTIONS : owns
    PROFILES ||--o{ USER_ROLES : has
    SHIPMENT_REQUESTS ||--o{ QUOTES : yields
    QUOTES ||--o{ REDIRECT_TRACKING : "booked via"
    PROFILES {
        uuid id PK "RLS"
    }
    SHIPMENT_REQUESTS {
        uuid id PK
        uuid user_id FK "RLS owner"
    }
    QUOTES {
        uuid id PK
        uuid shipment_request_id FK
        timestamptz expires_at
    }
    RAG_CHUNKS {
        bigint id PK
        vector embedding "pgvector"
        tsvector text_tsv "GIN indexed"
        text embedding_model "governance"
        text embedding_version "startup compat check"
        text tenant_id "isolation seam"
        text user_role
    }
    RAG_QUERY_LOG {
        bigint id PK
        text query
        timestamptz at
    }
    CONVERSATIONS ||--o{ CONVERSATION_MESSAGES : contains
    AI_AUDIT_LOG {
        bigint id PK
        text session_id_hash "pseudonymized"
        text retention_class "pii_short|standard|extended"
        text[] decisions
        text[] guardrail_events
        timestamptz at
    }
    IDEMPOTENCY_KEYS {
        text key PK "RLS"
    }
    AUDIT_LOG {
        uuid id PK "RLS"
    }
```

*(Field lists are representative of the key columns — the migrations are the
authoritative source.)*

---

## Row-Level Security

| Table | RLS | Policy |
|---|---|---|
| profiles · user_roles · shipment_requests · quotes · saved_options · redirect_tracking · idempotency_keys · audit_log | ✅ enabled | owner-scoped (user owns their rows) |
| rag_chunks · rag_query_log · conversations · ai_audit_log | service-role access | by design; RLS hardening tracked as a governance follow-up |

Isolation for user-owned data is enforced **inside the database** — even a
compromised app path can't read across users.

---

## The WORM audit ledger

**Figure 3 — `ai_audit_log` lifecycle.** Tamper-evidence is a `BEFORE UPDATE OR
DELETE` **trigger**, not an application promise; even the retention job's
delete permission is scoped to its own transaction.

```mermaid
stateDiagram-v2
    [*] --> Appended: INSERT (always allowed)
    Appended --> Appended: UPDATE attempt -> RAISE EXCEPTION (always)
    Appended --> Retained: age < retention window
    Retained --> Retained: DELETE without GUC -> RAISE EXCEPTION
    Retained --> Deleted: DELETE only when shipsmart.retention_job = on
    Deleted --> [*]
    note right of Retained
        ai_audit_log_apply_retention():
        pii_short = 30 days
        standard = 13 months (default)
        extended = 24 months
        GUC authorized for its own txn only — call daily
    end note
```

Identity is pseudonymized (`session_id_hash`); free text is redacted upstream.
"Prove what the AI did" is a query — and the record can neither be silently
edited nor silently evaporate.

---

## Hybrid vector search

**Figure 4 — dense + lexical inside Postgres.** The lexical function's **column
shape is a CI-checked contract** with the API — the classic "DB function
changed, app silently broke" failure is made impossible.

```mermaid
flowchart LR
    Q["API query"] --> D["pgvector: cosine over embedding"]
    Q --> L["match_rag_chunks_lexical(query_text, k)"]
    L --> TS["websearch_to_tsquery('english') @@ text_tsv (GIN)"]
    TS --> RK["ts_rank_cd score"]
    D --> FUSE["API-side alpha fusion"]
    RK --> FUSE
    FUSE --> OUT["ranked chunks -> grounding check"]
    VAL["validate-infra.sh invariant 1"] -.->|"RETURNS TABLE covers every column search_lexical reads"| L
    COMPAT["embedding_model/version cols"] -.->|"API startup compat: mixed spaces fail closed"| D
```

`rag_query_log` captures retrieval telemetry for the eval/online loop.

---

## Migration timeline

**Figure 5 — 11 forward-only migrations (facts).**

```mermaid
gantt
    dateFormat YYYY-MM-DD
    title Migration history (each bar = one forward-only migration)
    section Core
    core schema (2 migrations)        :done, 2026-04-04, 1d
    interview_upgrade (idempotency, audit) :done, 2026-04-17, 1d
    section RAG
    create_rag_chunks (pgvector)      :done, 2026-04-08, 1d
    hybrid_lexical (tsv + GIN + fn)   :done, 2026-05-29, 1d
    rag_query_log                     :done, 2026-05-29, 1d
    rag_chunks_governance (versions, tenant) :done, 2026-07-08, 1d
    section Concierge
    conversations + messages          :done, 2026-06-26, 1d
    section Governance
    ai_audit_log (WORM)               :done, 2026-07-08, 1d
    ai_guardrail_daily view           :done, 2026-07-09, 1d
    retention schedule fn             :done, 2026-07-09, 1d
```

Rules: timestamp-named, never edited after apply, idempotent (`IF NOT EXISTS` /
`CREATE OR REPLACE`), additive — the Java `validate` contract keeps passing.

---

## Edge functions

**Figure 6 — the 14 functions by group.** Most verify the Supabase bearer JWT
(`supabase.auth.getUser`) **before** acting.

```mermaid
flowchart TB
    U["Browser (Supabase JWT)"] --> GATE["supabase.auth.getUser(bearer) — verify BEFORE acting"]
    subgraph AI["AI advisories"]
        A1[ai-shipping-advisor]
        A2[ai-tracking-advisor]
        A3[ai-priority-interpreter]
        A4[ai-notification-generator]
    end
    subgraph QSO["Quotes & saved options"]
        B1[get-shipping-quotes]
        B2[get-saved-options]
        B3[save-option]
        B4[remove-saved-option]
    end
    subgraph BK["Booking & address"]
        C1[generate-book-redirect]
        C2[validate-address]
    end
    subgraph LOG["Logistics helpers"]
        D1[find-dropoff-locations]
        D2[escalate-tracking-issue]
        D3[create-shipment-reminders]
        D4[import-tracking-from-email]
    end
    GATE --> AI
    GATE --> QSO
    GATE --> BK
    GATE --> LOG
    AI --> DB[("Postgres")]
    QSO --> DB
    BK --> DB
    LOG --> DB
```

---

## Governance read side

**Figure 7 — `ai_guardrail_daily`: dashboards never touch the ledger.** The SQL
twin of the API's in-process guardrail metrics — deliberately a plain view (the
log is small; zero refresh machinery).

```mermaid
flowchart LR
    W[("ai_audit_log (WORM)")] --> V["VIEW: CROSS JOIN LATERAL unnest(decisions || guardrail_events)"]
    V --> F["WHERE tag LIKE guardrail:% OR budget:%"]
    F --> G["GROUP BY day, tag -> counts"]
    G --> DASH["dashboards / alerts"]
```

---

## The four-invariant validator

**Figure 8 — infra-as-contract: `validate-infra.sh` in CI.** On success it
prints the live counts — the validator doubles as the inventory. CI also runs
**shellcheck** and **ruff**.

```mermaid
flowchart TB
    CI["CI run"] --> V["validate-infra.sh"]
    V --> I1{"1 · match_rag_chunks_lexical exists AND RETURNS TABLE covers every column the API reads?"}
    V --> I2{"2 · every edge function has a Deno.serve handler?"}
    V --> I3{"3 · every migration filename timestamp-ordered?"}
    V --> I4{"4 · WORM append-only guard present?"}
    I1 -->|no| F["exit non-zero — build fails"]
    I2 -->|no| F
    I3 -->|no| F
    I4 -->|no| F
    I1 -->|yes| OK["OK — infra invariants hold (N fns, M migrations)"]
    I2 -->|yes| OK
    I3 -->|yes| OK
    I4 -->|yes| OK
```

| # | Invariant | Failure it prevents |
|---|---|---|
| 1 | lexical-fn column contract | silent API↔DB drift |
| 2 | `Deno.serve` per function | dead/unroutable function ships |
| 3 | timestamp naming | migration-ordering bugs |
| 4 | WORM guard present | the governance control itself regressing |

---

## Threat model

| Threat | Control |
|---|---|
| Cross-user reads | RLS on the 8 core tables |
| Audit tampering | WORM trigger (UPDATE never; DELETE gated) |
| Silent retention abuse | transaction-scoped `shipsmart.retention_job` GUC |
| Schema drift | 4-invariant validator + Java `ddl-auto: validate` |
| Mixed embedding spaces | version columns + API fail-closed startup check |
| Unauthenticated edge calls | `supabase.auth.getUser` before acting |

Durability/availability ride on managed Postgres (backups/PITR as platform
features) *(illustrative)*; the retention function is designed for a daily
invocation.

---

## Scripts & local development

```bash
./scripts/check-env.sh                 # env matrix sanity
./scripts/dev-start.sh                 # local supabase workflow
./scripts/validate-infra.sh            # the 4 invariants (run in CI)
./scripts/verify-post-deployment.sh    # post-deploy probes
```

## License

See [LICENSE](./LICENSE).
