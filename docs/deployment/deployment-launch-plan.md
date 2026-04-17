# Deployment & Launch Plan

## Overview

First full deployment of ShipSmart with all three services:
- **web** — React frontend (Static Site)
- **api-java** — Spring Boot transactional backend (Web Service)
- **api-python** — FastAPI AI/advisory backend (Web Service)

## Pre-Deployment Checklist

- [ ] `render.yaml` reviewed — service names, rootDir, build/start commands correct
- [ ] Gradle wrapper JAR committed: `apps/api-java/gradle/wrapper/gradle-wrapper.jar`
- [ ] Python `uv.lock` committed: `apps/api-python/uv.lock`
- [ ] RAG documents committed: `apps/api-python/data/documents/`
- [ ] All code pushed to GitHub on target branch
- [ ] Supabase credentials ready (URL, anon key, service role key, JWT secret, DB creds)

## Deployment Order

### Step 1: Deploy api-java

**Why first:** Java owns transactional flows. Frontend feature flags default to legacy Supabase, so Java can be verified independently.

1. Push code to GitHub
2. Create Blueprint on Render from `render.yaml` (or trigger deploy)
3. Set secrets in Render dashboard:
   - `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
4. Wait for build + health check: `GET /api/v1/health` -> 200
5. Verify: `POST /api/v1/quotes` returns results

### Step 2: Deploy api-python

**Why second:** Python is independent — frontend degrades gracefully if Python is unavailable.

1. Set env vars in Render (all have defaults, only `CORS_ALLOWED_ORIGINS` needs a value)
2. Optionally set `OPENAI_API_KEY` + `LLM_PROVIDER=openai` for real AI (not required)
3. Wait for build + health check: `GET /health` -> 200
4. Verify: `POST /api/v1/advisor/recommendation` with test payload returns results

### Step 3: Deploy web

**Why last:** Frontend calls both backends — deploy after both are healthy.

1. Set env vars:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_JAVA_API_BASE_URL` (auto-set in render.yaml)
   - `VITE_PYTHON_API_BASE_URL` (auto-set in render.yaml)
2. Initially set all Java feature flags to `"true"` (Java backend is ready)
3. Wait for static site build + CDN deploy
4. Open the app — verify it loads

### Step 4: Smoke Tests

Run the checklist in `docs/launch-smoke-tests.md`.

## Build & Start Commands

| Service | Build | Start |
|---------|-------|-------|
| web | `cd ../.. && pnpm install --frozen-lockfile && cd apps/web && pnpm build` | (static CDN) |
| api-java | `./gradlew build -x test` | `java -jar build/libs/shipsmart-api-java-0.1.0-SNAPSHOT.jar` |
| api-python | `pip install uv && uv sync` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

## Health Check Endpoints

| Service | Path | Expected |
|---------|------|----------|
| api-java | `GET /api/v1/health` | 200 `{"status":"ok"}` |
| api-python | `GET /health` | 200 `{"status":"ok","service":"shipsmart-api-python",...}` |
| api-python | `GET /ready` | 200 `{"status":"ready"}` |
| web | Root URL | 200 (HTML page loads) |

## Rollback Strategy

### If api-python fails:

**Impact:** Recommendation panel and advisor pages won't work. Core quote/booking flow is unaffected.

**Action:** No action required. Frontend `useRecommendation` hook fails silently — recommendation panel is simply hidden. Advisor page shows error message.

**If needed:** Stop the Python service in Render. Frontend continues working without it.

### If api-java fails:

**Impact:** Quote flow, saved options, and booking redirect break.

**Immediate fix (< 2 min):**
1. In Render dashboard -> shipsmart-web -> Environment
2. Set all three flags to `"false"`:
   - `VITE_USE_JAVA_QUOTES=false`
   - `VITE_USE_JAVA_SAVED_OPTIONS=false`
   - `VITE_USE_JAVA_BOOKING_REDIRECT=false`
3. Trigger manual deploy (static site rebuild)
4. Traffic routes to legacy Supabase edge functions

### If advisor endpoints fail:

**Impact:** Advisor page returns errors. Recommendation panel hidden.

**Action:** Restart the Python service. If persistent, check logs for RAG ingestion or LLM client errors. Core functionality (quotes, booking) is unaffected.

### If recommendation flow fails:

**Impact:** Recommendation panel doesn't appear after quotes.

**Action:** Non-blocking. Panel is hidden on failure. Investigate Python API logs.

### Full rollback to pre-migration state:

1. Set all three Java feature flags to `"false"`
2. Optionally stop api-java and api-python services
3. App operates entirely through Supabase edge functions

## Cold Start Behavior

Render Starter plan services sleep after 15 minutes of inactivity. First request after sleep takes ~30s.

**Mitigations:**
- Health check endpoints respond fast even on cold start
- Frontend shows loading states during slow responses
- Consider adding an uptime monitor pinging `/api/v1/health` (Java) and `/health` (Python)

## Known Launch Limitations

1. **Mock shipping provider** — Python API returns synthetic shipping data, not real carrier rates
2. **Local hash embeddings** — RAG uses placeholder embeddings; set `EMBEDDING_PROVIDER=openai` for production quality
3. **EchoClient LLM** — Without `LLM_PROVIDER=openai`, advisor returns formatted context, not AI-generated answers
4. **In-memory vector store** — RAG data is re-ingested on each restart (fast — 2 seed documents)
5. **In-memory cache** — Cleared on restart. TTLs keep data fresh during runtime.
6. **No CI/CD pipeline** — Manual deploys via Render dashboard or git push

## What Phase 13 Will Cover

- Post-launch monitoring and stability
- Error rate tracking
- Performance baseline establishment
- OpenAI integration if API key is configured
- Cache effectiveness review
- User feedback incorporation
