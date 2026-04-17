# ShipSmart — Frontend Migration Plan (Lovable → Monorepo)

> Generated: 2026-04-05
> Source: `C:/Users/ashis/OneDrive/Documents/lovable-source-code`
> Destination: `C:/Users/ashis/OneDrive/Documents/ShipSmart` (monorepo)

---

## 1. Lovable Project Structure Summary

**Stack:** React 18 + TypeScript + Vite 5 + Tailwind 3 + shadcn/ui + Supabase
**Package manager:** bun (source) → pnpm (destination)
**UI library:** 58 shadcn/ui components (Radix UI primitives + Tailwind)
**Routing:** React Router v6 (4 routes: `/`, `/auth`, `/saved`, `*`)
**State:** Context API (auth) + custom hooks + TanStack React Query
**Backend:** Supabase Auth + PostgreSQL + 14 Deno Edge Functions

### File Inventory

| Category | Count | Location |
|---|---|---|
| Pages | 5 | `src/pages/` |
| Custom components (shipping) | 5 | `src/components/shipping/` |
| Navigation component | 1 | `src/components/NavLink.tsx` |
| shadcn/ui components | 58 | `src/components/ui/` |
| Custom hooks | 4 | `src/hooks/` |
| Auth context | 1 | `src/contexts/` |
| Lib files | 3 | `src/lib/` |
| Supabase integration | 2 | `src/integrations/supabase/` |
| Stylesheets | 3 | `src/index.css`, `src/App.css`, `src/styles/shipsmart.css` |
| Tests | 2 | `src/test/` |
| Entry points | 2 | `src/main.tsx`, `src/App.tsx` |
| Other | 1 | `src/vite-env.d.ts` |
| Public assets | 3 | `public/` |
| Supabase migrations | 2 | `supabase/migrations/` |
| Supabase edge functions | 14 | `supabase/functions/` |

**Total: ~87 source files + 14 edge functions**

---

## 2. File-by-File Migration Map

### 2A. Frontend — Entry Points & Root Files

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/App.tsx` | `apps/web/src/App.tsx` | **copy-and-adjust** | Replace existing placeholder. Remove `lovable-tagger`. AuthProvider, QueryClient, Routes already stubbed in skeleton. |
| `src/main.tsx` | `apps/web/src/main.tsx` | **copy-and-adjust** | Already exists as skeleton. Replace contents. Minimal change expected. |
| `src/index.css` | `apps/web/src/index.css` | **copy** | HSL design tokens + Tailwind directives. Replace skeleton. |
| `src/App.css` | `apps/web/src/App.css` | **copy** | Vite default styles. Low priority, mostly unused. |
| `src/vite-env.d.ts` | `apps/web/src/vite-env.d.ts` | **copy** | Already exists. Overwrite. |

### 2B. Frontend — Pages

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/pages/HomePage.tsx` | `apps/web/src/pages/HomePage.tsx` | **copy-and-adjust** | Main 3-step shipping wizard. Uses `useShippingQuotes`, `useSavedOptions`. Calendar component may need react-day-picker v9 adjustment. |
| `src/pages/AuthPage.tsx` | `apps/web/src/pages/AuthPage.tsx` | **copy-and-adjust** | Auth form. Uses `useAuth` from context. May need env var check. |
| `src/pages/SavedPage.tsx` | `apps/web/src/pages/SavedPage.tsx` | **copy** | Saved services list. Clean, no special adjustments. |
| `src/pages/NotFound.tsx` | `apps/web/src/pages/NotFound.tsx` | **copy** | Simple 404 page. |
| `src/pages/Index.tsx` | `apps/web/src/pages/Index.tsx` | **review-first** | Placeholder page with SVG reminder. May not be needed. |

### 2C. Frontend — Components (Shipping Domain)

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/components/shipping/BookmarkIcon.tsx` | `apps/web/src/components/shipping/BookmarkIcon.tsx` | **copy** | Animated SVG bookmark. Self-contained. |
| `src/components/shipping/CityInput.tsx` | `apps/web/src/components/shipping/CityInput.tsx` | **copy** | City autocomplete. Depends on `@/lib/shipping-data`. |
| `src/components/shipping/Logo.tsx` | `apps/web/src/components/shipping/Logo.tsx` | **copy** | Carrier logo renderer. Depends on `@/lib/shipping-data`. |
| `src/components/shipping/QuoteRow.tsx` | `apps/web/src/components/shipping/QuoteRow.tsx` | **copy-and-adjust** | Main results display. Calls `generate-book-redirect` edge function. |
| `src/components/shipping/SharedUI.tsx` | `apps/web/src/components/shipping/SharedUI.tsx` | **copy** | Step badges, price breakdown. Self-contained. |

### 2D. Frontend — Components (shadcn/ui)

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/components/ui/*` (58 files) | `apps/web/src/components/ui/` | **copy** | Standard shadcn/ui components. All use `@/lib/utils` alias. Copy entire directory. |
| `src/components/NavLink.tsx` | `apps/web/src/components/NavLink.tsx` | **copy** | Navigation link component. |

### 2E. Frontend — Hooks

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/hooks/use-mobile.tsx` | `apps/web/src/hooks/use-mobile.tsx` | **copy** | Media query hook. Self-contained. |
| `src/hooks/use-toast.ts` | `apps/web/src/hooks/use-toast.ts` | **copy** | Toast state management. Self-contained. |
| `src/hooks/useSavedOptions.ts` | `apps/web/src/hooks/useSavedOptions.ts` | **copy-and-adjust** | Calls Supabase edge functions (`save-option`, `remove-saved-option`, `get-saved-options`). Will need migration to Java API later. |
| `src/hooks/useShippingQuotes.ts` | `apps/web/src/hooks/useShippingQuotes.ts` | **copy-and-adjust** | Calls `get-shipping-quotes` edge function. Will need migration to Java API later. |

### 2F. Frontend — Contexts

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/contexts/AuthContext.tsx` | `apps/web/src/contexts/AuthContext.tsx` | **copy** | Supabase auth state. Uses `@/integrations/supabase/client`. |

### 2G. Frontend — Lib

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/lib/utils.ts` | `apps/web/src/lib/utils.ts` | **copy** | `cn()` helper (clsx + tailwind-merge). Standard shadcn utility. |
| `src/lib/shipping-data.ts` | `apps/web/src/lib/shipping-data.ts` | **copy-and-adjust** | Types (`PackageItem`, `ShippingService`, `QuoteResults`), constants (`CITIES`, `LOGOS`). Types may later move to `@shipsmart/shared`. |
| `src/lib/ai-types.ts` | `apps/web/src/lib/ai-types.ts` | **copy-and-adjust** | AI-related type definitions. May later move to `@shipsmart/shared`. |

### 2H. Frontend — Integrations

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/integrations/supabase/client.ts` | `apps/web/src/integrations/supabase/client.ts` | **do-not-migrate** | Monorepo already has its own client with renamed env var (`VITE_SUPABASE_ANON_KEY` instead of `VITE_SUPABASE_PUBLISHABLE_KEY`). Keep monorepo version. |
| `src/integrations/supabase/types.ts` | `apps/web/src/integrations/supabase/types.ts` | **copy** | Auto-generated DB types (444 lines). Copy as-is, then add `Database` generic to existing client. |

### 2I. Frontend — Styles

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/styles/shipsmart.css` | `apps/web/src/styles/shipsmart.css` | **copy** | Custom ShipSmart design system. Outfit font, animations, utility classes. |

### 2J. Frontend — Tests

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `src/test/setup.ts` | `apps/web/src/test/setup.ts` | **copy** | Vitest setup file. |
| `src/test/example.test.ts` | `apps/web/src/test/example.test.ts` | **copy** | Example test. Low priority. |

### 2K. Public / Assets

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `public/favicon.ico` | `apps/web/public/favicon.ico` | **copy** | App icon. |
| `public/placeholder.svg` | `apps/web/public/placeholder.svg` | **copy** | Generic placeholder image. |
| `public/robots.txt` | `apps/web/public/robots.txt` | **copy** | SEO robots file. |
| `index.html` | `apps/web/index.html` | **copy-and-adjust** | Update `<title>`, remove Lovable og:image URLs, remove Lovable branding. Monorepo already has an index.html — merge. |

### 2L. Supabase — Config

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `supabase/config.toml` | `supabase/config.toml` | **copy-and-adjust** | Monorepo has stub with only `project_id`. Copy full config from Lovable, preserving the TODO comments about local dev ports. |

### 2M. Supabase — Migrations

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `supabase/migrations/20260404030225_*.sql` | `supabase/migrations/20260404030225_*.sql` | **copy** | Core schema: profiles, user_roles, shipment_requests, quotes, saved_options, redirect_tracking + RLS policies + triggers. |
| `supabase/migrations/20260404030242_*.sql` | `supabase/migrations/20260404030242_*.sql` | **copy** | Security refinements to RLS policies. |

### 2N. Supabase — Edge Functions (14 total)

| SOURCE | DESTINATION | ACTION | STATUS | NOTES |
|---|---|---|---|---|
| `supabase/functions/generate-book-redirect/` | `supabase/functions/generate-book-redirect/` | **copy** | IMPLEMENTED | 38 lines. Logs booking redirects. Used by QuoteRow. |
| `supabase/functions/get-saved-options/` | `supabase/functions/get-saved-options/` | **copy** | IMPLEMENTED | 58 lines. Fetches user's saved options. |
| `supabase/functions/get-shipping-quotes/` | `supabase/functions/get-shipping-quotes/` | **copy** | PARTIAL | 150 lines. Mock quotes (no real carrier APIs). Core function. |
| `supabase/functions/save-option/` | `supabase/functions/save-option/` | **copy** | IMPLEMENTED | 85 lines. Saves shipping quote. |
| `supabase/functions/remove-saved-option/` | `supabase/functions/remove-saved-option/` | **copy** | IMPLEMENTED | 33 lines. Deletes saved option. |
| `supabase/functions/ai-notification-generator/` | `supabase/functions/ai-notification-generator/` | **copy** | PLACEHOLDER | LLM notification generator. Not implemented yet. |
| `supabase/functions/ai-priority-interpreter/` | `supabase/functions/ai-priority-interpreter/` | **copy** | PLACEHOLDER | Priority weight calculation. Not implemented yet. |
| `supabase/functions/ai-shipping-advisor/` | `supabase/functions/ai-shipping-advisor/` | **copy** | PLACEHOLDER | RAG + LLM quote enrichment. Not implemented yet. |
| `supabase/functions/ai-tracking-advisor/` | `supabase/functions/ai-tracking-advisor/` | **copy** | PLACEHOLDER | Tracking exception explainer. Not implemented yet. |
| `supabase/functions/create-shipment-reminders/` | `supabase/functions/create-shipment-reminders/` | **copy** | PLACEHOLDER | MCP calendar integration. Not implemented yet. |
| `supabase/functions/escalate-tracking-issue/` | `supabase/functions/escalate-tracking-issue/` | **copy** | PLACEHOLDER | MCP escalation workflows. Not implemented yet. |
| `supabase/functions/find-dropoff-locations/` | `supabase/functions/find-dropoff-locations/` | **copy** | PLACEHOLDER | MCP drop-off finder. Not implemented yet. |
| `supabase/functions/import-tracking-from-email/` | `supabase/functions/import-tracking-from-email/` | **copy** | PLACEHOLDER | MCP email tracking import. Not implemented yet. |
| `supabase/functions/validate-address/` | `supabase/functions/validate-address/` | **copy** | PLACEHOLDER | MCP address validation. Not implemented yet. |

All edge functions should be tagged with `// LEGACY` comment per `docs/migration-from-lovable.md`.

### 2O. Root Config Files

| SOURCE | DESTINATION | ACTION | NOTES |
|---|---|---|---|
| `package.json` | — | **do-not-migrate** | Monorepo has its own. Dependencies already ported to `apps/web/package.json`. |
| `vite.config.ts` | — | **do-not-migrate** | Monorepo version already exists with `lovable-tagger` removed. |
| `tsconfig.json` | — | **do-not-migrate** | Monorepo has its own tsconfig structure. |
| `tsconfig.app.json` | — | **do-not-migrate** | Already exists in monorepo. |
| `tsconfig.node.json` | — | **do-not-migrate** | Already exists in monorepo. |
| `tailwind.config.ts` | `apps/web/tailwind.config.ts` | **copy-and-adjust** | Replace monorepo skeleton. Content paths need adjustment for monorepo layout. |
| `postcss.config.js` | — | **do-not-migrate** | Already exists in monorepo. |
| `components.json` | — | **do-not-migrate** | Already exists in monorepo. |
| `eslint.config.js` | — | **do-not-migrate** | Already exists in monorepo. |
| `vitest.config.ts` | — | **do-not-migrate** | Handled by Nx + Vite plugin. |
| `playwright.config.ts` | — | **review-first** | Uses `lovable-agent-playwright-config`. Needs rewrite if E2E tests are kept. |
| `playwright-fixture.ts` | — | **review-first** | Same as above. |
| `bun.lock` / `bun.lockb` | — | **do-not-migrate** | Switching to pnpm. |
| `package-lock.json` | — | **do-not-migrate** | Switching to pnpm. |
| `.env` | — | **do-not-migrate** | Contains secrets. Set manually in `.env.local`. |

---

## 3. Required Dependency Changes Before Migration

The monorepo `apps/web/package.json` already has most dependencies aligned. Key differences:

| Dependency | Lovable Version | Monorepo Version | Action Required |
|---|---|---|---|
| `react` | `^18.3.1` | `^19.2.0` | **React 19 in monorepo.** Test all components for compatibility. |
| `react-dom` | `^18.3.1` | `^19.2.0` | Same as above. |
| `@types/react` | `^18.3.23` | `^19.0.0` | Already aligned with React 19. |
| `react-day-picker` | `^8.10.1` | `^9.0.0` | **Breaking change.** v9 API differs. Calendar component needs update. |
| `next-themes` | `^0.3.0` | `^0.4.0` | Minor version bump, likely compatible. |
| `vaul` | `^0.9.9` | `^1.0.0` | Major bump. Check drawer component for breaking changes. |
| `typescript` | `^5.8.3` | `~5.9.0` | Minor bump, compatible. |
| `lovable-tagger` | `^1.1.13` (dev) | **NOT INCLUDED** | Intentionally removed. Do not add. |
| `@playwright/test` | `^1.57.0` (dev) | **NOT INCLUDED** | Add only if E2E tests are desired. |

**No new dependencies need to be added** — the monorepo already includes all production dependencies from the Lovable project.

---

## 4. Import/Path Issues Expected After Migration

1. **`@/` alias** — Works identically in both projects (`@` → `./src`). No changes needed for internal imports.

2. **Supabase client env var** — Lovable uses `VITE_SUPABASE_PUBLISHABLE_KEY`. Monorepo uses `VITE_SUPABASE_ANON_KEY`. The monorepo client already handles this — do NOT copy the Lovable `client.ts`.

3. **react-day-picker v8 → v9** — The `Calendar` UI component and `HomePage.tsx` date pickers use v8 API. v9 has breaking changes:
   - Import path changes
   - Props renamed (`selected` → `selected`, but `fromDate`/`toDate` → `disabled` modifiers)
   - `DayPickerSingleProps` type removed
   - Must update `src/components/ui/calendar.tsx` and any page using `<Calendar>`.

4. **lovable-tagger references** — The Lovable `vite.config.ts` imports `componentTagger`. This is already removed in the monorepo config. No action needed.

5. **`src/integrations/supabase/client.ts`** — Lovable version hard-codes env var names. Monorepo version uses `@/config/api.ts` abstraction. Keep monorepo version.

6. **Edge function calls in hooks** — `useSavedOptions.ts` and `useShippingQuotes.ts` call `supabase.functions.invoke(...)`. These will work as-is initially. Later migration to Java API is documented in `docs/service-boundaries.md`.

7. **Google Fonts import in `shipsmart.css`** — Uses `@import url(...)` for Outfit font from Google Fonts. Works but adds external dependency. Consider self-hosting later.

---

## 5. Environment Variables Required

### Frontend (Vite — must have `VITE_` prefix)

| Variable | Purpose | Source |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase dashboard > Settings > API |
| `VITE_JAVA_API_BASE_URL` | Java API base URL (future) | `http://localhost:8080` for local dev |
| `VITE_PYTHON_API_BASE_URL` | Python API base URL (future) | `http://localhost:8000` for local dev |
| `VITE_APP_ENV` | Environment identifier | `development` / `production` |

**Note:** The Lovable project used `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID`. The monorepo renames the key to `VITE_SUPABASE_ANON_KEY` and drops the project ID (it's in `supabase/config.toml`).

### Edge Functions (Deno runtime — no VITE_ prefix)

Edge functions currently rely on:
- `SUPABASE_URL` (auto-injected by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase)
- AI functions reference `https://ai.gateway.lovable.dev/v1/chat/completions` — this is a **Lovable-specific gateway** and will NOT work outside Lovable. Needs replacement.

---

## 6. Files That Should NOT Be Migrated

| File | Reason |
|---|---|
| `package.json` | Monorepo has its own package structure |
| `vite.config.ts` | Monorepo version already cleaned |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Monorepo has its own TS config hierarchy |
| `postcss.config.js` | Already exists in monorepo |
| `eslint.config.js` | Already exists in monorepo |
| `components.json` | Already exists in monorepo |
| `vitest.config.ts` | Handled by Nx |
| `.env` | Contains actual Supabase credentials. Set manually. |
| `bun.lock`, `bun.lockb`, `package-lock.json` | Different package manager (pnpm) |
| `playwright.config.ts` | Uses `lovable-agent-playwright-config` — Lovable-specific |
| `playwright-fixture.ts` | Same |
| `src/integrations/supabase/client.ts` | Monorepo version already exists with renamed env var + validation |
| `src/pages/Index.tsx` | Placeholder page (just an SVG reminder). Not needed. |

---

## 7. Migration Risk Assessment

### High Risk
- **React 18 → 19 upgrade**: Lovable uses React 18.3. Monorepo targets React 19.2. Some patterns (e.g., `forwardRef`, string refs) may break. All 58 shadcn/ui components and 5 pages need testing.
- **react-day-picker v8 → v9**: Breaking API change. Calendar component and HomePage date pickers will not compile without updates.
- **Lovable AI Gateway dependency**: AI edge functions reference `https://ai.gateway.lovable.dev` — this endpoint won't work outside Lovable hosting. All AI functions are placeholders but need a replacement gateway plan.

### Medium Risk
- **vaul v0.9 → v1.0**: Major version bump in drawer component. May require prop changes.
- **Edge function → API migration timing**: Hooks currently call Supabase edge functions directly. Eventually these move to Java/Python APIs. Need to ensure edge functions remain functional during transition.

### Low Risk
- **`@/` alias**: Identical in both projects. No import path changes needed.
- **Tailwind config**: Standard shadcn/ui setup. Minor content path adjustment for monorepo.
- **supabase/migrations**: SQL files copy 1:1. No code changes needed.
- **Public assets**: 3 static files, copy as-is.

---

## 8. Migration Priority Categories

### A. Safe to Migrate First

These files have no external dependencies, no breaking changes, and can be copied verbatim:

1. `src/styles/shipsmart.css` → `apps/web/src/styles/shipsmart.css`
2. `src/index.css` → `apps/web/src/index.css`
3. `src/App.css` → `apps/web/src/App.css`
4. `src/lib/utils.ts` → `apps/web/src/lib/utils.ts`
5. `src/lib/shipping-data.ts` → `apps/web/src/lib/shipping-data.ts`
6. `src/lib/ai-types.ts` → `apps/web/src/lib/ai-types.ts`
7. `src/integrations/supabase/types.ts` → `apps/web/src/integrations/supabase/types.ts`
8. `src/contexts/AuthContext.tsx` → `apps/web/src/contexts/AuthContext.tsx`
9. `src/hooks/use-mobile.tsx` → `apps/web/src/hooks/use-mobile.tsx`
10. `src/hooks/use-toast.ts` → `apps/web/src/hooks/use-toast.ts`
11. `src/components/NavLink.tsx` → `apps/web/src/components/NavLink.tsx`
12. `src/components/shipping/BookmarkIcon.tsx`
13. `src/components/shipping/CityInput.tsx`
14. `src/components/shipping/Logo.tsx`
15. `src/components/shipping/SharedUI.tsx`
16. `src/pages/NotFound.tsx`
17. `src/pages/SavedPage.tsx`
18. `public/favicon.ico`, `public/placeholder.svg`, `public/robots.txt`
19. `supabase/migrations/*` (both SQL files)
20. `src/test/setup.ts`, `src/test/example.test.ts`

### B. Migrate with Adjustments

These need specific code changes during or immediately after copy:

1. `src/App.tsx` — Remove lovable-tagger references, add AuthProvider, update imports
2. `src/main.tsx` — Minimal adjustment
3. `src/pages/HomePage.tsx` — react-day-picker v9 API update in date pickers
4. `src/pages/AuthPage.tsx` — Verify auth flow with renamed env var
5. `src/components/ui/calendar.tsx` — Must update for react-day-picker v9
6. `src/components/ui/*` (remaining 57) — Test against React 19. Most should work.
7. `src/components/shipping/QuoteRow.tsx` — Uses `generate-book-redirect` edge function
8. `src/hooks/useSavedOptions.ts` — Edge function calls, mark for future API migration
9. `src/hooks/useShippingQuotes.ts` — Edge function calls, mark for future API migration
10. `tailwind.config.ts` — Update content paths for monorepo layout
11. `index.html` — Remove Lovable branding, update title/meta tags
12. `supabase/config.toml` — Copy full config, keep monorepo comments

### C. Migrate Later

These should wait for infrastructure decisions:

1. **Edge functions (5 implemented)**: `generate-book-redirect`, `get-saved-options`, `get-shipping-quotes`, `save-option`, `remove-saved-option` — Copy now as legacy, migrate to Java/Python API later per `docs/service-boundaries.md`.
2. **Edge functions (9 placeholders)**: All AI and MCP functions — Copy for reference but they're non-functional stubs with Lovable AI Gateway dependency.

### D. Do Not Migrate

1. `package.json` — Monorepo has its own
2. `vite.config.ts` — Monorepo version is already cleaned
3. `tsconfig*.json` — Monorepo has its own hierarchy
4. `postcss.config.js`, `eslint.config.js`, `components.json` — Already exist
5. `vitest.config.ts` — Handled by Nx
6. `.env` — Contains secrets
7. `bun.lock`, `bun.lockb`, `package-lock.json` — Wrong package manager
8. `playwright.config.ts`, `playwright-fixture.ts` — Lovable-specific
9. `src/integrations/supabase/client.ts` — Monorepo version is better
10. `src/pages/Index.tsx` — Unused placeholder

### E. Needs Manual Review

1. **All shadcn/ui components** — React 19 compatibility. The `calendar.tsx` component is confirmed to need changes. Others likely work but should be smoke-tested.
2. **vaul-based drawer component** — v0.9 → v1.0 breaking changes.
3. **AI edge function gateway URLs** — `ai.gateway.lovable.dev` must be replaced with a self-hosted or alternative LLM gateway.
4. **`src/components/ui/calendar.tsx`** — Confirmed breaking change from react-day-picker v8 → v9.

---

## 9. Recommended Migration Order

```
Phase 1: Foundation (no-risk copies)
  ├── CSS files (index.css, App.css, shipsmart.css)
  ├── lib/ files (utils.ts, shipping-data.ts, ai-types.ts)
  ├── integrations/supabase/types.ts
  ├── contexts/AuthContext.tsx
  ├── hooks/ (all 4 files)
  ├── public/ assets (3 files)
  └── supabase/migrations/ (2 SQL files)

Phase 2: Components
  ├── components/shipping/ (5 files)
  ├── components/NavLink.tsx
  └── components/ui/ (58 files — test after copy)

Phase 3: Pages & Entry Points
  ├── pages/ (4 files, skip Index.tsx)
  ├── App.tsx (adjust imports, add providers)
  ├── main.tsx
  └── index.html (update branding)

Phase 4: Config & Supabase
  ├── tailwind.config.ts (adjust content paths)
  ├── supabase/config.toml (full config)
  └── supabase/functions/ (14 dirs, tag as LEGACY)

Phase 5: Verification
  ├── pnpm install from monorepo root
  ├── pnpm nx serve web
  ├── Fix react-day-picker v9 breaking changes
  ├── Fix any React 19 compatibility issues
  └── Verify auth, quotes, saved options flows
```
