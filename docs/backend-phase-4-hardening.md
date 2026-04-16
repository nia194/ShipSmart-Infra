# Backend Phase 4 — Hardening

## Overview

Phase 4 upgrades the backend from "working" to "production-grade" without changing
business logic or breaking API contracts. All existing feature flags remain functional.

## Changes Summary

### 1. Spring Security

Replaced the custom `JwtAuthFilter` (servlet filter) with proper Spring Security:

- **SecurityConfig.java** — `SecurityFilterChain` with stateless sessions, CSRF disabled
- **JwtAuthFilter** — converted from `Filter` to `OncePerRequestFilter`, populates `SecurityContextHolder`
- **AuthHelper** — reads from `SecurityContextHolder` instead of request attributes

**Authorization rules:**

| Path | Access |
|------|--------|
| `/api/v1/health` | Public |
| `/api/v1/quotes/**` | Public (optional auth) |
| `/api/v1/bookings/**` | Public (optional auth) |
| `/actuator/**` | Public |
| `/api/v1/saved-options/**` | Authenticated |
| `/api/v1/shipments/**` | Authenticated |
| All other paths | Denied |

**Security headers** (set by Spring Security):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-cache, no-store`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`

### 2. Input Validation

Enhanced Bean Validation constraints on request DTOs:

- **BookingRedirectRequest**: `@Size` constraints on all string fields
- **SaveOptionRequest**: `@Size` on strings, `@Positive` on price/originalPrice, `@PositiveOrZero` on transitDays

### 3. Global Error Handling

New `GlobalExceptionHandler` (`@RestControllerAdvice`) provides standardized error responses:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "serviceId: must not be blank; redirectUrl: must not be blank",
  "path": "/api/v1/bookings/redirect",
  "timestamp": "2026-04-06T..."
}
```

Handles: validation errors (400), malformed JSON (400), illegal arguments (400), unexpected errors (500).

### 4. Structured Logging

- Controller-level `log.info()` on all endpoints with key parameters
- **RequestId** via MDC — unique 8-char ID per request
- Log pattern includes `[requestId]` for request correlation
- Sensitive data (tokens, emails) is NOT logged

### 5. Configuration Hardening

- **application-local.yml** — dev profile, JWT secret optional, DEBUG logging
- **application-production.yml** — prod profile, JWT secret required, stack traces hidden
- `shipsmart.security.require-jwt-secret` — `@PostConstruct` check fails app startup if secret missing in production
- Removed inline profile blocks from `application.yml`

### 6. Controller Tests (MockMvc)

New `@WebMvcTest` tests:

- **SavedOptionControllerTest**: 401 unauthenticated, 200 list/save/delete, 400 invalid body
- **BookingControllerTest**: 200 unauthenticated (permitAll), 200 authenticated, 400 invalid body

## Files Created

| File | Purpose |
|------|---------|
| `config/SecurityConfig.java` | Spring Security filter chain |
| `exception/GlobalExceptionHandler.java` | Centralized error handling |
| `application-local.yml` | Dev profile config |
| `application-production.yml` | Prod profile config |
| `controller/SavedOptionControllerTest.java` | MockMvc tests |
| `controller/BookingControllerTest.java` | MockMvc tests |
| `test/resources/application-test.yml` | Test config |

## Files Modified

| File | Change |
|------|--------|
| `build.gradle` | Added spring-boot-starter-security, spring-security-test |
| `auth/JwtAuthFilter.java` | OncePerRequestFilter + SecurityContext + MDC |
| `auth/AuthHelper.java` | SecurityContextHolder instead of request attributes |
| `controller/QuoteController.java` | Removed HttpServletRequest, added logging |
| `controller/SavedOptionController.java` | Removed manual 401 handling, added logging |
| `controller/BookingController.java` | Removed try/catch, added logging |
| `dto/BookingRedirectRequest.java` | Added @Size constraints |
| `dto/SaveOptionRequest.java` | Added @Size/@Positive constraints |
| `application.yml` | Removed inline profiles, added requestId log pattern |

## Breaking Changes

**None.** All API contracts are identical. Frontend feature flags work unchanged.

## Production Readiness Assessment

| Area | Status |
|------|--------|
| Authentication | Spring Security with JWT |
| Authorization | Path-based rules in SecurityFilterChain |
| Input validation | Bean Validation on all request DTOs |
| Error handling | Standardized JSON via @ControllerAdvice |
| Logging | Structured with requestId correlation |
| Security headers | X-Frame-Options, CSP, nosniff |
| Configuration | Profile-based, fail-fast in prod |
| CORS | Configured per environment |
| Tests | Service + controller coverage |

## Remaining Gaps

1. **Rate limiting** — not implemented (consider Spring Cloud Gateway or bucket4j)
2. **HTTPS enforcement** — handled at infrastructure level (Render)
3. **API versioning strategy** — currently `/api/v1/` only
4. **Metrics/APM** — Actuator health/info only; consider Micrometer + Prometheus
5. **Database connection pooling tuning** — currently 5 max connections
6. **CI/CD pipeline** — tests not yet integrated into GitHub Actions
