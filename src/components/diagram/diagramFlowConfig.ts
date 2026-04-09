import ServiceNode from '@/components/nodes/ServiceNode';
import DatabaseNode from '@/components/nodes/DatabaseNode';
import QueueNode from '@/components/nodes/QueueNode';
import ExternalNode from '@/components/nodes/ExternalNode';
import EditableEdge from '@/components/edges/EditableEdge';

/** Node type map — defined outside component to prevent re-creation on each render */
export const nodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  external: ExternalNode,
};

/** Edge type map */
export const edgeTypes = { editable: EditableEdge };

/** Static minimap color map */
export const MINIMAP_NODE_COLORS: Record<string, string> = {
  service: 'hsl(217, 91%, 60%)',
  database: 'hsl(142, 71%, 45%)',
  queue: 'hsl(45, 93%, 47%)',
  external: 'hsl(220, 9%, 46%)',
};

/** Default edge options */
export const defaultEdgeOptions = {
  type: 'editable',
  animated: true,
  style: { strokeWidth: 2 },
  data: { waypoints: undefined },
};
