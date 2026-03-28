import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, LogOut, FolderOpen, RefreshCw, UserCircle2, Languages } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CollaboratorAvatars from '@/components/CollaboratorAvatars';
import type { Collaborator } from '@/hooks/useRealtimeCollab';

interface DiagramHeaderProps {
  shareToken?: string;
  diagramId: string | null;
  isCollaborator: boolean;
  user: { id: string } | null;
  collaborators: Collaborator[];
  saving: boolean;
  refreshing: boolean;
  onSave: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
  onOpenBilling: () => void;
  onOpenAccount: () => void;
  onOpenMyDiagrams: () => void;
  plan?: 'free' | 'pro' | 'team';
}

const PLAN_BADGE_CLASS: Record<string, string> = {
  free: 'border-muted-foreground/30 text-muted-foreground',
  pro: 'border-blue-500/40 text-blue-500 bg-blue-500/10',
  team: 'border-yellow-500/40 text-yellow-500 bg-yellow-500/10',
};

function DiagramHeader({
  shareToken,
  diagramId,
  isCollaborator,
  user,
  collaborators,
  saving,
  refreshing,
  onSave,
  onRefresh,
  onSignOut,
  onOpenBilling,
  onOpenAccount,
  onOpenMyDiagrams,
  plan = 'free',
}: DiagramHeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      {shareToken && !diagramId && (
        <Badge variant="outline" className="text-xs">
          {t('header.viewingShared')}
        </Badge>
      )}
      {shareToken && diagramId && (
        <Badge variant="secondary" className="text-xs">
          {t('header.savedCopy')}
        </Badge>
      )}
      {isCollaborator && (
        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600 dark:text-blue-400">
          {t('header.editingShared')}
        </Badge>
      )}

      {user && (
        <div className="flex items-center gap-2 ml-auto">
          <CollaboratorAvatars collaborators={collaborators} />

          {/* Plan badge → opens billing modal */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`cursor-pointer capitalize text-xs px-2 py-0.5 transition-opacity hover:opacity-80 ${PLAN_BADGE_CLASS[plan] ?? PLAN_BADGE_CLASS.free}`}
                onClick={onOpenBilling}
              >
                {t(`pricing.${plan}`)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('billing.title')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenAccount} aria-label={t('header.myAccount')}>
                <UserCircle2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('header.myAccount')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenMyDiagrams} aria-label={t('header.myDiagrams')}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('header.myDiagrams')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={refreshing} aria-label={t('header.update')}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('header.update')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSave} disabled={saving} aria-label={t('header.saveToCloud')}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('header.saveToCloud')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => {
                  const next = i18n.language === 'pt-BR' ? 'en' : 'pt-BR';
                  i18n.changeLanguage(next);
                  toast({ title: next === 'en' ? 'Language changed to English' : 'Idioma alterado para Português' });
                }}
                aria-label={t('header.switchLanguage')}
              >
                <Languages className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {i18n.language === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSignOut} aria-label={t('header.logout')}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('header.logout')}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </>
  );
}

function areHeaderPropsEqual(prev: DiagramHeaderProps, next: DiagramHeaderProps) {
  return (
    prev.plan === next.plan &&
    prev.saving === next.saving &&
    prev.refreshing === next.refreshing &&
    prev.diagramId === next.diagramId &&
    prev.shareToken === next.shareToken &&
    prev.isCollaborator === next.isCollaborator &&
    prev.user?.id === next.user?.id &&
    prev.collaborators.length === next.collaborators.length &&
    prev.onSave === next.onSave &&
    prev.onRefresh === next.onRefresh &&
    prev.onSignOut === next.onSignOut &&
    prev.onOpenBilling === next.onOpenBilling &&
    prev.onOpenAccount === next.onOpenAccount &&
    prev.onOpenMyDiagrams === next.onOpenMyDiagrams
  );
}

export default React.memo(DiagramHeader, areHeaderPropsEqual);
