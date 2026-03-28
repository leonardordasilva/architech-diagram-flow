import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceMember {
  id: string;
  userId: string | null; // null for token-based invites (user has no account yet)
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt: string;
  acceptedAt: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'editor' | 'viewer';
  stripeSubscriptionId: string | null;
  createdAt: string;
}

/** Busca o workspace do usuário via RPC */
export async function getMyWorkspace(userId: string): Promise<WorkspaceRecord | null> {
  const { data, error } = await supabase.rpc('get_user_workspace', { p_user_id: userId });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    role: row.role as WorkspaceRecord['role'],
    stripeSubscriptionId: row.stripe_subscription_id,
    createdAt: row.created_at,
  };
}

/** Lista membros do workspace via RPC */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase.rpc('get_workspace_members', { p_workspace_id: workspaceId });
  if (error || !data) throw error ?? new Error('Failed to load members');
  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    role: row.role as WorkspaceMember['role'],
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  }));
}

/** Remove um membro ou convite pendente do workspace (apenas owner pode) */
export async function removeWorkspaceMember(workspaceId: string, memberId: string, userId: string | null): Promise<void> {
  if (userId) {
    // Membro com conta — remove de workspace_members pelo user_id
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    // Convite por token — remove de workspace_invites pelo id
    const { error } = await supabase
      .from('workspace_invites')
      .delete()
      .eq('id', memberId);
    if (error) throw error;
  }
}

/** Altera o role de um membro */
export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: 'editor' | 'viewer',
): Promise<void> {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId);
  if (error) throw error;
}

/** Renomeia o workspace (apenas owner pode) */
export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', workspaceId);
  if (error) throw error;
}

/** Carrega diagramas do workspace */
export async function loadWorkspaceDiagrams(workspaceId: string) {
  const { data, error } = await supabase
    .from('diagrams')
    .select('id, title, node_count, edge_count, updated_at, owner_id, workspace_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
