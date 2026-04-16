# Local Development Guide

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Supabase CLI** (optional, for edge functions): `npm install -g supabase`

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your Supabase credentials

# 3. Start the frontend
pnpm --filter web dev
```

The dev server starts at **http://localhost:5173**.

## Environment Setup

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

| Variable | Required | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase dashboard > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase dashboard > Settings > API > anon public key |

The Java and Python backend URLs default to `localhost:8080` and `localhost:8000` respectively. These backends are not yet implemented — the frontend currently uses Supabase edge functions.

## Available Commands

All commands run from the repository root:

```bash
# Frontend
pnpm --filter web dev          # Dev server (port 5173)
pnpm --filter web build        # Production build
pnpm --filter web preview      # Preview production build
pnpm --filter web exec tsc --noEmit  # Type check

# Nx equivalents
pnpm nx serve web              # Dev server via Nx
pnpm nx build web              # Production build via Nx

# All projects
pnpm install                   # Install all workspace dependencies
```

## Supabase (Edge Functions)

The frontend depends on 5 legacy Supabase edge functions for core functionality:
- `get-shipping-quotes` — quote search
- `get-saved-options` — load saved services
- `save-option` — save a service
- `remove-saved-option` — remove a saved service
- `generate-book-redirect` — track booking clicks

To deploy edge functions:

```bash
npx supabase link --project-ref fihrsfvohaxhmqrcisyl
npx supabase functions deploy
```

Without these deployed, quote search and save/remove will show error toasts.

## Verifying Key Flows

### Auth Flow
1. Navigate to `/auth`
2. Create an account with email/password
3. Verify nav shows avatar and "Sign Out"
4. Sign out and sign back in

### Quote Flow
1. On `/`, enter origin and destination cities (use autocomplete)
2. Select drop-off and deliver-by dates
3. Add package details (type, weight, dimensions)
4. Click "Compare Shipping Rates"
5. Verify quote results with Prime and Private provider sections

### Saved Options Flow
1. Sign in first
2. Get quotes, click bookmark icon on a result
3. Navigate to `/saved` via nav link
4. Verify saved service appears with route/package details
5. Click "Remove" to delete

## Project Structure

```
apps/web/
  src/
    components/     # UI components (shadcn/ui + shipping)
    config/         # API configuration
    contexts/       # React contexts (AuthContext)
    hooks/          # Custom hooks (quotes, saved options, toast)
    integrations/   # Supabase client + types
    lib/            # Utilities (shipping data, AI types)
    pages/          # Route pages (Home, Auth, Saved, NotFound)
    styles/         # Custom CSS (shipsmart.css)
  public/           # Static assets
```

## Troubleshooting

**"VITE_SUPABASE_URL is not set"** — You need to create `apps/web/.env.local` from the example file.

**Quote search returns errors** — Edge functions need to be deployed to the Supabase project.

**Type errors in node_modules** — Expected. `skipLibCheck: true` is configured in tsconfig. These are pre-existing conflicts in `@types/react-dom` and `vite`, not caused by the migration.

**Port 5173 in use** — Another process is using the port. Kill it or change the port in `apps/web/package.json` dev script.
