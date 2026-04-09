import { useState } from 'react';
import { useAdminDiagrams, useAdminMutations } from '../hooks/useAdminQuery';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell, AdminPagination } from '../components/AdminTable';

export default function AdminDiagrams() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') || undefined;
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filters = userId ? { userId } : undefined;
  const { data, isLoading } = useAdminDiagrams(page, filters);
  const { deleteDiagram } = useAdminMutations();

  const handleDelete = () => {
    if (!deleteId) return;
    deleteDiagram.mutate({ diagramId: deleteId }, {
      onSuccess: () => { toast({ title: 'Diagrama deletado' }); setDeleteId(null); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const totalPages = Math.ceil((data?.count ?? 0) / 20);

  return (
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader
        title="Diagramas"
        description={userId ? `Filtrado por usuário: ${userId}` : 'Todos os diagramas do sistema'}
      />

      <AdminTable
        columns={[
          { header: 'Título' },
          { header: 'Dono' },
          { header: 'Nodes' },
          { header: 'Edges' },
          { header: 'Atualizado' },
          { header: '', className: 'w-10' },
        ]}
        isLoading={isLoading}
      >
        {data?.data?.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhum diagrama.
            </td>
          </tr>
        ) : data?.data?.map((d) => (
          <AdminTableRow key={d.id}>
            <AdminTableCell>{d.title}</AdminTableCell>
            <AdminTableMutedCell>{d.owner_email}</AdminTableMutedCell>
            <AdminTableMutedCell>{d.node_count}</AdminTableMutedCell>
            <AdminTableMutedCell>{d.edge_count}</AdminTableMutedCell>
            <AdminTableMutedCell>{new Date(d.updated_at).toLocaleDateString('pt-BR')}</AdminTableMutedCell>
            <AdminTableCell>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/5" onClick={() => setDeleteId(d.id)}>
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(0 84% 60%)' }} />
              </Button>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTable>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar diagrama</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteDiagram.isPending ? 'Deletando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
