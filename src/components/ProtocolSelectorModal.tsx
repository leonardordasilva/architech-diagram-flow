import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PROTOCOL_CONFIGS, type EdgeProtocol } from '@/types/diagram';

interface ProtocolSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProtocol?: EdgeProtocol;
  defaultProtocol?: EdgeProtocol;
  onSelect: (protocol: EdgeProtocol) => void;
  onCancel?: () => void;
}

const protocols = Object.keys(PROTOCOL_CONFIGS) as EdgeProtocol[];

export default function ProtocolSelectorModal({
  open,
  onOpenChange,
  currentProtocol,
  defaultProtocol,
  onSelect,
  onCancel,
}: ProtocolSelectorModalProps) {
  const { t } = useTranslation();
  const highlighted = currentProtocol ?? defaultProtocol;

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && onCancel) {
      onCancel();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('protocolModal.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {protocols.map((proto) => {
            const config = PROTOCOL_CONFIGS[proto];
            const isSelected = highlighted === proto;
            return (
              <button
                key={proto}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                  isSelected ? 'border-primary bg-accent' : 'border-border'
                }`}
                onClick={() => {
                  onSelect(proto);
                  onOpenChange(false);
                }}
              >
                <span
                  className="inline-block h-3 w-6 rounded-sm"
                  style={{
                    backgroundColor: config.color,
                    opacity: config.dashArray ? 0.7 : 1,
                  }}
                />
                <span className="font-medium">{config.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {config.async ? t('protocolModal.async') : t('protocolModal.sync')}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
