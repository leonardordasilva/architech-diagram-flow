import type { NodeType } from '@/types/diagram';
import i18n from '@/i18n';

const ALLOWED_TARGETS: Record<NodeType, NodeType[]> = {
  service:  ['service', 'database', 'queue', 'external'],
  database: ['service', 'external'],
  queue:    ['service'],
  external: ['service', 'database', 'queue', 'external'],
};

export function canConnect(sourceType: NodeType, targetType: NodeType): boolean {
  return ALLOWED_TARGETS[sourceType]?.includes(targetType) ?? false;
}

export function connectionErrorMessage(sourceType: NodeType, targetType: NodeType): string {
  const names: Record<NodeType, string> = {
    service: i18n.t('nodes.service'),
    database: i18n.t('nodes.database'),
    queue: i18n.t('nodes.queue'),
    external: i18n.t('nodes.external'),
  };
  return i18n.t('connectionError.message', {
    source: names[sourceType],
    target: names[targetType],
  });
}
