-- ============================================================
-- saas0001: Billing infrastructure — subscriptions, plan_limits, profiles.plan, RPCs
-- ============================================================

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
