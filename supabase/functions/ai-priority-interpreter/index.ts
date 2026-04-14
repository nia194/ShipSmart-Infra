// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
// ============================================================
// AI Priority Interpreter — Edge Function placeholder
// ============================================================
// This edge function converts user priority selections and
// optional free-text statements into structured ranking weights
// for the quote comparison algorithm.
//
// IMPORTANT DESIGN DECISION: The system should NOT default to
// inferring user intent from shipping data alone. It uses:
//   1. Explicit structured priority selection (always required)
//   2. Optional free-text interpretation (additive refinement)
//
// NO ACTUAL LLM LOGIC IS IMPLEMENTED HERE YET.
// Each step below is a detailed placeholder.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── AUTH (optional — priority interpretation can work for guests) ──
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const { structured_priority, free_text_priority, shipment_context } = body as {
      structured_priority: "price" | "speed" | "value" | "special_items";
      free_text_priority?: string;
      shipment_context?: {
        origin: string;
        destination: string;
        package_types: string[];
        drop_off_date: string;
        delivery_date: string;
      };
    };

    if (!structured_priority) {
      return new Response(
        JSON.stringify({ error: "structured_priority is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 1: COMPUTE BASELINE WEIGHTS FROM STRUCTURED PRIORITY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Convert the user's explicit priority selection
    //   into a baseline set of ranking weights. This is the
    //   primary signal — NOT the LLM.
    // APPROACH:
    //   - Map each structured_priority to predefined weight sets:
    //     "price"         → { price: 0.5, speed: 0.15, reliability: 0.15, package_fit: 0.1, convenience: 0.1 }
    //     "speed"         → { price: 0.1, speed: 0.5, reliability: 0.2, package_fit: 0.1, convenience: 0.1 }
    //     "value"         → { price: 0.3, speed: 0.2, reliability: 0.2, package_fit: 0.15, convenience: 0.15 }
    //     "special_items" → { price: 0.1, speed: 0.1, reliability: 0.2, package_fit: 0.45, convenience: 0.15 }
    //   - These baselines are deterministic — no LLM needed.
    // ─────────────────────────────────────────────────────────
    const computeBaselineWeights = (priority: string) => {
      const maps: Record<string, any> = {
        price: { price_weight: 0.5, speed_weight: 0.15, reliability_weight: 0.15, package_fit_weight: 0.1, convenience_weight: 0.1 },
        speed: { price_weight: 0.1, speed_weight: 0.5, reliability_weight: 0.2, package_fit_weight: 0.1, convenience_weight: 0.1 },
        value: { price_weight: 0.3, speed_weight: 0.2, reliability_weight: 0.2, package_fit_weight: 0.15, convenience_weight: 0.15 },
        special_items: { price_weight: 0.1, speed_weight: 0.1, reliability_weight: 0.2, package_fit_weight: 0.45, convenience_weight: 0.15 },
      };
      return maps[priority] || maps.value;
    };
    const baselineWeights = computeBaselineWeights(structured_priority);

    // ─────────────────────────────────────────────────────────
    // STEP 2: CHECK IF FREE TEXT REQUIRES LLM INTERPRETATION
    // ─────────────────────────────────────────────────────────
    // USE CASE: Only invoke the LLM if the user provided free
    //   text that could refine the baseline weights.
    // APPROACH:
    //   - If free_text_priority is null/empty → return baseline
    //   - If free_text_priority is provided → proceed to LLM
    //   - This keeps costs low and latency fast for most users
    // ─────────────────────────────────────────────────────────
    if (!free_text_priority?.trim()) {
      return new Response(JSON.stringify({
        weights: baselineWeights,
        interpretation_summary: "Using baseline weights based on selection.",
        used_free_text: false,
        confidence: 1.0
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─────────────────────────────────────────────────────────
    // STEP 3: BUILD LLM PROMPT FOR FREE-TEXT INTERPRETATION
    // ─────────────────────────────────────────────────────────
    // USE CASE: Interpret the user's free-text priority statement
    //   and adjust the baseline weights accordingly.
    // PROMPT STRUCTURE:
    //   [System] You are a shipping priority interpreter. The user
    //     has selected a primary priority and optionally provided
    //     additional context. Adjust the baseline ranking weights
    //     based on the free-text input. Weights must:
    //     - Be between 0 and 1
    //     - Sum to approximately 1.0
    //     - Stay reasonable (no weight below 0.05)
    //     - Not deviate wildly from baseline unless text is clear
    //   [User]
    //     SELECTED PRIORITY: {structured_priority}
    //     BASELINE WEIGHTS: {baselineWeights}
    //     USER STATEMENT: {free_text_priority}
    //     SHIPMENT CONTEXT: {shipment_context if provided}
    //     Adjust weights and explain your interpretation.
    // EXAMPLES OF FREE TEXT → WEIGHT ADJUSTMENTS:
    //   "I care more about convenience than speed"
    //     → increase convenience_weight, decrease speed_weight
    //   "I need it there before Friday but don't want to overpay"
    //     → increase speed_weight slightly, keep price_weight high
    //   "It's fragile, I don't care about price"
    //     → increase package_fit_weight and reliability_weight,
    //       decrease price_weight significantly
    // ─────────────────────────────────────────────────────────
    // (Placeholder for prompt construction logic)

    // ─────────────────────────────────────────────────────────
    // STEP 4: CALL LLM VIA LOVABLE AI GATEWAY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Get adjusted weights from LLM interpretation.
    // APPROACH:
    //   - Call Lovable AI Gateway with structured output tool:
    //     Tool: "interpret_priority" → PriorityInterpreterResponse
    //   - Model: google/gemini-3-flash-preview
    //   - Parse tool call result
    // ─────────────────────────────────────────────────────────
    // (Placeholder for LLM API call)

    // ─────────────────────────────────────────────────────────
    // STEP 5: VALIDATE & NORMALIZE WEIGHTS
    // ─────────────────────────────────────────────────────────
    // USE CASE: Ensure LLM output is valid and safe to use for ranking.
    // APPROACH:
    //   - Validate all weights are between 0.05 and 0.8
    //   - Normalize so they sum to 1.0
    //   - If LLM output is invalid, fall back to baseline weights
    //   - Log anomalies for monitoring
    // ─────────────────────────────────────────────────────────
    // (Placeholder for validation logic)

    // Stub response matching PriorityInterpreterResponse contract
    const stubResponse = {
      weights: {
        price_weight: 0.3,
        speed_weight: 0.2,
        reliability_weight: 0.2,
        package_fit_weight: 0.15,
        convenience_weight: 0.15,
      },
      interpretation_summary: "Priority interpreter is not yet active. Using default balanced weights.",
      used_free_text: false,
      confidence: 0,
    };

    return new Response(JSON.stringify(stubResponse), {
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
