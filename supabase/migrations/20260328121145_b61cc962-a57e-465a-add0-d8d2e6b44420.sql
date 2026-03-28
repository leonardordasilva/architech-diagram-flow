-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Diagrams table
CREATE TABLE public.diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Novo Diagrama',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_id UUID NOT NULL,
  share_token TEXT UNIQUE,
  is_shared boolean NOT NULL DEFAULT false,
  node_count integer NOT NULL DEFAULT 0,
  edge_count integer NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  workspace_id uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diagrams;

CREATE INDEX idx_diagrams_owner_id ON public.diagrams (owner_id);
CREATE INDEX idx_diagrams_deleted_at ON public.diagrams (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_diagrams_workspace_id ON public.diagrams (workspace_id) WHERE workspace_id IS NOT NULL;

-- 2. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE INDEX idx_profiles_email_trgm ON public.profiles USING GIN (email gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Diagram shares table
CREATE TABLE public.diagram_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id uuid NOT NULL REFERENCES public.diagrams(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(diagram_id, shared_with_id)
);

ALTER TABLE public.diagram_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagram_shares_select_policy"
  ON public.diagram_shares FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR shared_with_id = auth.uid());

CREATE POLICY "diagram_shares_insert_policy"
  ON public.diagram_shares FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM diagrams WHERE diagrams.id = diagram_id AND diagrams.owner_id = auth.uid())
  );

CREATE POLICY "diagram_shares_delete_policy"
  ON public.diagram_shares FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR shared_with_id = auth.uid());

-- 4. AI requests table
CREATE TABLE public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests" ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own requests" ON public.ai_requests FOR SELECT USING (user_id = auth.uid());

CREATE INDEX idx_ai_requests_user_created ON ai_requests (user_id, created_at DESC);

-- 5. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions (stripe_customer_id);

-- 6. Plan limits table
CREATE TABLE public.plan_limits (
  plan text PRIMARY KEY CHECK (plan IN ('free', 'pro', 'team')),
  max_diagrams int,
  max_nodes_per_diagram int,
  max_collaborators_per_diagram int,
  allowed_export_formats text[] NOT NULL DEFAULT '{png,json}',
  watermark_enabled boolean NOT NULL DEFAULT false,
  realtime_collab_enabled boolean NOT NULL DEFAULT false,
  email_sharing_enabled boolean NOT NULL DEFAULT false
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits are publicly readable" ON public.plan_limits FOR SELECT USING (true);

INSERT INTO public.plan_limits
  (plan, max_diagrams, max_nodes_per_diagram, max_collaborators_per_diagram,
   allowed_export_formats, watermark_enabled, realtime_collab_enabled, email_sharing_enabled)
VALUES
  ('free', 3, 25, 0, '{png,json}', true, false, false),
  ('pro', NULL, 200, 5, '{png,svg,mermaid,json}', false, true, true),
  ('team', NULL, NULL, NULL, '{png,svg,mermaid,json}', false, true, true)
ON CONFLICT (plan) DO NOTHING;

-- 7. Workspaces
CREATE TABLE public.workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'team',
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_owner_all" ON public.workspaces FOR ALL USING (owner_id = auth.uid());

-- Add FK for diagrams.workspace_id now that workspaces exists
ALTER TABLE public.diagrams ADD CONSTRAINT diagrams_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 8. Workspace members
CREATE TABLE public.workspace_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by uuid REFERENCES public.profiles(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_members_select" ON public.workspaces FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = id AND wm.user_id = auth.uid() AND wm.accepted_at IS NOT NULL
  ));

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members (user_id);

-- 9. Workspace invites
CREATE TABLE public.workspace_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz
);

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspace_invites_token ON public.workspace_invites (token);

CREATE POLICY "workspace_invites_public_read" ON public.workspace_invites FOR SELECT USING (true);

-- 10. Helper functions for workspace RLS
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_owner_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'owner';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_owner_workspace_ids() TO authenticated;

CREATE POLICY "workspace_members_select"
  ON public.workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "workspace_members_owner_manage"
  ON public.workspace_members FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));

CREATE POLICY "workspace_invites_owner_manage"
  ON public.workspace_invites FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));

-- 11. Diagrams RLS policies
CREATE POLICY "diagrams_select_policy" ON public.diagrams FOR SELECT
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.diagram_shares ds WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid())
      OR share_token IS NOT NULL
      OR (workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = diagrams.workspace_id AND wm.user_id = auth.uid() AND wm.accepted_at IS NOT NULL
      ))
    )
  );

CREATE POLICY "diagrams_insert_policy" ON public.diagrams FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = diagrams.workspace_id AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'editor') AND wm.accepted_at IS NOT NULL
      )
    )
  );

CREATE POLICY "diagrams_update_policy" ON public.diagrams FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.diagram_shares ds WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid())
      OR (workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = diagrams.workspace_id AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'editor') AND wm.accepted_at IS NOT NULL
      ))
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.diagram_shares ds WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid())
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = diagrams.workspace_id AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'editor') AND wm.accepted_at IS NOT NULL
    ))
  );

CREATE POLICY "diagrams_delete_policy" ON public.diagrams FOR DELETE
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = diagrams.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'owner' AND wm.accepted_at IS NOT NULL
    ))
  );

-- 12. RPC functions
CREATE OR REPLACE FUNCTION public.get_diagram_by_share_token(token TEXT)
RETURNS SETOF public.diagrams LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM diagrams WHERE share_token = token AND is_shared = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_diagram_owner(diagram_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT owner_id FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_diagram_title(diagram_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT title FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
RETURNS TABLE (
  plan text, max_diagrams int, max_nodes_per_diagram int,
  max_collaborators_per_diagram int, allowed_export_formats text[],
  watermark_enabled boolean, realtime_collab_enabled boolean, email_sharing_enabled boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pl.plan, pl.max_diagrams, pl.max_nodes_per_diagram, pl.max_collaborators_per_diagram,
    pl.allowed_export_formats, pl.watermark_enabled, pl.realtime_collab_enabled, pl.email_sharing_enabled
  FROM public.profiles pr JOIN public.plan_limits pl ON pl.plan = pr.plan WHERE pr.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_plan_limits(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_diagram_count(p_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.diagrams WHERE owner_id = p_user_id AND deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_diagram_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_diagram_collaborator(p_diagram_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diagrams WHERE id = p_diagram_id AND owner_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.diagram_shares WHERE diagram_id = p_diagram_id AND shared_with_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_diagram_collaborator(uuid, uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_user_workspace(p_user_id uuid)
RETURNS TABLE (id uuid, name text, owner_id uuid, stripe_subscription_id text, created_at timestamptz, role text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT w.id, w.name, w.owner_id, w.stripe_subscription_id, w.created_at, wm.role
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = p_user_id AND wm.accepted_at IS NOT NULL
  ORDER BY (wm.role = 'owner') DESC, w.created_at ASC LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_workspace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_workspace_editor_count(p_workspace_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::integer FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND role IN ('owner', 'editor') AND accepted_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_editor_count(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id uuid)
RETURNS TABLE (id uuid, user_id uuid, email text, role text, invited_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT wm.id, wm.user_id, p.email, wm.role, wm.invited_at, wm.accepted_at
  FROM public.workspace_members wm JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id ORDER BY (wm.role = 'owner') DESC, wm.invited_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_users_by_email(p_query TEXT, p_exclude_user_id UUID)
RETURNS TABLE(id UUID, email TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trimmed TEXT;
BEGIN
  v_trimmed := trim(lower(p_query));
  IF length(v_trimmed) < 3 THEN RAISE EXCEPTION 'QUERY_TOO_SHORT' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY SELECT p.id, p.email FROM public.profiles p
    WHERE p.email ILIKE '%' || v_trimmed || '%' AND p.id != p_exclude_user_id ORDER BY p.email LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_diagram(p_diagram_id uuid, p_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.diagrams WHERE id = p_diagram_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.diagrams SET deleted_at = now() WHERE id = p_diagram_id AND owner_id = p_owner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_diagram(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_old_soft_deleted_diagrams()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.diagram_shares WHERE diagram_id IN (
    SELECT id FROM public.diagrams WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
  );
  DELETE FROM public.diagrams WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 13. Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_workspaces_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_workspaces_updated_at();

CREATE OR REPLACE FUNCTION public.check_diagram_limit_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT; v_max_diagrams INTEGER; v_current_count INTEGER;
BEGIN
  IF NEW.workspace_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.owner_id;
  SELECT max_diagrams INTO v_max_diagrams FROM public.plan_limits WHERE plan = COALESCE(v_plan, 'free');
  IF v_max_diagrams IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_current_count FROM public.diagrams
    WHERE owner_id = NEW.owner_id AND deleted_at IS NULL AND workspace_id IS NULL;
  IF v_current_count >= v_max_diagrams THEN
    RAISE EXCEPTION 'DIAGRAM_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_diagram_limit
  BEFORE INSERT ON public.diagrams FOR EACH ROW EXECUTE FUNCTION public.check_diagram_limit_before_insert();

-- 14. Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);