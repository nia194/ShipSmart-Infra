# Pre-Deployment Checklist

## Python API (`apps/api-python`)

### Infrastructure

- [x] Health endpoint (`GET /health`) returns 200
- [x] Readiness endpoint (`GET /ready`) returns 200
- [x] Info endpoint (`GET /api/v1/info`) returns metadata without leaking secrets
- [x] CORS configured for frontend origin
- [x] Request logging middleware with request_id and duration
- [x] Centralized error handling (422, 500, AppError)

### RAG Pipeline

- [x] Document ingestion loads from `data/documents/`
- [x] Embedding provider creates vectors (LocalHashEmbedding for dev)
- [x] Vector store search returns ranked results
- [x] RAG retrieval caching (TTL=120s) reduces repeat query cost
- [x] Graceful fallback when vector store is empty

### Tools & Providers

- [x] Tool registry initialized with ValidateAddressTool and GetQuotePreviewTool
- [x] MockShippingProvider handles address validation and quote preview
- [x] Orchestration selects tools via regex patterns
- [x] Tools fail gracefully and return error in ToolOutput

### Advisor Endpoints

- [x] `POST /api/v1/advisor/shipping` — RAG + tools + LLM
- [x] `POST /api/v1/advisor/tracking` — RAG + optional tools + LLM
- [x] `POST /api/v1/advisor/recommendation` — deterministic scoring
- [x] Recommendation caching (TTL=300s)
- [x] All advisors work without LLM (EchoClient fallback)
- [x] Input validation returns 422 for invalid requests

### Caching

- [x] TTLCache with per-entry TTL and max-size eviction
- [x] RAG cache: `rag_cache` (TTL=120s, max=64)
- [x] Recommendation cache: `recommendation_cache` (TTL=300s, max=128)
- [x] Cache key is deterministic (SHA-256 hash of inputs)

### Tests

- [x] All unit tests pass (`uv run pytest`)
- [x] Integration tests cover full advisor flows
- [x] Failure scenario tests (missing state, empty services, invalid requests)
- [x] Cache tests (set/get, expiry, eviction, stats)
- [x] No lint errors (`uv run ruff check app/`)

---

## Frontend (`apps/web`)

### Advisor Integration

- [x] `advisor-api.ts` provides typed wrappers for all advisor endpoints
- [x] `AdvisorPage` with shipping/tracking tabs
- [x] `RecommendationCard` component with type badges
- [x] `useRecommendation` hook fetches recommendations after quotes load
- [x] Recommendation panel in HomePage (shows after quote results)
- [x] Graceful degradation: recommendation panel hidden if Python API fails

### Configuration

- [x] `VITE_PYTHON_API_BASE_URL` configured in `.env.local`
- [x] API URLs centralized in `src/config/api.ts`
- [x] Feature flag `VITE_USE_JAVA_QUOTES` for Java backend toggle

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LOG_LEVEL` | No | `INFO` | Python API log level |
| `CORS_ALLOWED_ORIGINS` | No | `*` | Allowed CORS origins |
| `LLM_PROVIDER` | No | `""` | LLM provider (empty = EchoClient) |
| `OPENAI_API_KEY` | No | `""` | OpenAI API key (if using OpenAI) |
| `EMBEDDING_PROVIDER` | No | `local` | Embedding provider |
| `VECTOR_STORE_TYPE` | No | `memory` | Vector store type |
| `SHIPPING_PROVIDER` | No | `mock` | Shipping data provider |
| `VITE_PYTHON_API_BASE_URL` | No | `http://localhost:8000` | Frontend → Python API |
| `VITE_JAVA_API_BASE_URL` | No | `http://localhost:8080` | Frontend → Java API |

---

## Pre-Deploy Smoke Test

```bash
# 1. Start Python API
cd apps/api-python && uv run uvicorn app.main:app --port 8000

# 2. Run performance check
uv run python scripts/perf_check.py

# 3. Run all tests
uv run pytest -v

# 4. Lint check
uv run ruff check app/
```

---

## Known Limitations (Acceptable for Initial Deployment)

1. **Mock shipping provider** — Returns synthetic data. Real carrier integration is a future phase.
2. **Local hash embeddings** — Not production-quality. Switch to OpenAI embeddings when API key is configured.
3. **In-memory vector store** — Data lost on restart. Acceptable for advisory use case.
4. **In-memory cache** — No persistence across restarts. TTLs keep data fresh.
5. **EchoClient LLM** — Returns formatted context, not AI-generated text. Upgrade by setting LLM_PROVIDER.
6. **Rule-based tool selection** — Regex patterns, not LLM-driven. Sufficient for current tool set.
