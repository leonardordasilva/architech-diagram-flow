import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) throw new Error("BREVO_API_KEY not configured");

  const fromEmail = Deno.env.get("BREVO_FROM_EMAIL");
  if (!fromEmail) throw new Error("BREVO_FROM_EMAIL not configured");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "MicroFlow Architect", email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(JSON.stringify({ fn: "invite-workspace-member", level: "error", msg: "Brevo error", status: res.status, body }));
    throw new Error(`Brevo: ${res.status} — ${body}`);
  }

  console.log(JSON.stringify({ fn: "invite-workspace-member", msg: "email sent", to }));
}

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

    const { workspaceId, email, role, app_url } = await req.json();
    let inviteToken: string | undefined;

    if (!workspaceId || !email || !["editor", "viewer"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "workspaceId, email, and role (editor|viewer) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verificar que o caller é owner do workspace
    const { data: callerMember } = await serviceSupabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (callerMember?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only the workspace owner can invite members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar nome do workspace para o email
    const { data: workspace } = await serviceSupabase
      .from("workspaces")
      .select("name, stripe_subscription_id")
      .eq("id", workspaceId)
      .single();

    const workspaceName = workspace?.name ?? "MicroFlow Architect";
    const siteUrl = app_url || Deno.env.get("APP_URL") || "https://microflow-architect.lovable.app";

    // Verificar se o email já é membro
    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      // Usuário existe — verificar se já é membro aceito
      const { data: alreadyMember } = await serviceSupabase
        .from("workspace_members")
        .select("id, accepted_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (alreadyMember?.accepted_at) {
        return new Response(
          JSON.stringify({ error: "User is already a workspace member" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!alreadyMember) {
        // Adicionar como membro pendente (accepted_at = null)
        await serviceSupabase.from("workspace_members").insert({
          workspace_id: workspaceId,
          user_id: existingProfile.id,
          role,
          invited_by: user.id,
          accepted_at: null,
        });
      }

      // Enviar email para usuário existente com link para aceitar
      const acceptUrl = `${siteUrl}/workspace`;
      await sendEmail(
        email.trim(),
        `Você foi convidado para o workspace "${workspaceName}"`,
        `<p>Olá,</p>
        <p>Você foi convidado para participar do workspace <strong>${workspaceName}</strong> no MicroFlow Architect como <strong>${role === "editor" ? "Editor" : "Visualizador"}</strong>.</p>
        <p>Acesse o link abaixo para aceitar o convite:</p>
        <p><a href="${acceptUrl}" style="background:#0074d4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Aceitar convite</a></p>
        <p style="color:#888;font-size:12px;">Se você não esperava este convite, pode ignorar este email.</p>`,
      );
    } else {
      // Usuário não existe — reusar convite ativo ou criar novo
      const { data: existingInvite } = await serviceSupabase
        .from("workspace_invites")
        .select("token, expires_at")
        .eq("workspace_id", workspaceId)
        .eq("email", email.toLowerCase().trim())
        .is("accepted_at", null)
        .maybeSingle();

      if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
        inviteToken = existingInvite.token;
      } else {
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await serviceSupabase.from("workspace_invites")
          .upsert({
            workspace_id: workspaceId,
            email: email.toLowerCase().trim(),
            role,
            invited_by: user.id,
            token,
            expires_at: expiresAt,
            accepted_at: null,
          }, { onConflict: "workspace_id,email" });

        inviteToken = token;
      }

      // Enviar email para novo usuário com link de criação de conta + convite
      const inviteUrl = `${siteUrl}/invite?token=${inviteToken}`;
      await sendEmail(
        email.trim(),
        `Você foi convidado para o workspace "${workspaceName}"`,
        `<p>Olá,</p>
        <p>Você foi convidado para participar do workspace <strong>${workspaceName}</strong> no MicroFlow Architect como <strong>${role === "editor" ? "Editor" : "Visualizador"}</strong>.</p>
        <p>Clique no link abaixo para criar sua conta e aceitar o convite:</p>
        <p><a href="${inviteUrl}" style="background:#0074d4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Aceitar convite</a></p>
        <p style="color:#888;font-size:12px;">Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este email.</p>`,
      );
    }

    // Atualizar quantity no Stripe se for editor (cobrável)
    if (role === "editor") {
      try {
        if (workspace?.stripe_subscription_id) {
          const { data: countData } = await serviceSupabase
            .rpc("get_workspace_editor_count", { p_workspace_id: workspaceId });

          const newCount = Math.max(3, (countData ?? 0) + 1);
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
          await fetch(`https://api.stripe.com/v1/subscriptions/${workspace.stripe_subscription_id}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `quantity=${newCount}`,
          });
        }
      } catch (stripeErr) {
        console.warn("[invite-workspace-member] Stripe quantity update failed:", stripeErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[invite-workspace-member]", err);
    return new Response(String(err), { status: 500, headers: corsHeaders });
  }
});
