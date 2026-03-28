import { useCallback, useRef } from 'react';
import {
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { PROTOCOL_CONFIGS, type EdgeProtocol, type NodeType } from '@/types/diagram';
import { getDbColor } from '@/constants/databaseColors';

interface Point {
  x: number;
  y: number;
}

function getSourceNodeColor(sourceNodeType?: NodeType, sourceNodeSubType?: string): string | undefined {
  switch (sourceNodeType) {
    case 'service':
      return 'hsl(217, 91%, 60%)';
    case 'database':
      return getDbColor(sourceNodeSubType);
    case 'queue':
      return 'hsl(157, 52%, 49%)';
    case 'external':
      return 'hsl(220, 9%, 46%)';
    default:
      return undefined;
  }
}

interface EditableEdgeData {
  midOffsetX?: number;
  sourceOffsetY?: number;
  targetOffsetY?: number;
  protocol?: EdgeProtocol;
  sourceNodeType?: NodeType;
  sourceNodeSubType?: string;
  isQueueConnection?: boolean;
  [key: string]: unknown;
}

function buildOrthogonalPath(points: Point[]): string {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function buildSegmentPath(a: Point, b: Point): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function isVerticalSegment(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1;
}

type DragAxis = 'x' | 'y';
type SegmentRole = 'midX' | 'sourceY' | 'targetY';

export default function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  label,
  labelStyle,
  data,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const draggingRef = useRef<{
    startSvg: Point;
    initialOffsetSourceY: number;
    initialOffsetTargetY: number;
    initialOffsetMidX: number;
    axis: DragAxis;
    mode: 'horizontal' | 'vertical';
    locked: boolean; // true when sourceOffsetY === targetOffsetY at drag start
  } | null>(null);

  const edgeData = data as EditableEdgeData | undefined;

  const protocol = edgeData?.protocol;
  const protocolConfig = protocol ? PROTOCOL_CONFIGS[protocol] : undefined;
  const isQueueConn = edgeData?.isQueueConnection ?? edgeData?.sourceNodeType === 'queue';
  const sourceColor = isQueueConn ? 'hsl(157, 52%, 49%)' : getSourceNodeColor(edgeData?.sourceNodeType, edgeData?.sourceNodeSubType);

  // Offsets
  const midOffsetX = edgeData?.midOffsetX ?? (edgeData as any)?.midOffset ?? 0;
  const sourceOffsetY = edgeData?.sourceOffsetY ?? 0;
  const targetOffsetY = edgeData?.targetOffsetY ?? 0;
  // Check if visually aligned (actual rendered Y positions, not just offsets)
  const rawLocked = !!(edgeData as any)?.offsetsLocked;
  const visuallyAligned = rawLocked && Math.abs((sourceY + sourceOffsetY) - (targetY + targetOffsetY)) < 2;
  const offsetsLockedRef = useRef(visuallyAligned);
  offsetsLockedRef.current = visuallyAligned;

  const defaultMx = (sourceX + targetX) / 2;
  const mx = defaultMx + midOffsetX;

  const sy = sourceY + sourceOffsetY;
  const ty = targetY + targetOffsetY;

  // When nodes are nearly vertically aligned and no manual midOffset, use straight vertical path
  const VERTICAL_SNAP = 20;
  const isVerticallyAligned = Math.abs(sourceX - targetX) < VERTICAL_SNAP && Math.abs(midOffsetX) < 1;

  const rawPoints: Point[] = [];
  if (isVerticallyAligned && Math.abs(sourceOffsetY) < 1 && Math.abs(targetOffsetY) < 1) {
    // Straight vertical line — snap both to center X
    const cx = (sourceX + targetX) / 2;
    rawPoints.push({ x: cx, y: sourceY });
    rawPoints.push({ x: cx, y: targetY });
  } else {
    // Build 5-segment orthogonal path
    rawPoints.push({ x: sourceX, y: sourceY });
    if (Math.abs(sourceOffsetY) > 0.5) {
      rawPoints.push({ x: sourceX, y: sy });
    }
    rawPoints.push({ x: mx, y: sy });
    rawPoints.push({ x: mx, y: ty });
    if (Math.abs(targetOffsetY) > 0.5) {
      rawPoints.push({ x: targetX, y: ty });
    }
    rawPoints.push({ x: targetX, y: targetY });
  }

  // Deduplicate consecutive points
  const allPoints: Point[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = allPoints[allPoints.length - 1];
    if (Math.abs(rawPoints[i].x - prev.x) > 0.5 || Math.abs(rawPoints[i].y - prev.y) > 0.5) {
      allPoints.push(rawPoints[i]);
    }
  }
  if (allPoints.length < 2) {
    allPoints.length = 0;
    allPoints.push({ x: sourceX, y: sourceY }, { x: targetX, y: targetY });
  }

  // Ensure final segment has enough length for arrow orientation
  const MIN_ARROW_SEG = 8;
  if (allPoints.length >= 2) {
    const last = allPoints[allPoints.length - 1];
    const prev = allPoints[allPoints.length - 2];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_ARROW_SEG && len > 0) {
      const scale = MIN_ARROW_SEG / len;
      allPoints[allPoints.length - 2] = {
        x: last.x - dx * scale,
        y: last.y - dy * scale,
      };
    }
  }

  const edgePath = buildOrthogonalPath(allPoints);

  const midIdx = Math.floor(allPoints.length / 2);
  const labelX = (allPoints[midIdx - 1].x + allPoints[midIdx].x) / 2;
  const labelY2 = (allPoints[midIdx - 1].y + allPoints[midIdx].y) / 2;

  const handleSegmentPointerDown = useCallback(
    (role: SegmentRole) =>
      (evt: React.PointerEvent) => {
        evt.preventDefault();
        evt.stopPropagation();

        const svg = (evt.target as Element).closest('svg') as SVGSVGElement;
        if (!svg) return;

        const ctm = svg.getScreenCTM()?.inverse();
        if (!ctm) return;

        const startPt = svg.createSVGPoint();
        startPt.x = evt.clientX;
        startPt.y = evt.clientY;
        const startSvg = startPt.matrixTransform(ctm);

        draggingRef.current = {
          startSvg: { x: startSvg.x, y: startSvg.y },
          initialOffsetSourceY: sourceOffsetY,
          initialOffsetTargetY: targetOffsetY,
          initialOffsetMidX: midOffsetX,
          axis: role === 'midX' ? 'x' : 'y',
          mode: role === 'midX' ? 'horizontal' : 'vertical',
          locked: offsetsLockedRef.current,
        };

        const currentRole = role;

        const onMove = (e: PointerEvent) => {
          if (!draggingRef.current) return;

          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const currentCtm = svg.getScreenCTM()?.inverse();
          if (!currentCtm) return;
          const svgPt = pt.matrixTransform(currentCtm);

          if (currentRole === 'midX') {
            const dx = svgPt.x - draggingRef.current.startSvg.x;
            const newMidX = draggingRef.current.initialOffsetMidX + dx;
            setEdges((edges) =>
              edges.map((edge) =>
                edge.id === id ? { ...edge, data: { ...edge.data, midOffsetX: newMidX } } : edge
              )
            );
          } else {
            const dy = svgPt.y - draggingRef.current.startSvg.y;
            const SNAP_THRESHOLD = 8;

            // If locked (were aligned at drag start), move both together
            if (draggingRef.current.locked) {
              const newSourceY = draggingRef.current.initialOffsetSourceY + dy;
              const newTargetY = draggingRef.current.initialOffsetTargetY + dy;
              setEdges((edges) =>
                edges.map((edge) =>
                  edge.id === id ? { ...edge, data: { ...edge.data, sourceOffsetY: newSourceY, targetOffsetY: newTargetY } } : edge
                )
              );
            } else if (currentRole === 'sourceY') {
              const newSourceY = draggingRef.current.initialOffsetSourceY + dy;
              setEdges((edges) =>
                edges.map((edge) => {
                  if (edge.id !== id) return edge;
                  const curTargetY = (edge.data as any)?.targetOffsetY ?? 0;
                  if (Math.abs(newSourceY - curTargetY) < SNAP_THRESHOLD) {
                    return { ...edge, data: { ...edge.data, sourceOffsetY: curTargetY, targetOffsetY: curTargetY, offsetsLocked: true } };
                  }
                  return { ...edge, data: { ...edge.data, sourceOffsetY: newSourceY } };
                })
              );
            } else {
              const newTargetY = draggingRef.current.initialOffsetTargetY + dy;
              setEdges((edges) =>
                edges.map((edge) => {
                  if (edge.id !== id) return edge;
                  const curSourceY = (edge.data as any)?.sourceOffsetY ?? 0;
                  if (Math.abs(newTargetY - curSourceY) < SNAP_THRESHOLD) {
                    return { ...edge, data: { ...edge.data, sourceOffsetY: curSourceY, targetOffsetY: curSourceY, offsetsLocked: true } };
                  }
                  return { ...edge, data: { ...edge.data, targetOffsetY: newTargetY } };
                })
              );
            }
          }
        };

        const onUp = () => {
          draggingRef.current = null;
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      },
    [id, setEdges, sourceOffsetY, targetOffsetY, midOffsetX]
  );

  // Build per-segment hit areas
  const segments: React.ReactNode[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const a = allPoints[i];
    const b = allPoints[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 2) continue;

    const vertical = isVerticalSegment(a, b);
    // Determine role: vertical segments move midX; horizontal segments near source move sourceY, near target move targetY
    let role: SegmentRole;
    if (vertical) {
      role = 'midX';
    } else {
      // If segment center is closer to source, it's sourceY; otherwise targetY
      const segCenterX = (a.x + b.x) / 2;
      role = Math.abs(segCenterX - sourceX) < Math.abs(segCenterX - targetX) ? 'sourceY' : 'targetY';
    }
    const cursor = vertical ? 'ew-resize' : 'ns-resize';

    segments.push(
      <path
        key={`seg-${i}`}
        d={buildSegmentPath(a, b)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor }}
        onPointerDown={handleSegmentPointerDown(role)}
      />
    );
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          ...style,
          pointerEvents: 'none',
          ...(sourceColor ? { stroke: sourceColor } : {}),
          ...(isQueueConn ? { strokeDasharray: '8 4' } : {}),
          ...(protocolConfig ? {
            stroke: protocolConfig.color,
            strokeDasharray: protocolConfig.dashArray || undefined,
          } : {}),
        }}
        labelX={labelX}
        labelY={labelY2}
        label={label}
        labelStyle={labelStyle}
      />
      {segments}
    </>
  );
}
