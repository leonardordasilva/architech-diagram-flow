import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow, getNodesBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { toast } from '@/hooks/use-toast';
import { useDiagramStore } from '@/store/diagramStore';
import { exportToMermaid } from '@/services/exportService';

/** Filter out UI controls from image export */
const exportFilter = (domNode: HTMLElement) => {
  if (!domNode.classList) return true;
  const excludeClasses = [
    'react-flow__panel',
    'react-flow__controls',
    'react-flow__minimap',
    'react-flow__attribution',
    'export-exclude',
  ];
  for (const cls of excludeClasses) {
    if (domNode.classList.contains(cls)) return false;
  }
  return true;
};

/**
 * Calculate full diagram bounds by combining node bounds with actual rendered edge SVG paths.
 * This ensures edges that extend beyond nodes (e.g. top/bottom handles, offsets) are included.
 */
function getFullDiagramBounds(flowNodes: any[]) {
  const nodeBounds = getNodesBounds(flowNodes);
  let minX = nodeBounds.x;
  let minY = nodeBounds.y;
  let maxX = nodeBounds.x + nodeBounds.width;
  let maxY = nodeBounds.y + nodeBounds.height;

  // Find all rendered edge paths and compute their bounding boxes in flow space
  const edgeContainer = document.querySelector('.react-flow__edges');
  if (edgeContainer) {
    const paths = edgeContainer.querySelectorAll('path[d]');
    paths.forEach((path) => {
      try {
        const svgPath = path as SVGPathElement;
        if (typeof svgPath.getBBox !== 'function') return;
        // Skip invisible hit-area paths (stroke="transparent")
        const stroke = svgPath.getAttribute('stroke');
        if (stroke === 'transparent' || stroke === 'none') return;
        const bbox = svgPath.getBBox();
        if (bbox.width === 0 && bbox.height === 0) return;
        if (bbox.x < minX) minX = bbox.x;
        if (bbox.y < minY) minY = bbox.y;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      } catch {
        // getBBox can throw on hidden elements
      }
    });
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Applies a "Made with MicroFlow Architect" watermark to a PNG data URL */
async function applyWatermark(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#888888';
      ctx.font = `bold ${Math.max(12, Math.round(img.height * 0.02))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const padding = Math.round(img.width * 0.015);
      ctx.fillText('Made with MicroFlow Architect', img.width - padding, img.height - padding);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

export function useExportHandlers(darkMode: boolean, watermarkEnabled = false) {
  const { t } = useTranslation();
  const { getNodes: getFlowNodes } = useReactFlow();
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const exportJSON = useDiagramStore((s) => s.exportJSON);

  const handleExportPNG = useCallback(async () => {
    const flowNodes = getFlowNodes();
    if (flowNodes.length === 0) return;
    const bounds = getFullDiagramBounds(flowNodes);
    const padding = 20;
    const imageWidth = Math.ceil(bounds.width + padding * 2);
    const imageHeight = Math.ceil(bounds.height + padding * 2);
    const translateX = -bounds.x + padding;
    const translateY = -bounds.y + padding;

    const el = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: darkMode ? '#0f1520' : '#f5f7fa',
        filter: exportFilter,
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${translateX}px, ${translateY}px) scale(1)`,
        },
      });
      const finalUrl = watermarkEnabled ? await applyWatermark(dataUrl) : dataUrl;
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = `${diagramName || 'diagram'}.png`;
      a.click();
      toast({ title: t('export.pngSuccess') });
    } catch {
      toast({ title: t('export.pngError'), variant: 'destructive' });
    }
  }, [darkMode, diagramName, getFlowNodes, watermarkEnabled]);

  const handleExportSVG = useCallback(async () => {
    const flowNodes = getFlowNodes();
    if (flowNodes.length === 0) return;
    const bounds = getFullDiagramBounds(flowNodes);
    const padding = 20;
    const imageWidth = Math.ceil(bounds.width + padding * 2);
    const imageHeight = Math.ceil(bounds.height + padding * 2);
    const translateX = -bounds.x + padding;
    const translateY = -bounds.y + padding;

    const el = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toSvg(el, {
        backgroundColor: darkMode ? '#0f1520' : '#f5f7fa',
        filter: exportFilter,
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${translateX}px, ${translateY}px) scale(1)`,
        },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${diagramName || 'diagram'}.svg`;
      a.click();
      toast({ title: t('export.svgSuccess') });
    } catch {
      toast({ title: t('export.svgError'), variant: 'destructive' });
    }
  }, [darkMode, diagramName, getFlowNodes]);

  const handleExportMermaid = useCallback(() => {
    return exportToMermaid(nodes, edges);
  }, [nodes, edges]);

  const handleExportJSON = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName || 'diagram'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('export.jsonSuccess') });
  }, [exportJSON, diagramName]);

  return { handleExportPNG, handleExportSVG, handleExportMermaid, handleExportJSON };
}
