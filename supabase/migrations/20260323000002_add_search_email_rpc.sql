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
