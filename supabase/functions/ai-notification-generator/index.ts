// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
// ============================================================
// AI Notification Generator — Edge Function placeholder
// ============================================================
// This edge function generates human-friendly notification
// message text for various shipping events using LLM. It
// produces better copy than static template strings, adapting
// tone and content to the event type and delivery channel.
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

    const body = await req.json();
    const { event_type, channel, context } = body as {
      event_type: "welcome_confirmation" | "price_drop_alert" | "promo_available" | "service_expiring";
      channel: "email" | "sms";
      context: {
        user_name?: string;
        carrier?: string;
        service_name?: string;
        route?: string;
        old_price?: number;
        new_price?: number;
        promo_details?: string;
        expiry_date?: string;
        saved_option_summary?: string;
      };
    };

    if (!event_type || !channel) {
      return new Response(
        JSON.stringify({ error: "event_type and channel are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 1: BUILD LLM PROMPT FOR NOTIFICATION CONTENT
    // ─────────────────────────────────────────────────────────
    // USE CASE: Generate notification message text that is:
    //   - Personalized with user name and shipment details
    //   - Appropriately toned for the event type
    //   - Correctly formatted for the delivery channel
    // PROMPT STRUCTURE:
    //   [System] You are a shipping notification copywriter.
    //     Generate concise, friendly notification messages.
    //     Tone guidelines by event type:
    //     - price_drop_alert: Celebratory, urgent — "Great news!"
    //     - promo_available: Informative, encouraging — "New deal"
    //     - service_expiring: Urgent, helpful — "Act soon"
    //     - welcome_confirmation: Warm, reassuring — "Welcome"
    //     Channel constraints:
    //     - email: Subject line (< 60 chars) + body (2-3 sentences)
    //       + optional CTA button text and URL
    //     - sms: Single message (< 160 chars), no HTML, include
    //       key info (price, carrier, route) concisely
    //   [User]
    //     EVENT TYPE: {event_type}
    //     CHANNEL: {channel}
    //     CONTEXT: {context object with user_name, carrier, etc.}
    //     Generate: NotificationContentResponse
    //
    // EXAMPLE OUTPUTS BY EVENT TYPE:
    //
    // price_drop_alert (email):
    //   subject: "Price drop! Ship NYC→LA for $45 with Lugless"
    //   body: "Great news, Alex! The Lugless Standard service you
    //     saved for your NYC to LA shipment just dropped from $52
    //     to $45. Book now before prices change."
    //   cta_text: "Book Now"
    //   cta_url: "/book?service=ll-std&route=nyc-la"
    //
    // price_drop_alert (sms):
    //   sms_text: "Price drop! Lugless NYC→LA now $45 (was $52).
    //     Book at shiphub.com/saved"
    //
    // promo_available (email):
    //   subject: "New promo: 15% off FedEx Express"
    //   body: "Hi Alex, FedEx is running a limited-time promotion
    //     on Express shipping. Your saved route qualifies for 15%
    //     off. Valid through April 15."
    //   cta_text: "View Deal"
    //
    // service_expiring (email):
    //   subject: "Your saved Lugless quote expires tomorrow"
    //   body: "Hi Alex, the Lugless Standard quote you saved for
    //     NYC to LA ($45) expires tomorrow. Book now to lock in
    //     this rate."
    //   cta_text: "Book Before It Expires"
    //
    // welcome_confirmation (email):
    //   subject: "Welcome to ShipHub — your alerts are set up"
    //   body: "Welcome, Alex! You'll receive alerts when prices
    //     drop or new promos are available for your saved shipping
    //     options. Manage your notifications anytime in Settings."
    // ─────────────────────────────────────────────────────────
    // const systemPrompt = buildNotificationSystemPrompt();
    // const userPrompt = buildNotificationUserPrompt(event_type, channel, context);

    // ─────────────────────────────────────────────────────────
    // STEP 2: CALL LLM VIA LOVABLE AI GATEWAY
    // ─────────────────────────────────────────────────────────
    // USE CASE: Generate the notification content.
    // APPROACH:
    //   - Call Lovable AI Gateway with structured output tool:
    //     Tool: "generate_notification" → NotificationContentResponse
    //   - Model: google/gemini-3-flash-preview (fast, cheap — 
    //     notification copy doesn't need heavy reasoning)
    //   - Parse tool call result
    // STRUCTURED OUTPUT TOOL:
    //   generate_notification: {
    //     subject: string | null,     // null for SMS
    //     body: string,               // email body or full SMS
    //     sms_text: string | null,    // 160-char SMS version
    //     cta_text: string | null,    // button text
    //     cta_url: string | null      // button link
    //   }
    // ─────────────────────────────────────────────────────────
    // const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { ... });

    // ─────────────────────────────────────────────────────────
    // STEP 3: VALIDATE & SANITIZE OUTPUT
    // ─────────────────────────────────────────────────────────
    // USE CASE: Ensure LLM output is safe and within constraints.
    // APPROACH:
    //   - Validate subject length (< 60 chars for email)
    //   - Validate SMS text length (< 160 chars)
    //   - Sanitize HTML/script injection in body text
    //   - If LLM output is invalid, fall back to a static template
    //   - Log validation failures for monitoring
    // ─────────────────────────────────────────────────────────
    // const validated = validateNotificationContent(llmOutput, channel);

    // ─────────────────────────────────────────────────────────
    // STEP 4: FALLBACK TEMPLATES (WHEN LLM IS UNAVAILABLE)
    // ─────────────────────────────────────────────────────────
    // USE CASE: If LLM call fails or is rate-limited, use static
    //   templates as fallback so notifications still go out.
    // APPROACH:
    //   - Maintain a map of event_type → template strings with
    //     {{variable}} placeholders
    //   - Fill placeholders from context object
    //   - This ensures notifications never fail completely due
    //     to LLM unavailability
    // EXAMPLE FALLBACK:
    //   price_drop_alert email template:
    //     subject: "Price drop on {{service_name}}"
    //     body: "Hi {{user_name}}, {{service_name}} for {{route}}
    //       dropped from ${{old_price}} to ${{new_price}}."
    // ─────────────────────────────────────────────────────────
    // const fallbackContent = getFallbackTemplate(event_type, channel, context);

    // Stub response matching NotificationContentResponse contract
    const stubResponse = {
      subject: null,
      body: "Notification generator is not yet active. This is a placeholder.",
      sms_text: null,
      cta_text: null,
      cta_url: null,
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
