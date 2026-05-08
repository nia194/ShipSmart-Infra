# MCP / Tooling Architecture

## Overview

The Python API includes a tool-based orchestration layer that allows the AI system to discover, select, and execute structured tools. Tools are the only way the AI layer interacts with external providers or performs actions — the LLM never calls providers directly.

## Architecture

```
User Query
  → POST /api/v1/orchestration/run
  → Tool Selection (rule-based)
  → Tool Execution (via provider abstraction)
  → Structured Result
  → Human-readable Answer
```

```
app/
├── tools/
│   ├── base.py              # Tool ABC, ToolInput, ToolOutput, ToolParameter
│   ├── registry.py          # ToolRegistry (register, get, list)
│   ├── address_tools.py     # ValidateAddressTool
│   └── quote_tools.py       # GetQuotePreviewTool
├── providers/
│   ├── base.py              # Provider ABC, ProviderResult
│   ├── shipping_provider.py # ShippingProvider ABC (validate_address, get_quote_preview)
│   └── mock_provider.py     # MockShippingProvider (deterministic fake data)
└── services/
    └── orchestration_service.py  # select_tool, run_orchestration, execute_tool
```

## Tool Lifecycle

1. **Registration** — Tools are created and registered in `main.py` lifespan. Each tool receives its provider dependency at construction time.
2. **Discovery** — `GET /api/v1/orchestration/tools` returns all registered tool schemas (name, description, parameters).
3. **Selection** — `select_tool()` matches the query against keyword patterns. Returns the tool name or None.
4. **Validation** — `tool.validate_input(params)` checks required parameters before execution.
5. **Execution** — `tool.execute(ToolInput)` calls the provider and returns `ToolOutput`.
6. **Summarization** — `_summarize_tool_result()` produces a human-readable answer from the structured data.

## Tool Interface

Every tool defines:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Unique identifier (e.g. `validate_address`) |
| `description` | `str` | What the tool does (for LLM selection) |
| `parameters` | `list[ToolParameter]` | Input schema with types and required flags |
| `execute()` | `async (ToolInput) -> ToolOutput` | The actual logic |
| `schema()` | `dict` | JSON-serializable schema for LLM tool use |
| `validate_input()` | `(dict) -> list[str]` | Input validation |

## Registry Design

`ToolRegistry` is a simple name-keyed dictionary:

- `register(tool)` — adds a tool, raises on duplicate name
- `get(name)` — returns tool or None
- `list_tools()` — returns all tools sorted by name
- `list_schemas()` — returns JSON schemas for all tools
- `count()` — number of registered tools

The registry is created at startup, stored in `app.state.tool_registry`, and accessed by route handlers via `request.app.state`.

## Orchestration Flow

### Auto-select mode (no `tool` in request)
1. `select_tool()` matches query text against regex patterns
2. If matched → execute the tool with provided params
3. If no match → return `type: "direct_answer"` (caller can fall back to RAG)

### Explicit mode (`tool` specified in request)
1. Look up tool by name
2. Validate params
3. Execute and return

### Error handling
- Unknown tool → 404
- Invalid params → 422
- Provider failure → 502
- All errors use the existing `AppError` → consistent JSON format

## Implemented Tools

### `validate_address`
- **Input**: street, city, state, zip_code, country (optional)
- **Output**: is_valid, normalized_address, deliverable, address_type
- **Provider**: MockShippingProvider (format checks + title-case normalization)

### `get_quote_preview`
- **Input**: origin_zip, destination_zip, weight_lbs, length_in, width_in, height_in
- **Output**: services array (service, carrier, price_usd, estimated_days), billable_weight, dim_weight
- **Provider**: MockShippingProvider (DIM weight calculation + tiered pricing)
- **Note**: Preview only — does NOT replace Spring Boot quote ownership

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/orchestration/run` | Execute orchestration (auto or explicit tool) |
| GET | `/api/v1/orchestration/tools` | List all registered tools and schemas |

### POST /api/v1/orchestration/run

**Request:**
```json
{
  "query": "Validate this shipping address",
  "tool": "validate_address",
  "params": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001"
  }
}
```

**Response:**
```json
{
  "type": "tool_result",
  "tool_used": "validate_address",
  "answer": "Address is valid and deliverable: 123 Main St, New York, NY, 10001",
  "data": {
    "is_valid": true,
    "normalized_address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "country": "US"
    },
    "deliverable": true,
    "address_type": "residential"
  },
  "metadata": {
    "provider": "mock",
    "tool": "validate_address"
  }
}
```

## Tool Selection (Current: Rule-Based)

The current implementation uses regex patterns to match queries to tools. This is intentionally simple and deterministic for Phase 8.

Phase 9 can upgrade to LLM-assisted tool selection by:
1. Passing tool schemas to the LLM as available functions
2. Having the LLM choose which tool to call (and extract params from the query)
3. Keeping the same Tool/Registry/Provider stack underneath

## What Phase 9 Will Add

- LLM-assisted tool selection (replacing rule-based patterns)
- LLM param extraction from natural-language queries
- Tool result formatting through LLM
- Additional tools (find_dropoff_locations, estimate_delivery_window)
- Real provider integrations (if carrier APIs are available)
- RAG + tool hybrid orchestration (context retrieval + tool execution in one flow)
