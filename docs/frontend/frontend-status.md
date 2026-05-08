# Frontend Status

Last updated: 2026-04-05 (after Phase 5 — Stabilization)

## Fully Working

- **Routing** — `/` (home), `/auth` (login/signup), `/saved` (bookmarked services), 404 fallback
- **Authentication** — Email/password signup and login via Supabase Auth, session persistence, auto-refresh tokens, profile display name fetch
- **Quote Search** — 3-step wizard (cities → dates → packages), city autocomplete (45 US cities), date pickers with validation, multi-package support with type/weight/dimensions/handling
- **Quote Results** — Prime and Private provider sections, expandable rows with promo codes, AI recommendations, price breakdowns, feature tags, booking links with redirect tracking
- **Saved Options** — Bookmark toggle on quotes (context-aware snapshot keys), saved services page with route/package/delivery details, notification subscription UI (local state)
- **Code Splitting** — Route-level lazy loading for HomePage, AuthPage, SavedPage (initial bundle 563KB, down from 718KB)
- **Design System** — Outfit font, ShipSmart custom CSS (shipsmart.css), shadcn/ui components with Tailwind, HSL design tokens for light/dark mode

## Still Legacy (Supabase Edge Functions)

These 5 edge functions power the current frontend and will migrate to `api-java`:

| Function | Purpose | Frontend Hook/Component |
|---|---|---|
| `get-shipping-quotes` | Quote search engine | `useShippingQuotes` |
| `get-saved-options` | Load saved services | `useSavedOptions` |
| `save-option` | Save a service | `useSavedOptions` |
| `remove-saved-option` | Remove a saved service | `useSavedOptions` |
| `generate-book-redirect` | Track booking clicks | `QuoteRow` |

9 additional placeholder edge functions exist for AI/MCP features (no working logic). See `docs/legacy-edge-functions.md` for full classification.

## Not Implemented Yet

- **Real carrier integrations** — Quote data comes from the edge function's mock/algorithmic engine, not live carrier APIs (UPS, FedEx, DHL)
- **Java backend APIs** (`api-java`) — Spring Boot service to replace the 5 implemented edge functions
- **Python AI services** (`api-python`) — FastAPI service for AI advisor, priority interpreter, notification generator, tracking advisor
- **MCP integrations** — Calendar reminders, drop-off locations, email import, address validation, issue escalation
- **Notification delivery** — Email and SMS subscription toggles exist in UI but are local state only (no Twilio/SendGrid integration)
- **Real address validation** — City input uses a static list of 45 US cities, not a geocoding API
- **Dark mode** — CSS variables are defined but no toggle exists in the UI

## Bundle Size

| Chunk | Size | Gzip |
|---|---|---|
| `index.js` (shared) | 563 KB | 168 KB |
| `HomePage.js` | 144 KB | 42 KB |
| `SavedPage.js` | 7.2 KB | 2.3 KB |
| `AuthPage.js` | 3.7 KB | 1.4 KB |
| `Logo.js` (shared) | 3.2 KB | 1.7 KB |
| `index.css` | 62 KB | 11 KB |

## What's Next

### Phase 1 — Backend (Spring Boot)
1. Implement Java API endpoints for: quotes, saved options, booking redirect
2. Update frontend hooks to call `apiConfig.javaApiBaseUrl` instead of `supabase.functions.invoke()`
3. Deprecate and remove the 5 implemented edge functions
4. Wire up real carrier API integrations

### Phase 2 — AI/Orchestration (FastAPI)
1. Implement Python API endpoints for AI advisor, priority interpreter, tracking advisor
2. Set up LLM provider (replace Lovable AI Gateway)
3. Implement MCP tool connectors (calendar, email, SMS)
4. Remove the 9 placeholder edge functions
