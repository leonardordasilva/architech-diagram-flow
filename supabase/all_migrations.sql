-- ============================================================
-- all_migrations.sql — Consolidated schema for AchiTech Diagram Flow
-- ============================================================
-- This file is the SINGLE SOURCE OF TRUTH for the database schema.
-- It concatenates every migration in chronological order.
--
-- PURPOSE:
--   • Quick reference for developers reviewing the full schema
--   • Basis for rebuilding the database from scratch in a new environment
--   • Audit trail of structural changes
--
-- RULES:
--   1. Never edit SQL blocks directly — always create a new migration file
--   2. After each migration, append the new SQL here with a separator comment
--   3. Keep migration separators in chronological order
--
-- Last updated: 2026-03-28 (PRD-0022)
-- ============================================================


-- ── migration: 01_create_diagrams_table.sql ──────────────────────────────────

CREATE TABLE public.diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Novo Diagrama',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_id UUID NOT NULL,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Owner full access" ON public.diagrams
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anyone can read shared diagrams by share_token
CREATE POLICY "Public read via share_token" ON public.diagrams
  FOR SELECT USING (share_token IS NOT NULL);

-- Anyone authenticated can insert (to create their own diagrams)
CREATE POLICY "Authenticated users can insert" ON public.diagrams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.diagrams;


-- ── migration: 02_add_is_shared_and_share_token_fix.sql ──────────────────────

-- Add is_shared column (default false so existing diagrams are private)
ALTER TABLE public.diagrams ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- Remove the default on share_token so new diagrams don't auto-generate tokens
ALTER TABLE public.diagrams ALTER COLUMN share_token DROP DEFAULT;

-- Drop the broken RLS policy
DROP POLICY IF EXISTS "Public read via share_token" ON public.diagrams;

-- Create a secure RPC to fetch diagrams by share token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_diagram_by_share_token(token TEXT)
RETURNS SETOF public.diagrams
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM diagrams WHERE share_token = token AND is_shared = true LIMIT 1;
$$;


-- ── migration: 03_create_profiles_and_diagram_shares.sql ─────────────────────

-- 1. Profiles table for user lookup by email
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read profiles (needed for share-by-email lookup)
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert/update their own profile
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Diagram shares table
CREATE TABLE public.diagram_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id uuid NOT NULL REFERENCES public.diagrams(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(diagram_id, shared_with_id)
);

ALTER TABLE public.diagram_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage shares
CREATE POLICY "Owner manages shares"
  ON public.diagram_shares FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared user can see their shares
CREATE POLICY "Shared user can see own shares"
  ON public.diagram_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = shared_with_id);

-- 3. Allow shared users to read/update diagrams
CREATE POLICY "Shared users can read diagrams"
  ON public.diagrams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagram_shares
      WHERE diagram_id = diagrams.id
      AND shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can update diagrams"
  ON public.diagrams FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagram_shares
      WHERE diagram_id = diagrams.id
      AND shared_with_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.diagram_shares
      WHERE diagram_id = diagrams.id
      AND shared_with_id = auth.uid()
    )
  );

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ── migration: 04_epic1_secure_diagram_policies.sql ──────────────────────────

-- Épico 1: Drop existing diagrams policies and create new secure ones
DROP POLICY IF EXISTS "Authenticated users can insert" ON diagrams;
DROP POLICY IF EXISTS "Owner full access" ON diagrams;
DROP POLICY IF EXISTS "Shared users can read diagrams" ON diagrams;
DROP POLICY IF EXISTS "Shared users can update diagrams" ON diagrams;

ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

-- SELECT: owner, collaborator, or public shared
CREATE POLICY "diagrams_select_policy"
ON diagrams FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM diagram_shares
    WHERE diagram_shares.diagram_id = diagrams.id
    AND diagram_shares.shared_with_id = auth.uid()
  )
  OR is_shared = true
);

-- INSERT: only owner can insert their own
CREATE POLICY "diagrams_insert_policy"
ON diagrams FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- UPDATE: owner can update anything; collaborator can update but not change owner_id or title
CREATE POLICY "diagrams_update_policy"
ON diagrams FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM diagram_shares
    WHERE diagram_shares.diagram_id = diagrams.id
    AND diagram_shares.shared_with_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1 FROM diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
      AND diagram_shares.shared_with_id = auth.uid()
    )
    AND owner_id = (SELECT d2.owner_id FROM diagrams d2 WHERE d2.id = diagrams.id)
    AND title = (SELECT d2.title FROM diagrams d2 WHERE d2.id = diagrams.id)
  )
);

-- DELETE: only owner
CREATE POLICY "diagrams_delete_policy"
ON diagrams FOR DELETE
TO authenticated
USING (owner_id = auth.uid());


-- ── migration: 05_epic7_secure_diagram_shares_policies.sql ───────────────────

-- Épico 7: Drop existing diagram_shares policies and create new secure ones
DROP POLICY IF EXISTS "Owner manages shares" ON diagram_shares;
DROP POLICY IF EXISTS "Shared user can see own shares" ON diagram_shares;

ALTER TABLE diagram_shares ENABLE ROW LEVEL SECURITY;

-- SELECT: owner or shared_with user
CREATE POLICY "diagram_shares_select_policy"
ON diagram_shares FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR shared_with_id = auth.uid()
);

-- INSERT: only diagram owner can create shares
CREATE POLICY "diagram_shares_insert_policy"
ON diagram_shares FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM diagrams
    WHERE diagrams.id = diagram_id
    AND diagrams.owner_id = auth.uid()
  )
);

-- DELETE: owner can revoke, shared_with can leave
CREATE POLICY "diagram_shares_delete_policy"
ON diagram_shares FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR shared_with_id = auth.uid()
);


-- ── migration: 06_create_ai_requests.sql ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests"
  ON public.ai_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own requests"
  ON public.ai_requests
  FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX idx_ai_requests_rate_limit
  ON public.ai_requests (user_id, function_name, created_at DESC);


-- ── migration: 07_security_definer_helpers_and_update_policy_fix.sql ─────────

-- Security definer functions to avoid infinite recursion in RLS policies

CREATE OR REPLACE FUNCTION public.get_diagram_owner(diagram_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT owner_id FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_diagram_title(diagram_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT title FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

-- Drop and recreate the update policy without self-referencing subqueries
DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams
  FOR UPDATE
  USING (
    (owner_id = auth.uid())
    OR
    (EXISTS (
      SELECT 1 FROM diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
        AND diagram_shares.shared_with_id = auth.uid()
    ))
  )
  WITH CHECK (
    (owner_id = auth.uid())
    OR
    (
      (EXISTS (
        SELECT 1 FROM diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      ))
      AND owner_id = public.get_diagram_owner(diagrams.id)
      AND title = public.get_diagram_title(diagrams.id)
    )
  );


-- ── migration: 08_ai_requests_index_and_retention.sql ────────────────────────

-- A01: Index for ai_requests rate-limit queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);

-- A01: Retention comment (5 minutes)
COMMENT ON TABLE public.ai_requests IS 'Rate-limit tracking. Rows older than 5 minutes are purged by edge functions.';


-- ── migration: 09_ai_requests_index_optimization.sql ─────────────────────────

-- Migration: adjust index on ai_requests for rate-limit query performance
-- PRD-12 / R4-INF-01

DROP INDEX IF EXISTS idx_ai_requests_user_created;

CREATE INDEX idx_ai_requests_user_created
  ON ai_requests (user_id, created_at DESC);

COMMENT ON TABLE ai_requests IS
  'Registros de requisições de IA para rate limiting.
   Política de retenção: registros com mais de 5 minutos são
   purgados proativamente pela Edge Function generate-diagram.
   O índice idx_ai_requests_user_created é crítico para
   performance das queries de contagem por usuário.';


-- ── migration: 10_add_metadata_columns.sql ───────────────────────────────────

-- 1a. Índice composto para rate limiting na ai_requests
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created
ON public.ai_requests (user_id, created_at DESC);

-- 1b. Colunas de metadados não criptografados em diagrams
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS node_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edge_count integer NOT NULL DEFAULT 0;


-- ── migration: 11_r10_fix_select_policy.sql ──────────────────────────────────

-- R10: Fix SELECT policy — remove OR is_shared = true
-- The is_shared column + share_token are used by the SECURITY DEFINER
-- function get_diagram_by_share_token which bypasses RLS entirely.
-- Having is_shared in the RLS policy allows ANY authenticated user
-- to read ANY public diagram, which is an over-permissive data leak.

DROP POLICY IF EXISTS "diagrams_select_policy" ON diagrams;

CREATE POLICY "diagrams_select_policy"
ON diagrams FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM diagram_shares
    WHERE diagram_shares.diagram_id = diagrams.id
    AND diagram_shares.shared_with_id = auth.uid()
  )
);


-- ── migration: 12_r7_owner_id_index.sql ──────────────────────────────────────

-- R7: Add missing index on diagrams.owner_id
-- All diagram list queries filter by owner_id; without this index
-- PostgreSQL performs a sequential scan on the diagrams table.

CREATE INDEX IF NOT EXISTS idx_diagrams_owner_id
ON public.diagrams (owner_id);


-- ── migration: 13_r9_soft_delete.sql ─────────────────────────────────────────

-- R9: Soft delete for diagrams
-- Replaces hard DELETE with a deleted_at timestamp update so that
-- accidental deletions can be recovered via the Supabase dashboard.

-- 1. Add the soft-delete column
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update SELECT policy to exclude soft-deleted rows
--    (R10 policy is dropped and replaced here with deleted_at guard added)
DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      )
    )
  );

-- 3. Update UPDATE policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
        AND diagram_shares.shared_with_id = auth.uid()
    )
  );


-- ── migration: 14_r6_trigram_index.sql ───────────────────────────────────────

-- R6: GIN trigram index on profiles.email for fast ILIKE searches
-- Without this, searchUsersByEmail with ILIKE '%term%' does a sequential scan.

-- Enable pg_trgm extension if not already active
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for partial email search (ILIKE '%term%')
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON public.profiles
  USING GIN (email gin_trgm_ops);


-- ── migration: 15_r3_purge_function.sql ──────────────────────────────────────

-- R3: Função para purgar diagramas soft-deleted com mais de 30 dias
-- Pode ser chamada manualmente via Supabase SQL Editor ou agendada via pg_cron

CREATE OR REPLACE FUNCTION public.purge_old_soft_deleted_diagrams()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove shares associados aos diagramas que serão purgados
  DELETE FROM public.diagram_shares
  WHERE diagram_id IN (
    SELECT id FROM public.diagrams
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- Purga permanente dos diagramas soft-deleted há mais de 30 dias
  DELETE FROM public.diagrams
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.purge_old_soft_deleted_diagrams()
  IS 'Purga permanente de diagramas soft-deleted há mais de 30 dias. '
     'Chamada manual: SELECT public.purge_old_soft_deleted_diagrams(); '
     'Para agendamento automático, habilitar pg_cron no projeto Supabase e criar: '
     'SELECT cron.schedule(''purge-deleted-diagrams'', ''0 3 * * 0'', ''SELECT public.purge_old_soft_deleted_diagrams()'');';

-- Índice parcial para acelerar a query de purge (só indexa registros com deleted_at)
CREATE INDEX IF NOT EXISTS idx_diagrams_deleted_at
  ON public.diagrams (deleted_at)
  WHERE deleted_at IS NOT NULL;


-- ── migration: 16_a1_pg_cron_schedule.sql ────────────────────────────────────

-- A1: Habilitar pg_cron e agendar purge semanal de diagramas soft-deleted
--
-- PRÉ-REQUISITO: A extensão pg_cron deve estar habilitada no projeto Supabase.
-- No dashboard: Database → Extensions → procurar "pg_cron" → Enable.
-- Se já estiver habilitada, o CREATE EXTENSION abaixo é um no-op.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução semanal: domingos às 03:00 UTC
-- Remove diagramas com deleted_at > 30 dias e seus diagram_shares associados
SELECT cron.schedule(
  'purge-deleted-diagrams',           -- nome único do job
  '0 3 * * 0',                        -- cron expression: domingo 03:00 UTC

  $$SELECT public.purge_old_soft_deleted_diagrams()$$
);

-- Comentário para documentação
COMMENT ON EXTENSION pg_cron IS
  'Agendador de jobs. Job ativo: purge-deleted-diagrams (dom 03:00 UTC). '
  'Verificar jobs: SELECT * FROM cron.job; '
  'Verificar execuções: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;';


-- ── migration: 17_saas0001_billing_infrastructure.sql ────────────────────────

-- saas0001: Billing infrastructure — subscriptions, plan_limits, profiles.plan, RPCs

-- 1. Adiciona coluna plan na tabela profiles (cache desnormalizado)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- 2. Tabela subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan                    text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  billing_cycle           text CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  stripe_customer_id      text,
  stripe_subscription_id  text UNIQUE,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS para subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Inserção e atualização apenas via service_role (webhook) — nenhuma policy de write para authenticated

-- 3. Tabela plan_limits (configuração pública, sem RLS)
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan                            text PRIMARY KEY CHECK (plan IN ('free', 'pro', 'team')),
  max_diagrams                    int,           -- NULL = ilimitado
  max_nodes_per_diagram           int,           -- NULL = ilimitado
  max_collaborators_per_diagram   int,           -- NULL = ilimitado
  allowed_export_formats          text[]  NOT NULL DEFAULT '{png,json}',
  watermark_enabled               boolean NOT NULL DEFAULT false,
  realtime_collab_enabled         boolean NOT NULL DEFAULT false,
  email_sharing_enabled           boolean NOT NULL DEFAULT false
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits are publicly readable"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Seed plan_limits
INSERT INTO public.plan_limits
  (plan, max_diagrams, max_nodes_per_diagram, max_collaborators_per_diagram,
   allowed_export_formats, watermark_enabled, realtime_collab_enabled, email_sharing_enabled)
VALUES
  ('free', 3,    25,   0,    '{png,json}',              true,  false, false),
  ('pro',  NULL, 200,  5,    '{png,svg,mermaid,json}',  false, true,  true),
  ('team', NULL, NULL, NULL, '{png,svg,mermaid,json}',  false, true,  true)
ON CONFLICT (plan) DO NOTHING;

-- 4. Função RPC: get_user_plan_limits(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
RETURNS TABLE (
  plan                            text,
  max_diagrams                    int,
  max_nodes_per_diagram           int,
  max_collaborators_per_diagram   int,
  allowed_export_formats          text[],
  watermark_enabled               boolean,
  realtime_collab_enabled         boolean,
  email_sharing_enabled           boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.plan,
    pl.max_diagrams,
    pl.max_nodes_per_diagram,
    pl.max_collaborators_per_diagram,
    pl.allowed_export_formats,
    pl.watermark_enabled,
    pl.realtime_collab_enabled,
    pl.email_sharing_enabled
  FROM public.profiles pr
  JOIN public.plan_limits pl ON pl.plan = pr.plan
  WHERE pr.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_plan_limits(uuid) TO authenticated;

-- 5. Função RPC: get_user_diagram_count(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.get_user_diagram_count(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.diagrams
  WHERE owner_id = p_user_id
    AND deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_diagram_count(uuid) TO authenticated;

-- 6. Função RPC: is_diagram_collaborator(p_diagram_id uuid, p_user_id uuid)
--    Retorna true se user é owner OU tem entrada em diagram_shares
CREATE OR REPLACE FUNCTION public.is_diagram_collaborator(p_diagram_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diagrams WHERE id = p_diagram_id AND owner_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.diagram_shares WHERE diagram_id = p_diagram_id AND shared_with_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_diagram_collaborator(uuid, uuid) TO authenticated, anon;

-- 7. Índice para consultas de subscription por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions (stripe_customer_id);

-- 8. updated_at automático para subscriptions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── migration: 18_saas0003_workspaces.sql ────────────────────────────────────

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


-- ── migration: 19_b6_diagram_limit_trigger.sql ──────────────────────────────

-- B6: Server-side trigger to enforce diagram count limit.
-- Provides a second layer beyond the client-side check in useSaveDiagram.ts,
-- protecting against race conditions and direct API access.

CREATE OR REPLACE FUNCTION public.check_diagram_limit_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          TEXT;
  v_max_diagrams  INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Workspace diagrams are managed at the workspace level — skip per-user limit
  IF NEW.workspace_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the owner's current plan
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.owner_id;

  -- Fetch the plan's diagram cap (NULL = unlimited)
  SELECT max_diagrams INTO v_max_diagrams
  FROM public.plan_limits
  WHERE plan = COALESCE(v_plan, 'free');

  -- NULL cap means unlimited — allow the insert
  IF v_max_diagrams IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing non-deleted diagrams owned by this user
  SELECT COUNT(*) INTO v_current_count
  FROM public.diagrams
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND workspace_id IS NULL;

  IF v_current_count >= v_max_diagrams THEN
    RAISE EXCEPTION 'DIAGRAM_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_diagram_limit
  BEFORE INSERT ON public.diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_diagram_limit_before_insert();


-- ── migration: 20_i7_search_users_rpc.sql ────────────────────────────────────

-- I7: RPC for user email search with server-side minimum-length validation.
-- Moving the 3-char guard from the client to the DB prevents enumeration of
-- all user emails via direct PostgREST table access.

CREATE OR REPLACE FUNCTION public.search_users_by_email(
  p_query          TEXT,
  p_exclude_user_id UUID
)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed TEXT;
BEGIN
  v_trimmed := trim(lower(p_query));

  -- Server-side minimum length validation — reject short queries
  IF length(v_trimmed) < 3 THEN
    RAISE EXCEPTION 'QUERY_TOO_SHORT' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE p.email ILIKE '%' || v_trimmed || '%'
      AND p.id != p_exclude_user_id
    ORDER BY p.email
    LIMIT 20;
END;
$$;


-- ── migration: 21_add_avatar_url.sql ─────────────────────────────────────────

-- Add avatar_url column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create public storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop policies idempotently before recreating
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Anyone can read avatars (public bucket)
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can replace their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── migration: 22_fix_trigger_workspace_id.sql ──────────────────────────────

-- Fix: trigger enforce_diagram_limit referenced NEW.workspace_id before the column existed.
-- Depends on 20260322000001_add_workspaces.sql (adds workspace_id + workspaces table).

-- 1. Ensure workspace_id column exists (idempotent — no-op if already present)
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 2. Recreate the trigger function
CREATE OR REPLACE FUNCTION public.check_diagram_limit_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          TEXT;
  v_max_diagrams  INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Workspace diagrams skip per-user limit
  IF NEW.workspace_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.owner_id;

  SELECT max_diagrams INTO v_max_diagrams
  FROM public.plan_limits
  WHERE plan = COALESCE(v_plan, 'free');

  IF v_max_diagrams IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.diagrams
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND workspace_id IS NULL;

  IF v_current_count >= v_max_diagrams THEN
    RAISE EXCEPTION 'DIAGRAM_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Recreate trigger
DROP TRIGGER IF EXISTS enforce_diagram_limit ON public.diagrams;

CREATE TRIGGER enforce_diagram_limit
  BEFORE INSERT ON public.diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_diagram_limit_before_insert();


-- ── migration: 23_fix_workspace_members_recursion.sql ────────────────────────

-- Fix: infinite recursion in workspace_members RLS policies.
-- Policies on workspace_members that query workspace_members itself cause recursion.
-- Solution: SECURITY DEFINER helper functions that bypass RLS.

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_owner_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid() AND role = 'owner';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_owner_workspace_ids() TO authenticated;

-- Recreate workspace_members policies without self-referencing subqueries
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_owner_manage" ON public.workspace_members;

CREATE POLICY "workspace_members_select"
  ON public.workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "workspace_members_owner_manage"
  ON public.workspace_members FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));

-- Also fix workspace_invites policy that queries workspace_members
DROP POLICY IF EXISTS "workspace_invites_owner_manage" ON public.workspace_invites;

CREATE POLICY "workspace_invites_owner_manage"
  ON public.workspace_invites FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));


-- ── migration: 24_fix_soft_delete_update_policy.sql ──────────────────────────

-- Fix: soft-delete (PATCH deleted_at) returns 403 because the UPDATE policy
-- uses `deleted_at IS NULL` in USING, which PostgreSQL also applies as an
-- implicit WITH CHECK on the new row — after setting deleted_at the new row
-- fails the check. Fix: explicit WITH CHECK that only verifies ownership.

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
  )
  WITH CHECK (
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
  );


-- ── migration: 25_soft_delete_rpc.sql ────────────────────────────────────────

-- Fix: use a SECURITY DEFINER RPC for soft delete to bypass RLS UPDATE policy complexity.
-- The UPDATE policy WITH CHECK causes 403 even with explicit WITH CHECK clause.
-- This function validates ownership server-side and performs the soft delete directly.

CREATE OR REPLACE FUNCTION public.soft_delete_diagram(p_diagram_id uuid, p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate ownership before soft-deleting
  IF NOT EXISTS (
    SELECT 1 FROM public.diagrams
    WHERE id = p_diagram_id AND owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.diagrams
  SET deleted_at = now()
  WHERE id = p_diagram_id AND owner_id = p_owner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_diagram(uuid, uuid) TO authenticated;


-- ── migration: 26_prd0021_audit_remediation.sql ──────────────────────────────

-- PRD-0021: Remediação de riscos de auditoria técnica

-- ITEM 4: Fix permissive RLS SELECT policy on diagrams
-- Remove OR share_token IS NOT NULL which allows any authenticated user to read any shared diagram
DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = diagrams.id
          AND ds.shared_with_id = auth.uid()
      )
      OR (workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = diagrams.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.accepted_at IS NOT NULL
      ))
    )
  );

-- ITEM 8: Add content_hash column for integrity verification
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS content_hash text;

-- ITEM 12: Partial index for content_hash lookups
CREATE INDEX IF NOT EXISTS idx_diagrams_content_hash
  ON public.diagrams (id, content_hash)
  WHERE content_hash IS NOT NULL;


-- ── migration: 26_fix_select_policy_share_token.sql ──────────────────────────
-- Remove 'OR share_token IS NOT NULL' da diagrams_select_policy.
-- A leitura pública via token é feita exclusivamente pela SECURITY DEFINER
-- function get_diagram_by_share_token, que bypassa RLS.

DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
      )
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = diagrams.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  );


-- ── migration: 27_restrict_update_with_check.sql ─────────────────────────────
-- Restringe WITH CHECK no UPDATE: collaborators não podem alterar
-- owner_id, title, is_shared, ou share_token.

DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
      )
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = diagrams.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'editor')
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  )
  WITH CHECK (
    (owner_id = auth.uid())
    OR
    (
      (
        EXISTS (
          SELECT 1 FROM public.diagram_shares ds
          WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
        )
        OR (
          workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = diagrams.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'editor')
              AND wm.accepted_at IS NOT NULL
          )
        )
      )
      AND owner_id = public.get_diagram_owner(id)
      AND title = public.get_diagram_title(id)
    )
  );

-- ── migration: 20260408161124_rate_limits_and_feature_flags.sql ──

-- Rate limits table
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (key)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate_limits"
  ON public.rate_limits FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Atomic rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  SELECT count, window_start INTO v_count, v_window_start
    FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, count, window_start)
      VALUES (p_key, 1, now())
      ON CONFLICT (key) DO UPDATE SET count = 1, window_start = now();
    RETURN true;
  END IF;

  IF now() > v_window_start + (p_window_seconds || ' seconds')::interval THEN
    UPDATE public.rate_limits SET count = 1, window_start = now() WHERE key = p_key;
    RETURN true;
  END IF;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits SET count = v_count + 1 WHERE key = p_key;
  RETURN true;
END;
$$;

-- Cleanup function
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '10 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Feature flags table
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature flags are publicly readable"
  ON public.feature_flags FOR SELECT
  USING (true);

-- Insert example flag
INSERT INTO public.feature_flags (key, enabled, description)
  VALUES ('atomic_save', true, 'Use server-side atomic save via edge function');

-- ── migration: 20260408_share_token_expires_at.sql ──
-- PRD-0026 F4-T2: Share token expiration

ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;

COMMENT ON COLUMN public.diagrams.share_token_expires_at IS
  'When set, the share_token expires at this timestamp. NULL means no expiration (backward-compat).';

CREATE OR REPLACE FUNCTION public.get_diagram_by_share_token(token text)
 RETURNS SETOF diagrams
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT * FROM diagrams
  WHERE share_token = token
    AND is_shared = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now())
  LIMIT 1;
$$;
