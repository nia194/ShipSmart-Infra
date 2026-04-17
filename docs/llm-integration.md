# LLM Integration Guide

## Overview

The Python API abstracts LLM access behind a `LLMClient` interface, allowing easy swap between providers without changing application code.

## Architecture

```
LLMClient (ABC)
  ├── OpenAIClient    — real completions via OpenAI API
  └── EchoClient      — dev placeholder, no API calls
```

The factory function `create_llm_client()` selects the implementation based on the `LLM_PROVIDER` environment variable.

## Providers

### OpenAI (`LLM_PROVIDER=openai`)

Requires `OPENAI_API_KEY`. Uses `gpt-4o-mini` by default (configurable via `OPENAI_MODEL`).

Configuration:
- Temperature: 0.3 (factual, low creativity)
- Max tokens: 1024

### Echo (default when `LLM_PROVIDER` is empty)

Returns the user's query with a notice that no LLM is configured. Used for development and testing the pipeline without API costs.

## Prompt Structure

RAG queries use a three-part prompt (`app/llm/prompts.py`):

1. **System message** — instructs the LLM to act as a shipping assistant, answer from context, and be honest when context is insufficient
2. **User message** — combines retrieved context chunks (separated by `---`) with the user's question

## Adding a New Provider

1. Create a class implementing `LLMClient` in `app/llm/client.py`
2. Implement `async def complete(self, messages: list[dict[str, str]]) -> str`
3. Add a branch in `create_llm_client()` for the new provider name
4. Add the provider's API key to config and `.env.example`

## Error Handling

- OpenAI errors are caught and re-raised as `AppError(502)` to avoid leaking provider details
- Missing API key raises `ValueError` at startup (fail-fast)
