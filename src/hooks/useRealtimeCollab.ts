import { useEffect, useRef, useCallback, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useDiagramStore } from '@/store/diagramStore';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';

const DEBOUNCE_MS = 300;

export interface Collaborator {
  userId: string;
  email: string;
  color: string;
}

// SEC-02: Zod schema for presence validation
const PresenceItemSchema = z.object({
  userId: z.string().min(1).max(64),
  email: z.string().email().max(254).optional(),
});

// QUA-02: Typed payload for DB realtime updates
interface DiagramUpdatePayload {
  id: string;
  title?: string;
  nodes: unknown;
  edges: unknown;
  updated_at?: string;
}

const AVATAR_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(142, 71%, 45%)',
  'hsl(319, 80%, 55%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 72%, 51%)',
];

export function useRealtimeCollab(shareToken: string | null, realtimeCollabEnabled = true) {
  const diagramId = useDiagramStore((s) => s.currentDiagramId);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dbChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // PERF-02: Track last broadcast content to avoid redundant sends
  const lastBroadcastRef = useRef<string>('');

  const broadcastChanges = useCallback(
    (nodes: DiagramNode[], edges: DiagramEdge[]) => {
      // saas0001: no-op when realtime collab is disabled
      if (!realtimeCollabEnabled || !channelRef.current || isRemoteUpdate.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const serialized = JSON.stringify({ nodes, edges });
        // PERF-02: Only broadcast if content actually changed
        if (serialized === lastBroadcastRef.current) return;
        lastBroadcastRef.current = serialized;

        channelRef.current?.send({
          type: 'broadcast',
          event: 'diagram_updated',
          payload: { nodes, edges },
        });
      }, DEBOUNCE_MS);
    },
    [realtimeCollabEnabled],
  );

  // Broadcast channel for live cursor-style updates
  useEffect(() => {
    // saas0001: realtime collab disabled on Free tier
    if (!shareToken || !realtimeCollabEnabled) return;

    const channel = supabase.channel(`diagram:${shareToken}`, {
      config: { presence: { key: 'user' } },
    });

    channel
      .on('broadcast', { event: 'diagram_updated' }, (payload) => {
        // SEC-03: Validate broadcast payload before applying
        const rawPayload = payload.payload as { nodes: unknown; edges: unknown };
        const nodesParsed = DbDiagramNodesSchema.safeParse(rawPayload.nodes);
        const edgesParsed = DbDiagramEdgesSchema.safeParse(rawPayload.edges);
        if (!nodesParsed.success || !edgesParsed.success) {
          console.warn('[RealtimeCollab] Invalid broadcast payload, ignoring', {
            nodesError: nodesParsed.success ? null : nodesParsed.error,
            edgesError: edgesParsed.success ? null : edgesParsed.error,
          });
          return;
        }

        isRemoteUpdate.current = true;

        const temporal = useDiagramStore.temporal.getState();
        temporal.pause();

        const store = useDiagramStore.getState();
        store.setNodes(nodesParsed.data as DiagramNode[]);
        store.setEdges(edgesParsed.data as DiagramEdge[]);

        temporal.resume();

        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 50);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: Collaborator[] = [];
        const seen = new Set<string>();
        // SEC-02: Validate each presence item
        Object.values(state).forEach((presences: unknown[]) => {
          (presences as unknown[]).forEach((p) => {
            const parsed = PresenceItemSchema.safeParse(p);
            if (!parsed.success) return;
            const { userId, email } = parsed.data;
            if (!seen.has(userId)) {
              seen.add(userId);
              users.push({
                userId,
                email: email || '',
                color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
              });
            }
          });
        });
        setCollaborators(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            await channel.track({
              userId: data.user.id,
              email: data.user.email || '',
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shareToken, realtimeCollabEnabled]);

  // PERF-03: Track last known updated_at to avoid unnecessary state updates
  const lastUpdatedAtRef = useRef<string>('');

  // Postgres Realtime channel: listen for DB-level updates on the current diagram
  useEffect(() => {
    if (!diagramId) return;

    const dbChannel = supabase
      .channel(`db-diagram:${diagramId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'diagrams',
          filter: `id=eq.${diagramId}`,
        },
        (payload) => {
          if (isRemoteUpdate.current) return;

          // QUA-02: Use typed payload
          const newRecord = payload.new as DiagramUpdatePayload;

          // PERF-03: Compare updated_at first to avoid expensive JSON operations
          const remoteUpdatedAt = newRecord.updated_at;
          if (remoteUpdatedAt && remoteUpdatedAt === lastUpdatedAtRef.current) {
            return;
          }
          lastUpdatedAtRef.current = remoteUpdatedAt || '';

          const remoteNodes = newRecord.nodes;
          const remoteEdges = newRecord.edges;

          // FIX: After save, DB stores encrypted envelopes (objects with iv/ciphertext).
          // Postgres Realtime delivers these raw encrypted objects. Pushing them into the
          // store would corrupt React Flow (expects arrays), causing "e is not iterable"
          // and a blank canvas. Skip the update when data is not a plain array.
          if (!Array.isArray(remoteNodes) || !Array.isArray(remoteEdges)) {
            console.debug('[RealtimeCollab] Skipping DB update with non-array (encrypted) data');
            return;
          }

          const store = useDiagramStore.getState();

          isRemoteUpdate.current = true;
          const temporal = useDiagramStore.temporal.getState();
          temporal.pause();

          store.setNodes(remoteNodes as DiagramNode[]);
          store.setEdges(remoteEdges as DiagramEdge[]);
          if (newRecord.title && newRecord.title !== store.diagramName) {
            store.setDiagramName(newRecord.title);
          }

          temporal.resume();
          setTimeout(() => {
            isRemoteUpdate.current = false;
          }, 50);
        },
      )
      .subscribe();

    dbChannelRef.current = dbChannel;

    return () => {
      supabase.removeChannel(dbChannel);
      dbChannelRef.current = null;
    };
  }, [diagramId]);

  return { broadcastChanges, isRemoteUpdate, collaborators };
}
