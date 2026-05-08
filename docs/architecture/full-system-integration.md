# Full System Integration (Phase 10)

## System Architecture Overview

ShipSmart is now a three-tier system:

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vue/React)                        │
│  - Quote comparison (calls Java)                               │
│  - Saved options (calls Java)                                  │
│  - Shipping advisor (calls Python)                             │
│  - Tracking guidance (calls Python)                            │
│  - Recommendations (calls Python)                              │
└────────────────┬──────────────────────────────┬────────────────┘
                 │                              │
        ┌────────▼────────┐          ┌──────────▼──────────┐
        │  SPRING BOOT    │          │    FASTAPI PYTHON   │
        │   (Java API)    │          │   (AI/Orchestr.)    │
        ├─────────────────┤          ├─────────────────────┤
        │ - Quotes        │          │ - RAG Pipeline      │
        │ - Saved Options │          │ - LLM Client        │
        │ - Booking       │          │ - Tool Registry     │
        │ - Auth (JWT)    │          │ - Advisors          │
        └────────┬────────┘          │ - Recommendations   │
                 │                   └──────────┬──────────┘
                 │                              │
        ┌────────▼──────────────────────────────▼────────┐
        │         SHARED SERVICES & DATA                 │
        │ - Supabase (Auth, DB)                          │
        │ - Vector Store (in-memory or external)         │
        │ - Document Repository (RAG source data)        │
        └──────────────────────────────────────────────┘
```

## Service Boundaries

### Spring Boot (Java API) — Source of Truth for Transactional Data

**Owns:**
- Quote generation and caching
- Saved shipping options
- Booking redirect tracking
- User authentication (JWT validation)
- Business transactions

**APIs:**
- `POST /api/v1/quotes` — Generate real quotes (calls carrier APIs)
- `GET /api/v1/saved-options` — User's saved shipping options
- `POST /api/v1/saved-options` — Save a shipping option
- `POST /api/v1/bookings/redirect` — Track booking redirect and generate carrier URL

**Responsibility:** All changes to user data, all billing-related operations, all carrier integrations.

---

### FastAPI (Python) — AI, Orchestration, and Advice

**Owns:**
- Document ingestion and RAG pipeline
- LLM interactions
- Tool registry and execution
- Advisor features (shipping advice, tracking guidance)
- Recommendations (advisory, not transactional)

**APIs:**
- `POST /api/v1/advisor/shipping` — Shipping advice (context + RAG + tools + LLM)
- `POST /api/v1/advisor/tracking` — Tracking guidance (context + RAG + LLM)
- `POST /api/v1/advisor/recommendation` — Service recommendations (scoring + explanations)
- `POST /api/v1/rag/query` — Direct RAG querying
- `POST /api/v1/rag/ingest` — Document ingestion
- `POST /api/v1/orchestration/run` — Tool orchestration
- `GET /api/v1/orchestration/tools` — Available tools

**Responsibility:** All AI-assisted features, knowledge retrieval, optional tool execution.

---

### Frontend (Vue/React) — User Interface

**Calls Java API for:**
- Generating real quotes
- Saving shipping options
- Booking redirects

**Calls Python API for:**
- Getting shipping advice
- Getting tracking guidance
- Getting recommendations
- Advanced help/advisory features

**Never calls directly:**
- Does NOT bypass Java to make transactional changes
- Does NOT directly modify user quotes or saved options
- Treats Python API responses as advisory only

---

## Integration Patterns

### Pattern 1: Direct Frontend → Java (Transactional)

**Use case:** Generate quotes, save options, create bookings

```
Frontend
  ↓ POST /api/v1/quotes (with origin, dest, weight)
Spring Boot API
  ↓ Calls carrier APIs
  ↑ Returns real quote options
Frontend
  ↓ Display quotes to user
```

**Who decides:** User + Java API (real carrier data)

---

### Pattern 2: Direct Frontend → Python (Advisory)

**Use case:** Get shipping advice, tracking guidance, recommendations

```
Frontend
  ↓ POST /api/v1/advisor/shipping (with query + optional context)
FastAPI
  ↓ Retrieves RAG context
  ↓ Optionally executes tools (validate address, quote preview)
  ↓ LLM generates reasoned advice
  ↑ Returns advice + sources + tools used
Frontend
  ↓ Display advice to user (labeled as advisory)
```

**Who decides:** LLM + RAG + Python logic

---

### Pattern 3: Frontend → Python → Java (Optional, Not Yet Implemented)

**Use case:** Recommendation should reference real quotes from Java

**Current state:** Python recommendation uses mock data only.

**Future state (Phase 11+):** If needed, Python can call Java API to:
1. Fetch real quote options
2. Enhance with recommendations
3. Return ranked options to frontend

**When to use:** Only if recommendations need to be based on live Java quotes.

**When NOT to use:** 
- For now, Python uses quote mock data and mock recommendations
- Frontend can call Java independently for real quotes
- Recommendations are advisory; Java quotes are transactional

---

## API Configuration

### Frontend (.env)

```bash
# Java API (transactional)
VITE_JAVA_API_BASE_URL=http://localhost:8080

# Python API (AI/advisory)
VITE_PYTHON_API_BASE_URL=http://localhost:8000

# Supabase (auth/DB)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Feature flags (Java API cutover)
VITE_USE_JAVA_QUOTES=true
VITE_USE_JAVA_SAVED_OPTIONS=true
VITE_USE_JAVA_BOOKING_REDIRECT=true
```

### Python (.env)

```bash
# Java API (optional, for future Python → Java calls)
INTERNAL_JAVA_API_URL=http://localhost:8080

# LLM Configuration
LLM_PROVIDER=openai          # or empty for EchoClient
OPENAI_API_KEY=xxx

# RAG
EMBEDDING_PROVIDER=           # empty for LocalHashEmbedding
RAG_DOCUMENTS_PATH=data/documents

# Shipping Provider
SHIPPING_PROVIDER=mock        # only mock for now
```

### Java (.env or Render settings)

```bash
# No Python dependency needed for transactional APIs
# Python is optional for AI features
# Could add INTERNAL_PYTHON_API_URL if Java needs to call Python (not implemented yet)
```

---

## User-Facing AI Features Now Available

### 1. Shipping Advisor (`POST /api/v1/advisor/shipping`)

**What it does:**
- Answers shipping-related questions
- Combines RAG knowledge + optional tools + LLM reasoning
- Examples:
  - "What carriers are available?"
  - "What's the best option for a 10 lb fragile package?"
  - "Is this address valid?"

**UI:** Dedicated advisor page with question input + advice output

**Advisory only:** Advice is informational; actual booking/payment happens via Java API

---

### 2. Tracking Guidance Assistant (`POST /api/v1/advisor/tracking`)

**What it does:**
- Provides guidance on delivery issues and tracking concerns
- Retrieves relevant RAG context
- Optionally validates addresses if provided
- Extracts and displays next steps

**UI:** Same advisor page, tracking tab

**Advisory only:** User can contact carrier directly based on guidance

---

### 3. Smart Quote Recommendation (`POST /api/v1/advisor/recommendation`)

**What it does:**
- Takes quote preview results
- Scores and classifies (cheapest/fastest/best_value/balanced)
- Recommends primary option + explains alternatives

**UI:** Recommendation display component (embedded or standalone)

**Integration point:** Can be shown alongside Java quotes or as a standalone comparison tool

**Advisory only:** User decides which service to book via Java quote/booking API

---

## Current Integration Status

### ✅ Implemented

- Frontend calls Java API for quotes/saved-options/booking (transactional)
- Frontend calls Python API for advisor features (advisory)
- Configuration supports both APIs via env vars
- Type-safe API service layer (`advisor-api.ts`)
- Advisor page component with shipping/tracking tabs
- Recommendation display component
- Error handling and loading states

### ⏳ Not Yet Implemented (Phase 11+)

- Real carrier provider integrations (still mock-based)
- Python → Java API calls for recommendation enhancement
- Multi-turn conversation support
- Caching for RAG and recommendation results
- Analytics/tracking of advisor usage
- Full-page recommendation flow with Java quote integration

### 🔒 By Design (Not Planned)

- Python never owns transactional quotes
- Java never calls Python for business logic
- Frontend is the integration point (calls both services)
- No hidden cross-service coupling

---

## Request/Response Flow Examples

### Example 1: User Asks for Shipping Advice

**Frontend:**
```typescript
const response = await advisorService.getShippingAdvice({
  query: "What's the best option for a fragile item from NY to LA?",
  context: {
    weight_lbs: 3,
    length_in: 12,
    width_in: 8,
    height_in: 6,
  },
});
```

**Python Service:**
1. Retrieves RAG context (carrier info, shipping policies)
2. Detects quote context → executes `get_quote_preview` tool
3. Builds LLM prompt with context + quote options
4. LLM generates advice considering fragility

**Response:**
```json
{
  "answer": "For a fragile item, Express (2 days, $19.99) offers a good balance. Overnight is safest but costly...",
  "reasoning_summary": "Based on fragility requirement and delivery timeline...",
  "tools_used": ["get_quote_preview"],
  "sources": [{source: "shipping-faq.md", chunk_index: 3, score: 0.89}],
  "context_used": true
}
```

**Frontend:**
Displays advice, highlights tool usage, links to sources

---

### Example 2: User Gets Recommendation

**Frontend:**
```typescript
// After Java API returns real quote options
const recommendation = await advisorService.getRecommendations({
  services: [
    {service: "Ground", price_usd: 9.99, estimated_days: 5},
    {service: "Express", price_usd: 19.99, estimated_days: 2},
    {service: "Overnight", price_usd: 49.99, estimated_days: 1},
  ],
  context: {fragile: true},
});
```

**Python Service:**
1. Scores each service (price + speed normalized)
2. Classifies based on type (cheapest/fastest/best_value)
3. Generates explanations aware of fragility context
4. Ranks by score

**Response:**
```json
{
  "primary_recommendation": {
    "service_name": "Express",
    "price_usd": 19.99,
    "estimated_days": 2,
    "recommendation_type": "best_value",
    "explanation": "Express costs $19.99 and takes 2 day(s) — good balance for fragile items...",
    "score": 1.15
  },
  "alternatives": [...],
  "summary": "Recommended: Express at $19.99..."
}
```

**Frontend:**
Displays recommendation with primary highlighted and alternatives shown

---

## Error Handling & Fallback Behavior

### Scenario: Python API Unavailable

**What happens:**
- Frontend shows error message "Unable to get advisor features"
- Transactional flows (Java quotes, booking) still work
- User can still complete transactions without recommendations

**User experience:** Graceful degradation; no lost functionality

---

### Scenario: LLM Not Configured

**What happens:**
- Python advisor endpoints still return responses
- Uses `EchoClient` which returns placeholder text
- Sources and tools still work

**User experience:** Advisor provides basic information without LLM reasoning

---

### Scenario: Tool Execution Fails

**What happens:**
- Advisor catches tool error and continues
- Still provides RAG-based response without tool result
- Response indicates tools_used: [] (empty)

**User experience:** Advice still available, just without tool data

---

## Limitations Before Deployment (Phase 11)

1. **Mock provider only** — Quote previews don't reflect real carrier pricing
2. **No real-time data** — Delivery windows based on static documents, not live carrier data
3. **LLM optional** — If not configured, advisors return generic responses
4. **No multi-turn** — Each advisor request is independent
5. **No integration caching** — Every request hits RAG and/or LLM
6. **No analytics** — No tracking of which advisor features are used
7. **Limited tools** — Only address validation and quote preview available
8. **No Python→Java integration** — Python recommends off mock data, not real quotes

---

## What Phase 11 (Pre-Deployment Validation) Will Cover

1. **Provider integration readiness** — Real carrier API configs or clear mock strategy
2. **Performance testing** — Load tests for advisor endpoints
3. **End-to-end validation** — Test full user flows (quote → recommendation → booking)
4. **Analytics setup** — Track advisor feature usage
5. **Error monitoring** — Production error handling for all service calls
6. **Documentation** — Release notes and advisor feature guide
7. **Rollout strategy** — Feature flags for advisor features (A/B testing)
8. **Fallback plans** — What happens if Python API goes down (during launch)

---

## Service Reliability Matrix

| Failure Scenario | Impact | Fallback |
|---|---|---|
| Java API down | Quotes, bookings unavailable | User sees error, can't proceed |
| Python API down | Advisors unavailable | Error message, transactional flows work |
| LLM unavailable | Advisor responses generic | EchoClient returns placeholder |
| Tool fails | Advisor loses tool data | Uses RAG only, still responds |
| RAG empty | No context for advisors | LLM works with minimal context |

**Conclusion:** Transactional flows are not dependent on Python; advisors are not dependent on Java. Graceful degradation by design.
