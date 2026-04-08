import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const started = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. Database connectivity
  try {
    const t0 = Date.now();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { error } = await supabase.from("plan_limits").select("plan").limit(1);
    checks.database = { ok: !error, ms: Date.now() - t0, ...(error ? { error: error.message } : {}) };
  } catch (e) {
    checks.database = { ok: false, ms: 0, error: String(e) };
  }

  // 2. Encryption key availability
  try {
    const t0 = Date.now();
    const raw = Deno.env.get("DIAGRAM_ENCRYPTION_KEY");
    if (!raw) throw new Error("Not configured");
    const decoded = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    if (decoded.length !== 32) throw new Error("Invalid length");

    // Quick encrypt/decrypt round-trip
    const key = await crypto.subtle.importKey("raw", decoded.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const testData = new TextEncoder().encode("health-check");
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, testData);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    const result = new TextDecoder().decode(decrypted);
    checks.encryption = { ok: result === "health-check", ms: Date.now() - t0 };
  } catch (e) {
    checks.encryption = { ok: false, ms: 0, error: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return new Response(
    JSON.stringify({
      status: allOk ? "healthy" : "degraded",
      uptime_ms: Date.now() - started,
      checks,
      timestamp: new Date().toISOString(),
    }),
    {
      status: allOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
