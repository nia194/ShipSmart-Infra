# ShipSmart Interview-Upgrade — Change Summary

**Date:** 2026-04-18
**Scope:** Java-heavy upgrade of ShipSmart-Orchestrator + cross-repo correlation thin slice.
**Goal:** Make the ShipSmart monorepo a well-defensible reference for a Gen-AI System Design interview, covering design patterns, bean lifecycle, concurrency, multi-threading, caching, soft delete, audit, rate limiting, idempotency, tracing, and Flyway validation.

---

## 1. What changed by repo

| Repo | Change |
|---|---|
| **ShipSmart-Infra** | `docs/architecture-summary.md`, `gap-audit.md`, `implementation-plan.md`, `interview-upgrade-summary.md`; migration `supabase/migrations/20260417120000_interview_upgrade.sql`. |
| **ShipSmart-Orchestrator** | Flyway (validate mode) wired; `BaseEntity`, `ShipmentStatus`, `AuditLog`, `IdempotencyKey`; rewritten `ShipmentController`/`ShipmentService` with pagination + Specifications + optimistic locking; full ProblemDetail exception hierarchy; `CorrelationIdFilter`, `RateLimitFilter`, `BodyCachingFilter`, `IdempotencyInterceptor`, `IdempotencyCleanupJob`; `@Audited` + `AuditAspect`; `ExecutorConfig` (bounded + MDC-aware); `CacheConfig` via Caffeine on `shipmentById`/`quotesByShipmentId`; `QuoteProvider` strategy + `AbstractQuoteProvider` + `QuoteProviderRegistry`; `FlywayValidationRunner`; springdoc-openapi; Micrometer-OTel bridge (exporter off by default). Focused test pack. |
| **ShipSmart-API** | `app/core/correlation.py` (ContextVars); middleware upgraded to honor inbound `X-Request-Id` / `traceparent`; `java_client.py` forwards both outbound. |
| **ShipSmart-MCP** | `app/core/middleware.py` (new) mirrors Python API pattern. |
| **ShipSmart-Web** | `src/lib/http.ts` — single fetch wrapper that mints correlation IDs, forwards JWT, supports `Idempotency-Key`, parses ProblemDetail. |

---

## 2. Interview topics now implemented (with file refs)

| Topic | Where to point |
|---|---|
| **Design patterns: Strategy / Adapter / Factory / Template / Facade** | `provider/QuoteProvider.java`, `provider/AbstractQuoteProvider.java`, `provider/QuoteProviderRegistry.java`, `service/ShipmentService.java` (facade over repo + cache + audit) |
| **Bean lifecycle (InitializingBean, ApplicationRunner)** | `provider/QuoteProviderRegistry#afterPropertiesSet`, `startup/FlywayValidationRunner` |
| **Monolith-vs-Microservices reasoning** | `docs/gap-audit.md` — split of Java transactional plane vs. Python AI plane; rationale for rejecting new microservices |
| **Concurrency — optimistic locking** | `domain/BaseEntity.java` (`@Version`), `service/ShipmentService#updatePartial` (If-Match check), `GlobalExceptionHandler#handleOptimisticLock` |
| **Concurrency — bounded parallel fanout** | `service/QuoteFanoutService`, `config/ExecutorConfig` (pool size + queue + MDC-aware wrapper + ExecutorServiceMetrics) |
| **Soft delete** | `domain/BaseEntity.deletedAt`, `@SQLRestriction("deleted_at IS NULL")` on `ShipmentRequest`/`SavedOption`, `repository.findByIdIncludingDeleted` |
| **Audit (AOP + async executor)** | `audit/Audited`, `audit/AuditAspect`, `config/ExecutorConfig#auditExecutor` |
| **Caching (Caffeine, evicted on mutation)** | `application.yml` cache block, `@Cacheable`/`@CacheEvict` in `ShipmentService` |
| **Rate limiting (Bucket4j, per-IP)** | `web/RateLimitFilter` |
| **Idempotency keys** | `web/Idempotent` + `web/IdempotencyInterceptor` + `web/BodyCachingFilter` + `domain/IdempotencyKey` + `web/IdempotencyCleanupJob` |
| **Distributed tracing propagation** | `web/CorrelationIdFilter` (Java), `ShipSmart-API/app/core/correlation.py`, `ShipSmart-MCP/app/core/middleware.py`, `ShipSmart-Web/src/lib/http.ts` |
| **Flyway in validate-only mode** | `application.yml#spring.flyway`, `resources/db/migration/V1__baseline.sql`, `V2__interview_upgrade.sql`, `startup/FlywayValidationRunner` |
| **Pagination + filtering (Specifications)** | `repository/ShipmentRequestRepository`, `repository/ShipmentRequestSpecifications`, `controller/ShipmentController#list` |
| **RFC 7807 ProblemDetail** | `exception/GlobalExceptionHandler`, `exception/*Exception.java` |
| **OpenAPI / Swagger UI** | `config/OpenApiConfig`, `springdoc` block in `application.yml`, `@Tag`/`@Operation`/`@Schema` on DTOs and controllers |

---

## 3. Topics still partial

| Topic | State | Flip-switch |
|---|---|---|
| **OTel tracing export** | Dependencies (`micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp`) and config are real; `management.tracing.sampling.probability` defaults to `0.0` in prod. | Set probability > 0 and `MANAGEMENT_OTLP_TRACING_ENDPOINT=https://otlp-collector:4318/v1/traces`. |
| **Full cross-repo OTel spans** | Correlation IDs flow now; actual span export from Python/MCP is documented as future work. | Install `opentelemetry-instrumentation-fastapi` + an OTLP exporter in `ShipSmart-API` and `ShipSmart-MCP`. |
| **Testcontainers IT suite** | Dependency present; focused unit tests in place for the new surface. The full repo/controller integration matrix (Testcontainers-backed) is scaffolded via dependencies but not fully populated to keep this PR reviewable. | Enable `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` and add a `@SpringBootTest`+`@Testcontainers` base class. |

---

## 4. Topics rejected — with reasoning (and triggers to revisit)

| Topic | Verdict | Why | Revisit when |
|---|---|---|---|
| **New audit / idempotency / tracing microservices** | Reject | At current scale each is a table + filter/aspect; ops cost > benefit. | Second write-heavy consumer, regulated audit (tamper-evident), OR 3+ replicas. |
| **Heavy audit framework (Hibernate Envers)** | Reject | Doubles table count; shadow rows on every update. | Legal/compliance requirement for temporal row reconstruction. |
| **Premature event-driven architecture (Kafka / Rabbit / Debezium)** | Reject | No async consumer today; pure resume-driven. | A second service needs to react to shipment state changes. |
| **Flyway as schema owner** | Reject (validate-only kept) | Supabase remains owner per team decision; Java fails fast if drift. | If Supabase is replaced or if Java needs to deploy schema ahead of Supabase console. |
| **Redis for idempotency + rate-limit state** | Reject for now | In-memory is fine for 1 replica. | Scale > 1 Orchestrator replica. |

---

## 5. Interview talking points — one-liners with file refs

- **"Why split Java from Python?"** — Java plane is deterministic + ACID single-writer (`ShipmentService`, `BaseEntity`). Python plane is probabilistic — prompts, embeddings, LLM routing. LLM bugs, prompt-injection, or provider outages can **never corrupt the system of record**. See `docs/architecture-summary.md`.
- **"How do you prevent lost updates?"** — `@Version` on `BaseEntity`, `If-Match`/`ETag` enforced by `ShipmentController#patch`, conflict mapped to `ProblemDetail` 409 in `GlobalExceptionHandler`.
- **"How do you fan out to providers without blowing up the request thread?"** — `QuoteFanoutService` + `ExecutorConfig.quoteProviderExecutor` (bounded `ThreadPoolExecutor`, `CallerRunsPolicy`, observable via `ExecutorServiceMetrics`). Per-call `orTimeout(3s)`, `exceptionally` → empty list; one slow carrier never stalls the request.
- **"How do requests stay correlated across four services?"** — `CorrelationIdFilter` (Java) + `app/core/correlation.py` (Python) + MCP middleware + Web `http.ts`. Same `X-Request-Id` + `traceparent` flows Web → API → Java → MCP.
- **"How do you keep writes safe on retries?"** — `@Idempotent` on `POST /shipments`, hashed body in `idempotency_keys`, replay window 24h. Different body for same key → 422.
- **"How do you audit without killing request throughput?"** — `@Audited` annotation → `AuditAspect` → `auditExecutor` (bounded, `CallerRunsPolicy` so we never drop, never block).
- **"How do you handle schema changes without fighting Supabase?"** — Flyway in validate mode; `FlywayValidationRunner` refuses to boot if migrations are `PENDING`. Supabase remains the source of truth.

---

## 6. Future work (ranked by trigger, not by coolness)

1. **OTel collector + Tempo/Jaeger dashboard** — flip sampling > 0, wire the OTLP endpoint; Micrometer bridge handles the rest. Trigger: first prod outage where MTTR is gated on log grepping.
2. **Python + MCP OTel instrumentation** — end-to-end spans, not just correlation IDs. Trigger: once collector is live.
3. **Redis-backed idempotency + rate-limit state** — move `ConcurrentHashMap` and JPA table to Redis. Trigger: scale Orchestrator past 1 replica.
4. **Testcontainers integration test matrix** — ~40 tests across repository, controller, security, caching, idempotency, rate-limit, tracing. Trigger: before next carrier integration lands.
5. **Keyset pagination for `/api/v1/shipments`** — offset/limit is fine until shipment history grows past ~10⁵/user. Trigger: P95 list latency > 300ms.
6. **Immutable audit journal (Debezium CDC from `audit_log` → S3 parquet)** — tamper-evident history for regulated carrier moves. Trigger: compliance ask or enterprise customer SLA.
7. **Adaptive rate limiting by tenant plan** — swap per-IP buckets for per-tenant+per-plan buckets. Trigger: first paying customer that exceeds the free tier.
8. **Per-provider circuit breakers (Resilience4j)** — today we rely on `orTimeout`; Resilience4j buys us half-open probing + metrics. Trigger: flaky carrier that's down for minutes at a time.

---

*End of interview-upgrade summary. Open `docs/architecture-summary.md` for the static picture of the system, and `docs/gap-audit.md` for the per-topic verdict table.*
