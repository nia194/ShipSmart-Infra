# Frontend AI Integration Guide

## Overview

The frontend now integrates with Python FastAPI advisor endpoints to provide AI-powered shipping advice, tracking guidance, and recommendations alongside the transactional quote flow.

## Architecture: Frontend → API Calls

```
Frontend Components
  │
  ├── ShippingAdvisorComponent
  │    └─ calls POST /api/v1/advisor/shipping
  │
  ├── TrackingAdvisorComponent
  │    └─ calls POST /api/v1/advisor/tracking
  │
  ├── RecommendationCard
  │    └─ calls POST /api/v1/advisor/recommendation
  │
  └── [Existing Quote Components]
       └─ calls POST /api/v1/quotes (Java API)
```

## Configuration

### API Base URLs

**File:** `src/config/api.ts`

```typescript
export const apiConfig = {
  javaApiBaseUrl: import.meta.env.VITE_JAVA_API_BASE_URL ?? "http://localhost:8080",
  pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_BASE_URL ?? "http://localhost:8000",
};

export const pythonApi = {
  advisors: {
    shipping: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/shipping`,
    tracking: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/tracking`,
    recommendation: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/recommendation`,
  },
};
```

### Environment Variables

**File:** `.env.local`

```bash
VITE_JAVA_API_BASE_URL=http://localhost:8080
VITE_PYTHON_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## API Service Layer

**File:** `src/lib/advisor-api.ts`

Provides type-safe wrappers for all advisor endpoints:

```typescript
import { advisorService } from "@/lib/advisor-api";

// Shipping advice
const response = await advisorService.getShippingAdvice({
  query: "What carriers are available?",
  context: {
    origin_zip: "90210",
    destination_zip: "10001",
    weight_lbs: 5.0,
  },
});

// Tracking guidance
const guidance = await advisorService.getTrackingGuidance({
  issue: "Package is delayed",
  context: {
    tracking_number: "1Z...",
    carrier: "UPS",
  },
});

// Recommendations
const recommendation = await advisorService.getRecommendations({
  services: [
    { service: "Ground", price_usd: 9.99, estimated_days: 5 },
    { service: "Express", price_usd: 19.99, estimated_days: 2 },
  ],
  context: { fragile: true },
});
```

## Components & Pages

### 1. Advisor Page

**File:** `src/pages/AdvisorPage.tsx`

Dedicated page with two tabs:
- **Shipping Advisor** — Ask shipping questions
- **Tracking Guidance** — Get help with delivery issues

**Features:**
- Textarea input for user query
- Tab switching between advisors
- Loading state while fetching
- Error message display
- Response with advice + sources + tools used
- Next steps extraction (for tracking)

**Navigation:** Add to main nav or sidebar
```typescript
<NavLink to="/advisor">💡 Advisor</NavLink>
```

---

### 2. Recommendation Card Component

**File:** `src/components/advisor/RecommendationCard.tsx`

Displays a single service recommendation with:
- Service name
- Price and estimated days
- Recommendation type badge (Cheapest, Fastest, Best Value, Balanced)
- Explanation text
- Visual highlight option for primary recommendation

**Usage:**
```typescript
<RecommendationCard
  recommendation={primaryRecommendation}
  isHighlighted={true}
/>

{alternatives.map((alt) => (
  <RecommendationCard
    key={alt.service_name}
    recommendation={alt}
    isHighlighted={false}
  />
))}
```

---

## Integration Patterns

### Pattern 1: Standalone Advisor Page

Users navigate to `/advisor` page to:
- Ask shipping questions
- Get tracking guidance
- See advisor features in isolation

**Pros:** Clear separation, no disruption to existing flows

**Cons:** User must navigate away from quote flow

**Recommendation:** Good for Phase 10; can be integrated deeper in Phase 11

---

### Pattern 2: Recommendation Integration with Quotes

In quote comparison page:
1. Show Java quote results
2. Below quotes, show recommendation:
   ```
   [Call recommendation endpoint with Java quotes]
   [Display RecommendationCard with primary highlighted]
   [Show alternatives]
   [Button: "Use Recommended Service"]
   ```

**Pros:** Guides user within existing flow

**Cons:** Additional API call; potential latency

**Implementation:** Deferred to Phase 11 (need to decide on integration UX)

---

### Pattern 3: Advisor Help Panels

Small panels in existing pages:
- Quote page: "💡 Need help choosing?" → opens shipping advisor panel
- Booking page: "📦 Questions?" → opens tracking advisor panel

**Pros:** Non-disruptive; discoverable

**Cons:** Requires space in existing layouts

**Implementation:** Deferred to Phase 11 (depends on design)

---

## Type Safety

All advisor responses are fully typed via `src/lib/advisor-api.ts`:

```typescript
interface ShippingAdvisorResponse {
  answer: string;
  reasoning_summary: string;
  tools_used: string[];
  sources: Array<{source: string; chunk_index: number; score: number}>;
  context_used: boolean;
}

interface TrackingAdvisorResponse {
  guidance: string;
  issue_summary: string;
  tools_used: string[];
  sources: Array<{source: string; chunk_index: number; score: number}>;
  next_steps: string[];
}

interface RecommendationResponse {
  primary_recommendation: ServiceOption;
  alternatives: ServiceOption[];
  summary: string;
  metadata: {num_options: number; primary_type: string};
}
```

**Usage:**
```typescript
const response: ShippingAdvisorResponse = 
  await advisorService.getShippingAdvice(request);

// Full TypeScript support for response fields
console.log(response.tools_used);  // string[]
console.log(response.sources[0].score);  // number
```

---

## Error Handling

### User-Facing Error Messages

All API calls are wrapped with try-catch:

```typescript
try {
  const response = await advisorService.getShippingAdvice(request);
  setResponse(response);
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : "Failed to get shipping advice. Please try again."
  );
}
```

**Display error:**
```typescript
{error && (
  <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
    {error}
  </div>
)}
```

### Fallback Behavior

If Python API is unavailable:
- Show error message
- Transactional flows (Java quotes, booking) still work
- No loss of core functionality

---

## Performance Considerations

### API Call Latency

- Shipping advisor: ~500ms (RAG retrieval + tool execution + LLM)
- Tracking guidance: ~400ms (RAG retrieval + LLM)
- Recommendations: ~100ms (deterministic scoring)

**Optimization strategy:**
- Show loading state during fetch
- Consider debouncing repeated requests
- Cache responses client-side if user retries same query

### Bundling

`advisor-api.ts` is small (~3KB gzipped) and lazy-loaded with AdvisorPage.

---

## Testing

### Manual Testing Checklist

- [ ] Shipping advisor responds to various queries
- [ ] Tracking guidance returns next steps
- [ ] Recommendations highlight primary option
- [ ] Error message displays on API failure
- [ ] Loading state shows while fetching
- [ ] Sources render correctly with relevance scores
- [ ] Tab switching works without losing state
- [ ] Response text renders with proper line breaks

### Automated Integration Tests

Test each endpoint with sample requests (see Phase 10 integration tests).

---

## Accessibility

- All inputs have associated labels
- Error messages use `aria-live="polite"`
- Loading states announced to screen readers
- Sufficient color contrast on recommendation badges
- Keyboard navigation works for tabs and buttons

---

## Styling

Components use Tailwind CSS with consistent spacing:
- Buttons: `px-6 py-2 bg-blue-600 text-white rounded`
- Cards: `bg-white border rounded-lg p-6`
- Highlights: `bg-blue-50 border-blue-500`

Match existing ShipSmart UI patterns.

---

## Future Enhancements (Phase 11+)

1. **Recommendation within quotes flow**
   - Show recommendations alongside Java quote results
   - "Use Recommended Service" button

2. **Advisor chat interface**
   - Multi-turn conversation
   - Follow-up questions
   - Conversation history

3. **Embedded help panels**
   - Quote page: "Help choosing?" → advisor panel
   - Booking page: "Questions?" → advisor panel

4. **Analytics**
   - Track which advisor features are used
   - Measure recommendation acceptance rate
   - Track user satisfaction

5. **Real-time data integration**
   - Fetch live Java quotes in recommendations
   - Dynamic pricing insights
   - Carrier availability updates

---

## Common Issues & Solutions

### Issue: CORS error when calling Python API

**Symptom:** "Access to XMLHttpRequest has been blocked by CORS policy"

**Solution:** Python API has CORS enabled in main.py for frontend origin. Ensure:
- Frontend sends requests to correct Python API URL
- Python `CORS_ALLOWED_ORIGINS` includes frontend domain

### Issue: Long advisor response times

**Symptom:** Advisor takes >2 seconds to respond

**Solution:**
- May indicate RAG retrieval is slow
- LLM may be rate-limited or slow
- Tool execution may be failing
- Check error logs in Python API

### Issue: Recommendation scores are always the same

**Symptom:** All services get equal score, primary selection unclear

**Solution:** Verify `RecommendationRequest.services` has diverse prices and delivery days. Scoring is deterministic based on input data.

---

## Monitoring & Debugging

### Frontend Console Logs

Enable debug logs by setting:
```typescript
const DEBUG = true;  // in advisor-api.ts

if (DEBUG) console.log('Advisor request:', request);
if (DEBUG) console.log('Advisor response:', response);
```

### Python API Logs

Watch Python service logs for:
```
INFO: RAG query completed: X sources
INFO: Tool execution: tool_name
INFO: Executing tool=validate_address
ERROR: Tool execution failed
```

### Network Tab

Check Network tab in browser DevTools:
- Request to `http://localhost:8000/api/v1/advisor/shipping`
- Response should include `answer`, `sources`, `tools_used`
- Response time should be < 2 seconds
