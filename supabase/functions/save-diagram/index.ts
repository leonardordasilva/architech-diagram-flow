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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// ─── Crypto helpers ─────────────────────────────────────────
function uint8ToBase64(buf: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    const slice = buf.subarray(i, i + CHUNK);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get("DIAGRAM_ENCRYPTION_KEY");
  if (!raw) throw new Error("DIAGRAM_ENCRYPTION_KEY not configured");
  const decoded = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (decoded.length !== 32) throw new Error("DIAGRAM_ENCRYPTION_KEY must be 32 bytes");
  return decoded;
}

async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt"]);
}

async function encrypt(plainJson: unknown, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plainJson));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { iv: uint8ToBase64(iv), ciphertext: uint8ToBase64(new Uint8Array(encrypted)) };
}

async function computeContentHash(nodes: unknown[], edges: unknown[]): Promise<string> {
  const payload = JSON.stringify({ nodes, edges });
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Rate Limiter ───────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Handler ────────────────────────────────────────────────
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

    if (!checkRateLimit(userId)) {
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

    if (!title || !Array.isArray(nodes) || !Array.isArray(edges)) {
      return new Response(JSON.stringify({ error: "title, nodes, edges required" }), {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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
      if (isOwner) updatePayload.title = title;

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
