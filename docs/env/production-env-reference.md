# Production Environment Variable Reference

Complete reference for all environment variables by service.

---

## shipsmart-web (Static Site)

| Variable | Required | Set In | Default | Purpose |
|----------|----------|--------|---------|---------|
| `VITE_SUPABASE_URL` | Yes | Render dashboard | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Render dashboard | — | Supabase public anon key |
| `VITE_JAVA_API_BASE_URL` | Yes | render.yaml | — | Java API public URL |
| `VITE_PYTHON_API_BASE_URL` | Yes | render.yaml | — | Python API public URL |
| `VITE_APP_ENV` | Yes | render.yaml | `production` | App environment label |
| `VITE_USE_JAVA_QUOTES` | Yes | render.yaml | `true` | Use Java API for quotes |
| `VITE_USE_JAVA_SAVED_OPTIONS` | Yes | render.yaml | `true` | Use Java API for saved options |
| `VITE_USE_JAVA_BOOKING_REDIRECT` | Yes | render.yaml | `true` | Use Java API for booking tracking |

**Notes:**
- `VITE_` vars are baked into the static build at build time, not runtime
- Changing any `VITE_` var requires a static site rebuild
- Feature flags can be set to `"false"` to roll back to Supabase edge functions

---

## shipsmart-api-java (Web Service)

| Variable | Required | Set In | Default | Purpose |
|----------|----------|--------|---------|---------|
| `SPRING_PROFILES_ACTIVE` | Yes | render.yaml | `production` | Spring profile |
| `REQUIRE_JWT_SECRET` | Yes | render.yaml | `true` | Enforce JWT secret presence |
| `DATABASE_URL` | Yes | Render dashboard | — | Supabase Postgres JDBC URL |
| `DATABASE_USERNAME` | Yes | Render dashboard | — | DB username |
| `DATABASE_PASSWORD` | Yes | Render dashboard | — | DB password |
| `SUPABASE_URL` | Yes | Render dashboard | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Render dashboard | — | Supabase service role key (secret) |
| `SUPABASE_JWT_SECRET` | Yes | Render dashboard | — | JWT signing secret (secret) |
| `CORS_ALLOWED_ORIGINS` | Yes | render.yaml | — | Frontend origin for CORS |
| `INTERNAL_PYTHON_API_URL` | No | render.yaml | — | Python API URL (reserved, not actively used) |

**Notes:**
- `PORT` is injected by Render — do not set manually
- `DATABASE_URL` must use `jdbc:postgresql://` prefix for Spring Boot
- All secrets must be set in Render dashboard (marked `sync: false` in render.yaml)

---

## shipsmart-api-python (Web Service)

| Variable | Required | Set In | Default | Purpose |
|----------|----------|--------|---------|---------|
| `APP_ENV` | No | render.yaml | `development` | Environment label |
| `LOG_LEVEL` | No | render.yaml | `INFO` | Python log level |
| `CORS_ALLOWED_ORIGINS` | Yes | render.yaml | `http://localhost:5173` | Frontend origin for CORS |
| `INTERNAL_JAVA_API_URL` | No | render.yaml | `http://localhost:8080` | Java API URL (for future use) |
| `LLM_PROVIDER` | No | render.yaml | `""` (EchoClient) | Set `openai` for real AI |
| `OPENAI_API_KEY` | No* | Render dashboard | `""` | Required if `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | No | — | `gpt-4o-mini` | OpenAI model name |
| `EMBEDDING_PROVIDER` | No | render.yaml | `""` (local hash) | Set `openai` for real embeddings |
| `EMBEDDING_MODEL` | No | — | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | No | — | `256` | Embedding vector dimensions |
| `VECTOR_STORE_TYPE` | No | — | `memory` | Vector store type |
| `RAG_DOCUMENTS_PATH` | No | render.yaml | `data/documents` | Path to seed documents |
| `RAG_TOP_K` | No | — | `3` | Number of RAG results |
| `RAG_CHUNK_SIZE` | No | — | `500` | Document chunk size |
| `RAG_CHUNK_OVERLAP` | No | — | `50` | Chunk overlap |
| `SHIPPING_PROVIDER` | No | render.yaml | `mock` | Shipping data provider |
| `ENABLE_TOOLS` | No | render.yaml | `true` | Enable tool execution |
| `RAG_MODE` | No | render.yaml | `normal` | `normal` (today) or `agentic` retrieval |
| `RAG_HYBRID` | No | render.yaml | `false` | `true` adds lexical (sparse) to the dense path |
| `RAG_HYBRID_ALPHA` | No | — | `0.5` | Dense vs sparse fusion weight (0..1; 1.0 = all dense) |
| `RAG_AGENTIC_MAX_STEPS` | No | — | `3` | Max plan/retrieve steps when `RAG_MODE=agentic` |
| `RAG_QUERY_LOG` | No | — | `false` | `true` writes agentic traces to `rag_query_log` |
| `LLM_MAX_CONTEXT_TOKENS` | No | — | `8000` | Token budget for retrieved context fed to the LLM |
| `LLM_FALLBACK_CHAIN` | No | render.yaml | `""` | CSV provider fallback, e.g. `openai,gemini,echo` (empty = none) |
| `LLM_RETRY_MAX_ATTEMPTS` | No | — | `2` | Attempts per provider before the next in the chain |
| `LLM_MODEL_REASONING` | No | — | `""` | Model override for the reasoning task |
| `LLM_MODEL_SYNTHESIS` | No | — | `""` | Model override for the synthesis task |
| `LLM_TEMPERATURE_REASONING` | No | — | `""` | Temperature override for reasoning (keep 0.0–0.3) |
| `LLM_TEMPERATURE_SYNTHESIS` | No | — | `""` | Temperature override for synthesis (keep 0.0–0.3) |
| `LLM_MAX_TOKENS_REASONING` | No | — | `""` | Max output tokens for reasoning |
| `LLM_MAX_TOKENS_SYNTHESIS` | No | — | `""` | Max output tokens for synthesis |
| `GUARDRAILS_ENABLED` | No | render.yaml | `false` † | Run input/output guardrails on advisor/RAG calls |
| `GUARDRAILS_BLOCK_ON_INJECTION` | No | — | `false` † | Block on detected prompt injection (needs `GUARDRAILS_ENABLED`) |

**Notes:**
- Python API works fully with all defaults (mock provider, local embeddings, EchoClient LLM)
- Setting `OPENAI_API_KEY` + `LLM_PROVIDER=openai` enables real AI-powered responses
- `PORT` is injected by Render — do not set manually
- In-memory vector store is re-populated from `data/documents/` on each restart
- All `RAG_*`/`LLM_*` rows above default to **today's behavior** (dense-only, normal mode, no
  fallback) when unset, so an empty `.env` boots unchanged. Hybrid/agentic also require
  `VECTOR_STORE_TYPE=pgvector` and the Infra migrations (`text_tsv` column + `match_rag_chunks_lexical`).
- † **Guardrails:** `.env.example` ships `GUARDRAILS_ENABLED=true`/`GUARDRAILS_BLOCK_ON_INJECTION=true`
  as the *recommended* values for new deployments, but the service default **when the var is unset is
  `false`** (passthrough = today). Set them explicitly to opt in.

---

## Variables NOT Used (Cleaned Up)

The following were previously listed but have been removed:

| Variable | Service | Reason |
|----------|---------|--------|
| `SUPABASE_URL` | api-python | Python doesn't call Supabase directly |
| `SUPABASE_ANON_KEY` | api-python | Python doesn't call Supabase directly |
| `SUPABASE_SERVICE_ROLE_KEY` | api-python | Python doesn't call Supabase directly |

---

## Secrets Summary

These must be set in the Render dashboard (not in render.yaml):

| Service | Secret Variables |
|---------|-----------------|
| web | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| api-java | `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` |
| api-python | `OPENAI_API_KEY` (optional — only if using OpenAI) |
