-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart: append-only AI-event audit log (Governance & Guardrails §5.8/§7.5).
--
-- One row per model/tool call. It is the durable backend for ShipSmart-API's
-- AI-event sink (app/core/ai_events.py → future PostgresAIEventSink). Identity is
-- ALREADY pseudonymized on the Python side (session_id_hash; §6.1) — this table
-- never stores raw identity, and free text is PII-redacted before it is written.
--
-- WORM / append-only, enforced at the DB (not just by convention): a trigger
-- blocks every UPDATE and blocks DELETE unless the caller is the retention job
-- (which sets `shipsmart.retention_job = 'on'`). So "prove what the AI did" is a
-- query, and the app can never rewrite or quietly drop the trail — but the §7.5
-- retention schedule can still trim aged rows.
--
-- Boundary notes (does not violate the single-writer invariant): AI telemetry
-- only — no money, no privileged actions, NO foreign key into user/business
-- tables. Python-owned data plane (direct asyncpg), same access model as
-- rag_chunks / rag_query_log. Additive + idempotent — creates a brand-new table
-- only, so Flyway/Hibernate validate on the Java side is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_audit_log (
    id                 BIGSERIAL        PRIMARY KEY,                     -- global monotonic sequence
    request_id         TEXT,                                             -- X-Request-Id across the Web → Python hop
    session_id_hash    TEXT,                                             -- pseudonymized identity (never raw)
    route              TEXT             NOT NULL DEFAULT '',
    intent             TEXT             NOT NULL DEFAULT '',
    provider           TEXT             NOT NULL DEFAULT '',
    model              TEXT             NOT NULL DEFAULT '',
    prompt_version     TEXT             NOT NULL DEFAULT '',
    schema_version     TEXT             NOT NULL DEFAULT '',
    embedding_version  TEXT             NOT NULL DEFAULT '',
    decisions          TEXT[]           NOT NULL DEFAULT '{}',           -- ordered decision-path tags
    tool_calls         TEXT[]           NOT NULL DEFAULT '{}',
    source_ids         TEXT[]           NOT NULL DEFAULT '{}',
    guardrail_events   TEXT[]           NOT NULL DEFAULT '{}',
    latency_ms         DOUBLE PRECISION NOT NULL DEFAULT 0,
    token_count        INTEGER          NOT NULL DEFAULT 0,
    cost_estimate_usd  NUMERIC          NOT NULL DEFAULT 0,
    retention_class    TEXT             NOT NULL DEFAULT 'standard',     -- retention schedule bucket (§7.5)
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Time-ordered lookups (most recent first) + correlation lookups.
CREATE INDEX IF NOT EXISTS ai_audit_log_created_idx ON public.ai_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_log_request_idx ON public.ai_audit_log (request_id);
CREATE INDEX IF NOT EXISTS ai_audit_log_session_idx ON public.ai_audit_log (session_id_hash);

-- WORM guard: no UPDATE ever; DELETE only for the retention job.
CREATE OR REPLACE FUNCTION public.ai_audit_log_worm() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'ai_audit_log is append-only (no UPDATE)';
  END IF;
  IF current_setting('shipsmart.retention_job', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'ai_audit_log is append-only (DELETE only via the retention job)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_audit_log_worm_guard ON public.ai_audit_log;
CREATE TRIGGER ai_audit_log_worm_guard
  BEFORE UPDATE OR DELETE ON public.ai_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.ai_audit_log_worm();

COMMENT ON TABLE public.ai_audit_log IS
    'Append-only (WORM) AI-event audit trail. AI telemetry only — no money, no '
    'privileged actions, no FK into user/business tables. Identity is '
    'pseudonymized (session_id_hash) and free text PII-redacted on write. UPDATE '
    'is always blocked; DELETE only via the retention job (SET shipsmart.retention_job = ''on'').';
