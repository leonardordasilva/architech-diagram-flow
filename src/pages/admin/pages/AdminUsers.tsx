import { useState } from 'react';
import { useAdminUsers, useAdminMutations } from '../hooks/useAdminQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');

  const filters = debouncedSearch ? { email: debouncedSearch } : undefined;
  const { data, isLoading } = useAdminUsers(page, filters);
  const { updatePlan, suspendUser, deleteUser } = useAdminMutations();

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__adminSearchTimer);
    (window as any).__adminSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const handlePlanChange = (userId: string, plan: string) => {
    updatePlan.mutate({ userId, plan }, {
      onSuccess: () => toast({ title: 'Plano atualizado' }),
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleSuspend = (userId: string, suspend: boolean) => {
    suspendUser.mutate({ userId, suspend }, {
      onSuccess: () => toast({ title: suspend ? 'Usuário suspenso' : 'Usuário reativado' }),
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate({ userId: deleteTarget.id }, {
      onSuccess: () => {
        toast({ title: 'Conta deletada' });
        setDeleteTarget(null);
        setConfirmEmail('');
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const totalPages = Math.ceil((data?.count ?? 0) / 20);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Usuários</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Plano</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Cadastro</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum resultado.</td></tr>
              ) : data?.data?.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3 text-foreground">{u.email}</td>
                  <td className="p-3">
                    <Select defaultValue={u.plan} onValueChange={(v) => handlePlanChange(u.id, v)}>
                      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <Badge variant={u.suspended_at ? 'destructive' : 'secondary'}>
                      {u.suspended_at ? 'Suspenso' : 'Ativo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleSuspend(u.id, !u.suspended_at)}>
                          {u.suspended_at ? 'Reativar' : 'Suspender'}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/diagrams?userId=${u.id}`}>Ver diagramas</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ id: u.id, email: u.email })}
                        >
                          Deletar conta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmEmail(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados do usuário serão removidos. Digite o email <strong>{deleteTarget?.email}</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Digite o email para confirmar"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmEmail !== deleteTarget?.email || deleteUser.isPending}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending ? 'Deletando...' : 'Confirmar deleção'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
