import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (e: MessageEvent<{ id: string; graph: any }>) => {
  const { id, graph } = e.data;
  try {
    const result = await elk.layout(graph);
    self.postMessage({ id, result });
  } catch (error: any) {
    self.postMessage({ id, error: error?.message || 'ELK layout failed' });
  }
};
