# Frontend Runtime Checklist

Pre-launch verification for the ShipSmart web frontend after migration from Lovable.

## Environment Variables

All variables must be set in `apps/web/.env.local` (local dev) or deployment environment.

| Variable | Required | Source |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase dashboard > Settings > API |
| `VITE_JAVA_API_BASE_URL` | No | Defaults to `http://localhost:8080` |
| `VITE_PYTHON_API_BASE_URL` | No | Defaults to `http://localhost:8000` |
| `VITE_APP_ENV` | No | Defaults to `development` |

Template: `apps/web/.env.example`

> **Note:** Lovable used `VITE_SUPABASE_PUBLISHABLE_KEY`. The monorepo uses `VITE_SUPABASE_ANON_KEY`. Same value, different name.

## Commands

```bash
# Install dependencies (from repo root)
pnpm install

# Start dev server
pnpm --filter web dev

# Type check
pnpm --filter web exec tsc --noEmit

# Production build
pnpm --filter web build

# Preview production build
pnpm --filter web preview
```

## Supabase Setup

```bash
# Link to remote project
npx supabase link --project-ref fihrsfvohaxhmqrcisyl

# Run migrations against local Supabase
npx supabase db push

# Deploy edge functions (all 14 legacy functions)
npx supabase functions deploy
```

## Step-by-Step QA Checklist

### 1. App Loads
- [ ] Run `pnpm --filter web dev` — starts without errors on http://localhost:5173
- [ ] Landing page renders "Compare. Ship. Save." heading
- [ ] ShipSmart logo and "Search" nav link visible in sticky header
- [ ] No console errors on initial load
- [ ] Page loads quickly (code-split chunks load on demand)

### 2. Search Flow (unauthenticated)
- [ ] Type "New" in the "From" city field — autocomplete shows "New York, NY", "New Orleans, LA", etc.
- [ ] Click a suggestion or press Enter — city populates
- [ ] Tab/click to "To" field — repeat city selection
- [ ] Step 1 auto-advances after both cities have 3+ characters
- [ ] Swap button (↔) exchanges origin and destination
- [ ] Click "Drop-off" date — calendar popover opens, past dates disabled
- [ ] Select a drop-off date, then "Deliver By" calendar auto-opens
- [ ] Deliver-by dates before drop-off are disabled
- [ ] Step 2 auto-advances after both dates selected
- [ ] Package form: change type, qty, weight, dimensions, handling
- [ ] "Add Another Item" adds a second package row
- [ ] "Remove" button removes a package row (only if 2+ items)
- [ ] Negative values blocked for qty/weight/dimensions
- [ ] Click "Compare Shipping Rates" with valid data — loading skeleton shows
- [ ] Quote results render with Prime and Private provider sections (requires edge functions)
- [ ] Expand a quote row — shows promo, breakdown, features, "Book" link
- [ ] Collapse/expand "View N more" in each section

### 3. Authentication
- [ ] Click "Sign In" in nav → navigates to `/auth`
- [ ] Auth page shows ShipSmart branding, login form
- [ ] Toggle "Create one" link → switches to signup mode (adds Name field)
- [ ] Submit with empty fields → "All fields required" error
- [ ] Submit with invalid email → "Invalid email" error
- [ ] Submit signup with <6 char password → "Min 6 characters" error
- [ ] Successful signup → toast "Account created!", redirects to `/`
- [ ] Successful login → redirects to `/`, nav shows avatar + "Sign Out"
- [ ] "Sign Out" → clears session, nav shows "Sign In" button
- [ ] "continue as guest" link → returns to `/` without auth

### 4. Saved Options (authenticated)
- [ ] After getting quotes, bookmark icon appears on each row
- [ ] Click bookmark → icon fills, toast "Saved!"
- [ ] Click filled bookmark → icon unfills, toast "Removed"
- [ ] "Saved" nav link shows with count badge
- [ ] Navigate to `/saved` → saved services displayed with route/package/delivery info
- [ ] Notification toggles (Email/SMS) render per saved item
- [ ] SMS toggle → shows phone input with validation
- [ ] "Remove" button on saved item → removes it, toast "Removed"
- [ ] "Book Now" link opens carrier URL in new tab
- [ ] Empty state shows "No saved services yet" with link to search

### 5. Error Scenarios
- [ ] Disconnect internet → quote fetch shows error toast
- [ ] Try to save without auth → toast "Sign in required"
- [ ] Navigate to `/nonexistent` → 404 page with "Return to Home" link
- [ ] Invalid Supabase env vars → app throws clear error on load

### 6. Routing
- [ ] `/` — Home page with search wizard
- [ ] `/saved` — Saved services (nav link only visible when authenticated)
- [ ] `/auth` — Auth page (full-screen, no nav bar)
- [ ] `/anything-else` — 404 page

## Known Limitations

1. **Edge functions required** — Quote search, save/remove, and booking redirect depend on the 5 implemented Supabase edge functions. Without them deployed, these features return errors.
2. **AI features non-functional** — 9 placeholder edge functions have no working logic. The 3 that reference `ai.gateway.lovable.dev` will fail outside Lovable.
3. **No Java/Python backends yet** — `VITE_JAVA_API_BASE_URL` and `VITE_PYTHON_API_BASE_URL` are configured but no endpoints exist. The frontend currently uses Supabase edge functions exclusively.
4. **`skipLibCheck` required** — Pre-existing type conflicts in `node_modules` (`@types/react-dom`, `vite`) require `skipLibCheck: true` in tsconfig. Not caused by migration.
