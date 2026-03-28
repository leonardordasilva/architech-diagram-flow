import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ─── Helpers ────────────────────────────────────────────────

// R5-SEC-01: Iterative Uint8Array to Base64 (no spread operator)
function uint8ToBase64(buf: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
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
  if (decoded.length !== 32) {
    throw new Error("DIAGRAM_ENCRYPTION_KEY must be 32 bytes (Base64-encoded)");
  }
  return decoded;
}

async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(
  plainJson: unknown,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plainJson));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return {
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encrypted)),
  };
}

async function decrypt(
  payload: { iv: string; ciphertext: string },
  key: CryptoKey,
): Promise<unknown> {
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) =>
    c.charCodeAt(0),
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function isEncrypted(value: unknown): value is { iv: string; ciphertext: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "iv" in value &&
    "ciphertext" in value
  );
}

// ─── Handler ────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authentication ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");

    // Log for debugging (will appear in Supabase Logs)
    console.log("Auth Header present:", !!authHeader);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    console.log("SUPABASE_URL configured:", !!SUPABASE_URL);
    console.log("SUPABASE_ANON_KEY configured:", !!SUPABASE_ANON_KEY);

    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Missing Bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !userData?.user) {
      console.error("Auth helper error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({
          error: "Invalid token",
          details: userError?.message || "User not found in session",
          project: SUPABASE_URL
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Authenticated user:", userData.user.id);

    // ── Business logic ──────────────────────────────────────
    const body = await req.json();
    const { action, nodes, edges } = body as {
      action: "encrypt" | "decrypt";
      nodes: unknown;
      edges: unknown;
    };

    if (!action || !["encrypt", "decrypt"].includes(action)) {
      console.error("Invalid action requested:", action);
      return new Response(
        JSON.stringify({ error: 'action must be "encrypt" or "decrypt"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyBytes = getKeyBytes();
    const key = await importKey(keyBytes);

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
