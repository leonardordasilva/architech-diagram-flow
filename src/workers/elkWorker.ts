import ELK from 'elkjs/lib/elk.bundled.js';
import { getErrorMessage } from '@/utils/getErrorMessage';

// PRD-0028 F2-T1: Typed ELK worker interfaces
interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: { id: string; width: number; height: number }[];
  edges: { id: string; sources: string[]; targets: string[] }[];
}

const elk = new ELK();

self.onmessage = async (e: MessageEvent<{ id: string; graph: ElkGraph }>) => {
  const { id, graph } = e.data;
  try {
    const result = await elk.layout(graph);
    self.postMessage({ id, result });
  } catch (error: unknown) {
    self.postMessage({ id, error: getErrorMessage(error) });
  }
};
