import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getMyWorkspace } from '@/services/workspaceService';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** Carrega o workspace do usuário e sincroniza com o workspaceStore. */
export function useWorkspace() {
  const { user } = useAuth();
  const { setWorkspace, setLoading } = useWorkspaceStore();

  const { data, isLoading } = useQuery({
    queryKey: ['workspace', user?.id],
    queryFn: () => getMyWorkspace(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (data) {
      setWorkspace({ id: data.id, name: data.name, ownerId: data.ownerId, role: data.role });
    } else if (!isLoading) {
      setWorkspace(null);
    }
  }, [data, isLoading, setWorkspace]);

  return useWorkspaceStore((s) => s.currentWorkspace);
}
