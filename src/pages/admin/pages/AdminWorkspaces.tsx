import { useState } from 'react';
import { useAdminWorkspaces, useAdminMutations } from '../hooks/useAdminQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Dono</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Plano</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Membros</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Diagramas</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Criado em</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum workspace.</td></tr>
              ) : data?.data?.map((w) => (
                <tr key={w.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3 text-foreground">{w.name}</td>
                  <td className="p-3 text-muted-foreground">{w.owner_email}</td>
                  <td className="p-3"><Badge variant="secondary">{w.plan}</Badge></td>
                  <td className="p-3 text-muted-foreground">{w.member_count}</td>
                  <td className="p-3 text-muted-foreground">{w.diagram_count}</td>
                  <td className="p-3 text-muted-foreground">{new Date(w.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ id: w.id, name: w.name })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próximo</Button>
        </div>
      )}

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
