-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart audit retention schedule (Governance & Guardrails §7.5).
--
-- The WORM guard (20260708120000) already blocks UPDATE always and DELETE unless
-- the caller sets `shipsmart.retention_job = 'on'`. What was missing is the
-- SCHEDULE: how long each class of row lives before that job may trim it.
-- This function is that schedule, expressed as boring, explicit windows aligned
-- with the §6.1 privacy lifecycle:
--
--   * pii_short — any row that still carries short-TTL raw-PII-adjacent data:
--     30 days (kept intentionally short; identity is already pseudonymized on
--     write, so this is a belt-and-braces bucket).
--   * standard  — pseudonymized AI events (the default): ~13 months, so a full
--     year of trend/audit history survives.
--   * extended  — rows a legal/security hold pins: 24 months.
--
-- The function authorizes the WORM-guarded DELETE for its own transaction only
-- (set_config local = true), deletes aged rows per class, and returns the count.
-- A scheduler (pg_cron, a Supabase scheduled Edge Function, or an external cron)
-- calls it daily; EXECUTE is revoked from PUBLIC so only the retention principal
-- may run it. Additive + idempotent (CREATE OR REPLACE); Python data plane.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_audit_log_apply_retention(now_ts TIMESTAMPTZ DEFAULT now())
RETURNS integer AS $$
DECLARE
    deleted integer;
BEGIN
    -- Authorize the append-only table's DELETE for THIS transaction only.
    PERFORM set_config('shipsmart.retention_job', 'on', true);

    WITH gone AS (
        DELETE FROM public.ai_audit_log
        WHERE created_at < now_ts - (
            CASE retention_class
                WHEN 'pii_short' THEN INTERVAL '30 days'
                WHEN 'extended'  THEN INTERVAL '24 months'
                ELSE                  INTERVAL '13 months'   -- 'standard' (pseudonymized)
            END)
        RETURNING 1
    )
    SELECT count(*) INTO deleted FROM gone;

    RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Only the retention principal may trim the audit log — not any caller who could
-- otherwise flip the GUC. Grant to the scheduler role in your deployment.
REVOKE ALL ON FUNCTION public.ai_audit_log_apply_retention(TIMESTAMPTZ) FROM PUBLIC;

COMMENT ON FUNCTION public.ai_audit_log_apply_retention(TIMESTAMPTZ) IS
    'Applies the §7.5 retention schedule to ai_audit_log: pii_short=30d, standard=13mo, '
    'extended=24mo. Authorizes the WORM DELETE for its own txn only; call daily from a '
    'scheduler. Returns the number of rows trimmed. Aligned with the §6.1 DSAR lifecycle.';
