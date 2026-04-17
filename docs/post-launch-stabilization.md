# Post-Launch Stabilization

## Overview

This document covers what to verify, watch, and fix in the first days after deploying ShipSmart to production. The focus is operational confidence, not new features.

---

## First-Day Verification Checklist

### Service Health
- [ ] All three services show "Live" in Render dashboard
- [ ] `GET /api/v1/health` (Java) returns 200
- [ ] `GET /health` (Python) returns 200
- [ ] `GET /ready` (Python) returns 200
- [ ] Frontend loads without console errors

### Core Transactional Flows
- [ ] Quote comparison works end-to-end (origin -> destination -> packages -> results)
- [ ] Saved options: save, list, remove all work (requires auth)
- [ ] Booking redirect opens carrier page in new tab
- [ ] Feature flags are all set to `"true"` in Render

### AI/Advisory Flows
- [ ] Recommendation panel appears below quote results
- [ ] Shipping advisor returns answer with sources
- [ ] Tracking advisor returns guidance with next steps
- [ ] Recommendation scoring produces sensible primary pick

### Fallback Behavior
- [ ] If Python service is restarting (cold start), recommendation panel shows loading shimmer then appears
- [ ] If Python service is down, recommendation panel is hidden (no error visible to user)
- [ ] Advisor page shows "service unavailable" message if Python is down
- [ ] Quote flow, saved options, booking all work independently of Python

---

## Common Failure Modes to Watch

### 1. Cold Start Delays (Render Starter Plan)
**Symptom:** First request after ~15min idle takes 20-30 seconds.
**Impact:** Health check may timeout; first advisor/recommendation call is slow.
**Mitigation:** Add uptime monitor pinging `/health` every 10 minutes. Or upgrade plan.

### 2. CORS Errors
**Symptom:** Browser console shows "Access-Control-Allow-Origin" errors.
**Fix:** Verify `CORS_ALLOWED_ORIGINS` on both Java and Python matches the exact frontend URL (including `https://`).

### 3. RAG Returns No Sources
**Symptom:** Advisor response has `context_used: false` and empty `sources`.
**Cause:** Vector store was cleared on restart but documents not re-ingested.
**Fix:** Check that `data/documents/` directory exists in the deployed Python service. Verify startup logs show "RAG pipeline initialized".

### 4. EchoClient Responses
**Symptom:** Advisor answers start with "Based on available shipping information:" and feel like raw document excerpts.
**Cause:** No `OPENAI_API_KEY` configured — using EchoClient.
**Fix:** Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` in Render for real AI answers. EchoClient is functional but not production-quality advice.

### 5. Recommendation Always Picks Same Service
**Symptom:** Primary recommendation is always the cheapest or always the fastest.
**Cause:** Expected for homogeneous input. The scoring weights favor best_value (cheapest+fastest combined).
**Non-issue if:** Input services have genuinely different price/speed tradeoffs.

### 6. Feature Flag Rollback Not Taking Effect
**Symptom:** Changed flag to `"false"` but frontend still calls Java API.
**Cause:** `VITE_` vars are baked at build time. Must trigger a static site rebuild in Render after changing the env var.

---

## AI Quality Review

### Advisor Answer Quality (EchoClient mode)
- Responses are based on retrieved RAG document snippets
- Answers are factual but may feel raw — they echo document content, not AI-generated prose
- Sources listed are relevant (shipping FAQ, carrier info docs)
- **Upgrade path:** Set `LLM_PROVIDER=openai` for AI-generated answers

### Advisor Answer Quality (OpenAI mode)
- Responses should be concise, practical, and grounded in RAG context
- System prompts instruct the LLM to be honest about limitations
- Tool results (quote previews, address validation) are included in context
- Monitor for hallucination — the LLM should not invent carrier names or prices not in context

### Recommendation Quality
- Scoring is deterministic (no AI involved) — always reproducible
- Cheapest option gets `cheapest` badge, fastest gets `fastest` badge
- If one option is both cheapest AND fastest, it gets `best_value`
- Explanations now include type-specific context ("lowest price option", "fastest delivery", etc.)
- Summary correctly names the primary and top alternatives

### What Looks Wrong But Isn't
- **All services get the same score:** Happens when prices and days are identical. Expected.
- **Score > 1.0:** Possible for best_value type (uses 1.2x multiplier). Not a bug.
- **No next_steps in tracking guidance:** EchoClient doesn't produce numbered lists that the step extractor can parse. Expected without real LLM.

---

## Performance Sanity

### Expected Latencies (Warm Server)

| Endpoint | Expected | Concern If |
|----------|----------|------------|
| `GET /health` | < 10ms | > 500ms |
| `GET /ready` | < 10ms | > 500ms |
| Recommendation | < 50ms | > 200ms |
| Shipping advisor | < 500ms (EchoClient) | > 2000ms |
| Tracking advisor | < 400ms (EchoClient) | > 2000ms |
| Java health | < 50ms | > 500ms |

### Cold Start

| Service | Expected Cold Start |
|---------|-------------------|
| Java (Spring Boot) | 15-30s |
| Python (FastAPI) | 5-15s |
| Frontend (static) | N/A (CDN) |

### Cache Effectiveness
- **RAG cache** (TTL=120s): Identical queries within 2 minutes hit cache. Useful for repeated advisor questions.
- **Recommendation cache** (TTL=300s): Same service set within 5 minutes hits cache. Useful when user refreshes quotes.
- After restart, caches are empty — first requests are always cache misses.

### Running the Performance Check
```bash
# Against local
python scripts/perf_check.py

# Against production
python scripts/perf_check.py https://shipsmart-api-python.onrender.com https://shipsmart-api-java.onrender.com
```

---

## Stabilization Fixes Applied (Phase 13)

1. **Improved EchoClient responses** — Returns structured answer from RAG context instead of developer-facing "set LLM_PROVIDER" message
2. **Better recommendation explanations** — Type-specific wording ("lowest price option", "fastest delivery", "best combination of price and speed")
3. **Fixed scoring normalization** — Corrected price/days normalization to use `(max - min)` range instead of `max` alone
4. **Recommendation endpoint no longer requires RAG** — Works even if RAG pipeline failed to initialize
5. **Improved advisor error messages** — Distinguishes "service unavailable" from other errors in the UI
6. **Enhanced performance script** — Includes Java API check, response thresholds, both service URLs

---

## Manual Monitoring Checklist (First Week)

Daily for the first week:
- [ ] Check Render dashboard — all services "Live"
- [ ] Check Render logs for ERROR entries
- [ ] Try a quote search — verify results + recommendation panel
- [ ] Try advisor page — verify answer quality
- [ ] Check cold start behavior (access after idle period)

Weekly:
- [ ] Run performance check script against production
- [ ] Review Render logs for patterns (repeated errors, slow requests)
- [ ] Check if recommendation cache is being hit (look for "cache hit" in logs)
