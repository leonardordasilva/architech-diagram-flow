import { useState } from 'react';
import { useAdminDiagrams, useAdminMutations } from '../hooks/useAdminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Diagramas</h1>
      {userId && <p className="text-sm text-muted-foreground">Filtrado por usuário: {userId}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Título</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Dono</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Nodes</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Edges</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Atualizado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum diagrama.</td></tr>
              ) : data?.data?.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3 text-foreground">{d.title}</td>
                  <td className="p-3 text-muted-foreground">{d.owner_email}</td>
                  <td className="p-3 text-muted-foreground">{d.node_count}</td>
                  <td className="p-3 text-muted-foreground">{d.edge_count}</td>
                  <td className="p-3 text-muted-foreground">{new Date(d.updated_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(d.id)}>
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
