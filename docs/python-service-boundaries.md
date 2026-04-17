# Service Boundaries — Java vs Python

## Principle

ShipSmart uses a two-backend architecture:
- **Java (Spring Boot)** — system of record for all transactional data
- **Python (FastAPI)** — AI, orchestration, and intelligence layer

Neither service writes to the other's domain directly.

## Java Backend Owns

| Responsibility | Endpoint |
|---------------|----------|
| Quote generation | `POST /api/v1/quotes` |
| Saved options (CRUD) | `GET/POST/DELETE /api/v1/saved-options` |
| Booking redirect tracking | `POST /api/v1/bookings/redirect` |
| User authentication (JWT) | Via Spring Security + Supabase JWT |
| Shipment records (future) | `/api/v1/shipments` |
| All database writes | Direct JPA access to Supabase Postgres |

## Python Backend Owns

| Responsibility | Status |
|---------------|--------|
| AI shipping advisor | Planned |
| AI tracking advisor | Planned |
| RAG-powered recommendations | Planned |
| LLM-based document generation | Planned |
| MCP/tool orchestration | Planned |
| Vector search / embeddings | Planned |

## Communication Pattern

```
Frontend  →  Java API  (transactional operations)
Frontend  →  Python API  (AI/orchestration — not connected yet)
Python API  →  Java API  (when Python needs transactional data)
```

Python calls Java via `INTERNAL_JAVA_API_URL` using a shared `httpx.AsyncClient`.
Java calls Python via `INTERNAL_PYTHON_API_URL` (not active yet).

## What Should NOT Go in Python

- Quote generation logic
- Saved option CRUD
- Booking redirect tracking
- JWT authentication/verification
- Direct database writes to shipment/quote/option tables
- Any endpoint that the frontend currently calls via Java

## What Should NOT Go in Java

- LLM API calls
- Vector embedding generation
- RAG pipeline execution
- AI-powered content generation
- MCP tool orchestration

## Database Access

- Java: direct JPA access to Supabase Postgres (system of record)
- Python: reads via Java API, or direct read-only access for analytics (future)
- Supabase Auth: managed by Supabase, JWTs verified by Java

## When Python Needs Data

Python should call the Java API's internal endpoints, not query the database directly.
This keeps the data ownership boundary clean and avoids schema coupling.

Example: if the AI advisor needs shipment history, it calls `GET /api/v1/shipments`
on the Java API rather than querying the `shipments` table directly.
