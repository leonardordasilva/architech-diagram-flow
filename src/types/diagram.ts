import type { Node, Edge } from '@xyflow/react';
import type { z } from 'zod';
import type { NodeSchema, EdgeSchema } from '@/schemas/diagramSchema';

/** Tipo de persistência: estrutura validada pelo Zod e salva no banco */
export type PersistedNode = z.infer<typeof NodeSchema>;
export type PersistedEdge = z.infer<typeof EdgeSchema>;

export type NodeType = 'service' | 'database' | 'queue' | 'external';

export type EdgeProtocol =
  | 'REST'
  | 'gRPC'
  | 'GraphQL'
  | 'WebSocket'
  | 'Kafka'
  | 'AMQP'
  | 'MQTT'
  | 'HTTPS'
  | 'TCP'
  | 'UDP'
  | 'SQL';

// ProtocolConfig and PROTOCOL_CONFIGS moved to src/constants/protocolConfigs.ts
// Re-export for backwards compat
export { PROTOCOL_CONFIGS, type ProtocolConfig } from '@/constants/protocolConfigs';

export type ExternalCategory = 'API' | 'CDN' | 'Auth' | 'Payment' | 'Storage' | 'Analytics' | 'Other';

export interface InternalDatabase {
  label: string;
  dbType: string;
}

export function normalizeInternalDb(item: string | InternalDatabase): InternalDatabase {
  if (typeof item === 'string') return { label: item, dbType: 'Oracle' };
  return item;
}

export interface DiagramNodeData {
  label: string;
  type: NodeType;
  subType?: string;
  externalCategory?: ExternalCategory;
  internalDatabases?: (string | InternalDatabase)[];
  internalServices?: string[];
  [key: string]: unknown;
}

export interface ControlPoint {
  x: number;
  y: number;
}

export interface DiagramEdgeData {
  waypoints?: ControlPoint[];
  protocol?: EdgeProtocol;
  [key: string]: unknown;
}

export type DiagramNode = Node<DiagramNodeData>;
export type DiagramEdge = Edge<DiagramEdgeData>;

export interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  diagramName: string;
}

// HistoryEntry removed — no longer used in the codebase
