// PRD-v3 ITEM-2: Added integrityWarning toast on load + icon in listing
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';
import { clearAutoSave } from '@/hooks/useAutoSave';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  loadUserDiagrams,
  deleteDiagram,
  renameDiagram,
  duplicateDiagram,
  type DiagramRecord,
} from '@/services/diagramService';
import { loadSharedWithMe } from '@/services/shareService';
import { useDiagramStore } from '@/store/diagramStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Pencil, FileText, Share2, RefreshCw, Loader2,
  Users, Copy, AlertTriangle, Search, GitBranch, Network,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import ShareDiagramModal from '@/components/ShareDiagramModal';
import UpgradeModal from '@/components/UpgradeModal';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { STALE_TIME_DIAGRAMS_MS, GC_TIME_DIAGRAMS_MS } from '@/constants/storageKeys';

function DiagramCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="h-1.5 bg-muted w-full" />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
        <div className="h-3 w-1/2 rounded bg-muted mb-2" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

interface MyDiagramsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MyDiagramsModal({ open, onOpenChange }: MyDiagramsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ownerId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [shareTarget, setShareTarget] = useState<{ diagramId: string; ownerId: string } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [upgradeDescription, setUpgradeDescription] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const planLimits = usePlanLimits();
  const [sharedWithMe, setSharedWithMe] = useState<
    { diagram_id: string; title: string; owner_email: string; updated_at: string; nodes: DiagramNode[]; edges: DiagramEdge[] }[]
  >([]);
  const [loadingShared, setLoadingShared] = useState(false);

  const {
    data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['diagrams', user?.id],
    queryFn: ({ pageParam = 0 }) => loadUserDiagrams(user!.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    enabled: !!user && open,
    staleTime: STALE_TIME_DIAGRAMS_MS,
    gcTime: GC_TIME_DIAGRAMS_MS,
  });

  const diagrams = data?.pages.flatMap((p) => p.diagrams) ?? [];
  const limits = planLimits;
  const isOverDiagramLimit = limits.maxDiagrams !== null && diagrams.length >= limits.maxDiagrams;

  const filteredDiagrams = useMemo(() => {
    if (!searchQuery.trim()) return diagrams;
    const q = searchQuery.toLowerCase();
    return diagrams.filter((d) => d.title.toLowerCase().includes(q));
  }, [diagrams, searchQuery]);

  const filteredShared = useMemo(() => {
    if (!searchQuery.trim()) return sharedWithMe;
    const q = searchQuery.toLowerCase();
    return sharedWithMe.filter((d) => d.title.toLowerCase().includes(q));
  }, [sharedWithMe, searchQuery]);

  useEffect(() => {
    if (!user?.id || !open) return;
    setLoadingShared(true);
    loadSharedWithMe(user.id).then(setSharedWithMe).finally(() => setLoadingShared(false));
  }, [user?.id, open]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  const deleteMutation = useMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) => deleteDiagram(id, ownerId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['diagrams', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['diagram-count', user?.id] });
      const store = useDiagramStore.getState();
      if (store.currentDiagramId === variables.id) {
        store.clearCanvas();
        store.setDiagramName(t('diagram.newDiagram'));
        store.setCurrentDiagramId(undefined);
        clearAutoSave();
      }
      toast({ title: t('myDiagrams.deleteSuccess') });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: t('myDiagrams.deleteError'), variant: 'destructive' }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameDiagram(id, title, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagrams', user?.id] });
      toast({ title: t('myDiagrams.renameSuccess') });
      setEditingId(null);
    },
    onError: () => toast({ title: t('myDiagrams.renameError'), variant: 'destructive' }),
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => {
      if (isOverDiagramLimit) {
        setUpgradeFeature(t('upgrade.duplicateBlocked'));
        setUpgradeDescription(t('upgrade.diagramLimitDuplicateDesc', { max: limits.maxDiagrams }));
        setUpgradeModalOpen(true);
        return Promise.resolve(null);
      }
      return duplicateDiagram(id, user!.id);
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ['diagrams', user?.id] });
      toast({ title: t('myDiagrams.duplicateSuccess') });
    },
    onError: () => toast({ title: t('myDiagrams.duplicateError'), variant: 'destructive' }),
  });

  const handleDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget);
  };

  const handleRename = (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      toast({ title: t('myDiagrams.titleEmpty'), variant: 'destructive' });
      setEditingId(null);
      return;
    }
    if (trimmed.length > 100) {
      toast({ title: t('myDiagrams.titleTooLong'), description: t('myDiagrams.titleTooLongDesc'), variant: 'destructive' });
      return;
    }
    renameMutation.mutate({ id, title: trimmed });
  };

  // PRD-v3 ITEM-2: Show integrity warning toast when loading a diagram
  const handleLoad = (diagram: DiagramRecord) => {
    const store = useDiagramStore.getState();
    store.loadDiagram(diagram.nodes, diagram.edges);
    store.setDiagramName(diagram.title);
    store.setCurrentDiagramId(diagram.id);
    store.setIsCollaborator(false);

    if (diagram.integrityWarning) {
      toast({
        title: t('integrity.warning'),
        description: t('integrity.hashMismatch'),
        variant: 'destructive',
        duration: 10000,
      });
    }

    onOpenChange(false);
  };

  const handleLoadShared = (item: typeof sharedWithMe[0]) => {
    const store = useDiagramStore.getState();
    store.loadDiagram(item.nodes, item.edges);
    store.setDiagramName(item.title);
    store.setCurrentDiagramId(item.diagram_id);
    store.setIsCollaborator(true);
    onOpenChange(false);
  };

  const handleNewDiagram = () => {
    if (isOverDiagramLimit) {
      setUpgradeFeature(t('upgrade.newDiagramBlocked'));
      setUpgradeDescription(t('upgrade.diagramLimitNewDesc', { max: limits.maxDiagrams }));
      setUpgradeModalOpen(true);
      return;
    }
    const store = useDiagramStore.getState();
    store.clearCanvas();
    store.setDiagramName(t('diagram.newDiagram'));
    store.setCurrentDiagramId(undefined);
    clearAutoSave();
    onOpenChange(false);
  };

  const totalCount = diagrams.length + sharedWithMe.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div>
              <DialogTitle className="text-lg">{t('myDiagrams.title')}</DialogTitle>
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('myDiagrams.totalCount', { count: diagrams.length })}
                  {limits.maxDiagrams !== null ? ` / ${limits.maxDiagrams}` : ''}
                </p>
              )}
            </div>
            {isOverDiagramLimit ? (
              <Button
                onClick={() => {
                  setUpgradeFeature(t('upgrade.newDiagramBlocked'));
                  setUpgradeDescription(t('upgrade.diagramLimitNewDesc', { max: limits.maxDiagrams }));
                  setUpgradeModalOpen(true);
                }}
                size="sm"
                variant="default"
                className="cursor-pointer"
              >
                {t('myDiagrams.overLimitUpgrade')}
              </Button>
            ) : (
              <Button onClick={handleNewDiagram} size="sm" className="gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                {t('myDiagrams.newDiagram')}
              </Button>
            )}
          </div>

          {/* Search bar */}
          {totalCount > 0 && (
            <div className="px-6 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t('myDiagrams.searchPlaceholder', 'Buscar diagramas...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Over-limit warning */}
          {isOverDiagramLimit && (
            <div className="mx-6 mb-3 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm shrink-0">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('myDiagrams.overLimit')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('myDiagrams.overLimitDesc', { count: diagrams.length, max: limits.maxDiagrams })}
                </p>
              </div>
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {isError && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="mb-4">{t('myDiagrams.loadError')}</p>
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['diagrams', user?.id] })} className="cursor-pointer">
                  <RefreshCw className="mr-2 h-4 w-4" /> {t('common.tryAgain')}
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <DiagramCardSkeleton key={i} />)}
              </div>
            ) : !isError && diagrams.length === 0 && sharedWithMe.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="rounded-2xl border bg-muted/40 p-5 mb-5">
                  <FileText className="h-12 w-12 opacity-30" />
                </div>
                <p className="font-medium mb-1">{t('myDiagrams.emptyTitle')}</p>
                <p className="mb-5 text-sm text-center max-w-xs">{t('myDiagrams.emptyDesc')}</p>
                <Button onClick={() => onOpenChange(false)} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />{t('myDiagrams.createFirst')}
                </Button>
              </div>
            ) : !isError ? (
              <>
                {/* My diagrams */}
                {filteredDiagrams.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDiagrams.map((d) => (
                      <TooltipProvider key={d.id} delayDuration={300}>
                        <div
                          className="group relative flex flex-col rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                          onClick={() => handleLoad(d)}
                        >
                          {/* Accent stripe */}
                          <div className={`h-1 w-full ${
                            d.nodes.length === 0
                              ? 'bg-muted'
                              : d.nodes.length < 10
                              ? 'bg-blue-500/60'
                              : d.nodes.length < 25
                              ? 'bg-violet-500/60'
                              : 'bg-primary/60'
                          }`} />

                          <div className="p-4 flex flex-col flex-1">
                            <div className="mb-2 flex items-start gap-2 min-w-0">
                              {editingId === d.id ? (
                                <Input
                                  autoFocus
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRename(d.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  onBlur={() => handleRename(d.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-sm"
                                />
                              ) : (
                                <>
                                  <h3 className="font-semibold text-foreground text-sm leading-snug break-words min-w-0 flex-1 line-clamp-2">
                                    {d.title}
                                  </h3>
                                  {/* PRD-v3 ITEM-2: Integrity warning icon */}
                                  {d.integrityWarning && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                      </TooltipTrigger>
                                      <TooltipContent>{t('integrity.hashMismatch')}</TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                              <span className="flex items-center gap-1">
                                <Network className="h-3 w-3" />
                                {d.nodes.length}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {d.edges.length}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/70">
                              {format(new Date(d.updated_at), 'dd/MM/yyyy HH:mm')}
                            </p>

                            <div className="mt-3 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShareTarget({ diagramId: d.id, ownerId: d.owner_id });
                                    }}
                                    aria-label={t('myDiagrams.share')}
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('myDiagrams.share')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateMutation.mutate({ id: d.id });
                                    }}
                                    aria-label={t('myDiagrams.duplicate')}
                                    disabled={duplicateMutation.isPending}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('myDiagrams.duplicate')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(d.id);
                                      setEditTitle(d.title);
                                    }}
                                    aria-label={t('myDiagrams.rename')}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('myDiagrams.rename')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({ id: d.id, ownerId: d.owner_id });
                                    }}
                                    aria-label={t('myDiagrams.delete')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('myDiagrams.delete')}</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </TooltipProvider>
                    ))}
                  </div>
                )}

                {searchQuery && filteredDiagrams.length === 0 && diagrams.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="h-8 w-8 opacity-30 mb-3" />
                    <p className="text-sm">{t('myDiagrams.noSearchResults', 'Nenhum diagrama encontrado')}</p>
                  </div>
                )}

                {hasNextPage && (
                  <div className="mt-5 flex justify-center">
                    <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="cursor-pointer">
                      {isFetchingNextPage ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('myDiagrams.loading')}</>
                      ) : t('myDiagrams.loadMore')}
                    </Button>
                  </div>
                )}

                {/* Shared with me section */}
                {(loadingShared || filteredShared.length > 0) && (
                  <div className="mt-6">
                    <Separator className="mb-5" />
                    <div className="mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold text-foreground">{t('myDiagrams.sharedWithMe')}</h2>
                      {!loadingShared && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                          {filteredShared.length}
                        </Badge>
                      )}
                    </div>
                    {loadingShared ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => <DiagramCardSkeleton key={i} />)}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredShared.map((item) => (
                          <div
                            key={item.diagram_id}
                            className="group relative flex flex-col rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                            onClick={() => handleLoadShared(item)}
                          >
                            <div className="h-1 w-full bg-emerald-500/60" />
                            <div className="p-4">
                              <h3 className="truncate font-semibold text-sm text-foreground mb-2">{item.title}</h3>
                              <p className="text-xs text-muted-foreground/70 mb-2">
                                {format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm')}
                              </p>
                              <Badge variant="secondary" className="text-xs truncate max-w-full">
                                {t('myDiagrams.sharedBy', { email: item.owner_email })}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myDiagrams.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('myDiagrams.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('myDiagrams.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('myDiagrams.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shareTarget && (
        <ShareDiagramModal
          diagramId={shareTarget.diagramId}
          ownerId={shareTarget.ownerId}
          open={!!shareTarget}
          onOpenChange={(o) => { if (!o) setShareTarget(null); }}
        />
      )}

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        featureName={upgradeFeature}
        description={upgradeDescription}
      />
    </>
  );
}
