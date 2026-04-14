// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { quoteServiceId, carrier, serviceName, tier, price, originalPrice, transitDays, estimatedDelivery, deliverByTime, guaranteed, promo, aiRecommendation, breakdown, details, features, origin, destination, dropOffDate, expectedDeliveryDate, packageSummary, bookUrl } = body;

    if (!quoteServiceId || !carrier || !serviceName || !origin || !destination) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await supabase.from("saved_options").insert({
      user_id: user.id,
      quote_service_id: quoteServiceId,
      carrier,
      service_name: serviceName,
      tier: tier || "STANDARD",
      price: price || 0,
      original_price: originalPrice,
      transit_days: transitDays || 0,
      estimated_delivery: estimatedDelivery,
      deliver_by_time: deliverByTime,
      guaranteed: guaranteed || false,
      promo,
      ai_recommendation: aiRecommendation,
      breakdown,
      details,
      features: features || [],
      origin,
      destination,
      drop_off_date: dropOffDate,
      expected_delivery_date: expectedDeliveryDate,
      package_summary: packageSummary,
      book_url: bookUrl,
    }).select().single();

    if (error) throw error;

    const saved = {
      id: data.id,
      svcId: data.quote_service_id,
      svc: {
        id: data.quote_service_id,
        carrier: data.carrier,
        name: data.service_name,
        tier: data.tier,
        price: data.price,
        originalPrice: data.original_price,
        transitDays: data.transit_days,
        date: data.estimated_delivery || "",
        deliverBy: data.deliver_by_time,
        guaranteed: data.guaranteed || false,
        promo: data.promo,
        ai: data.ai_recommendation || "",
        breakdown: data.breakdown || { shipping: [], pickup: [] },
        details: data.details || {},
        features: data.features || [],
      },
      origin: data.origin,
      dest: data.destination,
      dropDate: data.drop_off_date || "",
      delivDate: data.expected_delivery_date || "",
      pkgSummary: data.package_summary || "",
      bookUrl: data.book_url || "",
      savedAt: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    return new Response(JSON.stringify(saved), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
