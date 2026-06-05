# RAG Architecture

## Overview

The Python API includes a Retrieval-Augmented Generation (RAG) pipeline that ingests documents, chunks and embeds them, stores embeddings in a vector store, and retrieves relevant context to augment LLM queries.

## Pipeline Flow

```
Documents (.txt, .md)
  → load_documents()        # Read files from data/documents/
  → chunk_text()            # Split into overlapping chunks (500 chars, 50 overlap)
  → EmbeddingProvider.embed()  # Generate vector embeddings
  → VectorStore.add()       # Store chunks + embeddings
```

```
User Query
  → EmbeddingProvider.embed()  # Embed the query
  → VectorStore.search()       # Find top-K similar chunks
  → build_rag_prompt()         # Combine context + query into chat messages
  → LLMClient.complete()       # Generate answer
  → RAGResult                  # Answer + sources + metadata
```

## Components

### Chunking (`app/rag/chunking.py`)
- Splits text by character count with configurable overlap
- Produces `Chunk` objects with source and index metadata

### Embeddings (`app/rag/embeddings.py`)
- **EmbeddingProvider** ABC with `embed()` and `dimensions` methods
- **LocalHashEmbedding** — deterministic hash-based placeholder for dev (no API keys needed)
- **OpenAIEmbedding** — real embeddings via `text-embedding-3-small`
- Factory: `create_embedding_provider()` reads `EMBEDDING_PROVIDER` from config

### Vector Store (`app/rag/vector_store.py`)
- **VectorStore** ABC with `add()`, `search()`, `clear()`, `count()` methods
- **InMemoryVectorStore** — cosine similarity with numpy, suitable for dev/small docs
- Factory: `create_vector_store()` (only `memory` type for now)

### Ingestion (`app/rag/ingestion.py`)
- `load_documents(path)` — reads `.txt` and `.md` files from a directory
- `ingest_documents()` — orchestrates chunk → embed → store

### Retrieval (`app/rag/retrieval.py`)
- `retrieve()` — embeds query, searches vector store, returns `SearchResult` list

### LLM Client (`app/llm/client.py`)
- **LLMClient** ABC with `complete(messages)` method
- **OpenAIClient** — chat completions via `gpt-4o-mini`
- **EchoClient** — placeholder that returns query text (no API calls)
- Factory: `create_llm_client()` reads `LLM_PROVIDER` from config

### RAG Service (`app/services/rag_service.py`)
- `rag_query()` — orchestrates retrieve → prompt → LLM → `RAGResult`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/rag/query` | Query the RAG pipeline |
| POST | `/api/v1/rag/ingest` | Ingest documents from configured path |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `""` | `"openai"` or empty (uses EchoClient) |
| `OPENAI_API_KEY` | `""` | Required when LLM_PROVIDER=openai |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for completions |
| `EMBEDDING_PROVIDER` | `""` | `"openai"` or empty (uses LocalHashEmbedding) |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | `256` | Embedding vector dimensions |
| `VECTOR_STORE_TYPE` | `memory` | Only `memory` supported currently |
| `RAG_TOP_K` | `3` | Number of chunks to retrieve |
| `RAG_CHUNK_SIZE` | `500` | Characters per chunk |
| `RAG_CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `RAG_DOCUMENTS_PATH` | `data/documents` | Directory for source documents |
| `RAG_MODE` | `normal` | `normal` (today) or `agentic` retrieval |
| `RAG_HYBRID` | `false` | `true` = dense + sparse (lexical) |
| `RAG_HYBRID_ALPHA` | `0.5` | Dense vs sparse fusion weight (0..1; 1.0 = all dense) |
| `RAG_AGENTIC_MAX_STEPS` | `3` | Max plan/retrieve steps when `RAG_MODE=agentic` |
| `RAG_QUERY_LOG` | `false` | Write agentic traces to `rag_query_log` |
| `LLM_MAX_CONTEXT_TOKENS` | `8000` | Token budget for retrieved context |
| `LLM_FALLBACK_CHAIN` | `""` | CSV provider fallback, e.g. `openai,gemini,echo` (empty = none) |
| `LLM_RETRY_MAX_ATTEMPTS` | `2` | Attempts per provider before the next in the chain |

> Per-task overrides (`LLM_{MODEL,TEMPERATURE,MAX_TOKENS}_{REASONING,SYNTHESIS}`) and guardrails
> (`GUARDRAILS_ENABLED`, `GUARDRAILS_BLOCK_ON_INJECTION`) are listed in
> `docs/env/production-env-reference.md`. All of the above default to today's behavior when unset.

## Hybrid Retrieval (dense + sparse)

Dense retrieval (pgvector cosine) is strong on paraphrase but can miss exact tokens — carrier names,
service codes, tracking numbers. Sparse lexical retrieval (Postgres full-text, ranked by `ts_rank_cd`)
catches those. With `RAG_HYBRID=true` the API runs **both** and fuses them:

```
fused = alpha * normalize(dense_score) + (1 - alpha) * normalize(sparse_score)
```

- `RAG_HYBRID_ALPHA` (default `0.5`) is the **dense** weight: `1.0` = dense-only (today's behavior),
  `0.0` = sparse-only.
- Dense `score` is cosine similarity in `[0,1]`; sparse `score` is `ts_rank_cd` (unbounded), so the
  API normalizes each side before fusing, and dedupes hits by chunk `id`.
- The sparse side is served by an Infra SQL function (migration `20260529120000`):

```sql
match_rag_chunks_lexical(query_text TEXT, match_count INTEGER DEFAULT 3)
  RETURNS TABLE (id BIGINT, source TEXT, chunk_index INTEGER, text TEXT, score REAL)
```

  backed by a generated `rag_chunks.text_tsv` column + GIN index. Requires
  `VECTOR_STORE_TYPE=pgvector` — the in-memory store has no lexical path, so hybrid is a no-op there.

## Agentic RAG

With `RAG_MODE=agentic` the advisor may **plan and iterate** retrieval (reformulate the query,
retrieve again, decide when it has enough) up to `RAG_AGENTIC_MAX_STEPS` (default `3`) instead of a
single retrieve → answer pass. `RAG_MODE=normal` (default) is today's single-shot pipeline.

## LLM Fallback Chain & Context Budgeting

- **Fallback:** `LLM_FALLBACK_CHAIN` (CSV, e.g. `openai,gemini,echo`) lists providers tried in order
  when the primary errors; empty (default) = no fallback. `LLM_RETRY_MAX_ATTEMPTS` (default `2`) bounds
  attempts per provider before moving down the chain. `echo` is the always-available terminal client.
- **Context budget:** `LLM_MAX_CONTEXT_TOKENS` (default `8000`) caps the retrieved context packed into
  the prompt; the API trims lowest-ranked chunks to fit.
- **Per-task tuning:** `LLM_{MODEL,TEMPERATURE,MAX_TOKENS}_{REASONING,SYNTHESIS}` tune each stage
  independently; empty = provider/global default. Temperatures stay in the system-wide `0.0–0.3` band.

## Observability: decision-path tags

When `RAG_QUERY_LOG=true`, each (agentic) run appends a row to `rag_query_log` (Infra migration
`20260529120500`): the plan (`plan_json`), the `retrieved_chunk_ids` fed to the LLM, and an ordered
`decision_path` of tags — e.g. `{mode:agentic, retrieve:hybrid, rewrite, synthesize}` — for
explainability. It is append-only AI telemetry, off by default, with no FK into user/business tables.

## Local Development

Without any API keys configured, the pipeline uses:
- **LocalHashEmbedding** — hash-based vectors (no semantic similarity)
- **EchoClient** — echoes query back (no LLM calls)
- **InMemoryVectorStore** — in-process storage

This allows testing the full pipeline architecture without external dependencies.

## Future Enhancements

- PostgreSQL + pgvector for persistent vector storage
- Anthropic Claude as an LLM provider option
- PDF and HTML document loaders
- ~~Hybrid search (lexical + vector similarity)~~ — Infra groundwork landed (see **Hybrid
  Retrieval** above: `text_tsv` column + `match_rag_chunks_lexical`); API fusion is the next step
- Streaming responses
