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