import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Mail, MessageSquare, Radio } from 'lucide-react';
import type { DiagramNodeData } from '@/types/diagram';
import { useDiagramStore } from '@/store/diagramStore';

const QUEUE_ICONS: Record<string, React.ElementType> = {
  'IBM MQ': Mail,
  Kafka: Radio,
  RabbitMQ: MessageSquare,
};

const QueueNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as DiagramNodeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label);

  useEffect(() => {
    if (!editing) setLabel(nodeData.label);
  }, [nodeData.label, editing]);
  const queueType = nodeData.subType || 'MQ';
  const Icon = QUEUE_ICONS[queueType] || Mail;

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
      className={`relative min-w-[160px] rounded-lg border-2 border-[hsl(var(--node-queue))] bg-card p-3 shadow-md transition-all ${
        selected ? 'shadow-lg ring-2 ring-[hsl(var(--node-queue))]/30' : ''
      }`}
    >
      <Handle id="top-target" type="target" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="top-source" type="source" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-target" type="target" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-source" type="source" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />

      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-[hsl(var(--node-queue))]/15 p-1.5">
          <Icon className="h-4 w-4 text-[hsl(var(--node-queue))]" />
        </div>
        {editing ? (
          <input
            className="bg-transparent border-b border-[hsl(var(--node-queue))] text-sm font-semibold text-foreground outline-none w-full"
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{queueType}</div>

      <Handle id="bottom-target" type="target" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-target" type="target" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-source" type="source" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-queue))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
export default QueueNode;
