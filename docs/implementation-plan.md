# ShipSmart — Implementation Plan (Interview Upgrade)

> Condensed, executable version of the full plan. Companion to `architecture-summary.md` (current truth) and `gap-audit.md` (verdicts). Scope: Java-heavy upgrade of Orchestrator + minimal cross-repo thin slice. Date: 2026-04-18.

---

## Delivery phases

```
Phase A  ─►  Phase B (Orchestrator, 13 slices)  ─►  Phase C (cross-repo)  ─►  Phase D
docs       build · schema · CRUD · errors ·          Web · Python · MCP      summary
           beans · concurrency · cache · rate ·
           idempotency · audit · tracing · OpenAPI · tests
```

Every slice leaves `./gradlew build` green. Each phase lands as one logical PR.

---

## Phase A — docs (this repo)

| File | Purpose |
|---|---|
| `docs/architecture-summary.md` | Current truth of 5-service system |
| `docs/gap-audit.md` | Explicit verdict on every topic |
| `docs/implementation-plan.md` | This file |
| `docs/interview-upgrade-summary.md` | Final story, written in Phase D |

**Done when:** all 4 files exist, render clean in any Markdown viewer, and Mermaid parses.

---

## Phase B — Orchestrator (`C:/Users/ashis/OneDrive/Documents/Project/ShipSmart-Orchestrator`)

### B1. Build + config

**Files**
- `build.gradle`
- `src/main/resources/application.yml` + `application-local.yml` + `application-production.yml`

**Adds**
- Deps: `spring-boot-starter-cache`, `caffeine`, `bucket4j-core:8.10.1`, `flyway-core` + `flyway-database-postgresql`, `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp`, `springdoc-openapi-starter-webmvc-ui:2.6.0`, `spring-boot-starter-aop`, `spring-boot-starter-actuator` already present.
- Test deps: `testcontainers-junit-jupiter`, `testcontainers-postgresql`, `awaitility`.
- Config: Flyway validate mode, `spring.cache.type=caffeine`, `management.tracing.sampling.probability=0.0` (prod) / `1.0` (local), rate-limit default env keys, Micrometer exec service metrics.
- Actuator: expose `health,info,metrics,caches,prometheus`.

**Done when:** `./gradlew bootRun` starts and logs `Flyway` + `CaffeineCacheManager` lines, no test regressions.

---

### B2. Schema + domain

**Files**
- `src/main/resources/db/migration/V1__baseline.sql` — no-op that matches current Supabase state (used only to baseline Flyway)
- `src/main/resources/db/migration/V2__interview_upgrade.sql` — net new (mirrors Supabase migration below)
- `supabase/migrations/20260418NNNNNN_interview_upgrade.sql` (ShipSmart-Infra, authoritative)
- `domain/BaseEntity.java` (new, `@MappedSuperclass`)
- `domain/ShipmentRequest.java`, `domain/SavedOption.java` (refactor to extend `BaseEntity`)
- `domain/AuditLog.java` (new, simple entity)
- `domain/ShipmentStatus.java` (new enum: DRAFT, QUOTED, BOOKED, CANCELLED)
- `domain/IdempotencyKey.java` (new entity)

**Schema changes**
```sql
ALTER TABLE shipment_requests
  ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE saved_options
  ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idempotency_keys_expires_idx ON idempotency_keys (expires_at);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  request_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  diff JSONB
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX audit_log_user_at_idx ON audit_log (user_id, at DESC);
```

**Flyway baseline**: `spring.flyway.baseline-on-migrate=true`, `spring.flyway.baseline-version=1`. Supabase applies the same migration SQL in its own timestamped file so the two tools agree on schema.

**Done when:** `./gradlew flywayValidate` is clean; entities load without schema mismatch; existing tests still pass.

---

### B3. Shipment CRUD + pagination + optimistic locking

**Files**
- `controller/ShipmentController.java` (replace stub)
- `service/ShipmentService.java` (replace stub)
- `repository/ShipmentRequestRepository.java` (extend with `JpaSpecificationExecutor`)
- `repository/ShipmentSpecs.java` (new — filter composers)
- `dto/ShipmentCreateRequest.java`, `ShipmentPatchRequest.java`, `ShipmentResponse.java`, `ShipmentSummaryResponse.java`, `PageResponse.java` (new records)

**Endpoints**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/shipments` | `@Valid`, `@Idempotent`, returns 201 + Location |
| GET | `/api/v1/shipments/{id}` | 404 if missing/deleted, 403 if not owner; `ETag: W/"<version>"` |
| GET | `/api/v1/shipments` | `?page=0&size=20&sort=createdAt,desc&status=DRAFT&createdAfter=…` |
| PATCH | `/api/v1/shipments/{id}` | `If-Match: W/"<version>"`; 409 on version mismatch |
| DELETE | `/api/v1/shipments/{id}` | Soft delete; 204 |

**Service contract**
- `@Transactional(isolation = READ_COMMITTED)` on writes; read-only on getters.
- `updatePartial(id, userId, patch, expectedVersion)` — fetch inside txn, verify ownership, apply dirty fields, let JPA's `@Version` throw `OptimisticLockingFailureException` → mapped to `ResourceConflictException` in B4.

**Done when:** all 5 endpoints work; `curl` smoke per verification matrix passes; repo tests green on Testcontainers.

---

### B4. ProblemDetail + exception hierarchy

**Files**
- `exception/ResourceNotFoundException.java`
- `exception/ResourceConflictException.java`
- `exception/OwnershipException.java`
- `exception/ValidationException.java`
- `exception/RateLimitExceededException.java`
- `exception/IdempotencyConflictException.java`
- `exception/GlobalExceptionHandler.java` (rewrite to return `ResponseEntity<ProblemDetail>`)

**ProblemDetail shape** (RFC 7807 + extensions)
```json
{
  "type": "https://shipsmart.app/errors/resource-not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "Shipment abc-123 not found",
  "instance": "/api/v1/shipments/abc-123",
  "requestId": "7f3b-9...",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": [ { "field": "origin", "message": "must not be blank" } ]
}
```

**Done when:** every error path returns RFC-7807 shape; `ProblemDetailContractTest` green.

---

### B5. Bean lifecycle — real startup validation

**Files**
- `startup/QuoteProviderRegistry.java` (`@Component`, `InitializingBean`)
- `startup/FlywayValidationRunner.java` (`ApplicationRunner`, `@Order(1)`)
- `startup/RequiresCredentials.java` (annotation)

**Done when:** boot logs show `ProviderCredentialValidator: 1/3 providers enabled` and `FlywayValidationRunner: schema validated`.

---

### B6. Concurrency — bounded quote-provider fanout

**Files**
- `config/ExecutorConfig.java` (new — `quoteProviderExecutor` `@Bean`, `auditExecutor` `@Bean`, both bounded and Micrometer-instrumented)
- `async/MdcCopyingExecutorService.java` (new — wrapper that snapshots+restores MDC)
- `service/QuoteService.java` (edit — replace sequential provider loop with `CompletableFuture.allOf` fanout)
- `provider/QuoteProvider.java` (interface)
- `provider/AbstractQuoteProvider.java` (template method — retry, timeout, metrics)
- `provider/FedExProvider.java` (refactor to extend)
- `provider/UpsProvider.java`, `provider/DhlProvider.java` (stubs)

**Executor config**
```
core=4, max=8, queue=100, keepAlive=30s, ThreadFactory=named daemons
per-call orTimeout=3s; exceptionally → emptyQuote + metric increment
```

**Done when:** `QuoteProviderFanoutTest` shows provider calls run in parallel within bounded thread count; MDC survives across async boundary.

---

### B7. Caching — Caffeine

**Files**
- `config/CacheConfig.java` (new — `CaffeineCacheManager`, two caches with per-cache TTL + maxSize)
- Annotations added to `QuoteService.getQuotesByShipmentId` (`@Cacheable`), `ShipmentService.getById` (`@Cacheable`), mutation methods (`@CacheEvict`).

**Done when:** `QuoteCacheEvictionTest` passes; `/actuator/caches` lists both caches.

---

### B8. Rate limiting — Bucket4j

**Files**
- `web/RateLimitFilter.java` (new — `OncePerRequestFilter`, per-IP `ConcurrentHashMap<String, Bucket>`)
- `config/RateLimitConfig.java` (new — property binding `shipsmart.rate-limit.*`)
- `application.yml` — defaults (`shipments: 20/minute`, `quotes: 30/minute`, `bookings: 10/minute`)

**Done when:** 21st POST within a minute → 429 ProblemDetail + `Retry-After`.

---

### B9. Idempotency

**Files**
- `web/IdempotencyInterceptor.java` (new — `HandlerInterceptor`)
- `web/Idempotent.java` (annotation — marker on handler methods)
- `domain/IdempotencyKey.java` (entity — persists replay state)
- `repository/IdempotencyKeyRepository.java`
- `service/IdempotencyService.java` (SHA-256 hash canonicalization, store/lookup, scheduled cleanup)
- Controllers: mark `createShipment` and `trackAndRedirect` with `@Idempotent`.

**Behavior**
- Missing `Idempotency-Key` on `@Idempotent` endpoint → 400 ProblemDetail.
- Replay with same key + same body → return stored status + body.
- Replay with same key + different body → 422 IdempotencyConflict.
- Cleanup job: `@Scheduled(fixedRate = 3600000)` deletes expired rows.

---

### B10. Audit — AOP

**Files**
- `audit/Audited.java` (annotation — method-level, attribute `entity`)
- `audit/AuditAspect.java` (`@Aspect @Component`, after-returning, publishes to `auditExecutor`)
- `audit/AuditLog.java` (entity — see B2)
- `audit/AuditLogRepository.java`

**Annotate**: `ShipmentService.create`, `update`, `softDelete`; `SavedOptionService.save`, `remove`; `BookingService.trackAndRedirect`.

**Diff strategy:** serialize pre-image + post-image to JSON (Jackson), diff via jsonpatch (add dep if needed; otherwise just store before+after).

---

### B11. CorrelationIdFilter + Micrometer tracing

**Files**
- `web/CorrelationIdFilter.java` (new — `OncePerRequestFilter`, `@Order(Ordered.HIGHEST_PRECEDENCE)`, runs before `JwtAuthFilter`)
- `web/TracingRestTemplateInterceptor.java` (new — outbound header injection; we don't have outbound REST yet but leave the hook for Java → MCP future)
- `config/TracingConfig.java` (Micrometer Observation / OTel wiring, exporter off by default)
- `application.yml` — logging pattern now: `[%X{requestId}] [%X{traceId}] [%X{userId}] %msg`

**Behavior**
- Read inbound `X-Request-Id`; generate UUID if missing.
- Read inbound `traceparent` (W3C); generate new one if missing.
- Put into MDC (`requestId`, `traceId`, `spanId`).
- Set response headers `X-Request-Id` and `traceparent` (propagated back to caller).

---

### B12. OpenAPI

**Files**
- `config/OpenApiConfig.java` — title, version, global `securityScheme` for Bearer JWT.
- Annotate DTOs with `@Schema(description=...)`, controllers with `@Operation`, error responses via `@ApiResponse(responseCode="404", content=@Content(schema=@Schema(implementation=ProblemDetail.class)))`.

**Done when:** `GET /v3/api-docs` returns a complete schema; `/swagger-ui.html` renders; `GET /actuator/health` still public.

---

### B13. Tests (full matrix)

**New test files (target ~60 tests)**

```
src/test/java/com/shipsmart/api/
  shipment/
    ShipmentControllerTest.java           (MockMvc)
    ShipmentControllerSecurityTest.java   (spring-security-test)
    ShipmentServiceTest.java              (unit)
    ShipmentLifecycleIT.java              (Testcontainers, full context)
    ShipmentOptimisticLockIT.java         (race, 2 threads)
    ShipmentRequestRepositoryIT.java      (specs + soft-delete)
  quote/
    QuoteProviderRegistryTest.java
    QuoteProviderFanoutTest.java          (awaitility + metric assertions)
    QuoteCacheEvictionTest.java
  idempotency/
    IdempotencyInterceptorIT.java
    IdempotencyKeyHasherTest.java
  ratelimit/
    RateLimitFilterTest.java
  audit/
    AuditAspectIT.java
  error/
    ProblemDetailContractTest.java
  tracing/
    CorrelationPropagationTest.java
  config/
    TestcontainersPostgresBase.java       (shared @Testcontainers base with reuse)
```

**Testcontainers setup:** `TestcontainersPostgresBase` holds a `@Container static PostgreSQLContainer pg` with `.withReuse(true)`; Spring properties wired via `@DynamicPropertySource`. Users enable reuse once in `~/.testcontainers.properties` (`testcontainers.reuse.enable=true`).

**Done when:** `./gradlew test` green; surefire report lists ≥60 tests in new packages.

---

## Phase C — Cross-repo thin slice

### C1. ShipSmart-Web

**New**: `src/lib/http.ts` — single fetch wrapper.
**Edit**: `src/lib/advisor-api.ts`, `src/hooks/useSavedOptions.ts`, `src/lib/compare-api.ts`, any other fetch call sites.

**Behavior**
- Every outbound call: `X-Request-Id = crypto.randomUUID()`, `traceparent = buildTraceparent(sessionTraceId)`, `Authorization: Bearer <jwt>` from Supabase.
- `post()` helper: accepts `idempotent: true` flag → also attaches `Idempotency-Key = crypto.randomUUID()`.
- Error handling: normalizes ProblemDetail (`.detail`) and legacy (`.message`) during transition.

### C2. ShipSmart-API (Python)

**Edit**: `app/core/middleware.py`, `app/services/java_client.py`, `app/services/orchestration_service.py`.
**New**: `app/core/context.py` (ContextVar holding request+trace ids).

**Behavior**
- `RequestLoggingMiddleware`: read inbound `X-Request-Id` / `traceparent` first; generate only if missing. Store in ContextVar. Emit on response.
- `java_client.py`: attach both headers (plus existing JWT forward) on outbound.
- `orchestration_service.py` (MCP calls): same.

### C3. ShipSmart-MCP

**New**: `app/core/middleware.py` (mirror of Python API pattern — small file).
**Edit**: `app/main.py` (add middleware).

### C4. ShipSmart-Infra

**New**: `supabase/migrations/20260418NNNNNN_interview_upgrade.sql` (matches V2 above).

### C5. Render config

**Edit**: `ShipSmart-Orchestrator/render.yaml` — add env vars:
```
SPRING_PROFILES_ACTIVE=production
SPRING_FLYWAY_ENABLED=true
SPRING_FLYWAY_VALIDATE_ON_MIGRATE=true
SPRING_FLYWAY_BASELINE_ON_MIGRATE=true
MANAGEMENT_TRACING_SAMPLING_PROBABILITY=0.0
SHIPSMART_RATE_LIMIT_SHIPMENTS=20/minute
SHIPSMART_RATE_LIMIT_QUOTES=30/minute
SHIPSMART_RATE_LIMIT_BOOKINGS=10/minute
SHIPSMART_CACHE_QUOTES_TTL=PT10M
SHIPSMART_CACHE_SHIPMENT_TTL=PT2M
```

---

## Phase D — Final summary

File: `ShipSmart-Infra/docs/interview-upgrade-summary.md` — rendered last, covers Phase 10 of the prompt (what changed, which repos, implemented/partial/rejected, interview talking points with file refs, concrete future work).

---

## Verification (post-phase gates)

**After Phase A:** 3 markdown files render; Mermaid parses.

**After Phase B:**
- `./gradlew clean build` green (~60 new tests).
- `./gradlew bootRun` logs: `FlywayValidationRunner ok`, `ProviderCredentialValidator ok`, `CaffeineCacheManager caches=[quotesByShipmentId, shipmentById]`.
- `curl` smoke (see architecture-summary.md §7 verification) — idempotency 201/200/422, pagination, PATCH 409, 429 rate limit, soft-delete 204+404, OpenAPI renders.
- `curl /actuator/metrics/executor.queued?tag=name:quoteProviderExecutor` nonzero under load.

**After Phase C:**
- Browser devtools: same `X-Request-Id` on Web request, Java response, Python log, MCP log, Java log for the Python→Java hop.
- Replayed POST from Web: no duplicate shipment row (`SELECT COUNT(*) … = 1`).

**After Phase D:**
- Interview rehearsal: every topic in `gap-audit.md` can be answered by pointing at a file in Orchestrator.

---

## Out of scope (explicitly)

- Python-heavy upgrades (async gather patterns, MCP auth hardening beyond correlation, RAG retrieval improvements).
- Moving migration ownership to Flyway (validate-only, Supabase remains authoritative).
- Kafka / RabbitMQ / Debezium / full EDA.
- New microservices.
- Multi-tenant isolation, RBAC.

All documented in `gap-audit.md` with triggers for when to revisit.
