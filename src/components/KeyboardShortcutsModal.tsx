import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: 'Ctrl + Z', desc: t('shortcuts.undo') },
    { keys: 'Ctrl + Y', desc: t('shortcuts.redo') },
    { keys: 'Ctrl + Shift + Z', desc: t('shortcuts.redoAlt') },
    { keys: 'Delete', desc: t('shortcuts.delete') },
    { keys: 'Ctrl + S', desc: t('shortcuts.save') },
    { keys: 'Ctrl + A', desc: t('shortcuts.selectAll') },
    { keys: 'Escape', desc: t('shortcuts.close') },
    { keys: '?', desc: t('shortcuts.openShortcuts') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-base">{t('shortcuts.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">{s.desc}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
