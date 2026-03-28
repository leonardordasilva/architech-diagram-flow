import { useState, useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import { useDiagramStore } from '@/store/diagramStore';

const SNAP_THRESHOLD = 8;
const THROTTLE_MS = 16; // ~1 frame at 60fps

interface GuideLine {
  type: 'horizontal' | 'vertical';
  pos: number;
}

interface SnapResult {
  snapX: number | null;
  snapY: number | null;
  guides: GuideLine[];
}

/**
 * R5b — Extracted snap computation shared by onNodeDrag and onNodeDragStop.
 * Compares the dragged node against all other nodes and returns the closest
 * snap target for each axis plus the guide lines to visualise.
 */
function computeSnap(draggedNode: Node, nodes: Node[]): SnapResult {
  const dragW = draggedNode.measured?.width ?? 160;
  const dragH = draggedNode.measured?.height ?? 80;
  const dragX = draggedNode.position.x;
  const dragY = draggedNode.position.y;
  const dragCX = dragX + dragW / 2;
  const dragCY = dragY + dragH / 2;

  const guides: GuideLine[] = [];
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestDx = SNAP_THRESHOLD;
  let bestDy = SNAP_THRESHOLD;

  for (const node of nodes) {
    if (node.id === draggedNode.id) continue;
    const nW = node.measured?.width ?? 160;
    const nH = node.measured?.height ?? 80;
    const nCX = node.position.x + nW / 2;
    const nCY = node.position.y + nH / 2;

    // --- X axis ---
    const dCX = Math.abs(dragCX - nCX);
    if (dCX < bestDx) { bestDx = dCX; snapX = nCX - dragW / 2; guides.push({ type: 'vertical', pos: nCX }); }
    const dLX = Math.abs(dragX - node.position.x);
    if (dLX < bestDx) { bestDx = dLX; snapX = node.position.x; guides.push({ type: 'vertical', pos: node.position.x }); }
    const dRX = Math.abs(dragX + dragW - (node.position.x + nW));
    if (dRX < bestDx) { bestDx = dRX; snapX = node.position.x + nW - dragW; guides.push({ type: 'vertical', pos: node.position.x + nW }); }

    // --- Y axis ---
    const dCY = Math.abs(dragCY - nCY);
    if (dCY < bestDy) { bestDy = dCY; snapY = nCY - dragH / 2; guides.push({ type: 'horizontal', pos: nCY }); }
    const dTY = Math.abs(dragY - node.position.y);
    if (dTY < bestDy) { bestDy = dTY; snapY = node.position.y; guides.push({ type: 'horizontal', pos: node.position.y }); }
    const dBY = Math.abs(dragY + dragH - (node.position.y + nH));
    if (dBY < bestDy) { bestDy = dBY; snapY = node.position.y + nH - dragH; guides.push({ type: 'horizontal', pos: node.position.y + nH }); }
  }

  return { snapX, snapY, guides };
}

/** Apply a snap result to the store if the position actually changed. */
function applySnap(draggedNode: Node, { snapX, snapY }: SnapResult): void {
  if (snapX === null && snapY === null) return;
  const newPos = { x: snapX ?? draggedNode.position.x, y: snapY ?? draggedNode.position.y };
  if (newPos.x === draggedNode.position.x && newPos.y === draggedNode.position.y) return;
  useDiagramStore.getState().setNodes(
    useDiagramStore.getState().nodes.map((n) =>
      n.id === draggedNode.id ? { ...n, position: newPos } : n
    )
  );
}

export { computeSnap }; // exported for testing

export function useSnapGuides(nodes: Node[]) {
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const lastCallRef = useRef(0);

  // R4 — Throttled onNodeDrag (~16 ms / 1 frame)
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const now = performance.now();
      if (now - lastCallRef.current < THROTTLE_MS) return;
      lastCallRef.current = now;

      const result = computeSnap(draggedNode, nodes);
      setGuides(result.guides);
      applySnap(draggedNode, result);
    },
    [nodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      setGuides([]);
      const result = computeSnap(draggedNode, nodes);
      applySnap(draggedNode, result);
    },
    [nodes]
  );

  return { guides, onNodeDrag, onNodeDragStop };
}
