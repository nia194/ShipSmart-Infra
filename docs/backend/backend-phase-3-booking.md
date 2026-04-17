# Backend Phase 3 — Booking Redirect

## Overview

Phase 3 migrates the last active Supabase edge function (`generate-book-redirect`) to
the Spring Boot Java API. After this phase, all active backend logic runs on Java.

## Endpoint

```
POST /api/v1/bookings/redirect
```

### Request

```json
{
  "serviceId": "ups-ground-123",
  "carrier": "UPS",
  "serviceName": "UPS® Ground",
  "redirectUrl": "https://ups.com/checkout/abc",
  "origin": "New York, NY",
  "destination": "Los Angeles, CA"
}
```

| Field         | Type   | Required | Notes                              |
|---------------|--------|----------|------------------------------------|
| serviceId     | string | yes      | Quote service identifier           |
| redirectUrl   | string | yes      | Carrier checkout URL (pass-through)|
| carrier       | string | no       | Defaults to empty string           |
| serviceName   | string | no       | Defaults to empty string           |
| origin        | string | no       | Shipment origin                    |
| destination   | string | no       | Shipment destination               |

### Response

```json
{
  "redirectUrl": "https://ups.com/checkout/abc"
}
```

### Error Responses

| Status | Meaning                        |
|--------|--------------------------------|
| 400    | Missing required fields        |
| 500    | Unexpected server error        |

## Redirect Logic

The redirect URL is **not generated server-side**. The frontend already knows the carrier
checkout URL and sends it in the request. The backend:

1. Persists the redirect event for tracking/analytics
2. Returns the same `redirectUrl` back to the frontend

This matches the legacy edge function behavior exactly.

## Persistence

**Yes — tracking records are persisted** to the existing `redirect_tracking` table.

| Column       | Type         | Notes                                |
|--------------|--------------|--------------------------------------|
| id           | UUID (PK)    | Auto-generated                       |
| user_id      | UUID         | Nullable — set from JWT if present   |
| service_id   | TEXT         | Quote service identifier             |
| carrier      | TEXT         | Carrier name                         |
| service_name | TEXT         | Service display name                 |
| redirect_url | TEXT         | Carrier checkout URL                 |
| origin       | TEXT         | Nullable                             |
| destination  | TEXT         | Nullable                             |
| created_at   | TIMESTAMPTZ  | Auto-set by database                 |

No new migration is needed — the table already exists from the original Supabase schema.

## Authentication

- Uses the existing `JwtAuthFilter` from Phase 2
- Authentication is **optional** (matches legacy behavior)
- If a valid JWT is present, the `userId` is extracted and attached to the tracking record
- Anonymous users can also trigger booking redirects (userId will be null)

## How It Replaces the Edge Function

| Aspect            | Legacy (Supabase)              | New (Java API)                    |
|-------------------|-------------------------------|-----------------------------------|
| Endpoint          | `generate-book-redirect`       | `POST /api/v1/bookings/redirect`  |
| Auth              | Supabase auth.getUser()        | JwtAuthFilter (same JWT)          |
| Persistence       | Supabase client insert         | JPA repository save               |
| Response          | `{ redirectUrl }`              | `{ redirectUrl }` (identical)     |
| Error handling    | try/catch → 400/500            | Validation + try/catch → 400/500  |

## Frontend Integration

Toggle via feature flag in `apps/web/.env.local`:

```
VITE_USE_JAVA_BOOKING_REDIRECT=true
```

The `QuoteRow.tsx` component checks `apiConfig.useJavaBookingRedirect`:
- `true` → calls `POST /api/v1/bookings/redirect` via fetch
- `false` (default) → calls the legacy Supabase edge function

Rollback: set the flag to `false` or remove it.

## Files Created/Modified

### Backend (apps/api-java)
- `domain/RedirectTracking.java` — JPA entity
- `dto/BookingRedirectRequest.java` — request DTO
- `dto/BookingRedirectResponse.java` — response DTO
- `repository/RedirectTrackingRepository.java` — JPA repository
- `service/BookingService.java` — business logic
- `controller/BookingController.java` — REST controller
- `service/BookingServiceTest.java` — unit tests

### Frontend (apps/web)
- `config/api.ts` — added feature flag + path helper
- `components/shipping/QuoteRow.tsx` — toggle between Supabase and Java API
- `.env.example` — documented feature flags

## What's Still Remaining

The following Supabase edge functions are **placeholder stubs** for future AI/MCP features
and are NOT part of this migration:

1. generate-ai-insights
2. generate-customs-docs
3. generate-insurance-recommendation
4. generate-packing-advice
5. mcp-carrier-negotiation
6. mcp-customs-regulations
7. mcp-market-intelligence
8. mcp-route-optimization
9. mcp-weather-impact

These will be addressed in a future AI integration phase.

## Readiness for Backend Hardening

With Phase 3 complete, all active backend logic is now on Spring Boot:
- Phase 1: Quote generation (`POST /api/v1/quotes`)
- Phase 2: Saved options (CRUD)
- Phase 3: Booking redirect tracking

The backend is ready for hardening work: rate limiting, input validation hardening,
monitoring/alerting, and production deployment configuration.
