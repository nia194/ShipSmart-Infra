# Provider Runtime Modes

How the system selects and falls back between shipping providers at runtime.

---

## Provider Selection Flow

```
Startup (main.py)
  │
  ├─ Read SHIPPING_PROVIDER from config
  │
  ├─ "mock" or "" ──────────────────────► MockShippingProvider
  │
  ├─ "ups" / "fedex" / "dhl" / "usps"
  │   │
  │   ├─ Credentials present? ──── No ──► MockShippingProvider (fallback + warning)
  │   │
  │   └─ Credentials present? ── Yes ──► Real provider instance
  │
  └─ Unknown name ──────────────────────► MockShippingProvider (fallback + warning)
```

---

## Modes

### 1. Mock Mode (default)

- `SHIPPING_PROVIDER=mock` or unset
- Uses `MockShippingProvider`
- Returns synthetic, deterministic rates
- No external API calls
- Suitable for: development, testing, demos

### 2. Real Provider Mode

- `SHIPPING_PROVIDER=ups` (or `fedex`, `dhl`, `usps`)
- Required credentials must be set
- Makes real API calls to the carrier
- Returns actual rates and address validation
- Suitable for: production, integration testing with real accounts

### 3. Fallback Mode (automatic)

- `SHIPPING_PROVIDER=ups` but credentials are empty
- System logs a warning and falls back to `MockShippingProvider`
- No crash, no error to the user
- Tools continue to work transparently
- Suitable for: environments where some providers are configured and others aren't

---

## Fallback Triggers

The system falls back to mock when:

| Trigger | Example |
|---------|---------|
| Missing credentials | `UPS_CLIENT_ID` is empty |
| Unknown provider name | `SHIPPING_PROVIDER=carrier_pigeon` |
| Provider import error | Missing dependency or code error |
| Any instantiation failure | Runtime exception during provider `__init__` |

All fallbacks log a warning. The system never crashes due to provider misconfiguration.

---

## Runtime Behavior by Provider

| Provider | Address Validation | Quote Preview | Auth |
|----------|-------------------|---------------|------|
| **Mock** | Local format check | Synthetic rates | None |
| **UPS** | UPS Address Validation API | UPS Rating API (Shop) | OAuth2 |
| **FedEx** | FedEx Address Validation API | FedEx Rate API | OAuth2 |
| **DHL** | Local format check only (no DHL AV API) | DHL Express Rates API | Basic auth |
| **USPS** | USPS Addresses API v3 | USPS Domestic Prices API v3 | OAuth2 |

---

## How Tools Interact with Providers

Tools (`ValidateAddressTool`, `GetQuotePreviewTool`) receive a `ShippingProvider` via constructor injection. They call `provider.validate_address()` or `provider.get_quote_preview()` — they never know which concrete provider is behind the interface.

```
Tool ──► ShippingProvider ABC ──► UPSProvider / FedExProvider / MockProvider / ...
```

Swapping the provider requires zero changes to tool code, service code, or route code. Only the factory decision in `main.py` changes — and that reads from config.
