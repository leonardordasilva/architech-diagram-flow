import { useState, useRef, useEffect } from 'react';
import { useAdminUsers, useAdminMutations } from '../hooks/useAdminQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { MoreHorizontal, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminTable, { AdminTableRow, AdminTableCell, AdminTableMutedCell, AdminPagination } from '../components/AdminTable';

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const filters = debouncedSearch ? { email: debouncedSearch } : undefined;
  const { data, isLoading } = useAdminUsers(page, filters);
  const { updatePlan, suspendUser, deleteUser } = useAdminMutations();

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
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
    <div className="space-y-6 admin-animate-in">
      <AdminPageHeader title="Usuários" description="Gerenciar contas de usuário" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 border-0 text-sm"
          style={{
            background: 'hsl(var(--admin-surface))',
            color: 'hsl(var(--admin-text))',
            outline: '1px solid hsl(var(--admin-border))',
          }}
        />
      </div>

      <AdminTable
        columns={[
          { header: 'Email' },
          { header: 'Plano' },
          { header: 'Cadastro' },
          { header: 'Status' },
          { header: '', className: 'w-10' },
        ]}
        isLoading={isLoading}
      >
        {data?.data?.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Nenhum resultado.
            </td>
          </tr>
        ) : data?.data?.map((u) => (
          <AdminTableRow key={u.id}>
            <AdminTableCell>
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'hsl(var(--admin-accent-muted))', color: 'hsl(var(--admin-accent))' }}
                >
                  {u.email[0].toUpperCase()}
                </div>
                {u.email}
              </div>
            </AdminTableCell>
            <AdminTableCell>
              {u.subscription_status === 'active' && u.plan !== 'free' ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Select defaultValue={u.plan} disabled>
                          <SelectTrigger
                            className="w-24 h-7 text-xs border-0 opacity-50 cursor-not-allowed"
                            style={{ background: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-center">
                      <p>Assinatura Stripe ativa. Use a seção Billing para alterar o plano.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Select defaultValue={u.plan} onValueChange={(v) => handlePlanChange(u.id, v)}>
                  <SelectTrigger
                    className="w-24 h-7 text-xs border-0"
                    style={{ background: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </AdminTableCell>
            <AdminTableMutedCell>{new Date(u.created_at).toLocaleDateString('pt-BR')}</AdminTableMutedCell>
            <AdminTableCell>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: u.suspended_at ? 'hsl(0 63% 15%)' : 'hsl(152 69% 15%)',
                  color: u.suspended_at ? 'hsl(0 84% 65%)' : 'hsl(152 69% 55%)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: u.suspended_at ? 'hsl(0 84% 60%)' : 'hsl(var(--admin-success))' }}
                />
                {u.suspended_at ? 'Suspenso' : 'Ativo'}
              </span>
            </AdminTableCell>
            <AdminTableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/5">
                    <MoreHorizontal className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                  </Button>
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
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTable>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
