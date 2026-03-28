import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NodeType } from '@/types/diagram';

interface SpawnFromNodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceNodeLabel: string;
  sourceNodeType: string;
  onConfirm: (type: NodeType, count: number, subType?: string) => void;
}

export default function SpawnFromNodeModal({
  open,
  onOpenChange,
  sourceNodeLabel,
  sourceNodeType,
  onConfirm,
}: SpawnFromNodeModalProps) {
  const { t } = useTranslation();
  const isQueue = sourceNodeType === 'queue';
  const isService = sourceNodeType === 'service';
  const [type, setType] = useState<NodeType>('database');
  const [subType, setSubType] = useState('Oracle');

  // Update default subType when type changes
  const handleTypeChange = (v: string) => {
    setType(v as NodeType);
    if (v === 'database') setSubType('Oracle');
    else if (v === 'queue') setSubType('IBM MQ');
    else if (v === 'external') setSubType('REST');
  };
  const [count, setCount] = useState(1);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setType(isService ? 'database' : isQueue ? 'service' : 'service');
      setSubType('Oracle');
      setCount(1);
    }
  }, [open, isService, isQueue]);

  const effectiveType = isQueue ? 'service' : type;

  const handleConfirm = () => {
    if (count < 1) return;
    const needsSubType = effectiveType === 'database' || effectiveType === 'queue' || effectiveType === 'external';
    // Pass 'library' as subType when type is 'library' (pseudo-type for embedding)
    if (type === 'library' as any) {
      onConfirm('service', count, 'library');
    } else {
      onConfirm(effectiveType, count, needsSubType ? subType : undefined);
    }
    onOpenChange(false);
    setCount(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t('spawnModal.titleFrom', { label: sourceNodeLabel })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isQueue ? (
            <div className="space-y-2">
              <Label>{t('spawnModal.objectType')}</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t('spawnModal.service')}
              </div>
              <p className="text-xs text-muted-foreground">{t('spawnModal.queueOnlyService')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('spawnModal.objectType')}</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="service">{t('spawnModal.service')}</SelectItem>
                  {isService && <SelectItem value="library">{t('spawnModal.library')}</SelectItem>}
                  <SelectItem value="database">{t('spawnModal.database')}</SelectItem>
                  <SelectItem value="queue">{t('spawnModal.queue')}</SelectItem>
                  <SelectItem value="external">{t('spawnModal.api')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'database' && (
            <div className="space-y-2">
              <Label>{t('spawnModal.subtype')}</Label>
              <Select value={subType} onValueChange={setSubType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="Oracle">Oracle</SelectItem>
                  <SelectItem value="Redis">Redis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'queue' && (
            <div className="space-y-2">
              <Label>{t('spawnModal.subtype')}</Label>
              <Select value={subType} onValueChange={setSubType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="IBM MQ">IBM MQ</SelectItem>
                  <SelectItem value="Kafka">Kafka</SelectItem>
                  <SelectItem value="RabbitMQ">RabbitMQ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'external' && (
            <div className="space-y-2">
              <Label>{t('spawnModal.subtype')}</Label>
              <Select value={subType} onValueChange={setSubType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="REST">REST</SelectItem>
                  <SelectItem value="gRPC">gRPC</SelectItem>
                  <SelectItem value="GraphQL">GraphQL</SelectItem>
                  <SelectItem value="WebSocket">WebSocket</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Alert de embedding ou conexão manual */}
          {(() => {
            const isEmbeddingOracle = isService && effectiveType === 'database' && subType === 'Oracle';
            const isEmbeddingLibrary = isService && type === ('library' as any);
            const isEmbedding = isEmbeddingOracle || isEmbeddingLibrary;

            if (isEmbedding) {
              const embeddingMessage = isEmbeddingOracle
                ? t('spawnModal.oracleAlert', { label: sourceNodeLabel })
                : t('spawnModal.libraryAlert', { label: sourceNodeLabel });
              return (
                <Alert className="border-blue-500/30 bg-blue-500/5">
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    {embeddingMessage}
                  </AlertDescription>
                </Alert>
              );
            }
            return (
              <Alert className="border-muted bg-muted/30">
                <Info className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-xs text-muted-foreground">
                  {t('spawnModal.connectManually', { label: sourceNodeLabel })}
                </AlertDescription>
              </Alert>
            );
          })()}

          <div className="space-y-2">
            <Label>{t('spawnModal.quantity')}</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('spawnModal.cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('spawnModal.create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
