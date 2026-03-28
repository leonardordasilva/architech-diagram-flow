
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
