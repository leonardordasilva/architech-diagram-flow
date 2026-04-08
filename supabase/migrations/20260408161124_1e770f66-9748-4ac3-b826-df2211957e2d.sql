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