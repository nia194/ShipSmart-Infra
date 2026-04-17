# Model Selection by Task

Quick reference for which model handles which task in the Python API.
For the full design and rationale see
[`task-based-llm-routing.md`](./task-based-llm-routing.md).

## Mapping

| Task        | Default provider | Default model     | Endpoints / callers                                  |
|-------------|------------------|-------------------|-------------------------------------------------------|
| `reasoning` | OpenAI           | `gpt-4o-mini`     | `POST /api/v1/advisor/shipping`, `/advisor/tracking` |
| `synthesis` | Gemini           | `gemini-2.0-flash`| `POST /api/v1/rag/query`, `/advisor/recommendation`  |
| `fallback`  | Echo             | (none)            | Any task whose configured provider is unavailable    |

The defaults above are the **recommended** mapping. Actual values come from
env vars and can be changed without code edits.

## Why this mapping

- **Reasoning → OpenAI.** Advisor endpoints stitch together RAG context and
  tool-call results, then need to produce structured, instruction-following
  output. OpenAI's `gpt-4o-mini` is the cheapest model that handles this
  reliably for our prompts.
- **Synthesis → Gemini.** RAG q&a and recommendation summaries are
  short, grounded generation tasks. Gemini Flash is roughly an order of
  magnitude cheaper per token and the quality difference on grounded tasks
  is negligible.
- **Fallback → Echo.** Echo never makes a network call and never fails. It
  keeps the API up when keys are missing or providers are down.

## Override matrix

```env
# Want everything on OpenAI? Either set LLM_PROVIDER (legacy single mode)…
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# …or set each task explicitly:
LLM_PROVIDER_REASONING=openai
LLM_PROVIDER_SYNTHESIS=openai

# Want local-only dev with Ollama?
LLM_PROVIDER_REASONING=llama
LLM_PROVIDER_SYNTHESIS=llama
LLAMA_BASE_URL=http://localhost:11434
LLAMA_MODEL=llama3.2

# Want zero external calls (CI, offline)?
# Leave everything unset — both tasks resolve to EchoClient.
```

## How to verify which model is being used

On startup the router logs:

```
LLM router: task=reasoning → provider=openai
LLM router: task=synthesis → provider=gemini
LLM router initialized: {'reasoning': 'openai', 'synthesis': 'gemini', 'fallback': 'echo'}
```

If a task you expected to be `openai` shows up as `echo`, the most common
cause is a missing `OPENAI_API_KEY` — check the warning line just above the
router init message.
