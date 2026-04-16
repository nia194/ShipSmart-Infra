# Model Routing Strategy

How ShipSmart selects which model to use and the design rationale.

---

## Current Approach: Config-Driven Single Provider

The current implementation uses a **single active provider** selected at startup via `LLM_PROVIDER`. All requests go to the same provider for the lifetime of the process.

This is intentional. Reasons:
1. **Simplicity**: One provider per deployment is easy to reason about, test, and debug.
2. **Cost control**: One API key, one billing account, predictable costs.
3. **Consistency**: All advisor answers use the same model — no inconsistency between requests.
4. **Explainability**: In an interview, "we select the provider at startup via config" is clearer than "we route dynamically per request."

---

## Model Selection Guide

### For Production
- **Default**: `openai` with `gpt-4o-mini`
  - Best balance of quality, cost, and speed
  - Reliable, well-documented, predictable
  - ~$0.0002 per typical advisor query

### For Higher Quality (When Needed)
- `openai` with `OPENAI_MODEL=gpt-4o`
  - Better reasoning for complex shipping scenarios
  - 15-20x more expensive than gpt-4o-mini
  - Use when answer quality is worth the cost

### For Cost Optimization
- `gemini` with `gemini-2.0-flash`
  - Free tier available for low-volume usage
  - Competitive quality with OpenAI for factual Q&A
  - Longer context window (useful if knowledge base grows)

### For Local Development / Offline
- `llama` with `llama3.2`
  - No API cost, no internet required
  - Good for testing the pipeline end-to-end
  - Quality varies — adequate for development

### For Testing Pipeline Only
- Empty `LLM_PROVIDER` (EchoClient)
  - Tests RAG retrieval, tool execution, service wiring
  - No LLM cost or dependency
  - Answers are not useful to end users

---

## Future Routing Options (Not Implemented)

These are design options for when per-request routing becomes valuable. They are documented here for interview discussion, not as planned work.

### Per-Request Provider Selection
```python
# Hypothetical — not implemented
async def complete(self, messages, provider_hint=None):
    if provider_hint == "long_context":
        return await self._gemini.complete(messages)
    return await self._openai.complete(messages)
```

### Fallback Chain
```python
# Hypothetical — not implemented
async def complete(self, messages):
    try:
        return await self._primary.complete(messages)
    except AppError:
        return await self._secondary.complete(messages)
```

### Cost-Based Routing
```python
# Hypothetical — not implemented
# Short queries → cheap model, complex queries → capable model
if len(query) < 100 and not needs_reasoning:
    return await self._mini.complete(messages)
return await self._full.complete(messages)
```

These are mentioned as interview talking points: "Here's what I would build next if per-request routing became a requirement."

---

## Interview Talking Points

1. **Provider abstraction**: All LLM providers implement `LLMClient.complete(messages)`. Adding a new provider means one class and one `elif` in the factory. Services never know which provider is active.

2. **Factory pattern**: `create_llm_client()` reads config, validates credentials, and returns the appropriate client. If anything fails, it falls back to EchoClient. The system never crashes due to LLM misconfiguration.

3. **Config-driven selection**: Swapping from OpenAI to Gemini is an env var change — zero code changes. This is the same pattern used for shipping providers and embedding providers.

4. **Graceful degradation**: If no LLM is configured, the system still works. RAG retrieves relevant chunks, tools execute queries, and EchoClient returns the raw context. The advisor is less useful but never broken.

5. **Message format standardization**: All providers accept OpenAI-style chat messages. Gemini requires conversion (system → first user message, assistant → model), which is handled transparently in the client. This means services and prompts are provider-agnostic.

6. **Why not dynamic routing?**: For a shipping advisor, the quality difference between models on factual Q&A is small. Config-driven selection keeps the system simple and predictable. Dynamic routing adds complexity without proportional value at this stage.

---

## Limitations

| Limitation | Detail |
|-----------|--------|
| Single provider per deployment | No per-request routing. Change requires restart. |
| No automatic fallback between providers | If OpenAI fails, it returns 502 — does not auto-switch to Gemini. |
| No streaming | Responses are returned as complete strings, not streamed. |
| No conversation memory | Each request is independent. No multi-turn context. |
| Gemini system message handling | System messages are prepended to the first user message (Gemini limitation). |
| Llama quality depends on hardware | Small local models may produce lower-quality answers. |
