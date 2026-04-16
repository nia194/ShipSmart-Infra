# FastAPI Python Service — Foundation

## Overview

The Python API (`apps/api-python`) is the AI/orchestration service for ShipSmart.
It is built on FastAPI and designed to support RAG pipelines, LLM integration,
and MCP/tool orchestration in future phases.

This document describes the foundation layer — the production-ready infrastructure
that was built before any AI features.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check (Render health check path) |
| GET | `/ready` | Readiness check (future: verify DB/LLM connectivity) |
| GET | `/` | Root — returns service name and version |
| GET | `/api/v1/info` | Service metadata (version, env, configured providers) |
| POST | `/api/v1/orchestration/run` | Placeholder — returns not_implemented |

## Project Structure

```
apps/api-python/
├── app/
│   ├── main.py                  # FastAPI app, lifespan, middleware, routes
│   ├── api/routes/
│   │   ├── health.py            # /health, /ready
│   │   ├── info.py              # /api/v1/info
│   │   └── orchestration.py     # Placeholder orchestration endpoint
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (env-based config)
│   │   ├── logging.py           # Structured logging setup
│   │   ├── errors.py            # Centralized exception handlers
│   │   └── middleware.py         # Request logging middleware
│   ├── dependencies/
│   │   └── __init__.py          # FastAPI Depends() providers
│   ├── schemas/                 # Pydantic models (empty — future)
│   └── services/                # Business logic (empty — future)
├── tests/
│   ├── test_health.py
│   ├── test_info.py
│   ├── test_errors.py
│   └── test_config.py
├── pyproject.toml               # Dependencies, build config, ruff/pytest config
└── .env.example                 # Environment variable reference
```

## Configuration

Environment-based configuration via `pydantic-settings`. All settings have defaults
and work without a `.env` file for local development.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ENV` | `development` | Environment name |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `INTERNAL_JAVA_API_URL` | `http://localhost:8080` | Java API base URL |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated origins |
| `SUPABASE_URL` | (empty) | Supabase project URL |
| `SUPABASE_ANON_KEY` | (empty) | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | (empty) | Supabase service key |
| `OPENAI_API_KEY` | (empty) | Placeholder for future LLM integration |
| `ANTHROPIC_API_KEY` | (empty) | Placeholder for future LLM integration |
| `LLM_PROVIDER` | (empty) | Placeholder (e.g., "openai", "anthropic") |
| `EMBEDDING_PROVIDER` | (empty) | Placeholder for vector embeddings |
| `VECTOR_STORE_URL` | (empty) | Placeholder for vector database |
| `RAG_PROVIDER` | (empty) | Placeholder for RAG pipeline config |

## Error Handling

All errors return a consistent JSON format:

```json
{
  "status": 422,
  "error": "Validation Error",
  "message": "body.workflow: Field required",
  "path": "/api/v1/orchestration/run",
  "timestamp": "2026-04-06T..."
}
```

Handlers:
- `RequestValidationError` → 422 with field-level messages
- `AppError` → custom status code (for business logic errors)
- `Exception` → 500 (no sensitive data leaked)

## Logging

- Structured format: `timestamp [LEVEL] [logger] message`
- Request logging middleware: method, path, status, duration, request_id
- Request ID returned in `X-Request-Id` response header
- Configurable via `LOG_LEVEL` environment variable

## Dependency Injection

Two DI providers available for route handlers:
- `get_settings()` — returns the config singleton
- `get_http_client()` — returns the shared `httpx.AsyncClient` for Java API calls

The HTTP client is created on startup and closed on shutdown via the lifespan manager.

## What's Planned for Future Phases

1. **RAG pipelines** — document retrieval, embedding, vector search
2. **LLM integration** — OpenAI/Anthropic API calls for shipping advice
3. **MCP/tool orchestration** — tool-use workflows coordinating multiple services
4. **Workflow handlers** — shipping advisor, tracking advisor, customs docs, etc.

## Running Locally

```bash
cd apps/api-python
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Running Tests

```bash
cd apps/api-python
uv run pytest -v
```
