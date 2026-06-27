# Go‑live runbook — Conversational Concierge (June 2026)

Activates the homepage **Conversational Concierge** (multi‑turn setup assistant + durable,
cross‑reload recall) and the reply‑to‑message feature in production. Code is already merged to
`main` across the repos; this runbook covers the two **infra** steps that do not ship with code:
a Supabase migration and a few Render env vars.

> ⚠️ **Order matters / time‑sensitive:** the Web app mounts the concierge **by default**
> (`VITE_USE_CONCIERGE` is opt‑out). After the next Web deploy the panel appears, and every message
> **404s until `CONCIERGE_ENABLED=true`** is set on the API. Do **Step B first** (or set
> `VITE_USE_CONCIERGE=false` to hide the panel until you're ready).

---

## Step A — Supabase: create the conversation store

The concierge's durable recall writes to two new tables. The Python `PostgresConversationStore`
does **not** auto‑create them, so the migration must be run once.

- **File:** `supabase/migrations/20260626120000_create_conversations.sql`
- **Creates:** `public.conversations`, `public.conversation_messages`, one transcript index.
- **Safe by construction:** idempotent (`CREATE TABLE IF NOT EXISTS`), additive, Python‑owned
  (no FK into user/business tables, no extension required), and it does not touch the
  Flyway/Hibernate‑managed tables.

**How to apply — Supabase → SQL Editor → paste the file's contents → Run.**

> ⚠️ **Do not use `supabase db push`.** The live database was not created from this migrations
> folder (it carries `flyway_schema_history` + service‑auto‑created tables, and `public` does not
> match the full migration set), so `db push` may try to (re)apply unrelated older migrations.
> Running this one file in the SQL Editor is the surgical, low‑risk path.

**Verify:** the Tables list grows from 7 → 9 (adds `conversations`, `conversation_messages`);
`select count(*) from conversations;` → `0`.

*(Skip Step A entirely only if you choose `CONVERSATION_STORE=memory` in Step B — then recall is
in‑memory and lost on instance restart.)*

---

## Step B — Render: env vars on the API service `shipsmart-api-python`

Add (Manage → Environment), then **Save / Manual Deploy** so the instance restarts:

| Key | Value | Why |
|-----|-------|-----|
| `CONCIERGE_ENABLED` | `true` | **Required** — enables `POST /api/v1/concierge/chat` (else 404). |
| `CONVERSATION_STORE` | `postgres` | Durable recall via the existing `DATABASE_URL` + the Step‑A tables. (`memory` to skip persistence.) |
| `CONVERSATION_MAX_MESSAGES` | `50` | Optional — recall window (default 50). |
| `WORKFLOW_ENABLED` | `false` | Multi‑agent compliance/workflow OFF by default (flip to `true` to activate the bridge + `/workflow/*`). |

Already set (no change): `DATABASE_URL`, `VECTOR_STORE_TYPE=pgvector`, `PGVECTOR_TABLE`,
LLM/embeddings/carrier keys, `CORS_ALLOWED_ORIGINS`. These flags are also declared in
`ShipSmart-API/render.yaml` so the blueprint stays truthful.

**Web service `shipsmart-web`:** nothing required — the concierge is on by default
(`VITE_USE_CONCIERGE=true`, declared in `ShipSmart-Web/render.yaml`). Set it to `false` to hide.
Reply‑to needs no env on either service.

---

## Verify (after A + B)

1. `GET https://shipsmart-api-python.onrender.com/ready` → `concierge_enabled: true`,
   `conversation_store: "postgres"`.
2. `POST /api/v1/concierge/chat` with `{"message":"ship a 12 lb box from Atlanta to Seattle"}`
   → `200` + a `session_id`; the merged `state.slots` contains origin/destination/weight.
3. `GET /api/v1/concierge/{session_id}` → the transcript is replayed (recall from Postgres); a row
   now exists in `conversations`.
4. Open the web app → the concierge panel renders on the homepage; sending a message returns `200`
   (no 404), and chat‑extracted fields pre‑fill the quote form.

## Rollback

- Hide the UI: set `VITE_USE_CONCIERGE=false` on the Web service and redeploy.
- Disable the endpoint: set `CONCIERGE_ENABLED=false` on the API (returns 404; the panel degrades).
- The Step‑A tables are inert when `CONVERSATION_STORE` is not `postgres`; no need to drop them.
