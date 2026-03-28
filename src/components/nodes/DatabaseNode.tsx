import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Database } from 'lucide-react';
import type { DiagramNodeData } from '@/types/diagram';
import { useDiagramStore } from '@/store/diagramStore';
import { getDbColor } from '@/constants/databaseColors';

const DatabaseNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as DiagramNodeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label);
  const color = getDbColor(nodeData.subType);

  useEffect(() => {
    if (!editing) setLabel(nodeData.label);
  }, [nodeData.label, editing]);

  const handleDoubleClick = () => setEditing(true);
  const handleBlur = () => {
    setEditing(false);
    useDiagramStore.getState().setNodes(
      useDiagramStore.getState().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      )
    );
  };

  const handleStyle = { background: color, ...(selected ? {} : { opacity: 0, pointerEvents: 'none' as const }) };

  return (
    <div
      className={`relative min-w-[160px] rounded-lg border-2 bg-card p-3 shadow-md transition-all ${
        selected ? 'shadow-lg ring-2' : ''
      }`}
      style={{ borderColor: color, '--tw-ring-color': `${color}4D` } as React.CSSProperties}
    >
      <Handle id="top-target" type="target" position={Position.Top} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="top-source" type="source" position={Position.Top} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="left-target" type="target" position={Position.Left} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="left-source" type="source" position={Position.Left} className="!w-3 !h-3" style={handleStyle} />

      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md p-1.5" style={{ backgroundColor: `${color}26` }}>
          <Database className="h-4 w-4" style={{ color }} />
        </div>
        {editing ? (
          <input
            className="bg-transparent border-b text-sm font-semibold text-foreground outline-none w-full"
            style={{ borderColor: color }}
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{nodeData.subType || 'Oracle'}</div>

      <Handle id="bottom-target" type="target" position={Position.Bottom} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="right-target" type="target" position={Position.Right} className="!w-3 !h-3" style={handleStyle} />
      <Handle id="right-source" type="source" position={Position.Right} className="!w-3 !h-3" style={handleStyle} />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
export default DatabaseNode;
