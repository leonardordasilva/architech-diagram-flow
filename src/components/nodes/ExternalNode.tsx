import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, Wifi, Share2, Lock, Hexagon, CreditCard, Database, BarChart3, Shield, Box } from 'lucide-react';
import type { DiagramNodeData, ExternalCategory } from '@/types/diagram';
import { useDiagramStore } from '@/store/diagramStore';

const CATEGORY_ICONS: Record<ExternalCategory, React.ElementType> = {
  API: Globe,
  CDN: Wifi,
  Auth: Shield,
  Payment: CreditCard,
  Storage: Database,
  Analytics: BarChart3,
  Other: Box,
};

// Legacy fallback for subType-based icons
const PROTOCOL_ICONS: Record<string, React.ElementType> = {
  REST: Globe,
  gRPC: Hexagon,
  GraphQL: Share2,
  WebSocket: Wifi,
  HTTPS: Lock,
};

const ExternalNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as DiagramNodeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label);

  useEffect(() => {
    if (!editing) setLabel(nodeData.label);
  }, [nodeData.label, editing]);
  const category = nodeData.externalCategory;
  const protocol = nodeData.subType || 'REST';

  // Use category icon if set, otherwise fallback to legacy protocol icon
  const Icon = category ? (CATEGORY_ICONS[category] || Globe) : (PROTOCOL_ICONS[protocol] || Globe);
  const displayLabel = category || protocol;

  const handleDoubleClick = () => setEditing(true);
  const handleBlur = () => {
    setEditing(false);
    useDiagramStore.getState().setNodes(
      useDiagramStore.getState().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      )
    );
  };

  return (
    <div
      className={`relative min-w-[160px] rounded-lg border-2 border-dashed border-[hsl(var(--node-external))] bg-card p-3 shadow-md transition-all ${
        selected ? 'shadow-lg ring-2 ring-[hsl(var(--node-external))]/30' : ''
      }`}
    >
      <Handle id="top-target" type="target" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="top-source" type="source" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-target" type="target" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-source" type="source" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />

      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-[hsl(var(--node-external))]/15 p-1.5">
          <Icon className="h-4 w-4 text-[hsl(var(--node-external))]" />
        </div>
        {editing ? (
          <input
            className="bg-transparent border-b border-[hsl(var(--node-external))] text-sm font-semibold text-foreground outline-none w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            autoFocus
          />
        ) : (
          <span className="text-sm font-semibold text-foreground cursor-pointer truncate" onDoubleClick={handleDoubleClick}>
            {label}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{displayLabel}</div>

      <Handle id="bottom-target" type="target" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-target" type="target" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-source" type="source" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-external))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
    </div>
  );
});

ExternalNode.displayName = 'ExternalNode';
export default ExternalNode;
