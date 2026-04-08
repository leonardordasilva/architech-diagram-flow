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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F2-T2: Rate limit via persistent DB RPC
    const rateLimitKey = `edge:share:${user.id}`;
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_limit: 20,
      p_window_seconds: 60,
    });
    if (rlError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { diagramId, ttlDays } = body as { diagramId?: string; ttlDays?: number };

    if (!diagramId || typeof diagramId !== "string") {
      return new Response(JSON.stringify({ error: "diagramId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // F4-T2: Set expiration on share tokens
    const effectiveTtlDays = ttlDays ?? 30;
    const expiresAt = new Date(Date.now() + effectiveTtlDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("diagrams")
      .update({
        share_token: shareToken,
        share_token_expires_at: expiresAt,
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
