# LLM Runtime Modes

How the system selects and falls back between LLM providers at runtime.

> **Update — task-based routing.** Since the routing refactor, providers can
> be picked **per task** (`reasoning`, `synthesis`, `fallback`) rather than
> globally. The single-provider flow below still works as a fallback / legacy
> mode. See [`task-based-llm-routing.md`](./task-based-llm-routing.md) and
> [`model-selection-by-task.md`](./model-selection-by-task.md) for the full
> design. Each task resolves independently — a missing key for one task does
> not affect the other.

---

## Provider Selection Flow

```
Startup (main.py)
  │
  ├─ Read LLM_PROVIDER from config
  │
  ├─ "" (empty) ────────────────────────► EchoClient (no external calls)
  │
  ├─ "openai"
  │   ├─ OPENAI_API_KEY set? ──── No ──► EchoClient (fallback + warning)
  │   └─ OPENAI_API_KEY set? ── Yes ──► OpenAIClient
  │
  ├─ "gemini"
  │   ├─ GEMINI_API_KEY set? ──── No ──► EchoClient (fallback + warning)
  │   └─ GEMINI_API_KEY set? ── Yes ──► GeminiClient
  │
  ├─ "llama"
  │   └─ Always ────────────────────────► LlamaClient (no key needed)
  │
  └─ Unknown ───────────────────────────► EchoClient (fallback + warning)
```

---

## Modes

### 1. EchoClient (Default / Fallback)

- **When**: `LLM_PROVIDER` is empty, unset, or credentials are missing
- **Behavior**: Returns retrieved document excerpts without LLM processing
- **Cost**: Zero
- **Quality**: Low — answers are document dumps, not conversational
- **Use for**: Development, testing pipeline architecture, demos without API costs

### 2. OpenAI (Primary Production)

- **When**: `LLM_PROVIDER=openai` and `OPENAI_API_KEY` is set
- **Behavior**: Sends messages to OpenAI Chat Completions API
- **Features**: Configurable model, timeout (30s default), 2 auto-retries, temperature control
- **Quality**: High — conversational, grounded answers using RAG context
- **Use for**: Production, integration testing with real AI

### 3. Gemini (Secondary / Alternative)

- **When**: `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` is set
- **Behavior**: Sends messages to Google Gemini REST API
- **Features**: Automatic message format conversion (OpenAI chat → Gemini contents), system message merging
- **Quality**: High — competitive with OpenAI for most shipping advisor tasks
- **Use for**: Alternative to OpenAI, longer context windows, cost optimization

### 4. Llama (Local / Offline)

- **When**: `LLM_PROVIDER=llama`
- **Behavior**: Calls Ollama's OpenAI-compatible endpoint on localhost
- **Features**: No API key needed, uses the openai client library with custom base_url
- **Quality**: Varies by model — llama3.2 is capable for shipping advice
- **Use for**: Offline development, privacy-sensitive environments, no API cost

---

## Fallback Triggers

The system falls back to EchoClient when:

| Trigger | Example |
|---------|---------|
| Missing API key | `LLM_PROVIDER=openai` but `OPENAI_API_KEY=""` |
| Unknown provider name | `LLM_PROVIDER=gpt` |
| Provider instantiation error | Import fails or constructor throws |
| Empty/unset provider | `LLM_PROVIDER=` |

All fallbacks log a warning. The system never crashes due to LLM misconfiguration. RAG retrieval, tool execution, and all other services continue to work normally.

---

## Runtime Error Handling

If a configured provider fails during a request (API error, timeout, network issue):

| Provider | Behavior |
|----------|----------|
| OpenAI | Retries up to 2 times (built into openai SDK), then raises `AppError(502)` |
| Gemini | Single attempt, raises `AppError(502)` on failure |
| Llama | Single retry (built into openai SDK), raises `AppError(502)` on failure |
| EchoClient | Never fails (no external calls) |

The `502` error is caught by the global error handler and returned as a clean JSON error to the frontend. The advisor page shows the error; the quote flow is unaffected (it uses the Java API, not the LLM).

---

## How Services Use the LLM Client

All services receive the LLM client via `app.state.rag["llm_client"]`:

```
main.py → create_llm_client() → app.state.rag["llm_client"]
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              rag_service      shipping_advisor     tracking_advisor
              (RAG query)      (RAG + tools)        (RAG + tools)
```

All services call `llm_client.complete(messages)` with the same chat message format. They never know which concrete provider is behind the interface.
