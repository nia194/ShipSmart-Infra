# Provider Setup: UPS, FedEx, DHL, USPS

How to configure real carrier API credentials for each provider.

---

## Prerequisites

Each carrier requires a developer account. Sign up at:

| Carrier | Developer Portal | Auth Method |
|---------|-----------------|-------------|
| UPS | https://developer.ups.com/ | OAuth2 (client_credentials) |
| FedEx | https://developer.fedex.com/ | OAuth2 (client_credentials) |
| DHL | https://developer.dhl.com/ | Basic auth (API key + secret) |
| USPS | https://developer.usps.com/ | OAuth2 (client_credentials) |

---

## Step 1: Get API Credentials

### UPS
1. Go to https://developer.ups.com/get-started
2. Create an app → get Client ID and Client Secret
3. Note your UPS Account Number (6 alphanumeric characters)

### FedEx
1. Go to https://developer.fedex.com/api/en-us/catalog.html
2. Create a project → get API Key (Client ID) and Secret Key
3. Note your FedEx Account Number

### DHL Express
1. Go to https://developer.dhl.com/
2. Register for the MyDHL API → get API Key and API Secret
3. Note your DHL Express Account Number

### USPS
1. Go to https://developer.usps.com/
2. Register for the NEW APIs (NOT the deprecated Web Tools)
3. Get Consumer Key (Client ID) and Consumer Secret

---

## Step 2: Set Environment Variables

### For Local Development

Edit `apps/api-python/.env` (create from `.env.example` if it doesn't exist):

```bash
# Choose one: mock, ups, fedex, dhl, usps
SHIPPING_PROVIDER=ups

# UPS
UPS_CLIENT_ID=your-ups-client-id
UPS_CLIENT_SECRET=your-ups-client-secret
UPS_ACCOUNT_NUMBER=your-ups-account-number
UPS_BASE_URL=https://onlinetools.ups.com

# FedEx
FEDEX_CLIENT_ID=your-fedex-client-id
FEDEX_CLIENT_SECRET=your-fedex-client-secret
FEDEX_ACCOUNT_NUMBER=your-fedex-account-number
FEDEX_BASE_URL=https://apis.fedex.com

# DHL Express
DHL_API_KEY=your-dhl-api-key
DHL_API_SECRET=your-dhl-api-secret
DHL_ACCOUNT_NUMBER=your-dhl-account-number
DHL_BASE_URL=https://express.api.dhl.com

# USPS
USPS_CLIENT_ID=your-usps-client-id
USPS_CLIENT_SECRET=your-usps-client-secret
USPS_BASE_URL=https://api.usps.com
```

### For Production (Render)

Set the same variables in the Render dashboard:
1. Go to Render dashboard → `shipsmart-api-python` service
2. Environment tab → add each variable
3. Change `SHIPPING_PROVIDER` from `mock` to the desired provider
4. Restart the service

---

## Step 3: Verify

After setting credentials and restarting:

1. Check health: `GET /health`
2. Test address validation: `POST /api/v1/orchestration/execute`
   ```json
   {
     "query": "validate address",
     "params": {
       "street": "1600 Amphitheatre Parkway",
       "city": "Mountain View",
       "state": "CA",
       "zip_code": "94043"
     }
   }
   ```
3. Test quote preview: `POST /api/v1/orchestration/execute`
   ```json
   {
     "query": "shipping rate estimate",
     "params": {
       "origin_zip": "90210",
       "destination_zip": "10001",
       "weight_lbs": 5.0,
       "length_in": 12.0,
       "width_in": 8.0,
       "height_in": 6.0
     }
   }
   ```

---

## Exact File Paths

| Purpose | Path |
|---------|------|
| Local dev secrets | `apps/api-python/.env` |
| Env var template | `apps/api-python/.env.example` |
| Config definitions | `apps/api-python/app/core/config.py` |
| Provider factory | `apps/api-python/app/providers/__init__.py` |
| UPS provider | `apps/api-python/app/providers/ups_provider.py` |
| FedEx provider | `apps/api-python/app/providers/fedex_provider.py` |
| DHL provider | `apps/api-python/app/providers/dhl_provider.py` |
| USPS provider | `apps/api-python/app/providers/usps_provider.py` |
| Mock provider | `apps/api-python/app/providers/mock_provider.py` |

---

## Security

- `.env` is in `.gitignore` — never committed
- `.env.example` contains empty placeholders only — safe to commit
- `config.py` has empty string defaults — no secrets in source
- Production secrets are set in the Render dashboard (not in `render.yaml`)
- No provider file contains hardcoded credentials
