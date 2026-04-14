// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
// ============================================================
// AI Shipping Advisor — Edge Function placeholder
// ============================================================
// This edge function will orchestrate RAG retrieval + LLM enrichment
// for shipping quotes. It is called AFTER quotes are fetched, to
// add per-service enrichment and tradeoff analysis.
//
// NO ACTUAL RAG/LLM LOGIC IS IMPLEMENTED HERE YET.
// Each step below is a detailed placeholder describing:
//   - WHAT it does
//   - WHY it's needed
//   - HOW to implement it when the time comes
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

    // ── AUTH (optional — advisor can work for guests too) ──
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const { query, shipment_context, quote_ids, user_priority } = body as {
      query: string;
      shipment_context?: {
        origin: string;
        destination: string;
        weight: number;
        packages: number;
        package_types: string[];
        handling_types: string[];
        drop_off_date: string;
        delivery_date: string;
      };
      quote_ids?: string[];
      user_priority?: "price" | "speed" | "convenience" | "safety";
    };

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 1: EMBED THE QUERY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Convert the user query + shipment context into a
    //   vector embedding for similarity search against provider_knowledge.
    // APPROACH:
    //   - Concatenate query with key shipment details (package types,
    //     handling, route) to create a rich embedding input.
    //   - Call embedding model (e.g. text-embedding-3-small) via
    //     Lovable AI Gateway or dedicated embedding endpoint.
    //   - Result: a float[] vector (e.g. 1536 dimensions).
    // EXAMPLE INPUT TO EMBEDDING:
    //   "Best option for shipping 2 golf bags from NYC to LA,
    //    fragile handling, drop-off Apr 10, delivery by Apr 15"
    // ─────────────────────────────────────────────────────────
    // const embeddingInput = buildEmbeddingInput(query, shipment_context);
    // const queryEmbedding = await callEmbeddingModel(embeddingInput);

    // ─────────────────────────────────────────────────────────
    // STEP 2: RAG RETRIEVAL — PROVIDER FIT KNOWLEDGE
    // ─────────────────────────────────────────────────────────
    // USE CASE: Retrieve knowledge about which providers are actually
    //   good for the user's specific item types (luggage, golf, skis).
    //   Without this, the LLM will generalize or invent provider strengths.
    // APPROACH:
    //   - Query provider_knowledge table using pgvector cosine similarity
    //     on embedding_vector, filtered by content_type = 'provider_fit'.
    //   - If quote_ids are provided, also filter by carrier names from
    //     those quotes to get relevant provider knowledge only.
    //   - Return top-K results (e.g. K=10) with similarity scores.
    // EXAMPLE RETRIEVED CONTEXT:
    //   "Lugless specializes in luggage and travel gear shipping.
    //    They are better for suitcases and golf bags than generic boxes.
    //    They feel like a travel-oriented shipping concierge, not a
    //    generic carrier middleman." (similarity: 0.92)
    // ─────────────────────────────────────────────────────────
    // const providerFitResults = await supabase.rpc('match_provider_knowledge', {
    //   query_embedding: queryEmbedding,
    //   match_count: 10,
    //   filter_content_type: 'provider_fit',
    //   filter_carriers: carrierNamesFromQuoteIds,
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 3: RAG RETRIEVAL — RESTRICTIONS & EXCLUSIONS
    // ─────────────────────────────────────────────────────────
    // USE CASE: Retrieve restrictions that could make a service
    //   non-viable for this shipment. This is critical — bad AI
    //   systems embarrass themselves by recommending services that
    //   don't actually support the user's items.
    // APPROACH:
    //   - Query provider_knowledge with content_type = 'restrictions',
    //     filtered by carriers in the quote set.
    //   - Match against user's package types and handling requirements.
    //   - These results will be used to generate restriction_note and
    //     caution_note in the enrichment output.
    // EXAMPLE RETRIEVED CONTEXT:
    //   "Lugless does not accept items over 70lbs. Fragile items
    //    require rigid-sided containers. No hazardous materials.
    //    Skis must be in a hard case." (similarity: 0.88)
    // ─────────────────────────────────────────────────────────
    // const restrictionResults = await supabase.rpc('match_provider_knowledge', {
    //   query_embedding: queryEmbedding,
    //   match_count: 8,
    //   filter_content_type: 'restrictions',
    //   filter_carriers: carrierNamesFromQuoteIds,
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 4: RAG RETRIEVAL — SERVICE MODEL DETAILS
    // ─────────────────────────────────────────────────────────
    // USE CASE: Private providers differentiate on operational details
    //   (pickup, packing, insurance, labels, concierge flow) more than
    //   on price. These details change the recommendation more than
    //   a few dollars sometimes.
    // APPROACH:
    //   - Query provider_knowledge with content_type = 'service_model'.
    //   - Retrieve details about: door pickup vs drop-off, packaging
    //     support, insurance/protection, label provision, customer
    //     experience flow (concierge vs self-service).
    // EXAMPLE RETRIEVED CONTEXT:
    //   "LuggageToShip offers professional packing for +$15. They
    //    provide pre-printed labels. Home pickup is free. The flow
    //    is concierge-style — they handle logistics end-to-end."
    // ─────────────────────────────────────────────────────────
    // const serviceModelResults = await supabase.rpc('match_provider_knowledge', {
    //   query_embedding: queryEmbedding,
    //   match_count: 8,
    //   filter_content_type: 'service_model',
    //   filter_carriers: carrierNamesFromQuoteIds,
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 5: FETCH NORMALIZED QUOTES FROM DB
    // ─────────────────────────────────────────────────────────
    // USE CASE: Load the actual quote data (price, transit, tier,
    //   features) for the services being compared.
    // APPROACH:
    //   - If quote_ids provided, fetch from quotes table.
    //   - Normalize into a common schema for LLM consumption.
    // ─────────────────────────────────────────────────────────
    // const quotes = await supabase
    //   .from('quotes')
    //   .select('*')
    //   .in('id', quote_ids);

    // ─────────────────────────────────────────────────────────
    // STEP 6: BUILD LLM PROMPT WITH RAG CONTEXT
    // ─────────────────────────────────────────────────────────
    // USE CASE: Assemble a prompt that gives the LLM all the context
    //   it needs to generate grounded, evidence-based enrichments.
    // APPROACH:
    //   - System prompt: Define role as shipping comparison advisor.
    //     Instruct to ONLY use provided context, never invent facts.
    //     Instruct to calibrate confidence based on RAG coverage.
    //   - User prompt: Include shipment details, normalized quotes,
    //     and all retrieved RAG context organized by category.
    //   - Use structured output (tool calling) to enforce the
    //     QuoteEnrichment[] + TradeoffAnalysis response shape.
    // PROMPT STRUCTURE:
    //   [System] You are a shipping comparison advisor. Use ONLY the
    //     provided provider knowledge to generate recommendations.
    //     If knowledge is thin for a provider, lower confidence and
    //     avoid strong claims. Never invent provider capabilities.
    //   [User]
    //     SHIPMENT: {origin, dest, dates, package_types, handling}
    //     USER PRIORITY: {price | speed | convenience | safety}
    //     QUOTES: {normalized quote data per service}
    //     PROVIDER FIT KNOWLEDGE: {RAG results from step 2}
    //     RESTRICTIONS: {RAG results from step 3}
    //     SERVICE MODEL DETAILS: {RAG results from step 4}
    //     Generate: QuoteEnrichment for each service + TradeoffAnalysis
    // ─────────────────────────────────────────────────────────
    // const systemPrompt = buildSystemPrompt();
    // const userPrompt = buildUserPrompt(
    //   shipment_context, user_priority, quotes,
    //   providerFitResults, restrictionResults, serviceModelResults
    // );

    // ─────────────────────────────────────────────────────────
    // STEP 7: CALL LLM VIA LOVABLE AI GATEWAY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Generate per-service enrichment and tradeoff analysis.
    // APPROACH:
    //   - Call Lovable AI Gateway (https://ai.gateway.lovable.dev/v1/chat/completions)
    //     with LOVABLE_API_KEY from env.
    //   - Use tool calling / structured output to enforce response shape:
    //     - Tool 1: "enrich_quotes" → returns QuoteEnrichment[]
    //     - Tool 2: "analyze_tradeoffs" → returns TradeoffAnalysis
    //   - Model: google/gemini-3-flash-preview (default) or user-configurable.
    //   - Parse tool call results into typed response.
    // STRUCTURED OUTPUT TOOLS:
    //   enrich_quotes: { enrichments: QuoteEnrichment[] }
    //   analyze_tradeoffs: { tradeoffs: TradeoffAnalysis }
    // ─────────────────────────────────────────────────────────
    // const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${LOVABLE_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     model: "google/gemini-3-flash-preview",
    //     messages: [
    //       { role: "system", content: systemPrompt },
    //       { role: "user", content: userPrompt },
    //     ],
    //     tools: [enrichQuotesTool, analyzeTradeoffsTool],
    //     tool_choice: "auto",
    //   }),
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 8: PARSE & RETURN STRUCTURED RESPONSE
    // ─────────────────────────────────────────────────────────
    // USE CASE: Parse LLM tool call outputs into AIAdvisorResponse
    //   and return to frontend for display in the comparison table.
    // APPROACH:
    //   - Extract enrichments from enrich_quotes tool call result.
    //   - Extract tradeoff_analysis from analyze_tradeoffs tool call.
    //   - Compile RAG sources used (with relevance scores).
    //   - Return complete AIAdvisorResponse.
    // CONFIDENCE CALIBRATION:
    //   - If RAG returned many high-similarity results → high confidence
    //   - If RAG returned few/low-similarity results → low confidence
    //   - LLM should reflect this in its enrichment confidence_level
    // ─────────────────────────────────────────────────────────
    // const enrichments = parseEnrichments(llmResponse);
    // const tradeoffAnalysis = parseTradeoffAnalysis(llmResponse);
    // const sources = compileSources(providerFitResults, restrictionResults, serviceModelResults);

    // ─────────────────────────────────────────────────────────
    // STEP 9: COMPARISON EXPLANATION (USE CASE #1)
    // ─────────────────────────────────────────────────────────
    // USE CASE: Generate structured "best for X" labels for the
    //   full comparison table. This goes BEYOND per-service
    //   enrichment — it identifies the winner in each category.
    // BACKEND provides the comparison table from normalized data:
    //   - provider, service, total price, transit time, delivery
    //     date, guarantee, pickup/drop-off, tracking, restriction flags
    // RAG provides supporting service knowledge:
    //   - packaging rules, service limitations, guarantee caveats,
    //     pickup/drop-off notes, insurance/protection notes, "best for"
    // LLM generates (via ComparisonExplanation type):
    //   - best_for_price: service + reason (e.g. "UPS Ground at $32,
    //     cheapest with reliable tracking")
    //   - best_for_speed: service + reason (e.g. "FedEx Express,
    //     guaranteed next-day with money-back")
    //   - best_for_value: service + reason (e.g. "Lugless Standard,
    //     $8 more than UPS but includes free pickup and luggage
    //     specialization")
    //   - best_for_special_items: service + reason or null (e.g.
    //     "Lugless — specializes in luggage and golf bag shipping")
    //   - tradeoff_summary: overall narrative across all services
    //   - general_cautions: warnings that apply to multiple options
    // APPROACH:
    //   - Add a "generate_comparison" tool to the LLM call (Step 7)
    //     alongside enrich_quotes and analyze_tradeoffs
    //   - Or call as a separate LLM invocation after enrichments
    //   - Parse into ComparisonExplanation type (see ai-types.ts)
    // ─────────────────────────────────────────────────────────
    // const comparisonExplanation = parseComparisonExplanation(llmResponse);

    // ─────────────────────────────────────────────────────────
    // STEP 10: "WHY THIS OPTION?" — PER-SERVICE EXPLANATION
    //          (USE CASE #4)
    // ─────────────────────────────────────────────────────────
    // USE CASE: For BOTH prime and private providers, generate
    //   concise explanation fields that answer "Why should I
    //   pick this one?" This is embedded IN each QuoteEnrichment
    //   (fields already defined in ai-types.ts):
    //   - recommendation_reason: "Recommended because Lugless
    //     specializes in luggage shipping and supports home pickup."
    //   - provider_strength_note: "Travel gear specialist — better
    //     fit for luggage/golf than generic carriers."
    //   - restriction_note: "Does not accept items over 70lbs.
    //     Fragile items need rigid-sided containers."
    //   - caution_note: "Stricter packaging requirements than UPS."
    //   - confidence_level: 0.85 (calibrated by RAG coverage)
    // RAG retrieves for each provider:
    //   - Service caveats (guarantee fine print, delivery windows)
    //   - Packaging rules (rigid case required, original box, etc.)
    //   - Insurance notes (included vs optional, coverage limits)
    //   - Guarantee details (money-back vs estimated, exceptions)
    //   - Pickup/drop-off differences (home vs store, scheduling)
    //   - Service strengths (luggage specialist, fastest ground, etc.)
    // LLM uses RAG context to generate grounded explanations.
    //   Without RAG, these would be model improvisation.
    //   With RAG, they are evidence-based and confidence-calibrated.
    // APPROACH:
    //   - These fields are already part of QuoteEnrichment (Step 8)
    //   - The LLM prompt (Step 6) should explicitly instruct the
    //     model to populate these fields using ONLY RAG context
    //   - If RAG context is thin for a provider, the model should
    //     set confidence_level low and keep notes brief/hedged
    // ─────────────────────────────────────────────────────────
    // NOTE: No separate function call needed — "why this option"
    // is implemented via the existing QuoteEnrichment fields.
    // The quality of these explanations depends entirely on RAG
    // retrieval quality and prompt engineering in Step 6.

    // For now, return a stub response matching the expected contract
    const stubResponse = {
      recommendation: "AI advisor is not yet active. This is a placeholder response.",
      confidence: 0,
      reasoning: "No LLM/RAG pipeline configured yet.",
      suggested_service_id: null,
      sources: [],
      follow_up_questions: [],
      enrichments: [],
      tradeoff_analysis: null,
      comparison_explanation: null,
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
