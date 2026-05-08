# Legacy Edge Functions — Classification & Migration Targets

All 14 Supabase edge functions were migrated from the Lovable source as-is.
Each file has a `LEGACY` comment header. **Do NOT modify these functions — migrate and delete instead.**

## Classification

| Function | Status | Category | Frontend Caller | Migration Target |
|---|---|---|---|---|
| `get-shipping-quotes` | Implemented | Core quote engine | `useShippingQuotes` | api-java |
| `get-saved-options` | Implemented | CRUD — saved options | `useSavedOptions` | api-java |
| `save-option` | Implemented | CRUD — saved options | `useSavedOptions` | api-java |
| `remove-saved-option` | Implemented | CRUD — saved options | `useSavedOptions` | api-java |
| `generate-book-redirect` | Implemented | Booking redirect | `QuoteRow` | api-java |
| `ai-shipping-advisor` | Placeholder | AI — LLM advisor | Not wired | api-python |
| `ai-tracking-advisor` | Placeholder | AI — LLM advisor | Not wired | api-python |
| `ai-notification-generator` | Placeholder | AI — LLM notifications | Not wired | api-python |
| `ai-priority-interpreter` | Placeholder | AI — priority ranking | Not wired | api-python |
| `create-shipment-reminders` | Placeholder | MCP — calendar/reminders | Not wired | api-python |
| `escalate-tracking-issue` | Placeholder | MCP — issue escalation | Not wired | api-python |
| `find-dropoff-locations` | Placeholder | MCP — geolocation | Not wired | api-python |
| `import-tracking-from-email` | Placeholder | MCP — email parsing | Not wired | api-python |
| `validate-address` | Placeholder | MCP — address normalization | Not wired | api-python |

## Status Key

- **Implemented** — Contains real business logic. Currently invoked by the frontend via `supabase.functions.invoke()`. Required for operational parity.
- **Placeholder** — Contains detailed design comments but no working logic. Three reference the Lovable AI Gateway (`ai.gateway.lovable.dev`) which is non-functional outside Lovable.

## Migration Priority

1. **Keep temporarily (5 functions):** `get-shipping-quotes`, `get-saved-options`, `save-option`, `remove-saved-option`, `generate-book-redirect` — these are the live backend for the current frontend. Migrate to api-java when endpoints are ready.
2. **Defer (9 functions):** All AI/MCP placeholders — no working logic to preserve. Implement fresh in api-python when the AI/orchestration layer is built.

## Lovable AI Gateway References

Three functions (`ai-shipping-advisor`, `ai-tracking-advisor`, `ai-notification-generator`) reference `https://ai.gateway.lovable.dev/v1/chat/completions`. This endpoint is only available inside the Lovable platform and will not function in the ShipSmart deployment.

## Frontend Integration Points

The frontend calls edge functions via `supabase.functions.invoke("function-name", { body })`.
These calls are in:
- `apps/web/src/hooks/useShippingQuotes.ts` — `get-shipping-quotes`
- `apps/web/src/hooks/useSavedOptions.ts` — `get-saved-options`, `save-option`, `remove-saved-option`
- `apps/web/src/components/shipping/QuoteRow.tsx` — `generate-book-redirect`

When migrating to api-java, update these files to use `apiConfig.javaApiBaseUrl` endpoints instead.
