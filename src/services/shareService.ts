import { supabase } from '@/integrations/supabase/client';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';
import { decryptDiagramData } from '@/services/cryptoService';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';

export interface ShareRecord {
  id: string;
  diagram_id: string;
  owner_id: string;
  shared_with_id: string;
  created_at: string;
  shared_with_email?: string;
}

/** Search users by email (partial match), excluding a specific user.
 *  I7: Delegates to the search_users_by_email RPC which enforces the ≥3-char
 *  minimum server-side, preventing enumeration via direct PostgREST access. */
export async function searchUsersByEmail(
  query: string,
  excludeUserId: string,
): Promise<{ id: string; email: string }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return []; // client-side short-circuit before network call
  const { data, error } = await supabase.rpc('search_users_by_email', {
    p_query: trimmed,
    p_exclude_user_id: excludeUserId,
  });
  if (error || !data) return [];
  return data as { id: string; email: string }[];
}


export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Share a diagram with a user by email */
export async function shareDiagramWithUser(
  diagramId: string,
  ownerId: string,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('diagram_shares')
    .insert({
      diagram_id: diagramId,
      owner_id: ownerId,
      shared_with_id: targetUserId,
    });
  if (error) {
    if (error.code === '23505') throw new Error('Este usuário já tem acesso a este diagrama.');
    throw error;
  }
}

/** List shares for a diagram (owner view) */
export async function listDiagramShares(diagramId: string): Promise<ShareRecord[]> {
  const { data, error } = await supabase
    .from('diagram_shares')
    .select('*')
    .eq('diagram_id', diagramId)
    .order('created_at', { ascending: false });
  if (error) return [];

  // Enrich with emails
  const userIds = (data || []).map((s: any) => s.shared_with_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  const emailMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));

  // I4: Warn if any share references a deleted user (orphaned record).
  // RLS should prevent this, but log it for observability.
  const orphaned = (data || []).filter((s: any) => !emailMap.has(s.shared_with_id));
  if (orphaned.length > 0) {
    console.warn('[shareService] Orphaned share records (user deleted?):', orphaned.map((s: any) => s.id));
  }

  return (data || []).map((s: any) => ({
    ...s,
    shared_with_email: emailMap.get(s.shared_with_id) || 'Desconhecido',
  })) as ShareRecord[];
}

/** Revoke share */
export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('diagram_shares')
    .delete()
    .eq('id', shareId);
  if (error) throw error;
}

/** Load diagrams shared with current user */
export async function loadSharedWithMe(userId: string): Promise<
  { diagram_id: string; title: string; owner_email: string; updated_at: string; nodes: DiagramNode[]; edges: DiagramEdge[] }[]
> {
  const { data: shares, error } = await supabase
    .from('diagram_shares')
    .select('diagram_id, owner_id')
    .eq('shared_with_id', userId);
  if (error || !shares || shares.length === 0) return [];

  const diagramIds = shares.map((s: any) => s.diagram_id);
  const ownerIds = [...new Set(shares.map((s: any) => s.owner_id))];

  const [{ data: diagrams }, { data: profiles }] = await Promise.all([
    supabase.from('diagrams').select('id, title, updated_at, nodes, edges, owner_id').in('id', diagramIds),
    supabase.from('profiles').select('id, email').in('id', ownerIds),
  ]);

  const emailMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));

  const results: { diagram_id: string; title: string; owner_email: string; updated_at: string; nodes: DiagramNode[]; edges: DiagramEdge[] }[] = [];

  for (const d of (diagrams || []) as any[]) {
    try {
      // Decrypt nodes/edges (handles both encrypted envelopes and plain arrays)
      const { nodes: rawNodes, edges: rawEdges } = await decryptDiagramData(
        d.nodes ?? [],
        d.edges ?? [],
      );

      // Validate with Zod schemas
      const nodesParsed = DbDiagramNodesSchema.safeParse(rawNodes);
      const edgesParsed = DbDiagramEdgesSchema.safeParse(rawEdges);

      if (!nodesParsed.success || !edgesParsed.success) {
        console.warn(`Diagrama compartilhado corrompido ignorado (ID: ${d.id})`);
        continue;
      }

      results.push({
        diagram_id: d.id,
        title: d.title,
        owner_email: emailMap.get(d.owner_id) || 'Desconhecido',
        updated_at: d.updated_at,
        nodes: nodesParsed.data as DiagramNode[],
        edges: edgesParsed.data as DiagramEdge[],
      });
    } catch (err) {
      console.warn(`Falha ao descriptografar diagrama compartilhado (ID: ${d.id}):`, err);
    }
  }

  return results;
}
