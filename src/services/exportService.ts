import type { DiagramNode, DiagramEdge, DiagramNodeData } from '@/types/diagram';

/**
 * Escape special Mermaid characters in node labels
 */
function escapeMermaid(text: string): string {
  return text.replace(/[[\](){}|>]/g, ' ').replace(/"/g, "'").trim();
}

/**
 * Build a Mermaid node string based on node type
 */
function mermaidNodeShape(id: string, label: string, type: string): string {
  const safe = escapeMermaid(label);
  switch (type) {
    case 'service':
      return `${id}["${safe}"]`;
    case 'database':
      return `${id}[("${safe}")]`;
    case 'queue':
      return `${id}>"${safe}"]`;
    case 'external':
      return `${id}("${safe}")`;
    default:
      return `${id}["${safe}"]`;
  }
}

/**
 * Convert diagram nodes and edges to Mermaid.js syntax
 */
export function exportToMermaid(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const lines: string[] = ['graph LR'];

  // Build id map for safe mermaid IDs
  const idMap = new Map<string, string>();
  nodes.forEach((node, i) => {
    const safeId = `N${i}`;
    idMap.set(node.id, safeId);
    const data = node.data as unknown as DiagramNodeData;
    lines.push(`  ${mermaidNodeShape(safeId, data.label, node.type || 'service')}`);
  });

  edges.forEach((edge) => {
    const src = idMap.get(edge.source);
    const tgt = idMap.get(edge.target);
    if (!src || !tgt) return;

    const protocol = (edge.data as any)?.protocol as string | undefined;
    const label = protocol || (typeof edge.label === 'string' ? edge.label : '');
    if (label) {
      lines.push(`  ${src} -->|${escapeMermaid(label)}| ${tgt}`);
    } else {
      lines.push(`  ${src} --> ${tgt}`);
    }
  });

  return lines.join('\n');
}

/**
 * Export enhanced JSON with metadata
 */
export function exportEnhancedJSON(
  diagramName: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  description?: string,
): string {
  return JSON.stringify(
    {
      name: diagramName,
      version: '2',
      exportedAt: new Date().toISOString(),
      ...(description ? { description } : {}),
      nodes,
      edges,
    },
    null,
    2,
  );
}
