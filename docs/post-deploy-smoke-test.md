# Post-Deploy Smoke Test Checklist

> **See also:** `docs/launch-smoke-tests.md` for the full launch-day checklist.

Run these tests after each deployment or flag change.

## Prerequisites

- All services are deployed and healthy
- Feature flags are set to the target state
- You have a Supabase test account (email/password)

## API Health Checks

- [ ] `GET https://shipsmart-api-java.onrender.com/api/v1/health` -> 200 `{"status":"ok"}`
- [ ] `GET https://shipsmart-api-python.onrender.com/health` -> 200 `{"status":"ok",...}`
- [ ] `GET https://shipsmart-api-python.onrender.com/ready` -> 200 `{"status":"ready"}`

## Quote Flow

- [ ] Open the app in browser
- [ ] Enter origin, destination, dates, and package details
- [ ] Click "Compare Shipping Rates"
- [ ] Verify quote results appear with carriers, prices, and transit times
- [ ] Verify recommendation panel appears below quotes (if Python API is up)
- [ ] Verify no console errors

## Auth Flow

- [ ] Sign up with a new email or sign in with existing account
- [ ] Verify redirect to dashboard / logged-in state
- [ ] Sign out and verify return to anonymous state

## Saved Options (requires auth)

- [ ] Sign in
- [ ] Get quotes
- [ ] Click the bookmark icon on a quote -> verify "Saved!" toast
- [ ] Navigate to saved options view -> verify the saved option appears
- [ ] Click remove on a saved option -> verify "Removed" toast
- [ ] Refresh page -> verify saved options list is correct

## Booking Redirect

- [ ] Get quotes
- [ ] Expand a quote row -> click "Book on [Carrier]"
- [ ] Verify a new tab opens to the carrier checkout URL
- [ ] Verify no console errors

## AI Advisor (Python API)

- [ ] Navigate to Advisor page
- [ ] Submit a shipping question -> verify answer + sources appear
- [ ] Switch to Tracking tab -> submit an issue -> verify guidance + next steps

## Recommendation Flow

- [ ] Get quotes on home page
- [ ] Recommendation panel shows primary (highlighted) + alternatives
- [ ] Summary text is visible

## Fallback Behavior

- [ ] If Python API is unavailable, recommendation panel is hidden (no error)
- [ ] If Python API is unavailable, advisor page shows error message
- [ ] Quote flow, saved options, booking all work without Python API

## Validation Errors

- [ ] Send `POST /api/v1/quotes` with empty body -> 400 with field errors
- [ ] Send `POST /api/v1/advisor/shipping` with `{}` -> 422
- [ ] Send `POST /api/v1/advisor/recommendation` without services -> 422

## CORS

- [ ] Verify frontend can call both Java and Python APIs without CORS errors
- [ ] Verify browser console shows no `Access-Control-Allow-Origin` errors

## Rollback Verification (if testing rollback)

- [ ] Set one feature flag to `"false"` in Render
- [ ] Trigger rebuild of static site
- [ ] Verify the affected flow now uses Supabase edge function
- [ ] Verify other flows (with flags still `"true"`) still use Java API
- [ ] Reset flag back to `"true"` when done
