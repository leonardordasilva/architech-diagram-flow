import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getKeyBytes, importKey, encrypt, isEncrypted } from '../_shared/crypto.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — require service_role key or admin user
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F1-T2: Check if caller is service_role or admin
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRole = jwt === serviceRoleKey;

    if (!isServiceRole) {
      // Verify user and check admin list
      const supabaseAnon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: userData, error: userError } = await supabaseAnon.auth.getUser(jwt);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminIds = (Deno.env.get("ADMIN_USER_IDS") || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!adminIds.includes(userData.user.id)) {
        return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const BATCH_SIZE = 10;
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let hasMore = true;
    let offset = 0;

    const keyBytes = getKeyBytes();
    const key = await importKey(keyBytes);

    while (hasMore) {
      const { data: rows, error: fetchErr } = await supabaseAdmin
        .from("diagrams")
        .select("id, nodes, edges")
        .range(offset, offset + BATCH_SIZE - 1)
        .order("created_at", { ascending: true });

      if (fetchErr || !rows) {
        errors++;
        break;
      }

      if (rows.length < BATCH_SIZE) hasMore = false;
      offset += rows.length;

      for (const row of rows) {
        if (isEncrypted(row.nodes) && isEncrypted(row.edges)) {
          skipped++;
          continue;
        }

        if (!Array.isArray(row.nodes) || !Array.isArray(row.edges)) {
          skipped++;
          continue;
        }

        try {
          const [encNodes, encEdges] = await Promise.all([
            encrypt(row.nodes, key),
            encrypt(row.edges, key),
          ]);

          const { error: updateErr } = await supabaseAdmin
            .from("diagrams")
            .update({
              nodes: encNodes as unknown as Record<string, unknown>,
              edges: encEdges as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (updateErr) {
            console.error(`Failed to encrypt diagram ${row.id}:`, updateErr);
            errors++;
          } else {
            processed++;
          }
        } catch (encErr) {
          console.error(`Encryption error for diagram ${row.id}:`, encErr);
          errors++;
        }
      }
    }

    return new Response(JSON.stringify({ processed, skipped, errors, total: offset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-encryption error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
