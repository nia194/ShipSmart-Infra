# Deployment & Cutover Plan

## Overview

This document covers deploying ShipSmart to Render and cutting over from legacy
Supabase edge functions to the Spring Boot Java backend as the primary backend.

## Pre-Deployment Checklist

- [ ] Supabase project is active with database containing all migrations
- [ ] `gradle wrapper` JAR is committed (`apps/api-java/gradle/wrapper/gradle-wrapper.jar`)
- [ ] All `[PLACEHOLDER]` values in `render.yaml` are replaced with real service names
- [ ] Supabase secrets are ready: URL, anon key, service role key, JWT secret, DB credentials

## Deployment Order

### 1. Deploy api-java (Spring Boot) first

**Why first:** The frontend feature flags default to `false` (legacy Supabase), so the Java
backend can be deployed and health-checked independently before any traffic is routed to it.

**Steps:**
1. Push to GitHub / trigger Render deploy
2. Set all env vars in Render dashboard (see production-env-matrix.md)
3. Wait for health check to pass: `GET /api/v1/health` → 200
4. Verify: `POST /api/v1/quotes` returns quotes (public endpoint, no auth needed)
5. Verify: `GET /api/v1/saved-options` returns 401 without token

### 2. Deploy web (React) second

**Steps:**
1. Set Supabase env vars + `VITE_JAVA_API_BASE_URL`
2. Initially deploy with all feature flags set to `"false"` (Supabase legacy)
3. Verify the app loads and works with legacy Supabase edge functions
4. Enable one flag at a time:
   - `VITE_USE_JAVA_QUOTES=true` → test quote flow
   - `VITE_USE_JAVA_SAVED_OPTIONS=true` → test save/remove flow
   - `VITE_USE_JAVA_BOOKING_REDIRECT=true` → test booking click tracking
5. After all three pass, leave all flags at `"true"`

### 3. Deploy api-python

The FastAPI service provides AI/advisory features: shipping advisor, tracking
guidance, and quote recommendations. Deploy after Java API is healthy.

1. Set env vars per `docs/production-env-reference.md`
2. Wait for health check: `GET /health` -> 200
3. Verify: `POST /api/v1/advisor/recommendation` returns scored results
4. Frontend recommendation panel should now appear after quotes load

**If Python fails:** Frontend degrades gracefully — recommendation panel
is hidden and core quote/booking flow continues to work.

## Feature Flag Cutover Strategy

### Flag Values by Environment

| Flag | Local Dev | Staging | Production |
|------|-----------|---------|------------|
| `VITE_USE_JAVA_QUOTES` | `false`* | `true` | `true` |
| `VITE_USE_JAVA_SAVED_OPTIONS` | `false`* | `true` | `true` |
| `VITE_USE_JAVA_BOOKING_REDIRECT` | `false`* | `true` | `true` |

*Local dev defaults to `false` unless the Java backend is running locally.

### Why Keep Flags (Not Remove Them)

1. **Safe rollback** — set any flag to `"false"` in Render to instantly revert to Supabase
2. **Independent rollback** — each feature can be rolled back independently
3. **No code deploy needed** — flag change is an env var update + static site rebuild
4. **Supabase edge functions remain deployed** as fallback until flags are removed in a future cleanup phase

### When to Remove Flags

Remove feature flags and legacy Supabase code paths only after:
- Production has run on Java backend for at least 2 weeks
- No rollbacks have been needed
- Legacy edge function usage is confirmed at zero

## Rollback Plan

### Scenario: Java backend is down or returning errors

**Immediate fix (< 1 minute):**
1. Go to Render dashboard → shipsmart-web → Environment
2. Set the affected flag(s) to `"false"`:
   - `VITE_USE_JAVA_QUOTES=false`
   - `VITE_USE_JAVA_SAVED_OPTIONS=false`
   - `VITE_USE_JAVA_BOOKING_REDIRECT=false`
3. Trigger a manual deploy (Render rebuilds the static site with new env vars)
4. Traffic returns to Supabase edge functions immediately

**Cost of rollback:** Static site rebuild takes ~1-2 minutes. No backend deploy needed.

### Scenario: Data inconsistency between Supabase and Java

Both Supabase edge functions and the Java backend write to the same Postgres database.
There is no data migration concern — they share the same tables.

### Scenario: Need to fully revert to pre-migration state

1. Set all three feature flags to `"false"`
2. Optionally stop the Java backend service in Render
3. The app operates entirely through Supabase edge functions again

## Post-Cutover Monitoring

After enabling all flags in production:

1. Monitor Render logs for Java API errors
2. Check `/actuator/health` endpoint
3. Watch for 401/403 errors in browser console (CORS or auth issues)
4. Verify saved options persist and load correctly across sessions
5. Verify booking redirect tracking records appear in `redirect_tracking` table
