import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PROTOCOL_CONFIGS, type EdgeProtocol, type DiagramEdge, type DiagramEdgeData } from '@/types/diagram';

interface DiagramLegendProps {
  edges: DiagramEdge[];
}

function DiagramLegend({ edges }: DiagramLegendProps) {
  const { t } = useTranslation();
  const usedProtocols = useMemo(() => {
    const set = new Set<EdgeProtocol>();
    edges.forEach((e) => {
      const protocol = (e.data as DiagramEdgeData | undefined)?.protocol;
      if (protocol) set.add(protocol);
    });
    return set;
  }, [edges]);

  if (usedProtocols.size === 0) return null;

  const syncEntries = (Object.entries(PROTOCOL_CONFIGS) as [EdgeProtocol, typeof PROTOCOL_CONFIGS[EdgeProtocol]][])
    .filter(([key, c]) => !c.async && usedProtocols.has(key));
  const asyncEntries = (Object.entries(PROTOCOL_CONFIGS) as [EdgeProtocol, typeof PROTOCOL_CONFIGS[EdgeProtocol]][])
    .filter(([key, c]) => c.async && usedProtocols.has(key));

  return (
    <div className="absolute bottom-14 left-3 z-10 rounded-lg border bg-card/90 p-3 shadow-md backdrop-blur-sm text-xs">
      <div className="font-semibold text-foreground mb-2">{t('legend.protocols')}</div>
      <div className="flex gap-6">
        {syncEntries.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">{t('legend.sync')}</div>
            {syncEntries.map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 py-0.5">
                <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: config.color }} />
                <span className="text-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        )}
        {asyncEntries.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">{t('legend.async')}</div>
            {asyncEntries.map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 py-0.5">
                <span
                  className="inline-block h-0.5 w-5 rounded"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${config.color} 0px, ${config.color} 3px, transparent 3px, transparent 6px)`,
                  }}
                />
                <span className="text-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(DiagramLegend);
