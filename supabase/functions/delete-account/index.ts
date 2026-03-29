import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete user's diagrams
    await adminClient.from("diagram_shares").delete().eq("owner_id", user.id);
    await adminClient.from("diagram_shares").delete().eq("shared_with_id", user.id);
    await adminClient.from("diagrams").delete().eq("owner_id", user.id);

    // Delete workspace memberships (non-owner)
    await adminClient.from("workspace_members").delete().eq("user_id", user.id).neq("role", "owner");

    // Delete owned workspaces (cascade will handle members/invites)
    const { data: ownedWorkspaces } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id);

    if (ownedWorkspaces?.length) {
      const wsIds = ownedWorkspaces.map((w) => w.id);
      await adminClient.from("workspace_invites").delete().in("workspace_id", wsIds);
      await adminClient.from("workspace_members").delete().in("workspace_id", wsIds);
      await adminClient.from("workspaces").delete().eq("owner_id", user.id);
    }

    // Delete subscriptions and profile
    await adminClient.from("subscriptions").delete().eq("user_id", user.id);
    await adminClient.from("ai_requests").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("id", user.id);

    // Delete avatar files from storage
    const { data: avatarFiles } = await adminClient.storage
      .from("avatars")
      .list(user.id);
    if (avatarFiles?.length) {
      await adminClient.storage
        .from("avatars")
        .remove(avatarFiles.map((f) => `${user.id}/${f.name}`));
    }

    // Finally, delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
