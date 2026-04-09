import { useState } from 'react';
import { useAdminWorkspaces, useAdminMutations } from '../hooks/useAdminQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell, AdminPagination } from '../components/AdminTable';

export default function AdminWorkspaces() {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const { data, isLoading } = useAdminWorkspaces(page);
  const { deleteWorkspace } = useAdminMutations();

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWorkspace.mutate({ workspaceId: deleteTarget.id }, {
      onSuccess: () => { toast({ title: 'Workspace deletado' }); setDeleteTarget(null); setConfirmName(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const totalPages = Math.ceil((data?.count ?? 0) / 20);

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader title="Workspaces" description="Gerenciar workspaces do sistema" />

      <AdminTable
        columns={[
          { header: 'Nome' },
          { header: 'Dono' },
          { header: 'Plano' },
          { header: 'Membros' },
          { header: 'Diagramas' },
          { header: 'Criado em' },
          { header: '', className: 'w-10' },
        ]}
        isLoading={isLoading}
      >
        {data?.data?.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhum workspace.
            </td>
          </tr>
        ) : data?.data?.map((w) => (
          <AdminTableRow key={w.id}>
            <AdminTableCell>{w.name}</AdminTableCell>
            <AdminTableMutedCell>{w.owner_email}</AdminTableMutedCell>
            <AdminTableCell>
              <span
                className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text-muted))' }}
              >
                {w.plan}
              </span>
            </AdminTableCell>
            <AdminTableMutedCell>{w.member_count}</AdminTableMutedCell>
            <AdminTableMutedCell>{w.diagram_count}</AdminTableMutedCell>
            <AdminTableMutedCell>{new Date(w.created_at).toLocaleDateString('pt-BR')}</AdminTableMutedCell>
            <AdminTableCell>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/5" onClick={() => setDeleteTarget({ id: w.id, name: w.name })}>
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(0 84% 60%)' }} />
              </Button>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTable>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Digite <strong>{deleteTarget?.name}</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Nome do workspace" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmName !== deleteTarget?.name || deleteWorkspace.isPending}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteWorkspace.isPending ? 'Deletando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
