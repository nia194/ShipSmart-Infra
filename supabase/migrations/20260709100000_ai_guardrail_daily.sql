-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart guardrail observability view (Governance & Guardrails §11).
--
-- The SQL twin of ShipSmart-API's app/core/guardrail_metrics.py: one row per
-- (day, tag) over the append-only ai_audit_log, unnesting both decision-path
-- tags and guardrail events. Dashboards/alerts read this instead of scanning
-- the WORM log; the same canonical guardrail:*/budget:* vocabulary the evals
-- join on is the GROUP BY key, so a spike here and a red eval case point at
-- the same control.
--
-- A VIEW (not a materialized rollup) on purpose: the log is small at this
-- stage, the view stays additive/idempotent, and the WORM trigger discipline
-- on ai_audit_log is untouched. Python data plane; Java Flyway unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.ai_guardrail_daily AS
SELECT
    date_trunc('day', log.created_at)::date AS day,
    tag,
    count(*)                                AS occurrences
FROM public.ai_audit_log AS log
CROSS JOIN LATERAL unnest(log.decisions || log.guardrail_events) AS tag
WHERE tag LIKE 'guardrail:%'
   OR tag LIKE 'budget:%'
GROUP BY 1, 2;

COMMENT ON VIEW public.ai_guardrail_daily IS
    'Daily guardrail/budget tag counts over ai_audit_log (§11). Read-side only; '
    'the canonical tag vocabulary lives in ShipSmart-Test evals/tag_vocabulary.yml.';
