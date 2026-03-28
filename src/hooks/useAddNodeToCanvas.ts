import { useCallback, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '@/store/diagramStore';
import type { NodeType } from '@/types/diagram';

export function useAddNodeToCanvas(reactFlowWrapper: RefObject<HTMLDivElement>) {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useDiagramStore((s) => s.addNode);

  const handleAddNode = useCallback((type: NodeType, subType?: string) => {
    const wrapper = reactFlowWrapper.current;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const pos = screenToFlowPosition({
        x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 80,
        y: rect.top + rect.height / 2 + (Math.random() - 0.5) * 80,
      });
      addNode(type, subType, pos);
    } else {
      addNode(type, subType);
    }
  }, [screenToFlowPosition, addNode, reactFlowWrapper]);

  return { handleAddNode };
}
