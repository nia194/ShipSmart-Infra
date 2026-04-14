-- ─────────────────────────────────────────────────────────────────────────────
-- ShipSmart RAG: persistent vector store for FastAPI
-- Used by app.rag.pgvector_store.PGVectorStore.
--
-- Vector dimension is 1536 to match OpenAI text-embedding-3-small (the
-- recommended embedding provider). If you switch the FastAPI embedding
-- provider to one with a different dimension, ALTER the column or recreate
-- the table — pgvector enforces a fixed dimension per column.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id           BIGSERIAL PRIMARY KEY,
    source       TEXT        NOT NULL,
    chunk_index  INTEGER     NOT NULL,
    text         TEXT        NOT NULL,
    embedding    vector(1536) NOT NULL,
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, chunk_index)
);

-- Approximate-nearest-neighbor index for cosine distance.
-- ivfflat needs ANALYZE / sufficient rows to be effective; for small dev
-- corpora a sequential scan is fine and the index is still queryable.
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
    ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks (source);
