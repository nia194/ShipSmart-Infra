-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart Concierge: persistent conversation store (OPTIONAL).
--
-- Server-side memory for the Conversational Concierge so a chat can be RECALLED
-- after a page reload (anonymous session id). Two tables:
--   * conversations           — one row per session: the merged shipment slots +
--                               conversation status/intent (the recall snapshot).
--   * conversation_messages   — the append-only transcript (user/assistant turns).
--
-- Writing here is OFF by default and controlled entirely on the Python side by
-- CONVERSATION_STORE (memory|postgres) + DATABASE_URL (see ShipSmart-API). When
-- CONVERSATION_STORE=memory (today's effective behavior) nothing writes to these
-- tables and they simply stay empty; this migration only makes the sink available.
--
-- Boundary notes (why this does not violate the single-writer invariant) — mirrors
-- the rag_query_log precedent:
--   * This is conversation *telemetry / assistive memory*, not transactional/
--     business data. It never holds money, never drives a privileged action, and
--     has NO foreign key into user/business tables (so trimming user rows or
--     shipment_requests can never break it). It is part of the Python-owned data
--     plane, same access model as rag_chunks / rag_query_log (direct asyncpg).
--   * The only FK is conversation_messages → conversations (both new, both Python-
--     owned) for transcript integrity; ON DELETE CASCADE makes a session fully
--     trimmable in one statement.
--   * No RLS is coupled to user tables. Like rag_chunks / rag_query_log, RLS is
--     left disabled so the direct-asyncpg writes keep working; these tables are not
--     exposed as a user-facing API surface (the API reads them via its own session
--     id, never via auth.uid()).
--
-- Additive + idempotent. Creates brand-new tables only; touches no existing table,
-- so Flyway/Hibernate validate on the Java side is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
    session_id          UUID        PRIMARY KEY,                  -- anonymous session id minted by the API
    status              TEXT        NOT NULL DEFAULT 'gathering',  -- "gathering" | "answered"
    intent              TEXT,                                     -- last resolved intent (quote/compliance/tracking/advice)
    slots               JSONB       NOT NULL DEFAULT '{}'::jsonb, -- merged shipment-context superset (the recall snapshot)
    turns               INTEGER     NOT NULL DEFAULT 0,           -- turn counter
    last_dispatched_to  TEXT,                                     -- agent | compliance | workflow | scope_blocked | summary
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id            BIGSERIAL   PRIMARY KEY,
    session_id    UUID        NOT NULL REFERENCES public.conversations (session_id) ON DELETE CASCADE,
    role          TEXT        NOT NULL,                           -- "user" | "assistant"
    content       TEXT        NOT NULL,
    slots_delta   JSONB       NOT NULL DEFAULT '{}'::jsonb,       -- entities this turn added (user) / merged slots (assistant)
    decisions     TEXT[]      NOT NULL DEFAULT '{}',              -- decision-path tags for the assistant turn
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transcript lookups for one session, oldest-first replay.
CREATE INDEX IF NOT EXISTS conversation_messages_session_idx
    ON public.conversation_messages (session_id, created_at, id);

COMMENT ON TABLE public.conversations IS
    'Optional, Python-owned recall snapshot for the Conversational Concierge. '
    'Written only when ShipSmart-API has CONVERSATION_STORE=postgres. Assistive '
    'memory only — no money, no privileged actions, no FK into user/business tables.';

COMMENT ON TABLE public.conversation_messages IS
    'Optional, append-only transcript for the Conversational Concierge (FK to '
    'public.conversations only). Written only when CONVERSATION_STORE=postgres.';
