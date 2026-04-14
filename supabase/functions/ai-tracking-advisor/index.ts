// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
// ============================================================
// AI Tracking Advisor — Edge Function placeholder
// ============================================================
// This edge function will provide plain-English explanations of
// tracking exceptions, severity classification, and actionable
// next-step guidance for users monitoring their shipments.
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

    // ── AUTH ──
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const { tracking_id, carrier, events, exception_event } = body as {
      tracking_id: string;
      carrier: string;
      events: Array<{
        timestamp: string;
        event_code: string;
        description: string;
        location: string;
        carrier: string;
        is_exception: boolean;
      }>;
      exception_event?: {
        timestamp: string;
        event_code: string;
        description: string;
        location: string;
        carrier: string;
        is_exception: boolean;
      };
    };

    if (!tracking_id || !carrier || !events?.length) {
      return new Response(
        JSON.stringify({ error: "tracking_id, carrier, and events are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 1: EMBED THE TRACKING EXCEPTION CONTEXT
    // ─────────────────────────────────────────────────────────
    // USE CASE: Convert the exception event details + carrier
    //   into a vector embedding for similarity search against
    //   provider_knowledge entries about tracking exceptions.
    // APPROACH:
    //   - Build embedding input from: carrier name, exception
    //     event_code, exception description, recent event context
    //   - Call embedding model (e.g. text-embedding-3-small)
    //   - Result: float[] vector for pgvector search
    // EXAMPLE EMBEDDING INPUT:
    //   "FedEx tracking exception code 09: delivery attempted,
    //    no one available. Package at local facility. Previous
    //    events: in transit, out for delivery."
    // ─────────────────────────────────────────────────────────
    // const embeddingInput = buildTrackingEmbeddingInput(carrier, events, exception_event);
    // const queryEmbedding = await callEmbeddingModel(embeddingInput);

    // ─────────────────────────────────────────────────────────
    // STEP 2: RAG RETRIEVAL — EXCEPTION MEANING
    // ─────────────────────────────────────────────────────────
    // USE CASE: Retrieve carrier-specific knowledge about what
    //   this exception code actually means. Different carriers
    //   use different codes and terminology.
    // APPROACH:
    //   - Query provider_knowledge with cosine similarity on
    //     embedding_vector, filtered by:
    //     - carrier = the shipment's carrier
    //     - content_type IN ('restrictions', 'service_model', 'policy')
    //   - Look for entries about: exception codes, delivery
    //     failure reasons, customs holds, weather protocols
    // EXAMPLE RETRIEVED CONTEXT:
    //   "FedEx exception code 09 means delivery was attempted
    //    but no authorized person was available to sign. The
    //    package is held at the local FedEx facility. FedEx
    //    will attempt redelivery the next business day."
    //    (similarity: 0.91)
    // ─────────────────────────────────────────────────────────
    // const exceptionKnowledge = await supabase.rpc('match_provider_knowledge', {
    //   query_embedding: queryEmbedding,
    //   match_count: 8,
    //   filter_content_type: ['restrictions', 'service_model', 'policy'],
    //   filter_carriers: [carrier],
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 3: RAG RETRIEVAL — USER NEXT-STEP GUIDANCE
    // ─────────────────────────────────────────────────────────
    // USE CASE: Retrieve actionable guidance for what the user
    //   should do in response to this type of exception.
    // APPROACH:
    //   - Query provider_knowledge filtered by content_type = 'policy'
    //     and carrier-specific resolution procedures
    //   - Look for: redelivery scheduling, pickup options, contact
    //     info, escalation timelines, customs clearance procedures
    // EXAMPLE RETRIEVED CONTEXT:
    //   "For FedEx delivery exceptions, the recipient can:
    //    1) Schedule redelivery at fedex.com/redelivery
    //    2) Pick up at the local FedEx facility (bring ID)
    //    3) Call 1-800-463-3339 to arrange delivery hold
    //    If not resolved within 5 business days, the package
    //    may be returned to sender."
    //    (similarity: 0.87)
    // ─────────────────────────────────────────────────────────
    // const guidanceKnowledge = await supabase.rpc('match_provider_knowledge', {
    //   query_embedding: queryEmbedding,
    //   match_count: 6,
    //   filter_content_type: ['policy'],
    //   filter_carriers: [carrier],
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 4: BUILD LLM PROMPT WITH RAG CONTEXT
    // ─────────────────────────────────────────────────────────
    // USE CASE: Assemble a prompt that gives the LLM all context
    //   needed to explain the tracking exception and provide
    //   actionable guidance.
    // PROMPT STRUCTURE:
    //   [System] You are a shipping tracking advisor. Explain
    //     tracking events in plain English. Use ONLY the provided
    //     carrier knowledge to generate explanations. Classify
    //     severity as: info (normal progress), warning (delay but
    //     expected to resolve), critical (action required now).
    //     If knowledge is thin, lower confidence and avoid
    //     strong claims about resolution timelines.
    //   [User]
    //     CARRIER: {carrier}
    //     TRACKING ID: {tracking_id}
    //     EVENT TIMELINE: {normalized events in chronological order}
    //     EXCEPTION EVENT: {the specific exception to explain}
    //     CARRIER KNOWLEDGE: {RAG results from step 2}
    //     RESOLUTION GUIDANCE: {RAG results from step 3}
    //     Generate: TrackingAdvisorResponse with explanation,
    //     severity, next_steps, action_required, estimated_resolution
    // ─────────────────────────────────────────────────────────
    // const systemPrompt = buildTrackingSystemPrompt();
    // const userPrompt = buildTrackingUserPrompt(
    //   carrier, tracking_id, events, exception_event,
    //   exceptionKnowledge, guidanceKnowledge
    // );

    // ─────────────────────────────────────────────────────────
    // STEP 5: CALL LLM VIA LOVABLE AI GATEWAY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Generate plain-English explanation and next steps.
    // APPROACH:
    //   - Call Lovable AI Gateway with structured output tools:
    //     Tool: "explain_tracking_exception" → TrackingAdvisorResponse
    //   - Model: google/gemini-3-flash-preview
    //   - Parse tool call result into typed response
    // STRUCTURED OUTPUT TOOL:
    //   explain_tracking_exception: {
    //     explanation: string,
    //     severity: "info" | "warning" | "critical",
    //     next_steps: string[],
    //     action_required: boolean,
    //     estimated_resolution: string | null,
    //     escalation_guidance: string | null,
    //     confidence: number
    //   }
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
    //     tools: [explainTrackingExceptionTool],
    //     tool_choice: { type: "function", function: { name: "explain_tracking_exception" } },
    //   }),
    // });

    // ─────────────────────────────────────────────────────────
    // STEP 6: PARSE & RETURN STRUCTURED RESPONSE
    // ─────────────────────────────────────────────────────────
    // USE CASE: Parse LLM tool call output into TrackingAdvisorResponse.
    // CONFIDENCE CALIBRATION:
    //   - High (0.8-1.0): RAG found clear carrier docs for this exception
    //   - Medium (0.5-0.8): Some context but gaps in carrier-specific info
    //   - Low (0.0-0.5): Thin RAG context — explanation is partly generic
    // ─────────────────────────────────────────────────────────
    // const response = parseTrackingResponse(llmResponse);
    // const sources = compileSources(exceptionKnowledge, guidanceKnowledge);

    // Stub response matching TrackingAdvisorResponse contract
    const stubResponse = {
      explanation: "Tracking advisor is not yet active. This is a placeholder response.",
      severity: "info" as const,
      next_steps: [],
      action_required: false,
      estimated_resolution: null,
      escalation_guidance: null,
      confidence: 0,
      sources: [],
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
