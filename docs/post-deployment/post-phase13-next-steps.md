# Post-Phase 13: Safe Next Steps

Based on actual repository state as of 2026-04-06.

---

## Context

Phase 13 (post-launch stabilization) is complete. The system is deployed on Render with:
- 138 tests passing (110 Python + 28 Java)
- All mock implementations working correctly
- Feature flags active (Java API in use, Supabase fallback available)
- Known limitations documented

---

## Recommended Phase 14: "Go Real"

### 14A: Enable Real AI (Config Only -- No Code Changes)

**Prerequisites:** OpenAI API key with billing enabled

**Steps:**
1. Set in Render Python service environment:
   - `LLM_PROVIDER=openai`
   - `OPENAI_API_KEY=sk-...`
   - `EMBEDDING_PROVIDER=openai`
2. Restart Python service
3. Trigger document re-ingestion: `POST /api/v1/rag/ingest`
4. Test advisor responses are now AI-generated (not raw document excerpts)
5. Monitor OpenAI API costs

**Impact:** Advisor answers transform from document dumps to conversational guidance. Embedding-based retrieval becomes semantic instead of hash-based.

**Risk:** Low. EchoClient/LocalHash remain as fallback (revert env vars).

### 14B: Expand Knowledge Base

**What to do:**
1. Add documents to `apps/api-python/data/documents/`:
   - Common shipping scenarios and resolutions
   - Carrier-specific policies (returns, claims, insurance)
   - International shipping rules
   - Package size/weight limits by carrier
2. Test retrieval quality: `POST /api/v1/rag/query` with sample questions
3. Tune `RAG_CHUNK_SIZE` and `RAG_TOP_K` if retrieval quality is poor

**Impact:** AI advisor gives more relevant and specific answers.

**Risk:** None. Documents are additive. Re-ingestion happens automatically on restart.

---

## Recommended Phase 15: "Protect"

### 15A: Rate Limiting

**Why:** With real OpenAI calls, each advisor request costs money.

**Options:**
- `slowapi` (built on limits library) for FastAPI
- Per-IP or per-endpoint limits
- Suggested: 10 req/min for advisor endpoints, 30 req/min for recommendations

### 15B: Auth on Python API

- Require auth for advisor endpoints
- API key or JWT validation

---

## Recommended Phase 16: "Enhance"

### 16A: Real Carrier API Integration

**What to build:**
- Create `RealShippingProvider` implementing `ShippingProvider` ABC
- Start with one carrier (UPS or FedEx)
- Map carrier API response to existing `QuotePreviewInput`/output format
- Configure via `SHIPPING_PROVIDER=real`

### 16B: Multi-Turn Advisor Conversations

**What to build:**
- Conversation history state on advisor page
- Send previous messages as context to advisor endpoint
- `conversation_id` in request/response

### 16C: LLM-Driven Tool Selection

- Replace regex-based tool matching with LLM intent detection
- Support multi-tool execution
- Fallback to regex if LLM unavailable

### 16D: Persistent Vector Store

- Replace InMemoryVectorStore with Chroma, Qdrant, or file-based persistence
- Faster startup, no re-ingestion on restart

---

## What NOT To Do Yet

| Item | Why Wait |
|------|----------|
| Decommission Supabase edge functions | Need 2+ weeks stable on Java API first |
| Java-to-Python service calls | No current use case; frontend orchestration works |
| ShipmentController implementation | No UI consumes it; prioritize user-facing features |

---

## Top Files To Read First

### Frontend (apps/web/src/)
1. `config/api.ts` -- All API endpoints and feature flags (69 lines)
2. `pages/HomePage.tsx` -- Main user flow (417 lines)
3. `hooks/useShippingQuotes.ts` -- Quote fetching with toggle (83 lines)
4. `hooks/useRecommendation.ts` -- AI enrichment pattern (59 lines)
5. `lib/advisor-api.ts` -- Python API client (168 lines)
6. `pages/AdvisorPage.tsx` -- AI advisor UI (227 lines)
7. `hooks/useSavedOptions.ts` -- Save/remove with auth (181 lines)

### Java API (apps/api-java/src/main/java/com/shipsmart/api/)
1. `config/SecurityConfig.java` -- Who can access what (62 lines)
2. `service/QuoteService.java` -- Core quote logic (308 lines)
3. `auth/JwtAuthFilter.java` -- How auth works (115 lines)
4. `controller/QuoteController.java` -- Quote endpoint (49 lines)
5. `service/SavedOptionService.java` -- CRUD logic (165 lines)
6. `domain/SavedOption.java` -- Main entity (165 lines)

### Python API (apps/api-python/app/)
1. `core/config.py` -- All settings/env vars (72 lines)
2. `main.py` -- Startup and initialization (112 lines)
3. `services/recommendation_service.py` -- Scoring algorithm (253 lines)
4. `services/shipping_advisor_service.py` -- RAG + tools + LLM (171 lines)
5. `llm/client.py` -- LLM abstraction (98 lines)
6. `rag/retrieval.py` -- Cached retrieval (53 lines)
7. `tools/quote_tools.py` -- Quote preview tool (73 lines)
8. `api/routes/advisor.py` -- Advisor endpoints (147 lines)

---

## Open Questions

1. **OpenAI API key:** Is one available? Enabling real AI is the single highest-impact next step.
2. **Carrier API accounts:** Are any carrier developer accounts available for real rate integration?
3. **Timeline for Supabase edge function decommission:** When is the team comfortable removing the legacy fallback path?
