import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  getMyWorkspace,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  renameWorkspace,
  type WorkspaceMember,
} from '@/services/workspaceService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Pencil, Users, FolderOpen, Loader2, CheckCheck, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import WorkspaceInviteModal from '@/components/WorkspaceInviteModal';
import UpgradeModal from '@/components/UpgradeModal';
import { usePlanStore } from '@/store/planStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export default function Workspace() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plan = usePlanStore((s) => s.limits.plan);
  const setWorkspaceCtx = useWorkspaceStore((s) => s.setWorkspace);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace', user?.id],
    queryFn: () => getMyWorkspace(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members', workspace?.id],
    queryFn: () => getWorkspaceMembers(workspace!.id),
    enabled: !!workspace?.id,
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ memberId, userId }: { memberId: string; userId: string | null }) =>
      removeWorkspaceMember(workspace!.id, memberId, userId),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['workspace-members', workspace?.id] });
      toast({ title: t('workspace.memberRemoved') });
    },
    onError: (err: any) =>
      toast({ title: t('workspace.memberRemoveError'), description: err.message, variant: 'destructive' }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'editor' | 'viewer' }) =>
      updateMemberRole(workspace!.id, memberId, role),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['workspace-members', workspace?.id] }),
    onError: (err: any) =>
      toast({ title: t('workspace.roleUpdateError'), description: err.message, variant: 'destructive' }),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameWorkspace(workspace!.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setEditingName(false);
      toast({ title: t('workspace.renameSuccess') });
    },
    onError: (err: any) =>
      toast({ title: t('workspace.renameError'), description: err.message, variant: 'destructive' }),
  });

  async function handleCreateWorkspace() {
    if (plan !== 'team') { setUpgradeOpen(true); return; }
    setCreatingWorkspace(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const name = user?.email?.split('@')[0] ?? 'My Workspace';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-workspace`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error ?? res.statusText);
      }
      const { workspace: ws } = await res.json();
      setWorkspaceCtx({ id: ws.id, name: ws.name, ownerId: ws.owner_id, role: 'owner' });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast({ title: t('workspace.created') });
    } catch (err: any) {
      toast({ title: t('workspace.createError'), description: err.message, variant: 'destructive' });
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleResendInvite(email: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-workspace-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ workspaceId: workspace!.id, email, role: members.find(m => m.email === email)?.role ?? 'viewer', app_url: window.location.origin }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      toast({ title: t('workspace.inviteResent', { email }) });
      queryClient.refetchQueries({ queryKey: ['workspace-members', workspace?.id] });
    } catch (err: any) {
      toast({ title: t('workspace.inviteError'), description: err.message, variant: 'destructive' });
    }
  }

  const editorCount = members.filter((m) => ['owner', 'editor'].includes(m.role) && m.acceptedAt).length;
  const viewerCount = members.filter((m) => m.role === 'viewer').length;
  const isOwner = workspace?.role === 'owner';

  if (wsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app')} aria-label={t('common.back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            {editingName && workspace ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); renameMutation.mutate(newName); }}
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={renameMutation.isPending}>
                  {t('common.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  {t('common.cancel')}
                </Button>
              </form>
            ) : (
              <>
                <h1 className="text-xl font-bold">
                  {workspace ? workspace.name : t('workspace.title')}
                </h1>
                {isOwner && workspace && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setNewName(workspace.name); setEditingName(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>

          {workspace && (
            <Button
              variant="outline" size="sm"
              onClick={() => navigate('/workspace/diagrams')}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('workspace.diagrams')}
            </Button>
          )}
        </div>

        {/* No workspace yet */}
        {!workspace && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center text-muted-foreground">
            <Users className="mb-4 h-12 w-12 opacity-30" />
            <p className="mb-1 font-medium">{t('workspace.noWorkspace')}</p>
            <p className="mb-6 text-sm">{t('workspace.noWorkspaceDesc')}</p>
            <Button onClick={handleCreateWorkspace} disabled={creatingWorkspace}>
              {creatingWorkspace
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Plus className="mr-2 h-4 w-4" />}
              {t('workspace.create')}
            </Button>
          </div>
        )}

        {workspace && (
          <>
            {/* Counters */}
            <div className="mb-6 flex gap-4">
              <div className="rounded-lg border bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold">{editorCount}</p>
                <p className="text-xs text-muted-foreground">{t('workspace.editors')}</p>
                <p className="text-xs text-yellow-500">{t('workspace.charged')}</p>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold">{viewerCount}</p>
                <p className="text-xs text-muted-foreground">{t('workspace.viewers')}</p>
                <p className="text-xs text-muted-foreground">{t('workspace.free')}</p>
              </div>
            </div>

            {/* Members list */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{t('workspace.members')}</h2>
              {isOwner && (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('workspace.invite')}
                </Button>
              )}
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('workspace.invitedAt', { date: format(new Date(member.invitedAt), 'dd/MM/yyyy') })}
                      </p>
                    </div>

                    {member.acceptedAt ? (
                      <CheckCheck className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs text-yellow-500">
                          {t('workspace.pending')}
                        </Badge>
                        {isOwner && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                            title={t('workspace.inviteResend')}
                            onClick={() => handleResendInvite(member.email)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}

                    {isOwner && member.role !== 'owner' ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          roleMutation.mutate({ memberId: member.id, role: v as 'editor' | 'viewer' })
                        }
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">{t('workspace.roleEditor')}</SelectItem>
                          <SelectItem value="viewer">{t('workspace.roleViewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className="shrink-0 capitalize">{member.role}</Badge>
                    )}

                    {isOwner && member.role !== 'owner' && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => setRemoveTarget(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {workspace && (
        <WorkspaceInviteModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={workspace.id}
          onSuccess={() => queryClient.refetchQueries({ queryKey: ['workspace-members', workspace?.id] })}
        />
      )}

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} featureName={t('workspace.title')} />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workspace.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('workspace.removeDesc', { email: removeTarget?.email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeTarget) removeMutation.mutate({ memberId: removeTarget.id, userId: removeTarget.userId });
                setRemoveTarget(null);
              }}
            >
              {t('workspace.removeMember')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
