# Current Architecture Summary

Reconstructed from repository on 2026-04-06.

---

## System Diagram

```
                            Users
                              |
                    +---------+---------+
                    |                   |
              [React Frontend]          |
              (Render Static)           |
                    |                   |
         +----------+----------+       |
         |                     |       |
  [Spring Boot API]    [FastAPI API]   |
  (Render Starter)     (Render Starter)|
         |                     |       |
         +----------+----------+       |
                    |                   |
            [Supabase PostgreSQL]       |
            [Supabase Auth]  -----------+
```

## Service Responsibilities

### Frontend (apps/web) -- React 19 + Vite + Tailwind

**Owns:** User interface, form validation, routing, client-side state

| Feature | Calls | Fallback |
|---------|-------|----------|
| Quote search | Java `POST /api/v1/quotes` | Supabase `get-shipping-quotes` edge fn (via feature flag) |
| Save/remove options | Java `GET/POST/DELETE /api/v1/saved-options` | Supabase edge fns (via feature flag) |
| Booking redirect | Java `POST /api/v1/bookings/redirect` | Supabase edge fn (via feature flag) |
| Shipping advisor | Python `POST /api/v1/advisor/shipping` | Error message shown |
| Tracking guidance | Python `POST /api/v1/advisor/tracking` | Error message shown |
| AI recommendations | Python `POST /api/v1/advisor/recommendation` | Panel silently hidden |
| Authentication | Supabase Auth directly | N/A |

**Key files:**
- `src/config/api.ts` -- API base URLs, endpoints, feature flags
- `src/hooks/useShippingQuotes.ts` -- Quote fetching with Java/Supabase toggle
- `src/hooks/useSavedOptions.ts` -- Saved options CRUD with auth
- `src/hooks/useRecommendation.ts` -- Non-blocking AI enrichment
- `src/lib/advisor-api.ts` -- Typed Python API client
- `src/pages/HomePage.tsx` -- Main quote search (417 lines)
- `src/pages/AdvisorPage.tsx` -- AI advisor (227 lines)

### Spring Boot Java API (apps/api-java) -- System of Record

**Owns:** All transactional data, quote generation, user-scoped data, JWT verification

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/v1/health` | Public | Render health check |
| `POST /api/v1/quotes` | Public (optional JWT) | Generate mock shipping quotes, persist request |
| `GET /api/v1/saved-options` | JWT required | List user's saved options |
| `POST /api/v1/saved-options` | JWT required | Save a shipping option |
| `DELETE /api/v1/saved-options/{id}` | JWT required | Remove (ownership verified) |
| `POST /api/v1/bookings/redirect` | Public | Track booking redirect clicks |
| `GET/POST /api/v1/shipments` | JWT required | **Stub only -- not implemented** |

**Database tables owned:**
- `shipment_requests` -- Every quote search persisted
- `saved_options` -- User bookmarked services (JSONB columns for promo/breakdown/details)
- `redirect_tracking` -- Booking click-through tracking

**Auth model:** Supabase JWT verification via `JwtAuthFilter`. Extracts `sub` claim as userId. Production requires `SUPABASE_JWT_SECRET` (fail-fast). Local dev falls back to unsigned decode.

**Key files:**
- `src/main/.../config/SecurityConfig.java` -- Endpoint authorization rules
- `src/main/.../auth/JwtAuthFilter.java` -- JWT extraction and verification
- `src/main/.../service/QuoteService.java` -- Mock quote generation (308 lines)
- `src/main/.../service/SavedOptionService.java` -- CRUD with JSON handling
- `src/main/.../exception/GlobalExceptionHandler.java` -- Structured errors

### FastAPI Python API (apps/api-python) -- AI & Advisory

**Owns:** RAG pipeline, LLM integration, tool orchestration, advisor logic, recommendations

| Endpoint | Purpose | Uses LLM? |
|----------|---------|-----------|
| `GET /health` | Liveness | No |
| `GET /ready` | Readiness | No |
| `GET /api/v1/info` | Service metadata | No |
| `POST /api/v1/advisor/shipping` | Shipping advice | Yes (RAG + tools + LLM) |
| `POST /api/v1/advisor/tracking` | Tracking guidance | Yes (RAG + optional tools + LLM) |
| `POST /api/v1/advisor/recommendation` | Score & rank services | No (deterministic) |
| `POST /api/v1/orchestration/run` | Execute a tool | No |
| `GET /api/v1/orchestration/tools` | List available tools | No |
| `POST /api/v1/rag/query` | Direct RAG query | Yes |
| `POST /api/v1/rag/ingest` | Re-ingest documents | No |

**Abstraction layers:**

```
Routes (advisor, orchestration, rag, health)
  |
Services (shipping_advisor, tracking_advisor, recommendation, orchestration, rag)
  |
Core Abstractions
  +-- LLM Client (EchoClient | OpenAIClient)
  +-- Embedding Provider (LocalHashEmbedding | OpenAIEmbedding)
  +-- Vector Store (InMemoryVectorStore)
  +-- Tool Registry (ValidateAddressTool, GetQuotePreviewTool)
  +-- Shipping Provider (MockShippingProvider)
  +-- Cache (TTLCache: recommendation 300s, rag 120s)
```

**Key files:**
- `app/main.py` -- Lifespan init (httpx client, RAG pipeline, tool registry)
- `app/core/config.py` -- All env vars with defaults
- `app/llm/client.py` -- LLM abstraction (EchoClient vs OpenAI)
- `app/rag/retrieval.py` -- Cached RAG retrieval
- `app/services/recommendation_service.py` -- Scoring algorithm (253 lines)
- `app/services/shipping_advisor_service.py` -- RAG + tools + LLM (171 lines)

---

## Data Flow: Quote Search

```
User fills form
  -> HomePage.tsx validates input
  -> useShippingQuotes.fetchQuotes()
     -> if VITE_USE_JAVA_QUOTES=true:
          POST java-api/api/v1/quotes
            -> QuoteService generates mock rates
            -> Persists ShipmentRequest to DB
            -> Returns prime/private sections
        else:
          Supabase edge function (legacy)
  -> Results rendered in QuoteRow sections
  -> useRecommendation(allServices)
     -> POST python-api/api/v1/advisor/recommendation
       -> RecommendationService scores services
       -> Returns primary + alternatives + summary
     -> (fails silently if Python unavailable)
  -> RecommendationCard panel shown (or hidden)
```

## Data Flow: Shipping Advisor

```
User enters query on AdvisorPage
  -> advisorService.getShippingAdvice({ query, context })
  -> POST python-api/api/v1/advisor/shipping
     -> ShippingAdvisorService:
        1. Retrieve RAG context (top 5 chunks)
        2. If context has zip/weight -> auto-run GetQuotePreviewTool
        3. If context has address -> auto-run ValidateAddressTool
        4. Build prompt (system + context + tool results + query)
        5. LLM complete (EchoClient returns context, OpenAI gives real answer)
     -> Return: answer, reasoning_summary, tools_used, sources
  -> AdvisorPage renders answer, sources list, tools used
```

## Data Flow: Save Option

```
User clicks bookmark on QuoteRow
  -> useSavedOptions.toggleSave()
     -> if VITE_USE_JAVA_SAVED_OPTIONS=true:
          POST java-api/api/v1/saved-options
          (Authorization: Bearer <supabase-jwt>)
            -> SavedOptionService.save()
            -> Validates userId from JWT
            -> Persists SavedOption with JSONB fields
        else:
          Supabase edge function (legacy)
  -> savedIds Set updated for UI state
```

---

## Cross-Service Communication

| From | To | Method | Status |
|------|----|--------|--------|
| Frontend | Java API | HTTP (fetch) | **Active** |
| Frontend | Python API | HTTP (fetch) | **Active** |
| Frontend | Supabase Auth | Supabase JS SDK | **Active** |
| Frontend | Supabase Edge Fns | Supabase JS SDK | **Fallback only** (flags=false) |
| Java API | Python API | httpx (configured) | **Not wired** (TODO in AppConfig) |
| Python API | Java API | httpx.AsyncClient (configured) | **Not wired** (client created but unused) |
| Java API | Supabase DB | JDBC/JPA | **Active** |
| Python API | OpenAI | OpenAI SDK | **Ready, not enabled** |

**Key design rule:** Java and Python APIs do NOT call each other in the current implementation. The frontend orchestrates between them. This is by design for Phase 13, with cross-service calls planned for future phases.

---

## Environment Configuration

### Per-Service Env Vars (key ones)

**Frontend:**
- `VITE_JAVA_API_BASE_URL`, `VITE_PYTHON_API_BASE_URL` -- API targets
- `VITE_USE_JAVA_QUOTES/SAVED_OPTIONS/BOOKING_REDIRECT` -- Feature flags
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` -- Auth

**Java API:**
- `DATABASE_URL/USERNAME/PASSWORD` -- PostgreSQL connection
- `SUPABASE_JWT_SECRET` -- JWT verification
- `SPRING_PROFILES_ACTIVE` -- local/production
- `CORS_ALLOWED_ORIGINS` -- Frontend URL

**Python API:**
- `LLM_PROVIDER` -- empty (EchoClient) or "openai"
- `EMBEDDING_PROVIDER` -- empty (LocalHash) or "openai"
- `SHIPPING_PROVIDER` -- "mock" only
- `CORS_ALLOWED_ORIGINS` -- Frontend URL
- `ENABLE_TOOLS` -- "true"

---

## Resilience & Fallback

| Failure | Impact | Automatic Fallback |
|---------|--------|--------------------|
| Python API down | No advisor, no recommendations | Recommendation panel hidden; advisor shows "unavailable" |
| Java API down | No quotes, no saved options | Can flip feature flags to use Supabase edge functions |
| Supabase DB down | Java API fails | None (system of record) |
| Supabase Auth down | No login, no saved options | Quote search still works (anonymous) |
| OpenAI API down | N/A (not currently enabled) | EchoClient is the default |
| Cold start (Render Starter) | 15-30s delay after idle | Uptime monitor or paid plan |
