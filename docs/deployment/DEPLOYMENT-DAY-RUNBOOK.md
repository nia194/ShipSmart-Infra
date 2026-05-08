# Render Deployment — Day-Of Runbook
**Date:** 2026-04-09  
**Time:** ~60 minutes total  
**Status:** Ready to execute

---

## Pre-Flight Check (5 minutes)

Before you start, verify:

```bash
# 1. All code is pushed to GitHub
git log --oneline -1 | grep "deployment"
# Expected: Most recent commit mentions deployment

# 2. Render service exists
echo "Go to https://render.com and confirm you see ShipSmart project"

# 3. You have credentials ready (in password manager, NOT copied to chat)
echo "✓ FedEx credentials ready?"
echo "✓ Supabase credentials ready?"
echo "✓ Database credentials ready (if not using Supabase)?"
```

---

## Timeline: 60 Minutes

```
Minute 0-1:    Deploy from GitHub (automatic)
Minute 1-20:   Services build
Minute 20-35:  Set environment variables (manual)
Minute 35-40:  Restart services
Minute 40-45:  Wait for "Live" status
Minute 45-60:  Run verification tests
```

---

## STEP 1: Initiate Deployment (1 minute)

### Action: Go to Render Dashboard

1. Open https://render.com
2. Click **Dashboard**
3. Find **ShipSmart** project
4. Look for **Deploy** or **Redeploy** button
5. Click it

### Expected Result
- Button shows "Deploying from GitHub"
- You see a loading spinner
- Build logs start appearing

### What Happens Next (Automatic)
- Render reads `render.yaml` from GitHub
- 4 services start building in parallel:
  - shipsmart-web (React) - ~3 minutes
  - shipsmart-api-java (Spring Boot) - ~5 minutes
  - shipsmart-api-python (FastAPI) - ~4 minutes
  - shipsmart-mcp-tools (MCP) - ~4 minutes

---

## STEP 2: Wait for Builds (15 minutes)

**While services are building:**
- ☕ Grab a coffee
- 📖 Read this document
- 🔍 Gather your credentials
- 📋 Have `docs/env/ENV-VARS-COPY-PASTE.md` open

### Monitor Build Progress

In Render dashboard:
1. Click each service
2. Go to **Deployments** tab
3. Watch for progress bars
4. Wait until all reach 100% and show green checkmark

**Expected Timeline:**
```
shipsmart-web:          ████████░░ 80% (2 min)
shipsmart-api-java:     ████░░░░░░ 40% (3 min) [slowest]
shipsmart-api-python:   ████████░░ 75% (3 min)
shipsmart-mcp-tools:    ████████░░ 75% (3 min)
```

### When All Show "Live"

Green indicator appears next to each service name. You're ready for Step 3.

---

## STEP 3: Set Environment Variables (15 minutes)

**Order matters.** Do services in this order:

### Service 1: shipsmart-web (1 minute)

1. Click **shipsmart-web** service
2. Go to **Environment** tab
3. **Verify these are already set** (from blueprint):
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_JAVA_API_BASE_URL
   VITE_PYTHON_API_BASE_URL
   VITE_APP_ENV
   VITE_USE_JAVA_QUOTES
   VITE_USE_JAVA_SAVED_OPTIONS
   VITE_USE_JAVA_BOOKING_REDIRECT
   ```
4. **No action needed** ✓

---

### Service 2: shipsmart-api-java (10 minutes)

1. Click **shipsmart-api-java** service
2. Go to **Environment** tab
3. **Add these 6 variables** (click "Add Environment Variable" each time):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://[USER]:[PASS]@[HOST]:[PORT]/[DB]` |
   | `DATABASE_USERNAME` | `postgres` (or your username) |
   | `DATABASE_PASSWORD` | Your actual password |
   | `SUPABASE_URL` | `https://wxctvusgkamzherfqflf.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Paste from Supabase settings |
   | `SUPABASE_JWT_SECRET` | Paste from Supabase settings |

4. Click **Save** after each variable
5. All 6 should show in the list

**Tips:**
- Don't type manually; copy-paste from `docs/env/ENV-VARS-COPY-PASTE.md`
- DATABASE_URL format: `postgresql://user:pass@host:5432/dbname`
- Supabase keys are very long (starts with `eyJhbGc...`) — make sure you copy the entire value

---

### Service 3: shipsmart-api-python (3 minutes)

1. Click **shipsmart-api-python** service
2. Go to **Environment** tab
3. **Add these 3 variables:**

   | Key | Value |
   |-----|-------|
   | `FEDEX_CLIENT_ID` | Your FedEx API key |
   | `FEDEX_CLIENT_SECRET` | Your FedEx API secret |
   | `FEDEX_ACCOUNT_NUMBER` | Your FedEx account number |

4. Click **Save** after each variable
5. All 3 should show in the list

**Tips:**
- Get these from https://developer.fedex.com
- Account number is numeric (like `123456789`)

---

### Service 4: shipsmart-mcp-tools (3 minutes)

1. Click **shipsmart-mcp-tools** service
2. Go to **Environment** tab
3. **Add these 3 variables** (SAME as Service 3):

   | Key | Value |
   |-----|-------|
   | `FEDEX_CLIENT_ID` | Your FedEx API key (same as api-python) |
   | `FEDEX_CLIENT_SECRET` | Your FedEx API secret (same as api-python) |
   | `FEDEX_ACCOUNT_NUMBER` | Your FedEx account number (same as api-python) |

4. Click **Save** after each variable
5. All 3 should show in the list

**Tips:**
- Copy-paste the exact same FedEx values from Service 3
- This ensures both services use the same provider

---

## STEP 4: Restart Services (5 minutes)

Now that all variables are set, restart services to apply changes.

### Restart Order (do one at a time):

1. **shipsmart-api-java**
   - Click service
   - Click **Restart** button
   - Wait for green "Live" indicator
   - (~2 minutes)

2. **shipsmart-api-python**
   - Click service
   - Click **Restart** button
   - Wait for green "Live" indicator
   - (~2 minutes)

3. **shipsmart-mcp-tools**
   - Click service
   - Click **Restart** button
   - Wait for green "Live" indicator
   - (~2 minutes)

4. **shipsmart-web**
   - Click service
   - Click **Restart** button (if available)
   - Wait for green "Live" indicator
   - (~1 minute)

### All Services Should Show:
```
🟢 LIVE   shipsmart-web
🟢 LIVE   shipsmart-api-java
🟢 LIVE   shipsmart-api-python
🟢 LIVE   shipsmart-mcp-tools
```

---

## STEP 5: Run Verification Tests (15 minutes)

Once all services show "Live", run automated tests.

### Test 1: Quick Health Checks (3 minutes)

Open terminal and run:

```bash
# Test frontend
curl https://shipsmart-web.onrender.com -I

# Test Java API
curl https://shipsmart-api-java.onrender.com/api/v1/health

# Test Python API
curl https://shipsmart-api-python.onrender.com/health

# Test MCP Server
curl https://shipsmart-mcp-tools.onrender.com/health
```

**Expected responses:**
```
shipsmart-web:        200 OK (serves HTML)
shipsmart-api-java:   200 OK {"status": "ok"}
shipsmart-api-python: 200 OK {"status": "healthy"}
shipsmart-mcp-tools:  200 OK {"status": "healthy", "service": "shipsmart-mcp-server"}
```

### Test 2: Comprehensive Verification (10 minutes)

Run the automated test script:

```bash
cd /c/Users/ashis/OneDrive/Documents/ShipSmart

# Make script executable
chmod +x scripts/verify-post-deployment.sh

# Run tests
bash scripts/verify-post-deployment.sh
```

**Expected output:**
```
✓ Frontend (index page): PASS
✓ Java health check: PASS
✓ Python health check: PASS
✓ MCP health check: PASS
✓ MCP tools discoverable: PASS
✓ validate_address tool: PASS
✓ get_quote_preview tool: PASS

════════════════════════════════════════════════
✓ ALL CRITICAL TESTS PASSED!
════════════════════════════════════════════════
```

### Test 3: Manual Claude Code Verification (5 minutes)

1. Update `.mcp.json` to use production URL:
   ```json
   {
     "mcpServers": {
       "shipsmart-tools": {
         "type": "http",
         "url": "https://shipsmart-mcp-tools.onrender.com"
       }
     }
   }
   ```

2. **Restart Claude Code** (close and reopen)

3. In Claude Code, try:
   ```
   @shipsmart-tools
   validate this address: 123 Main St, San Francisco, CA 94105
   ```

4. **Expected:** Tools are listed and can be called

---

## STEP 6: Manual Testing in Browser (Optional, 10 minutes)

### Test Full Quote Flow

1. Open https://shipsmart-web.onrender.com
2. Fill in shipping form:
   - From: San Francisco, CA 94105
   - To: New York, NY 10001
   - Weight: 10 lbs
   - Size: 12x8x6 inches
3. Click "Get Quote"
4. Should see results from FedEx

---

## 🚨 Troubleshooting

### Issue: Service stuck on "Deploying"

**Fix:**
1. Go to service
2. Click **Deployments** tab
3. Click **Cancel** on stuck deployment
4. Click **Restart**

---

### Issue: "HTTP 500" errors after restart

**Fix:**
1. Go to service → **Logs** tab
2. Look for error message
3. Check if env variables are correctly set
4. Verify database connection
5. Restart service again

---

### Issue: MCP tools return error

**Check:**
1. Are FedEx credentials correctly set?
2. Run health check: `curl https://shipsmart-mcp-tools.onrender.com/health`
3. Check MCP logs for FedEx errors
4. If using mock provider: check `SHIPPING_PROVIDER` is set

---

### Issue: CORS error in Claude Code

**Fix:**
1. Check CORS_ALLOWED_ORIGINS in Java API environment
2. Should be: `https://shipsmart-web.onrender.com`
3. Restart Java API service

---

## Checklist: Complete This Before Leaving

- [ ] All 4 services show green "Live" status
- [ ] Health check curl commands return 200
- [ ] Automated test script passes all tests
- [ ] Claude Code can discover tools (@shipsmart-tools)
- [ ] Quote flow works end-to-end in browser
- [ ] MCP tools execute (validate_address, get_quote_preview)
- [ ] No error messages in Render logs
- [ ] FedEx credentials are not committed to GitHub
- [ ] `.mcp.json` updated with production URL
- [ ] Team notified of production URLs

---

## Production URLs (For Documentation)

Once fully verified:

```
Frontend:     https://shipsmart-web.onrender.com
Java API:     https://shipsmart-api-java.onrender.com
Python API:   https://shipsmart-api-python.onrender.com
MCP Tools:    https://shipsmart-mcp-tools.onrender.com
```

Share these with your team.

---

## What To Do If Tests Fail

1. **Don't panic.** This is normal in deployments.
2. **Check logs:** Each service → Logs tab in Render
3. **Look for error patterns:**
   - Database connection error → Check DATABASE_URL
   - FedEx provider error → Check credentials
   - Port binding error → Check PORT env var
   - Module not found → Check deployment logs
4. **Try restart:** Often fixes transient issues
5. **Check previous deployments:** Render shows history if needed

---

## Next Steps After Successful Deployment

1. **Monitor for 24 hours** — watch logs for errors
2. **Document anything unusual** — save error messages
3. **Schedule status check** — verify services daily
4. **Plan improvements:**
   - [ ] Implement Spring Boot MCPToolsClient
   - [ ] Add API authentication
   - [ ] Add rate limiting
   - [ ] Set up monitoring/alerting

---

## Quick Reference: Commands

```bash
# Test all services
bash scripts/verify-post-deployment.sh

# Test individual endpoints
curl https://shipsmart-api-java.onrender.com/api/v1/health
curl https://shipsmart-api-python.onrender.com/health
curl https://shipsmart-mcp-tools.onrender.com/health

# Test MCP tool discovery
curl -X POST https://shipsmart-mcp-tools.onrender.com/tools/list \
  -H "Content-Type: application/json"

# Test MCP tool execution
curl -X POST https://shipsmart-mcp-tools.onrender.com/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "validate_address", "arguments": {"street": "123 Main St", "city": "San Francisco", "state": "CA", "zip_code": "94105"}}'
```

---

## Time Estimates

| Phase | Duration | Status |
|-------|----------|--------|
| Pre-flight | 5 min | Quick check |
| Deploy | 20 min | Automatic (watch) |
| Env vars | 15 min | Manual (copy-paste) |
| Restart | 5 min | Click buttons |
| Verify | 15 min | Automated script |
| **TOTAL** | **~60 min** | Start to finish |

---

## Support Resources

- **Detailed checklist:** RENDER-DEPLOYMENT-CHECKLIST.md
- **Env vars template:** docs/env/ENV-VARS-COPY-PASTE.md
- **Verification script:** scripts/verify-post-deployment.sh
- **Architecture docs:** docs/MCP-SERVER-SETUP.md
- **Troubleshooting:** RENDER-DEPLOYMENT-CHECKLIST.md → Troubleshooting

---

**Version:** 1.0  
**Status:** Ready for execution  
**Date:** 2026-04-09  
**Confidence:** HIGH
