# Launch Smoke Tests

Run after deployment to verify the full system works end-to-end.

## Prerequisites

- All three services deployed and healthy
- Feature flags set to target state
- Supabase test account available

---

## 1. Service Health

- [ ] `GET https://shipsmart-api-java.onrender.com/api/v1/health` -> 200
- [ ] `GET https://shipsmart-api-python.onrender.com/health` -> 200
- [ ] `GET https://shipsmart-api-python.onrender.com/ready` -> 200
- [ ] Open `https://shipsmart-web.onrender.com` -> page loads

## 2. Frontend Loads

- [ ] Home page renders with step-by-step quote form
- [ ] No console errors on initial load
- [ ] Navigation works (if nav links exist)

## 3. Auth Flow

- [ ] Sign in with existing Supabase account
- [ ] Verify logged-in state persists on page reload
- [ ] Sign out and verify return to anonymous state

## 4. Quote Flow (Java API)

- [ ] Enter origin city (e.g., "New York, NY")
- [ ] Enter destination city (e.g., "Los Angeles, CA")
- [ ] Select drop-off and delivery dates
- [ ] Add package with weight and dimensions
- [ ] Click "Compare Shipping Rates"
- [ ] Verify quote results appear with carriers, prices, transit days
- [ ] No console errors during flow

## 5. Recommendation Panel (Python API)

- [ ] After quotes load, recommendation panel appears below results
- [ ] Primary recommendation shows with "Recommended for you" badge
- [ ] Alternative recommendations show below primary
- [ ] Summary text is visible
- [ ] If Python API is slow (cold start), loading shimmer shows briefly

## 6. Saved Options (requires auth)

- [ ] Sign in
- [ ] Get quotes
- [ ] Click bookmark icon on a quote -> "Saved!" toast
- [ ] Navigate to saved options view -> saved option appears
- [ ] Remove a saved option -> "Removed" toast
- [ ] Refresh page -> list is correct

## 7. Booking Redirect

- [ ] Get quotes
- [ ] Expand a quote row -> click "Book on [Carrier]"
- [ ] New tab opens to carrier checkout URL
- [ ] No console errors

## 8. Shipping Advisor (Python API)

- [ ] Navigate to Advisor page
- [ ] Enter a shipping question (e.g., "What carriers are available?")
- [ ] Click submit
- [ ] Verify answer appears with sources listed
- [ ] Verify "tools_used" is shown if context was provided

## 9. Tracking Advisor (Python API)

- [ ] Switch to Tracking tab on Advisor page
- [ ] Enter an issue (e.g., "My package is delayed")
- [ ] Click submit
- [ ] Verify guidance and next steps appear

## 10. Fallback: Python API Unavailable

- [ ] Stop the Python service in Render (or wait for it to sleep)
- [ ] Load quotes on frontend -> quotes still work (Java API)
- [ ] Recommendation panel does NOT appear (no error shown)
- [ ] Advisor page shows error message but app doesn't crash
- [ ] Restart Python service -> recommendation and advisor recover

## 11. Fallback: Java API Rollback

- [ ] Set `VITE_USE_JAVA_QUOTES=false` in Render web env
- [ ] Trigger static site rebuild
- [ ] Verify quote flow falls back to Supabase edge function
- [ ] Reset flag to `"true"` when done

## 12. CORS

- [ ] No `Access-Control-Allow-Origin` errors in browser console
- [ ] Frontend can call both Java and Python APIs without CORS blocks

## 13. API Validation

- [ ] `POST /api/v1/quotes` with empty body -> 400 with field errors (Java)
- [ ] `POST /api/v1/advisor/shipping` with empty body -> 422 (Python)
- [ ] `POST /api/v1/advisor/recommendation` with no services -> 422 (Python)

---

## Result

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| Health | | | |
| Frontend | | | |
| Auth | | | |
| Quotes | | | |
| Recommendations | | | |
| Saved Options | | | |
| Booking | | | |
| Shipping Advisor | | | |
| Tracking Advisor | | | |
| Fallback (Python) | | | |
| Fallback (Java) | | | |
| CORS | | | |
| Validation | | | |

**Overall:** PASS / FAIL

**Tester:** _______________  **Date:** _______________
