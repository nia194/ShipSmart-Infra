// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

interface PackageItem {
  type: string; qty: string; weight: string; l: string; w: string; h: string; handling: string;
}

interface ShippingService {
  id: string; carrier: string; name: string; tier: string; price: number;
  originalPrice: number | null; transitDays: number; date: string;
  deliverBy: string | null; guaranteed: boolean;
  promo: { code: string; pct: string; save: number; label: string } | null;
  ai: string;
  breakdown: { shipping: { label: string; amount: number }[]; pickup: { label: string; amount: number }[] };
  details: Record<string, string>; features: string[];
}

function generateMockQuotes(
  origin: string, dest: string, dropDate: string, delivDate: string, packages: PackageItem[]
): { prime: { top: ShippingService[]; more: ShippingService[] }; private: { top: ShippingService[]; more: ShippingService[] } } {
  const totalWeight = packages.reduce((a, p) => a + (parseFloat(p.weight) || 0) * (parseInt(p.qty) || 1), 0);
  const pm = Math.max(0.8, Math.min(2.0, totalWeight / 30));

  const baseDate = new Date(dropDate);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  return {
    prime: {
      top: [
        { id: "ups-ground", carrier: "UPS", name: "UPS® Ground", tier: "STANDARD", price: +(58.90 * pm).toFixed(2), originalPrice: null, transitDays: 7, date: fmt(addDays(baseDate, 7)), deliverBy: null, guaranteed: false, promo: null, ai: "Best value. 98.2% on-time.", breakdown: { shipping: [{ label: "Base rate", amount: +(42.15 * pm).toFixed(2) }, { label: "Residential Delivery", amount: 6.95 }, { label: "Fuel Surcharge", amount: +(5.27 * pm).toFixed(2) }, { label: "Extended Area", amount: 4.53 }], pickup: [{ label: "Scheduled Pickup", amount: 0 }] }, details: { Tracking: "UPS My Choice®", Insurance: "$100 included", Cutoff: "By 6 PM" }, features: ["Tracking", "Access Point™"] },
        { id: "fedex-express", carrier: "FedEx", name: "FedEx Express Saver®", tier: "EXPRESS", price: +(124.30 * pm).toFixed(2), originalPrice: +(146.24 * pm).toFixed(2), transitDays: 3, date: fmt(addDays(baseDate, 3)), deliverBy: "4:30 PM", guaranteed: true, promo: { code: "SPRING26", pct: "15%", save: +(21.94 * pm).toFixed(2), label: "Spring Sale" }, ai: "Fastest guaranteed under $130.", breakdown: { shipping: [{ label: "Base rate", amount: +(108.40 * pm).toFixed(2) }, { label: "Residential Delivery", amount: 6.95 }, { label: "Fuel Surcharge", amount: +(15.72 * pm).toFixed(2) }, { label: "Spring Discount", amount: -(+(21.94 * pm).toFixed(2)) }], pickup: [{ label: "On Call Pickup", amount: 14.75 }, { label: "Discount", amount: -14.75 }] }, details: { Guarantee: "Money-back", Cutoff: "By 5:30 PM" }, features: ["Money-back", "InSight®"] },
        { id: "dhl-express", carrier: "DHL", name: "DHL Express Worldwide", tier: "EXPRESS", price: +(138.50 * pm).toFixed(2), originalPrice: null, transitDays: 3, date: fmt(addDays(baseDate, 3)), deliverBy: "12 PM", guaranteed: true, promo: null, ai: "Best international. Customs clearance.", breakdown: { shipping: [{ label: "Base rate", amount: +(112 * pm).toFixed(2) }, { label: "Fuel Surcharge", amount: +(16.80 * pm).toFixed(2) }, { label: "Customs", amount: 9.70 }], pickup: [{ label: "Courier Pickup", amount: 0 }] }, details: { Customs: "220+ countries", Cutoff: "By 4 PM" }, features: ["Guaranteed", "Global customs"] },
      ],
      more: [
        { id: "fedex-ground", carrier: "FedEx", name: "FedEx Ground®", tier: "STANDARD", price: +(62.30 * pm).toFixed(2), originalPrice: +(69.22 * pm).toFixed(2), transitDays: 7, date: fmt(addDays(baseDate, 7)), deliverBy: null, guaranteed: false, promo: { code: "NEWSHIP10", pct: "10%", save: +(6.92 * pm).toFixed(2), label: "New Customer" }, ai: "Budget with discount.", breakdown: { shipping: [{ label: "Base rate", amount: +(48.50 * pm).toFixed(2) }, { label: "Residential", amount: 6.95 }, { label: "Fuel", amount: +(6.06 * pm).toFixed(2) }, { label: "Discount", amount: -(+(6.92 * pm).toFixed(2)) }], pickup: [{ label: "FedEx Office", amount: 0 }] }, details: { Cutoff: "By 5 PM" }, features: ["Tracking"] },
        { id: "fedex-economy", carrier: "FedEx", name: "FedEx Ground® Economy", tier: "ECONOMY", price: +(42.10 * pm).toFixed(2), originalPrice: +(46.78 * pm).toFixed(2), transitDays: 9, date: fmt(addDays(baseDate, 9)), deliverBy: null, guaranteed: false, promo: { code: "NEWSHIP10", pct: "10%", save: +(4.68 * pm).toFixed(2), label: "New Customer" }, ai: "Cheapest major carrier.", breakdown: { shipping: [{ label: "Base", amount: +(32.40 * pm).toFixed(2) }, { label: "Surcharge", amount: 4.50 }, { label: "Fuel", amount: +(3.24 * pm).toFixed(2) }, { label: "Discount", amount: -(+(4.68 * pm).toFixed(2)) }], pickup: [{ label: "FedEx Office", amount: 0 }] }, details: {}, features: ["Budget"] },
      ],
    },
    private: {
      top: [
        { id: "ll-std", carrier: "Lugless", name: "Lugless Standard", tier: "STANDARD", price: +(49 * pm).toFixed(2), originalPrice: null, transitDays: 6, date: fmt(addDays(baseDate, 6)), deliverBy: null, guaranteed: false, promo: null, ai: "Door-to-door specialist.", breakdown: { shipping: [{ label: "Base (door-to-door)", amount: +(39 * pm).toFixed(2) }, { label: "Insurance", amount: 6 }, { label: "Platform fee", amount: 4 }], pickup: [{ label: "Free pickup", amount: 0 }] }, details: { Pickup: "Free door pickup", Insurance: "Full replacement" }, features: ["Door pickup", "App tracking"] },
        { id: "lts-std", carrier: "LuggageToShip", name: "LuggageToShip Standard", tier: "STANDARD", price: +(54 * pm).toFixed(2), originalPrice: null, transitDays: 5, date: fmt(addDays(baseDate, 5)), deliverBy: null, guaranteed: false, promo: null, ai: "Full-service with pro packing.", breakdown: { shipping: [{ label: "Base", amount: +(42 * pm).toFixed(2) }, { label: "Insurance", amount: 7 }, { label: "Booking fee", amount: 5 }], pickup: [{ label: "Home pickup", amount: 0 }] }, details: { Packing: "Pro packing +$15" }, features: ["Home pickup", "Packing"] },
      ],
      more: [
        { id: "lts-econ", carrier: "LuggageToShip", name: "LuggageToShip Economy", tier: "ECONOMY", price: +(39 * pm).toFixed(2), originalPrice: null, transitDays: 8, date: fmt(addDays(baseDate, 8)), deliverBy: null, guaranteed: false, promo: null, ai: "Most affordable.", breakdown: { shipping: [{ label: "Base", amount: +(28 * pm).toFixed(2) }, { label: "Insurance", amount: 4 }, { label: "Fee", amount: 5 }, { label: "Handling", amount: 2 }], pickup: [{ label: "Partner drop-off", amount: 0 }] }, details: {}, features: ["Economy"] },
      ],
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { origin, destination, dropOffDate, expectedDeliveryDate, packages } = await req.json();

    if (!origin || !destination || !dropOffDate || !expectedDeliveryDate || !packages?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const totalWeight = packages.reduce((a: number, p: PackageItem) => a + (parseFloat(p.weight) || 0) * (parseInt(p.qty) || 1), 0);
    const totalItems = packages.reduce((a: number, p: PackageItem) => a + (parseInt(p.qty) || 1), 0);

    await supabase.from("shipment_requests").insert({
      user_id: userId,
      origin,
      destination,
      drop_off_date: dropOffDate,
      expected_delivery_date: expectedDeliveryDate,
      packages,
      total_weight: totalWeight,
      total_items: totalItems,
    });

    const results = generateMockQuotes(origin, destination, dropOffDate, expectedDeliveryDate, packages);

    // ─────────────────────────────────────────────────────────
    // PLACEHOLDER: RAG-BASED QUOTE ENRICHMENT
    // ─────────────────────────────────────────────────────────
    // USE CASE: After carrier APIs return structured quotes, enrich
    //   each service row with LLM-generated insights grounded in
    //   RAG-retrieved provider knowledge. This replaces the hardcoded
    //   `ai` field on each service with evidence-based explanations.
    //
    // APPROACH (to be implemented):
    //   1. Collect all carrier names from the results
    //   2. Call the ai-shipping-advisor edge function (or inline the
    //      RAG+LLM pipeline here) with:
    //      - normalized quote data from `results`
    //      - shipment context (origin, dest, dates, package types, handling)
    //      - user_priority if available
    //   3. The advisor returns QuoteEnrichment[] (one per service)
    //   4. Merge each enrichment into its corresponding service row:
    //      - svc.ai = enrichment.recommendation_reason
    //      - svc.details["Best For"] = enrichment.best_for_label
    //      - svc.details["Caution"] = enrichment.caution_note (if any)
    //      - svc.details["Confidence"] = enrichment.confidence_level
    //      - svc.details["Restrictions"] = enrichment.restriction_note (if any)
    //   5. Optionally attach tradeoff_analysis to the response for
    //      the frontend to display above the comparison table
    //
    // RAG KNOWLEDGE CATEGORIES USED HERE:
    //   - provider_fit: Is this carrier good for the user's item types?
    //   - restrictions: Are there items/sizes this carrier won't accept?
    //   - service_model: Pickup, packing, insurance, concierge vs self-service
    //
    // EXAMPLE ENRICHED ai FIELD (replacing hardcoded strings):
    //   Before: "Best value. 98.2% on-time."
    //   After:  "Recommended for luggage — UPS Ground has reliable handling
    //            for standard suitcases. No size restrictions for your items.
    //            98.2% on-time rate on this route." (confidence: 0.87)
    //
    // IMPLEMENTATION NOTES:
    //   - Call can be async/parallel with quote generation if using
    //     a separate advisor function
    //   - If LLM call fails or times out, fall back to the hardcoded
    //     ai strings (graceful degradation)
    //   - Cache enrichments per carrier+route+package_type combo to
    //     reduce redundant LLM calls
    // ─────────────────────────────────────────────────────────
    // const enrichments = await callAIAdvisor(results, { origin, destination, ... });
    // mergeEnrichmentsIntoResults(results, enrichments);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
