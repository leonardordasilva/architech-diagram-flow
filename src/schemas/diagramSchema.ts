import { z } from 'zod';

const NODE_TYPES = ['service', 'database', 'queue', 'external'] as const;

const EDGE_PROTOCOLS = [
  'REST', 'gRPC', 'GraphQL', 'WebSocket',
  'Kafka', 'AMQP', 'MQTT', 'HTTPS', 'TCP', 'UDP', 'SQL',
] as const;

const EXTERNAL_CATEGORIES = [
  'API', 'CDN', 'Auth', 'Payment', 'Storage', 'Analytics', 'Other',
] as const;

const InternalItemSchema = z.union([
  z.string().min(1),
  z.object({ label: z.string(), dbType: z.string() }),
  z.object({ id: z.string(), label: z.string() }).transform((obj) => obj.label),
  z.object({ label: z.string() }).transform((obj) => obj.label),
]);

export const NodeSchema = z.object({
  id: z.string().min(1, 'Node id é obrigatório'),
  type: z.enum(NODE_TYPES, { errorMap: () => ({ message: `Tipo de nó deve ser: ${NODE_TYPES.join(', ')}` }) }),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string().min(1, 'Label é obrigatório').max(100, 'Label deve ter no máximo 100 caracteres'),
    type: z.enum(NODE_TYPES),
    subType: z.string().optional(),
    externalCategory: z.enum(EXTERNAL_CATEGORIES).optional(),
    internalDatabases: z.array(InternalItemSchema).optional(),
    internalServices: z.array(InternalItemSchema).optional(),
  }),
}).passthrough();

export const EdgeSchema = z.object({
  id: z.string().min(1, 'Edge id é obrigatório'),
  source: z.string().min(1, 'Source é obrigatório'),
  target: z.string().min(1, 'Target é obrigatório'),
  data: z.object({
    protocol: z.enum(EDGE_PROTOCOLS).optional(),
  }).optional(),
}).passthrough();

export const ImportDiagramSchema = z.object({
  nodes: z.array(NodeSchema).min(1, 'O diagrama deve ter pelo menos 1 nó'),
  edges: z.array(EdgeSchema),
  name: z.string().optional(),
});

export type ImportDiagramInput = z.infer<typeof ImportDiagramSchema>;

/** Schemas for database rows (no min(1) constraint on nodes) */
export const DbDiagramNodesSchema = z.array(NodeSchema);
export const DbDiagramEdgesSchema = z.array(EdgeSchema);
