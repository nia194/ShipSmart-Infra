# Reconstructed Phase History (Phase 3 through Phase 13)

Reconstructed from actual code, docs, git history, and test files on 2026-04-06.

**Important note:** Git history shows only 12 total commits. The bulk of Phases 3-13 were committed in a single commit (`607c80f Phase3-7 completed` on branch `feature/1.3`). The phase-by-phase breakdown below is reconstructed from code structure, docs, and test files -- not from individual git commits.

---

## Pre-Phase 3: Foundation (Commits visible in git)

### Commit: `82a9108` Initial commit
- GitHub repo created

### Commit: `4ad6ba5` Polyglot monorepo skeleton
- Nx-based monorepo with pnpm workspaces
- Three app directories: `apps/web`, `apps/api-java`, `apps/api-python`
- Root `package.json` with Nx 22.3, TypeScript 5.9

### Commit: `8b26aae` Fixed dependencies
- JDK, Spring Boot, Gradle for Java
- UV, FastAPI for Python
- TypeScript, Nx for React

### Commit: `ed74676` Frontend all 5 phases done with migration
- Full React 19 frontend migrated from Lovable source
- 5 pages: HomePage, SavedPage, AuthPage, NotFound (AdvisorPage added later)
- Supabase Auth integration
- 3-step shipping quote form
- Quote results display (Prime + Private providers)
- Saved options with Supabase edge function calls
- Feature flag infrastructure (`VITE_USE_JAVA_*`)

### Commit: `528dc3f` Spring Boot backend phase 1 and phase 2
- Phase 1: Quote endpoint (`POST /api/v1/quotes`) with mock deterministic pricing
- Phase 2: Saved options CRUD with JWT auth, booking redirect tracking
- JPA entities: ShipmentRequest, SavedOption, RedirectTracking
- Supabase JWT verification in JwtAuthFilter

---

## Phase 3: Booking Redirect (in `607c80f`)

**Evidence:** `BookingController.java`, `BookingService.java`, `RedirectTracking.java`, `docs/backend-phase-3-booking.md`

**What was built:**
- `POST /api/v1/bookings/redirect` endpoint (public, no auth required)
- `RedirectTracking` JPA entity persisting to `redirect_tracking` table
- Optional userId attribution (works for anonymous users)
- Frontend integration via `VITE_USE_JAVA_BOOKING_REDIRECT` flag
- 4 BookingService tests + 3 BookingController tests

**Outcome:** All 3 legacy Supabase edge functions for transactional features (quotes, saved options, booking) now have Java API replacements with feature flag toggles.

---

## Phase 4: Backend Hardening (in `607c80f`)

**Evidence:** `SecurityConfig.java`, `GlobalExceptionHandler.java`, `RequestLogging middleware`, `docs/backend-phase-4-hardening.md`

**What was built:**
- Spring Security configuration (stateless, CSRF disabled, endpoint authorization rules)
- Global exception handler with structured JSON error responses
- Bean validation on request DTOs
- MDC-based request ID logging
- Profile-based configuration (local vs production)
- Production fail-fast: `REQUIRE_JWT_SECRET=true` enforced
- MockMvc controller tests (SavedOptionControllerTest, BookingControllerTest)

**Outcome:** Java API hardened for production with proper security, validation, error handling, and logging.

---

## Phase 5-6: Stabilization & Deployment Readiness (in `607c80f`)

**Evidence:** `render.yaml`, deployment docs, `.env.example` files, `application-production.yml`

**What was built:**
- `render.yaml` Blueprint with all 3 services defined
- Production Spring profile with WARN-level logging
- Health check endpoints for Render monitoring
- CORS configuration per service
- Environment variable matrix documented
- Feature flags defaulting to `"true"` in production

**Outcome:** All services deployable to Render with health checks, CORS, and secret management.

---

## Phase 7: FastAPI Foundation (in `607c80f`)

**Evidence:** `app/main.py`, `app/core/config.py`, `app/core/errors.py`, `app/core/middleware.py`, `app/core/logging.py`, `docs/api-python-foundation.md`

**What was built:**
- FastAPI application with lifespan context manager
- Settings class (pydantic-settings) with all env vars
- Request logging middleware with X-Request-Id
- Structured error handling (AppError + global handlers)
- Health endpoints (`/health`, `/ready`)
- Info endpoint (`/api/v1/info`)
- CORS middleware
- Swagger docs disabled in production

**Outcome:** Python API skeleton ready for AI feature development.

---

## Phase 8: MCP/Tooling Architecture (in `607c80f`)

**Evidence:** `app/tools/base.py`, `app/tools/registry.py`, `app/tools/address_tools.py`, `app/tools/quote_tools.py`, `app/providers/`, `docs/mcp-tooling-architecture.md`

**What was built:**
- Tool abstract interface (name, description, parameters, execute, schema, validate_input)
- ToolRegistry (register, get, list_tools, list_schemas)
- ValidateAddressTool (delegates to ShippingProvider)
- GetQuotePreviewTool (delegates to ShippingProvider)
- Provider abstraction: `Provider` ABC, `ShippingProvider` ABC
- MockShippingProvider (address validation, quote preview with DIM weight calc)
- Orchestration service (regex-based tool selection, execute, summarize)
- Orchestration endpoints (`POST /api/v1/orchestration/run`, `GET /api/v1/orchestration/tools`)

**Outcome:** Extensible tool system with provider abstraction, ready for advisor features.

---

## Phase 9: AI Features (in `607c80f`)

**Evidence:** `app/rag/`, `app/llm/`, `app/services/`, `app/api/routes/advisor.py`, `app/schemas/advisor.py`, `docs/ai-feature-architecture.md`, `docs/advisor-flows.md`, `docs/rag-architecture.md`

**What was built:**

### RAG Pipeline
- Chunking (character-based, configurable overlap)
- Embeddings (LocalHashEmbedding default, OpenAIEmbedding ready)
- InMemoryVectorStore (cosine similarity search)
- Document ingestion (loads `.txt`/`.md` from `data/documents/`)
- Retrieval with TTL caching (120s)
- 2 seed documents: `carrier-info.txt`, `shipping-faq.md`

### LLM Layer
- EchoClient (default, returns RAG context with disclaimer)
- OpenAIClient (gpt-4o-mini, temperature=0.3)
- Prompt templates (system prompt + RAG context builder)

### Services
- **ShippingAdvisorService**: RAG context + optional tool execution + LLM completion
- **TrackingAdvisorService**: Enriched RAG query + optional address validation + LLM + next_steps extraction
- **RecommendationService**: Deterministic scoring (CHEAPEST/FASTEST/BEST_VALUE/BALANCED), no LLM needed
- TTL caching for recommendations (300s)

### Endpoints
- `POST /api/v1/advisor/shipping` (query + optional context)
- `POST /api/v1/advisor/tracking` (issue + optional context)
- `POST /api/v1/advisor/recommendation` (services list + optional context)
- `POST /api/v1/rag/query` (direct RAG query)
- `POST /api/v1/rag/ingest` (trigger document re-ingestion)

**Outcome:** Full AI advisor system with RAG, tools, and deterministic recommendations.

---

## Phase 10: Full System Integration (in `607c80f`)

**Evidence:** `apps/web/src/pages/AdvisorPage.tsx`, `apps/web/src/lib/advisor-api.ts`, `apps/web/src/hooks/useRecommendation.ts`, `apps/web/src/components/advisor/RecommendationCard.tsx`, `apps/web/src/config/api.ts`, `docs/full-system-integration.md`, `docs/frontend-ai-integration.md`

**What was built:**
- AdvisorPage with shipping and tracking tabs
- `AdvisorService` class in `lib/advisor-api.ts` (typed API client for all Python endpoints)
- `useRecommendation` hook (non-blocking, fails silently)
- `RecommendationCard` component (type badges, explanation, score)
- AI recommendation panel in HomePage (primary + 2 alternatives + summary)
- Python API base URL in `config/api.ts`
- Error UX: distinguishes network errors from API errors on advisor page

**Outcome:** Frontend fully integrated with both Java (transactional) and Python (AI) APIs.

---

## Phase 11: Pre-Deployment (in `607c80f`)

**Evidence:** `docs/pre-deployment-checklist.md`, `docs/deployment-cutover-plan.md`, `docs/launch-smoke-tests.md`, `docs/production-env-reference.md`

**What was built:**
- Pre-deployment checklist (infra, RAG, tools, advisors, caching, tests, frontend, env vars)
- Cutover plan (deployment order, flag strategy, rollback scenarios)
- 13-section smoke test checklist
- Production environment variable reference

**Outcome:** All documentation and checklists ready for production deployment.

---

## Phase 12: Deployment & Launch (in `607c80f`)

**Evidence:** `render.yaml` (complete), `docs/deployment-render.md`, `docs/deployment-launch-plan.md`, `docs/post-deploy-smoke-test.md`

**What was built:**
- Full `render.yaml` Blueprint (3 services, all env vars, health checks)
- Deployment guide with step-by-step Render instructions
- Launch plan with deployment order and rollback strategy
- Post-deploy smoke test checklist

**Outcome:** System deployed to Render with all services running.

---

## Phase 13: Post-Launch Stabilization (in `607c80f`)

**Evidence:** `app/llm/client.py` (EchoClient improvements), `app/services/recommendation_service.py` (scoring fix), `docs/post-launch-stabilization.md`, `docs/known-limitations.md`, `docs/next-iteration-roadmap.md`, `scripts/perf_check.py`

**What was fixed:**
1. EchoClient no longer shows "Set LLM_PROVIDER=openai" to users; returns structured RAG answers
2. Scoring normalization bug: was dividing by `max_price` instead of `(max_price - min_price)`
3. Type-specific recommendation explanations ("lowest price option" / "fastest delivery" instead of generic)
4. Recommendation endpoint works even if RAG pipeline failed
5. Advisor page distinguishes "service unavailable" from API errors
6. Performance monitoring script (`scripts/perf_check.py`) checks both APIs

**What was documented:**
- `post-launch-stabilization.md`: Verification checklist, common failure modes, fixes applied
- `known-limitations.md`: Complete inventory of mock vs real, infrastructure, AI quality, frontend, security limitations
- `next-iteration-roadmap.md`: 10 prioritized next steps

**Outcome:** System stabilized for production use with known limitations documented and roadmap defined.

---

## Summary Timeline

| Phase | Description | Key Deliverable |
|-------|-------------|-----------------|
| Pre-3 | Monorepo + frontend + backend Phase 1-2 | React app + Java quotes/saved-options |
| 3 | Booking redirect | `POST /api/v1/bookings/redirect` |
| 4 | Backend hardening | Security, validation, error handling, logging |
| 5-6 | Stabilization + deployment readiness | `render.yaml`, production config |
| 7 | FastAPI foundation | Python API skeleton with health/config/errors |
| 8 | MCP/Tooling | Tool system, providers, orchestration |
| 9 | AI features | RAG, LLM, advisors, recommendations |
| 10 | Full system integration | Frontend AdvisorPage + recommendation panel |
| 11 | Pre-deployment | Checklists, cutover plan, env matrix |
| 12 | Deployment & launch | Live on Render |
| 13 | Post-launch stabilization | Bug fixes, perf script, limitations documented |

**Total test count:** 110 Python + 28 Java = 138 tests
