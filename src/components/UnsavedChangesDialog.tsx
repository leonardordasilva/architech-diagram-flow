import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndLeave: () => void;
  onLeaveWithout: () => void;
}

export default function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSaveAndLeave,
  onLeaveWithout,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('unsavedDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('unsavedDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('unsavedDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            onClick={onLeaveWithout}
          >
            {t('unsavedDialog.leaveWithout')}
          </AlertDialogAction>
          <AlertDialogAction onClick={onSaveAndLeave}>
            {t('unsavedDialog.saveAndLeave')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
