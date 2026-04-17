# Advisor Flows: Detailed Walkthrough

This document shows detailed flows for each advisor feature, with example requests and decisions.

## Shipping Advisor Flow

### Example 1: Quote Comparison with Dimensions

**Request:**
```json
{
  "query": "What are the best shipping options for this package?",
  "context": {
    "origin_zip": "90210",
    "destination_zip": "10001",
    "weight_lbs": 5.0,
    "length_in": 12.0,
    "width_in": 8.0,
    "height_in": 6.0
  }
}
```

**Flow:**
1. **Retrieve RAG** (5 sources)
   - "What carriers does ShipSmart support?"
   - "How are shipping quotes calculated?"
   - "What is dimensional weight?"
   - DIM factor 139 / weight calculation docs
   - Carrier comparison info

2. **Decide on tools:**
   - ✅ origin_zip, destination_zip, weight_lbs all provided → **get_quote_preview**

3. **Execute get_quote_preview**
   ```
   Input: origin=90210, dest=10001, weight=5.0, dims=12x8x6
   Output:
   - Ground: $9.99, 5 days
   - Express: $19.99, 2 days
   - Overnight: $49.99, 1 day
   ```

4. **Build LLM prompt:**
   ```
   System: "You are a helpful shipping expert..."
   User: "Question: What are the best shipping options for this package?"
   
   Relevant context:
   [RAG chunk 1: Carrier comparison]
   [RAG chunk 2: Shipping policies]
   [RAG chunk 3: DIM weight explanation]
   
   Tool results:
   Ground: $9.99, 5 days
   Express: $19.99, 2 days
   Overnight: $49.99, 1 day
   ```

5. **LLM generates answer:**
   ```
   "For your 5 lb package from CA to NY, you have three options:
   - Ground at $9.99 takes 5 business days (most economical)
   - Express at $19.99 takes 2 days (good balance)
   - Overnight at $49.99 arrives next day (fastest)
   
   Consider Express if you need it quickly without the overnight cost.
   Ground is fine for non-urgent shipments."
   ```

6. **Return response:**
   ```json
   {
     "answer": "[LLM output above]",
     "reasoning_summary": "Based on your shipment dimensions and carrier policies...",
     "tools_used": ["get_quote_preview"],
     "sources": 5 sources,
     "context_used": true
   }
   ```

---

### Example 2: Address Validation

**Request:**
```json
{
  "query": "Is this address valid for delivery?",
  "context": {
    "street": "456 Oak Ave",
    "city": "Los Angeles",
    "state": "CA",
    "zip_code": "90001"
  }
}
```

**Flow:**
1. **Retrieve RAG** (about delivery, address requirements)

2. **Decide on tools:**
   - ✅ street, city, state, zip_code all provided → **validate_address**
   - ✗ No origin/dest/weight → no quote preview

3. **Execute validate_address**
   ```
   Input: 456 Oak Ave, Los Angeles, CA, 90001
   Output:
   - is_valid: true
   - normalized: "456 Oak Ave, Los Angeles, CA, 90001"
   - deliverable: true
   - address_type: "residential"
   ```

4. **Build prompt with context + tool result**

5. **LLM responds:** "Yes, the address 456 Oak Ave, Los Angeles, CA 90001 appears valid and deliverable for most carriers. Residential addresses are supported by all major carriers."

6. **Return response** with tools_used: ["validate_address"]

---

### Example 3: General Policy Question (RAG Only)

**Request:**
```json
{
  "query": "What's the difference between Ground and Express shipping?"
}
```

**Flow:**
1. **Retrieve RAG** (carrier info, shipping policies)

2. **Decide on tools:**
   - ✗ No origin/dest/weight
   - ✗ No address
   - → No tools needed (RAG-only path)

3. **Build prompt with RAG context only**

4. **LLM responds:** "Ground shipping typically takes 3-5 business days and is the most economical option. Express takes 2-3 days and costs 2-3x more. Choose Express for items needed sooner, Ground for non-urgent shipments."

5. **Return response** with tools_used: []

---

## Tracking Advisor Flow

### Example: Delayed Package Guidance

**Request:**
```json
{
  "issue": "My package is delayed and I'm concerned about it. What should I do?",
  "context": {
    "tracking_number": "1Z999AA10123456784",
    "carrier": "UPS",
    "expected_delivery": "2026-04-07"
  }
}
```

**Flow:**
1. **Enrich query** with delivery/tracking keywords:
   → "My package is delayed and I'm concerned about it. What should I do? delivery tracking shipping issue"

2. **Retrieve RAG** (5 sources on delays, tracking, carrier procedures)
   - "What shipping carriers are available?"
   - "Common delivery issues FAQ"
   - "How to track a package"
   - "What if a package is delayed?"
   - UPS/FedEx service level info

3. **Decide on tools:**
   - ✗ No address provided → skip validate_address
   - ✗ Tracking info not actionable via tools
   - → No tools needed (mostly RAG-driven)

4. **Build prompt with RAG context**

5. **LLM responds:**
   ```
   "Package delays are common and usually resolve within 24-48 hours.
   
   Here's what you can do:
   1. Check your tracking on the UPS website for updates
   2. Contact UPS support if delay exceeds 3 business days
   3. Request signature confirmation on next attempt
   4. Consider opening a claim if package is lost
   
   For non-urgent items, delays are typically resolved automatically."
   ```

6. **Extract next steps** from LLM response:
   - "Check your tracking on the UPS website for updates"
   - "Contact UPS support if delay exceeds 3 business days"
   - "Request signature confirmation on next attempt"

7. **Return response:**
   ```json
   {
     "guidance": "[LLM output above]",
     "issue_summary": "Package delays are common and usually resolve within 24-48 hours.",
     "tools_used": [],
     "sources": 5 sources,
     "next_steps": [3 extracted steps]
   }
   ```

---

## Recommendation Flow

### Example: Fragile Item Selection

**Request:**
```json
{
  "services": [
    {"service": "Ground", "price_usd": 9.99, "estimated_days": 5},
    {"service": "Express", "price_usd": 19.99, "estimated_days": 2},
    {"service": "Overnight", "price_usd": 49.99, "estimated_days": 1}
  ],
  "context": {
    "fragile": true,
    "item_value": 500
  }
}
```

**Flow:**
1. **Score each service:**

   **Ground:**
   - price_score = 1 - (9.99 - 9.99) / (49.99 - 9.99) = 1.0
   - speed_score = 1 - (5 - 1) / (5 - 1) = 0.0
   - type = "cheapest"
   - final_score = 1.0 × 1.5 + 0.0 × 0.5 = **1.5**

   **Express:**
   - price_score = 1 - (19.99 - 9.99) / (49.99 - 9.99) = 0.75
   - speed_score = 1 - (2 - 1) / (5 - 1) = 0.75
   - type = "balanced" (neither cheapest nor fastest)
   - final_score = (0.75 + 0.75) / 2 = **0.75**

   **Overnight:**
   - price_score = 1 - (49.99 - 9.99) / (49.99 - 9.99) = 0.0
   - speed_score = 1 - (1 - 1) / (5 - 1) = 1.0
   - type = "fastest"
   - final_score = 1.0 × 1.5 + 0.0 × 0.5 = **1.5**

2. **Sort by score:**
   - Ground (1.5) and Overnight (1.5) tied for first
   - Primary = Ground (cheaper of the two)
   - Alternatives = [Overnight, Express]

3. **Generate explanations:**
   - Ground: "Ground costs $9.99 and takes 5 day(s) — consider faster option for fragile goods"
   - Overnight: "Overnight costs $49.99 and takes 1 day(s) — good for fragile items requiring speed"
   - Express: "Express costs $19.99 and takes 2 day(s) — good balance for fragile items"

4. **Generate summary:**
   ```
   "Recommended: Ground at $9.99 (5 days).
   
   However, for fragile items worth $500, consider Express ($19.99, 2 days)
   or Overnight ($49.99, 1 day) for better protection.
   
   Alternative options: Overnight, Express."
   ```

5. **Return response** with primary=Ground, alternatives=[Overnight, Express]

---

## Error Cases

### Case: Missing Required Context

**Request:**
```json
{
  "query": "What shipping options are available?"
}
```

**Flow:**
1. Retrieve RAG (generic carrier info)
2. No tools executed (no context)
3. LLM generates general response about ShipSmart carriers
4. Return with tools_used: [], context_used: true (from RAG)

### Case: LLM Unavailable

If `llm_client` is `EchoClient` (no real LLM):

**Response:**
```json
{
  "answer": "[LLM not configured] No LLM provider is set. The RAG pipeline retrieved context successfully, but cannot generate an answer without an LLM. Set LLM_PROVIDER=openai to enable real completions.",
  "reasoning_summary": "[same as answer]",
  "tools_used": ["get_quote_preview"],
  "sources": [...],
  "context_used": true
}
```

### Case: Tool Execution Fails

If `validate_address` fails (invalid input):

**Response still succeeds** — tool failure is handled gracefully:
```json
{
  "answer": "Based on the shipping information provided, ...",
  "reasoning_summary": "...",
  "tools_used": [],  // address validation tool was not included
  "sources": [...],
  "context_used": true
}
```

The LLM gets RAG context instead of tool data and generates advice anyway.
