import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, session } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id || !session?.access_token) return false;

      const { data, error } = await supabase.functions.invoke('is-admin', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) return false;
      return data?.isAdmin === true;
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 5 * 60 * 1000,
  });

  return { isAdmin: data ?? false, isLoading };
}
