import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2, Search, Lock, Link2, Copy } from 'lucide-react';
import {
  searchUsersByEmail, shareDiagramWithUser, listDiagramShares, revokeShare,
  type ShareRecord,
} from '@/services/shareService';
import { shareDiagram } from '@/services/diagramService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  ownerId: string;
  /** Whether email sharing is enabled on current plan */
  emailSharingEnabled?: boolean;
  /** Max collaborators per diagram (null = unlimited) */
  maxCollaborators?: number | null;
  /** Called when user clicks upgrade CTA */
  onUpgradeRequest?: () => void;
}

interface UserResult {
  id: string;
  email: string;
}

export default function ShareDiagramModal({
  open, onOpenChange, diagramId, ownerId,
  emailSharingEnabled = true,
  maxCollaborators = null,
  onUpgradeRequest,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Load existing shares on open
  useEffect(() => {
    if (open && diagramId) {
      setLoadingShares(true);
      listDiagramShares(diagramId).then(setShares).finally(() => setLoadingShares(false));
      setQuery('');
      setResults([]);
      setSelected(new Set());
      setShareLink(null);
    }
  }, [open, diagramId]);

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const url = await shareDiagram(diagramId);
      if (url) {
        setShareLink(url);
        await navigator.clipboard.writeText(url);
        toast({ title: t('shareDiagramModal.linkCopied') });
      } else {
        toast({ title: t('shareDiagramModal.linkError'), variant: 'destructive' });
      }
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({ title: t('shareDiagramModal.linkCopied') });
    } catch {
      toast({ title: t('shareModal.copyError', 'Falha ao copiar link'), variant: 'destructive' });
    }
  };

  // Debounced search — only fires when query contains '@' or has 3+ chars to avoid noisy requests
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (!query.includes('@') && query.length < 3) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const users = await searchUsersByEmail(query, ownerId);
      setResults(users);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, ownerId]);

  const alreadySharedIds = new Set(shares.map((s) => s.shared_with_id));

  const toggleSelect = useCallback((userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const handleShareSelected = async () => {
    if (selected.size === 0) return;

    // saas0001: enforce collaborator limit
    if (maxCollaborators !== null && shares.length + selected.size > maxCollaborators) {
      toast({
        title: t('limits.collaboratorLimitReached', { max: maxCollaborators }),
        variant: 'destructive',
      });
      return;
    }

    setSharing(true);
    let successCount = 0;
    let errorCount = 0;
    for (const userId of selected) {
      try {
        await shareDiagramWithUser(diagramId, ownerId, userId);
        successCount++;
      } catch {
        errorCount++;
      }
    }
    if (successCount > 0) {
      toast({ title: t('shareDiagramModal.shareSuccess', { count: successCount }) });
    }
    if (errorCount > 0) {
      toast({ title: t('shareDiagramModal.shareErrors', { count: errorCount }), variant: 'destructive' });
    }
    setSelected(new Set());
    const updated = await listDiagramShares(diagramId);
    setShares(updated);
    setSharing(false);
  };

  const handleRevoke = async (share: ShareRecord) => {
    try {
      await revokeShare(share.id);
      setShares((prev) => prev.filter((s) => s.id !== share.id));
      toast({ title: t('shareDiagramModal.revokeSuccess'), description: t('shareDiagramModal.revokeDesc', { email: share.shared_with_email }) });
    } catch {
      toast({ title: t('shareDiagramModal.revokeError'), variant: 'destructive' });
    }
  };

  const displayUsers = results;
  const isLoadingList = searching;

  const renderUserRow = (user: UserResult) => {
    const alreadyShared = alreadySharedIds.has(user.id);
    const isSelected = selected.has(user.id);
    return (
      <label
        key={user.id}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/50 border-b last:border-b-0 ${
          alreadyShared ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isSelected ? 'bg-accent' : ''}`}
      >
        <input
          type="checkbox"
          checked={isSelected || alreadyShared}
          disabled={alreadyShared}
          onChange={() => !alreadyShared && toggleSelect(user.id)}
          className="h-4 w-4 rounded border-border accent-primary shrink-0"
        />
        <span className="truncate flex-1">{user.email}</span>
        {alreadyShared && (
          <span className="text-xs text-muted-foreground shrink-0">{t('shareDiagramModal.alreadyHasAccess')}</span>
        )}
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{t('shareDiagramModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 flex-1 overflow-hidden flex flex-col">
          {/* ── Link público (todos os planos) ── */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t('shareDiagramModal.publicLink')}
            </p>
            <p className="text-xs text-muted-foreground">{t('shareDiagramModal.publicLinkDesc')}</p>
            {shareLink ? (
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label={t('shareDiagramModal.copyLink')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleGenerateLink} disabled={generatingLink}>
                {generatingLink && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {t('shareDiagramModal.generateLink')}
              </Button>
            )}
          </div>

          <div className="border-t" />

          {/* ── Compartilhamento por e-mail ── */}
          {!emailSharingEnabled ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{t('shareDiagramModal.emailSharingLocked')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('shareDiagramModal.emailSharingLockedDesc')}</p>
              </div>
              <Button size="sm" onClick={() => { onOpenChange(false); onUpgradeRequest?.(); }}>
                {t('upgrade.seeProPlans')}
              </Button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('shareDiagramModal.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* User list */}
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {isLoadingList ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : displayUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {query.trim() === '' ? t('shareDiagramModal.typeEmail') : t('shareDiagramModal.noResults')}
                  </p>
                ) : (
                  displayUsers.map(renderUserRow)
                )}
              </div>

              {selected.size > 0 && (
                <Button onClick={handleShareSelected} disabled={sharing} className="w-full">
                  {sharing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('shareDiagramModal.shareWith', { count: selected.size })}
                </Button>
              )}

              {/* Existing shares */}
              <div className="flex-1 overflow-y-auto">
                {loadingShares ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : shares.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('shareDiagramModal.usersWithAccess')}</p>
                    {shares.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm truncate">{s.shared_with_email}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => handleRevoke(s)}
                          aria-label={t('shareDiagramModal.revokeAccess')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {t('shareDiagramModal.noSharedUsers')}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('shareDiagramModal.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
