# Provider Capability Matrix

What each provider supports, what's real vs stubbed, and known limitations.

---

## Capability Summary

| Capability | Mock | UPS | FedEx | DHL | USPS |
|------------|------|-----|-------|-----|------|
| Address Validation | Local format check | Real API | Real API | Local format check | Real API |
| Quote Preview / Rating | Synthetic rates | Real API (Shop) | Real API | Real API | Real API |
| OAuth2 Token Management | N/A | Yes (auto-refresh) | Yes (auto-refresh) | N/A (Basic auth) | Yes (auto-refresh) |
| Domestic US Rates | Yes (synthetic) | Yes | Yes | Limited | Yes |
| International Rates | No | Possible (not scoped) | Possible (not scoped) | Primary strength | No (separate API) |
| Health Check | Always true | Token acquisition | Token acquisition | Lightweight rate call | Token acquisition |

---

## What Is Real vs Stubbed

### UPS (`ups_provider.py`)
- **Real**: OAuth2 auth, Address Validation API v1, Rating API v2401 (Shop mode)
- **Real**: Service code mapping (Ground, 2nd Day, Next Day, 3 Day Select, etc.)
- **Real**: Billable weight / DIM weight calculation
- **Stubbed**: Nothing — both operations call real UPS APIs

### FedEx (`fedex_provider.py`)
- **Real**: OAuth2 auth, Address Validation API v1, Rate API v1
- **Real**: Service type mapping (Ground, Express Saver, 2Day, Overnight, etc.)
- **Real**: Residential vs commercial classification from address attributes
- **Stubbed**: Nothing — both operations call real FedEx APIs

### DHL (`dhl_provider.py`)
- **Real**: Basic auth, Express Rates API (MyDHL API)
- **Real**: Product code mapping (Express Worldwide, Express 9:00, 12:00, etc.)
- **Stubbed**: Address validation is local format check only (DHL Express does not offer a public address validation API)
- **Limitation**: DHL Express is primarily international. Domestic US-to-US rates may return empty or limited results.

### USPS (`usps_provider.py`)
- **Real**: OAuth2 auth, Addresses API v3, Domestic Prices API v3
- **Real**: Mail class mapping (Priority Mail Express, Priority Mail, Ground Advantage, etc.)
- **Real**: USPS-specific DIM factor (166, not 139)
- **Stubbed**: Nothing — both operations call real USPS APIs
- **Limitation**: Uses NEW USPS APIs only (not deprecated Web Tools). International rates require a separate API endpoint (not implemented).

### Mock (`mock_provider.py`)
- **All stubbed**: Returns deterministic synthetic data
- Address validation: format checks + title-case normalization
- Quote preview: weight-based pricing formula with 3 service tiers

---

## Environment Variables per Provider

| Provider | Required | Optional |
|----------|----------|----------|
| **UPS** | `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` | `UPS_ACCOUNT_NUMBER`, `UPS_BASE_URL` |
| **FedEx** | `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET` | `FEDEX_ACCOUNT_NUMBER`, `FEDEX_BASE_URL` |
| **DHL** | `DHL_API_KEY`, `DHL_API_SECRET` | `DHL_ACCOUNT_NUMBER`, `DHL_BASE_URL` |
| **USPS** | `USPS_CLIENT_ID`, `USPS_CLIENT_SECRET` | `USPS_BASE_URL` |
| **Mock** | None | None |

All providers require `SHIPPING_PROVIDER` to be set to their name.

---

## Error Handling

All providers follow the same error handling pattern:

1. **Network errors** (`httpx.HTTPError`): Caught, logged, returned as `ProviderResult(success=False)` with error message
2. **HTTP non-200 responses**: Returned as `ProviderResult(success=False)` with status code
3. **Auth failures**: Token acquisition raises `RuntimeError` → caught by factory fallback
4. **Missing credentials**: Detected by factory before instantiation → falls back to mock

No provider raises unhandled exceptions to the tool layer. Tools always receive a `ProviderResult`.

---

## Limitations

| Limitation | Provider | Detail |
|-----------|----------|--------|
| No address validation API | DHL | DHL Express has no public AV endpoint. Local format check only. |
| Domestic-only pricing | USPS | International prices require a separate USPS API (not implemented). |
| Primarily international | DHL | Domestic US-to-US may return limited/no results. |
| No negotiated rates without account | UPS | Account number needed for discounted rates. |
| Hardcoded US country | All real | Origin/destination country is hardcoded to "US". International support requires additional work. |
| No label generation | All | Providers handle rating and address validation only. Booking/labels are Spring Boot's responsibility. |
