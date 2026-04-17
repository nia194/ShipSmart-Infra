# Next Iteration Roadmap

Recommended order of work after post-launch stabilization is complete.

---

## Priority 1: Enable Real AI (Low Effort, High Impact)

**Goal:** Upgrade from EchoClient/hash embeddings to real AI-powered responses.

**Steps:**
1. Set `OPENAI_API_KEY` in Render Python service env
2. Set `LLM_PROVIDER=openai`
3. Set `EMBEDDING_PROVIDER=openai`
4. Restart Python service
5. Verify advisor answers are now AI-generated
6. Monitor OpenAI API costs

**Effort:** Configuration only — no code changes.
**Impact:** Advisor answers go from raw document excerpts to conversational, contextualized advice.

---

## Priority 2: Expand Knowledge Base

**Goal:** Improve RAG retrieval quality by adding more domain documents.

**Steps:**
1. Add documents to `apps/api-python/data/documents/`:
   - Common shipping scenarios and resolutions
   - Carrier-specific policies (returns, claims, insurance)
   - International shipping rules
   - Package size/weight limits by carrier
2. Test retrieval quality with sample questions
3. Tune `RAG_CHUNK_SIZE` and `RAG_TOP_K` if needed

**Effort:** Content creation + testing.
**Impact:** Advisor gives more relevant, specific answers.

---

## Priority 3: Real Carrier API Integration

**Goal:** Replace MockShippingProvider with real carrier rate APIs.

**Steps:**
1. Create `RealShippingProvider` implementing `ShippingProvider` ABC
2. Integrate with carrier APIs (UPS, FedEx, DHL — start with one)
3. Map carrier responses to existing `QuotePreviewInput`/output format
4. Set `SHIPPING_PROVIDER=real` in config
5. Tool results now contain real rates

**Effort:** Medium — requires carrier API accounts and mapping logic.
**Impact:** Quote preview tool returns actual rates instead of synthetic data.

---

## Priority 4: Rate Limiting and Auth

**Goal:** Protect Python API from abuse.

**Steps:**
1. Add rate limiting middleware (e.g., `slowapi` or custom)
2. Consider requiring auth for advisor endpoints
3. Add API key or JWT validation for production use

**Effort:** Low-medium.
**Impact:** Prevents abuse; required before public launch at scale.

---

## Priority 5: Persistent Vector Store

**Goal:** Avoid re-ingestion on every restart.

**Steps:**
1. Evaluate options: Chroma, Qdrant, Pinecone, or file-based persistence
2. Implement `PersistentVectorStore` implementing existing `VectorStore` ABC
3. Set `VECTOR_STORE_TYPE=persistent` in config
4. Add migration script for existing documents

**Effort:** Medium.
**Impact:** Faster startup; required if document corpus grows significantly.

---

## Priority 6: LLM-Driven Tool Selection

**Goal:** Replace regex-based tool selection with LLM-powered intent detection.

**Steps:**
1. Add tool schema descriptions to LLM context
2. LLM decides which tools to call based on user query
3. Support multi-tool execution in a single request
4. Fall back to regex if LLM is unavailable

**Effort:** Medium-high.
**Impact:** More accurate tool selection; handles ambiguous queries better.

---

## Priority 7: Multi-Turn Advisor Conversations

**Goal:** Allow follow-up questions in advisor.

**Steps:**
1. Add conversation history to advisor page state
2. Send previous messages as context to advisor endpoint
3. Add `conversation_id` to request/response
4. Optional: persist conversations server-side

**Effort:** Medium.
**Impact:** Much better user experience for complex shipping questions.

---

## Priority 8: Monitoring and Observability

**Goal:** Production visibility beyond Render logs.

**Steps:**
1. Add structured JSON logging
2. Configure log drain (Datadog, Logtail, etc.)
3. Add basic metrics (request count, latency, error rate)
4. Add alerting for error rate spikes

**Effort:** Medium.
**Impact:** Operational confidence; catch issues before users report them.

---

## Priority 9: CI/CD Pipeline

**Goal:** Automated testing and deployment.

**Steps:**
1. GitHub Actions workflow for Python tests + lint on PR
2. GitHub Actions workflow for Java tests on PR
3. Auto-deploy to Render on merge to main
4. Add frontend build check

**Effort:** Low-medium.
**Impact:** Catch regressions before they reach production.

---

## Priority 10: Decommission Legacy Supabase Edge Functions

**Goal:** Remove legacy code paths and feature flags.

**Prerequisites:**
- Production running on Java backend for 2+ weeks without rollback
- All feature flags at `"true"` in production
- Zero traffic to Supabase edge functions

**Steps:**
1. Remove feature flag checks from frontend code
2. Remove Supabase edge function code
3. Remove `VITE_USE_JAVA_*` env vars
4. Simplify `useShippingQuotes` hook (remove Supabase path)

**Effort:** Low.
**Impact:** Cleaner codebase; removes maintenance burden of dual paths.

---

## Summary

| Priority | Item | Effort | Impact | Dependencies |
|----------|------|--------|--------|-------------|
| 1 | Enable real AI | Config only | High | OpenAI API key |
| 2 | Expand knowledge base | Content | High | None |
| 3 | Real carrier APIs | Medium | High | Carrier API accounts |
| 4 | Rate limiting / auth | Low-medium | Medium | None |
| 5 | Persistent vector store | Medium | Medium | Growing doc corpus |
| 6 | LLM-driven tool selection | Medium-high | Medium | Real LLM enabled |
| 7 | Multi-turn conversations | Medium | Medium | None |
| 8 | Monitoring | Medium | Medium | None |
| 9 | CI/CD | Low-medium | Medium | None |
| 10 | Decommission legacy | Low | Low | 2+ weeks stable |
