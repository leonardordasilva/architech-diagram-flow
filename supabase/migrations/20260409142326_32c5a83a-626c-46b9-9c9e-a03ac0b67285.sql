
-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- RLS: users can already read their own profile via existing policies.
-- We need a security definer function so the client can check is_admin without exposing the column to modification.

-- Create a helper function to check admin status (security definer, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = p_user_id),
    false
  );
$$;

-- Set the current admin user
UPDATE public.profiles SET is_admin = TRUE WHERE email = 'lrodriguesdasilva@gmail.com';
