// LEGACY: Migrated from Lovable source. This function is a candidate for migration
// to api-java or api-python. See docs/service-boundaries.md and docs/legacy-edge-functions.md.
// Do NOT modify this function; migrate and delete instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const { serviceId, carrier, serviceName, redirectUrl, origin, destination } = await req.json();
    if (!serviceId || !redirectUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("redirect_tracking").insert({
      user_id: userId,
      service_id: serviceId,
      carrier: carrier || "",
      service_name: serviceName || "",
      redirect_url: redirectUrl,
      origin,
      destination,
    });

    return new Response(JSON.stringify({ redirectUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
