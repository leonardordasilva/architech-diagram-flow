import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getKeyBytes, importKeyForDecrypt, encrypt, decrypt, isEncrypted } from '../_shared/crypto.ts';

// SEC-01: Dynamic CORS based on ALLOWED_ORIGINS
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((o) => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = isLocalhost || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] || "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing Bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token", details: userError?.message || "User not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // F2-T2: Rate limit via persistent DB RPC
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const rateLimitKey = `edge:crypto:${userData.user.id}`;
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_limit: 60,
      p_window_seconds: 60,
    });
    if (rlError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { action, nodes, edges } = body as {
      action: "encrypt" | "decrypt";
      nodes: unknown;
      edges: unknown;
    };

    if (!action || !["encrypt", "decrypt"].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action must be "encrypt" or "decrypt"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyBytes = getKeyBytes();
    const key = await importKeyForDecrypt(keyBytes);

    if (action === "encrypt") {
      const [encNodes, encEdges] = await Promise.all([
        encrypt(nodes ?? [], key),
        encrypt(edges ?? [], key),
      ]);
      return new Response(
        JSON.stringify({ nodes: encNodes, edges: encEdges }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // decrypt
    const decNodes = isEncrypted(nodes) ? await decrypt(nodes, key) : nodes;
    const decEdges = isEncrypted(edges) ? await decrypt(edges, key) : edges;

    return new Response(
      JSON.stringify({ nodes: decNodes, edges: decEdges }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const corsHeaders = getCorsHeaders(req);
    console.error("diagram-crypto error:", e);
    return new Response(
      JSON.stringify({ error: "Encryption/decryption failed. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
