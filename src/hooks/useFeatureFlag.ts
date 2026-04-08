import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * T15: Hook to check feature flag status from the database.
 * Caches for 5 minutes to avoid excessive queries.
 */
export function useFeatureFlag(key: string): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-flag', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', key)
        .maybeSingle();
      if (error) {
        console.warn(`[useFeatureFlag] Failed to fetch flag "${key}":`, error.message);
        return false;
      }
      return data?.enabled ?? false;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return { enabled: data ?? false, isLoading };
}
