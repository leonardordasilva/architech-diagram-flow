import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Aceitar convite por token (workspace_invites) ou pendente em workspace_members
    const body = await req.json();
    const now = new Date().toISOString();

    if (body.token) {
      // Convite por token (usuário novo que acabou de criar conta)
      const { data: invite } = await serviceSupabase
        .from("workspace_invites")
        .select("*")
        .eq("token", body.token)
        .is("accepted_at", null)
        .single();

      if (!invite) {
        return new Response(
          JSON.stringify({ error: "Invalid or already used invite token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Invite token has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Criar membro aceito
      await serviceSupabase.from("workspace_members").insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.invited_by,
        accepted_at: now,
      });

      // Marcar convite como aceito
      await serviceSupabase
        .from("workspace_invites")
        .update({ accepted_at: now })
        .eq("id", invite.id);

      // Atualizar Stripe se for editor cobrável
      if (invite.role === "editor") {
        await updateStripeQuantity(serviceSupabase, invite.workspace_id);
      }

      return new Response(
        JSON.stringify({ success: true, workspaceId: invite.workspace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.workspaceId) {
      // Usuário existente aceitando convite pendente em workspace_members
      const { data: pending } = await serviceSupabase
        .from("workspace_members")
        .select("id, role")
        .eq("workspace_id", body.workspaceId)
        .eq("user_id", user.id)
        .is("accepted_at", null)
        .single();

      if (!pending) {
        return new Response(
          JSON.stringify({ error: "No pending invite found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await serviceSupabase
        .from("workspace_members")
        .update({ accepted_at: now })
        .eq("id", pending.id);

      if (pending.role === "editor") {
        await updateStripeQuantity(serviceSupabase, body.workspaceId);
      }

      return new Response(
        JSON.stringify({ success: true, workspaceId: body.workspaceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Provide token or workspaceId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[accept-workspace-invite]", err);
    return new Response(String(err), { status: 500, headers: corsHeaders });
  }
});

async function updateStripeQuantity(serviceSupabase: any, workspaceId: string) {
  try {
    const { data: workspace } = await serviceSupabase
      .from("workspaces")
      .select("stripe_subscription_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace?.stripe_subscription_id) return;

    const { data: countData } = await serviceSupabase
      .rpc("get_workspace_editor_count", { p_workspace_id: workspaceId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
    await stripe.subscriptions.update(workspace.stripe_subscription_id, {
      quantity: Math.max(3, countData ?? 1),
    });
  } catch (err) {
    console.warn("[accept-workspace-invite] Stripe quantity update failed:", err);
  }
}
