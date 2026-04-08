import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getKeyBytes, importKey, encrypt, computeContentHash } from '../_shared/crypto.ts';

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

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
    // Auth
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // F2-T2: Rate limit via persistent DB RPC
    const rateLimitKey = `edge:save:${userId}`;
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_limit: 60,
      p_window_seconds: 60,
    });
    if (rlError || allowed === false) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { title, nodes, edges, diagram_id, workspace_id } = body as {
      title: string;
      nodes: unknown[];
      edges: unknown[];
      diagram_id?: string;
      workspace_id?: string | null;
    };

    if (!title && !diagram_id) {
      return new Response(JSON.stringify({ error: "title or diagram_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return new Response(JSON.stringify({ error: "nodes and edges must be arrays" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt + hash server-side
    const keyBytes = getKeyBytes();
    const key = await importKey(keyBytes);
    const [encNodes, encEdges, contentHash] = await Promise.all([
      encrypt(nodes, key),
      encrypt(edges, key),
      computeContentHash(nodes, edges),
    ]);

    if (diagram_id) {
      // UPDATE — verify ownership or collaboration
      const { data: existing } = await supabaseAdmin
        .from("diagrams")
        .select("id, owner_id")
        .eq("id", diagram_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Diagram not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check ownership or diagram_shares
      const isOwner = existing.owner_id === userId;
      if (!isOwner) {
        const { data: share } = await supabaseAdmin
          .from("diagram_shares")
          .select("id")
          .eq("diagram_id", diagram_id)
          .eq("shared_with_id", userId)
          .maybeSingle();
        if (!share) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const updatePayload: Record<string, unknown> = {
        nodes: encNodes,
        edges: encEdges,
        node_count: nodes.length,
        edge_count: edges.length,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      };
      // Only owner can change title
      if (isOwner && title) updatePayload.title = title;

      const { data, error } = await supabaseAdmin
        .from("diagrams")
        .update(updatePayload)
        .eq("id", diagram_id)
        .select("id, title, owner_id, share_token, created_at, updated_at")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INSERT — new diagram
    const insertPayload: Record<string, unknown> = {
      title,
      nodes: encNodes,
      edges: encEdges,
      node_count: nodes.length,
      edge_count: edges.length,
      content_hash: contentHash,
      owner_id: userId,
    };
    if (workspace_id) insertPayload.workspace_id = workspace_id;

    const { data, error } = await supabaseAdmin
      .from("diagrams")
      .insert(insertPayload)
      .select("id, title, owner_id, share_token, created_at, updated_at")
      .single();

    if (error) {
      if (error.message?.includes("DIAGRAM_LIMIT_EXCEEDED")) {
        return new Response(JSON.stringify({ error: "DIAGRAM_LIMIT_EXCEEDED" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    return new Response(JSON.stringify(data), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-diagram error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
