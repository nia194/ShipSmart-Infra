-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart RAG governance columns (Governance & Guardrails §7.3 + §6.2).
--
-- Adds provenance/governance metadata to rag_chunks so retrieval can be governed:
--   * embedding_model / embedding_version — the model that produced each vector.
--     A config flip or provider upgrade silently mixes incompatible vector
--     spaces; ShipSmart-API's startup embedding-compat check (§7.3) fails closed
--     unless the configured model/version matches what the store recorded.
--   * tenant_id / user_role — the seam for multi-tenant isolation (§6.2). NULL
--     today (single-tenant consumer); when a second tenant exists, the vector
--     query pre-filters on tenant_id BEFORE similarity search. Shipping the
--     column now makes that a filter change, not a painful backfill later.
--
-- All columns are NULLable + additive + idempotent — the existing dense/hybrid
-- retrieval path is untouched, and Flyway/Hibernate validate on the Java side is
-- unaffected (rag_chunks is the Python-owned data plane).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rag_chunks
    ADD COLUMN IF NOT EXISTS embedding_model   TEXT,
    ADD COLUMN IF NOT EXISTS embedding_version TEXT,
    ADD COLUMN IF NOT EXISTS tenant_id         TEXT,
    ADD COLUMN IF NOT EXISTS user_role         TEXT;

-- Tenant pre-filter index (partial: only rows that carry a tenant), so the
-- §6.2 WHERE tenant_id = $active filter stays cheap once tenancy is enabled.
CREATE INDEX IF NOT EXISTS rag_chunks_tenant_idx
    ON public.rag_chunks (tenant_id) WHERE tenant_id IS NOT NULL;

COMMENT ON COLUMN public.rag_chunks.embedding_model IS
    'Embedding model that produced this vector; used by the §7.3 startup compat check.';
COMMENT ON COLUMN public.rag_chunks.tenant_id IS
    'Multi-tenant isolation seam (§6.2). NULL today; pre-filtered before similarity search when tenancy ships.';
