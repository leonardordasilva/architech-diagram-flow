
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
