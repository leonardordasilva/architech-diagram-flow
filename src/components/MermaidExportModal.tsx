import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check } from 'lucide-react';

interface MermaidExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
}

export default function MermaidExportModal({ open, onOpenChange, code }: MermaidExportModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-base">{t('mermaidModal.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('mermaidModal.description')}{' '}
            <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              mermaid.live
            </a>{' '}
            {t('mermaidModal.descriptionSuffix')}
          </p>
          <Textarea
            value={code}
            readOnly
            rows={12}
            className="font-mono text-xs bg-muted"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('mermaidModal.close')}
          </Button>
          <Button onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t('mermaidModal.copied') : t('mermaidModal.copyCode')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
