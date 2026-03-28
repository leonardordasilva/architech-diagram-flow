-- saas0003: Workspaces, gestão de membros e plano Team
-- Cria as tabelas workspaces, workspace_members, workspace_invites,
-- adiciona workspace_id em diagrams e atualiza as políticas RLS.

-- ── 1. Tabela workspaces ────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  owner_id                uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan                    text        NOT NULL DEFAULT 'team',
  stripe_subscription_id  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Owner tem acesso total
CREATE POLICY "workspaces_owner_all"
  ON public.workspaces FOR ALL
  USING (owner_id = auth.uid());

-- ── 2. Tabela workspace_members ─────────────────────────────────────────────
CREATE TABLE public.workspace_members (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         text        NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by   uuid        REFERENCES public.profiles(id),
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Membros aceitos podem ler o workspace (criada após workspace_members para evitar erro de relação)
CREATE POLICY "workspaces_members_select"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id
        AND wm.user_id = auth.uid()
        AND wm.accepted_at IS NOT NULL
    )
  );

-- Membros do workspace podem ler todos os membros
CREATE POLICY "workspace_members_select"
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

-- Owner pode inserir/alterar/deletar membros
CREATE POLICY "workspace_members_owner_manage"
  ON public.workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
    )
  );

-- ── 3. Tabela workspace_invites ─────────────────────────────────────────────
CREATE TABLE public.workspace_invites (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  role         text        NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by   uuid        NOT NULL REFERENCES public.profiles(id),
  token        text        NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz
);

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Owner do workspace pode gerenciar convites
CREATE POLICY "workspace_invites_owner_manage"
  ON public.workspace_invites FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
    )
  );

-- Leitura pública por token (para aceitar convite sem autenticação prévia)
CREATE POLICY "workspace_invites_public_read"
  ON public.workspace_invites FOR SELECT
  USING (true);

-- ── 4. workspace_id em diagrams ─────────────────────────────────────────────
ALTER TABLE public.diagrams
  ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX idx_diagrams_workspace_id
  ON public.diagrams (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- ── 5. Índices auxiliares ────────────────────────────────────────────────────
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_user      ON public.workspace_members (user_id);
CREATE INDEX idx_workspace_invites_token     ON public.workspace_invites (token);

-- ── 6. Auto-update updated_at em workspaces ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_workspaces_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspaces_updated_at();

-- ── 7. Atualizar políticas RLS de diagrams para incluir acesso por workspace ─
-- SELECT: inclui membros do workspace (qualquer role aceito)
DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams FOR SELECT
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid()
      )
      OR share_token IS NOT NULL
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- UPDATE: inclui editors e owners do workspace
DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid()
      )
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'editor')
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- DELETE: owner individual ou owner do workspace
DROP POLICY IF EXISTS "diagrams_delete_policy" ON public.diagrams;

CREATE POLICY "diagrams_delete_policy"
  ON public.diagrams FOR DELETE
  USING (
    owner_id = auth.uid()
    OR (
      workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = 'owner'
          AND wm.accepted_at IS NOT NULL
      )
    )
  );

-- INSERT: permite inserir em workspace se membro editor/owner aceito
DROP POLICY IF EXISTS "diagrams_insert_policy" ON public.diagrams;

CREATE POLICY "diagrams_insert_policy"
  ON public.diagrams FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'editor')
          AND wm.accepted_at IS NOT NULL
      )
    )
  );

-- ── 8. RPC: get_user_workspace ────────────────────────────────────────────────
-- Retorna o workspace onde o usuário é membro (aceito), preferindo o que ele é owner
CREATE OR REPLACE FUNCTION public.get_user_workspace(p_user_id uuid)
RETURNS TABLE (
  id                     uuid,
  name                   text,
  owner_id               uuid,
  stripe_subscription_id text,
  created_at             timestamptz,
  role                   text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    w.id,
    w.name,
    w.owner_id,
    w.stripe_subscription_id,
    w.created_at,
    wm.role
  FROM public.workspaces w
  JOIN public.workspace_members wm
    ON wm.workspace_id = w.id
   AND wm.user_id = p_user_id
   AND wm.accepted_at IS NOT NULL
  ORDER BY (wm.role = 'owner') DESC, w.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_workspace(uuid) TO authenticated;

-- ── 9. RPC: get_workspace_editor_count ──────────────────────────────────────
-- Conta editores cobráveis: owner + editors com accepted_at IS NOT NULL
CREATE OR REPLACE FUNCTION public.get_workspace_editor_count(p_workspace_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::integer
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND role IN ('owner', 'editor')
    AND accepted_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_editor_count(uuid) TO authenticated, service_role;

-- ── 10. RPC: get_workspace_members ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id uuid)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  email       text,
  role        text,
  invited_at  timestamptz,
  accepted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    wm.id,
    wm.user_id,
    p.email,
    wm.role,
    wm.invited_at,
    wm.accepted_at
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY (wm.role = 'owner') DESC, wm.invited_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated;
