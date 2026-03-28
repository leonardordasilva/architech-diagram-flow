import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanStore, type PlanLimits, FREE_LIMITS } from '@/store/planStore';

async function fetchPlanLimits(userId: string): Promise<PlanLimits> {
  const { data, error } = await supabase.rpc('get_user_plan_limits', { p_user_id: userId });
  if (error || !data || data.length === 0) return FREE_LIMITS;

  const row = data[0];
  return {
    plan: (row.plan as PlanLimits['plan']) || 'free',
    maxDiagrams: row.max_diagrams ?? null,
    maxNodesPerDiagram: row.max_nodes_per_diagram ?? null,
    maxCollaboratorsPerDiagram: row.max_collaborators_per_diagram ?? null,
    allowedExportFormats: row.allowed_export_formats || ['png', 'json'],
    watermarkEnabled: row.watermark_enabled ?? true,
    realtimeCollabEnabled: row.realtime_collab_enabled ?? false,
    emailSharingEnabled: row.email_sharing_enabled ?? false,
  };
}

/** Loads plan limits once per session and syncs to planStore. */
export function usePlanLimits() {
  const { user } = useAuth();
  const { setLimits, setLoading } = usePlanStore();

  const { data, isLoading } = useQuery({
    queryKey: ['plan-limits', user?.id],
    queryFn: () => fetchPlanLimits(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (data) setLimits(data);
    else if (!isLoading) setLimits(FREE_LIMITS);
  }, [data, isLoading, setLimits]);

  return usePlanStore((s) => s.limits);
}
