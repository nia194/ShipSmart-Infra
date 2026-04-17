# Backend Phase 2: Saved Options + Authentication

## What Was Implemented

Replaced the three Supabase edge functions for saved options (`save-option`, `get-saved-options`, `remove-saved-option`) with Spring Boot endpoints. Added lightweight JWT authentication for user-scoped data.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| JWT Auth Filter | `auth/JwtAuthFilter.java` | Extracts userId from Supabase JWT |
| Auth Helper | `auth/AuthHelper.java` | Controller utility to get userId |
| Controller | `controller/SavedOptionController.java` | GET/POST/DELETE `/api/v1/saved-options` |
| Service | `service/SavedOptionService.java` | CRUD logic, response mapping |
| Entity | `domain/SavedOption.java` | JPA entity for `saved_options` table |
| Repository | `repository/SavedOptionRepository.java` | User-scoped queries |
| DTOs | `dto/SaveOptionRequest.java`, `SavedOptionResponse.java` | Request validation + response |
| Tests | `test/.../SavedOptionServiceTest.java` | 7 unit tests |

### Also Modified

- `QuoteController.java` — removed Phase 2 stubs, wired auth for optional userId extraction
- `build.gradle` — added JJWT dependency (io.jsonwebtoken)
- `api.ts` — added `useJavaSavedOptions` flag and `savedOptions` path
- `useSavedOptions.ts` — toggle between Supabase and Java API

## Endpoints

### `GET /api/v1/saved-options`
Returns all saved options for the authenticated user, newest first.

**Headers:** `Authorization: Bearer <supabase-jwt>`

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "svcId": "ups-ground",
    "svc": {
      "id": "ups-ground",
      "carrier": "UPS",
      "name": "UPS® Ground",
      "tier": "STANDARD",
      "price": 47.12,
      "originalPrice": null,
      "transitDays": 7,
      "date": "Wed, Apr 22",
      "deliverBy": null,
      "guaranteed": false,
      "promo": null,
      "ai": "Best value. 98.2% on-time.",
      "breakdown": { "shipping": [...], "pickup": [...] },
      "details": { "Tracking": "UPS My Choice®" },
      "features": ["Tracking", "Access Point™"]
    },
    "origin": "New York, NY",
    "dest": "Los Angeles, CA",
    "dropDate": "2026-04-15",
    "delivDate": "2026-04-22",
    "pkgSummary": "1x Luggage (25 lbs)",
    "bookUrl": "https://www.ups.com/...",
    "savedAt": "Apr 5, 2026"
  }
]
```

**Errors:** 401 if no/invalid JWT.

### `POST /api/v1/saved-options`
Saves a shipping option for the authenticated user.

**Headers:** `Authorization: Bearer <supabase-jwt>`

**Request:**
```json
{
  "quoteServiceId": "ups-ground",
  "carrier": "UPS",
  "serviceName": "UPS® Ground",
  "origin": "New York, NY",
  "destination": "Los Angeles, CA",
  "tier": "STANDARD",
  "price": 47.12,
  "originalPrice": null,
  "transitDays": 7,
  "estimatedDelivery": "Wed, Apr 22",
  "deliverByTime": null,
  "guaranteed": false,
  "promo": null,
  "aiRecommendation": "Best value.",
  "breakdown": { "shipping": [...], "pickup": [...] },
  "details": { "Tracking": "UPS My Choice®" },
  "features": ["Tracking"],
  "dropOffDate": "2026-04-15",
  "expectedDeliveryDate": "2026-04-22",
  "packageSummary": "1x Luggage (25 lbs)",
  "bookUrl": "https://www.ups.com/..."
}
```

**Required fields:** `quoteServiceId`, `carrier`, `serviceName`, `origin`, `destination`

**Response (200):** Same shape as GET item above.

**Errors:** 401 if no auth, 400 if missing required fields.

### `DELETE /api/v1/saved-options/{id}`
Removes a saved option. User must own the option.

**Headers:** `Authorization: Bearer <supabase-jwt>`

**Response (200):** `{ "success": true }`

**Errors:** 401 if no auth, 404 if not found or not owned by user.

## Database Schema

Uses the existing `saved_options` table (no migration needed):

```
saved_options
├── id                    UUID PK (auto-generated)
├── user_id               UUID NOT NULL → auth.users(id)
├── quote_service_id      TEXT NOT NULL
├── carrier               TEXT NOT NULL
├── service_name          TEXT NOT NULL
├── tier                  TEXT NOT NULL
├── price                 NUMERIC NOT NULL
├── original_price        NUMERIC
├── transit_days          INTEGER NOT NULL
├── estimated_delivery    TEXT
├── deliver_by_time       TEXT
├── guaranteed            BOOLEAN
├── promo                 JSONB
├── ai_recommendation     TEXT
├── breakdown             JSONB
├── details               JSONB
├── features              TEXT[]
├── origin                TEXT NOT NULL
├── destination           TEXT NOT NULL
├── drop_off_date         TEXT
├── expected_delivery_date TEXT
├── package_summary       TEXT
├── book_url              TEXT
└── created_at            TIMESTAMPTZ (auto)
```

## Authentication Approach

**Lightweight JWT filter** — no Spring Security framework involved.

1. `JwtAuthFilter` (servlet filter) intercepts all requests
2. If `Authorization: Bearer <token>` header is present:
   - With `SUPABASE_JWT_SECRET` set: validates JWT signature via HMAC-SHA, extracts `sub` claim
   - Without secret (dev mode): decodes JWT payload without verification, extracts `sub`
3. Stores userId as request attribute `shipsmart.userId`
4. `AuthHelper.getUserId(request)` extracts it in controllers
5. Endpoints that require auth return 401 if userId is absent
6. `POST /api/v1/quotes` uses auth optionally (anonymous quotes still work)

**Dependencies added:** `io.jsonwebtoken:jjwt-api:0.12.6` + impl + jackson modules

## Frontend Integration

Two new flags control the backend:

| Flag | Default | Effect |
|------|---------|--------|
| `VITE_USE_JAVA_QUOTES` | `false` | Switches quote generation to Java API |
| `VITE_USE_JAVA_SAVED_OPTIONS` | `false` | Switches saved options to Java API |

The `useSavedOptions` hook:
- Sends `Authorization: Bearer <token>` from `supabase.auth.getSession()` when calling Java API
- Falls back to legacy Supabase edge functions when flag is off
- Same user-facing behavior either way

## Legacy Edge Function Mapping

| Legacy Edge Function | Java Replacement | Status |
|---------------------|-----------------|--------|
| `get-shipping-quotes` | `POST /api/v1/quotes` | **Replaced (Phase 1)** |
| `save-option` | `POST /api/v1/saved-options` | **Replaced** |
| `get-saved-options` | `GET /api/v1/saved-options` | **Replaced** |
| `remove-saved-option` | `DELETE /api/v1/saved-options/{id}` | **Replaced** |
| `generate-book-redirect` | Not started | TODO (Phase 3) |

## What Remains Legacy

- `generate-book-redirect` edge function (booking redirect tracking)
- Supabase Auth itself (login, signup, session management) — still handled by Supabase client SDK
- RLS policies on Supabase tables (still enforced when using Supabase directly)

## Test Results

- **QuoteServiceTest**: 7 tests, 0 failures
- **SavedOptionServiceTest**: 7 tests, 0 failures (save, defaults, list, empty list, delete owned, delete not-owned, delete not-found)
- **Build**: SUCCESS

## Recommended Next Steps: Phase 3

1. **Migrate booking redirect** — `generate-book-redirect` to `POST /api/v1/redirects`
2. **Add integration tests** — test controller layer with MockMvc + H2
3. **Harden JWT validation** — always require `SUPABASE_JWT_SECRET` in production profile
4. **Wire quote endpoint auth** — pass JWT from frontend `useShippingQuotes` hook too
