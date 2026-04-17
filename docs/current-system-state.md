# Current System State

As of 2026-04-07. Verified against actual codebase on `develop` branch.

---

## Architecture

3-service polyglot monorepo managed by Nx 22.3 + pnpm workspaces.

| Service | Stack | Responsibility | Deploy |
|---------|-------|---------------|--------|
| Frontend (`apps/web`) | React 19 + Vite + TypeScript + shadcn/ui + Tailwind | UI: quote form, saved options, advisor page, booking redirect | Render Static Site |
| Java API (`apps/api-java`) | Spring Boot 4.0.5 (Java 25) | Transactional data: quotes, saved options, booking redirects. Supabase PostgreSQL + JWT auth | Render |
| Python API (`apps/api-python`) | FastAPI 0.135.3 (Python 3.13) | AI features: RAG pipeline, LLM integration, tool orchestration, advisor endpoints, recommendations | Render |

Supporting: Supabase (PostgreSQL + Auth), legacy edge functions (feature-flagged, fallback only).

Frontend orchestrates between both APIs. Java and Python APIs do not call each other.

---

## What Works (Phases 1-13 Complete)

- 5-page React SPA with Supabase Auth
- 3-step quote form with real-time carrier comparison
- Saved options CRUD with JWT auth (Java API)
- Booking redirect tracking (Java API)
- AI Advisor page wired to Python API
- Recommendation cards on quote results
- RAG pipeline: ingestion -> chunking -> embedding -> vector search -> LLM
- Tool system: ValidateAddressTool, GetQuotePreviewTool
- Provider abstraction: `ShippingProvider` ABC with `MockShippingProvider`
- LLM abstraction: `LLMClient` ABC with `EchoClient` and `OpenAIClient`
- Embedding abstraction: `EmbeddingProvider` ABC with `LocalHashEmbedding` and `OpenAIEmbedding`
- Vector store abstraction: `VectorStore` ABC with `InMemoryVectorStore`
- Config-driven provider selection via env vars
- Security: JWT auth on Java API, CORS, input validation, global error handling
- Deployment: `render.yaml` with 3 services, health checks

---

## What Is Mock / Placeholder

| Component | Current Implementation | Abstraction |
|-----------|----------------------|-------------|
| Shipping provider | `MockShippingProvider` (default), `UPSProvider`, `FedExProvider`, `DHLProvider`, `USPSProvider` available — selected via `SHIPPING_PROVIDER` config | `ShippingProvider` ABC in `providers/shipping_provider.py`, factory in `providers/__init__.py` |
| LLM | `EchoClient` (default), `OpenAIClient`, `GeminiClient`, `LlamaClient` available — selected via `LLM_PROVIDER` config | `LLMClient` ABC in `llm/client.py`, factory in same file |
| Embeddings | `LocalHashEmbedding` — deterministic hash vectors, no semantics | `EmbeddingProvider` ABC in `rag/embeddings.py` |
| Vector store | `InMemoryVectorStore` — cosine similarity, lost on restart | `VectorStore` ABC in `rag/vector_store.py` |
| Tool selection | Regex/conditional matching in `shipping_advisor_service.py` | Hardcoded if/else on context keys |

---

## RAG Knowledge Base

14 documents in `apps/api-python/data/documents/` organized into 4 categories:

| Category | Count | Content |
|----------|-------|---------|
| `carriers/` | 5 | UPS, FedEx, DHL, USPS overviews + original carrier-info |
| `guides/` | 4 | Shipping FAQ, ground vs express, packaging, address quality |
| `scenarios/` | 2 | Recommendation tradeoffs, delays and exceptions |
| `policies/` | 3 | Carrier comparison, returns/claims, international basics |

Ingested on startup (recursive subdirectory scan), chunked by `RAG_CHUNK_SIZE=500`, stored in memory. ~150+ chunks in the vector store.

---

## Test Coverage

- **Python API**: 171 tests passing (adds 7 task-based LLM router tests)
- **Java API**: 28 tests passing
- **Lint**: 0 errors (new/modified files)
- **Total**: 199 tests, all green

---

## Key Abstractions Already in Place

These ABCs are designed for swapping implementations without changing tool/service logic:

1. **`Provider`** (`providers/base.py`) — base for all external providers, with `name` property and `health_check()`
2. **`ShippingProvider`** (`providers/shipping_provider.py`) — extends Provider with `validate_address()` and `get_quote_preview()`
3. **`LLMClient`** (`llm/client.py`) — `complete(messages)` interface
4. **`EmbeddingProvider`** (`rag/embeddings.py`) — `embed(texts)` and `dimensions` property
5. **`VectorStore`** (`rag/vector_store.py`) — `add()`, `search()`, `clear()`, `count()`
6. **`Tool`** (`tools/base.py`) — `name`, `description`, `parameters`, `execute()`, `schema()`, `validate_input()`
7. **`ToolRegistry`** (`tools/registry.py`) — `register()`, `get()`, `list_tools()`, `list_schemas()`

---

## Config (Python API)

All settings in `app/core/config.py`, driven by env vars:

| Setting | Default | Production Path |
|---------|---------|-----------------|
| `SHIPPING_PROVIDER` | `"mock"` | Set to a real provider name |
| `LLM_PROVIDER` | `""` (legacy single-provider; inherited by tasks if their var is empty) | `"openai"`, `"gemini"`, `"llama"` |
| `LLM_PROVIDER_REASONING` | `""` (inherits `LLM_PROVIDER`) | `"openai"` (advisor reasoning) |
| `LLM_PROVIDER_SYNTHESIS` | `""` (inherits `LLM_PROVIDER`) | `"gemini"` (RAG q&a, recommendation summary) |
| `LLM_PROVIDER_FALLBACK` | `"echo"` | Provider used when a task's provider can't be built |
| `OPENAI_API_KEY` | `""` | Set real key |
| `OPENAI_MODEL` | `"gpt-4o-mini"` | Any OpenAI model |
| `GEMINI_API_KEY` | `""` | Set real key |
| `GEMINI_MODEL` | `"gemini-2.0-flash"` | Any Gemini model |
| `LLAMA_BASE_URL` | `"http://localhost:11434"` | Ollama server URL |
| `LLAMA_MODEL` | `"llama3.2"` | Any Ollama model |
| `LLM_TIMEOUT` | `30` | Request timeout in seconds |
| `LLM_MAX_TOKENS` | `1024` | Max response tokens |
| `LLM_TEMPERATURE` | `0.3` | Response temperature |
| `EMBEDDING_PROVIDER` | `""` (empty = LocalHash) | `"openai"` |
| `VECTOR_STORE_TYPE` | `"memory"` | Only option currently |

---

## Startup Flow (`main.py`)

1. Create `httpx.AsyncClient` for Java API communication
2. `create_embedding_provider()` — factory, reads `EMBEDDING_PROVIDER`
3. `create_vector_store()` — factory, always returns `InMemoryVectorStore`
4. `create_llm_router()` — task-based router. Builds one client per task (`reasoning`, `synthesis`, `fallback`); each task resolves independently from `LLM_PROVIDER_<TASK>` → legacy `LLM_PROVIDER` → `LLM_PROVIDER_FALLBACK` → EchoClient. Stored on `app.state.llm_router`. The synthesis client is also exposed at `app.state.rag["llm_client"]` for back-compat.
5. `create_shipping_provider()` — factory reads `SHIPPING_PROVIDER`, falls back to mock if credentials missing
6. `ToolRegistry` — registers `ValidateAddressTool` and `GetQuotePreviewTool`
7. Mount routes: health, info, orchestration, rag, advisor
