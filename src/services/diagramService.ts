import { supabase } from '@/integrations/supabase/client';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';
import { encryptDiagramData, decryptDiagramData } from '@/services/cryptoService';
import i18n from '@/i18n';
import { getErrorMessage } from '@/utils/getErrorMessage';

/** Compute a SHA-256 hash of the serialized nodes+edges for integrity checks */
async function computeContentHash(nodes: unknown[], edges: unknown[]): Promise<string> {
  const payload = JSON.stringify({ nodes, edges });
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Use Supabase generated type for rows
type DiagramRow = Tables<'diagrams'>;

export interface DiagramRecord {
  id: string;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  owner_id: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  /** F4-T1: Set when content_hash verification fails */
  integrityWarning?: string;
}

/** Convert a Supabase row into our typed DiagramRecord, decrypting if needed */
async function toDiagramRecord(row: DiagramRow): Promise<DiagramRecord> {
  // Decrypt nodes/edges if they are encrypted envelopes (backward-compat with plain arrays)
  const { nodes: rawNodes, edges: rawEdges } = await decryptDiagramData(
    row.nodes ?? [],
    row.edges ?? [],
  );

  const nodesParsed = DbDiagramNodesSchema.safeParse(rawNodes);
  const edgesParsed = DbDiagramEdgesSchema.safeParse(rawEdges);

  if (!nodesParsed.success) {
    throw new Error('Dados do diagrama corrompidos no banco de dados. ID: ' + row.id);
  }
  if (!edgesParsed.success) {
    throw new Error('Dados do diagrama corrompidos no banco de dados. ID: ' + row.id);
  }

  // T10: Verify content_hash integrity when available
  if (row.content_hash) {
    try {
      const recomputedHash = await computeContentHash(
        nodesParsed.data as unknown[],
        edgesParsed.data as unknown[],
      );
      if (recomputedHash !== row.content_hash) {
        console.warn(`[diagramService] content_hash mismatch for diagram ${row.id}. Expected: ${row.content_hash}, Got: ${recomputedHash}`);
        return {
          id: row.id,
          title: row.title,
          nodes: nodesParsed.data as DiagramNode[],
          edges: edgesParsed.data as DiagramEdge[],
          owner_id: row.owner_id,
          share_token: row.share_token,
          created_at: row.created_at,
          updated_at: row.updated_at,
          integrityWarning: `content_hash mismatch: expected ${row.content_hash}, got ${recomputedHash}`,
        };
      }
    } catch (hashErr) {
      console.warn(`[diagramService] Failed to verify content_hash for diagram ${row.id}:`, hashErr);
    }
  }

  return {
    id: row.id,
    title: row.title,
    nodes: nodesParsed.data as DiagramNode[],
    edges: edgesParsed.data as DiagramEdge[],
    owner_id: row.owner_id,
    share_token: row.share_token,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function saveDiagram(
  title: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  ownerId: string,
  existingId?: string,
  workspaceId?: string | null,
): Promise<DiagramRecord> {
  // T7: Try atomic save via edge function first, fallback to client-side flow
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('save-diagram', {
      body: {
        title,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        diagram_id: existingId,
        workspace_id: workspaceId,
      },
    });

    if (fnError) throw fnError;
    if (fnData?.error === 'DIAGRAM_LIMIT_EXCEEDED') {
      throw new Error('DIAGRAM_LIMIT_EXCEEDED');
    }
    if (fnData?.error) throw new Error(fnData.error);

    return {
      id: fnData.id,
      title: fnData.title,
      nodes,
      edges,
      owner_id: fnData.owner_id,
      share_token: fnData.share_token,
      created_at: fnData.created_at,
      updated_at: fnData.updated_at,
    };
  } catch (edgeFnErr: unknown) {
    // Re-throw limit error
    if (getErrorMessage(edgeFnErr) === 'DIAGRAM_LIMIT_EXCEEDED') throw edgeFnErr;
    console.warn('[diagramService] Edge function save failed, falling back to client-side:', getErrorMessage(edgeFnErr));
  }

  // ── Fallback: client-side encrypt + save ──
  const encrypted = await encryptDiagramData(
    JSON.parse(JSON.stringify(nodes)),
    JSON.parse(JSON.stringify(edges)),
  );

  if (existingId) {
    const contentHash = await computeContentHash(nodes, edges);
    const updatePayload: TablesUpdate<'diagrams'> = {
      title,
      nodes: encrypted.nodes as unknown as Tables<'diagrams'>['nodes'],
      edges: encrypted.edges as unknown as Tables<'diagrams'>['edges'],
      node_count: nodes.length,
      edge_count: edges.length,
      content_hash: contentHash,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('diagrams')
      .update(updatePayload)
      .eq('id', existingId)
      .eq('owner_id', ownerId)
      .select('id, title, owner_id, share_token, created_at, updated_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      nodes,
      edges,
      owner_id: data.owner_id,
      share_token: data.share_token,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  const contentHash = await computeContentHash(nodes, edges);
  const insertPayload: TablesInsert<'diagrams'> = {
    title,
    nodes: encrypted.nodes as unknown as Tables<'diagrams'>['nodes'],
    edges: encrypted.edges as unknown as Tables<'diagrams'>['edges'],
    node_count: nodes.length,
    edge_count: edges.length,
    content_hash: contentHash,
    owner_id: ownerId,
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  };
  const { data, error } = await supabase
    .from('diagrams')
    .insert(insertPayload)
    .select('id, title, owner_id, share_token, created_at, updated_at')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    nodes,
    edges,
    owner_id: data.owner_id,
    share_token: data.share_token,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function loadDiagramByToken(shareToken: string): Promise<DiagramRecord | null> {
  const { data, error } = await supabase
    .rpc('get_diagram_by_share_token', { token: shareToken });
  if (error || !data || data.length === 0) return null;
  return toDiagramRecord(data[0] as DiagramRow);
}

const PAGE_SIZE = 12;

// PERF-01: Concurrency limiter for parallel async operations
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      // SAFETY: nextIndex++ is atomic in the JS event loop —
      // the read + increment happens in a single synchronous tick before any await.
      // Do NOT refactor to separate read/increment across await boundaries.
      // @ref PRD-0028 F6-T3
      const index = nextIndex++;
      try {
        const value = await tasks[index]();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function loadUserDiagrams(
  userId: string,
  page = 0,
): Promise<{ diagrams: DiagramRecord[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (error) return { diagrams: [], hasMore: false };

  const tasks = (data || []).map((row) => () => toDiagramRecord(row));
  const settled = await withConcurrencyLimit(tasks, 4);

  const rows: DiagramRecord[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      rows.push(result.value);
    } else {
      console.warn('Diagrama corrompido ignorado:', result.reason);
    }
  }
  const hasMore = (data?.length ?? 0) === PAGE_SIZE;
  return { diagrams: rows, hasMore };
}

export async function loadDiagramById(id: string): Promise<DiagramRecord | null> {
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return toDiagramRecord(data);
}

export async function deleteDiagram(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from('diagrams')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

/**
 * Salva alterações em um diagrama compartilhado.
 *
 * CONTRATO DE SEGURANÇA: esta função NÃO verifica owner_id no lado
 * cliente intencionalmente. A autorização é delegada inteiramente
 * à política RLS da tabela `diagrams` no Supabase, que garante
 * que somente colaboradores autorizados possam executar UPDATE.
 *
 * Política RLS atual (tabela diagrams, operação UPDATE):
 *   USING:
 *     deleted_at IS NULL
 *     AND (
 *       owner_id = auth.uid()
 *       OR EXISTS (
 *         SELECT 1 FROM diagram_shares
 *         WHERE diagram_shares.diagram_id = diagrams.id
 *           AND diagram_shares.shared_with_id = auth.uid()
 *       )
 *     )
 *
 * WITH CHECK:
 *     owner_id = auth.uid()
 *     OR EXISTS (
 *       SELECT 1 FROM diagram_shares
 *       WHERE diagram_shares.diagram_id = diagrams.id
 *         AND diagram_shares.shared_with_id = auth.uid()
 *     )
 *
 * Ou seja: o UPDATE só é permitido se o diagrama NÃO está soft-deleted
 * E o usuário autenticado é o proprietário OU possui um registro
 * explícito em diagram_shares.
 *
 * Nunca remova esta nota sem auditar as políticas RLS primeiro.
 * Última auditoria: 21/03/2026 (PRD-18, Score 93/100).
 */
export async function saveSharedDiagram(
  diagramId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Promise<void> {
  // F2-T1: Use atomic edge function (same as saveDiagram)
  try {
    const { data, error } = await supabase.functions.invoke('save-diagram', {
      body: {
        title: '', // collaborators cannot change title — edge fn ignores for non-owners
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        diagram_id: diagramId,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return;
  } catch (edgeFnErr: unknown) {
    if (getErrorMessage(edgeFnErr) === 'Forbidden') {
      throw new Error('Você não tem permissão de edição neste diagrama.');
    }
    console.warn('[diagramService] Edge function save-shared failed, falling back:', getErrorMessage(edgeFnErr));
  }

  // Fallback: client-side encrypt+save
  const encrypted = await encryptDiagramData(
    JSON.parse(JSON.stringify(nodes)),
    JSON.parse(JSON.stringify(edges)),
  );
  const contentHash = await computeContentHash(nodes, edges);
  const updatePayload: TablesUpdate<'diagrams'> = {
    nodes: encrypted.nodes as unknown as Tables<'diagrams'>['nodes'],
    edges: encrypted.edges as unknown as Tables<'diagrams'>['edges'],
    content_hash: contentHash,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('diagrams')
    .update(updatePayload)
    .eq('id', diagramId);

  if (error) {
    throw new Error('Você não tem permissão de edição neste diagrama.');
  }
}

export async function renameDiagram(id: string, title: string, ownerId: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 100) {
    throw new Error('Título inválido: deve ter entre 1 e 100 caracteres');
  }
  const updatePayload: TablesUpdate<'diagrams'> = {
    title: trimmed,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('diagrams')
    .update(updatePayload)
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

export async function duplicateDiagram(id: string, ownerId: string): Promise<DiagramRecord> {
  const original = await loadDiagramById(id);
  if (!original) throw new Error('Diagrama original não encontrado');

  return saveDiagram(
    i18n.t('myDiagrams.copyOf', { title: original.title }),
    original.nodes,
    original.edges,
    ownerId,
  );
}

export async function shareDiagram(diagramId: string, ttlDays = 30): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('share-diagram', {
    body: { diagramId, ttlDays },
  });
  if (error || !data?.shareToken) return null;
  // Build the URL from the current origin so it works in any environment
  return `${window.location.origin}/diagram/${data.shareToken}`;
}
