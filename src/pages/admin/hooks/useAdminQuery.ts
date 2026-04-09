import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function adminInvoke<T = unknown>(fnName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(error.message || 'Admin request failed');
  return data as T;
}

export interface AdminUser {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  suspended_at: string | null;
  avatar_url: string | null;
  subscription_status?: string;
}

export interface AdminDiagram {
  id: string;
  title: string;
  owner_email: string;
  owner_id: string;
  workspace_name: string | null;
  node_count: number;
  edge_count: number;
  updated_at: string;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  owner_email: string;
  plan: string;
  member_count: number;
  diagram_count: number;
  created_at: string;
}

export function useAdminUsers(page = 1, filters?: { email?: string }) {
  return useQuery({
    queryKey: ['admin', 'users', page, filters],
    queryFn: () => adminInvoke<{ data: AdminUser[]; count: number }>('admin-query', {
      resource: 'users', page, pageSize: 20, filters,
    }),
  });
}

export function useAdminDiagrams(page = 1, filters?: { userId?: string }) {
  return useQuery({
    queryKey: ['admin', 'diagrams', page, filters],
    queryFn: () => adminInvoke<{ data: AdminDiagram[]; count: number }>('admin-query', {
      resource: 'diagrams', page, pageSize: 20, filters,
    }),
  });
}

export function useAdminWorkspaces(page = 1) {
  return useQuery({
    queryKey: ['admin', 'workspaces', page],
    queryFn: () => adminInvoke<{ data: AdminWorkspace[]; count: number }>('admin-query', {
      resource: 'workspaces', page, pageSize: 20,
    }),
  });
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminInvoke<{
      totalUsers: number;
      totalDiagrams: number;
      totalWorkspaces: number;
      planDistribution: Record<string, number>;
      recentUsers: AdminUser[];
      aiRequests24h: number;
    }>('admin-query', { resource: 'dashboard' }),
  });
}

export function useAdminMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const updatePlan = useMutation({
    mutationFn: (vars: { userId: string; plan: string }) =>
      adminInvoke('admin-update-plan', vars),
    onSuccess: (_data, vars) => {
      invalidateAll();
      // Also invalidate the user-facing plan-limits cache so the change reflects immediately
      qc.invalidateQueries({ queryKey: ['plan-limits', vars.userId] });
    },
  });

  const suspendUser = useMutation({
    mutationFn: (vars: { userId: string; suspend: boolean }) =>
      adminInvoke('admin-suspend-user', vars),
    onSuccess: invalidateAll,
  });

  const deleteUser = useMutation({
    mutationFn: (vars: { userId: string }) =>
      adminInvoke('admin-delete-user', vars),
    onSuccess: invalidateAll,
  });

  const deleteDiagram = useMutation({
    mutationFn: (vars: { diagramId: string }) =>
      adminInvoke('admin-delete-diagram', vars),
    onSuccess: invalidateAll,
  });

  const deleteWorkspace = useMutation({
    mutationFn: (vars: { workspaceId: string }) =>
      adminInvoke('admin-delete-workspace', vars),
    onSuccess: invalidateAll,
  });

  const updatePlanLimits = useMutation({
    mutationFn: (vars: { plan: string; limits: Record<string, unknown> }) =>
      adminInvoke('admin-update-plan-limits', vars),
    onSuccess: invalidateAll,
  });

  const updateFeatureFlag = useMutation({
    mutationFn: (vars: { key: string; enabled?: boolean; description?: string }) =>
      adminInvoke('admin-query', { resource: 'update-feature-flag', ...vars }),
    onSuccess: invalidateAll,
  });

  const createFeatureFlag = useMutation({
    mutationFn: (vars: { key: string; description: string }) =>
      adminInvoke('admin-query', { resource: 'create-feature-flag', ...vars }),
    onSuccess: invalidateAll,
  });

  const stripeAction = useMutation({
    mutationFn: (vars: { action: string; subscriptionId?: string }) =>
      adminInvoke('admin-stripe', vars),
    onSuccess: invalidateAll,
  });

  return {
    updatePlan, suspendUser, deleteUser, deleteDiagram,
    deleteWorkspace, updatePlanLimits, updateFeatureFlag,
    createFeatureFlag, stripeAction,
  };
}
