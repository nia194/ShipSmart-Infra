-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart RAG: hybrid retrieval — lexical (sparse) side of dense + sparse.
--
-- Augments the existing rag_chunks table (created in
-- 20260408034204_create_rag_chunks.sql) with a generated full-text-search
-- column + GIN index and a ranking function, so app.rag.pgvector_store can run
-- a lexical query alongside the existing dense (pgvector cosine) query and fuse
-- the two on the Python side (RAG_HYBRID / RAG_HYBRID_ALPHA).
--
-- The dense path — embedding vector(1536) and its ivfflat index — is left
-- COMPLETELY untouched and keeps working exactly as today.
--
-- Additive + idempotent: safe on a fresh database and safe to re-run. Touches
-- ONLY rag_chunks, which is a Python-plane table (read/written via asyncpg, not
-- a JPA entity). It alters no table the Java Orchestrator maps or validates, so
-- Hibernate `validate` and Flyway `validate` on the Java side are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

-- Generated tsvector over `text`. The 2-argument to_tsvector('english', …) form
-- is IMMUTABLE (unlike the 1-arg form, which depends on default_text_search_config),
-- so it is valid for a STORED generated column and for indexing. It is recomputed
-- automatically whenever `text` changes — no application code or trigger needed.
ALTER TABLE public.rag_chunks
    ADD COLUMN IF NOT EXISTS text_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;

-- GIN index powers fast lexical @@ matches and ts_rank_cd scoring.
CREATE INDEX IF NOT EXISTS rag_chunks_text_tsv_idx
    ON public.rag_chunks USING GIN (text_tsv);

-- Lexical retrieval function. Returns the same columns the dense path feeds the
-- Python SearchResult (source, chunk_index, text, score), plus the primary-key
-- id so the caller can fuse/dedupe dense and sparse hits by id. Ranked by
-- ts_rank_cd (cover-density rank); higher score = better match.
-- websearch_to_tsquery gives forgiving parsing (quoted phrases, OR, -negation)
-- and yields an empty query (→ zero rows) for blank/stop-word-only input.
CREATE OR REPLACE FUNCTION public.match_rag_chunks_lexical(
    query_text   TEXT,
    match_count  INTEGER DEFAULT 3
)
RETURNS TABLE (
    id           BIGINT,
    source       TEXT,
    chunk_index  INTEGER,
    text         TEXT,
    score        REAL
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        rc.id,
        rc.source,
        rc.chunk_index,
        rc.text,
        ts_rank_cd(rc.text_tsv, websearch_to_tsquery('english', query_text)) AS score
    FROM public.rag_chunks rc
    WHERE rc.text_tsv @@ websearch_to_tsquery('english', query_text)
    ORDER BY score DESC, rc.id ASC
    LIMIT GREATEST(match_count, 0)
$$;

COMMENT ON FUNCTION public.match_rag_chunks_lexical(TEXT, INTEGER) IS
    'Lexical (sparse) retrieval over rag_chunks.text_tsv, ranked by ts_rank_cd. '
    'Returns (id, source, chunk_index, text, score). Paired with the dense '
    'pgvector path for hybrid retrieval; fusion happens in ShipSmart-API.';
