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

    const { data, error } = await supabase.from("saved_options")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map((d: Record<string, unknown>) => ({
      id: d.id,
      svcId: d.quote_service_id,
      svc: {
        id: d.quote_service_id,
        carrier: d.carrier,
        name: d.service_name,
        tier: d.tier,
        price: d.price,
        originalPrice: d.original_price,
        transitDays: d.transit_days,
        date: d.estimated_delivery || "",
        deliverBy: d.deliver_by_time,
        guaranteed: d.guaranteed || false,
        promo: d.promo,
        ai: d.ai_recommendation || "",
        breakdown: d.breakdown || { shipping: [], pickup: [] },
        details: d.details || {},
        features: d.features || [],
      },
      origin: d.origin,
      dest: d.destination,
      dropDate: d.drop_off_date || "",
      delivDate: d.expected_delivery_date || "",
      pkgSummary: d.package_summary || "",
      bookUrl: d.book_url || "",
      savedAt: new Date(d.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }));

    return new Response(JSON.stringify(mapped), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
