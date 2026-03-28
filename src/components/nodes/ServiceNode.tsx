import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Database, Server, Library } from 'lucide-react';
import type { DiagramNodeData } from '@/types/diagram';
import { normalizeInternalDb } from '@/types/diagram';
import { useDiagramStore } from '@/store/diagramStore';
import { getDbColor } from '@/constants/databaseColors';
import { useTranslation } from 'react-i18next';

function EditableDbItem({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    onChange(text);
  };

  return editing ? (
    <input
      className="bg-transparent border-b border-[hsl(var(--node-database))] text-xs text-foreground outline-none w-full ml-1"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      autoFocus
    />
  ) : (
    <span className="cursor-pointer truncate" onDoubleClick={() => setEditing(true)}>
      {value}
    </span>
  );
}

const ServiceNode = memo(({ data, id, selected }: NodeProps) => {
  const nodeData = data as unknown as DiagramNodeData;
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label);

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

  const handleDbRename = (index: number, newName: string) => {
    const currentDbs = (nodeData.internalDatabases ?? []).map(normalizeInternalDb);
    const updated = currentDbs.map((db, i) => (i === index ? { ...db, label: newName } : db));
    useDiagramStore.getState().setNodes(
      useDiagramStore.getState().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, internalDatabases: updated } } : n
      )
    );
  };

  const handleSvcRename = (index: number, newName: string) => {
    const currentSvcs = nodeData.internalServices ?? [];
    const updated = currentSvcs.map((svc, i) => (i === index ? newName : svc));
    useDiagramStore.getState().setNodes(
      useDiagramStore.getState().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, internalServices: updated } } : n
      )
    );
  };

  return (
    <div
      className={`relative min-w-[160px] rounded-lg border-2 border-[hsl(var(--node-service))] bg-card p-3 shadow-md transition-all ${
        selected ? 'shadow-lg ring-2 ring-[hsl(var(--node-service))]/30' : ''
      }`}
    >
      <Handle id="top-target" type="target" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="top-source" type="source" position={Position.Top} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-target" type="target" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="left-source" type="source" position={Position.Left} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-target" type="target" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />
      <Handle id="right-source" type="source" position={Position.Right} className={`!w-3 !h-3 !bg-[hsl(var(--node-service))] ${selected ? '' : '!opacity-0 !pointer-events-none'}`} />

      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-[hsl(var(--node-service))]/15 p-1.5">
          <Box className="h-4 w-4 text-[hsl(var(--node-service))]" />
        </div>
        {editing ? (
          <input
            className="bg-transparent border-b border-[hsl(var(--node-service))] text-sm font-semibold text-foreground outline-none w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-semibold text-foreground cursor-pointer truncate"
            onDoubleClick={handleDoubleClick}
          >
            {label}
          </span>
        )}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {t('nodes.service')}
      </div>

      {nodeData.internalDatabases && nodeData.internalDatabases.length > 0 && (
        <div className="mt-2 space-y-1">
          {nodeData.internalDatabases.map((rawDb, i) => {
            const db = normalizeInternalDb(rawDb);
            return (
              <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Database className="h-3 w-3" style={{ color: getDbColor(db.dbType) }} />
                <EditableDbItem value={db.label} onChange={(v) => handleDbRename(i, v)} />
              </div>
            );
          })}
        </div>
      )}

      {nodeData.internalServices && nodeData.internalServices.length > 0 && (
        <div className="mt-2 space-y-1">
          {nodeData.internalServices.map((svc, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
              <Library className="h-3 w-3 text-[hsl(var(--node-service))]" />
              <EditableDbItem value={svc} onChange={(v) => handleSvcRename(i, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
export default ServiceNode;
