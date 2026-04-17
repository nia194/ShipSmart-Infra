# Backend Phase 1: Quote Endpoint

## What Was Implemented

Replaced the legacy Supabase edge function `get-shipping-quotes` with a Spring Boot endpoint in `apps/api-java`. This is a **parity replacement** — the Java endpoint produces the exact same deterministic mock quotes as the edge function.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Controller | `controller/QuoteController.java` | `POST /api/v1/quotes` endpoint |
| Service | `service/QuoteService.java` | Mock quote generation + shipment persistence |
| Entity | `domain/ShipmentRequest.java` | JPA entity for `shipment_requests` table |
| Repository | `repository/ShipmentRequestRepository.java` | Spring Data JPA repository |
| DTOs | `dto/QuoteRequest.java`, `QuoteResponse.java`, etc. | Request validation + response serialization |
| Tests | `test/.../service/QuoteServiceTest.java` | 7 unit tests covering structure, pricing, dates |

### Build Changes

- **Spring Boot**: Downgraded from 4.0.5 to **3.4.4** (stable, production-ready)
- **Java**: Changed from 25 (non-LTS) to **17+** (source/target compatibility)
- **Gradle**: Changed from 9.4.1 to **8.12** (compatible with Java 17+)
- **Added**: `spring-boot-starter-data-jpa`, `postgresql`, `h2` (test)

## Endpoint Details

### `POST /api/v1/quotes`

**Request:**
```json
{
  "origin": "New York, NY",
  "destination": "Los Angeles, CA",
  "dropOffDate": "2026-04-15",
  "expectedDeliveryDate": "2026-04-20",
  "packages": [
    {
      "type": "luggage",
      "qty": "1",
      "weight": "25",
      "l": "24",
      "w": "15",
      "h": "10",
      "handling": "standard"
    }
  ]
}
```

**Response:**
```json
{
  "prime": {
    "top": [
      {
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
        "details": { "Tracking": "UPS My Choice®", ... },
        "features": ["Tracking", "Access Point™"]
      }
    ],
    "more": [...]
  },
  "private": {
    "top": [...],
    "more": [...]
  }
}
```

**Validation:** All fields are required. Returns 400 Bad Request if any are missing.

### Quote Generation Logic

Exact parity with the edge function:

1. Calculate `totalWeight = sum(weight × qty)` across all packages
2. Price multiplier: `pm = clamp(totalWeight / 30, 0.8, 2.0)`
3. Generate 8 hardcoded carrier quotes with prices scaled by `pm`
4. Date formatting: `"EEE, MMM d"` in US locale (e.g., "Wed, Apr 22")

### Carriers Returned

| Section | Position | ID | Carrier |
|---------|----------|----|---------|
| prime.top | 0 | `ups-ground` | UPS Ground |
| prime.top | 1 | `fedex-express` | FedEx Express Saver |
| prime.top | 2 | `dhl-express` | DHL Express Worldwide |
| prime.more | 0 | `fedex-ground` | FedEx Ground |
| prime.more | 1 | `fedex-economy` | FedEx Ground Economy |
| private.top | 0 | `ll-std` | Lugless Standard |
| private.top | 1 | `lts-std` | LuggageToShip Standard |
| private.more | 0 | `lts-econ` | LuggageToShip Economy |

## Legacy Edge Function Mapping

| Legacy Edge Function | Java Replacement | Status |
|---------------------|-----------------|--------|
| `get-shipping-quotes` | `POST /api/v1/quotes` | **Replaced** |
| `save-option` | `POST /api/v1/quotes/saved` | TODO (Phase 2) |
| `get-saved-options` | `GET /api/v1/quotes/saved` | TODO (Phase 2) |
| `remove-saved-option` | `DELETE /api/v1/quotes/saved/{id}` | TODO (Phase 2) |
| `generate-book-redirect` | Not started | TODO (Phase 2) |

## Frontend Integration

A config flag controls which backend the frontend uses:

- **`VITE_USE_JAVA_QUOTES=true`** → calls `POST http://localhost:8080/api/v1/quotes`
- **Default (flag absent or false)** → calls legacy Supabase edge function

Files modified:
- `apps/web/src/config/api.ts` — added `useJavaQuotes` flag
- `apps/web/src/hooks/useShippingQuotes.ts` — branching logic for Java vs legacy

### Rollback

Set `VITE_USE_JAVA_QUOTES` to `false` or remove it. The legacy edge function remains untouched.

## Database

- **Persists to**: `shipment_requests` table (same as edge function)
- **Database URL**: Set `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` env vars
- **JPA mode**: `ddl-auto: validate` (schema managed by Supabase migrations)
- **Failure handling**: If DB is unreachable, quote generation still succeeds (persistence failure is logged, not thrown)

## Running Locally

```bash
# Set environment variables
export DATABASE_URL=jdbc:postgresql://your-supabase-host:5432/postgres
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=your-password

# Build and run
cd apps/api-java
export JAVA_HOME=/path/to/jdk-17+
./gradlew bootRun
```

Health check: `GET http://localhost:8080/api/v1/health`
Quote endpoint: `POST http://localhost:8080/api/v1/quotes`

## What Remains on Legacy Supabase

- `save-option` edge function (saved options CRUD)
- `get-saved-options` edge function
- `remove-saved-option` edge function
- `generate-book-redirect` edge function (booking redirect tracking)
- All auth/JWT handling (no Spring Security yet)

## Next Recommended Step: Backend Phase 2

1. **Migrate saved options** — `save-option`, `get-saved-options`, `remove-saved-option` to Java
2. **Migrate booking redirect** — `generate-book-redirect` to Java
3. **Add Spring Security** — Supabase JWT validation for authenticated endpoints
4. **Wire remaining JPA entities** — `SavedOption`, `RedirectTracking`, `Quote`

## TODO Markers in Code

- `QuoteController.java`: Auth/JWT extraction, saved option endpoints
- `QuoteService.java`: Future real carrier integrations, ranking improvements
- `application.yml`: Spring Security configuration
- `build.gradle`: Spring Security dependency
