import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getMyWorkspace, loadWorkspaceDiagrams } from '@/services/workspaceService';
import { useDiagramStore } from '@/store/diagramStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { clearAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, FileText, FolderOpen, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

function DiagramCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm animate-pulse">
      <div className="mb-2 h-5 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}

export default function WorkspaceDiagrams() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const setWorkspaceCtx = useWorkspaceStore((s) => s.setWorkspace);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace', user?.id],
    queryFn: () => getMyWorkspace(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: diagrams = [], isLoading: diagramsLoading } = useQuery({
    queryKey: ['workspace-diagrams', workspace?.id],
    queryFn: () => loadWorkspaceDiagrams(workspace!.id),
    enabled: !!workspace?.id,
    staleTime: 30_000,
  });

  function openDiagram(diagramId: string) {
    const store = useDiagramStore.getState();
    store.clearCanvas();
    store.setCurrentDiagramId(diagramId);
    store.setIsCollaborator(false);

    // Set workspace context so the editor knows we're in workspace mode
    if (workspace) {
      setWorkspaceCtx({ id: workspace.id, name: workspace.name, ownerId: workspace.ownerId, role: workspace.role });
    }

    clearAutoSave();
    navigate('/app');
  }

  function createWorkspaceDiagram() {
    const store = useDiagramStore.getState();
    store.clearCanvas();
    store.setDiagramName(t('diagram.newDiagram'));
    store.setCurrentDiagramId(undefined);
    clearAutoSave();

    if (workspace) {
      setWorkspaceCtx({ id: workspace.id, name: workspace.name, ownerId: workspace.ownerId, role: workspace.role });
    }
    navigate('/app');
  }

  const canEdit = workspace?.role === 'owner' || workspace?.role === 'editor';

  if (wsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    toast({ title: t('workspace.noWorkspace'), variant: 'destructive' });
    navigate('/workspace');
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/workspace')} aria-label={t('common.back')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">{workspace.name}</h1>
            <Badge variant="outline" className="capitalize text-xs">{workspace.role}</Badge>
          </div>

          {canEdit && (
            <Button onClick={createWorkspaceDiagram}>
              <Plus className="mr-2 h-4 w-4" />
              {t('myDiagrams.newDiagram')}
            </Button>
          )}
        </div>

        {diagramsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => <DiagramCardSkeleton key={i} />)}
          </div>
        ) : diagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="mb-4 h-14 w-14 opacity-30" />
            <p className="mb-1">{t('myDiagrams.emptyTitle')}</p>
            {canEdit && (
              <Button className="mt-4" onClick={createWorkspaceDiagram}>
                <Plus className="mr-2 h-4 w-4" />
                {t('myDiagrams.createFirst')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {diagrams.map((d) => (
              <button
                key={d.id}
                onClick={() => openDiagram(d.id)}
                className="flex flex-col rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent/50"
              >
                <p className="mb-1 truncate font-semibold">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t('myDiagrams.stats', { nodes: d.node_count, edges: d.edge_count })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('myDiagrams.updatedAt', { date: format(new Date(d.updated_at), 'dd/MM/yyyy HH:mm') })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
