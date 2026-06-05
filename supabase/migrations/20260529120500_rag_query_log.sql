-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart RAG: agentic-retrieval observability log (OPTIONAL).
--
-- Append-only trace of agentic RAG runs: the plan, which chunks were retrieved,
-- and the decision path taken. Writing here is OFF by default and controlled
-- entirely on the Python side by the RAG_QUERY_LOG env flag (see ShipSmart-API).
-- When RAG_QUERY_LOG=false (today's behavior) nothing writes to this table and
-- it simply stays empty; this migration only makes the sink available.
--
-- Boundary notes (why this does not violate the single-writer invariant):
--   * This is AI *telemetry*, not transactional/business data. It never holds
--     money, never drives a privileged action, and has NO foreign key into
--     user/business tables (so trimming rag_chunks or user rows can never break
--     it). It is part of the Python-owned RAG data plane, same access model as
--     rag_chunks (direct asyncpg). Append-only by convention: the app only ever
--     INSERTs — it never UPDATEs or DELETEs.
--   * No RLS is coupled to user tables. Like rag_chunks, RLS is left disabled so
--     the existing direct-asyncpg writes keep working; this table is not exposed
--     as a user-facing API surface.
--
-- Additive + idempotent. Creates a brand-new table only; touches no existing
-- table, so Flyway/Hibernate validate on the Java side is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rag_query_log (
    id                   BIGSERIAL   PRIMARY KEY,
    request_id           TEXT,                                     -- X-Request-Id of the originating Web → Python call (nullable)
    query                TEXT        NOT NULL,                     -- the user query that triggered retrieval
    plan_json            JSONB       NOT NULL DEFAULT '{}'::jsonb, -- agentic plan: sub-questions, chosen steps/tools
    retrieved_chunk_ids  BIGINT[]    NOT NULL DEFAULT '{}',        -- rag_chunks.id values fed to the LLM (no FK by design)
    decision_path        TEXT[]      NOT NULL DEFAULT '{}',        -- ordered decision-path tags, e.g. {mode:agentic,retrieve:hybrid,synthesize}
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time-ordered trace lookups (most recent first).
CREATE INDEX IF NOT EXISTS rag_query_log_created_idx
    ON public.rag_query_log (created_at DESC);

-- Pull a trace by the request id that spans the Web → Python hop.
CREATE INDEX IF NOT EXISTS rag_query_log_request_idx
    ON public.rag_query_log (request_id);

COMMENT ON TABLE public.rag_query_log IS
    'Optional, append-only observability trace for agentic RAG. Written only '
    'when ShipSmart-API has RAG_QUERY_LOG=true. AI telemetry only — no money, '
    'no privileged actions, no FK into user/business tables.';
