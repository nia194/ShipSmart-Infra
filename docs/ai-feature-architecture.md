# AI Feature Architecture

## Overview

Phase 9 implements the first real AI-powered product features by combining:
- RAG context retrieval
- Tool execution via provider abstraction
- LLM reasoning

This phase produces actual feature-level AI flows that assist users, not just infrastructure.

## Implemented Features

### 1. Shipping Advisor
**Endpoint:** `POST /api/v1/advisor/shipping`

Answers shipping-related questions by combining RAG knowledge with practical tools.

**Flow:**
1. Retrieve relevant RAG context (carrier info, shipping policies, delivery windows)
2. If context provided (origin, destination, weight, dimensions):
   - Execute `get_quote_preview` tool to fetch service options
3. If address provided:
   - Execute `validate_address` tool to check deliverability
4. Pass context + tool results to LLM to generate reasoned advice
5. Return structured answer with sources and tools used

**Examples:**
- "What shipping option is best for a 10 lb package from NY to CA?" → uses RAG + quote preview tool
- "Is this address deliverable?" → uses RAG + address validation tool
- "What carriers are available?" → uses RAG only, no tools needed

**Use case:** Customer service agents, checkout flows, shipping policy questions

### 2. Tracking/Delivery Guidance Assistant
**Endpoint:** `POST /api/v1/advisor/tracking`

Provides guidance on delivery issues, tracking problems, and address-related concerns.

**Flow:**
1. Enrich query with delivery/tracking keywords for better RAG retrieval
2. Retrieve relevant RAG context (common issues, solutions, carrier policies)
3. Optionally execute `validate_address` tool if address provided
4. Pass context + optional tool results to LLM to generate guidance
5. Extract next steps from guidance text
6. Return structured response

**Examples:**
- "What should I do if my package is delayed?" → uses RAG to explain carrier delays
- "How do I reduce delivery issues for apartment addresses?" → uses RAG + address validation
- "Package not being delivered to my address" → uses RAG + address check

**Use case:** Self-service help, issue escalation, customer satisfaction

### 3. Smart Quote Recommendation
**Endpoint:** `POST /api/v1/advisor/recommendation`

Interprets quote preview results and provides reasoned service recommendations.

**Logic:**
1. **Classify** each service as cheapest, fastest, best_value, or balanced
2. **Score** each service combining:
   - Price factor (normalized to 0-1)
   - Speed factor (normalized to 0-1)
   - Recommendation type weighting
3. **Generate explanations** for each service
4. **Rank** by score and return primary + alternatives
5. **Summarize** the recommendation with tradeoffs

**Scoring:**
- **Cheapest:** 1.5 × price_score + 0.5 × speed_score
- **Fastest:** 1.5 × speed_score + 0.5 × price_score
- **Best Value:** (price_score + speed_score) × 1.2
- **Balanced:** (price_score + speed_score) / 2

**Context-aware explanations:**
- If fragile context → mention speed and protection
- If urgent → flag whether service meets deadline
- Generic → price + delivery time

**Use case:** Quote comparison, order finalization, checkout upsell

## Architecture

```
Request → Service Layer → RAG + Tools + LLM → Structured Response

Shipping Advisor:
  query + context → retrieve RAG → execute tools → LLM → ShippingAdvisorResponse

Tracking Advisor:
  issue + context → retrieve RAG → execute tools → LLM → TrackingGuidanceResponse

Recommendation:
  services + context → score/classify → explain → RecommendationResponse
```

## API Endpoints

### POST /api/v1/advisor/shipping

**Request:**
```json
{
  "query": "What shipping options are available?",
  "context": {
    "origin_zip": "90210",
    "destination_zip": "10001",
    "weight_lbs": 5.0,
    "length_in": 12.0,
    "width_in": 8.0,
    "height_in": 6.0
  }
}
```

**Response:**
```json
{
  "answer": "For a 5 lb package from CA to NY...",
  "reasoning_summary": "Based on your package dimensions and destination...",
  "tools_used": ["get_quote_preview"],
  "sources": [
    {"source": "shipping-faq.md", "chunk_index": 2, "score": 0.85},
    {"source": "carrier-info.txt", "chunk_index": 0, "score": 0.79}
  ],
  "context_used": true
}
```

### POST /api/v1/advisor/tracking

**Request:**
```json
{
  "issue": "What should I do if my package is delayed?",
  "context": {
    "tracking_number": "1Z999AA10123456784",
    "carrier": "UPS"
  }
}
```

**Response:**
```json
{
  "guidance": "Package delays are common due to...",
  "issue_summary": "Package delays are common and usually resolve within 24-48 hours.",
  "tools_used": [],
  "sources": [
    {"source": "shipping-faq.md", "chunk_index": 5, "score": 0.92}
  ],
  "next_steps": [
    "Check the tracking number on the carrier's website",
    "Contact the carrier if delayed more than 3 days",
    "Request signature confirmation for valuable items"
  ]
}
```

### POST /api/v1/advisor/recommendation

**Request:**
```json
{
  "services": [
    {"service": "Ground", "price_usd": 9.99, "estimated_days": 5},
    {"service": "Express", "price_usd": 19.99, "estimated_days": 2},
    {"service": "Overnight", "price_usd": 49.99, "estimated_days": 1}
  ],
  "context": {
    "fragile": true,
    "urgent": false
  }
}
```

**Response:**
```json
{
  "primary_recommendation": {
    "service_name": "Express",
    "price_usd": 19.99,
    "estimated_days": 2,
    "recommendation_type": "best_value",
    "explanation": "Express costs $19.99 and takes 2 day(s) — good for fragile items requiring speed",
    "score": 1.15
  },
  "alternatives": [
    {
      "service_name": "Ground",
      "price_usd": 9.99,
      "estimated_days": 5,
      "recommendation_type": "cheapest",
      "explanation": "Ground costs $9.99 and takes 5 day(s) — consider faster option for fragile goods",
      "score": 0.8
    }
  ],
  "summary": "Recommended: Express at $19.99 (2 days). Good for fragile items requiring speed. Alternative options: Ground.",
  "metadata": {
    "num_options": 3,
    "primary_type": "best_value"
  }
}
```

## When RAG Is Used vs Tools vs LLM Only

| Feature | RAG | Tools | LLM |
|---------|-----|-------|-----|
| Shipping Advisor | Always (context base) | Optional (if context provided) | Always (reasoning) |
| Tracking Advisor | Always (guidance base) | Optional (address validation) | Always (reasoning) |
| Recommendation | No | No (input not RAG) | Optional (scoring logic is deterministic) |

## Deterministic vs LLM Logic

| Component | Logic Type | Details |
|-----------|-----------|---------|
| Tool execution | Deterministic | Tool registry selects tools via string patterns + tool execution logic |
| RAG retrieval | Deterministic | Cosine similarity vector search |
| Recommendation scoring | Deterministic | Normalized pricing + speed scoring with type-based weights |
| Recommendation classification | Deterministic | Cheapest = min price, fastest = min days |
| LLM reasoning | LLM-based | Advisor generates natural explanations |
| Service explanations | Deterministic | Template-based with context injection |

## Limitations

### Current Phase 9 Limitations
1. **LLM optional** — If no LLM configured (EchoClient), advisors still work but return generic responses
2. **Tool selection is rule-based** — Uses string patterns, not LLM-assisted selection
3. **Recommendations deterministic** — Scoring is rule-based, not LLM-weighted
4. **No multi-turn conversation** — Each request is independent, no context carryover
5. **Mock provider only** — Quote previews don't reflect real carrier pricing
6. **No real-time data** — Delivery windows based on carrier info docs, not live data

### By Design
7. **Spring Boot owns quotes** — Recommendation is advisory only. Final quotes come from Java API.
8. **Address validation is preview** — Uses provider abstraction (mock currently), not full USPS/UPS lookup
9. **No autonomous loops** — Advisor executes tools once per request, not in iterative loops

## What Phase 10 (Full-System Integration) Will Add

- Frontend integration for advisor features
- Integration with Spring Boot quote/booking APIs
- Real carrier provider implementations (if APIs available)
- Multi-turn conversation support
- Caching of RAG and recommendation results
- A/B testing framework for recommendation strategies
- Analytics and logging of advisor usage
- Rate limiting and cost tracking
- More tools (find_dropoff_locations, estimate_delivery_window, etc.)
