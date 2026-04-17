# Interview-Priority Roadmap

Post-Phase 13. Only work that strengthens interview talking points.

---

## Priority Order

### 1. Real Carrier Provider Integration (UPS / FedEx / DHL)

**Interview value**: Demonstrates adapter pattern, external API integration, error handling, provider abstraction.

**What to build**:
- `UPSProvider` implementing `ShippingProvider` ABC
- `FedExProvider` implementing `ShippingProvider` ABC
- `DHLProvider` implementing `ShippingProvider` ABC
- Provider factory function that reads `SHIPPING_PROVIDER` config
- Update `main.py` startup to use factory instead of hardcoded `MockShippingProvider()`
- Map each carrier's API response format to the existing `ProviderResult` schema
- Handle auth, rate limiting, timeouts, and error mapping per carrier

**Talking points**: "I designed a provider abstraction where adding a new carrier means implementing two methods — `validate_address` and `get_quote_preview`. The mock, UPS, FedEx, and DHL providers all implement the same interface. Tools never know which carrier they're talking to."

**Files to touch**:
- `app/providers/ups_provider.py` (new)
- `app/providers/fedex_provider.py` (new)
- `app/providers/dhl_provider.py` (new)
- `app/providers/__init__.py` (factory)
- `app/core/config.py` (new env vars for carrier API keys)
- `app/main.py` (use factory)

---

### 2. RAG Knowledge Base Expansion

**Interview value**: Shows RAG pipeline understanding, document design, retrieval quality tuning.

**What to build**:
- Add domain documents to `apps/api-python/data/documents/`:
  - Carrier-specific policies (returns, claims, insurance, prohibited items)
  - International shipping rules (customs, duties, restricted countries)
  - Package size/weight limits by carrier and service level
  - Common shipping scenarios and resolutions
  - Hazardous materials and restricted items guide
- Test retrieval quality with targeted queries
- Tune `RAG_CHUNK_SIZE` and `RAG_TOP_K` if needed

**Talking points**: "The RAG pipeline chunks documents, embeds them, and retrieves the top-K most relevant chunks for each query. I expanded the knowledge base from 2 generic docs to a comprehensive carrier policy library, which improved retrieval relevance for specific questions like insurance claims or international restrictions."

**Files to touch**:
- `apps/api-python/data/documents/*.md` (new documents)

---

### 3. LLM Provider Integration and Model Routing

**Interview value**: Demonstrates multi-provider LLM design, abstraction, fallback strategy.

**What to build**:
- `AnthropicClient` implementing `LLMClient` ABC (config field `ANTHROPIC_API_KEY` already exists)
- Update `create_llm_client()` factory to support `"anthropic"` provider
- Model routing: ability to specify model per request or use a default
- Graceful degradation: if primary LLM fails, fall back to secondary or EchoClient

**Talking points**: "The LLM layer is provider-agnostic. I can switch between OpenAI and Anthropic with a config change. The factory pattern means adding a new provider is one class and one `elif` in the factory. I also built fallback logic — if the primary provider errors, it degrades to the secondary or echo mode."

**Files to touch**:
- `app/llm/anthropic_client.py` (new)
- `app/llm/client.py` (update factory)
- `app/core/config.py` (add anthropic model config)

---

## What Makes This Interview-Ready

| Concept | Where It Lives |
|---------|---------------|
| Adapter/Strategy pattern | Provider ABCs, LLM client ABCs |
| Factory pattern | `create_llm_client()`, `create_embedding_provider()`, provider factory |
| Dependency injection | Tools receive providers via constructor, services receive components via params |
| Clean architecture | Layers: routes -> services -> tools -> providers (never skip a layer) |
| Config-driven behavior | All implementations swappable via env vars, zero code changes |
| RAG pipeline | Ingest -> chunk -> embed -> store -> retrieve -> augment -> generate |
| Tool orchestration | Registry pattern with schema introspection |
