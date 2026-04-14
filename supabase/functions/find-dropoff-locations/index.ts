// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOL: NEAREST DROP-OFF / PICKUP LOCATION FINDER
// ─────────────────────────────────────────────────────────────────────────────
//
// USE CASE:
//   Once the user chooses a shipping service, the next question is often:
//   - "Where do I drop this off?"
//   - "Is there a nearby UPS Access Point?"
//   - "Is there a FedEx location with Hold at Location?"
//   - "What's the most convenient option for me?"
//   This tool answers those questions by querying carrier location APIs.
//
// WHY MCP:
//   Expose as an MCP tool so the AI agent can call it contextually:
//   - After user selects a service
//   - When user asks "where is the nearest drop-off?"
//   - When generating booking instructions
//   The agent decides WHEN to call; the tool provides the data.
//
// TOOL SIGNATURE:
//   Name: find_nearby_dropoff_locations
//   Input: {
//     carrier: string,          // "UPS" | "FedEx" | "DHL" | "Lugless" | "LuggageToShip"
//     address: string,          // user's address or validated address from validate-address
//     latitude?: number,        // optional geo coords for more precise results
//     longitude?: number,
//     radiusMiles?: number,     // default 10
//     packageConstraints?: {
//       weight: number,         // lbs
//       length: number,         // inches
//       width: number,
//       height: number,
//       requiresDropoff: boolean,  // vs scheduled pickup
//       holdAtLocation: boolean,   // user wants to hold package at facility
//     }
//   }
//   Output: {
//     locations: Array<{
//       id: string,
//       name: string,           // e.g. "UPS Access Point® - CVS Pharmacy"
//       type: string,           // "ACCESS_POINT" | "RETAIL" | "DROP_BOX" | "SERVICE_CENTER"
//       address: {
//         street: string,
//         city: string,
//         state: string,
//         zip: string,
//       },
//       distanceMiles: number,
//       hours: { day: string, open: string, close: string }[],
//       capabilities: string[], // ["DROP_OFF", "PICKUP", "HOLD_AT_LOCATION", "PACKING"]
//       phone: string | null,
//       mapUrl: string,         // Google Maps link
//     }>,
//     carrier: string,
//     searchRadius: number,
//   }
//
// APPROACH:
//   1. Receive carrier, address, and optional constraints from client/MCP call
//   2. Based on carrier, call the appropriate location API:
//
//      UPS:
//      - API: UPS Locator API (REST)
//      - Endpoint: https://onlinetools.ups.com/api/locations/v2/search/availabilities/64
//      - Auth: OAuth 2.0 (client_credentials grant)
//      - Requires: UPS_CLIENT_ID, UPS_CLIENT_SECRET secrets
//      - Docs: https://developer.ups.com/api/reference/locator
//      - Returns: UPS Stores, Access Points (CVS, Michaels, etc.), Drop Boxes
//      - Filter by: services available, package size acceptance, hours
//
//      FedEx:
//      - API: FedEx Location Search API (REST)
//      - Endpoint: https://apis.fedex.com/location/v1/locations
//      - Auth: OAuth 2.0 (client_credentials grant)
//      - Requires: FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET secrets
//      - Docs: https://developer.fedex.com/api/en-us/catalog/location/v1/docs.html
//      - Returns: FedEx Office, FedEx Ship Centers, Walgreens, Dollar General
//      - Filter by: Hold at Location availability, package constraints
//
//      DHL:
//      - API: DHL ServicePoint Finder API
//      - Endpoint: https://api.dhl.com/location-finder/v1/find-by-address
//      - Auth: API Key header (DHL-API-Key)
//      - Requires: DHL_API_KEY secret
//      - Docs: https://developer.dhl.com/api-reference/location-finder
//      - Returns: DHL ServicePoints, Parcel Lockers, Post Offices
//
//      Lugless / LuggageToShip:
//      - These are door-to-door services; return a response indicating
//        "No drop-off needed — free home pickup included" with pickup
//        scheduling info instead of locations
//
//   3. Normalize all carrier responses into the common output format
//   4. Sort by distance, filter by capabilities matching packageConstraints
//   5. Optionally enrich with Google Maps embed URL for each location
//   6. Cache results per (carrier, zip, radius) for 24 hours to reduce API calls
//
// INTEGRATION POINTS:
//   - ResultsView / QuoteRow: After user selects a service, show a
//     "Find nearby drop-off" button that calls this function
//   - Booking flow: When generating book redirect, include nearest
//     drop-off location info in the redirect context
//   - AI agent: Agent can proactively suggest nearest locations when
//     the user asks about convenience or logistics
//   - Saved options page: Show "nearest drop-off" for each saved service
//
// ERROR HANDLING:
//   - If carrier API is down: return empty locations[] with a message
//     suggesting the user check the carrier website directly
//   - If no locations found within radius: expand radius automatically
//     (10 → 25 → 50 miles) and retry, or suggest the user try pickup
//   - Rate limits: UPS (free tier ~500/day), FedEx (~500/day), DHL (~1000/day)
//
// SECRETS REQUIRED:
//   - UPS_CLIENT_ID, UPS_CLIENT_SECRET (from https://developer.ups.com/)
//   - FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET (from https://developer.fedex.com/)
//   - DHL_API_KEY (from https://developer.dhl.com/)
//   - GOOGLE_MAPS_API_KEY (optional, for map URLs)
//
// EXAMPLE:
//   Input:  { carrier: "UPS", address: "10001", radiusMiles: 5 }
//   Output: {
//     locations: [
//       {
//         id: "ups-ap-cvs-123",
//         name: "UPS Access Point® - CVS Pharmacy",
//         type: "ACCESS_POINT",
//         address: { street: "350 5th Ave", city: "New York", state: "NY", zip: "10001" },
//         distanceMiles: 0.3,
//         hours: [{ day: "Mon-Fri", open: "8:00 AM", close: "9:00 PM" }],
//         capabilities: ["DROP_OFF", "PICKUP", "HOLD_AT_LOCATION"],
//         phone: "(212) 555-0100",
//         mapUrl: "https://maps.google.com/?q=350+5th+Ave+New+York+NY+10001"
//       }
//     ],
//     carrier: "UPS",
//     searchRadius: 5
//   }
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { carrier, address, latitude, longitude, radiusMiles, packageConstraints } = await req.json();

    if (!carrier || !address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: carrier, address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement UPS Locator API integration
    // TODO: Implement FedEx Location Search API integration
    // TODO: Implement DHL ServicePoint Finder API integration
    // TODO: Handle Lugless/LuggageToShip as door-to-door (no drop-off needed)
    // TODO: Normalize responses into common format
    // TODO: Sort by distance, filter by packageConstraints capabilities
    // TODO: Add caching layer (carrier + zip + radius → cached for 24h)
    // TODO: Register as MCP tool "find_nearby_dropoff_locations"

    return new Response(
      JSON.stringify({
        error: "Drop-off location finder not yet implemented",
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
