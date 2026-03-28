import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDiagramStore } from '@/store/diagramStore';
import type { DiagramNode, DiagramNodeData, ExternalCategory, InternalDatabase } from '@/types/diagram';
import { normalizeInternalDb } from '@/types/diagram';
import { DATABASE_TYPES } from '@/constants/databaseColors';

interface NodePropertiesPanelProps {
  nodeId: string | null;
  onClose: () => void;
}

function NodePropertiesPanel({ nodeId, onClose }: NodePropertiesPanelProps) {
  const { t } = useTranslation();
  const nodes = useDiagramStore((s) => s.nodes);
  const setNodes = useDiagramStore((s) => s.setNodes);

  const node = nodes.find((n) => n.id === nodeId);
  const data = node?.data as unknown as DiagramNodeData | undefined;

  const [label, setLabel] = useState('');
  const [internalDbs, setInternalDbs] = useState<InternalDatabase[]>([]);
  const [internalSvcs, setInternalSvcs] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setLabel(data.label);
      setInternalDbs((data.internalDatabases || []).map(normalizeInternalDb));
      setInternalSvcs(data.internalServices || []);
    }
  }, [nodeId, data?.label]);

  if (!node || !data) return null;

  const updateNode = (updates: Partial<DiagramNodeData>) => {
    setNodes(
      nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n,
      ),
    );
  };

  const handleLabelChange = (value: string) => {
    setLabel(value);
    updateNode({ label: value });
  };

  const handleDbLabelChange = (index: number, value: string) => {
    const updated = [...internalDbs];
    updated[index] = { ...updated[index], label: value };
    setInternalDbs(updated);
    updateNode({ internalDatabases: updated });
  };

  const handleDbTypeChange = (index: number, value: string) => {
    const updated = [...internalDbs];
    updated[index] = { ...updated[index], dbType: value };
    setInternalDbs(updated);
    updateNode({ internalDatabases: updated });
  };

  const addDb = () => {
    const updated = [...internalDbs, { label: t('nodePanel.dbDefault', { n: internalDbs.length + 1 }), dbType: 'Oracle' }];
    setInternalDbs(updated);
    updateNode({ internalDatabases: updated });
  };

  const removeDb = (index: number) => {
    const updated = internalDbs.filter((_, i) => i !== index);
    setInternalDbs(updated);
    updateNode({ internalDatabases: updated });
  };

  const handleSvcChange = (index: number, value: string) => {
    const updated = [...internalSvcs];
    updated[index] = value;
    setInternalSvcs(updated);
    updateNode({ internalServices: updated });
  };

  const addSvc = () => {
    const updated = [...internalSvcs, t('nodePanel.libDefault', { n: internalSvcs.length + 1 })];
    setInternalSvcs(updated);
    updateNode({ internalServices: updated });
  };

  const removeSvc = (index: number) => {
    const updated = internalSvcs.filter((_, i) => i !== index);
    setInternalSvcs(updated);
    updateNode({ internalServices: updated });
  };

  const typeLabels: Record<string, string> = {
    service: t('nodePanel.typeService'),
    database: t('nodePanel.typeDatabase'),
    queue: t('nodePanel.typeQueue'),
    external: t('nodePanel.typeExternal'),
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-xl z-40 flex flex-col animate-in slide-in-from-right-5 duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{t('nodePanel.properties')}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={t('nodePanel.closePanel')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('nodePanel.type')}</Label>
          <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {typeLabels[node.type || ''] || node.type}
            {data.subType ? ` (${data.subType})` : ''}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('nodePanel.name')}</Label>
          <Input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {node.type === 'external' && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">{t('nodePanel.category')}</Label>
              <Select
                value={data.externalCategory || 'Other'}
                onValueChange={(val) => updateNode({ externalCategory: val as ExternalCategory })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['API', 'CDN', 'Auth', 'Payment', 'Storage', 'Analytics', 'Other'] as ExternalCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === 'service' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('nodePanel.internalDbs')}</Label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addDb} aria-label={t('nodePanel.addDb')}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {internalDbs.map((db, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Select value={db.dbType} onValueChange={(val) => handleDbTypeChange(i, val)}>
                    <SelectTrigger className="h-8 text-xs w-24 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATABASE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={db.label}
                    onChange={(e) => handleDbLabelChange(i, e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeDb(i)} aria-label={t('nodePanel.removeDb')}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('nodePanel.libraries')}</Label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addSvc} aria-label={t('nodePanel.addLibrary')}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {internalSvcs.map((svc, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    value={svc}
                    onChange={(e) => handleSvcChange(i, e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSvc(i)} aria-label={t('nodePanel.removeLibrary')}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(NodePropertiesPanel);
