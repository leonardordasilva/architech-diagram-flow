import type { NodeType } from '@/types/diagram';
import { getDbColor } from '@/constants/databaseColors';

export function getNodeColor(type?: NodeType, subType?: string): string {
  switch (type) {
    case 'service': return 'hsl(217, 91%, 60%)';
    case 'database': return getDbColor(subType);
    case 'queue': return 'hsl(157, 52%, 49%)';
    case 'external': return 'hsl(220, 9%, 46%)';
    default: return '#888';
  }
}
