import { supabase } from '@/integrations/supabase/client';
import type { PersistedNode, PersistedEdge } from '@/types/diagram';

interface EncryptedEnvelope {
  iv: string;
  ciphertext: string;
}

interface CryptoResponse {
  nodes: unknown;
  edges: unknown;
}

/**
 * Encrypts nodes and edges via the backend Edge Function.
 * Returns the encrypted envelopes to be stored in the database.
 */
export async function encryptDiagramData(
  nodes: PersistedNode[],
  edges: PersistedEdge[],
): Promise<{ nodes: EncryptedEnvelope; edges: EncryptedEnvelope }> {
  const { data, error } = await supabase.functions.invoke<CryptoResponse>('diagram-crypto', {
    body: { action: 'encrypt', nodes, edges },
  });
  if (error || !data) {
    throw new Error('Falha ao criptografar dados do diagrama');
  }
  return data as { nodes: EncryptedEnvelope; edges: EncryptedEnvelope };
}

/**
 * Decrypts nodes and edges via the backend Edge Function.
 * Handles backward compatibility: if data is not encrypted, returns as-is.
 */
export async function decryptDiagramData(
  nodes: unknown,
  edges: unknown,
): Promise<{ nodes: PersistedNode[]; edges: PersistedEdge[] }> {
  // If both are plain arrays, skip the round-trip
  if (Array.isArray(nodes) && Array.isArray(edges)) {
    return { nodes: nodes as PersistedNode[], edges: edges as PersistedEdge[] };
  }

  const { data, error } = await supabase.functions.invoke<CryptoResponse>('diagram-crypto', {
    body: { action: 'decrypt', nodes, edges },
  });
  if (error || !data) {
    throw new Error('Falha ao descriptografar dados do diagrama');
  }
  return data as { nodes: PersistedNode[]; edges: PersistedEdge[] };
}
