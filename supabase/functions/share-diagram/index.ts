import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = isLocalhost || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] || "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { diagramId } = body;

    if (!diagramId || typeof diagramId !== "string") {
      return new Response(JSON.stringify({ error: "diagramId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: diagram, error: fetchError } = await supabaseAdmin
      .from("diagrams")
      .select("id, share_token, owner_id")
      .eq("id", diagramId)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !diagram) {
      return new Response(
        JSON.stringify({ error: "Diagrama não encontrado ou sem permissão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reuse or generate token server-side
    let shareToken = diagram.share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID().replace(/-/g, "");
    }

    const { error: updateError } = await supabaseAdmin
      .from("diagrams")
      .update({
        share_token: shareToken,
        is_shared: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", diagramId)
      .eq("owner_id", user.id);

    if (updateError) throw updateError;

    const siteUrl = Deno.env.get("SITE_URL") || "https://microflow-architect.lovable.app";
    const shareUrl = `${siteUrl}/diagram/${shareToken}`;

    return new Response(JSON.stringify({ shareUrl, shareToken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("share-diagram error:", e);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar link de compartilhamento." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
