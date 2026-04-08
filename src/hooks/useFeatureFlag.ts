import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled');
  if (error || !data) return {};
  return Object.fromEntries((data as FeatureFlag[]).map((f) => [f.key, f.enabled]));
}

/**
 * Returns whether a feature flag is enabled.
 * Defaults to `defaultValue` while loading or if flag doesn't exist.
 * All flags are fetched in a single query and cached for 10 minutes.
 */
export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const { data } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });
  return data?.[key] ?? defaultValue;
}
