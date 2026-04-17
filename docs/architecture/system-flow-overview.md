# System Flow Overview

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Quote Flow  │  │ Advisor Page │  │ Recommendation   │   │
│  │ (HomePage)   │  │  (shipping/  │  │ Panel (in-quote) │   │
│  │              │  │  tracking)   │  │                  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │             │
└─────────┼─────────────────┼────────────────────┼─────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
   ┌──────────────┐  ┌──────────────────────────────────────┐
   │   Java API   │  │          Python API (FastAPI)         │
   │ (Spring Boot)│  │                                      │
   │              │  │  ┌───────────┐  ┌────────────────┐   │
   │  • Quotes    │  │  │  Advisor  │  │ Recommendation │   │
   │  • Saved Opts│  │  │ Endpoints │  │   Endpoint     │   │
   │  • Booking   │  │  └─────┬─────┘  └───────┬────────┘   │
   │              │  │        │                 │            │
   │              │  │  ┌─────▼─────────────────▼────────┐   │
   │              │  │  │     Service Layer               │   │
   │              │  │  │  • Shipping Advisor Service     │   │
   │              │  │  │  • Tracking Advisor Service     │   │
   │              │  │  │  • Recommendation Service       │   │
   │              │  │  │  • Orchestration Service        │   │
   │              │  │  └──┬──────────┬──────────┬────────┘   │
   │              │  │     │          │          │            │
   │              │  │  ┌──▼──┐  ┌───▼───┐  ┌──▼──────┐    │
   │              │  │  │ RAG │  │ Tools │  │   LLM   │    │
   │              │  │  │     │  │       │  │ Client  │    │
   │              │  │  └──┬──┘  └───┬───┘  └────┬────┘    │
   │              │  │     │        │            │         │
   │              │  │  ┌──▼──┐  ┌──▼───────┐  ┌▼──────┐  │
   │              │  │  │Vec  │  │Mock      │  │Echo / │  │
   │              │  │  │Store│  │Provider  │  │OpenAI │  │
   │              │  │  └─────┘  └──────────┘  └───────┘  │
   └──────────────┘  └──────────────────────────────────────┘
```

## Key Flows

### 1. Quote Comparison Flow

```
User enters origin, destination, dates, packages
  → Frontend calls Java API (POST /api/v1/quotes)
  → Java returns QuoteResults (prime + private sections)
  → Frontend displays quote results
  → useRecommendation hook fires with all services
    → Calls Python API (POST /api/v1/advisor/recommendation)
    → Python scores services, returns primary + alternatives
    → Frontend shows recommendation panel below quotes
    → If Python API unavailable, panel is simply hidden
```

### 2. Shipping Advisor Flow

```
User asks a shipping question on Advisor page
  → Frontend calls Python API (POST /api/v1/advisor/shipping)
  → Python service:
    1. Retrieves RAG context (embedding → vector search)
    2. Selects tools based on query + context (regex matching)
    3. Executes tools (validate_address, get_quote_preview)
    4. Builds prompt with RAG context + tool results
    5. Calls LLM for answer
  → Returns: answer, reasoning, tools_used, sources
```

### 3. Tracking Guidance Flow

```
User reports a delivery issue on Advisor page
  → Frontend calls Python API (POST /api/v1/advisor/tracking)
  → Python service:
    1. Retrieves RAG context for issue keywords
    2. Optionally validates address if context provided
    3. Builds prompt with context + tool results
    4. Calls LLM for guidance
  → Returns: guidance, issue_summary, next_steps, sources
```

### 4. Recommendation Scoring

```
Services input: [{service, price_usd, estimated_days}, ...]

Classification:
  • Cheapest price → CHEAPEST
  • Fewest days → FASTEST
  • Both cheapest AND fastest → BEST_VALUE
  • Otherwise → BALANCED

Scoring (normalized 0-1):
  • price_score = 1 - (price - min) / max
  • days_score = 1 - (days - min) / max

Weighted by type:
  • CHEAPEST: price * 1.5 + days * 0.5
  • FASTEST: days * 1.5 + price * 0.5
  • BEST_VALUE: (price + days) * 1.2
  • BALANCED: (price + days) / 2

Result: sorted by score, top = primary recommendation
```

## Service Boundaries

| Concern | Owner | Notes |
|---------|-------|-------|
| Quote comparison | Java API | Transactional, real carrier data |
| Saved options | Java API | Database-backed CRUD |
| Booking redirect | Java API | Builds carrier booking URLs |
| Shipping advice | Python API | RAG + LLM |
| Tracking guidance | Python API | RAG + LLM |
| Recommendations | Python API | Deterministic scoring |
| Integration point | Frontend | Only the frontend calls both APIs |

Java and Python APIs do not call each other directly.

## Caching Strategy

| Cache | TTL | Max Size | Purpose |
|-------|-----|----------|---------|
| `rag_cache` | 120s | 64 | Avoid re-embedding identical queries |
| `recommendation_cache` | 300s | 128 | Avoid re-scoring identical service sets |

Both use in-memory TTL cache with LRU eviction when full.
