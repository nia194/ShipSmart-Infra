// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOL: ADDRESS VALIDATION & NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────
//
// USE CASE:
//   Users type messy location data — abbreviations, missing ZIPs, partial
//   addresses, wrong formatting. Before quoting or booking, the system should
//   normalize input into a clean, structured shipping address format.
//
// WHY MCP:
//   Expose address validation as an MCP tool so the LLM agent can decide
//   when to call it (e.g. before fetching quotes, after user types an address).
//   The LLM should NOT be the source of truth for address validation — a
//   dedicated API tool validates; the LLM decides when to invoke it.
//
// TOOL SIGNATURE:
//   Name: validate_address
//   Input:  { rawAddress: string }  — free-form user location text
//   Output: {
//     valid: boolean,
//     normalized: {
//       street1: string,
//       street2: string | null,
//       city: string,
//       state: string,        // 2-letter code
//       zip: string,          // 5-digit or ZIP+4
//       country: string,      // ISO 3166-1 alpha-2
//     },
//     corrections: string[],  // list of changes made (e.g. "Added ZIP 10001")
//     confidence: number,     // 0-1 confidence score
//   }
//
// APPROACH:
//   1. Receive raw address string from client or MCP tool call
//   2. Call USPS Address Standardization API (Web Tools API)
//      - Endpoint: https://secure.shippingapis.com/ShippingAPI.dll
//      - API: Verify (AddressValidateRequest)
//      - Requires USPS_USER_ID secret (free registration at https://registration.shippingapis.com/)
//   3. Parse XML response into structured fields
//   4. If USPS fails (international address), fall back to:
//      a. Google Maps Geocoding API (requires GOOGLE_MAPS_API_KEY)
//      b. Or a simple regex-based parser as last resort
//   5. Return normalized address with corrections list and confidence score
//   6. Optionally cache validated addresses in a `validated_addresses` table
//      to avoid redundant API calls for the same input
//
// INTEGRATION POINTS:
//   - CityInput component (src/components/shipping/CityInput.tsx):
//     After user selects/types a city, call this function to validate
//     and auto-correct the full address before quote submission
//   - ShipmentForm submit handler: validate both origin and destination
//     before calling get-shipping-quotes
//   - MCP tool registration: register as "validate_address" tool so the
//     AI agent can call it contextually during conversation
//
// ERROR HANDLING:
//   - If USPS API is down: return { valid: false, confidence: 0 } with
//     a helpful error message, allow user to proceed with unvalidated input
//   - If address is ambiguous (multiple matches): return top match with
//     corrections array explaining alternatives
//   - Rate limit: USPS allows ~100k requests/day for free tier
//
// SECRETS REQUIRED:
//   - USPS_USER_ID: Free from https://registration.shippingapis.com/
//   - GOOGLE_MAPS_API_KEY (optional fallback for international addresses)
//
// EXAMPLE:
//   Input:  { rawAddress: "123 main st apt 4 new york" }
//   Output: {
//     valid: true,
//     normalized: {
//       street1: "123 MAIN ST",
//       street2: "APT 4",
//       city: "NEW YORK",
//       state: "NY",
//       zip: "10001-2345",
//       country: "US"
//     },
//     corrections: ["Added ZIP 10001-2345", "Standardized street format"],
//     confidence: 0.95
//   }
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { rawAddress } = await req.json();

    if (!rawAddress || typeof rawAddress !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid rawAddress field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement USPS Address Standardization API call
    // TODO: Implement Google Maps Geocoding fallback for international
    // TODO: Implement response parsing and normalization
    // TODO: Implement caching layer for validated addresses
    // TODO: Register as MCP tool "validate_address"

    return new Response(
      JSON.stringify({
        error: "Address validation not yet implemented",
        placeholder: true,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
