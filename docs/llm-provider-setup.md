# LLM Provider Setup

How to configure LLM providers for ShipSmart's AI advisor and RAG system.

---

## Quick Start

### Option 1: OpenAI (Recommended)

1. Get an API key from https://platform.openai.com/
2. Edit `apps/api-python/.env`:
   ```
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```
3. Restart the Python API
4. Test: `POST /api/v1/rag/query` with `{"query": "What carriers does ShipSmart support?"}`

### Option 2: Google Gemini

1. Get an API key from https://ai.google.dev/
2. Edit `apps/api-python/.env`:
   ```
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your-gemini-key-here
   GEMINI_MODEL=gemini-2.0-flash
   ```
3. Restart the Python API

### Option 3: Local Llama (via Ollama)

1. Install Ollama from https://ollama.com/
2. Pull a model: `ollama pull llama3.2`
3. Start Ollama (runs on port 11434 by default)
4. Edit `apps/api-python/.env`:
   ```
   LLM_PROVIDER=llama
   LLAMA_BASE_URL=http://localhost:11434
   LLAMA_MODEL=llama3.2
   ```
5. Restart the Python API

### Option 4: No LLM (Development Default)

Leave `LLM_PROVIDER` empty or unset. The system uses `EchoClient`, which returns retrieved document excerpts without LLM processing.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `""` (empty) | `openai`, `gemini`, `llama`, or empty for EchoClient |
| `LLM_TIMEOUT` | `30` | Request timeout in seconds |
| `LLM_MAX_TOKENS` | `1024` | Maximum tokens in LLM response |
| `LLM_TEMPERATURE` | `0.3` | Response creativity (0.0-1.0, lower = more deterministic) |
| `OPENAI_API_KEY` | `""` | OpenAI API key (required for `openai` provider) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model ID |
| `GEMINI_API_KEY` | `""` | Google Gemini API key (required for `gemini` provider) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model ID |
| `LLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `LLAMA_MODEL` | `llama3.2` | Ollama model name |

---

## Where to Set Secrets

| Environment | Location |
|-------------|----------|
| Local development | `apps/api-python/.env` (git-ignored) |
| Production (Render) | Render dashboard > service env vars |

**Never put API keys in** `.env.example`, `config.py`, `render.yaml`, or any committed file.

---

## Cost Considerations

| Provider | Cost Model | Approximate Cost |
|----------|-----------|-----------------|
| OpenAI (gpt-4o-mini) | Per-token | ~$0.15/1M input + $0.60/1M output tokens |
| OpenAI (gpt-4o) | Per-token | ~$2.50/1M input + $10/1M output tokens |
| Gemini (2.0 Flash) | Per-token | Free tier available, then per-token |
| Llama (local) | Compute only | Free (runs on your hardware) |
| EchoClient | Free | No external calls |

For a typical advisor query (500 token input + 200 token output):
- gpt-4o-mini: ~$0.0002 per query
- gpt-4o: ~$0.003 per query

At 1000 queries/day with gpt-4o-mini: ~$0.20/day or ~$6/month.

---

## Verification

After configuration, verify the provider is working:

```bash
# Check which provider is active (in startup logs)
# Look for: "RAG pipeline initialized (embedding=..., llm=OpenAIClient)"

# Test RAG query
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is dimensional weight?"}'

# Test shipping advisor
curl -X POST http://localhost:8000/api/v1/advisor/shipping \
  -H "Content-Type: application/json" \
  -d '{"query": "Compare UPS Ground vs FedEx Ground"}'
```

A real LLM provider will return conversational, synthesized answers. EchoClient returns raw document excerpts.
