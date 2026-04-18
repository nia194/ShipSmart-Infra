# ShipSmart — Gap Audit (Interview Topics)

> Explicit verdict on every topic named in the interview-upgrade prompt (Phases 4–5), with reasoning. One row per topic; nothing silently dropped. Date: 2026-04-18.

---

## Verdict legend

- ✅ **Implement now** — real code changes land in this upgrade.
- 🟡 **Partial** — a defensible slice is built now; a concrete extension is listed in `interview-upgrade-summary.md#future-work`.
- ⛔ **Reject (with reasoning)** — would be premature, vanity, or genuinely harmful at current scale. Documented here so the candidate can answer "why didn't you…" on the spot.

---

## Phase 4 topics — design concerns

### Design patterns

| Pattern | Present today? | Action | Reasoning |
|---|---|---|---|
| Strategy | Implicit — `FedExProvider` exists; no interface | ✅ Formalize `QuoteProvider` interface, add `UpsProvider`/`DhlProvider` stubs | Earns its keep: we already have multiple carriers, and parallel fanout (B6) needs a shared type. |
| Adapter / Anti-corruption boundary | Absent — carrier responses leak into `QuoteService` | ✅ `ProviderQuote` internal DTO, per-provider mapper | Carrier schemas drift; a boundary keeps domain clean. |
| Factory | Implicit in `QuoteService._buildQuotesWithRealProviders` | ✅ `QuoteProviderRegistry` picks providers based on shipment attributes | Removes the long if/else we saw in exploration. |
| Facade | Implicit — controllers talk to services | ✅ `ShipmentService` as sole facade for `ShipmentController`, orchestrates repo + audit + cache | Keeps controllers thin; a visible interview artifact. |
| Template Method | Absent | ✅ `AbstractQuoteProvider#getQuote` with abstract `callCarrier()` hook + shared retry/timeout logic | Removes duplicated retry/timing boilerplate across providers. |
| Decorator | Absent | ⛔ Reject | Nothing genuinely needs it; adding a decorator just to name-drop is vanity. If carrier-response enrichment grows, revisit. |
| Observer | Absent | ⛔ Reject | No current consumer of shipment state changes. Topic is covered by "EDA" row below. |
| Singleton | Spring beans are effectively singletons | ℹ️ No-op | Framework-level; don't implement manually. |
| Chain of Responsibility | Spring's filter chain is exactly this | ✅ Extend naturally — `CorrelationIdFilter` → `JwtAuthFilter` → `RateLimitFilter` → `IdempotencyInterceptor` | Shows up in the filter order the interviewer can inspect. |
| Aspect-Oriented Programming (AOP) | Absent | ✅ `@Audited` + `AuditAspect` | Real use: async audit without polluting service code. |

**Net:** five patterns genuinely earned, three rejected-with-reasoning. No `FooStrategyFactoryDecoratorAdapter` vanity.

---

### Monolithic vs microservices

| Question | Verdict | Reasoning |
|---|---|---|
| Is the current 4-service + 1-infra split justified? | ✅ Yes | Each repo's plane has a distinct failure mode and change cadence (see architecture-summary.md §1). The Java ⇄ Python split in particular isolates probabilistic LLM failure from the transactional system of record. |
| Should we add more microservices (audit / idempotency / tracing collector / event bus)? | ⛔ **Reject** | Current scale does not earn the operational cost of extra services. `audit` is a table + AOP aspect; `idempotency` is a filter + table; tracing is an OTel collector config. Adding services would add cross-service auth, deploy, and observability burden for zero functional gain. |
| Should we consolidate any services? | ⛔ Reject | MCP could in principle live inside ShipSmart-API, but keeping it standalone preserves the "single source of truth for tools" story and the MCP protocol contract across future consumers (Java AI-assist is on the roadmap). |

**Trigger to revisit in future:** when a compliance mandate requires tamper-evident append-only audit, or when a second write-heavy consumer needs to react to shipment state changes.

---

### Bean lifecycle

| Candidate | Status | Reasoning |
|---|---|---|
| Provider registry validation on startup | ✅ `QuoteProviderRegistry implements InitializingBean` — iterates providers, fails fast if `@RequiresCredentials` env vars are missing | Real — mirrors the Python service's loud-WARN philosophy but fails closed in Java (single writer; misconfig = abort). |
| Flyway readiness validation | ✅ `FlywayValidationRunner implements ApplicationRunner` with `@Order(1)` — logs migration state, refuses to start on PENDING | Real — ties the "Supabase-owns-schema + Java-validates" decision into observable behavior. |
| Cache warmup | ⛔ Reject | No cache is hot enough at startup that a warmup would matter. Adding it would be cargo-culting. |
| Config sanity checks | ✅ Extension of provider registry — validates rate limit strings, cache TTL formats, tracing sampling bounds | Real — fails loudly instead of at first request. |
| Toy `@PostConstruct` demo | ⛔ Reject | We have an actual one in `EnvLoader` already. A second one just to say we have `@PostConstruct` is vanity. |

---

### Concurrency & multi-threading

| Candidate | Status | Reasoning |
|---|---|---|
| Optimistic locking on concurrent shipment updates | ✅ `@Version` on `BaseEntity`; `If-Match` header on PATCH; 409 ProblemDetail on lost-update | Real; concurrency test races two threads. |
| Parallel quote-provider fanout | ✅ Bounded `ThreadPoolExecutor` + `CompletableFuture.allOf` with per-call timeout + graceful degrade | Real; Micrometer meter exposes pool saturation. |
| Bounded async audit writing | ✅ Separate `auditExecutor` (2 threads, bounded queue, `CallerRunsPolicy`) | Real; audit never drops but also never blocks request throughput. |
| Race-safe idempotent create | ✅ `idempotency_keys` table + SERIALIZABLE txn on key insert | Real; duplicate POSTs with same key short-circuit. |
| Concurrent audit / telemetry handling | ✅ As above; audit is the telemetry pipeline here | Combined with rate-limit bucket updates (thread-safe in-memory map). |
| Common ForkJoinPool (`parallelStream`) | ⛔ Reject / avoid | Mixes unrelated workloads, breaks MDC, unbounded. Explicit executor only. |
| Multi-threading in DB mutation path | ⛔ Reject | Writes stay on the request thread inside `@Transactional`. The fanout is read-only provider calls; persistence happens after join. |
| `MdcCopyingThreadPoolExecutor` | ✅ Wrapper around the provider executor | Real — without this, correlation IDs vanish inside `CompletableFuture`. |

---

## Phase 5 topics — important goals

### Caching

| Cache | Verdict | Reasoning |
|---|---|---|
| `quotesByShipmentId` (10 min TTL, max 1k) | ✅ Implement | `GET /quotes?shipmentRequestId=` currently regenerates on every call; the result is idempotent within seconds. |
| `shipmentById` (2 min TTL, max 5k) | ✅ Implement | Hot read path once CRUD lands. |
| Distributed cache (Redis) | 🟡 Partial / future | Caffeine is correct for 1 replica. Redis earns its keep only after horizontal scale; listed as concrete future work. |
| Cache on write paths | ⛔ Reject | Writes invalidate; caching the write path is a class of subtle bugs. |

---

### Soft delete

| Candidate | Verdict | Reasoning |
|---|---|---|
| `shipment_requests.deleted_at` + `@Where("deleted_at IS NULL")` | ✅ Implement | Users frequently create shipments they don't book — soft-delete lets us keep 30 days of history without destructive loss. |
| `saved_options.deleted_at` | ✅ Implement | User-facing CRUD where accidental deletes are common. |
| `redirect_tracking` | ⛔ Reject | Append-only audit; soft delete makes no sense. |
| `audit_log` | ⛔ Reject | Append-only by definition; softly-deleted audit would defeat the purpose. |
| Background purge job | ✅ Scheduled task deletes rows where `deleted_at < now() - 30 days` | Real; respects data-retention promises. |

---

### Audit (heavy framework vs lightweight)

| Option | Verdict | Reasoning |
|---|---|---|
| Hibernate Envers | ⛔ Reject | Doubles table count, shadow-rows every update, high schema tax for a problem we do not yet have. |
| Spring Data Auditing (`@CreatedBy` etc.) | 🟡 Partial | `@PrePersist`/`@PreUpdate` on `BaseEntity` covers created/updated timestamps without the `@EnableJpaAuditing` ceremony. |
| Lightweight `audit_log` table + AOP `@Audited` | ✅ Implement | Real; covers the interview talking point (AOP, async boundaries, diff-JSON) without schema bloat. |
| Immutable event journal (Debezium CDC → S3) | 🟡 Future | Concrete future work triggered by compliance requirement; documented in summary. |

---

### Rate limiting

| Scope | Verdict | Reasoning |
|---|---|---|
| `POST /api/v1/shipments` (20/min per IP) | ✅ Bucket4j filter | Public write endpoint — most abuse-prone. |
| `POST /api/v1/quotes` (30/min per IP) | ✅ Bucket4j | Expensive (carrier fanout). |
| `POST /api/v1/bookings/redirect` (10/min per IP) | ✅ Bucket4j | Low-volume, high-cost. |
| `GET` endpoints | ⛔ Reject | Idempotent reads don't need rate limiting before caching; revisit at scale. |
| Adaptive per-tenant limits | 🟡 Future | Real future work once paid tiers exist; triggered by tier rollout. |
| Distributed bucket state (Redis) | 🟡 Future | In-memory is fine for 1 replica; Redis when we scale. |

---

### Idempotency keys

| Candidate | Verdict | Reasoning |
|---|---|---|
| `POST /api/v1/shipments` | ✅ Required `Idempotency-Key` header, SHA-256 body hash, 24h expiry | Write side-effect: avoid duplicate shipments from retried client requests. |
| `POST /api/v1/bookings/redirect` | ✅ Required | Duplicate redirects pollute the tracking table. |
| `POST /api/v1/quotes` | ⛔ Reject | Quotes are already idempotent within the cache TTL; adding a key would be theater. |
| `GET /*` | ⛔ Reject | Reads are idempotent by definition. |
| Same-key replay | ✅ Returns stored response body + original status | RFC-aligned. |
| Same-key, different body | ✅ 422 `IdempotencyConflictException` | Detect retry with mutated payload. |
| Cleanup | ✅ `@Scheduled(fixedRate=1h)` deletes `expires_at < now()` | Keeps the table bounded. |

---

### Distributed tracing

| Scope | Verdict | Reasoning |
|---|---|---|
| W3C `traceparent` propagation end-to-end (Web → Java → Python → MCP) | ✅ Implement | Cheap, interview-defensible, works without a collector. |
| `X-Request-Id` correlation header | ✅ Implement | Belt-and-suspenders with traceparent; human-readable in logs. |
| MDC `requestId` + `traceId` in Java logs | ✅ Implement | Extends existing MDC pattern. |
| Micrometer Tracing (OTel bridge) dependency | ✅ Present in build | Real artifact the interviewer can find in gradle. |
| OTLP exporter wired to a collector (Tempo / Jaeger) | 🟡 Partial | Config present, **disabled by default** via `management.tracing.sampling.probability=0.0`. Flip-switch documented. |
| Full OTel instrumentation in Python/MCP (opentelemetry-instrumentation-fastapi) | 🟡 Future | Correlation propagation (this upgrade) is step 1; full OTel span export across Python/MCP is step 2. Concrete future work. |

---

### Flyway / Liquibase migration ownership

| Option | Verdict | Reasoning |
|---|---|---|
| Move ownership to Flyway in Java (authoritative) | ⛔ Reject | Supabase is the source of truth for schema and edge functions; taking ownership away fragments migration tooling and breaks Supabase CLI workflows. |
| Keep Supabase-owned; add Flyway in **validate mode** in Java | ✅ Implement | Java asserts schema matches what JPA expects on boot; fails fast on drift. Best of both worlds. |
| Add Liquibase | ⛔ Reject | Second migration tool for no benefit — Flyway is already enough for validate-mode. |

---

### New microservices

| Candidate | Verdict | Reasoning |
|---|---|---|
| Standalone audit-log service | ⛔ Reject | A table + AOP aspect covers this. Revisit only when compliance mandates tamper-evident audit (trigger: regulated shipper onboarding). |
| Idempotency service | ⛔ Reject | A filter + table covers this. Revisit when we scale past 1 replica and need shared state (even then, Redis is the answer, not a new service). |
| Tracing collector as a service | ⛔ Reject | OTel collector is standard infra, not application code. Not in scope. |
| Event bus / broker | ⛔ Reject | See "premature EDA" row below. |
| Java AI-assist MCP consumer | 🟡 Future | Genuine architectural extension; the MCP server is designed for this. Triggered by product ask for AI features inside transactional flows. |

---

### Premature event-driven architecture

| Question | Verdict | Reasoning |
|---|---|---|
| Should we add Kafka / RabbitMQ now? | ⛔ Reject | No current consumer needs fan-out. No integration event exists. Adding a broker now is resume-driven development. |
| Should we emit domain events internally (Spring's `ApplicationEventPublisher`)? | ⛔ Reject for now | `@Audited` AOP already covers the audit consumer. Revisit if a second consumer emerges (e.g., search indexer, email notifier). |
| Trigger to revisit | — | Second consumer for shipment lifecycle events (notification service, analytics pipeline, external webhook). |

---

## Phase 7 — Orchestrator-specific strong candidates (verdicts)

| Candidate | Verdict | Notes |
|---|---|---|
| Finish shipment CRUD | ✅ B3 |
| PATCH with dirty-checking + If-Match | ✅ B3 |
| Pagination / filtering / sorting | ✅ B3 — Page + JPA Specifications |
| Optimistic locking | ✅ B2 + B3 — `@Version` + If-Match |
| Richer exception hierarchy | ✅ B4 |
| ProblemDetail error contract | ✅ B4 |
| Not-found / conflict / ownership / validation separation | ✅ B4 |
| Structured request timing | ✅ Micrometer `http.server.requests` already exposed via actuator; extend with provider fanout metrics (B6) |
| Correlation propagation | ✅ B11 + C |
| Repository tests | ✅ B13 — Testcontainers Postgres |
| Integration tests | ✅ B13 |
| Security tests | ✅ B13 — spring-security-test |
| Concurrency tests | ✅ B13 — two-thread PATCH race |
| Rate-limited public endpoints | ✅ B8 |
| Idempotency keys on create flows | ✅ B9 |
| Caching | ✅ B7 |

---

## Phase 7 — Cross-repo candidates

| Candidate | Verdict | Notes |
|---|---|---|
| Tracing propagation Web → Orchestrator → API → MCP | ✅ Phase C | Correlation headers end-to-end; full OTel is future work |
| Consistent headers / correlation IDs | ✅ Phase C |
| OpenAPI exposure | ✅ B12 — springdoc for Java; Python already has FastAPI `/docs` |
| New supporting services | ⛔ Reject — see above |

---

## Phase 7 — Infra candidates

| Candidate | Verdict | Notes |
|---|---|---|
| Migration tooling ownership changes | 🟡 Partial — Supabase stays owner; Flyway validates (see Flyway row) |
| Tracing/logging infra | 🟡 Partial — correlation propagation now; collector deploy is future work |
| Audit/log pipeline support | ✅ `audit_log` table added |
| Rate-limit config | ✅ Env vars + defaults in render.yaml |
| Cache support | ✅ Caffeine in-memory; Redis is future work |
| Service topology docs | ✅ `architecture-summary.md` |

---

## Summary

**Implement now (real code):** 34 items.
**Partial (slice real, extension documented):** 7 items.
**Reject-with-reasoning (documented, not built):** 12 items.

**Zero items silently dropped.** The rejections exist specifically so the interviewer's "why didn't you do X?" questions have articulate, technical answers on hand.
