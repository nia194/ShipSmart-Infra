# ShipSmart — Migration Checklist

Step-by-step checklist for migrating the Lovable project into the ShipSmart monorepo.
Work through in order. Each step should be verified before moving to the next.

---

## Pre-Migration

- [ ] Monorepo skeleton builds: `pnpm install && pnpm nx build web`
- [ ] All 4 Nx projects visible: `pnpm nx show projects` shows `web`, `api-java`, `api-python`, `shared`
- [ ] `.env.local` / `.env` files created from `.env.example` templates
- [ ] Supabase credentials obtained from Supabase dashboard

---

## Step 1: Copy Static Assets

Source: `read-folder/blank-slate-project-main/`

- [ ] `public/favicon.ico` → `apps/web/public/favicon.ico`
- [ ] `public/placeholder.svg` → `apps/web/public/placeholder.svg`
- [ ] `public/robots.txt` → `apps/web/public/robots.txt`

**Verify:** Files exist in `apps/web/public/`

---

## Step 2: Copy Tailwind Config

- [ ] `tailwind.config.ts` → `apps/web/tailwind.config.ts` (REPLACE skeleton)

**Note:** The skeleton has a minimal tailwind config. The Lovable config has full
theme extensions (colors, keyframes, animations). Replace entirely.

**Verify:** No Tailwind build errors: `pnpm nx build web`

---

## Step 3: Copy CSS Files

- [ ] `src/index.css` → `apps/web/src/index.css` (REPLACE skeleton)
- [ ] `src/App.css` → `apps/web/src/App.css` (REPLACE skeleton)
- [ ] `src/styles/shipsmart.css` → `apps/web/src/styles/shipsmart.css`

**Verify:** CSS loads without errors in dev server

---

## Step 4: Copy UI Components (shadcn/ui)

- [ ] `src/components/ui/*` → `apps/web/src/components/ui/` (copy ALL files)

This is ~40 files from the shadcn/ui library. Copy them all as-is.

**Verify:** No import errors. These components have no Lovable-specific logic.

---

## Step 5: Copy Lib Utilities

- [ ] `src/lib/utils.ts` → `apps/web/src/lib/utils.ts`
- [ ] `src/lib/ai-types.ts` → `apps/web/src/lib/ai-types.ts`
- [ ] `src/lib/shipping-data.ts` → `apps/web/src/lib/shipping-data.ts`

**Verify:** No import resolution errors

---

## Step 6: Copy Supabase Integration

- [ ] `src/integrations/supabase/types.ts` → `apps/web/src/integrations/supabase/types.ts`

Then update `apps/web/src/integrations/supabase/client.ts`:
- [ ] Add `import type { Database } from "./types";` 
- [ ] Change `createClient(...)` to `createClient<Database>(...)`

**IMPORTANT:** The env var was renamed:
- Lovable: `VITE_SUPABASE_PUBLISHABLE_KEY`  
- ShipSmart: `VITE_SUPABASE_ANON_KEY`

The skeleton client.ts already uses the new name. Just add the Database type generic.

**Verify:** TypeScript resolves the Database type without errors

---

## Step 7: Copy Contexts and Hooks

- [ ] `src/contexts/AuthContext.tsx` → `apps/web/src/contexts/AuthContext.tsx`
- [ ] `src/hooks/use-mobile.tsx` → `apps/web/src/hooks/use-mobile.tsx`
- [ ] `src/hooks/use-toast.ts` → `apps/web/src/hooks/use-toast.ts`
- [ ] `src/hooks/useSavedOptions.ts` → `apps/web/src/hooks/useSavedOptions.ts`
- [ ] `src/hooks/useShippingQuotes.ts` → `apps/web/src/hooks/useShippingQuotes.ts`

**Note on hooks:** `useSavedOptions.ts` and `useShippingQuotes.ts` call Supabase Edge
Functions directly. They will continue to work via Supabase. Update them to call the
Java API later (not during migration).

**Verify:** Hooks import without errors

---

## Step 8: Copy Shipping Components

- [ ] `src/components/NavLink.tsx` → `apps/web/src/components/NavLink.tsx`
- [ ] `src/components/shipping/BookmarkIcon.tsx` → `apps/web/src/components/shipping/BookmarkIcon.tsx`
- [ ] `src/components/shipping/CityInput.tsx` → `apps/web/src/components/shipping/CityInput.tsx`
- [ ] `src/components/shipping/Logo.tsx` → `apps/web/src/components/shipping/Logo.tsx`
- [ ] `src/components/shipping/QuoteRow.tsx` → `apps/web/src/components/shipping/QuoteRow.tsx`
- [ ] `src/components/shipping/SharedUI.tsx` → `apps/web/src/components/shipping/SharedUI.tsx`

**Verify:** Components render without errors

---

## Step 9: Copy Pages

- [ ] `src/pages/AuthPage.tsx` → `apps/web/src/pages/AuthPage.tsx`
- [ ] `src/pages/HomePage.tsx` → `apps/web/src/pages/HomePage.tsx`
- [ ] `src/pages/Index.tsx` → `apps/web/src/pages/Index.tsx`
- [ ] `src/pages/NotFound.tsx` → `apps/web/src/pages/NotFound.tsx`
- [ ] `src/pages/SavedPage.tsx` → `apps/web/src/pages/SavedPage.tsx`

**Verify:** Pages load when navigated to in the browser

---

## Step 10: Update App.tsx and main.tsx

- [ ] `src/App.tsx` → `apps/web/src/App.tsx` (REPLACE skeleton)
- [ ] `src/main.tsx` → `apps/web/src/main.tsx` (REPLACE skeleton)

**After replacing:**
- [ ] Remove any `lovable-tagger` references if present in App.tsx
- [ ] Verify all page imports resolve correctly
- [ ] Verify QueryClientProvider, BrowserRouter, AuthContext are wired

**Verify:** `pnpm nx serve web` → app loads, shows HomePage

---

## Step 11: Copy Supabase Config and Migrations

- [ ] `supabase/config.toml` → `supabase/config.toml` (REPLACE skeleton)
- [ ] `supabase/migrations/*.sql` → `supabase/migrations/` (copy both migration files)

**Verify:** `supabase/config.toml` has `project_id = "fihrsfvohaxhmqrcisyl"`

---

## Step 12: Copy Supabase Edge Functions (as legacy)

- [ ] Copy all `supabase/functions/*/index.ts` → `supabase/functions/`

Add this comment to the top of each copied function:
```typescript
// LEGACY: Migration candidate — see docs/service-boundaries.md
```

Edge functions to copy:
- [ ] `ai-notification-generator`
- [ ] `ai-priority-interpreter`
- [ ] `ai-shipping-advisor`
- [ ] `ai-tracking-advisor`
- [ ] `create-shipment-reminders`
- [ ] `escalate-tracking-issue`
- [ ] `find-dropoff-locations`
- [ ] `generate-book-redirect`
- [ ] `get-saved-options`
- [ ] `get-shipping-quotes`
- [ ] `import-tracking-from-email`
- [ ] `remove-saved-option`
- [ ] `save-option`
- [ ] `validate-address`

**Verify:** Edge functions are present in `supabase/functions/`. They do NOT run locally
from this repo — they remain deployed on Supabase.

---

## Step 13: Full Integration Test

- [ ] `pnpm install` — no errors
- [ ] `pnpm nx build web` — builds successfully
- [ ] `pnpm nx serve web` — app loads at http://localhost:5173
- [ ] Auth page works (Supabase auth)
- [ ] Home page renders (quote search UI)
- [ ] Saved page renders
- [ ] No console errors related to missing modules

---

## Step 14: Cleanup

- [ ] Remove `lovable-tagger` references if any leaked in
- [ ] Remove any `bun.lock` / `bun.lockb` if accidentally copied
- [ ] Run `pnpm nx build web` one final time
- [ ] Commit the migrated code

---

## Known Risks During Migration

| Risk | Severity | Mitigation |
|------|----------|------------|
| `react-day-picker` v8 → v9 API changes | Medium | Calendar component may need import updates. Check `@/components/ui/calendar.tsx`. |
| `next-themes` upgraded to v0.4+ | Low | API is compatible; verify dark mode toggle still works. |
| `vaul` upgraded to v1.0+ | Low | Drawer component may need minor prop updates. |
| Supabase env var rename | High | Must update ALL references to `VITE_SUPABASE_PUBLISHABLE_KEY` to `VITE_SUPABASE_ANON_KEY` before first run. |
| Edge Functions still live on Supabase | None | They continue to work independently. Migrate later. |

---

## Files NOT to Copy

| File | Reason |
|------|--------|
| `package.json` | New monorepo package.json already created |
| `package-lock.json`, `bun.lock*` | Using pnpm now |
| `vite.config.ts` | New config already created (lovable-tagger removed) |
| `.env` | Secrets — set manually in `.env.local` |
| `.lovable/` | Lovable platform metadata, not needed |
| `playwright-fixture.ts`, `playwright.config.ts` | Optional — add later if E2E tests are needed |
| `vitest.config.ts` | Handled by Nx + Vite plugin |
| `eslint.config.js` | New ESLint config already created |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | New configs already created |
