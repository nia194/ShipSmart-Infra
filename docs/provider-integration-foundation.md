# Provider Integration Foundation

## Overview

The Python API uses a provider abstraction layer to isolate tool logic from external service implementations. Tools call providers through typed interfaces — never directly. This allows swapping between mock, test, and real implementations without changing tool code.

## Architecture

```
Tool → ShippingProvider (ABC) → MockShippingProvider
                               → (future) UPSProvider
                               → (future) FedExProvider
```

```
app/providers/
├── base.py              # Provider ABC, ProviderResult
├── shipping_provider.py # ShippingProvider ABC + data classes
└── mock_provider.py     # MockShippingProvider implementation
```

## Provider Interface

### Base (`Provider`)

All providers implement:
- `name` — unique identifier string
- `health_check()` — returns True if the provider is operational

### ShippingProvider

Extends `Provider` with shipping-specific methods:
- `validate_address(AddressInput) -> ProviderResult`
- `get_quote_preview(QuotePreviewInput) -> ProviderResult`

### ProviderResult

Standardized return type for all provider calls:

| Field | Type | Description |
|-------|------|-------------|
| `success` | `bool` | Whether the operation succeeded |
| `data` | `dict` | Structured result data |
| `provider` | `str` | Provider name (for tracing) |
| `error` | `str \| None` | Error message if failed |

## Data Classes

### AddressInput
- `street`, `city`, `state`, `zip_code`, `country` (default "US")

### QuotePreviewInput
- `origin_zip`, `destination_zip`, `weight_lbs`, `length_in`, `width_in`, `height_in`

## MockShippingProvider

Deterministic mock for development and testing:

### Address Validation
- Checks required fields (street, city, state non-empty)
- Validates US zip code format (5 digits or 5+4)
- Normalizes: title-case street/city, uppercase state, trim whitespace
- Returns `is_valid`, `normalized_address`, `deliverable`, `address_type`

### Quote Preview
- Calculates DIM weight: `(L × W × H) / 139`
- Uses billable weight = max(actual, DIM)
- Returns 3 service tiers: Ground, Express, Overnight
- Includes disclaimer that this is not a binding quote

## Adding a New Provider

1. Create a class implementing `ShippingProvider` in `app/providers/`
2. Implement `validate_address()` and `get_quote_preview()`
3. Add factory logic or config-based selection in `main.py`
4. Tools receive the provider via constructor injection — no tool changes needed

## What Is Mock vs Real

| Component | Status | Notes |
|-----------|--------|-------|
| MockShippingProvider | Implemented | Deterministic, no API calls |
| UPS Provider | Not started | Would require UPS API credentials |
| FedEx Provider | Not started | Would require FedEx API credentials |
| USPS Provider | Not started | Would require USPS Web Tools registration |

## Service Boundary

**Python provides**: AI-assisted previews, address validation, tool orchestration

**Spring Boot owns**: Real quotes, saved options, booking redirects, all transactional data

The `get_quote_preview` tool explicitly returns a disclaimer that final quotes come from the Java API. Python never writes quote data or replaces the Spring Boot quote flow.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SHIPPING_PROVIDER` | `mock` | Which provider to use |
| `ENABLE_TOOLS` | `true` | Master switch for tool system |

## Future Enhancements

- Real carrier API integrations behind the same interface
- Provider health monitoring and fallback
- Rate limiting per provider
- Caching for address validation results
- Multi-provider aggregation (query multiple carriers in parallel)
