# Task-Based LLM Routing

ShipSmart's Python API can route different LLM tasks to different providers
without code changes. This lets us pick the best (or cheapest) model for each
job — for example OpenAI for advisor reasoning and Gemini for RAG synthesis —
while keeping the existing `LLMClient` abstraction intact.

## Tasks

| Task        | Used by                                      | Why                                                              |
|-------------|----------------------------------------------|------------------------------------------------------------------|
| `reasoning` | `POST /api/v1/advisor/shipping`, `/tracking` | Multi-step reasoning over RAG context + tool results.            |
| `synthesis` | `POST /api/v1/rag/query`, recommendation summary | Lighter, grounded text generation from already-structured input. |
| `fallback`  | Any task whose configured provider can't be built | Always available — defaults to `EchoClient`.                     |

The mapping between routes and tasks lives in `app/api/routes/advisor.py`
and `app/api/routes/rag.py`. The router itself lives in `app/llm/router.py`.

## Default mapping (recommended)

```env
LLM_PROVIDER_REASONING=openai
LLM_PROVIDER_SYNTHESIS=gemini
LLM_PROVIDER_FALLBACK=echo
```

**Why this mapping?**
- Reasoning over tool results benefits from OpenAI's stronger instruction
  following and tool/function semantics.
- RAG synthesis is grounded extraction over retrieved chunks; Gemini Flash is
  faster and cheaper for that pattern and the quality difference is small.
- `echo` as fallback guarantees the app stays usable when keys are missing.

The mapping is **not** hardcoded — any task can be pointed at any supported
provider (`openai`, `gemini`, `llama`, `echo`).

## Resolution order

For each task the router resolves a provider in this order:

1. `LLM_PROVIDER_<TASK>` if set
2. Legacy `LLM_PROVIDER` (so existing single-provider deployments keep working)
3. `LLM_PROVIDER_FALLBACK`
4. `EchoClient`

If a chosen provider can't be built (unknown name, missing key, init error),
the router logs a warning and uses the fallback. The application **never**
fails to start because of LLM config.

## Environment variables

```env
# Task-based routing
LLM_PROVIDER_REASONING=openai
LLM_PROVIDER_SYNTHESIS=gemini
LLM_PROVIDER_FALLBACK=echo

# Per-provider settings (unchanged)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
LLAMA_BASE_URL=http://localhost:11434
LLAMA_MODEL=llama3.2

# Shared LLM tuning
LLM_TIMEOUT=30
LLM_MAX_TOKENS=1024
LLM_TEMPERATURE=0.3
```

The legacy `LLM_PROVIDER` env var is still honoured: if a task-specific
variable is empty it inherits from `LLM_PROVIDER`. Existing deployments need
zero changes.

## Test locally

```bash
cd apps/api-python
python -m pytest tests/test_llm_router.py -q
```

To exercise the routing path end-to-end against EchoClient:

```bash
LLM_PROVIDER_REASONING=echo LLM_PROVIDER_SYNTHESIS=echo \
  python -m pytest tests/test_advisor.py tests/test_rag.py -q
```

To try a real mixed configuration locally:

```bash
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
export LLM_PROVIDER_REASONING=openai
export LLM_PROVIDER_SYNTHESIS=gemini
python -m uvicorn app.main:app --reload
```

On startup you'll see a log line like:

```
LLM router initialized: {'reasoning': 'openai', 'synthesis': 'gemini', 'fallback': 'echo'}
```

## Interview talking points

- **Why a router and not a switch?** Each task is a stable contract; changing
  the underlying provider should not require touching service code. The
  router holds one prebuilt client per task, looked up by string key.
- **Why config-driven?** It's the simplest thing that gives ops a knob and
  removes magic. No scoring, no dynamic selection, no hidden heuristics —
  what you set is what you get.
- **Why per-task fallback?** A missing Gemini key shouldn't take down the
  advisor endpoints. Each task degrades independently to the configured
  fallback (typically `echo`), so partial outages stay partial.
- **Back-compat:** The legacy `create_llm_client()` factory and the
  `app.state.rag["llm_client"]` slot are preserved. Existing tests and any
  external callers keep working unchanged.
- **Where it lives:** `app/llm/router.py` (one file, ~100 lines). The router
  delegates to `build_provider_client()` in `app/llm/client.py`, so adding a
  new provider only means adding a branch in one place.

## Limitations / not implemented

- No per-task overrides for `LLM_TIMEOUT`, `LLM_TEMPERATURE`, or
  `LLM_MAX_TOKENS`. All tasks share the same LLM tuning.
- No request-time provider selection or A/B routing.
- No retry across providers — a task uses exactly one client; if that client
  raises at request time the existing error handling applies.
- No metrics per task. Logs name the selected provider but there is no
  counter or histogram.

## Recommended next step

Add per-task model/temperature overrides (e.g. `LLM_MODEL_REASONING`,
`LLM_TEMPERATURE_SYNTHESIS`) so we can tune precision vs cost per task
without forking provider config. This is a small extension of the existing
resolution logic and does not require new abstractions.
